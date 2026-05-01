# `outbox`

Producer side of the **outbox pattern**. The booking use-case writes one row here per confirmed booking, in the **same transaction** as the `appointments` insert. A separate WAL-tail / Debezium relay (out of this repo's scope) publishes those rows to Kafka and stamps `published_at`.

From this service's perspective, writing the outbox row **is** the publish operation.

## Columns

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | PK |
| `aggregate_type` | `text` | Currently `"Appointment"`. Identifies which domain object the event belongs to. |
| `aggregate_id` | `text` | The aggregate's id (e.g. `appointments.id`). String, not UUID — outbox is intentionally schema-agnostic. |
| `event_type` | `text` | Currently `"appointment.confirmed"`. Add new event types when new business operations need to be published. |
| `payload` | `jsonb` | The event body — must be self-contained enough that downstream consumers don't need to call back into this service. |
| `created_at` | `timestamptz(6)` | Set on insert. |
| `published_at` | `timestamptz(6) \| NULL` | `NULL` until the relay marks it published. **Never written by this service.** |

## Indexes

- `(published_at)` — supports the relay's "find unpublished rows in `created_at` order" scan.

## Booking event payload (`event_type = 'appointment.confirmed'`)

Fields written by [`booking.repository.ts`](../../booking-service/src/infrastructure/persistence/booking.repository.ts):

```json
{
  "appointmentId": "uuid",
  "customerId": "uuid",
  "vehicleVin": "string",
  "dealershipId": "uuid",
  "bayId": "uuid",
  "technicianId": "uuid",
  "serviceTypeId": "uuid",
  "slotStart": "ISO 8601",
  "slotEnd": "ISO 8601",
  "paymentReference": "string"
}
```

## Behaviour

- **Atomic with the booking insert**. Both rows commit together or neither does. There is no other correct way — a separate `INSERT` after the appointment commit would lose the row on a crash.
- **No Kafka call here.** The relay process is responsible. Don't add an HTTP / Kafka client to this service to "send the event"; that defeats the outbox pattern.
- **Schema-agnostic on purpose.** `aggregate_id` is `text` (not `uuid`) and `payload` is `jsonb` so future event types from non-UUID-keyed aggregates can land without a migration.
- **Trace correlation (planned)**: outbox payloads should carry a `traceparent` header so the relay's spans chain back to the booking request. Not yet on disk — see `booking-service/CLAUDE.md` § "Things that change once Prisma lands" for the OTel hookup.
