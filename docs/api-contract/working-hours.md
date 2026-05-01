# Contract: working hours (`WorkingHoursController`)

Base path: `/working-hours`

Configures the **weekly opening schedule** for a dealership. One row per `(dealershipId, dayOfWeek)`. The booking flow ([bookings.md](./bookings.md)) and the availability read ([availability.md](./availability.md)) both consult this table.

`dayOfWeek` matches `Date.prototype.getUTCDay()`:

| Value | Day |
|-------|-----|
| 0 | Sunday |
| 1 | Monday |
| 2 | Tuesday |
| 3 | Wednesday |
| 4 | Thursday |
| 5 | Friday |
| 6 | Saturday |

Times are **minutes since midnight** in UTC (0–1440). A "Sunday off" row stores `openMinutes = 0, closeMinutes = 0, isClosed = true`.

Shared types:

```typescript
type WorkingHoursResponse = {
  id: string;
  dealershipId: string;
  dayOfWeek: number;   // 0–6
  dayLabel: string;    // e.g. "Monday"
  openMinutes: number; // minutes since midnight
  closeMinutes: number;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
};
```

---

## `POST /working-hours`

Create one weekday row.

**Request body**

| Field | Type | Rules |
|-------|------|--------|
| `dealershipId` | string | required, UUID |
| `dayOfWeek` | number | required, int 0..6 |
| `openMinutes` | number | required, int 0..1440 |
| `closeMinutes` | number | required, int 0..1440 |
| `isClosed` | boolean | optional, default `false` |

When `isClosed=false`, `closeMinutes` must be `> openMinutes` (else **400** `INVALID_WORKING_HOURS`).

**Responses**

- **201** `WorkingHoursResponse`
- **400** `INVALID_WORKING_HOURS` — bad window
- **400** `FOREIGN_KEY_REFERENCE` — unknown `dealershipId`
- **409** `WORKING_HOURS_ALREADY_EXISTS` — `(dealership, dayOfWeek)` already configured

---

## `GET /working-hours?dealershipId={uuid}`

List the seven possible rows for one dealership (returned in `dayOfWeek` ascending order).

**Responses**

- **200** `WorkingHoursResponse[]`
- **400** validation when `dealershipId` is missing or non-UUID

---

## `GET /working-hours/:id`

**Responses**

- **200** `WorkingHoursResponse`
- **404** `WORKING_HOURS_NOT_FOUND`

---

## `PATCH /working-hours/:id`

Partial update. The service rejects empty patches with **400** `EMPTY_UPDATE`.

**Request body** (all optional)

| Field | Type | Rules |
|-------|------|--------|
| `openMinutes` | number | int 0..1440 |
| `closeMinutes` | number | int 0..1440 |
| `isClosed` | boolean | — |

The composite (existing ∪ patch) window must satisfy `closeMinutes > openMinutes` whenever `isClosed=false` or **400** `INVALID_WORKING_HOURS`.

**Responses**

- **200** `WorkingHoursResponse`
- **400** `EMPTY_UPDATE`, `INVALID_WORKING_HOURS`, validation
- **404** `WORKING_HOURS_NOT_FOUND`

---

## `DELETE /working-hours/:id`

**Responses**

- **204** empty body
- **404** `WORKING_HOURS_NOT_FOUND`

---

## Example: configure "Mon–Sat 09:00–17:00, Sun closed"

```http
POST /working-hours        { dealershipId, dayOfWeek: 1, openMinutes: 540,  closeMinutes: 1020 }
POST /working-hours        { dealershipId, dayOfWeek: 2, openMinutes: 540,  closeMinutes: 1020 }
POST /working-hours        { dealershipId, dayOfWeek: 3, openMinutes: 540,  closeMinutes: 1020 }
POST /working-hours        { dealershipId, dayOfWeek: 4, openMinutes: 540,  closeMinutes: 1020 }
POST /working-hours        { dealershipId, dayOfWeek: 5, openMinutes: 540,  closeMinutes: 1020 }
POST /working-hours        { dealershipId, dayOfWeek: 6, openMinutes: 540,  closeMinutes: 1020 }
POST /working-hours        { dealershipId, dayOfWeek: 0, openMinutes: 0,    closeMinutes: 0,    isClosed: true }
```
