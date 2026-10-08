# API reference

Base URL: `http://localhost:8000/api`

All endpoints return JSON in one of two shapes:

```jsonc
// success
{ "success": true, "data": { ... }, "meta": { ... } }   // meta only on lists

// failure
{ "success": false, "message": "...", "errors": { "field": ["..."] } }
```

`errors` is present on validation failures (422) only.

## Authentication

Send the token from `POST /auth/login` on every other request:

```
Authorization: Bearer <token>
Accept: application/json
```

Optional: `X-Client-Source: dashboard` labels the request in the audit trail.
It cannot be used to claim or disclaim the MCP agent path — that comes from
the token's abilities.

## Status codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 401 | Missing, malformed or revoked token |
| 403 | Authenticated but not permitted (wrong role, missing permission, disabled account or company) |
| 404 | Not found — **also returned for another company's record**, deliberately |
| 422 | Validation failed |
| 429 | Rate limited |
| 500 | Server error (no details exposed in production) |

## Pagination

List endpoints accept `page` and `per_page` (default 15, max 100) and return:

```jsonc
{ "success": true, "data": [ ... ], "meta": { "current_page": 1, "per_page": 15, "total": 42, "last_page": 3 } }
```

---

# Auth

### `POST /auth/login`
Public. Rate limited: 5/min per email+IP, 20/min per IP.

| Field | Rules |
|---|---|
| `email` | required, email |
| `password` | required, string |
| `device_name` | optional, string, max 100 (default `web`) |

**200** → `{ data: { token, user } }`
**422** → bad credentials, disabled account, or disabled company — all with
the same message, by design.

### `POST /auth/logout`
Auth. Revokes the current token only.

### `POST /auth/logout-all`
Auth. Revokes every token for the account.

### `GET /auth/me`
Auth. → `{ data: { user, permissions } }`

`permissions` is the effective list (super admins and owners get all 16). It
drives what the dashboards render; it is **not** an authorisation decision —
the backend re-checks every request.

---

# Packages / Hotels / Buses

These three behave identically. Permission required is
`{packages|hotels|buses}.{view|create|update|delete}`.

| Method | URL | Permission |
|---|---|---|
| GET | `/packages` | `packages.view` |
| POST | `/packages` | `packages.create` |
| GET | `/packages/{id}` | `packages.view` |
| PUT/PATCH | `/packages/{id}` | `packages.update` |
| DELETE | `/packages/{id}` | `packages.delete` (soft delete) |

Tenant rules for all of them:

- Owners and employees see and touch only their own company's records.
- `company_id` in a payload is **ignored** for company users; the record is
  attributed to the caller's company.
- A super admin **must** send `company_id` on create, and may filter lists by it.
- Another company's id returns **404**.
- A record can never be moved between companies.

### Common query parameters

`page`, `per_page`, `search` (matches name; `%` and `_` are literal),
`is_active`, `company_id` (super admin only).

### Package fields

Only `name` is required. Everything else is optional and stays `null` unless
sent.

| Field | Rules |
|---|---|
| `name` | **required**, string, max 255 |
| `description` | nullable, string, max 10000 |
| `price` | nullable, numeric, 0–99999999.99 |
| `currency` | nullable, 3 letters (upper-cased) |
| `days` | nullable, integer, 1–365 |
| `start_date` | nullable, date |
| `end_date` | nullable, date, ≥ `start_date` |
| `trip_type` | nullable, `hajj` or `umrah` |
| `location` | nullable, string, max 255 |
| `features` | nullable, array of ≤50 strings (≤100 chars each) |
| `image` | nullable, jpeg/png/webp, max 5 MB |
| `is_active` | nullable, boolean |

Extra filters: `trip_type`, `min_price`, `max_price`, `location`.

### Hotel fields

| Field | Rules |
|---|---|
| `name` | **required**, string, max 255 |
| `location` | nullable, string, max 255 |
| `description` | nullable, string, max 10000 |
| `distance_from_haram` | nullable, integer metres, 0–100000 |
| `distance_from_masjid_nabawi` | nullable, integer metres, 0–100000 |
| `rating` | nullable, integer 1–5 |
| `room_type` | nullable, string, max 255 |
| `features` | nullable, array of ≤50 strings |
| `image` | nullable, jpeg/png/webp, max 5 MB |
| `is_active` | nullable, boolean |

Both distances are optional: a Makkah hotel has no meaningful distance to
Masjid an-Nabawi.

Extra filters: `location`, `min_rating`, `max_distance_from_haram`,
`max_distance_from_masjid_nabawi`.

### Bus fields

| Field | Rules |
|---|---|
| `name` | **required**, string, max 255 |
| `type` | nullable, string, max 255 |
| `capacity` | nullable, integer 1–200 |
| `model` | nullable, string, max 255 |
| `description` | nullable, string, max 10000 |
| `features` | nullable, array of ≤50 strings |
| `image` | nullable, jpeg/png/webp, max 5 MB |
| `is_active` | nullable, boolean |

