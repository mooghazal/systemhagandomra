# Security model

Laravel is the only authority in this system. The dashboards, direct API
clients and the MCP agent are all *clients* of the same endpoints, and none of
them can reach the database or make an authorisation decision of its own.

---

## 1. Identity

One `users` table holds all three roles:

| Role          | `company_id` | Scope                                        |
|---------------|--------------|----------------------------------------------|
| `super_admin` | always NULL  | every company                                |
| `owner`       | required     | exactly one company, every permission in it  |
| `employee`    | required     | exactly one company, granted permissions only|

This pairing is enforced by a database CHECK constraint
(`users_role_company_check`), so it holds even against a direct SQL write:

```sql
(role = 'super_admin' AND company_id IS NULL)
OR (role IN ('owner','employee') AND company_id IS NOT NULL)
```

Authentication is a Sanctum bearer token. The same mechanism serves all three
client types — only the token's *abilities* differ, and abilities never widen
what an account may do (see §6).

---

## 2. Tenant isolation

Four independent layers. Any one of them failing is caught by the next.

**(a) Query scope** — `App\Models\Scopes\CompanyScope` is applied to every
company-owned model. While an owner or employee is authenticated, every query
on `packages`, `hotels` and `buses` is silently constrained to their
`company_id`. A forgotten `where` in a controller therefore cannot leak rows.

**(b) Route binding** — `{package}`, `{hotel}` and `{bus}` resolve through that
scope, so another company's id is **404, not 403**. A "forbidden" would confirm
the record exists; "not found" tells the caller nothing. `{employee}` and
`{owner}` get the same treatment through explicit bindings in
`AppServiceProvider::configureRouteBindings()`, because the `users` table is
shared across tenants and roles.

**(c) Policies** — every policy method re-checks `company_id` against the
caller via `User::belongsToCompanyId()`, independently of the scope.

**(d) Write path** — `company_id` is absent from every `$fillable` list and is
stripped by `CompanyResourceService::stripProtectedAttributes()`. It is set
only from `TenantContext`. `BelongsToCompany` additionally throws if a record is
ever created without a company, or if an update tries to change one.

### Where the company comes from

`App\Support\TenantContext` is the single answer to "whose data is this?":

- **owner / employee** — always `$user->company_id`. A `company_id` in the
  payload is *excluded from validation entirely* (`Rule::excludeIf`) rather than
  rejected, so a tampered request resolves to the caller's own company instead
  of returning an error that would confirm whether another company exists.
- **super admin** — has no company, so they must name one; it is validated to
  exist.

---

## 3. Permissions

Names live in one place, `App\Support\Permissions`, which the seeder, the
validator, the policies and the MCP tool definitions all read. There are 16:
`{employees,packages,hotels,buses}.{view,create,update,delete}`.

Resolution (`User::hasPermissionTo()`):

- super admin → everything
- owner → everything, within their company
- employee → only rows in `employee_permissions`
- **inactive account → nothing**, whatever is granted

`Gate::before` applies two kill switches *before* the super-admin grant, so a
disabled account — or one whose company has been disabled — is denied
everything, super admins included.

But `Gate::before` only runs when something asks a policy a question, so a route
that reads without authorising — a counter, a profile, a catalogue — never
reached it. `EnsureAccountIsActive` middleware now enforces the same two
switches on every authenticated route, making the check a property of being
signed in rather than of remembering to call `authorize()`.

### Escalation controls

| Attempt | Blocked by |
|---|---|
| Send `role: super_admin` when creating an employee | `role` is not fillable; `EmployeeService` always sets `UserRole::Employee` |
| Promote an employee via update | `UpdateEmployeeRequest` has no `role` field; service never reads one |
| Employee with `employees.update` grants itself permissions | `EmployeePolicy::managePermissions` requires **owner** |
| Employee with `employees.update` resets a colleague's password and signs in as them | `EmployeePolicy::manageCredentials` requires **owner**. Without it one permission became all sixteen |
| Employee re-points a colleague's e-mail to capture account recovery | same check |
| Employee disables a colleague | same check |
| Intruder keeps a session after the password is reset | tokens are revoked on password change, suspension, and company suspension |
| Employee with `employees.create` seeds a new account with permissions | `EmployeePolicy::grantPermissions`, checked in `EmployeeController::store` |
| Employee edits or deletes an owner | `{employee}` binding resolves employees only → 404 |
| Employee deletes itself to escape | `EmployeePolicy::delete` refuses self |
| Invent a permission name | `Rule::in(Permissions::all())` plus a second check in `EmployeeService` |

The `owner` role is assigned in exactly one place: `CompanyService`, reachable
only by a super admin.

---

## 4. Mass assignment

