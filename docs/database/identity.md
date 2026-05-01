# Identity tables

Three tables form the identity chain that a booking ultimately points back to:

```
users (1) ── (1) customers ── (n) vehicles ── (n) appointments
```

`User` holds identity / contact fields that may evolve (display name, email).
`Customer` is the stable booking-side anchor — `appointments.customer_id` references it. Splitting the two means we can change a user's email without renumbering historical bookings.

---

## `users`

Owner of identity / contact information.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK, `@default(uuid())` |
| `email` | `text` | `UNIQUE`. Lookup key for `GET /users/by-email/:email`. |
| `display_name` | `text \| NULL` | Optional. Free-form, max 120 in DTO. |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

**Constraints / behaviour**

- Unique on `email`. Prisma `P2002` on duplicate email maps to `UserAlreadyExistsError` → HTTP 409 `USER_ALREADY_EXISTS`.
- Cascade-deletes the linked `customers` row (the relation on `customers.user_id` declares `onDelete: Cascade`).

---

## `customers`

Booking-side identity anchor. One row per `User`. `appointments.customer_id` points here, not at `users`, so the foreign key stays valid through user-side renames or contact changes.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | `UNIQUE`, FK → `users.id`, `ON DELETE CASCADE` |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

**Constraints / behaviour**

- Exactly one `customers` row per `users` row (1-to-1).
- Cascade-deletes its `vehicles` (and indirectly any **non-restricted** appointment graph would, but `appointments.customer_id` is `ON DELETE Restrict`, so deleting a customer with appointments fails — this is intentional, see [`appointments.md`](./appointments.md)).

---

## `vehicles`

Cars / bikes / trucks that customers bring in for service. The `vin` is the human-meaningful identifier and is the FK target for `appointments.vehicle_vin`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `vin` | `text` | `UNIQUE`. Used by appointments and external systems. |
| `customer_id` | `uuid` | FK → `customers.id`, `ON DELETE CASCADE` |
| `label` | `text \| NULL` | Optional human label ("Honda Civic 2018"). |
| `created_at`, `updated_at` | `timestamptz(6)` | Standard. |

**Constraints / behaviour**

- Unique on `vin`. Duplicate inserts → `VehicleVinAlreadyExistsError` → HTTP 409 `VEHICLE_VIN_ALREADY_EXISTS`.
- Cascade-deletes when the owning `customer` is deleted (which itself cascades from `users`, but only when no `appointments` block the chain via `Restrict`).
