# AGENTS.md — booking-service

Canonical guide is **[CLAUDE.md](CLAUDE.md)**. This file is the open-standard `AGENTS.md` mirror for Antigravity, Codex, Cursor, Aider, and other agents. Keep them in lockstep; CLAUDE.md wins on drift.

Repo-level rules: [../AGENTS.md](../AGENTS.md) / [../CLAUDE.md](../CLAUDE.md).

## Read first

1. [CLAUDE.md](CLAUDE.md) — full service guide (requirements, layout, Prisma, Redlock, repositories, observability, testing).
2. [../docs/ai/README.md](../docs/ai/README.md) — **AI assistants**: CRUD vertical slice + **mandatory** `test/fakes/` + `*.service.spec.ts` pairing.
3. [../docs/scenario/content.md](../docs/scenario/content.md) — requirements + architecture rationale. Load-bearing.
4. [../docs/architecture-diagram/WHY-ENHANCE-PHASE.md](../docs/architecture-diagram/WHY-ENHANCE-PHASE.md) — why the architecture is shaped this way.
5. [../docs/observability/strategy.md](../docs/observability/strategy.md) — pillar-by-pillar tool choice + the why.

## What this service is

Scheduler service. Single service in the repo. Owns: HTTP API for **users** plus **scheduling reference CRUD** (`/dealerships`, `/service-types`, `/service-bays`, `/technicians`, `/vehicles`), **appointment read/update/delete** (`GET`/`PATCH`/`DELETE /appointments` — no `POST`; confirm flows through the future booking use-case), the booking flow, Postgres (Prisma), Redis cache-aside, Redlock against 5 independent masters, outbox writes.

## Source layout (clean architecture)

```
prisma/                    # schema.prisma + migrations + seed.ts
src/
  domain/                  # entities, VOs, errors, ports — pure TS
    ports/                 # UserRepository, DealershipRepository, ServiceTypeRepository, … — barrel ports/index.ts
  application/             # aggregate services (CRUD) + future use-cases — ports only
    users/, dealerships/, service-types/, service-bays/, technicians/, vehicles/, appointments/
  infrastructure/
    prisma/
    persistence/           # PrismaUserRepository, PrismaDealershipRepository, … + mappers
    observability/
    cache/                 # (booking) Redis availability
    locking/               # Redlock
    messaging/             # outbox
    config/
  interface/http/
    users/, dealerships/, service-types/, service-bays/, technicians/, vehicles/, appointments/, filters/
  app.module.ts            # imports feature *.module.ts
test/
  fakes/                   # one hand-written fake per repository port used in application unit tests (see ../docs/ai/README.md)
  users.e2e-spec.ts
  e2e/
```

The target layout above is implemented as a strict subset on disk — folders are created **with** their first real file, never as empty placeholders. See [CLAUDE.md](CLAUDE.md) §"Where does this code go?" for the current-state-vs-target table.

### Where each kind of file lives

- **Domain port (interface)** → `src/domain/ports/<aggregate>.repository.ts`. Re-exported from `src/domain/ports/index.ts`. Adapters import via the barrel (`from '../../domain/ports'`), not deep paths.
- **Repository (DB connection layer)** → `src/infrastructure/persistence/<aggregate>.repository.ts`. One Prisma adapter per aggregate (`PrismaUserRepository`, `PrismaBookingRepository`, …). No `Mock*Repository` / `Http*Repository` driver split — that complexity isn't earned here.
- **Cross-cutting adapter** (cache, lock, messaging, time, config, observability) → `src/infrastructure/<concern>/`.
- **HTTP controller / DTO / filter** → `src/interface/http/<aggregate>/` (or `src/interface/http/filters/`).
- **DI wiring** → `src/app.module.ts`. Per-feature `<aggregate>.module.ts` next to the controller only when wiring grows past trivial. There is no `src/modules/` tree.

## Writing APIs in clean architecture

Full recipe with the worked CRUD example, error mapping table, and husky/lint-staged config lives in [CLAUDE.md](CLAUDE.md) §"Writing APIs in clean architecture". The non-negotiables:

- **Vertical slice** per request: `controller → service-or-use-case → port → repository`. Each layer has one job; no boundary crossing.
- **Application layer has two shapes — pick the right one.** Aggregate **service** (one class, methods for each operation) for plain CRUD on a single aggregate; single-purpose **use-case** class for multi-step orchestration where the sequence is the business rule (e.g. the booking flow). Don't split a CRUD service into per-method use-case classes — that's overhead with no payoff. Don't fold the booking flow into a `BookingService` with a 6-step `book()` method — losing the dedicated class loses the orchestration. Worked CRUD example: [src/application/users/users.service.ts](src/application/users/users.service.ts).
- **DTOs** (`class-validator`) live at `interface/http/<aggregate>/dtos/`. Wire shape only; never reuse a domain entity as a DTO and never reuse a DTO as a service/use-case input. Update DTOs (`UpdateUserDto`) only carry mutable fields — identity (`email`) is excluded.
- **Services / use-cases** depend on ports only. No `PrismaService`, no `fetch`, no `pino` import. Throw domain errors, never `HttpException`.
- **Repositories / adapters** are the only files that import the backing library (`@prisma/client`, `ioredis`). Map at the boundary; map Prisma errors → domain errors at the boundary (`P2002` → `UserAlreadyExistsError`, `P2025` → `UserNotFoundError`).
- **IDs are server-assigned.** Prisma uses `@id @default(uuid()) @db.Uuid` — the DB hands out UUIDs. Create-flow DTOs do **not** carry an `id` field; callers never randomize identifiers.
- **Domain errors** in `domain/<aggregate>/errors.ts`. Mapped to HTTP exactly once, in `interface/http/filters/domain-error.filter.ts`.

