# Observability strategy — booking-service

This document records **what** observability tooling the booking-service uses and, more importantly, **why** each choice was made over the alternatives. The architecture in [../scenario/content.md](../scenario/content.md) imposes specific constraints (p99 SLO budgets, N stateless instances, distributed-locking critical section, cache-aside read path) — those constraints, not generic "best practice", drive the choices below.

If you're about to swap one of these tools, read the corresponding "Why this and not X" section first. The decision was load-bearing for at least one design property.

---

## TL;DR

| Pillar | Choice | One-line why |
|---|---|---|
| Logging | **pino** + **nestjs-pino** | Fastest Node.js logger; 200 ms p99 budget can't afford slow loggers |
| Metrics | **prom-client** + **@willsoto/nestjs-prometheus** | Pull model fits N stateless instances; cardinality discipline is enforceable |
| Tracing | **OpenTelemetry** (`@opentelemetry/sdk-node` + auto-instrumentations) + **OTLP/HTTP** | Booking flow crosses 3+ I/O systems — without distributed traces you can't see where the 200 ms went |
| Correlation | `X-Request-Id` propagated by pino-http; `trace_id` injected into every log line via pino mixin | Logs ↔ traces join in the backend without a separate correlation pipeline |

All three pillars live in [`booking-service/src/infrastructure/observability/`](../../booking-service/src/infrastructure/observability/). No observability code leaks into `domain/` or `application/` — the dependency rule is the same as for Prisma and Redis.

---

## Constraints that drove the choices

These are the properties of the system that ruled options in or out. Each subsequent section refers back to them.

1. **p99 latency SLOs** ([content.md §6](../scenario/content.md)): cache hit < 5 ms, cache miss < 25 ms, lock acquire < 50 ms, end-to-end booking < 200 ms. Observability cannot meaningfully eat into these budgets.
2. **N stateless scheduler instances behind a load balancer** ([content.md §3](../scenario/content.md)). Anything that requires per-instance configuration drift, sticky sessions, or out-of-band push to a central collector adds operational burden.
3. **6-step booking flow that crosses Postgres, the cache Redis, and the 5 Redlock nodes**. A failure or latency spike anywhere in that chain manifests as one HTTP 5xx. Without distributed tracing, root-causing this requires log archeology across three systems.
4. **Clean architecture**: domain and application layers cannot depend on framework or I/O code. Observability libraries belong in `infrastructure/`. Application code talks through ports if it needs to log/measure something explicitly — but mostly it doesn't, because instrumentation is automatic.
5. **NestJS 11 is the framework**. Tools must integrate cleanly with Nest's DI, lifecycle, and logger interface, or they create boilerplate every consumer has to repeat.
6. **OSS-first stack** — the rest of the architecture (Postgres, Redis, Kafka) is OSS. Observability follows the same posture: vendor-neutral wire formats, exporters swappable.

---

## 1. Logging — pino via nestjs-pino

### What

