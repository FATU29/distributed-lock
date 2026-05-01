# Contract: users (`UsersController`)

Base path: `/users`

Shared types:

```typescript
type VehicleSnippet = {
  id: string;
  vin: string;
  label: string | null;
};

type UserResponse = {
  id: string;
  email: string;
  displayName: string | null;
  customerId: string;
  vehicles: VehicleSnippet[];
};

type UserListResponse = {
  total: number;
  items: UserResponse[];
};
```

---

## `POST /users`

Create user (and linked customer profile).

**Request body**

| Field | Type | Rules |
|-------|------|--------|
| `email` | string | required, email, max 254 |
| `displayName` | string \| omitted \| null | optional, string max 120 |

**Responses**

- **201** `UserResponse`
- **409** `USER_ALREADY_EXISTS` — see [errors.md](./errors.md)
- **400** validation

---

## `GET /users`

**Query**

| Param | Type | Default | Rules |
|-------|------|---------|--------|
| `limit` | number | 20 | int 1–100 |
| `offset` | number | 0 | int ≥ 0 |

**Responses**

- **200** `UserListResponse`

---

## `GET /users/:id`

**Path**

- `id`: UUID (user id)

**Responses**

- **200** `UserResponse`
- **404** `USER_NOT_FOUND`

---

## `GET /users/by-email/:email`

Lookup by email (email is a path segment; encode reserved characters as usual).

**Responses**

- **200** `UserResponse`
- **404** `USER_NOT_FOUND`

---

## `PATCH /users/:id`

**Path**

- `id`: UUID

**Request body**

| Field | Type | Rules |
|-------|------|--------|
| `displayName` | string \| null \| omitted | optional; email is not mutable |

At least one meaningful change may be required by the application layer; empty patches can yield **400** `EMPTY_UPDATE`.

**Responses**

- **200** `UserResponse`
- **404** `USER_NOT_FOUND`
- **400** `EMPTY_UPDATE` or validation

---

## `DELETE /users/:id`

**Path**

- `id`: UUID

**Responses**

- **204** empty body
- **404** `USER_NOT_FOUND`
