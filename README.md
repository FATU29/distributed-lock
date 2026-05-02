# Keyloop service scheduler

Monorepo for a **NestJS appointment scheduler** (`booking-service/`): scheduling reference data, availability, confirm-booking (Postgres, Redis cache-aside, Redlock, transactional outbox), and HTTP APIs documented under `docs/`.

**Authoritative guides for contributors and AI tools:** [CLAUDE.md](CLAUDE.md), [AGENTS.md](AGENTS.md), [booking-service/CLAUDE.md](booking-service/CLAUDE.md).

## Run locally

### Option A — whole stack in Docker (recommended)

Starts Postgres, Redis (cache + five Redlock nodes), observability, and **`booking-service`** with `nest start --watch`. Your repo’s `booking-service/` tree is bind-mounted into the container, so edits under **`booking-service/src/`** trigger a recompile.

```bash
docker compose -f docker-compose.dev.yml up --build
```

The HTTP API listens on **port 8080** by default (`http://localhost:8080`).

### Option B — Nest on your machine, dependencies in Docker

Use this when you want **`npm run start:dev`** running **on the host** against real Postgres/Redis from Compose.

1. **Start only backing services** (no `booking-service` container):

   ```bash
   docker compose -f docker-compose.dev.yml up -d postgres redis-cache redlock-1 redlock-2 redlock-3 redlock-4 redlock-5
   ```

2. **Configure env** — from `booking-service/`, copy the example and adjust if your ports differ:

   ```bash
   cd booking-service
   cp .env.example .env
   ```

   Defaults in `.env.example` match the compose ports above (`localhost:5432`, cache `6379`, Redlock `6381`–`6385`).

3. **Install, migrate, run** (use an active Node.js LTS):

   ```bash
   npm install
   npx prisma migrate deploy
   npm run start:dev
   ```

   This runs **`nest start --watch`** over **`src/`** (see `booking-service/package.json`). The app listens on **`PORT`** or **8080**.

4. **Other scripts** (from `booking-service/`): `npm run build` → `nest build`; `npm test` / `npm run test:integration` / `npm run test:e2e` as in `booking-service/CLAUDE.md`.

---

## Testing

Automated tests live under **`booking-service/`**. Run shell commands from that directory unless noted.

### Prerequisites

| Step | What to do |
| --- | --- |
| Install | `cd booking-service && npm install` |
| Database | Start Postgres (for example with **Option A** or **Option B** above). The dev compose file uses `postgres://scheduler:scheduler@localhost:5432/scheduler` when ports are published. |
| Migrations | With the stack running: `docker compose -f docker-compose.dev.yml exec booking-service npx prisma migrate deploy` — the dev image also runs `migrate deploy` before `nest start` (see `booking-service/Dockerfile.dev`). |
| Seed fixtures | For manual HTTP exploration and scripts that expect dealerships/bays/technicians: `docker compose -f docker-compose.dev.yml exec booking-service npx prisma db seed` |

**Unit tests** use in-memory **fakes** in `booking-service/test/fakes/` and do not require Postgres. **Integration** tests (`*.integration-spec.ts`) expect **`DATABASE_URL`** to point at a real database; they are typically skipped or empty until those files exist. **E2E** tests under `booking-service/test/` may boot the full `AppModule` or a minimal module; some suites override repository tokens with fakes so they pass without a database.

### Unit tests (Jest)

Covers domain types, application services, use-cases (for example `BookAppointmentUseCase`), and HTTP filters. Spec files: `booking-service/src/**/*.spec.ts`.

```bash
cd booking-service
npm test
npm run test:watch    # re-run on change
npm run test:cov      # coverage under booking-service/coverage/
npm run test:debug    # Node inspector + Jest in band
```

### Integration tests (Jest)

Picks up `booking-service/src/**/*.integration-spec.ts` (see `booking-service/test/jest-integration.json`). Intended for Prisma/Redis/Redlock adapters against real infrastructure.

```bash
cd booking-service
export DATABASE_URL=postgres://scheduler:scheduler@localhost:5432/scheduler
npx prisma migrate deploy
npm run test:integration
```

If no integration specs are present, Jest completes with no matching tests.

### End-to-end tests (Jest + Supertest)

Files matching `booking-service/test/**/*.e2e-spec.ts` (see `booking-service/test/jest-e2e.json`). Uses `supertest` against a Nest application instance.

```bash
cd booking-service
npm run test:e2e
```

### `scripts/` — manual API runners

These are **Node scripts** you run from the **repository root** (not `npm test`). They call the live HTTP API to stress or smoke-test behaviour. **`booking-service` must be up**, database migrated, and **`npx prisma db seed`** applied so dealerships, bays, technicians, and service types exist.

| Script | Purpose |
| --- | --- |
| [`scripts/concurrent-booking-race.mjs`](scripts/concurrent-booking-race.mjs) | Many clients race for the **same** slot; expects **one** `201` and the rest `409` / `503`. |

