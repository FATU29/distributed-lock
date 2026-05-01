# Schedule configuration tables

Tables that tell the booking flow **when** a dealership is open. Read by `DealershipScheduleService.assertSlotIsBookable` (booking pre-flight) and by `GET /dealerships/:id/availability` (read-only projection).

```
dealerships ─┬── working_hours      (weekly grid)
             ├── holidays           (per-date overrides)
             └── (technical_configs is global / per-dealership / per-technician)
```

`technical_configs` is included here because it is the home for **soft, scoped JSON tunables** (slot granularity, specialization OK maps, feature flags), not strongly-typed schedule data.

---

## `working_hours`

Weekly opening schedule per dealership, one row per day-of-week. The booking pre-flight reads the row matching `slot_start.getUTCDay()` and checks `[open_minutes, close_minutes)`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `dealership_id` | `uuid` | FK → `dealerships.id`, `ON DELETE CASCADE` |
| `day_of_week` | `int` | 0 = Sunday … 6 = Saturday (matches `Date.prototype.getUTCDay()`) |
| `open_minutes` | `int` | Minutes since midnight, 0..1440 |
| `close_minutes` | `int` | Minutes since midnight, 0..1440 |
| `is_closed` | `bool` | `true` for a weekly day off (e.g. Sunday). When `true`, the minutes are ignored by the booking pre-flight. |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

**Constraints / behaviour**

- `UNIQUE (dealership_id, day_of_week)` — at most one row per weekday per dealership. `P2002` → `WorkingHoursAlreadyExistsError` → HTTP 409 `WORKING_HOURS_ALREADY_EXISTS`.
- Application-level validation: `close_minutes > open_minutes` whenever `is_closed = false`. Violations surface as `InvalidWorkingHoursError` → HTTP 400 `INVALID_WORKING_HOURS`.
- All minutes are interpreted as **UTC**. Per-dealership timezone is a planned future addition; until it lands, configure rows in UTC.
- Cascade-deletes when the dealership is removed.

**Seed default** ([`prisma/seed.ts`](../../booking-service/prisma/seed.ts)): Mon–Fri 08:00–18:00 (`open_minutes=480`, `close_minutes=1080`); Sat & Sun closed.

---

## `holidays`

Dealership-scoped overrides that close the dealership on specific dates regardless of `working_hours`. Two flavours:

- **Fixed** (`is_recurring = false`) — only the exact UTC date matches.
- **Recurring annual** (`is_recurring = true`) — only month/day are matched; the stored year is a placeholder.

The booking pre-flight loads every holiday for the dealership and runs `Holiday.matches(target)` in memory; the table is small so we avoid `EXTRACT(...)` SQL gymnastics.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `dealership_id` | `uuid` | FK → `dealerships.id`, `ON DELETE CASCADE` |
| `date` | `date` | UTC calendar date. For `is_recurring = true`, only the month/day portion matters. |
| `name` | `text` | Display label, e.g. `"Reunification Day"`. |
| `is_recurring` | `bool` | Defaults `false`. |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

**Constraints / behaviour**

- `UNIQUE (dealership_id, date, is_recurring)` — the same `(dealership, date, recurring-flag)` triplet cannot be inserted twice. `P2002` → `HolidayAlreadyExistsError` → HTTP 409 `HOLIDAY_ALREADY_EXISTS`.
- Index `(dealership_id, is_recurring)` — speeds up the in-memory load that the booking pre-flight does on every booking attempt.
- Cascade-deletes when the dealership is removed.

**Seed default**: four recurring annual Vietnamese public holidays (`2000-01-01 New Year's Day`, `2000-04-30 Reunification Day`, `2000-05-01 Labour Day`, `2000-09-02 National Day`).

---

## `technical_configs`

Catch-all JSON config table for tunables that don't deserve their own column / table yet. Used for things like slot granularity, specialization OK maps, and feature flags. **Not** the home for working hours or holidays — those have their own tables above because they are queried on the hot booking path.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `scope` | enum `TechnicalConfigScope` | `GLOBAL` / `DEALERSHIP` / `TECHNICIAN` |
| `scope_id` | `uuid` | Sentinel `00000000-0000-0000-0000-000000000000` for `GLOBAL`; otherwise the dealership/technician id. |
| `config_key` | `text` | Dotted name, e.g. `booking.slot_granularity_minutes`, `specialization.ok` |
| `value` | `jsonb` | Anything the consumer expects. |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

**Constraints / behaviour**

- `UNIQUE (scope, scope_id, config_key)` — one row per logical key in scope.
- Index `(scope, scope_id)` — supports "load all configs for this technician" reads.
- No FK to `dealerships` / `technicians` — `scope_id` is opaque on purpose, so the table can absorb new scope kinds without schema changes. Callers are responsible for providing a valid id.
- The booking flow does **not** read this table on the hot path. Treat it as the "I haven't designed a real table for this yet" drawer.

**Seed default**: `booking.slot_granularity_minutes = 15` (GLOBAL), and `specialization.ok` per seeded technician.