Extra filters: `type`, `min_capacity`.

### Partial updates

On `PUT`/`PATCH`, every field is `sometimes`:

- **omitted** → unchanged
- **`null`** → cleared
- **`0` / `false` / `[]`** → stored as given

```jsonc
// changes the price, leaves everything else exactly as it was
PUT /packages/7
{ "price": 42000 }

// clears the location
PUT /packages/7
{ "location": null }
```

### Images

Uploads need `multipart/form-data`. PHP does not parse a multipart body on
`PUT`, so use `POST` with method spoofing:

```
POST /packages/7
Content-Type: multipart/form-data

_method=PUT
image=@photo.jpg
```

Send `remove_image=true` (JSON is fine) to clear an existing image.

Responses carry both `image_path` (storage-relative) and `image_url`. Run
`php artisan storage:link` once so the URLs resolve.

---

# Employees

| Method | URL | Permission |
|---|---|---|
| GET | `/employees` | `employees.view` |
| POST | `/employees` | `employees.create` (+ owner, if `permissions` is sent) |
| GET | `/employees/{id}` | `employees.view` |
| PUT/PATCH | `/employees/{id}` | `employees.update` |
| DELETE | `/employees/{id}` | `employees.delete`, not yourself |
| GET | `/employees/{id}/permissions` | `employees.view` |
| PUT | `/employees/{id}/permissions` | **owner or super admin** |

`{id}` resolves only to employees in the caller's company. An owner's id, a
super admin's id, or an employee from another company all return **404**.

### Create

| Field | Rules |
|---|---|
| `name` | **required**, string, max 255 |
| `email` | **required**, email, unique, lower-cased |
| `password` | **required**, policy below |
| `phone` | nullable, string, max 32 |
| `is_active` | nullable, boolean (default true) |
| `permissions` | nullable, array of valid names — **owner only** |

Not accepted: `role`, `company_id` (for company users), `is_admin`. Accounts
created here are always employees of the caller's company.

Password policy: 10+ chars with letters and numbers in development; 12+ with
mixed case, numbers and symbols in production.

### Permissions

```jsonc
PUT /employees/12/permissions
{ "permissions": ["packages.view", "packages.create"] }
```

Replaces the whole set. `permissions` must be present — send `[]` to revoke
everything, so an accidental omission is a 422 rather than a silent wipe.

The 16 valid names: `{employees,packages,hotels,buses}.{view,create,update,delete}`.

---

# Companies — super admin only

| Method | URL |
|---|---|
| GET | `/companies` |
| POST | `/companies` |
| GET | `/companies/{id}` ← *also readable by that company's own users* |
| PUT/PATCH | `/companies/{id}` |
| DELETE | `/companies/{id}` |

### Create

| Field | Rules |
|---|---|
| `name` | **required**, string, max 255 |
| `email` | nullable, email |
| `phone` | nullable, string, max 32 |
| `address` | nullable, string, max 500 |
| `is_active` | nullable, boolean |
| `owner` | nullable object — creates the first owner in the same transaction |
| `owner.name` | required with `owner` |
| `owner.email` | required with `owner`, unique |
| `owner.password` | required with `owner` |

`slug` is derived from the name (de-duplicated with `-2`, `-3`) and immutable.

**`DELETE` cascades**: every user, package, hotel and bus belonging to the
company is removed. Prefer `is_active: false` to suspend one.

### Owners

| Method | URL |
|---|---|
| GET | `/companies/{company}/owners` |
| POST | `/companies/{company}/owners` |
| PUT/PATCH | `/companies/{company}/owners/{owner}` |
| DELETE | `/companies/{company}/owners/{owner}` |

The owner must belong to the company in the URL, or it's a 404. This is the
only place the `owner` role is ever assigned.

---

# Permissions catalogue

### `GET /permissions`
Any authenticated user. Read-only.

→ `{ data: { permissions: [{id, name, group, label}], groups: {...} } }`

---

# Audit logs

### `GET /audit-logs`
Super admins (all companies) and owners (their own). Employees get 403.

Filters: `company_id` (super admin only), `action`, `resource_type`,
`resource_id`, `source`, `from`, `to`, `page`, `per_page` (default 25, max 100).

Each entry: `action`, `resource_type`, `resource_id`, `source`
(`dashboard`/`api`/`mcp_agent`), `company_id`, `actor` (id, name, email, role
— snapshotted so it survives deletion), `ip_address`, `metadata`, `created_at`.

Secrets are stripped from `metadata` before it is written.

---

# Rate limits

| Scope | Limit |
|---|---|
| Login | 5/min per email+IP, 20/min per IP |
| Authenticated reads | 120/min per user |
| Authenticated writes | 40/min per user |
| Unauthenticated | 30/min per IP |

Exceeding one returns 429 with the standard error envelope.