#### `concurrent-booking-race.mjs` — HTTP calls (in order)

The script resolves fixtures once, then prepares one user + vehicle per concurrent client, then fires all bookings at once.

| Step | Method | Path / query | Why |
| --- | --- | --- | --- |
| 1 | `GET` | `/dealerships?limit=50` | Pick dealership `DEMO-01` if present, else first item |
| 2 | `GET` | `/service-bays?dealershipId={id}&limit=50` | First bay for that dealership |
| 3 | `GET` | `/technicians?dealershipId={id}&limit=50` | First technician for that dealership |
| 4 | `GET` | `/service-types?limit=50` | Prefer `OIL_CHANGE`, else first type |
| 5a | `POST` | `/users` | **× `CLIENTS`** — distinct emails (`lock-race-…@example.test`) to get unique `customerId`s |
| 5b | `POST` | `/vehicles` | **× `CLIENTS`** — one VIN per client, tied to that customer |
| 6 | `POST` | `/bookings` | **× `CLIENTS` in parallel** — same `dealershipId`, `bayId`, `technicianId`, `serviceTypeId`, `slotStart`/`slotEnd`; different `customerId`, `vehicleVin`, `idempotencyKey` per client |

Slot window: next **Mon–Fri** **10:00–11:00 UTC** after “now”, unless you set **`SLOT_START`** and **`SLOT_END`** (same UTC calendar day; `slotEnd` must be after `slotStart`).

**Success criteria:** exactly **one** response with **201**; others **409** (`SLOT_ALREADY_BOOKED`) and/or **503** (`LOCK_NOT_ACQUIRED`). More than one **201** indicates a concurrency bug.

```bash
# From repo root; API at BASE_URL (default http://localhost:8080), DB migrated + seeded
node scripts/concurrent-booking-race.mjs
BASE_URL=http://127.0.0.1:8080 CLIENTS=20 node scripts/concurrent-booking-race.mjs
DEBUG_RACE_JSON=1 node scripts/concurrent-booking-race.mjs   # full JSON (status + bodies) on stdout
NO_COLOR=1 node scripts/concurrent-booking-race.mjs          # no ANSI colors
```

Other env vars: `SLOT_START`, `SLOT_END` (ISO8601). Full list: comment block at the top of [`scripts/concurrent-booking-race.mjs`](scripts/concurrent-booking-race.mjs).

Further testing policy and coverage expectations: [`booking-service/CLAUDE.md`](booking-service/CLAUDE.md) and [`docs/ai/README.md`](docs/ai/README.md) (CRUD fake + service spec checklist).

---

## HTTP API overview

The production HTTP surface is implemented only in **`booking-service`**. Default URL when using dev compose: **`http://localhost:8080`**. There is **no global path prefix** (routes are mounted at the root).

### Conventions

| Topic | Detail |
| --- | --- |
| Format | `Content-Type: application/json` on bodies; responses are JSON except **`GET /`**, which returns plain text `Hello World!`. |
| IDs | Path parameters named `:id` are **UUIDs** assigned by the server (create payloads do not include resource `id` fields). |
| Validation | Nest **`ValidationPipe`**: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Extra properties → **400 Bad Request** with a Nest validation envelope. |
| Errors | Domain and booking errors map to HTTP via `DomainErrorFilter`. Response shape: `{ "statusCode", "error", "message" }`. Full code list: [`docs/api-contract/errors.md`](docs/api-contract/errors.md). |
| Contracts | Authoritative per-route documentation: [`docs/api-contract/README.md`](docs/api-contract/README.md) and the files linked below. |

### Route map

Each row links to the markdown contract for request/response schemas and status codes.

| Contract file | Base path | Summary |
| --- | --- | --- |
| [`root.md`](docs/api-contract/root.md) | `/` | `GET /` — liveness-style plain text |
| [`users.md`](docs/api-contract/users.md) | `/users` | `POST` create user (+ customer); `GET` list (`limit`, `offset`); `GET :id`; `GET by-email/:email`; `PATCH :id`; `DELETE :id` |
| [`dealerships.md`](docs/api-contract/dealerships.md) | `/dealerships` | Full CRUD + list; unique `code` |
| [`service-types.md`](docs/api-contract/service-types.md) | `/service-types` | Full CRUD + list; unique `code` |
| [`service-bays.md`](docs/api-contract/service-bays.md) | `/service-bays` | Full CRUD + list; optional `dealershipId` filter on list |
| [`technicians.md`](docs/api-contract/technicians.md) | `/technicians` | Full CRUD + list; optional `dealershipId` filter on list |
| [`vehicles.md`](docs/api-contract/vehicles.md) | `/vehicles` | Create/list/get/patch/delete vehicles for a customer |
| [`appointments.md`](docs/api-contract/appointments.md) | `/appointments` | **`POST` is not exposed** — appointments are created through **`POST /bookings`**. `GET` list/detail; `PATCH`; `DELETE` |
| [`bookings.md`](docs/api-contract/bookings.md) | `/bookings` | **`POST /bookings`** — confirm booking (schedule checks, Redlock, payment step, transactional `Appointment` + outbox) |
| [`working-hours.md`](docs/api-contract/working-hours.md) | `/working-hours` | Weekly opening hours per dealership |
| [`holidays.md`](docs/api-contract/holidays.md) | `/holidays` | Dealership holidays (fixed or recurring) |
| [`availability.md`](docs/api-contract/availability.md) | `/dealerships/:dealershipId/availability` | Read-only: `GET ?date=` — day open/closed and reasons |

