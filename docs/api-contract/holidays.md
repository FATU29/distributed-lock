# Contract: holidays (`HolidaysController`)

Base path: `/holidays`

Configures **dealership-scoped holidays** that override the weekly working-hours grid. A holiday on a configured open day still closes the dealership.

A holiday is either:

- **Fixed**: `isRecurring = false`. Only the exact UTC date matches (e.g. `2026-04-30`).
- **Recurring annual**: `isRecurring = true`. Only month + day are matched, regardless of year. The stored year is a placeholder.

Uniqueness is enforced on `(dealershipId, date, isRecurring)`.

Shared types:

```typescript
type HolidayResponse = {
  id: string;
  dealershipId: string;
  date: string;       // YYYY-MM-DD (UTC)
  name: string;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
};

type HolidayListResponse = {
  total: number;
  items: HolidayResponse[];
};
```

---

## `POST /holidays`

**Request body**

| Field | Type | Rules |
|-------|------|--------|
| `dealershipId` | string | required, UUID |
| `date` | string | required, ISO 8601 — server normalises to UTC midnight |
| `name` | string | required, length 1..120 |
| `isRecurring` | boolean | optional, default `false` |

**Responses**

- **201** `HolidayResponse`
- **400** validation
- **400** `FOREIGN_KEY_REFERENCE` — unknown `dealershipId`
- **409** `HOLIDAY_ALREADY_EXISTS` — same `(dealership, date, isRecurring)` row exists

---

## `GET /holidays?dealershipId={uuid}&limit=&offset=`

**Query**

| Param | Type | Default | Rules |
|-------|------|---------|--------|
| `dealershipId` | string | required | UUID |
| `limit` | number | 20 | int 1..100 |
| `offset` | number | 0 | int ≥ 0 |

**Responses**

- **200** `HolidayListResponse` (sorted: fixed dates first, then recurring; date ascending within each group)

---

## `GET /holidays/:id`

**Responses**

- **200** `HolidayResponse`
- **404** `HOLIDAY_NOT_FOUND`

---

## `PATCH /holidays/:id`

Partial update; empty patch yields **400** `EMPTY_UPDATE`.

**Request body** (all optional)

| Field | Type | Rules |
|-------|------|--------|
| `date` | string | ISO 8601 |
| `name` | string | length 1..120 |
| `isRecurring` | boolean | — |

**Responses**

- **200** `HolidayResponse`
- **400** `EMPTY_UPDATE`, validation
- **404** `HOLIDAY_NOT_FOUND`
- **409** `HOLIDAY_ALREADY_EXISTS` — patch collides with another row

---

## `DELETE /holidays/:id`

**Responses**

- **204** empty body
- **404** `HOLIDAY_NOT_FOUND`

---

## Examples

Vietnamese annual public holidays (recurring):

```http
POST /holidays  { dealershipId, date: "2000-01-01", name: "New Year's Day",       isRecurring: true }
POST /holidays  { dealershipId, date: "2000-04-30", name: "Reunification Day",    isRecurring: true }
POST /holidays  { dealershipId, date: "2000-05-01", name: "Labour Day",           isRecurring: true }
POST /holidays  { dealershipId, date: "2000-09-02", name: "National Day",         isRecurring: true }
```

A specific year's lunar new year (fixed):

```http
POST /holidays  { dealershipId, date: "2026-02-17", name: "Tet 2026 Day 1",       isRecurring: false }
POST /holidays  { dealershipId, date: "2026-02-18", name: "Tet 2026 Day 2",       isRecurring: false }
```
