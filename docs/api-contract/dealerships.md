# Contract: dealerships (`DealershipsController`)

Base path: `/dealerships`

Shared types:

```typescript
type DealershipResponse = {
  id: string;
  code: string;
  name: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
};

type DealershipListResponse = {
  total: number;
  items: DealershipResponse[];
};
```

---

## `POST /dealerships`

**Request body**

| Field | Type | Rules |
|-------|------|--------|
| `code` | string | required, 1–64 chars |
| `name` | string | required, 1–256 chars |

**Responses**

- **201** `DealershipResponse`
- **409** `DEALERSHIP_CODE_ALREADY_EXISTS`
- **400** validation

---

## `GET /dealerships`

**Query**

| Param | Type | Default | Rules |
|-------|------|---------|--------|
| `limit` | number | 20 | int 1–100 |
| `offset` | number | 0 | int ≥ 0 |

**Responses**

- **200** `DealershipListResponse`

---

## `GET /dealerships/:id`

**Path**

- `id`: UUID

**Responses**

- **200** `DealershipResponse`
- **404** `DEALERSHIP_NOT_FOUND`

---

## `PATCH /dealerships/:id`

**Request body** (all optional; at least one field typically required — empty patch may yield **400** `EMPTY_UPDATE`)

| Field | Type | Rules |
|-------|------|--------|
| `code` | string | optional, 1–64 |
| `name` | string | optional, 1–256 |

**Responses**

- **200** `DealershipResponse`
- **404** `DEALERSHIP_NOT_FOUND`
- **409** `DEALERSHIP_CODE_ALREADY_EXISTS`
- **400** `EMPTY_UPDATE` or validation

---

## `DELETE /dealerships/:id`

**Responses**

- **204** empty body
- **404** `DEALERSHIP_NOT_FOUND`