- Library: [`pino`](https://github.com/pinojs/pino) v10, integrated through [`nestjs-pino`](https://github.com/iamolegga/nestjs-pino) v4.
- Wired in [`infrastructure/observability/logging.module.ts`](../../booking-service/src/infrastructure/observability/logging.module.ts).
- JSON output in production; `pino-pretty` only in development (toggled by `NODE_ENV`).
- `X-Request-Id` honoured if upstream sends one, generated otherwise; echoed back in the response header.
- Every log line is stamped with `trace_id` and `span_id` of the active OTel span via a pino `mixin`.
- `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]` redacted at the log line.

### Why pino and not Winston / Bunyan / `console.log`

- **Speed.** Pino is roughly 5× faster than Winston and 10× faster than Bunyan in published benchmarks; it serialises JSON without buffering through string templates and offloads transport (pretty-printing, file writes) to a worker thread by default. The booking flow has a 200 ms p99 budget — losing 5–10 ms per request to logging is a regression we can't justify when the alternative ships at the same fidelity.
- **JSON by default.** Production logs are consumed by a log shipper (Loki / ELK / etc.) that wants structured input, not formatted strings. Winston supports JSON but defaults to a printf-style template; pino's defaults match the operational target.
- **Async transport.** Pretty-printing in pino runs in a separate worker so `pino-pretty` can't slow request handlers. Bunyan and Winston both pretty-print on the hot path.
- **First-class child loggers.** `req.log = parent.child({ req_id })` is how nestjs-pino correlates every log line in a request without us threading a context object through the call graph. Winston has child loggers but they were added late and aren't as cheap.
- **Not `console.log`.** No level filtering, no structured output, no async sink, no redaction, blocks the event loop on stderr writes when output is piped to a slow consumer.

### Why nestjs-pino specifically

- Replaces NestJS's built-in `Logger` so framework-internal logs (request start, exception filter, lifecycle events) flow through the same pipeline as application logs. Without this, the boot logs and exception traces would still be unstructured, defeating half the point.
- Ties an HTTP request's logger to AsyncLocalStorage so any service injected into a request handler can call `this.logger.log(...)` and the line carries `req.id`, `trace_id`, `span_id` automatically.
- Maintained, ships TypeScript types, supports Nest 11 — the alternatives (`@nestjs/common` Logger with manual JSON, or `@ntegral/nestjs-winston`) require manual context plumbing for every request scope.

### What we deliberately did NOT do

- **No log aggregator chosen here.** The doc stops at "emit JSON to stdout". The container runtime captures stdout; what reads from there (Fluent Bit → Loki / CloudWatch / Datadog) is a deployment concern, not an application concern.
- **No `console.log` allowed.** A future ESLint rule (`no-console`) should enforce this, but the social rule comes first.
- **No pino transports configured in process** beyond `pino-pretty` for dev. Shipping logs from inside the Node process couples the app's failure modes to the log pipeline's failure modes — let the container runtime handle it.

---

## 2. Metrics — Prometheus via prom-client

### What

- Library: [`prom-client`](https://github.com/siimon/prom-client) v15, wrapped by [`@willsoto/nestjs-prometheus`](https://github.com/willsoto/nestjs-prometheus) v6.
- Wired in [`infrastructure/observability/metrics.module.ts`](../../booking-service/src/infrastructure/observability/metrics.module.ts).
- `/metrics` endpoint served on the same port as the API (8080) — Prometheus scrapes it.
- Default Node.js metrics enabled (event loop lag, GC, memory, file descriptors, active handles).
- Custom histograms and counters seeded for the four SLO paths and the booking flow's terminal outcomes.
- All metrics tagged with `service=booking-service` and `env={NODE_ENV}` as default labels.

### The metrics that exist (and why each one)

Names defined in [`metrics.module.ts`](../../booking-service/src/infrastructure/observability/metrics.module.ts):

| Metric | Type | Labels | Why it exists |
|---|---|---|---|
| `booking_confirm_duration_seconds` | Histogram | `outcome` | The headline SLO (200 ms p99). Buckets straddle the target: 25/50/100/150/200/300/500/1000/2000 ms. A `histogram_quantile(0.99, …)` reads cleanly against the SLO. |
| `availability_read_duration_seconds` | Histogram | `source=cache\|db` | Two SLOs in one metric — split by `source` so cache hit (5 ms) and miss (25 ms) targets are queried separately. |
| `redlock_acquire_duration_seconds` | Histogram | `contended` | Verifies the 50 ms uncontended SLO and detects contention regressions when the `contended=true` bucket fills. |
| `redlock_outcome_total` | Counter | `outcome` | `quorum_failed` rate is the canary for Redis cluster health; `token_mismatch` is the canary for clock-drift / GC-pause incidents. |
| `booking_outcome_total` | Counter | `outcome` | `confirmed` vs `conflict` vs `lock_failed` vs `validation` vs `error` — drives the conversion-rate dashboard and the 5xx alert. |
| `availability_cache_outcome_total` | Counter | `outcome=hit\|miss\|error` | Cache hit ratio. If it drops below ~95% the cache-miss SLO starts dominating and reads regress toward the DB target. |

Histogram bucket choice: each set is **SLO-shaped**, not log-scale. Default `prom-client` buckets are sensible for general-purpose timings (5 ms…10 s log-scale) but produce noisy quantile estimates near specific SLO targets. Custom buckets cost a few extra time-series per metric and pay for themselves immediately in dashboard usability.

### Why Prometheus and not StatsD / Datadog / push gateways

- **Pull model fits N stateless instances.** Each scheduler instance exposes `/metrics`; Prometheus scrape configs use service discovery (Kubernetes / Consul) to find them. Instances come and go without coordination. Push-based systems (StatsD, push gateways) require the sender to know where to send, which means either central config or per-instance env injection — operational drag for nothing in return.
- **Histograms compute quantiles in the backend.** `histogram_quantile()` operates on bucket counts aggregated across all instances. StatsD's timer percentiles are computed per-instance and cannot be meaningfully aggregated across N instances (averaging p99s is a textbook anti-pattern). For an SLO that lives at the fleet level, Prometheus histograms are the only correct shape.
- **Cardinality discipline.** Prometheus's pricing model (RAM in the TSDB) makes high-cardinality labels expensive, which forces the design choice we already want: do **not** label metrics with `bayId`, `technicianId`, `customerId`, or anything per-entity. Label by outcome class only. Datadog hides cardinality cost in the bill, which silently leads to teams shipping `customer_id` as a tag and discovering it at month end.
- **Vendor-neutral.** prom-client is OSS, runs anywhere, and the metrics it emits are also consumable by Grafana Mimir / VictoriaMetrics / Cortex / Datadog (via OTel collector) without changing application code.

### Why @willsoto/nestjs-prometheus and not raw prom-client

- Provides DI tokens for metrics so consumers `@InjectMetric('foo_total')` instead of importing a singleton. Keeps the testing story sane — fakes can be substituted at the DI boundary.
- Mounts the `/metrics` controller for us. Doing it by hand is ten lines, but they're ten lines every NestJS team writes the same way.
- Maintained, supports Nest 11.

### What we deliberately did NOT do

- **No business metrics in counters yet.** "Bookings per dealership per hour" is a BI question, not an SRE question — it belongs downstream of the `appointment.events` Kafka topic, computed by the analytics consumer. Putting it in Prometheus would mean labelling by dealership, which would explode cardinality.
- **No Redlock node-level metrics from this app.** Redis exposes its own metrics via `redis_exporter`. Don't double-instrument what the underlying system already reports.
- **No separate admin port for `/metrics`.** Single-port for now keeps compose simple. In production behind a service mesh you'd typically split (so `/metrics` isn't internet-reachable); that's an ingress concern, not application code.

---

## 3. Tracing — OpenTelemetry

### What

- Libraries: `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node`, exporter `@opentelemetry/exporter-trace-otlp-http` over OTLP/HTTP.
- Bootstrapped in [`infrastructure/observability/tracing.ts`](../../booking-service/src/infrastructure/observability/tracing.ts), which is the **first import in `main.ts`** — auto-instrumentations patch modules at `require()` time, so the SDK has to start before NestJS / Express / pg / ioredis are loaded.
- Resource attributes: `service.name=booking-service`, `service.version` from env, `deployment.environment` from `NODE_ENV`.
- Exporter endpoint via `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`. Unset → traces are no-ops (development without a collector still boots).
- `fs` instrumentation explicitly disabled — every spawned span dominates the trace UI with no signal.
- SIGTERM handler flushes the SDK before exit so in-flight spans are not lost on graceful shutdown.

### Why OpenTelemetry and not Jaeger client / Zipkin client / vendor SDK

- **Wire-format-and-API standard.** OTel is the only tracing standard adopted by every backend that matters (Tempo, Jaeger 1.35+, Zipkin via collector, Datadog, Honeycomb, New Relic, Dynatrace). Picking a vendor SDK couples our application code to one backend; OTel decouples the two via the OTLP wire format. We can swap Jaeger for Tempo or Datadog without touching application code.
- **Auto-instrumentation breadth.** `auto-instrumentations-node` covers Express, HTTP, ioredis, pg, dns, net, undici out of the box. The booking flow's I/O — ioredis to cache, ioredis to 5 Redlock nodes, pg under Prisma's hood, HTTP for inbound requests — is all traced without us writing span code. That matters specifically because the SLO investigation question "where did the 200 ms go?" is the question tracing is uniquely good at.
- **Active development, large ecosystem.** Jaeger and Zipkin clients are in maintenance mode; OTel is where the work is.
- **Future Prisma support.** Prisma exposes OTel-shaped spans behind the `tracing` preview feature. When the Prisma schema lands we enable that flag and add `@prisma/instrumentation` to the SDK — no other tracing tool gets that integration.

### Why OTLP/HTTP (not gRPC, not Jaeger native)

- **Firewall-friendly.** Same port semantics as any other HTTP call; works in environments that block arbitrary outbound gRPC.
- **One protocol, many backends.** Both Jaeger and Tempo accept OTLP/HTTP directly; Datadog accepts via a collector. Switching backends is a config change.
- **Slightly higher overhead than gRPC, but not on the request path** — the SDK batches and exports asynchronously off the request thread.

### What we deliberately did NOT do

- **No manual span creation in domain or application code.** Auto-instrumentation already covers I/O. The 200 ms budget is dominated by I/O time, not in-process compute. If a use-case needs custom spans later (e.g. to delineate the 6 booking-flow steps inside the trace), wrap the SDK behind a `Tracer` port in `domain/ports/` rather than importing `@opentelemetry/api` from application code.
- **No tail-based sampling configured here.** Head-based default (sample everything in dev, configurable rate in prod via `OTEL_TRACES_SAMPLER`). Tail sampling is a collector-side concern.
- **No tracing for outbox publishing.** This service writes the outbox row in the same transaction as the appointment; the WAL relay is a separate process. Trace continuity into the relay is the relay's problem, with `traceparent` propagated via the outbox row's payload (a follow-up when the outbox/relay land).

---

## 4. Correlation across the three pillars

The three signals are useful individually. They are dramatically more useful when joined — which requires that every signal carries the same identifiers.

- **Request ID (`req.id`)** is generated or honoured per request by `pino-http`'s `genReqId`. Echoed in `X-Request-Id` response header.
- **Trace ID** is generated by OTel at the inbound HTTP span. The pino mixin pulls it from `trace.getSpan(context.active()).spanContext()` and stamps it on every log line emitted within that span's context (which `nestjs-pino`'s AsyncLocalStorage propagation guarantees).
- **Span ID** likewise — useful for joining a specific log line to the precise span where it was emitted, not just the request.

