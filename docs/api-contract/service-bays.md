# Contract: service-bays (`ServiceBaysController`)

Base path: `/service-bays`

Shared types:

```typescript
type ServiceBayResponse = {
  id: string;
  dealershipId: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

type ServiceBayListResponse = {
  total: number;
  items: ServiceBayResponse[];
};
```

---

## `POST /service-bays`

**Request body**

| Field | Type | Rules |
|-------|------|--------|
| `dealershipId` | string | required, UUID v4 |
| `label` | string | required, 1–128 |

**Responses**

- **201** `ServiceBayResponse`
- **400** `FOREIGN_KEY_REFERENCE` or validation

---

## `GET /service-bays`

**Query**

| Param | Type | Default | Rules |
|-------|------|---------|--------|
| `limit` | number | 20 | int 1–100 |
| `offset` | number | 0 | int ≥ 0 |
| `dealershipId` | string | omitted | optional UUID v4 filter |

**Responses**

- **200** `ServiceBayListResponse`

---

## `GET /service-bays/:id`

**Responses**

- **200** `ServiceBayResponse`
- **404** `SERVICE_BAY_NOT_FOUND`

---

## `PATCH /service-bays/:id`

**Request body** (all optional)

| Field | Type | Rules |
|-------|------|--------|
| `dealershipId` | string | UUID v4 |
| `label` | string | 1–128 |

**Responses**

- **200** `ServiceBayResponse`
- **404** `SERVICE_BAY_NOT_FOUND`
- **400** `FOREIGN_KEY_REFERENCE`, `EMPTY_UPDATE`, or validation

---

## `DELETE /service-bays/:id`

**Responses**

- **204** empty body
- **404** `SERVICE_BAY_NOT_FOUND`
