# CLAUDE.md — booking-service

This is the **scheduler service** from the architecture diagram, and the only service in the repo. Read the repo-level [../CLAUDE.md](../CLAUDE.md) for clean-architecture rules that apply across the codebase; this file adds the rules specific to this service.

Source-of-truth docs (read before non-trivial changes):
- [../docs/scenario/content.md](../docs/scenario/content.md) — requirements and architecture rationale
- [../docs/diagram/architecture-final.mmd](../docs/diagram/architecture-final.mmd) — final architecture diagram
- [../docs/diagram/WHY-ENHANCE-PHASE.md](../docs/diagram/WHY-ENHANCE-PHASE.md) — why each phase exists
- [../docs/observability/strategy.md](../docs/observability/strategy.md) — observability pillars (logging / metrics / tracing) and why each tool was chosen over the alternatives
- [../docs/ai/README.md](../docs/ai/README.md) — **AI assistants**: CRUD vertical slice + mandatory `test/fakes/` + `*.service.spec.ts` pairing

If anything in this file conflicts with those docs, the docs win — fix this file.

---

## Requirements (verbatim from the scenario doc)

The service must:

1. **Resource-constrained booking** — accept a request for a service appointment for a specific vehicle, service type, and dealership at a desired time.
2. **Real-time availability check** — before confirming, verify a `ServiceBay` *and* a qualified `Technician` are both free for the entire service duration.
3. **Confirmed appointment record** — on success, persist an `Appointment` linking customer, vehicle, technician, and service bay.

Performance targets ([../docs/scenario/content.md](../docs/scenario/content.md) §6):

| Path | p99 target |
|---|---|
| Availability read (cache hit) | < 5 ms |
| Availability read (cache miss) | < 25 ms |
| Lock acquire (uncontended) | < 50 ms |
| Confirm booking end-to-end | < 200 ms |

These are acceptance criteria. Any change that regresses them needs to be discussed before merge.

---

## What this service owns

- The HTTP API for **users** (`/users`) and **scheduling reference CRUD**: dealerships, service types, service bays, technicians, vehicles (full REST). **Appointments**: `GET` / `PATCH` / `DELETE` only — **no `POST /appointments`** for confirm; booking, listing, and cancelling flows use dedicated use-cases (Redlock + transactional insert + outbox), not raw appointment INSERT over REST.
- The booking flow: validate → cache-aside availability → Redlock → re-check in PG → INSERT in transaction → invalidate cache → release lock → respond.
- The persistent record of `Appointment`, `Technician`, `ServiceBay`, `Vehicle`, `Customer`, `User`, plus the `outbox` table.
- The cache-aside layer in front of PG for hot availability reads.
- The producer side of the outbox pattern (writes outbox rows in the same transaction; the WAL relay is a separate process).
- Prisma-backed repositories for **User** and scheduling aggregates (`Dealership`, `ServiceType`, …). User/Customer/Vehicle fixture rows for dev and tests come from `prisma/seed.ts`.

What it does **not** own:
- Notification delivery, billing, parts reservation, technician roster, analytics, audit logging — those are downstream Kafka consumers, not synchronous calls from this service.
- Kafka relay / WAL tail — separate process (Debezium); this service only writes the outbox row.

---

## Source code layout

**AI assistants:** mandatory CRUD unit-test pairing (`test/fakes/` + `*.service.spec.ts`) — [../docs/ai/README.md](../docs/ai/README.md).

```
booking-service/
  prisma/
    schema.prisma, migrations/, seed.ts
  src/
    domain/
      appointment/, booking/, customer/, dealership/, identifiers/, outbox/, service-bay/, service-type/,
      technician/, user/, vehicle/, reference.errors.ts
      ports/
        *.repository.ts              # User, Dealership, ServiceType, ServiceBay, Technician, Vehicle, Appointment, …
        index.ts
    application/
      users/, dealerships/, …/*.service.ts + *.service.spec.ts
      book-appointment/, check-availability/, …   # (target) booking use-cases — not yet on disk
    infrastructure/
      prisma/, observability/, config/
      persistence/
        *.repository.ts              # Prisma*Repository + mappers/
      cache/, locking/, messaging/, time/       # (target — booking feature)
    interface/http/
      users/, dealerships/, service-types/, service-bays/, technicians/, vehicles/, appointments/
      filters/domain-error.filter.ts
    app.module.ts, main.ts
  test/
    fakes/                           # fake-* + *.service.spec.ts per CRUD aggregate
    users.e2e-spec.ts, e2e/
```

Tests sit next to source: `*.spec.ts`. E2E in `test/`. **`AppointmentRepository` has no `create`** — seed unit tests with `FakeAppointmentRepository.place(...)`.

---

## Where does this code go? (decision rule)

The layout above mixes **implemented** scheduling CRUD with **target** booking-flow folders (`cache/`, `locking/`, `book-appointment/`, …). When you add code, this rule decides where it lands. Following it is how the layout stays clean as the service grows.

### The dependency invariant

```
domain ──► (nothing)
application ──► domain
infrastructure ──► domain, application
interface ──► application, domain
```

A `domain/` file may not import from `application/`, `infrastructure/`, or `interface/`. An `application/` file may not import from `infrastructure/` or `interface/` — only from `domain/` and other `application/` files (and only via ports for outbound work). DI wiring (`@Module`) lives in `app.module.ts` (root) — there is no separate `modules/` directory; feature wiring is colocated in `app.module.ts` until the service grows enough to justify per-feature `*.module.ts` files alongside their feature folder. Lint rules will eventually enforce the layering; until then it is a code-review rule.

### Where each kind of file lives

