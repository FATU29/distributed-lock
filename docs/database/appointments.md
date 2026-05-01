# `appointments`

Booking aggregate root. Inserted by `BookAppointmentUseCase` ([`book-appointment.use-case.ts`](../../booking-service/src/application/book-appointment/book-appointment.use-case.ts)) inside a transaction with the matching `outbox` row. Mutated (`PATCH`) and read (`GET`, `GET /:id`) by `AppointmentsController`. **Never** inserted via raw `POST /appointments` — confirm always goes through the booking use-case so the Redlock + re-check + outbox sequence is guaranteed.

## Columns

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `customer_id` | `uuid` | FK → `customers.id`, `ON DELETE Restrict` |
| `vehicle_vin` | `text` | FK → `vehicles.vin`, `ON DELETE Restrict` |
| `dealership_id` | `uuid` | FK → `dealerships.id`, `ON DELETE Restrict` |
| `bay_id` | `uuid` | FK → `service_bays.id`, `ON DELETE Restrict` |
| `technician_id` | `uuid` | FK → `technicians.id`, `ON DELETE Restrict` |
| `service_type_id` | `uuid` | FK → `service_types.id`, `ON DELETE Restrict` |
| `slot_start` | `timestamptz(6)` | Half-open window start, inclusive. |
| `slot_end` | `timestamptz(6)` | Half-open window end, exclusive. |
| `status` | enum `AppointmentStatus` | `PENDING` \| `CONFIRMED` \| `CANCELLED`. Default `CONFIRMED`. |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

## Indexes

- `(bay_id, slot_start, slot_end)` — drives the in-lock conflict re-check on the bay side.
- `(technician_id, slot_start, slot_end)` — drives the in-lock conflict re-check on the technician side.

These two cover the booking write path (a `findFirst` on either bay or technician with an overlap clause) and the `GET /appointments` list filters.

## Behaviour

- **Slot semantics**: `[slot_start, slot_end)` is half-open. Two windows conflict iff `existing.slot_start < new.slot_end AND existing.slot_end > new.slot_start`, *and* either the bay or the technician matches.
- **Active rows only**: the conflict re-check filters `status IN ('PENDING', 'CONFIRMED')`. A `CANCELLED` row no longer reserves the slot.
- **All FKs are `Restrict`**: deleting a referenced customer / vehicle / dealership / bay / technician / service-type fails as long as historical appointments point at it. This is intentional — bookings are evidence.
- **No `POST /appointments`**: there is no REST create on this controller. To create a booking, call `POST /bookings` ([api-contract/bookings.md](../api-contract/bookings.md)).
- **Pre-flight**: before the lock is acquired, the booking use-case calls `DealershipScheduleService.assertSlotIsBookable` against `working_hours` + `holidays`. Bookings outside hours or on a holiday never reach this table.
- **Outbox pairing**: every `INSERT INTO appointments` is followed in the same `prisma.$transaction` by `INSERT INTO outbox` with `event_type = 'appointment.confirmed'`. There is no other correct way to publish a booking event.

## Defence-in-depth (planned, not yet on disk)

A `tstzrange` exclusion constraint on `(bay_id, slot_window)` and `(technician_id, slot_window)` is on the roadmap (see `booking-service/CLAUDE.md`) — it would make a double-book physically impossible at the DB level even if the Redlock failed open. It is not in the current schema because Prisma does not express exclusion constraints natively; adding it requires a hand-edited SQL step inside a generated migration.
