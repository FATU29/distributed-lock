# Database reference

PostgreSQL schema owned by [`booking-service/`](../../booking-service/). Source of truth is [`booking-service/prisma/schema.prisma`](../../booking-service/prisma/schema.prisma); this folder is a human-readable index of what each table is for, who writes to it, and what the booking flow expects of it.

If a fact here disagrees with `schema.prisma`, the schema wins — fix this doc.

## Conventions

- **IDs**: server-assigned UUID v4, stored as `@db.Uuid`. Callers never pass IDs in create flows. Tests/fixtures hand-pick UUIDs in [`prisma/seed.ts`](../../booking-service/prisma/seed.ts) only.
- **Timestamps**: `created_at` and `updated_at` are `timestamptz(6)`. Slot windows on `appointments` are also `timestamptz(6)` (UTC).
- **Migrations**: managed by Prisma — `npx prisma migrate dev --name <change>` in dev (inside the `booking-service` container), `npx prisma migrate deploy` in CI / prod.
- **Naming**: model names are PascalCase in Prisma; table names are snake-cased via `@@map`. Column names mirror the Prisma field with `@map`. Examples in this folder use the **table** name.

## Index

| Doc | Tables | Aggregate / role |
|-----|--------|------------------|
| [identity.md](./identity.md) | `users`, `customers`, `vehicles` | User identity + booking-side identity anchor |
| [scheduling-reference.md](./scheduling-reference.md) | `dealerships`, `service_bays`, `service_types`, `technicians`, `technician_qualified_services` | Operational reference data |
| [scheduling-config.md](./scheduling-config.md) | `working_hours`, `holidays`, `technical_configs` | Per-dealership schedule + tunables |
| [appointments.md](./appointments.md) | `appointments` | Booking aggregate root |
| [outbox.md](./outbox.md) | `outbox` | Outbox / CDC publish boundary |
| [enums.md](./enums.md) | *(no tables)* | `AppointmentStatus`, `TechnicalConfigScope` |

## All tables (catalog)

Every physical table (`@@map`), Prisma model name, and where it is documented in detail.

| Physical table | Prisma model | Purpose (short) | Detailed doc |
|----------------|--------------|-----------------|--------------|
| `users` | `User` | Login identity: unique email, optional display name | [identity.md § users](./identity.md#users) |
| `customers` | `Customer` | Booking FK anchor; one per user | [identity.md § customers](./identity.md#customers) |
| `vehicles` | `Vehicle` | Customer-owned assets; `vin` links to appointments | [identity.md § vehicles](./identity.md#vehicles) |
| `dealerships` | `Dealership` | Tenant; bays, techs, hours, holidays scoped here | [scheduling-reference.md § dealerships](./scheduling-reference.md#dealerships) |
| `working_hours` | `WorkingHours` | Weekly open/close minutes per weekday | [scheduling-config.md § working_hours](./scheduling-config.md#working_hours) |
| `holidays` | `Holiday` | Closed dates (fixed or recurring annual) | [scheduling-config.md § holidays](./scheduling-config.md#holidays) |
| `service_types` | `ServiceType` | Service catalog: duration, optional skill tag | [scheduling-reference.md § service_types](./scheduling-reference.md#service_types) |
| `service_bays` | `ServiceBay` | Physical bay at a dealership | [scheduling-reference.md § service_bays](./scheduling-reference.md#service_bays) |
| `technicians` | `Technician` | Staff member at a dealership | [scheduling-reference.md § technicians](./scheduling-reference.md#technicians) |
| `technician_qualified_services` | `TechnicianQualifiedService` | M:N which tech can perform which service | [scheduling-reference.md § technician_qualified_services](./scheduling-reference.md#technician_qualified_services) |
| `technical_configs` | `TechnicalConfig` | Scoped JSON key/value tunables | [scheduling-config.md § technical_configs](./scheduling-config.md#technical_configs) |
| `appointments` | `Appointment` | Booked slot; bay + technician + window + status | [appointments.md](./appointments.md) |
| `outbox` | `Outbox` | Same-transaction events for downstream CDC/Kafka | [outbox.md](./outbox.md) |

Enums used by columns above: [enums.md](./enums.md).

## Cross-cutting rules

- **PostgreSQL is the system of record.** Redis is cache + Redlock store; never store an `Appointment` in Redis.
- **Write boundary**: an `appointments` insert and the matching `outbox` insert happen in **one** `prisma.$transaction`. There is no other correct way to publish a booking event.
- **In-lock re-check**: the booking use-case ([`book-appointment.use-case.ts`](../../booking-service/src/application/book-appointment/book-appointment.use-case.ts)) re-queries `appointments` for overlapping rows *while holding the Redlock*. The cache is not authoritative.
- **Schedule pre-check**: before the lock is acquired, the same use-case calls `DealershipScheduleService.assertSlotIsBookable`, which reads `working_hours` and `holidays` for the dealership. This rejects out-of-hours / holiday bookings without burning a lock acquisition.