| Kind | Home | Notes |
|---|---|---|
| Domain entity, VO, error | `src/domain/<aggregate>/` | Pure TS only; no framework, no I/O. |
| Domain port (interface) | `src/domain/ports/` | Re-exported from `src/domain/ports/index.ts`. Adapters import via the barrel (`from '../../domain/ports'`), not deep paths. |
| Application service / use-case | `src/application/<aggregate-or-use-case>/` | CRUD service for a single aggregate (e.g. `users/users.service.ts`); single-purpose use-case class for multi-step orchestration (e.g. `book-appointment/book-appointment.use-case.ts`). |
| **Repository (DB connection layer)** | `src/infrastructure/persistence/<aggregate>.repository.ts` | Prisma implementation of a domain port. One file per aggregate. Examples: `user.repository.ts` (`PrismaUserRepository implements UserRepository`), `booking.repository.ts` (`PrismaBookingRepository implements BookingRepository`). |
| Persistence mapper | `src/infrastructure/persistence/mappers/<aggregate>.mapper.ts` | Prisma row → domain entity. Pure functions. |
| Cache / lock / messaging / time / config adapter | `src/infrastructure/<concern>/` | Cross-cutting adapters that any feature can wire. |
| HTTP controller / DTO / filter | `src/interface/http/<aggregate>/` (or `interface/http/filters/`) | Controllers per resource. DTOs per request shape. Single global `DomainErrorFilter`. |
| DI wiring | `src/app.module.ts` | Root composition. Per-feature `*.module.ts` (e.g. `users.module.ts`) only when wiring grows beyond ~10 lines. |

**Decision rule for "where does this go?"** Repositories *are* the DB connection layer — they live next to other persistence adapters in `infrastructure/persistence/`. Don't introduce a `modules/<feature>/infrastructure/` shell — there is one infrastructure tree, not one per feature.

### Current state vs target

What exists today is a strict subset of the layout above. Empty folders aren't created in advance — they get created alongside their first concrete file.

| Layer | Status | Notes |
|---|---|---|
| `src/domain/` | Implemented | Entities, VOs, identifiers, scheduling + user ports, `reference.errors.ts`; barrel `domain/ports/index.ts`. |
| `src/application/{users,dealerships,service-types,service-bays,technicians,vehicles,appointments}/` | Implemented | Aggregate `*Service` CRUD (appointments: read/update/delete only) + **`*.service.spec.ts`** with fakes in `test/fakes/`. |
| `src/application/{book-appointment,check-availability,...}/` | **Not yet on disk** | Add with booking feature — single-purpose use-case classes, not CRUD services. |
| `src/infrastructure/prisma/` | Implemented | `PrismaModule` is `@Global()`. |
| `src/infrastructure/observability/` | Implemented | logging + metrics + tracing. |
| `src/infrastructure/persistence/` | Implemented | `PrismaUserRepository`, `PrismaDealershipRepository`, … + mappers. |
| `src/infrastructure/config/` | Implemented | Zod-validated env loader. |
| `src/infrastructure/cache/`, `locking/`, `messaging/`, `time/` | **Not yet on disk** | Create with the booking feature; add the folder *with* its first file. |
| `src/interface/http/{users,dealerships,service-types,service-bays,technicians,vehicles,appointments}/` | Implemented | Per-resource controllers, DTOs, `*.module.ts`; `app.module.ts` imports all feature modules. |
| `src/interface/http/filters/` | Implemented | `DomainErrorFilter` (global in `main.ts`). |
| `test/fakes/` | Implemented | Hand-written port fakes; **must grow with each new CRUD aggregate** — see [../docs/ai/README.md](../docs/ai/README.md). |

**Empty-folder rule.** Don't create a directory before it has a file. There is no `src/infrastructure/users/` shell and no `src/modules/` tree — repositories are infrastructure, controllers are interface, and DI wiring is in `app.module.ts`.

---

## Writing APIs in clean architecture

This section is the recipe for adding a new HTTP endpoint or a new outbound integration without breaking the layering. Follow it for every new API surface — the booking controller, the availability check, the cancel flow. The "Don't" list at the bottom captures the mistakes that have come up most often.

### The vertical slice (request → response)

A request flows through **five owners**, in this order. Each owner has one job and never reaches across the boundary on either side.

```
HTTP request
   │
   ▼
┌──────────────────────────── interface/http ────────────────────────────┐
│  Controller          parses route, delegates to use-case               │
│  DTO (input)         class-validator on raw JSON                       │
│  ValidationPipe      runs validators globally; rejects on failure      │
│  ExceptionFilter     domain error → HttpException at the boundary     │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ plain TS values (no DTO classes)
                                 ▼
┌─────────────────────────── application ────────────────────────────────┐
│  Service (CRUD on one aggregate) OR Use-case (multi-step orchestration)│
│                      depends on domain types + ports only              │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ port interfaces
                  ┌──────────────┼──────────────┐
                  ▼              ▼              ▼
┌───────── domain ─────────┐  ┌──── domain/ports ────┐
│ Entities, VOs            │  │ Interfaces (no impl) │
│ Domain errors            │  │ DI symbols           │
└──────────────────────────┘  └──────────┬───────────┘
                                         ▼
                       ┌──────────────── infrastructure ──────────────────┐
                       │ Repository / cache / lock / messaging adapter    │
                       │ implements the port (Prisma, Redis, ...)         │
                       │ Maps adapter shape ↔ domain entity at the bdy.   │
                       └──────────────────────────────────────────────────┘
```

The controller never imports Prisma, the adapter never imports a DTO, the use-case never imports the framework. Type-only imports across the boundary are still imports — don't do them.

### DTO rules (interface layer)

- **Input DTOs** are `class-validator` classes. They live at `src/interface/http/dtos/` next to the controller that consumes them. They describe the *wire format*, not the domain.
- **Output DTOs** are plain TypeScript types. Build them in the controller from the domain entity returned by the use-case. Don't return entities directly — they're not safe to leak (they may carry hidden internal state, and shape changes ripple to clients).
- **Never** annotate DTOs with Prisma types, never `import` from `@prisma/client` here. If you need to bridge a wire shape into a domain VO, do it in the controller via `EntityId.from(dto.id)`, not in the use-case.
- DTOs do **not** carry IDs in create flows. **The database assigns identifiers** via `@default(uuid())`, not the caller. See "ID assignment policy" below.

```ts
// src/interface/http/dtos/create-user.dto.ts
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string | null;
}
// Note: no `id` field. The server assigns it.
```

### Application layer organization — service vs use-case

The application layer has **two valid shapes**, and the choice between them is a sizing decision, not a style preference.

| Shape | When to pick it | File naming | Example |
|---|---|---|---|
| **Aggregate service** — one class per aggregate, one method per operation. | Straightforward CRUD on a single aggregate; methods are mostly one-port-call wrappers (with maybe a not-found check). | `<aggregate>.service.ts` in `application/<aggregate>/`. Methods are short verbs (`create`, `findById`, `list`, `update`, `delete`). | [src/application/users/users.service.ts](src/application/users/users.service.ts) — full CRUD on the User aggregate via the `UserRepository` port. |
| **Single-purpose use-case** — one class, one method, one business operation. | Multi-step orchestration where the sequence is the business rule and splitting it would lose the invariant. The booking flow is the canonical example: validate → lock → re-check → transactional insert → invalidate cache → release lock, all in one place. | `<verb>-<noun>.use-case.ts` in `application/<verb>-<noun>/`. Method is imperative (`execute`). | `BookAppointmentUseCase` (TBD) — the six-step booking flow stays as one class so the orchestration is visible. |

