# Cross-cutting HTTP errors

Handled by `booking-service/src/interface/http/filters/domain-error.filter.ts` unless noted.

## Domain errors (typed)

JSON body:

```json
{
  "statusCode": 409,
  "error": "USER_ALREADY_EXISTS",
  "message": "Human-readable detail from the exception"
}
```

| HTTP | `error` code |
|------|----------------|
| 404 | `USER_NOT_FOUND` |
| 409 | `USER_ALREADY_EXISTS` |
| 404 | `DEALERSHIP_NOT_FOUND` |
| 409 | `DEALERSHIP_CODE_ALREADY_EXISTS` |
| 404 | `SERVICE_TYPE_NOT_FOUND` |
| 409 | `SERVICE_TYPE_CODE_ALREADY_EXISTS` |
| 404 | `SERVICE_BAY_NOT_FOUND` |
| 404 | `TECHNICIAN_NOT_FOUND` |
| 404 | `VEHICLE_NOT_FOUND` |
| 409 | `VEHICLE_VIN_ALREADY_EXISTS` |
| 404 | `APPOINTMENT_NOT_FOUND` |
| 400 | `INVALID_SLOT_WINDOW` |
| 400 | `FOREIGN_KEY_REFERENCE` |
| 400 | `EMPTY_UPDATE` |

## Other failures

- **`HttpException`** (NestJS): passed through with its status and body.
- **Unhandled errors**: `500` with `error: "INTERNAL_SERVER_ERROR"` and a generic message.
