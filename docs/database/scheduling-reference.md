# Scheduling reference tables

Operational reference data used to **describe** what can be booked. None of these tables is consulted on the hot booking path beyond their FK relationships — the actual collision detection happens against `appointments`. They drive the read API (`/dealerships`, `/service-bays`, …) and the seed file.

```
dealerships ─┬── service_bays
             ├── technicians ── technician_qualified_services ── service_types
             └── (working_hours, holidays — see scheduling-config.md)
```

---

## `dealerships`

The physical or organisational tenant. Bays, technicians, working hours and holidays are all dealership-scoped.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `code` | `text` | `UNIQUE`. Stable external code, e.g. `DEMO-01`. |
| `name` | `text` | Human label. |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

**Constraints / behaviour**

- Unique on `code`. Duplicate → `DealershipCodeAlreadyExistsError` → HTTP 409 `DEALERSHIP_CODE_ALREADY_EXISTS`.
- Cascade-deletes its bays, technicians, working-hours rows and holidays. Appointments referencing the dealership block deletion (`ON DELETE Restrict`) so historical records stay intact.

---

## `service_types`

Catalog of services offered (oil change, brake service, …). Drives appointment duration and the technician-qualification matrix.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `code` | `text` | `UNIQUE`. Short stable code, e.g. `OIL_CHANGE`. |
| `name` | `text` | Human label. |
| `duration_minutes` | `int` | How long a slot is for this service. |
| `required_skill_tag` | `text \| NULL` | Soft skill marker; can be cross-referenced against `technical_configs`. |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

**Constraints / behaviour**

- Unique on `code`. Duplicate → `ServiceTypeCodeAlreadyExistsError` → HTTP 409 `SERVICE_TYPE_CODE_ALREADY_EXISTS`.

---

## `service_bays`

Physical bays at a dealership. A bay is the bottleneck resource on one side of the booking lock (`lock:bay:{bayId}:{slotStart}`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `dealership_id` | `uuid` | FK → `dealerships.id`, `ON DELETE CASCADE`. Indexed. |
| `label` | `text` | Free-form ("Bay A"). |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

**Constraints / behaviour**

- Cascade-deletes when the dealership is deleted.
- Booking flow consults `appointments` for overlapping rows on the same bay; there is no per-bay availability flag.

---

## `technicians`

People at a dealership who can run services. The technician is the other side of the booking lock (`lock:tech:{technicianId}:{slotStart}`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `dealership_id` | `uuid` | FK → `dealerships.id`, `ON DELETE CASCADE`. Indexed. |
| `name` | `text` | Display name (no PII enforcement at DB level). |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

**Constraints / behaviour**

- Cascade-deletes when the dealership is deleted.
- Many-to-many to `service_types` via `technician_qualified_services`.

---

## `technician_qualified_services`

Hard qualification matrix: which technician can run which service. The booking flow assumes the caller has already chosen a qualified `(technicianId, serviceTypeId)` pair.

| Column | Type | Notes |
|--------|------|-------|
| `technician_id` | `uuid` | FK → `technicians.id`, `ON DELETE CASCADE` |
| `service_type_id` | `uuid` | FK → `service_types.id`, `ON DELETE CASCADE` |

**Constraints / behaviour**

- Composite primary key `(technician_id, service_type_id)` — a row is the qualification itself.
- Cascade-deletes when either side is removed.
- Soft / dynamic flags ("specialisation OK") live in `technical_configs` (see [scheduling-config.md](./scheduling-config.md)) so they can be flipped without schema changes.
