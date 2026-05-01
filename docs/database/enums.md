# Prisma enums

PostgreSQL enums generated from [`booking-service/prisma/schema.prisma`](../../booking-service/prisma/schema.prisma). Column types in migrations match these names.

If this file disagrees with `schema.prisma`, the schema wins.

---

## `AppointmentStatus`

Stored on `appointments.status`. Controls whether a row still reserves bay and technician capacity for conflict detection.

| Value | Meaning |
|--------|---------|
| `PENDING` | Reserved for flows that need a provisional hold before confirmation (if used). Conflict checks treat `PENDING` like `CONFIRMED` for overlap queries (`ACTIVE_STATUSES` in the booking repository). |
| `CONFIRMED` | Normal booked appointment. Default when inserting via `BookAppointmentUseCase` / `PrismaBookingRepository.confirm`. |
| `CANCELLED` | No longer reserves the slot; overlap queries exclude this status so the time window becomes bookable again. |

---

## `TechnicalConfigScope`

Stored on `technical_configs.scope`. Determines which entity `technical_configs.scope_id` refers to.

| Value | `scope_id` |
|--------|------------|
| `GLOBAL` | Must be the sentinel UUID `00000000-0000-0000-0000-000000000000`. One logical key (`config_key`) per global row. |
| `DEALERSHIP` | The `dealerships.id` the config applies to. |
| `TECHNICIAN` | The `technicians.id` the config applies to. |

There is no foreign key from `technical_configs` to `dealerships` or `technicians`; callers must supply a valid id for the chosen scope.