Net effect:

- "I see a 5xx in Grafana → click through to the trace via `trace_id` → see the failing span → click through to the logs via `trace_id` → read the error". No grep, no timestamp arithmetic.
- "User reports a slow request and gives me their request ID" → search logs by `req.id` → log line includes `trace_id` → pull the trace.

This is the single biggest reason to set up all three pillars together rather than incrementally — partial correlation is barely better than none.

---

## 5. Where the pieces live (and what depends on what)

```
booking-service/
  src/
    main.ts                              # imports tracing.ts FIRST
    app.module.ts                        # imports ObservabilityModule
    infrastructure/
      observability/
        tracing.ts                       # OTel SDK bootstrap (no Nest module)
        logging.module.ts                # nestjs-pino + correlation mixin
        metrics.module.ts                # prom-client metric defs + /metrics
        observability.module.ts          # composes the two Nest modules
docs/
  observability/
    strategy.md                          # this file
```

**Layering rule (re-stated):** `domain/` and `application/` import from `@opentelemetry/api`, `pino`, or `prom-client` is forbidden — same as `@prisma/client` or `ioredis`. If a use-case truly needs to log or measure something it cannot express through the framework's own pipeline, define a port in `domain/ports/` (`Logger`, `Tracer`, `Metric`) and wire an infrastructure adapter that delegates to the real library. So far no use-case has needed this.