`Model::preventSilentlyDiscardingAttributes()` is on outside production, so a
payload carrying a protected attribute fails loudly in development and tests
rather than being ignored quietly.

Never fillable: `company_id`, `role`, `is_active`, `image_path`, `slug`,
`password` (on models where it is set by a service).

---

## 5. Validation

Form Requests, server-side, for every client. The rule that matters most for
the agent path:

- **create** — only `name` is required; everything else is `nullable`.
- **update** — every rule starts with `sometimes`.

So an omitted field keeps its stored value, and an explicit `null` clears it.
`0`, `false` and `[]` are stored as given, never treated as absent. This is
what lets the agent change one attribute without restating — or inventing — the
rest of the record.

---

## 6. The MCP / agent path

An MCP token is an ordinary Sanctum token carrying the `mcp` ability. That
ability is used **only** to label the audit trail. It grants nothing.

An agent acting for a user gets exactly that user's role, company and
permissions. The guarantee is structural: MCP tools call the same service
classes (`PackageService`, `EmployeeService`, …) that the controllers call, so
there is no second code path where a rule could be missing.

`App\Support\RequestSource` resolves `dashboard` / `api` / `mcp_agent` from the
token, not from a header. A client may narrow the label between the two
interactive paths, but **no header can claim, or disclaim, the agent path**.

Agent-supplied text — package names, descriptions, employee names — is data.
It is stored and returned, never interpreted as instruction, and never used to
build a query (see §8).

---

## 7. Audit trail

`audit_logs` is append-only; nothing in the application updates or deletes a
row. Each record carries the actor (as both a foreign key *and* a name/email/
role snapshot, so it survives deletion), the company, action, resource, source,
IP and metadata.

`AuditLogger::redact()` strips anything whose key contains `password`, `token`,
`secret`, `api_key`, `authorization`, `credentials`, `private_key` or
`signature`, recursively. Failed logins are recorded with the attempted address
but never the attempted password.

---

## 8. Injection and transport

- All queries go through Eloquent / the query builder (bound parameters).
- `LIKE` filters escape `%`, `_` and `\`, so a search term cannot widen its own
  match.
- Uploads: validated by extension *and* real content type *and* `getimagesize()`;
  stored under a Laravel-generated random filename, so a client filename never
  touches the filesystem. JPEG, PNG and WebP only, 5 MB max.
- A company a caller may not see answers **404, not 403** — the same rule as
  packages and hotels. A forbidden-but-existing id answering differently from
  an invented one would let any company user count the platform's tenants.
- `StoreEmployeeRequest::authorize()` runs *before* its rules, so a refused
  caller never learns from a "that e-mail is taken" whether an address has an
  account somewhere else in the system.
- Errors are normalised to `{success: false, message}`. Outside debug mode a
  500 says `Server error.` and the real exception goes to the log — no SQL, no
  paths, no stack traces.
- `SecurityHeaders` middleware sets `nosniff`, `DENY`, `no-referrer`, a
  `default-src 'none'` CSP, and HSTS over HTTPS.
- CORS allows only the two configured frontend origins.
  `supports_credentials` is **false**: auth is a bearer token held server-side
  by each Next.js app, so the browser sends no cross-origin cookies and the API
  has no CSRF surface.

---

## 9. Rate limiting

| Limiter | Limit |
|---|---|
| `login` | 5/min per email+IP, and 20/min per IP |
| `api` | 120/min per user, 30/min per IP unauthenticated |
| `writes` | 40/min per user (POST/PUT/PATCH/DELETE) |

Login failures are indistinguishable from each other: an unknown address and a
wrong password return the same status, message and errors, and a dummy hash is
checked when no user exists so the timing matches.

---

## 10. Deployment requirements

- `APP_DEBUG=false` and `APP_ENV=production`.
- HTTPS (`URL::forceScheme('https')` is applied automatically in production).
- `FRONTEND_ADMIN_URL` / `FRONTEND_COMPANY_URL` set to real origins.
- Secrets in the environment, never in source control. `.env` and
  `database/setup-mysql.sql` are both gitignored.
- `SUPER_ADMIN_PASSWORD` set before seeding — the seeder refuses to create a
  system-level account without one — then changed after first login.
- `php artisan storage:link` so uploaded images are servable.
- `SANCTUM_TOKEN_EXPIRATION` (minutes) is worth setting for MCP tokens, which
  live in an agent process rather than a browser.
- `COOKIE_SECURE` defaults to on in production; set it to `0` only to
  deliberately allow plain HTTP.
- Booting with `APP_ENV=production` and `APP_DEBUG=true` now throws, so the
  mistake surfaces on deploy rather than in a stack trace someone else reads.
