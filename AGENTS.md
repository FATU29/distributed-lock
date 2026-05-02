# AGENTS.md — Repo-level guidance for AI agents

Hello, agent. The canonical guides for this repo are **[CLAUDE.md](CLAUDE.md)** (repo root — summary + AI doc map) and **[booking-service/CLAUDE.md](booking-service/CLAUDE.md)** (full service rules). This file is the open-standard `AGENTS.md` mirror so that Antigravity, Codex, Cursor, Aider, and any other agent that follows the [agents.md](https://agents.md) convention can find their bearings.

The root **CLAUDE.md**, **AGENTS.md**, and **booking-service/AGENTS.md** are kept in lockstep where they overlap. If they drift, **root CLAUDE.md wins for repo-wide bullets**; **booking-service/CLAUDE.md wins for everything inside `booking-service/`** — fix the mirrors.

**CRUD unit-test checklist for AI tools:** [docs/ai/README.md](docs/ai/README.md).

## Read order before making changes

1. [CLAUDE.md](CLAUDE.md) — repo-level summary, where Cursor/Copilot/Claude docs live, non-negotiables, **mandatory CRUD unit-test rule**.
2. [docs/ai/README.md](docs/ai/README.md) — AI-focused checklist: CRUD slice files, fakes + `*.service.spec.ts`, `AppointmentRepository` seeding note.
3. [booking-service/AGENTS.md](booking-service/AGENTS.md) → [booking-service/CLAUDE.md](booking-service/CLAUDE.md) — service-level rules: requirements, the booking flow, Redlock, Prisma, repositories, testing strategy.
3. [docs/scenario/content.md](docs/scenario/content.md) — the requirements and architectural rationale. Load-bearing.
4. [docs/architecture-diagram/architecture-final.mmd](docs/architecture-diagram/architecture-final.mmd) — final architecture diagram.
5. [docs/architecture-diagram/WHY-ENHANCE-PHASE.md](docs/architecture-diagram/WHY-ENHANCE-PHASE.md) — why each architectural phase exists.

## The rules you cannot violate

These are the load-bearing rules. The full reasoning is in CLAUDE.md and the docs above; this is the cheat sheet.

- **Dependency rule**: domain depends on nothing; application depends only on domain; infrastructure implements ports defined inside; interface depends on application. Never invert.
- **No framework / I/O imports in domain or application** (`@nestjs/*`, `@prisma/client`, `ioredis`, `kafkajs` etc. are infrastructure-only).
- **PostgreSQL is the source of truth. Redis is cache + lock store, never source of truth.**
- **Cache-aside, not write-through.** Writes go to PG first, then invalidate the cache key.
- **Booking flow** is exactly: validate → Redlock acquire → re-check in PG → INSERT (appointment + outbox row) in one transaction → invalidate cache → release lock. Don't skip the in-lock re-check; the cache is not authoritative.
- **Redlock = 5 independent Redis masters, no replication, 3-of-5 quorum.** Never lock against the cache Redis. Release with token-checked Lua only.
- **Outbox in same transaction as the domain write.** Never publish to Kafka from a request path.
- **Prisma owns the schema and migrations.** No second migration system. Prisma client lives in infrastructure only — domain/application never sees `@prisma/client` types.
- **`UserRepository` and scheduling ports** (`DealershipRepository`, `ServiceTypeRepository`, `ServiceBayRepository`, `TechnicianRepository`, `VehicleRepository`, `AppointmentRepository`) **live in `booking-service/src/domain/ports/`** with Prisma adapters in `booking-service/src/infrastructure/persistence/` and HTTP modules under `booking-service/src/interface/http/`. One Prisma adapter per aggregate — no `Mock*Repository` / `Http*Repository` driver split. Test code uses in-memory fakes under **`booking-service/test/fakes/`**.
- **Tests**: unit tests use hand-written fakes, never Prisma mocks. **Any new or changed CRUD aggregate must include `test/fakes/fake-<aggregate>.repository.ts` and `src/application/<aggregate>/<aggregate>.service.spec.ts`** (see [docs/ai/README.md](docs/ai/README.md)). Infrastructure and e2e tests use the real Postgres + Redis from compose.

## Don'ts (also load-bearing)

- Don't reuse a domain entity as an HTTP DTO, or a Prisma model as a domain entity.
- Don't add a single global "booking lock" — locks are per `(bay, slot)` and per `(technician, slot)`.
- Don't add abstractions ahead of need. Three similar lines beat a premature abstraction.
- Don't add new infrastructure (queues, datastores, caches) that isn't already in the architecture doc.
- Don't disable lint rules to make code pass — fix the underlying issue.
- Don't grow business logic in mock adapters.

## Local development

```bash
docker compose -f docker-compose.dev.yml up --build
```

Source is bind-mounted; `nest start --watch` recompiles on save. See [booking-service/CLAUDE.md](booking-service/CLAUDE.md) for local development details inside the service.