### Husky + lint-staged pre-commit gate

Installed and wired. [.husky/pre-commit](.husky/pre-commit) runs `npx lint-staged`; [package.json](package.json) holds the `lint-staged` config and a `typecheck` script. On every staged `*.ts`: `prettier --write`, `eslint --fix`, `bash -c 'npm run typecheck'` (full project typecheck — `tsc` doesn't take staged args), `jest --bail --findRelatedTests --passWithNoTests`. Fresh checkout: `npm install` reinstalls the hook via the `prepare: husky` script.

Don't `git commit --no-verify` past a failing hook — fix or rebase, otherwise the rule rots. CI doesn't run husky and must independently run `npm run lint`, `npm run typecheck`, `npm test`, integration, and e2e.

### Test strategy per layer

- **Domain / application** — unit; hand-written fakes for ports. No Prisma / Redis mocks. Coverage ≥ 95% / 90%. Fakes live in [test/fakes/](test/fakes/) (**`fake-user.repository.ts`**, **`fake-dealership.repository.ts`**, … — each CRUD aggregate has a fake + [`*.service.spec.ts`](src/application/) next to the service). Mandatory checklist: [../docs/ai/README.md](../docs/ai/README.md).
- **Repositories (infrastructure)** — integration; real Postgres via compose. Gate on `DATABASE_URL` so the suite still passes locally without a DB. Live next to the source as `*.integration-spec.ts`.
- **E2E** — `supertest` against booted app + real wiring; outbound ports can be overridden with the fake (no DB needed). Pattern: [test/users.e2e-spec.ts](test/users.e2e-spec.ts) overrides `USER_REPOSITORY` with `FakeUserRepository`.

Specs live next to the source they cover (`*.spec.ts` for unit, `*.integration-spec.ts` for integration). E2E lives in `test/`.

## The booking flow (don't deviate)

```
1. Validate request.
2. Acquire Redlock on `lock:bay:{bayId}:{slotStart}` and `lock:tech:{techId}:{slotStart}`.
3. Re-check availability against Postgres (cache may be stale).
4. INSERT Appointment + INSERT outbox row in a single prisma.$transaction.
5. Invalidate `avail:bay:*` / `avail:tech:*` cache keys.
6. Release locks via token-checked Lua DEL on all 5 nodes.
```

`BookAppointmentUseCase` orchestrates all six steps. One file. Don't split it.

## Performance targets (acceptance criteria)

| Path | p99 |
|---|---|
| Availability read (cache hit) | < 5 ms |
| Availability read (cache miss) | < 25 ms |
| Lock acquire (uncontended) | < 50 ms |
| Confirm booking end-to-end | < 200 ms |

## Domain errors → HTTP

| Error | HTTP |
|---|---|
| DTO/VO validation | 400 |
| `VehicleNotEligibleError`, `NoQualifiedTechnicianError`, `BayUnavailableError`, `SlotAlreadyBookedError` | 409 |
| `LockNotAcquiredError` after retries | 503 |
| Entity not found | 404 |

Domain throws plain typed errors. The interface layer's exception filter does the mapping.

## Prisma rules

- `prisma/schema.prisma` is the only source of DB truth.
- `prisma migrate dev` for new migrations (in container only). `prisma migrate deploy` everywhere else.
- `PrismaClient` is instantiated once in `infrastructure/prisma/prisma.service.ts`. Repositories depend on `PrismaService`, never on `PrismaClient` directly.
- `@prisma/client` types never leak past `infrastructure/`. Map to domain entities in `persistence/mappers/`.

## Users repository

- Port `UserRepository` (in [src/domain/ports/user.repository.ts](src/domain/ports/user.repository.ts)) — the DB connection layer for the User aggregate. DI token `USER_REPOSITORY`.
- Production implementation: **`PrismaUserRepository`** at [src/infrastructure/persistence/user.repository.ts](src/infrastructure/persistence/user.repository.ts). Wired in [src/interface/http/users/users.module.ts](src/interface/http/users/users.module.ts). One implementation, Prisma-backed; no driver split, no `Mock*Repository`.
- Test fake: [test/fakes/fake-user.repository.ts](test/fakes/fake-user.repository.ts) — in-memory, mirrors production contract (server-assigned UUIDs, `UserAlreadyExistsError`, `UserNotFoundError`). Used by [src/application/users/users.service.spec.ts](src/application/users/users.service.spec.ts) and [test/users.e2e-spec.ts](test/users.e2e-spec.ts).

## Scheduling CRUD repositories (reference data)

Ports and Prisma adapters follow the same pattern as users: **`domain/ports/*.repository.ts`**, **`infrastructure/persistence/*.repository.ts`**, **`interface/http/<resource>/`**, **`test/fakes/fake-*.repository.ts`**, **`application/*/*.service.spec.ts`**. Details and the full fake/spec matrix: [../docs/ai/README.md](../docs/ai/README.md).
- Dev seed data (User / Customer / Vehicle fixtures) lives in `prisma/seed.ts` and is applied via `npx prisma db seed`. Stable UUIDs, deterministic, no PII.

## Tests

- **Unit** (domain + application): hand-written fakes implementing the ports. No Prisma mocks. Coverage: domain ≥ 95%, application ≥ 90%. **Do not ship new CRUD without the fake + service spec** — [../docs/ai/README.md](../docs/ai/README.md).
- **Integration** (infrastructure): real Postgres + real Redis from compose. Redlock tests must include quorum success, single-node failure, majority failure, token-mismatch release, TTL expiry.
- **E2E**: supertest against booted Nest app with all real adapters.

`BookAppointmentUseCase` spec must cover: happy path, lock not acquired, lock acquired but PG re-check conflict, PG transaction failure, cache invalidation failure (booking still confirmed), each business-rule error.

## Observability

Three pillars, all wired in [src/infrastructure/observability/](src/infrastructure/observability/). Full rationale in [../docs/observability/strategy.md](../docs/observability/strategy.md). The strategy doc explains *why* each tool was picked over the alternatives — read it before swapping any of them.

| Pillar | Tool | One-line why |
|---|---|---|
| Logging | `pino` + `nestjs-pino` | Fastest Node.js logger — 200 ms p99 budget can't afford slow loggers; JSON by default; child loggers correlate per-request without manual plumbing |
| Metrics | `prom-client` + `@willsoto/nestjs-prometheus` | Pull model fits N stateless instances; SLO-shaped histogram buckets; cardinality discipline enforced by Prometheus's pricing model |
| Tracing | `@opentelemetry/sdk-node` + auto-instrumentations, OTLP/HTTP exporter | Booking flow crosses Postgres + cache Redis + 5 Redlock nodes — only distributed tracing answers "where did the 200 ms go?" |

Correlation: `pino-http` honours/generates `X-Request-Id`; a pino `mixin` stamps `trace_id` + `span_id` from the active OTel span onto every log line. Logs ↔ traces join in the backend without a separate pipeline.

Bootstrap order matters: [src/main.ts](src/main.ts) imports `./infrastructure/observability/tracing` **first**, before NestJS — OTel auto-instrumentations patch modules at `require()` time, so the SDK has to start before Express / pg / ioredis are loaded.

SLO-shaped metrics defined in [src/infrastructure/observability/metrics.module.ts](src/infrastructure/observability/metrics.module.ts):
- `booking_confirm_duration_seconds` (200 ms p99)
- `availability_read_duration_seconds` (5 ms hit / 25 ms miss)
- `redlock_acquire_duration_seconds` (50 ms uncontended)
- `redlock_outcome_total`, `booking_outcome_total`, `availability_cache_outcome_total`

Don't import `pino`, `prom-client`, or `@opentelemetry/api` from `domain/` or `application/`. Same dependency rule as Prisma and ioredis. If a use-case truly needs to log/measure/trace something, define a port and an infrastructure adapter.

## Don'ts

- Don't store appointments, locks, or any system-of-record state in Redis.
- Don't lock against the cache Redis. Locks go to `redlock-1`…`redlock-5`.
- Don't release Redlock with plain `DEL`. Token-checked Lua only.
- Don't add a global booking lock — locks are per resource per slot.
- Don't publish to Kafka from a controller / use-case / repository. Outbox row only.
- Don't skip the in-lock PG re-check.
- Don't import `@prisma/client` outside `infrastructure/`.
- Don't add a `Mock*Repository` / `Http*Repository` driver split. One Prisma repository per aggregate; tests use the in-memory fake under `test/fakes/`.
- Don't reintroduce a `src/modules/<feature>/infrastructure/` tree. Repositories live in `src/infrastructure/persistence/`.
- Don't expose seed data from a controller.
- Don't add read replicas, geo-distribution, CQRS, event sourcing — out of scope per [../docs/scenario/content.md](../docs/scenario/content.md) §8.
- Don't `console.log`. Use the injected pino logger so output is JSON, levelled, redacted, and correlated with the active trace.
- Don't import observability libraries (`pino`, `prom-client`, `@opentelemetry/api`) from `domain/` or `application/`.
- Don't label metrics with per-entity IDs (`bayId`, `technicianId`, `customerId`). Cardinality stays bounded — label by outcome class only.
