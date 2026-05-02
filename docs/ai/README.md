# AI assistants — architecture & testing checklist

This folder documents what **Copilot, Cursor, Claude, Codex**, and other agents must follow when editing this repo. Authoritative depth lives in [`booking-service/CLAUDE.md`](../booking-service/CLAUDE.md); scenario context in [`docs/scenario/content.md`](../scenario/content.md).

---

## 1. Doc map (use the right file)

| Purpose | Path |
|--------|------|
| Repo-wide summary + AI routing | [`CLAUDE.md`](../CLAUDE.md) (root), [`AGENTS.md`](../AGENTS.md) |
| Service rules (canonical) | [`booking-service/CLAUDE.md`](../booking-service/CLAUDE.md), [`booking-service/AGENTS.md`](../booking-service/AGENTS.md) |
| Cursor rules | [`.cursor/rules/architecture.mdc`](../../.cursor/rules/architecture.mdc), [`booking-service/.cursor/rules/`](../../booking-service/.cursor/rules/) |
| GitHub Copilot | [`.github/copilot-instructions.md`](../../.github/copilot-instructions.md), [`.github/instructions/`](../../.github/instructions/) |
| GenAI in the **design** phase (docs, architecture narrative, guardrails) | [`docs/genai-design/design-phase-genai.md`](../genai-design/design-phase-genai.md) |

---

## 2. Clean-architecture slice (CRUD)

For each **aggregate** exposed over HTTP:

1. **`domain/ports/<aggregate>.repository.ts`** — port interface + input types + DI `Symbol` token. Export from **`domain/ports/index.ts`**.
2. **`domain/<aggregate>/errors.ts`** — plain `Error` subclasses (no `HttpException`).
3. **`domain/reference.errors.ts`** — shared errors (`ForeignKeyReferenceError`, `EmptyUpdateError`) when relevant.
4. **`application/<aggregate>/<aggregate>.service.ts`** — inject port via `@Inject(TOKEN)`; throw domain errors; for `update`, reject empty patches with **`EmptyUpdateError`**. Use **`async update(...)`** when throwing before the first `await` so callers always get a rejected Promise.
5. **`infrastructure/persistence/<aggregate>.repository.ts`** — `PrismaXxxRepository`; map Prisma errors → domain errors; map rows → domain via **`persistence/mappers/`**.
6. **`interface/http/<aggregate>/`** — controller, DTOs (`class-validator`), response mappers, `<aggregate>.module.ts`.
7. **`app.module.ts`** — import the feature module.

**IDs**: server-assigned only — no `id` on create DTOs; Prisma `@default(uuid())`.

**PATCH bodies**: build patch objects in the controller so **only defined fields** are passed (omit keys with `undefined`), so `EmptyUpdateError` and repository `hasOwnProperty` checks work.

---

## 3. Unit tests — mandatory for every CRUD aggregate

**Do not merge CRUD without:**

| Deliverable | Location |
|-------------|----------|
| Hand-written fake implementing the port | `booking-service/test/fakes/fake-<aggregate>.repository.ts` |
| Application service unit tests | `booking-service/src/application/<aggregate>/<aggregate>.service.spec.ts` |

### Fake rules

- Mirror **production contract**: same domain errors (`*NotFoundError`, unique violations, etc.).
- **No** `jest.mock('@prisma/client')`, **no** Prisma mocks.
- **`AppointmentRepository`** has **no `create`** on the port — confirming bookings is the future use-case. For tests, use **`FakeAppointmentRepository.place(appointment)`** to seed rows.

### Service spec — minimum scenarios

- **create** — happy path + at least one conflict/uniqueness error if applicable.
- **findById** — success + not-found.
- **list** — pagination and any filter (e.g. `dealershipId`, `customerId`).
- **update** — happy path + **`EmptyUpdateError`** for `{}` when the service enforces it + not-found on missing entity.
- **delete** — success + not-found.

Instantiate with **`new XxxService(fake)`** (same pattern as [`users.service.spec.ts`](../../booking-service/src/application/users/users.service.spec.ts)).

### Existing references

| Aggregate | Fake | Spec |
|-----------|------|------|
| User | `test/fakes/fake-user.repository.ts` | `application/users/users.service.spec.ts` |
| Dealership | `fake-dealership.repository.ts` | `application/dealerships/dealerships.service.spec.ts` |
| Service type | `fake-service-type.repository.ts` | `application/service-types/service-types.service.spec.ts` |
| Service bay | `fake-service-bay.repository.ts` | `application/service-bays/service-bays.service.spec.ts` |
| Technician | `fake-technician.repository.ts` | `application/technicians/technicians.service.spec.ts` |
| Vehicle | `fake-vehicle.repository.ts` | `application/vehicles/vehicles.service.spec.ts` |
| Appointment (read/patch/delete) | `fake-appointment.repository.ts` | `application/appointments/appointments.service.spec.ts` |

### Domain error filter

New domain errors must be mapped in **`interface/http/filters/domain-error.filter.ts`** and covered in **`domain-error.filter.spec.ts`** when adding new HTTP-facing error classes.

---

## 4. Booking flow (not CRUD)

The **confirm booking** path is a **single use-case** (validate → Redlock → PG re-check → tx + outbox → cache invalidate → lock release). Do **not** implement confirm as `POST /appointments` CRUD without that orchestration. See [`booking-service/.cursor/rules/booking-flow.mdc`](../../booking-service/.cursor/rules/booking-flow.mdc).

---

## 5. Scheduling CRUD HTTP surface (reference)

Operational data for the scheduler (see [`docs/scenario/content.md`](../scenario/content.md)):

- **`/dealerships`**, **`/service-types`**, **`/service-bays`**, **`/technicians`**, **`/vehicles`** — full CRUD.
- **`/appointments`** — **GET**, **PATCH**, **DELETE** only (no `POST`; creation goes through the booking use-case when implemented).
