# Component roles — booking-service

One-line roles for the main pieces of the scheduler. Dependency direction: **interface → application → domain ← infrastructure**.

## Clean architecture layers

| Component | Role |
| --- | --- |
| **Domain (`src/domain/`)** | Business language: entities, value objects, domain errors. Pure TypeScript — no Nest, Prisma, Redis, or HTTP. |
| **Domain ports (`src/domain/ports/`)** | Outbound contracts (repositories, locks, cache, etc.). Application depends on these interfaces; infrastructure implements them. |
| **Application — aggregate services (`src/application/<aggregate>/`)** | CRUD and simple workflows for one aggregate (users, dealerships, …). Calls ports only; maps “not found” to domain errors. |
| **Application — use-cases (`src/application/<verb>-<noun>/`)** | Multi-step orchestration where order matters (e.g. book appointment: validate → lock → PG re-check → transaction → cache → release lock). |
| **Infrastructure (`src/infrastructure/`)** | Adapters: Prisma, Redis, Redlock, config, observability, payment mocks. Maps wire/DB shapes ↔ domain at boundaries. |
| **Interface / HTTP (`src/interface/http/`)** | HTTP surface: controllers, DTOs (`class-validator`), response mappers. Translates domain errors → HTTP via the global exception filter. |

## Infrastructure by concern

| Component | Role |
| --- | --- |
| **`infrastructure/persistence/`** | Prisma repositories implementing domain ports; the only place that talks to Postgres for aggregates. |
| **`infrastructure/persistence/mappers/`** | Row ↔ domain entity mapping; keeps `@prisma/client` types inside infrastructure. |
| **`infrastructure/prisma/`** | `PrismaService` lifecycle (connect/disconnect) for the app. |
| **`infrastructure/locking/`** | Distributed lock adapter (e.g. Redlock) implementing `DistributedLock` — serialize confirm per bay/slot and technician/slot. |
| **`infrastructure/redis/`** | Redis client wiring for cache and any Redis-backed adapters (not the system of record). |
| **`infrastructure/config/`** | Environment and connection settings (e.g. DB, Redis) validated for startup. |
| **`infrastructure/observability/`** | Logging, metrics, tracing — I/O and correlation at the edges of the process. |
| **`infrastructure/payment/`** | Outbound payment (or mock) adapters when the flow needs them; no business rules here. |

## Outside `src/` but owned by the service

| Component | Role |
| --- | --- |
| **`prisma/`** | Schema, migrations, seed — single source of truth for the relational model. |
| **`test/fakes/`** | In-memory port implementations for fast application/domain unit tests (no Prisma mocks). |

## Top-level `docs/` folders (what each is for)

| Folder | Role |
| --- | --- |
| **`scenario/`** | Product requirements and architecture rationale for the scheduler. |
| **`architecture-diagram/`** | Architecture diagrams and phased “why” narratives. |
| **`api-contract/`** | HTTP shapes, status codes, and error contracts per resource. |
| **`database/`** | Table-level reference and modeling notes. |
| **`observability/`** | Logging/metrics/tracing strategy and tooling choices. |
| **`ai/`** | Checklists and conventions for assistants (e.g. CRUD + fakes). |
| **`explain/`** | This folder — narrow, standalone explanations (like this file). |