**Decision rule:** if the method body is "call one or two ports, optionally throw a not-found", it belongs on a service. If the method orchestrates a sequence whose ordering/atomicity/error-handling is the business rule, it's a use-case and gets its own class. Don't split a service into per-method use-cases just because clean-architecture posts say so — the split is overhead unless there's orchestration to make visible.

**Both shapes share these rules** (these are the load-bearing parts):

- Constructor only takes ports (interfaces from `domain/ports/`). Never `PrismaService`, never `fetch`, never a logger from `pino`. Observability cross-cuts via auto-instrumentation; if you genuinely need explicit instrumentation, define a `Logger` / `Tracer` port in `domain/ports/`.
- Return domain entities or domain types. Never return DTOs, never return `Prisma.UserGetPayload<...>`.
- Throw **domain errors** (plain classes in `domain/<aggregate>/errors.ts`). Never throw `HttpException` — that's the filter's job.
- Inputs are types defined alongside the service/use-case (e.g. `CreateUserInput`). They are **not** the controller's DTO and **not** a wire format. The controller maps DTO → service/use-case input.
- One controller method maps to one service method (or to one use-case `execute`). Don't fan out from a controller method to multiple service calls — push the orchestration down.

### Adapter rules (infrastructure layer)

- One adapter per port per backing technology (`PrismaUserRepository`, `PrismaBookingRepository`, `RedisAvailabilityCache`, `RedlockClient`). The adapter is the only file that imports the backing library.
- Map at the adapter boundary. Prisma rows → domain entities via `infrastructure/persistence/mappers/*`.
- Map adapter-specific errors to domain errors at the boundary. The use-case must not see `Prisma.PrismaClientKnownRequestError`.

### ID assignment policy

Identifiers are **server-assigned**, never randomized by callers. Two consequences:

1. The Prisma schema uses `@id @default(uuid()) @db.Uuid` on every entity table. The DB assigns the UUID. Callers omit `id` from `prisma.<model>.create()` data.
2. The HTTP API (`POST /users`, `POST /appointments`, etc.) accepts a body **without** `id`. The response carries the server-assigned `id`.

Why: identifier collisions are real (two clients picking the same v4 is rare but a service that lets clients pick IDs has to defend against malicious or buggy clients picking *non-random* IDs); idempotency and audit are easier when there's a single ID source; client-randomized IDs make the schema lie about who owns the namespace. Stable test fixtures still hand-pick UUIDs (in `prisma/seed.ts`), but tests are the only callers allowed to.

### Error mapping

Domain throws typed plain-class errors. The interface layer's exception filter is the **single** place where domain errors become HTTP responses.

```ts
// src/interface/http/filters/domain-error.filter.ts (sketch)
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    if (err instanceof UserAlreadyExistsError) return reply(host, 409, err);
    if (err instanceof SlotAlreadyBookedError) return reply(host, 409, err);
    if (err instanceof LockNotAcquiredError) return reply(host, 503, err);
    if (err instanceof ZodError /* etc. validation */) return reply(host, 400, err);
    throw err; // unknown — let Nest's default 500 handler do it
  }
}
```

Mapping table for this service:

| Domain error | HTTP |
|---|---|
| Validation (DTO / VO) | 400 |
| `UserAlreadyExistsError`, `SlotAlreadyBookedError`, `VehicleNotEligibleError`, `NoQualifiedTechnicianError`, `BayUnavailableError` | 409 |
| `UserNotFoundError`, entity-not-found generally | 404 |
| `LockNotAcquiredError` | 503 (transient — clients may retry) |

### Worked example — full `/users` CRUD slice

The Users API is the canonical worked example for this section. It uses the **aggregate service** shape (the User aggregate is plain CRUD), exposes all six routes, and demonstrates every clean-architecture rule above. Use it as the template for any other CRUD aggregate; use `BookAppointmentUseCase` (TBD) as the template for multi-step orchestration.

**HTTP surface** — controller: [src/interface/http/users/users.controller.ts](src/interface/http/users/users.controller.ts)

| Method | Route | Status (success) | Status (failure) |
|---|---|---|---|
| `POST` | `/users` | `201 Created` | `400` invalid body / extra `id`, `409` duplicate email |
| `GET` | `/users?limit=&offset=` | `200 OK` | `400` `limit > 100` or non-int |
| `GET` | `/users/:id` | `200 OK` | `404` unknown id |
| `GET` | `/users/by-email/:email` | `200 OK` | `404` unknown email |
| `PATCH` | `/users/:id` | `200 OK` | `400` immutable field (`email`), `404` unknown id |
| `DELETE` | `/users/:id` | `204 No Content` | `404` unknown id |

**Files per layer**

