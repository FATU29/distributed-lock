# Contract: bookings (`BookingsController`)

Base path: `/bookings`

This is the **confirm-booking** entry point. It is **not** a CRUD `POST /appointments` — it runs the canonical six-step orchestration in [`booking-service/CLAUDE.md`](../../booking-service/CLAUDE.md#the-booking-flow-canonical-implementation): validate → Redlock acquire → PostgreSQL re-check → transactional `Appointment + Outbox` insert → cache invalidate (placeholder) → token-checked Redlock release.

Read-only / mutate / delete on existing appointments still go through [`/appointments`](./appointments.md).

Shared types:

```typescript
type BookingResponse = {
  id: string;
  customerId: string;
  vehicleVin: string;
  dealershipId: string;
  bayId: string;
  technicianId: string;
  serviceTypeId: string;
  slotStart: string; // ISO 8601
  slotEnd: string;   // ISO 8601
  status: string;    // always 'CONFIRMED' on a 201 response
  createdAt: string;
  updatedAt: string;
};
```

---

## `POST /bookings`

Confirm a booking for a `(customer, vehicle, dealership, bay, technician, serviceType)` tuple over a half-open `[slotStart, slotEnd)` window.

**Behaviour summary**

1. The controller validates the DTO, builds value objects, and forwards to `BookAppointmentUseCase`.
2. **Pre-flight schedule check** — before any lock is acquired, `DealershipScheduleService.assertSlotIsBookable` verifies:
   - Slot starts and ends on the same UTC calendar day (else **409** `OUTSIDE_WORKING_HOURS`).
   - Day is not a configured holiday (else **409** `DEALERSHIP_CLOSED_ON_HOLIDAY`). See [holidays.md](./holidays.md).
   - Day has a working-hours row with `isClosed=false`, and the slot fits inside `[openMinutes, closeMinutes)` (else **409** `OUTSIDE_WORKING_HOURS`). See [working-hours.md](./working-hours.md).
3. The use-case acquires a Redlock with **TTL = 15 000 ms** on two resource keys:
   - `lock:bay:{bayId}:{slotStart-ISO}`
   - `lock:tech:{technicianId}:{slotStart-ISO}`
4. While holding the lock it re-checks PostgreSQL for any overlapping `PENDING` / `CONFIRMED` appointment on the same bay or technician.
5. It calls the payment gateway (`MockPaymentGateway` returns `{ reference: "mock_<idempotencyKey>" }`).
6. Inserts the `Appointment` row + an `appointment.confirmed` outbox row in a single `prisma.$transaction`.
7. Releases the lock via the same handle (release errors are swallowed; TTL is the safety net).

If the caller omits `idempotencyKey`, the controller substitutes a fresh `randomUUID()` per request — meaning client-side retries will *not* dedupe. Send a stable key when you want at-most-once payment / booking semantics.

**Request body** (`application/json`)

| Field | Type | Rules |
|-------|------|--------|
| `customerId` | string | required, UUID |
| `vehicleVin` | string | required, length 5–32 |
| `dealershipId` | string | required, UUID |
| `bayId` | string | required, UUID |
| `technicianId` | string | required, UUID |
| `serviceTypeId` | string | required, UUID |
| `slotStart` | string | required, ISO 8601 (`IsDateString`) |
| `slotEnd` | string | required, ISO 8601; must be `> slotStart` |
| `idempotencyKey` | string \| omitted | optional, max 128; forwarded to the payment gateway |

The global `ValidationPipe` runs with `whitelist: true, forbidNonWhitelisted: true` — unknown properties produce `400 Bad Request`.

**Example request**

```http
POST /bookings HTTP/1.1
Content-Type: application/json

{
  "customerId": "8b1f0c11-7c2c-4d6f-9c8a-1c7c63b2c8ee",
  "vehicleVin": "1HGBH41JXMN109186",
  "dealershipId": "0d2e9d22-1f3a-4d5b-8e88-91f0a4b50ad0",
  "bayId":        "4ab1fb88-8c25-4e1f-9b6e-3d3a89be7de2",
  "technicianId": "9c91e0e2-2f8a-4dd1-9d59-1d1d29dab8a1",
  "serviceTypeId":"3d2c64fe-6b89-4d36-8b25-4cd5b2c1c1b4",
  "slotStart":    "2026-06-01T10:00:00.000Z",
  "slotEnd":      "2026-06-01T11:00:00.000Z",
  "idempotencyKey": "booking-2026-06-01-10-customer-8b1f"
}
```

**Responses**

| Status | Body | When |
|--------|------|------|
| **201** | `BookingResponse` | All six steps succeeded; appointment is persisted with `status: "CONFIRMED"`. |
| **400** | validation envelope | DTO violation (missing field, bad UUID, non-ISO date). |
| **400** | `INVALID_SLOT_WINDOW` | `slotStart >= slotEnd` after parsing. |
| **402** | `PAYMENT_DECLINED` | Payment gateway rejected the charge. |
| **409** | `OUTSIDE_WORKING_HOURS` | Slot falls outside the dealership's configured weekly schedule, or crosses a UTC day boundary. |
| **409** | `DEALERSHIP_CLOSED_ON_HOLIDAY` | Slot day matches a configured holiday (fixed or recurring annual). |
| **409** | `SLOT_ALREADY_BOOKED` | In-lock PostgreSQL re-check (or `P2002` race) found an overlapping appointment on the same bay or technician. |
| **503** | `LOCK_NOT_ACQUIRED` | Redlock quorum failed within the per-attempt budget — transient, client may retry with backoff. |
| **500** | `INTERNAL_SERVER_ERROR` | Unhandled error (e.g. database outage after lock acquisition). The lock is still released by the use-case `finally` block. |

Domain error envelope (matches `DomainErrorFilter`):

```json
{
  "statusCode": 409,
  "error": "SLOT_ALREADY_BOOKED",
  "message": "Slot 2026-06-01T10:00:00.000Z–2026-06-01T11:00:00.000Z is already booked for bay=… or technician=…"
}
```

**Idempotency & retries**

- A `503 LOCK_NOT_ACQUIRED` is safe to retry — no payment was charged and no row was written.
- A `409 SLOT_ALREADY_BOOKED` should not be retried with the same slot; the slot is taken.
- A `402 PAYMENT_DECLINED` retry should reuse the same `idempotencyKey` to avoid double charges if the upstream PSP later changes its decision.
- Non-2xx responses do **not** create an `Appointment` row; the corresponding outbox row is also absent.

**Side effects on success**

- One row in `appointments` (`status = 'CONFIRMED'`).
- One row in `outbox` (`event_type = 'appointment.confirmed'`, `aggregate_type = 'Appointment'`, `payload` carries the appointment fields plus `paymentReference`). The downstream CDC relay publishes from there.
- Cache invalidation is a future step — currently a no-op until the cache adapter lands.
