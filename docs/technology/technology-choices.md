# Technology choices — summary

Justifications are aligned with the scenario: **N stateless instances**, **Postgres as source of truth**, **Redis for cache + locks**, **p99 SLOs** on availability and confirm paths. Where a pillar is spelled out in detail elsewhere, this file stays short and links there.

---

## Runtime and language

| Choice | Justification |
| --- | --- |
| **Node.js** | Single runtime for I/O-heavy HTTP + concurrent Redis/Postgres clients; matches Nest and the existing OSS ecosystem (Prisma, ioredis, OTel). |
| **TypeScript** | End-to-end types from HTTP DTOs through domain value objects; catches boundary mistakes before production. |

---

## Application framework

| Choice | Justification |
| --- | --- |
| **NestJS 11** | First-class DI and module boundaries match **clean architecture** wiring (controllers vs use-cases vs providers). Global `ValidationPipe`, lifecycle hooks (`OnModuleDestroy` for adapters), and a stable HTTP story without building routing/middleware by hand. |

---

## Data and persistence

| Choice | Justification |
| --- | --- |
| **PostgreSQL** | **System of record**: ACID transactions, foreign keys, overlap-friendly queries for bay/technician conflicts, and a natural home for the **transactional outbox** next to `Appointment` inserts. See [../scenario/content.md](../scenario/content.md) §1. |
| **Prisma** | Single schema and migration path (`prisma/schema.prisma`); generated client; repositories stay in `infrastructure/` with mappers to domain — matches repo rules. |

---

## Cache and distributed locking

| Choice | Justification |
| --- | --- |
| **Redis** (via **ioredis**) | **Sub-ms reads** and high QPS for cache-aside availability projections; **separate** Redis cluster role for locks so cache eviction or cache Redis failover does not erase lock semantics. See [../scenario/content.md](../scenario/content.md) §1–2 and [../architecture-diagram/architecture-final.mmd](../architecture-diagram/architecture-final.mmd). |
| **`redlock` (npm)** | Implements the **Redlock algorithm** (quorum across independent masters, token-checked release). Avoids hand-rolled acquire/release timing bugs that silently break mutual exclusion. |

---

## HTTP validation

| Choice | Justification |
| --- | --- |
| **class-validator** + **class-transformer** | Native fit with Nest’s `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`): wire shapes stay in DTO classes; invalid payloads fail before application code. |

---

## Observability

| Choice | Justification |
| --- | --- |
| **pino** + **nestjs-pino** | Fast structured JSON logging; request-scoped child loggers; budget-friendly vs slower loggers under a **200 ms** confirm p99. |
| **prom-client** + **@willsoto/nestjs-prometheus** | Pull-based `/metrics` fits **N stateless** instances; histograms aggregate quantiles fleet-wide; enforces low-cardinality labels. |
| **OpenTelemetry** (Node SDK + auto-instrumentations + **OTLP/HTTP**) | Booking touches Postgres, Redis, and multiple lock nodes — **distributed traces** are the practical way to see where latency goes; vendor-neutral export. |

Full “why not X” comparisons: [../observability/strategy.md](../observability/strategy.md).

---

## Quality and developer workflow

| Choice | Justification |
| --- | --- |
| **Jest** + **ts-jest** | Unit tests next to source (`*.spec.ts`); familiar defaults for Nest. |
| **supertest** | E2E HTTP tests against a booted app without running a browser. |
| **ESLint** + **typescript-eslint** + **Prettier** | Consistent style and static checks; aligns with `no-floating-promises` and layering discipline in review. |
| **Husky** + **lint-staged** | Fast pre-commit gate (format, lint, typecheck, related tests) so main stays mergeable; CI remains the full gate. |

---

## Async integration (architecture)

| Choice | Justification |
| --- | --- |
| **Transactional outbox** (rows in Postgres) + **Kafka** (via external **CDC / relay**) | **Same transaction** as the domain write avoids dual-write (DB committed, event never published, or the reverse). The scheduler service only **inserts outbox rows**; relay and consumers are out of repo. See [../database/outbox.md](../database/outbox.md) and [../scenario/content.md](../scenario/content.md). |

---

## What is intentionally not chosen here

- **No second migration system** beside Prisma.
- **No Kafka producer in the request path** — outbox only.
- **No single-Redis-master lock** for booking — Redlock quorum on **independent** Redis nodes (see scenario §4).
- **No observability or Prisma imports in `domain/` / `application/`** — keeps inner layers testable and dependency-correct.
