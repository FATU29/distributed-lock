# Contract: service-types (`ServiceTypesController`)

Base path: `/service-types`

Shared types:

```typescript
type ServiceTypeResponse = {
  id: string;
  code: string;
  name: string;
  durationMinutes: number;
  requiredSkillTag: string | null;
  createdAt: string;
  updatedAt: string;
};

type ServiceTypeListResponse = {
  total: number;
  items: ServiceTypeResponse[];
};
```

---

## `POST /service-types`

**Request body**

| Field | Type | Rules |
|-------|------|--------|
| `code` | string | required, 1–64 |
| `name` | string | required, 1–256 |
| `durationMinutes` | number | required, int, 1–1440 (24×60) |
| `requiredSkillTag` | string \| null \| omitted | optional, max 128 |

**Responses**

- **201** `ServiceTypeResponse`
- **409** `SERVICE_TYPE_CODE_ALREADY_EXISTS`
- **400** validation

---

## `GET /service-types`

**Query**

| Param | Type | Default | Rules |
|-------|------|---------|--------|
| `limit` | number | 20 | int 1–100 |
| `offset` | number | 0 | int ≥ 0 |

**Responses**

- **200** `ServiceTypeListResponse`

---

## `GET /service-types/:id`

**Responses**

- **200** `ServiceTypeResponse`
- **404** `SERVICE_TYPE_NOT_FOUND`

---

## `PATCH /service-types/:id`

**Request body** (all optional)

| Field | Type | Rules |
|-------|------|--------|
| `code` | string | 1–64 |
| `name` | string | 1–256 |
| `durationMinutes` | number | int, 1–1440 |
| `requiredSkillTag` | string \| null | max 128 |

**Responses**

- **200** `ServiceTypeResponse`
- **404** `SERVICE_TYPE_NOT_FOUND`
- **409** `SERVICE_TYPE_CODE_ALREADY_EXISTS`
- **400** `EMPTY_UPDATE` or validation

---

## `DELETE /service-types/:id`

**Responses**

- **204** empty body
- **404** `SERVICE_TYPE_NOT_FOUND`
