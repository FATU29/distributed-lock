# Contract: availability (`AvailabilityController`)

Base path: `/dealerships/:dealershipId/availability`

Read-only projection that combines **working hours** ([working-hours.md](./working-hours.md)) and **holidays** ([holidays.md](./holidays.md)) for a single calendar day. Use this to render a "Is the dealership open on date X?" widget or a calendar picker before calling `POST /bookings`.

Holidays take precedence over working hours: a Monday with a holiday returns `reason = "HOLIDAY"`, not `"OPEN"`.

Shared types:

```typescript
type DayAvailability = {
  dealershipId: string;
  date: string;        // YYYY-MM-DD (UTC)
  isOpen: boolean;
  reason: 'OPEN' | 'CLOSED_DAY' | 'HOLIDAY' | 'NO_SCHEDULE';
  openMinutes: number | null;
  closeMinutes: number | null;
  holidayName: string | null;
};
```

| `reason` | Meaning | `isOpen` |
|----------|---------|----------|
| `OPEN` | Working-hours row exists, `isClosed=false`, no matching holiday. | `true` |
| `CLOSED_DAY` | Working-hours row exists but `isClosed=true` (e.g. weekly day off). | `false` |
| `HOLIDAY` | A configured holiday (fixed or recurring) matches the date. | `false` |
| `NO_SCHEDULE` | Dealership has no working-hours row for that day-of-week. | `false` |

---

## `GET /dealerships/:dealershipId/availability?date={YYYY-MM-DD}`

**Path**

- `dealershipId`: UUID

**Query**

| Param | Type | Rules |
|-------|------|--------|
| `date` | string | required, ISO 8601 (`IsDateString`) — interpreted as UTC |

**Responses**

- **200** `DayAvailability`
- **400** validation when `dealershipId` is not a UUID or `date` is not parseable

This endpoint never throws domain errors; it always returns a verdict (including `NO_SCHEDULE` for a brand-new dealership).

---

## Example

```http
GET /dealerships/0d2e9d22-1f3a-4d5b-8e88-91f0a4b50ad0/availability?date=2026-06-01
```

```json
{
  "dealershipId": "0d2e9d22-1f3a-4d5b-8e88-91f0a4b50ad0",
  "date": "2026-06-01",
  "isOpen": true,
  "reason": "OPEN",
  "openMinutes": 540,
  "closeMinutes": 1020,
  "holidayName": null
}
```

```http
GET /dealerships/0d2e9d22-1f3a-4d5b-8e88-91f0a4b50ad0/availability?date=2026-04-30
```

```json
{
  "dealershipId": "0d2e9d22-1f3a-4d5b-8e88-91f0a4b50ad0",
  "date": "2026-04-30",
  "isOpen": false,
  "reason": "HOLIDAY",
  "openMinutes": null,
  "closeMinutes": null,
  "holidayName": "Reunification Day"
}
```
