# API contracts

Human-readable contracts for the [`booking-service`](../booking-service/) HTTP surface. Each file maps one NestJS HTTP module (one controller group).

| Contract file | Base path |
|---------------|-----------|
| [root.md](./root.md) | `/` |
| [users.md](./users.md) | `/users` |
| [dealerships.md](./dealerships.md) | `/dealerships` |
| [service-types.md](./service-types.md) | `/service-types` |
| [service-bays.md](./service-bays.md) | `/service-bays` |
| [technicians.md](./technicians.md) | `/technicians` |
| [vehicles.md](./vehicles.md) | `/vehicles` |
| [appointments.md](./appointments.md) | `/appointments` |
| [bookings.md](./bookings.md) | `/bookings` (confirm-booking use-case) |
| [working-hours.md](./working-hours.md) | `/working-hours` (weekly schedule per dealership) |
| [holidays.md](./holidays.md) | `/holidays` (per-dealership holidays) |
| [availability.md](./availability.md) | `/dealerships/:id/availability` (read-only schedule projection) |
| [errors.md](./errors.md) | Domain + generic HTTP errors (shared) |

## Base URL and format

- **Default port**: `8080` (override with `PORT`).
- **Global prefix**: none (`listen` on root).
- **Request body**: `Content-Type: application/json` where a body is used.
- **Identifiers**: path `:id` parameters are UUID strings unless noted otherwise.

## Validation (`400 Bad Request`)

`ValidationPipe` uses `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. Unknown properties are rejected. Typical failure shape (NestJS):

```json
{
  "statusCode": 400,
  "message": ["constraint messages…"],
  "error": "Bad Request"
}
```

## Domain and server errors

See [errors.md](./errors.md) for `DomainErrorFilter` mappings (`statusCode`, `error` code, `message`).