### Confirm booking — `POST /bookings`

This is the **only** HTTP entry point that creates a confirmed appointment. It runs the canonical flow documented in [`booking-service/CLAUDE.md`](booking-service/CLAUDE.md): validate → Redlock on bay and technician → PostgreSQL overlap re-check → single transaction (`Appointment` + outbox) → availability cache invalidation (where implemented) → token-checked lock release.

**Request body (high level):** `customerId`, `vehicleVin`, `dealershipId`, `bayId`, `technicianId`, `serviceTypeId`, `slotStart`, `slotEnd` (ISO8601; end after start); optional `idempotencyKey` (recommended for safe retries with your payment provider — if omitted, the server generates a new key per request).

**Responses (high level):**

| HTTP | When |
| --- | --- |
| **201** | Booking persisted; body matches `BookingResponse` with `status: "CONFIRMED"`. |
| **400** | Invalid body, unknown fields, or invalid slot window. |
| **402** | `PAYMENT_DECLINED` — payment gateway rejected the charge. |
| **409** | Schedule or conflict: e.g. `OUTSIDE_WORKING_HOURS`, `DEALERSHIP_CLOSED_ON_HOLIDAY`, `SLOT_ALREADY_BOOKED`, or other domain rules listed in [`bookings.md`](docs/api-contract/bookings.md) / [`errors.md`](docs/api-contract/errors.md). |
| **503** | `LOCK_NOT_ACQUIRED` — Redlock quorum not reached in time; **retry with backoff** is appropriate. |
| **500** | Unexpected failure after lock acquisition; the use-case still attempts lock release in `finally`. |

For field tables, JSON examples, idempotency notes, and outbox side effects, read **`docs/api-contract/bookings.md`** end to end.

---

## Documentation

### Start here

| Doc | Description |
| --- | --- |
| [Scenario — requirements & architecture](docs/scenario/content.md) | Load-bearing product and system rationale |
| [Why each architecture phase exists](docs/architecture-diagram/WHY-ENHANCE-PHASE.md) | Narrative behind the phased design |
| [Architecture diagram (final)](docs/architecture-diagram/architecture-final.mmd) | Mermaid view of the target system |
| [Architecture diagram (phases)](docs/architecture-diagram/architecture-phase.mmd) | Phased evolution view |

### Topic hubs

| Section | Index |
| --- | --- |
| AI & agents (CRUD checklist, doc map for tools) | [docs/ai/README.md](docs/ai/README.md) |
| API contracts (HTTP surface, errors, base URL) | [docs/api-contract/README.md](docs/api-contract/README.md) |
| Database (tables, Prisma, outbox rules) | [docs/database/README.md](docs/database/README.md) |
| Technology (stack choices) | [docs/technology/README.md](docs/technology/README.md) |
| GenAI & design phase | [docs/genai-design/README.md](docs/genai-design/README.md) |
| Data flow (booking path, infra slices) | [docs/data-flow/README.md](docs/data-flow/README.md) |
| Components (layers / building blocks) | [docs/component/README.md](docs/component/README.md) |

### Key pages

| Topic | File |
| --- | --- |
| Observability (logging, metrics, tracing) | [docs/observability/strategy.md](docs/observability/strategy.md) |
| GenAI in the design phase | [docs/genai-design/design-phase-genai.md](docs/genai-design/design-phase-genai.md) |
| Technology choices | [docs/technology/technology-choices.md](docs/technology/technology-choices.md) |
| End-to-end data flow | [docs/data-flow/data-flow.md](docs/data-flow/data-flow.md) |
| Component roles in `booking-service/` | [docs/component/component-roles.md](docs/component/component-roles.md) |

### API contracts

Per-route contracts live under [docs/api-contract/](docs/api-contract/). The route index is in [docs/api-contract/README.md](docs/api-contract/README.md).

### Database reference

Table catalog and deep links: [docs/database/README.md](docs/database/README.md).

### Optional assets

Local observability UI (static): [docs/observability/ui/](docs/observability/ui/).
