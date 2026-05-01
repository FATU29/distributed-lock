---
applyTo: "booking-service/src/{domain,application}/**"
---

# Domain & Application layer — strict rules

These two layers have the strictest constraints in the codebase. Violations look like ordinary code and break the architecture silently.

## Imports — what's allowed

- Standard library, plain TypeScript.
- Pure utility libs that don't do I/O (e.g. `zod` for value-object validation).
- Other files within `domain/` and `application/`.

## Imports — banned

- `@nestjs/*` (no `@Injectable`, no `@Module`, no decorators of any kind in domain). Application may use `@Injectable()` only if NestJS DI requires it for use-case classes — prefer constructor-only when possible.
- `@prisma/client`, any Prisma type.
- `ioredis`, `redis`, `redlock`.
- `kafkajs`, any messaging lib.
- `axios`, `node-fetch`, any HTTP client.
- `fs`, `path`, `os`, anything that reaches outside the process.

## Patterns

- Define interfaces (ports) for any outside dependency in `domain/ports/`. The application layer consumes them via DI tokens.
- Throw plain typed domain errors (`SlotAlreadyBookedError`, `LockNotAcquiredError`). Never `HttpException` here — that's interface-layer concern.
- Value objects validate invariants in their constructor. DTOs validate HTTP shape. Don't conflate them.
- Use-cases orchestrate; they don't contain query logic. If a use-case is doing a lot of branching that depends on data, the rule probably belongs on a domain entity.

## Tests in this layer

- Hand-written fakes that implement the same ports the production adapters do. Live in `booking-service/test/fakes/` (or co-located).
- No `jest.mock()` of infrastructure. No Prisma mocks.
- For pure use-cases, `new BookAppointmentUseCase(fakeRepo, fakeCache, fakeLock, ...)` is faster and clearer than `Test.createTestingModule`.
- **CRUD aggregate services**: every `*Service` under `booking-service/src/application/` must have a sibling **`*.service.spec.ts`** that injects the matching **`Fake*Repository`** from `test/fakes/`. Mandatory checklist: [`docs/ai/README.md`](../../docs/ai/README.md).
