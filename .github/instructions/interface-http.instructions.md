---
applyTo: "booking-service/src/interface/http/**"
---

# HTTP interface layer — controller, DTO, filter rules

This is the boundary between HTTP and the application layer. Code here translates between HTTP shapes and use-case inputs/outputs. It does **not** contain business logic.

## Controllers

- One controller per resource (`BookAppointmentController`, `AppointmentsController`, `CheckAvailabilityController`).
- Controllers accept a DTO, call **one** use-case, and return a response shape. They never call repositories, Prisma, Redis, or Redlock directly.
- Controller method bodies are short — typically a single `await this.useCase.execute(input)` with input/output mapping. If a method grows branches, the logic belongs in a use-case.
- No try/catch around the use-case for the purpose of mapping errors to HTTP — that is the exception filter's job. Only catch when there is meaningful HTTP-shape recovery (rare).

## DTOs

- Inbound: `class-validator` decorators on every field. No optional fields without an explicit `@IsOptional()`.
- DTOs validate **HTTP shape** only — required, type, format, length, regex. Business invariants (e.g. "slot duration must match service type") belong in domain value objects, not DTOs.
- DTOs are **never** reused as domain entities. Map DTO → use-case input at the controller boundary.
- Response shapes are also DTOs (e.g. `AppointmentResponse`). They are **never** the same class as the domain entity. Map domain → response in the controller.

## Validation pipe

- Global `ValidationPipe` in `main.ts` with `whitelist: true, forbidNonWhitelisted: true, transform: true`. Don't override per-controller.
- Class-transformer applies `transform: true`. Use `@Type()` for nested DTOs and date strings.

## Exception filter

- `DomainErrorFilter` in `interface/http/filters/` is the single mapping point from domain errors → `HttpException`.
- Mapping table (matches [`booking-service/CLAUDE.md`](../../booking-service/CLAUDE.md) §"Domain errors → HTTP"):

| Domain error | HTTP |
|---|---|
| DTO/VO validation | 400 |
| `VehicleNotEligibleError`, `NoQualifiedTechnicianError`, `BayUnavailableError`, `SlotAlreadyBookedError` | 409 |
| `LockNotAcquiredError` after retries | 503 |
| Entity not found (GET by id) | 404 |

- The filter logs once per error with the request correlation id. Don't double-log: do not also log inside the throw site.
- Unknown errors (no domain class match) → 500. Log full stack at error level. Never return the stack in the HTTP response.

## Logging

- Request log middleware emits one structured JSON line per request: `{ requestId, method, path, status, durationMs, ... }`. Generate `requestId` if `x-request-id` is absent; echo it back in the response header.
- Never log secrets, tokens, full PII, or full payment details.

## Tests

- Controllers are tested via e2e (supertest against the booted app), **not** via per-controller unit tests with mocked use-cases. Per-controller unit tests test framework wiring, not behavior — they're low-value.
- Exception filter has unit tests that assert each domain error maps to the right HTTP status and body shape.
- Validation rules on DTOs are exercised by e2e tests (send invalid payload, expect 400).

## Don'ts

- Don't call repositories, Prisma, Redis, or Redlock from a controller.
- Don't put business validation in a DTO. DTOs check shape; value objects check invariants.
- Don't reuse a domain entity as a DTO or response.
- Don't throw `HttpException` from a use-case to "make controllers thinner". Domain errors stay domain-shaped; the filter maps them.
- Don't add per-controller exception handlers that override `DomainErrorFilter`. There is one mapping point.
- Don't return the request body unchanged as the response — always go through a response DTO.
