# Contract: technicians (`TechniciansController`)

Base path: `/technicians`

Shared types:

```typescript
type TechnicianResponse = {
  id: string;
  dealershipId: string;
  name: string;
  qualifiedServiceTypeIds: string[];
  createdAt: string;
  updatedAt: string;
};

type TechnicianListResponse = {
  total: number;
  items: TechnicianResponse[];
};
```

---

## `POST /technicians`

**Request body**

| Field | Type | Rules |
|-------|------|--------|
| `dealershipId` | string | required, UUID v4 |
| `name` | string | required, 1–256 |
| `qualifiedServiceTypeIds` | string[] | required, each UUID v4 |

**Responses**

- **201** `TechnicianResponse`
- **400** `FOREIGN_KEY_REFERENCE` or validation

---

## `GET /technicians`

**Query**

| Param | Type | Default | Rules |
|-------|------|---------|--------|
| `limit` | number | 20 | int 1–100 |
| `offset` | number | 0 | int ≥ 0 |
| `dealershipId` | string | omitted | optional UUID v4 filter |

**Responses**

- **200** `TechnicianListResponse`

---

## `GET /technicians/:id`

**Responses**

- **200** `TechnicianResponse`
- **404** `TECHNICIAN_NOT_FOUND`

---

## `PATCH /technicians/:id`

**Request body** (all optional)

| Field | Type | Rules |
|-------|------|--------|
| `dealershipId` | string | UUID v4 |
| `name` | string | 1–256 |
| `qualifiedServiceTypeIds` | string[] | each UUID v4 |

**Responses**

- **200** `TechnicianResponse`
- **404** `TECHNICIAN_NOT_FOUND`
- **400** `FOREIGN_KEY_REFERENCE`, `EMPTY_UPDATE`, or validation

---

## `DELETE /technicians/:id`

**Responses**

- **204** empty body
- **404** `TECHNICIAN_NOT_FOUND`
