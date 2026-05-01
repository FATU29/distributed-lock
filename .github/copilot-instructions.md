# GitHub Copilot — repo instructions

> Authoritative guides:
> - [`/CLAUDE.md`](../CLAUDE.md) — repo root (summary + where AI docs live).
> - [`/booking-service/CLAUDE.md`](../booking-service/CLAUDE.md) — service-level rules.
> - [`/AGENTS.md`](../AGENTS.md) — repo-level open-standard mirror.
> - [`/docs/ai/README.md`](../docs/ai/README.md) — **AI checklist**: CRUD slices + mandatory unit tests (`test/fakes/` + `*.service.spec.ts`).
> - [`/docs/scenario/content.md`](../docs/scenario/content.md) — requirements + architecture rationale (load-bearing).
>
> Path-scoped Copilot rules: [`.github/instructions/`](instructions/).

This is a NestJS 11 + Prisma + PostgreSQL + Redis appointment-scheduler service. Single service: `booking-service/`. Clean architecture, ports-and-adapters.

## Architecture rules — non-negotiable

- **Layers**: `domain/` → `application/` → `infrastructure/` & `interface/`. Dependencies point inward only.
- **Domain & application** import nothing from `@nestjs/*`, `@prisma/client`, `ioredis`, `kafkajs`, or any I/O lib. Pure TypeScript only.
- **Ports** (interfaces) live in `domain/ports/`. **Adapters** live in `infrastructure/` and implement them. Inject ports via DI tokens, never concrete classes.
- **PostgreSQL = source of truth.** Redis = cache + lock store, never source of truth.
- **Cache-aside**: read Redis → on miss read PG → fill cache. Writes hit PG first, then invalidate the cache key.

## Booking flow (canonical)

```
validate → Redlock acquire → re-check in PG → INSERT (appointment + outbox) in one prisma.$transaction
        → invalidate cache → release lock via token-checked Lua DEL
```

The in-lock PG re-check is mandatory — the cache is not authoritative.

## Redlock

5 independent Redis masters (`redlock-1`…`redlock-5`), no replication, 3-of-5 quorum. Lock keys are per resource: `lock:bay:{bayId}:{slot}` and `lock:tech:{techId}:{slot}` — never global. Use the `redlock` npm library, never hand-roll.

## Prisma

`prisma/schema.prisma` is the only schema source. `PrismaClient` is wrapped in `infrastructure/prisma/prisma.service.ts`. Prisma types never leak past `infrastructure/` — map to domain entities in `persistence/mappers/`.

## Scheduling CRUD + Users — repositories (DB connection layer)

- Ports live in `booking-service/src/domain/ports/` (`UserRepository`, `DealershipRepository`, `ServiceTypeRepository`, `ServiceBayRepository`, `TechnicianRepository`, `VehicleRepository`, `AppointmentRepository`, …). DI tokens are `Symbol`s exported next to each interface. Barrel: `domain/ports/index.ts`.
- Production: `Prisma*` repositories in `booking-service/src/infrastructure/persistence/`. One Prisma adapter per aggregate. **No `Mock*Repository` / `Http*Repository` driver split, no `src/modules/` tree.**
- **Unit tests**: every CRUD aggregate needs `booking-service/test/fakes/fake-<aggregate>.repository.ts` and `booking-service/src/application/<aggregate>/<aggregate>.service.spec.ts`. See [`docs/ai/README.md`](../docs/ai/README.md). **`AppointmentRepository` has no `create`** — confirm booking is a future use-case; tests seed with `FakeAppointmentRepository.place(...)`.
- HTTP-e2e may override ports with fakes (pattern: `test/users.e2e-spec.ts`).
- Dev fixtures: `booking-service/prisma/seed.ts` (idempotent, stable UUIDs).

## Errors

Domain throws plain typed errors (`SlotAlreadyBookedError`, `LockNotAcquiredError`, etc.). The interface layer's exception filter maps them to `HttpException`. Never throw `HttpException` from domain or application.

## Tests

- **Unit** (domain + application): hand-written fakes in `booking-service/test/fakes/`. Don't mock Prisma. **Do not add or change CRUD without the matching fake + `*.service.spec.ts`** — [`docs/ai/README.md`](../docs/ai/README.md).
- **Integration** (infrastructure): real Postgres + real Redis from `docker-compose.dev.yml`.
- **E2E**: `test/e2e/`, supertest against the booted app with all real adapters.

## TypeScript / Nest conventions

- File names kebab-case, one primary export per file. No barrel `index.ts` re-exports.
- Constructor injection with `private readonly`. Singleton scope unless there's a concrete reason.
- Async/await everywhere; `no-floating-promises` is on.
- Default to no comments. Add one only when the *why* is non-obvious.

## Don'ts

- Don't reuse a domain entity as a DTO, or a Prisma model as a domain entity.
- Don't import `@prisma/client` outside `infrastructure/`.
- Don't release Redlock with plain `DEL` — token-checked Lua only.
- Don't add a global booking lock; don't lock against the cache Redis.
- Don't publish to Kafka from a request path — outbox row only.
- Don't skip the in-lock PG re-check.
- Don't add a `Mock*Repository` / `Http*Repository` driver split. One Prisma repository per aggregate; tests use the in-memory fake under `test/fakes/`.
- Don't add abstractions ahead of need or infra not in the architecture doc.
- Don't disable lint rules to pass — fix the underlying issue.
