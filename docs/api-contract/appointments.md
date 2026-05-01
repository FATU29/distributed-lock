# Contract: appointments (`AppointmentsController`)

Base path: `/appointments`

There is **no** `POST /appointments` in the current HTTP layer (appointments are created via the booking use-case elsewhere, not exposed as a REST create in this controller).

Shared types:

```typescript
type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

type AppointmentResponse = {
  id: string;
  customerId: string;
  vehicleVin: string;
  dealershipId: string;
  bayId: string;
  technicianId: string;
  serviceTypeId: string;
  slotStart: string; // ISO 8601
  slotEnd: string;
  status: string; // see AppointmentStatus
  createdAt: string;
  updatedAt: string;
};

type AppointmentListResponse = {
  total: number;
  items: AppointmentResponse[];
};
```

---

## `GET /appointments`

**Query**

| Param | Type | Default | Rules |
|-------|------|---------|--------|
| `limit` | number | 20 | int 1–100 |
| `offset` | number | 0 | int ≥ 0 |
| `customerId` | string | omitted | optional UUID v4 |
| `dealershipId` | string | omitted | optional UUID v4 |

**Responses**

- **200** `AppointmentListResponse`

---

## `GET /appointments/:id`

**Responses**

- **200** `AppointmentResponse`
- **404** `APPOINTMENT_NOT_FOUND`

---

## `PATCH /appointments/:id`

**Request body** (all optional)

| Field | Type | Rules |
|-------|------|--------|
| `status` | string | optional; must be one of `PENDING`, `CONFIRMED`, `CANCELLED` |
| `slotStart` | string | optional, ISO 8601 date string (`IsDateString`) |
| `slotEnd` | string | optional, ISO 8601 date string |

**Responses**

- **200** `AppointmentResponse`
- **404** `APPOINTMENT_NOT_FOUND`
- **400** `INVALID_SLOT_WINDOW`, `EMPTY_UPDATE`, or validation

---

## `DELETE /appointments/:id`

**Responses**

- **204** empty body
- **404** `APPOINTMENT_NOT_FOUND`