| Layer | File | Role |
|---|---|---|
| HTTP DTOs (input) | [create-user.dto.ts](src/interface/http/users/dtos/create-user.dto.ts), [update-user.dto.ts](src/interface/http/users/dtos/update-user.dto.ts), [list-users.query.dto.ts](src/interface/http/users/dtos/list-users.query.dto.ts) | `class-validator` annotations. `CreateUserDto` has **no `id`**; `UpdateUserDto` has only `displayName` (email is identity, immutable). `ListUsersQueryDto` uses `@Type(() => Number)` for query-string coercion plus `@Min/@Max`. The global `ValidationPipe` (`forbidNonWhitelisted: true`) rejects extra fields with 400. |
| HTTP response | [user.response.ts](src/interface/http/users/dtos/user.response.ts) | `toUserResponse(profile)`, `toUserListResponse(page)` — plain TS, no decorators. Builds wire shapes from domain entities. |
| Controller | [users.controller.ts](src/interface/http/users/users.controller.ts) | One method per route. Maps DTO → service input and `UserId.from(param)`. Single dependency: `UsersService`. Never throws `HttpException`. |
| Filter (global) | [domain-error.filter.ts](src/interface/http/filters/domain-error.filter.ts) | Single domain → HTTP mapping point. `UserAlreadyExistsError` → 409, `UserNotFoundError` → 404, unknown → 500. Registered in [src/main.ts](src/main.ts). |
| **Application service** | [users.service.ts](src/application/users/users.service.ts) | One class for the User aggregate, six methods (`create`, `findById`, `findByEmail`, `list`, `update`, `delete`). Constructor takes only the `USER_REPOSITORY` port. Adds the not-found check around read paths so the controller doesn't have to. |
| Domain port | [user.repository.ts](src/domain/ports/user.repository.ts) | `UserRepository` interface — `findById`, `findByEmail`, `create`, `list`, `update`, `delete`. All input types (`CreateUserInput`, `UpdateUserInput`, `ListUsersQuery`) and read shapes (`UserProfile`, `UserProfilePage`) live here. **No `id` in `CreateUserInput`** — server-assigned policy. |
| Domain errors | [errors.ts](src/domain/user/errors.ts) | `UserAlreadyExistsError`, `UserNotFoundError`. Plain classes; only the filter knows about HTTP. |
| Persistence mapper | [user.mapper.ts](src/infrastructure/persistence/mappers/user.mapper.ts) | Prisma `User` row → domain `User` entity. Pure function. |
| Repository (Prisma) | [user.repository.ts](src/infrastructure/persistence/user.repository.ts) | `PrismaUserRepository implements UserRepository`. Prisma omits `id` from `data` (DB assigns via `@default(uuid())`). Catches Prisma `P2002` → `UserAlreadyExistsError`, `P2025` → `UserNotFoundError`. List uses `prisma.$transaction([findMany, count])` for an atomic page+total read. |
| Test fake | [test/fakes/fake-user.repository.ts](test/fakes/fake-user.repository.ts) | In-memory `UserRepository` for application-layer unit tests and the e2e suite. Mirrors the production contract (server-assigned UUIDs, both domain errors). |
| Tests | [users.service.spec.ts](src/application/users/users.service.spec.ts) (unit, fake repository), [domain-error.filter.spec.ts](src/interface/http/filters/domain-error.filter.spec.ts) (unit), [test/users.e2e-spec.ts](test/users.e2e-spec.ts) (e2e, supertest, fake repository overriding `USER_REPOSITORY` — no DB required). Optional: `*.integration-spec.ts` next to `PrismaUserRepository` for real Postgres. Scheduling aggregates follow the same fake + `*.service.spec.ts` rule — [../docs/ai/README.md](../docs/ai/README.md). | Together they cover every status code in the surface table above. |

**What "controller, service, blah blah" looks like in practice** — for any new CRUD aggregate, copy this slice:

1. New domain port (`<aggregate>.repository.ts`) in `src/domain/ports/` + new domain errors in `src/domain/<aggregate>/errors.ts`.
2. New application service (`<aggregate>.service.ts`) in `src/application/<aggregate>/` — wraps the port, adds not-found checks.
3. New controller + DTOs + response shapes under `src/interface/http/<aggregate>/`.
4. New Prisma repository (`PrismaXxxRepository`) at `src/infrastructure/persistence/<aggregate>.repository.ts` + mapper in `mappers/`.
5. Wire in `app.module.ts` (or a dedicated `<aggregate>.module.ts` once wiring grows): controller, service, and `{ provide: XXX_REPOSITORY, useClass: PrismaXxxRepository }`.
6. Tests at every level: **`test/fakes/fake-<aggregate>.repository.ts`** + **`src/application/<aggregate>/<aggregate>.service.spec.ts`** (mandatory for CRUD — checklist [../docs/ai/README.md](../docs/ai/README.md)); optional repository-integration-with-DB; e2e-with-fake-overriding-port where useful.

If at step 2 you find yourself orchestrating across multiple ports with sequencing rules (lock → re-check → transaction → invalidate), drop the service shape and write a single-purpose use-case class instead.

### Husky + pre-commit gate

This service uses **husky** and **lint-staged** to enforce the clean-architecture rules at commit time. The hook is a fast gate (only changed files), not a substitute for CI. Both are installed and wired:

- [.husky/pre-commit](.husky/pre-commit) → `npx lint-staged`
- [package.json](package.json) → `prepare: husky` script (re-installs hooks on every fresh `npm install`), `typecheck: tsc --noEmit -p tsconfig.json`, and the `lint-staged` config.

What the gate runs on every staged `*.ts`:
- **prettier --write** — formatting consistent with `.prettierrc`.
- **eslint --fix** — auto-fixable lint failures (unused imports, type-only-import preference). Once layering rules are encoded as ESLint rules (`no-restricted-imports` from `domain/` to `infrastructure/`), this is what stops a bad import landing.
- **`bash -c 'npm run typecheck'`** — full project typecheck. Catches the cross-layer breakage that `--findRelatedTests` would miss. Wrapped in `bash -c` because `tsc` doesn't accept staged-file args.
- **jest --bail --findRelatedTests --passWithNoTests** — runs the specs that import the changed files. Fast on a small change set; doesn't replace `npm test` in CI. `--passWithNoTests` so docs-only commits don't fail.

Don't `git commit --no-verify` past a failing hook. If the hook fails on something unrelated to your change (pre-existing lint debt, slow test), fix it or rebase off the broken commit — bypassing it lets the rule rot.

Fresh checkout: `npm install` is enough — the `prepare` script reinstalls the hook automatically. CI doesn't run husky (no `.git` hook execution), so CI must independently run `npm run lint`, `npm run typecheck`, `npm test`, and the integration/e2e suites.

### Test strategy per layer

| Layer | Test type | Tooling | Location |
|---|---|---|---|
| Domain (entities, VOs, errors) | Unit | Plain `it()` blocks, no DI | next to source: `*.spec.ts` |
| Application (use-cases) | Unit | Hand-written fakes implementing ports — `FakeUserRepository`, `FakeBookingRepository`. **No** Prisma / Redis mocks. | next to source: `*.spec.ts` |
| Infrastructure adapters | Integration | Real Postgres + real Redis from compose. Skip when `DATABASE_URL` is unset (gate with `describe.skip(...)` based on the env var so the suite still passes locally without a DB). | next to source: `*.integration-spec.ts` |
| End-to-end | E2E | `supertest` against `NestFactory.create(AppModule)` with all real adapters — *or* a feature-scoped test module that overrides ports with fakes (see [test/users.e2e-spec.ts](test/users.e2e-spec.ts)) when the suite shouldn't depend on Postgres. | `test/e2e/*.e2e-spec.ts`, `test/<aggregate>.e2e-spec.ts` |

