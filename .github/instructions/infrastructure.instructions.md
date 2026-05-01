---
applyTo: "booking-service/src/infrastructure/**"
---

# Infrastructure layer — adapter rules

This is the only layer where `@prisma/client`, `ioredis`, `redlock`, `kafkajs`, and HTTP clients are allowed.

## Boundaries

- Every concrete class here implements a port defined in `domain/ports/` (or `application/`). If you're writing a class that doesn't implement a port, ask why — most likely it belongs elsewhere or needs a port.
- Infrastructure types (`PrismaClient`, `Redis`, `Redlock`) **must not** appear in method signatures returned to the application layer. Map to domain entities at the adapter boundary in `persistence/mappers/`.
- Adapters can import from `domain/` and `application/` (the inner layers). They can import from each other within `infrastructure/`. They can never be imported by `domain/` or `application/`.

## Prisma adapters

- One `PrismaService extends PrismaClient` lives in `infrastructure/prisma/`. All repositories depend on it.
- Repositories return domain entities, not Prisma models. The mapper layer is non-negotiable.
- Transactions: expose a `UnitOfWork.run(fn)` port that wraps `prisma.$transaction(fn)` so the application layer doesn't see Prisma.

## Redis cache adapter

- `RedisAvailabilityCache implements AvailabilityCache`. TTL is set on every `SET`. Never store data without a TTL.
- Failures of cache operations on the *write* side (e.g. invalidation after a successful PG insert) are logged, not raised. The cache is not authoritative.

## Redlock adapter

- Use the `redlock` npm library against the 5 independent masters from `REDLOCK_NODES`.
- Per-node timeout ~50ms. Quorum 3-of-5. Effective validity = TTL − elapsed − drift margin.
- Release uses canonical token-checked Lua. Copy the script from the spec; do not rewrite.
- Lock keys are per resource: `lock:bay:{bayId}:{slot}`, `lock:tech:{techId}:{slot}`. No global lock.

## User repository

- `PrismaUserRepository` (in `infrastructure/persistence/user.repository.ts`, TBD) implements the `UserRepository` port. One Prisma adapter per aggregate — no mock-vs-real driver split, no `UsersModule` shell.
- Maps Prisma errors at the boundary: `P2002` → `UserAlreadyExistsError`, `P2025` → `UserNotFoundError`. Maps rows to domain entities via `mappers/user.mapper.ts`.
- Tests use the in-memory `FakeUserRepository` under `booking-service/test/fakes/`. Don't add a `Mock*Repository` to `infrastructure/`.
- Dev User / Customer / Vehicle fixtures live in `prisma/seed.ts`. Stable UUIDs, deterministic, no PII.

## Tests in this layer

- Run against real Postgres + real Redis from `docker-compose.dev.yml`. Mocks defeat the purpose — the architecture depends on actual `SET NX PX` and transaction semantics.
- Each test rolls back its transaction or runs against a per-test database.