---

## 6. Operator-side concerns (out of scope for this repo)

What this repo does not own, but the deploying team must wire up:

- **Log shipper** consuming the container's stdout into a log store (Loki, CloudWatch, ELK).
- **Prometheus** (or a compatible scraper) configured to scrape `:8080/metrics` from every booking-service pod.
- **OTel collector** receiving OTLP/HTTP on `:4318/v1/traces` and forwarding to the chosen backend (Tempo, Jaeger, Datadog, …). Without this set, traces are produced and dropped — the application boots fine.
- **Dashboards and alerts** keyed off the SLO histograms and outcome counters defined in §2.

A minimum viable local stack is `otel/opentelemetry-collector-contrib` + `grafana/tempo` + `prom/prometheus` + `grafana/grafana` in compose. Intentionally not added here — the empty `docs/observability/` directory exists for that follow-up; this strategy doc fills it first because the application-side decisions need to be settled before the operator side has a target to integrate with.

---

## 7. Things that are likely to change later (and the criteria)

- **Prisma tracing.** Once `prisma/schema.prisma` lands, enable `previewFeatures = ["tracing"]` and register `@prisma/instrumentation` in `tracing.ts`. Without this, traces stop at the `prisma.$transaction` boundary instead of showing the SQL.
- **Trace propagation through the outbox.** When the WAL relay lands, the outbox row payload should include `traceparent` so the consumer-side span chains back to the booking request. This is W3C Trace Context — already what OTel emits.
- **Sampling.** Default head-based sampling at 100% is fine until trace volume becomes the budget item. When it does, switch to `parentbased_traceidratio` with a low ratio plus error-biased tail sampling at the collector.
- **Business event metrics.** Booking conversion rate, no-show rate, dealership utilisation belong on the Kafka-consumer side. If they ever appear in this service, push back — that's a layering violation.
- **Profiling (continuous).** Pyroscope / Parca / Datadog Profiler — only when `event_loop_lag_seconds` or end-to-end p99 starts drifting and the trace doesn't pinpoint the spend.

---

## 8. Why all of this is in `infrastructure/`, not at the root

The point of clean architecture in this codebase is that the business rules can be reasoned about without knowing which database, cache, or framework is in use. Observability is a cross-cutting infrastructure concern — it fits the same model. Putting it at `src/observability/` would suggest it sits above the layers; putting it inside `infrastructure/` keeps the dependency rule visible and makes future-you (or a code reviewer) immediately spot a violation if a domain file ever does `import 'pino'`.

The same justification appears in [`booking-service/CLAUDE.md`](../../booking-service/CLAUDE.md) for Prisma, Redis, and the outbox writer. Observability is not different.
