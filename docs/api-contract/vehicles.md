# Contract: vehicles (`VehiclesController`)

Base path: `/vehicles`

Shared types:

```typescript
type VehicleResponse = {
  id: string;
  vin: string;
  customerId: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

type VehicleListResponse = {
  total: number;
  items: VehicleResponse[];
};
```

---

## `POST /vehicles`

**Request body**

| Field | Type | Rules |
|-------|------|--------|
| `customerId` | string | required, UUID v4 |
| `vin` | string | required, 5–32 |
| `label` | string \| null \| omitted | optional, max 128 |

**Responses**

- **201** `VehicleResponse`
- **409** `VEHICLE_VIN_ALREADY_EXISTS`
- **400** `FOREIGN_KEY_REFERENCE` or validation

---

## `GET /vehicles`

**Query**

| Param | Type | Default | Rules |
|-------|------|---------|--------|
| `limit` | number | 20 | int 1–100 |
| `offset` | number | 0 | int ≥ 0 |
| `customerId` | string | omitted | optional UUID v4 filter |

**Responses**

- **200** `VehicleListResponse`

---

## `GET /vehicles/:id`

**Responses**

- **200** `VehicleResponse`
- **404** `VEHICLE_NOT_FOUND`

---

## `PATCH /vehicles/:id`

**Request body** (all optional)

| Field | Type | Rules |
|-------|------|--------|
| `customerId` | string | UUID v4 |
| `vin` | string | 5–32 |
| `label` | string \| null | max 128 |

**Responses**

- **200** `VehicleResponse`
- **404** `VEHICLE_NOT_FOUND`
- **409** `VEHICLE_VIN_ALREADY_EXISTS`
- **400** `FOREIGN_KEY_REFERENCE`, `EMPTY_UPDATE`, or validation

---

## `DELETE /vehicles/:id`

**Responses**

- **204** empty body
- **404** `VEHICLE_NOT_FOUND`
