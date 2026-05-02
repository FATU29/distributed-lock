# APIs for testing — booking-service

Full HTTP surface of [`booking-service`](../booking-service/). Request/response details and errors: [`docs/api-contract/`](../docs/api-contract/README.md).

## Run the API locally

```bash
docker compose -f docker-compose.dev.yml up --build
```

Inside the service container: run migrations and seed when you need fixture data. Default listen port is **8080** (`PORT`).

**Example base URL:** `http://localhost:8080` — no global API prefix (paths are `/users`, `/bookings`, …).

**Concurrent booking stress test:** [`scripts/concurrent-booking-race.mjs`](../scripts/concurrent-booking-race.mjs) — flow: fixtures → slot (default **random** Mon–Fri 10–11 UTC in `SLOT_WINDOW_DAYS`) → `CLIENTS` × user/vehicle → parallel `POST /bookings`. Usage and env: see **Testing → `scripts/` — manual API runners** in the [root README](../README.md).

---

## Endpoint table

| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | Health / hello (AppController) |
| **Users** | | [`docs/api-contract/users.md`](../docs/api-contract/users.md) |
| POST | `/users` | Create user |
| GET | `/users?limit=&offset=` | Paginated list |
| GET | `/users/:id` | By UUID |
| GET | `/users/by-email/:email` | By email (URL-encode if needed) |
| PATCH | `/users/:id` | Update (`email` is immutable) |
| DELETE | `/users/:id` | Delete |
| **Dealerships** | | [`dealerships.md`](../docs/api-contract/dealerships.md) |
| POST | `/dealerships` | |
| GET | `/dealerships?limit=&offset=` | |
| GET | `/dealerships/:id` | |
| PATCH | `/dealerships/:id` | |
| DELETE | `/dealerships/:id` | |
| **Service types** | | [`service-types.md`](../docs/api-contract/service-types.md) |
| POST | `/service-types` | |
| GET | `/service-types?limit=&offset=` | |
| GET | `/service-types/:id` | |
| PATCH | `/service-types/:id` | |
| DELETE | `/service-types/:id` | |
| **Service bays** | | [`service-bays.md`](../docs/api-contract/service-bays.md) |
| POST | `/service-bays` | |
| GET | `/service-bays?limit=&offset=` | (+ extra query params per contract — see doc) |
| GET | `/service-bays/:id` | |
| PATCH | `/service-bays/:id` | |
| DELETE | `/service-bays/:id` | |
| **Technicians** | | [`technicians.md`](../docs/api-contract/technicians.md) |
| POST | `/technicians` | |
| GET | `/technicians?limit=&offset=` | (+ query params per contract) |
| GET | `/technicians/:id` | |
| PATCH | `/technicians/:id` | |
| DELETE | `/technicians/:id` | |
| **Vehicles** | | [`vehicles.md`](../docs/api-contract/vehicles.md) |
| POST | `/vehicles` | |
| GET | `/vehicles?limit=&offset=` | (+ query params per contract) |
| GET | `/vehicles/:id` | |
| PATCH | `/vehicles/:id` | |
| DELETE | `/vehicles/:id` | |
| **Appointments** | | [`appointments.md`](../docs/api-contract/appointments.md) |
| GET | `/appointments?limit=&offset=` | **No** `POST /appointments` — create via `/bookings` |
| GET | `/appointments/:id` | |
| PATCH | `/appointments/:id` | |
| DELETE | `/appointments/:id` | |
| **Working hours** | | [`working-hours.md`](../docs/api-contract/working-hours.md) |
| POST | `/working-hours` | Body includes `dealershipId`, … |
| GET | `/working-hours?dealershipId=<uuid>` | `dealershipId` required |
| GET | `/working-hours/:id` | |
| PATCH | `/working-hours/:id` | |
| DELETE | `/working-hours/:id` | |
| **Holidays** | | [`holidays.md`](../docs/api-contract/holidays.md) |
| POST | `/holidays` | |
| GET | `/holidays?dealershipId=&limit=&offset=` | |
| GET | `/holidays/:id` | |
| PATCH | `/holidays/:id` | |
| DELETE | `/holidays/:id` | |
| **Availability** | | [`availability.md`](../docs/api-contract/availability.md) |
| GET | `/dealerships/:dealershipId/availability?date=<YYYY-MM-DD>` | Day schedule projection (ISO date) |
| **Bookings** | | [`bookings.md`](../docs/api-contract/bookings.md) |
| POST | `/bookings` | Confirm booking (Redlock + Postgres + outbox) |

---

## Shared HTTP errors

[`docs/api-contract/errors.md`](../docs/api-contract/errors.md) — domain error → `statusCode` mapping (400 / 404 / 409 / 503 / …).

Use `Content-Type: application/json` for bodies. `ValidationPipe` rejects unknown fields (`forbidNonWhitelisted`).