Coverage targets: domain ≥ 95%, application ≥ 90%. Infrastructure coverage is enforced by the integration tests existing for every adapter, not by a percentage.

### Don'ts (specific to API code)

- Don't accept `id` in a create-flow DTO. The server assigns it.
- Don't return a domain entity from a controller — build a response DTO.
- Don't import `@prisma/client` from a controller, use-case, DTO, filter, pipe, or anything under `domain/` / `application/`.
- Don't throw `HttpException` from a use-case. Throw a domain error and let the filter map it.
- Don't catch a Prisma error in a use-case to "translate" it. Catch it in the adapter; rethrow a domain error.
- Don't put validation logic in the use-case. Wire shape → DTO + `class-validator`. Domain invariants → VO constructor / entity factory.
- Don't share a controller across use-cases. One controller per resource (`UsersController`, `AppointmentsController`); each route delegates to one use-case.
- Don't add a route that bypasses the use-case to "save a layer". The layer is the point — it makes the operation testable without HTTP.

---

## Database — Prisma

The DB is PostgreSQL. Prisma is the ORM and the migration tool. There is no second migration system.

- Schema: `prisma/schema.prisma`. This is the single source of truth for the database. Don't write hand-rolled SQL migrations on the side.
- Generate the client: `npx prisma generate` (run automatically by `postinstall`; re-run after schema changes).
- New migration during dev: `npx prisma migrate dev --name <short_change_name>`. This creates a migration file in `prisma/migrations/`, applies it to the dev DB, and regenerates the client. **Run this inside the booking-service container** so connection settings match the compose stack.
- Apply migrations in CI / prod: `npx prisma migrate deploy`. Never `migrate dev` in non-dev environments — it can rewrite history.
- Container startup should run `prisma migrate deploy && npm run start:dev`. The current [Dockerfile.dev](Dockerfile.dev) only runs `start:dev` because no schema exists yet — once `prisma/schema.prisma` lands, update the `CMD` to chain the migrate step. Do not bypass migrations to "fix" a startup error; read the migration error.
- Prisma client is wrapped in `infrastructure/prisma/prisma.service.ts` (a `PrismaService extends PrismaClient` with `OnModuleInit` / `OnModuleDestroy`). The wrapper is the only place `PrismaClient` is instantiated.
- Repositories depend on `PrismaService`, **not** on `PrismaClient` directly. Domain and application code never see Prisma types — repositories return domain entities via mappers in `persistence/mappers/`.

Schema essentials (build out as features land):
- `User` (stable `id`, unique `email`, display fields as needed) — owned by this service, persisted via `PrismaUserRepository`. Keeps email-based lookup on real `SELECT`s. Do not fold User identity into `Customer`; the two are separate tables (User holds identity/contact, Customer is the booking-side FK anchor).
- `Customer` (FK target for `Appointment.customer_id`; references `User` via a unique `user_id`, so booking FKs stay stable while `User` holds identity/contact fields).
- `Vehicle` (owned by customer; `vin` unique per scenario needs).
- `Appointment` (id, customer_id, vehicle_vin, dealership_id, bay_id, technician_id, service_type, slot_start, slot_end, status, created_at, updated_at).
- `Outbox` (id, aggregate_type, aggregate_id, event_type, payload jsonb, created_at, published_at nullable).
- `TechnicalConfig` — scoped dynamic JSON (`scope` = `GLOBAL` | `DEALERSHIP` | `TECHNICIAN`, `config_key`, `value` jsonb). `GLOBAL` rows use sentinel `scope_id = 00000000-0000-0000-0000-000000000000`; dealership/technician rows set `scope_id` to that entity’s id. Example: `specialization.ok` per technician for soft/feature flags alongside `technician_qualified_services` (hard M:N).
- Indexes for hot-path queries: `(bay_id, slot_start, slot_end)` and `(technician_id, slot_start, slot_end)` for the in-lock re-check.
- Use a `tstzrange` exclusion constraint on `(bay_id, slot_window)` and `(technician_id, slot_window)` if Prisma can express it via raw migration — defense-in-depth against the lock failing open. (If Prisma can't, add a hand-edited SQL step inside the generated migration; document why.)

---

## The booking flow (canonical implementation)

This is the only correct sequence. Anything that deviates is a bug. Verbatim from [../docs/scenario/content.md](../docs/scenario/content.md) §5:

```
1. Validate request (vehicle, service type, dealership, desired window).
2. Acquire Redlock on bay + technician keys for the slot window.
3. Re-check availability against PostgreSQL (truth) — cache may be stale.
4. INSERT Appointment + INSERT outbox row in a single transaction; commit.
5. Invalidate / update affected cache entries.
6. Release locks via token-checked Lua DEL (against all 5 nodes).
```

Where each step lives:

| Step | Layer | Component |
|---|---|---|
| 1 | Interface | `BookAppointmentDto` + `ValidationPipe` |
| 1 (business invariants) | Application | `BookAppointmentUseCase` calls domain VOs / entity factories |
| 2 | Application calls a port; Infrastructure executes | `DistributedLock` port → `RedlockClient` adapter |
| 3 | Application calls a port; Infrastructure executes | `BookingRepository.findConflictingAppointments(...)` |
| 4 | Application opens the transaction; Infrastructure runs SQL | `BookingRepository.insert(appointment, outboxRow)` inside `UnitOfWork.run(...)` (= `prisma.$transaction`) |
| 5 | Application calls a port; Infrastructure executes | `AvailabilityCache.invalidate(bayKey, techKey)` |
| 6 | Application releases via the same lock handle returned in step 2 | `RedlockClient.release(handle)` |

The `BookAppointmentUseCase` orchestrates all six steps. It is the one place this sequence is encoded. Do not split it across multiple use-cases or push step 3 into the repository — keeping the orchestration visible is the point.

### Read path (availability check)

Cache-aside, three steps:

1. `GET avail:bay:{bayId}:{slot}` and `GET avail:tech:{techId}:{slot}` from cache Redis.
2. On miss, `SELECT` from PG and compute availability.
3. `SET` the result back into cache with TTL `60s`.

Writes go to PG first, then `DEL` the affected `avail:*` keys. **Never** write availability into Redis without writing to PG first.

---

## Redlock — service-specific rules

Read [../docs/scenario/content.md](../docs/scenario/content.md) §4 first. The lock layer is the most over-engineered-looking and the most safety-critical part of this service. Don't simplify it without re-reading why it exists.

- **5 independent Redis masters**, no replication between them. Compose provides them as `redlock-1` … `redlock-5`. Configure via env `REDLOCK_NODES`.
- Acquire: parallel `SET key token NX PX=ttl` to all 5; granted iff ≥ 3 succeeded **and** elapsed wall-clock time < TTL. Effective validity = `TTL − elapsed − drift_margin`.
- Per-node timeout ~50 ms so one slow node can't stall acquisition.
- Release: token-checked Lua `DEL` on all 5 nodes. The Lua script is canonical Redlock — copy from the spec, do not rewrite.
- Lock key shape (one lock per contended resource — never one global lock):
  ```
  lock:bay:{bayId}:{slotStart}
  lock:tech:{technicianId}:{slotStart}
  ```
- TTL: pick ≫ expected critical-section duration but ≪ user-perceived booking latency. Default `5000ms`. The critical section runs steps 3–5 above.
- Use a real Redlock library (`redlock` on npm). Do not hand-roll the acquire/release loop — getting the timing math wrong silently breaks safety.

### Failure modes that must keep working

From [../docs/scenario/content.md](../docs/scenario/content.md) §7:

| Failure | Required behavior |
|---|---|
| One Redis lock node down | Quorum still reaches 3/5; bookings continue. Don't block on full quorum. |
| Cache stale or evicted | Step 3 (PG re-check inside the lock) is the safety net. |
| Scheduler instance crashes mid-booking | Lock auto-expires via TTL; no manual cleanup. Don't add a "release on crash" daemon. |
| Clock drift / GC pause longer than TTL | Known Redlock caveat. Mitigation = drift margin + (optional) fencing tokens. Operational tuning, not architectural change. |

---

## Domain — entities, value objects, errors

Domain layer holds these. Pure TypeScript, no framework, no I/O.

| Entity | Identity | Notes |
|---|---|---|
| `Appointment` | `AppointmentId` (uuid) | Aggregate root for the booking flow. Owns slot window, customer, vehicle, bay, technician, status. |
| `ServiceBay` | `BayId` | Physical resource. Availability is *derived* from existing appointments + opening hours; not a flag. |
| `Technician` | `TechnicianId` | Has a skill set. Availability derived same way as bays. |
| `Vehicle` | `Vin` | Owned by a `Customer`. |
| `Customer` | `CustomerId` | Denormalized from upstream user-service (real or mock). |

Value objects (no identity, immutable, validated in constructor): `SlotWindow` (start + duration, half-open), `ServiceType` (id + required skill + duration), `DealershipId`, `BayId`, `TechnicianId`, `Vin`, `CustomerId`, `AppointmentId`.

Domain errors (plain classes, not HTTP):
- `SlotAlreadyBookedError` — re-check inside lock found the slot taken.
- `NoQualifiedTechnicianError` — no available technician has the required skill.
- `BayUnavailableError` — bay is closed/maintenance for the requested window.
- `VehicleNotEligibleError` — vehicle not serviced at this dealership / wrong service type.
- `LockNotAcquiredError` — Redlock quorum failed within timeout.

Domain → HTTP mapping (in the interface layer's exception filter):

| Domain error | HTTP |
|---|---|
| Validation failure (DTO / value object) | `400 Bad Request` |
| `VehicleNotEligibleError`, `NoQualifiedTechnicianError`, `BayUnavailableError` | `409 Conflict` |
| `SlotAlreadyBookedError` | `409 Conflict` |
| `LockNotAcquiredError` after retry budget | `503 Service Unavailable` (transient, client may retry) |
| Entity not found (GET by id) | `404 Not Found` |

---

## Outbox

- The `outbox` table lives in this service's Prisma schema.
- `Appointment` INSERT and `outbox` INSERT happen in the **same** `prisma.$transaction`. There is no other correct way.
- Outbox row schema: `id`, `aggregate_type`, `aggregate_id`, `event_type`, `payload (jsonb)`, `created_at`, `published_at (nullable)`.
- This service does **not** publish to Kafka. A separate CDC relay tails WAL. From this service's perspective, writing the outbox row *is* the publish operation.
- Never call Kafka from a controller, use-case, or repository.

---

## Users — repository (DB connection layer)

The User aggregate is owned by this service. The persistence boundary is the `UserRepository` port in [src/domain/ports/user.repository.ts](src/domain/ports/user.repository.ts); the production implementation is **`PrismaUserRepository`** in [src/infrastructure/persistence/user.repository.ts](src/infrastructure/persistence/user.repository.ts). Wired in [src/interface/http/users/users.module.ts](src/interface/http/users/users.module.ts). Same port → Prisma adapter pattern as scheduling aggregates (`Dealership`, `ServiceType`, …).

### Wiring

```ts
@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
})
export class UsersModule {}
```

[`app.module.ts`](src/app.module.ts) imports `UsersModule`. The e2e suite ([test/users.e2e-spec.ts](test/users.e2e-spec.ts)) may override `USER_REPOSITORY` with `FakeUserRepository` so the HTTP surface can run without Postgres.

### What `PrismaUserRepository` must do

- Implement every method on `UserRepository` (`findById`, `findByEmail`, `create`, `list`, `update`, `delete`).
- Omit `id` from `prisma.user.create({ data })` — the DB assigns UUIDs via `@default(uuid())`.
- Map Prisma errors to domain errors at the boundary:
  - `P2002` (unique violation on `email`) → `UserAlreadyExistsError`
  - `P2025` (record not found on update/delete) → `UserNotFoundError`
- Map Prisma rows to domain entities via [user.mapper.ts](src/infrastructure/persistence/mappers/user.mapper.ts).
- Use `prisma.$transaction([findMany, count])` for the `list` method so page items and total are read atomically.
- Take `PrismaService` as its only constructor dependency. Never instantiate `PrismaClient` directly.

### Test fakes vs production repository

| Layer | What it uses | Why |
|---|---|---|
| Application unit tests | [FakeUserRepository](test/fakes/fake-user.repository.ts) (in-memory) | Fastest feedback. Mirrors the production contract: server-assigned UUIDs, `UserAlreadyExistsError` on duplicate email, `UserNotFoundError` on missing. |
| HTTP e2e | `FakeUserRepository` overriding `USER_REPOSITORY` | Exercises the controller, validation pipe, error filter, and service without standing up Postgres. |
| Repository integration tests (TBD) | Real Postgres from compose, gated on `DATABASE_URL` | Verifies the Prisma error → domain error mapping and the unique-email constraint behave as specified. |

Don't add branches or flags to the production repository to support tests. If a test needs different behavior, override the port with a hand-written fake at the DI boundary — that is the whole point of the port.

### Fixture data — `prisma/seed.ts`

Dev users / customers / vehicles are seeded by [prisma/seed.ts](prisma/seed.ts) (idempotent upserts, stable UUIDs). E2E suites that need them run `npx prisma db seed` after `migrate reset`; tests that don't reference seeded data prefer the fake-repository pattern above and avoid the DB entirely.

Seed-file rules:
- Stable UUIDs. Pick once, never change — tests will hard-reference them.
- Deterministic: no `Date.now()`, no `Math.random()`. Fixed ISO strings for any timestamps.
- Minimal but realistic: enough rows to cover the scenarios in [../docs/scenario/content.md](../docs/scenario/content.md) (Alice + Honda Civic at minimum).
- No PII. Names like `Alice Test`, emails like `alice@example.test`.

---

## Testing strategy

Three levels. Each layer is tested where it belongs — don't push tests up or down to "make it easier."

### Unit tests — domain and application

- Live next to the file: `appointment.entity.spec.ts`, `book-appointment.use-case.spec.ts`.
- **No mocking libraries needed for ports.** Use hand-written fakes that implement the same interface:
  - `InMemoryBookingRepository implements BookingRepository`
  - `FakeAvailabilityCache implements AvailabilityCache`
  - `FakeDistributedLock implements DistributedLock` — programmable to grant, deny, or simulate quorum failure.
  - `FakeUserRepository implements UserRepository`
  - `FakeClock implements Clock` — pin time per test.
- Fakes live under `test/fakes/` (or co-located) and are reused across specs.
- Use `Test.createTestingModule` from `@nestjs/testing` only when you need DI wiring; for pure use-case tests, just `new BookAppointmentUseCase(...)` with fakes is faster and clearer.
- **Don't mock Prisma.** It has too much surface area to mock faithfully. Domain/application layers never see Prisma; if a test needs Prisma it's an infrastructure or e2e test.
- Coverage targets: domain ≥ 95%, application ≥ 90%. These are guidance, not a CI gate to game — uncovered branches in domain logic are bugs.

### Mandatory for AI agents — CRUD aggregate unit tests

Whenever you add or change a **CRUD aggregate** (new port + `*Service` + Prisma repository + HTTP module), you **must** ship:

1. **`test/fakes/fake-<aggregate>.repository.ts`** — in-memory port implementation; mirror domain errors the Prisma adapter throws.
2. **`src/application/<aggregate>/<aggregate>.service.spec.ts`** — exercise create, read/list, update (including `EmptyUpdateError` when the service enforces non-empty PATCH), delete, and not-found / conflict paths.

Full checklist, `AppointmentRepository.place()` note, and aggregate matrix: **[../docs/ai/README.md](../docs/ai/README.md)**.

What every `BookAppointmentUseCase` spec must cover:
1. Happy path — confirms appointment, writes outbox row, invalidates cache, releases lock.
2. Lock not acquired (quorum fails) — throws `LockNotAcquiredError`, no DB write, no cache invalidate.
3. Lock acquired but PG re-check finds a conflict — throws `SlotAlreadyBookedError`, lock is released.
4. PG transaction fails after lock acquired — error propagates, lock is released.
5. Cache invalidation fails after successful insert — booking still considered confirmed (cache will TTL out); error logged, not raised. The cache is not authoritative.
6. Vehicle not eligible / no qualified technician / bay unavailable — appropriate domain error, no side effects.

### Integration tests — infrastructure adapters

- Run against **real Postgres + real Redis** from the compose stack. Mocking those defeats the purpose; the architecture depends on their actual semantics (`SET NX PX`, transaction isolation, exclusion constraints).
- Live next to the adapter: `prisma-booking.repository.spec.ts`, `redlock.client.spec.ts`.
- Each test runs in a transaction that is rolled back, or against a per-test database created from the migrated schema. Don't rely on test ordering.
- Redlock tests must include: quorum success, single-node failure (still succeeds), majority failure (fails), token-mismatch release (no-op), TTL expiry.

### E2E tests — booted application

- Live in `test/e2e/`, supertest against `NestFactory.create(AppModule)` with all real adapters wired up against the compose stack.
- Cover the booking HTTP API end-to-end: confirm, conflict, validation failure, transient lock failure → 503.
- Slow; run in CI, not on every save.

### Test data — who seeds what

One seeding mechanism: `prisma/seed.ts`. It owns dealerships, service bays, technicians, service types, **and** dev users / customers / vehicles. Run via `npx prisma db seed` after `migrate dev` / `migrate reset`. The seed is idempotent (upserts on stable UUIDs) so re-running is safe.

DB-backed e2e tests reset between scenarios by truncating tables and re-running `prisma db seed`. Tests that don't need real Postgres prefer the [test/users.e2e-spec.ts](test/users.e2e-spec.ts) pattern — override `USER_REPOSITORY` with `FakeUserRepository`. Unit tests build their own objects via factories in `test/factories/` and never touch the DB.

---

## Observability

Three pillars wired in `src/infrastructure/observability/`. Full per-tool rationale (what was picked over what, and why) lives in [../docs/observability/strategy.md](../docs/observability/strategy.md). **Read the strategy doc before swapping any of these tools** — each choice is load-bearing for at least one design property in [../docs/scenario/content.md](../docs/scenario/content.md) (the SLO budgets, the N-instance topology, the multi-system booking flow).

| Pillar | Library | Why this one |
|---|---|---|
| Logging | `pino` v10 + `nestjs-pino` v4 | Fastest Node.js logger by ~5× over Winston; JSON by default; async transport keeps pretty-print off the request thread; child loggers correlate per-request without manual context plumbing. Winston / Bunyan / `console.log` would burn the 200 ms p99 budget. |
| Metrics | `prom-client` v15 + `@willsoto/nestjs-prometheus` v6 | Pull model fits the N-stateless-instance topology (StatsD push needs central config). Histograms aggregate quantiles correctly across instances (StatsD per-instance percentiles can't). Cardinality cost is visible in TSDB RAM, which forces the discipline we want. Vendor-neutral. |
| Tracing | `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node`, OTLP/HTTP exporter | The booking flow crosses Postgres + cache Redis + 5 Redlock nodes. Distributed tracing is the only signal that answers "where did the 200 ms go?" OTel is the only vendor-neutral standard. Auto-instrumentation covers our entire I/O surface. |

### Bootstrap order (load-bearing)

OTel auto-instrumentations patch modules at `require()` time. They only see modules loaded **after** the SDK starts. Therefore `src/main.ts` imports `./infrastructure/observability/tracing` as its **first line**, before `NestFactory`, before `AppModule`. Don't reorder this. Don't move OTel init into a NestJS lifecycle hook — by then Express / pg / ioredis are already loaded and unpatched.

```ts
// src/main.ts — first line, on purpose
import './infrastructure/observability/tracing';
import { NestFactory } from '@nestjs/core';
// ...
```

### Correlation across the three pillars

- `pino-http`'s `genReqId` honours upstream `X-Request-Id` or generates a UUID; echoed in the response header.
- A pino `mixin` reads `trace.getSpan(context.active()).spanContext()` and stamps `trace_id` + `span_id` onto every log line emitted within the span's `AsyncLocalStorage` context (which `nestjs-pino` propagates).
- Net effect: in the backend, a 5xx alert links to a trace via `trace_id`, the trace's failing span links to logs via `trace_id` + `span_id`, the user-reported "request ID" links to logs via `req.id`. No grep, no timestamp arithmetic.

### Metrics that exist (and what each one defends)

Defined in `src/infrastructure/observability/metrics.module.ts`. Histogram buckets are SLO-shaped (straddle the target), not log-scale defaults — quantile reads are noisy near specific SLO targets otherwise.

| Metric | Type | Defends |
|---|---|---|
| `booking_confirm_duration_seconds{outcome}` | Histogram | 200 ms p99 end-to-end SLO |
| `availability_read_duration_seconds{source=cache\|db}` | Histogram | 5 ms hit / 25 ms miss SLO |
| `redlock_acquire_duration_seconds{contended}` | Histogram | 50 ms uncontended SLO |
| `redlock_outcome_total{outcome}` | Counter | Cluster health (`quorum_failed`) + clock-drift / GC-pause canary (`token_mismatch`) |
| `booking_outcome_total{outcome}` | Counter | Conversion funnel + 5xx alert source |
| `availability_cache_outcome_total{outcome=hit\|miss\|error}` | Counter | Cache hit ratio (drives the miss-SLO triggering) |

### Layering rule

Same as Prisma and ioredis: `domain/` and `application/` cannot `import 'pino'` / `'prom-client'` / `'@opentelemetry/api'`. Auto-instrumentation already covers I/O at the infrastructure boundary; nothing in the use-case needs to be observability-aware. If a future use-case genuinely needs explicit instrumentation, define a `Logger` / `Tracer` / `Metric` port in `domain/ports/` and adapt to the real library in `infrastructure/`. Don't violate the rule "to add some debug logs" — `Logger` injection through the framework already covers that.

### What this repo does NOT own

- Log shipper (Fluent Bit / Vector → Loki / ELK / CloudWatch). The container stdout is the contract.
- Prometheus scraper config and dashboards. `/metrics` exposed on `:8080/metrics` is the contract.
- OTel collector and trace backend (Tempo / Jaeger / Datadog). OTLP/HTTP to `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is the contract; unset = no-op (the app boots fine without a collector).

### Things that change once Prisma lands

- Enable `previewFeatures = ["tracing"]` in `schema.prisma`.
- Register `@prisma/instrumentation` in `tracing.ts` — pg auto-instrumentation does NOT see Prisma's rust query engine, so without this, traces stop at the `prisma.$transaction` boundary.
- Outbox payloads should carry `traceparent` (W3C Trace Context — already what OTel emits) so the WAL relay's spans chain back to the booking request.

## Service-specific don'ts

- Don't write `Appointment` to Redis. Redis is cache + lock store, never source of truth.
- Don't take the booking lock against the `redis-cache` instance. That's for cache-aside reads only — locks go to the 5 `redlock-*` nodes.
- Don't release a Redlock with plain `DEL`. Token-checked Lua only.
- Don't add a single global "booking lock" — kills throughput. Locks are per `(bay, slot)` and per `(technician, slot)`.
- Don't publish to Kafka from a controller, use-case, or repository. Outbox row only.
- Don't skip the PG re-check inside the lock (step 3). The cache is not authoritative.
- Don't read `Appointment` rows back through the cache for write-paths — only the availability projection is cached.
- Don't add read replicas, geo-distribution, CQRS, or event sourcing. Out of scope per [../docs/scenario/content.md](../docs/scenario/content.md) §8.
- Don't import `@prisma/client` types outside of `infrastructure/`. Map to domain entities at the repository boundary.
- Don't reach for `prisma migrate dev` in production environments — `prisma migrate deploy` only.
- Don't add a `Mock*Repository` or `Http*Repository` shape — there is one production repository per aggregate (Prisma-backed). Tests use the in-memory fake under `test/fakes/`; don't conflate the two.
- Don't reintroduce `src/modules/<feature>/infrastructure/` as a home for adapters. Repositories live in `src/infrastructure/persistence/`; per-feature DI wiring (when needed) lives in `<feature>.module.ts` next to the controller.
- Don't expose seed data from a controller. Fixtures are an internal concern.
- Don't `console.log`. The pino logger is injected; use it. `console.log` is unstructured, unredacted, blocks the event loop on slow consumers, and breaks the trace_id correlation that the pino mixin provides.
- Don't import `pino`, `prom-client`, or `@opentelemetry/api` from `domain/` or `application/`. Same rule as Prisma / ioredis — observability is an infrastructure concern.
- Don't reorder `main.ts` to put the Nest factory before the tracing import. OTel auto-instrumentations only patch modules loaded after the SDK starts; reordering silently disables tracing for HTTP / Redis / pg.
- Don't label metrics with `bayId`, `technicianId`, `customerId`, or any per-entity identifier. Cardinality explodes; the TSDB bill (or RAM) explodes with it. Label by outcome class only.
- Don't compute business metrics (bookings per dealership, no-show rate) in this service. Those belong on the Kafka-consumer side, downstream of the outbox.
