# Property Management Platform

A multi-tenant property management application for landlords and property managers, built incrementally with React, TypeScript, Express, and PostgreSQL.

## Implemented: Phases 1–5

- Company registration and OWNER accounts.
- Login, logout, persistent PostgreSQL sessions, and protected pages.
- Properties: create, view, edit, search, filter, deactivate, and reactivate.
- Units: create, view, edit, search, filter, and manage occupancy status.
- Tenants: contact profiles, emergency contacts, search, current units, and lease history.
- Leases: create/edit, date-based statuses, overlap prevention, and confirmed termination.
- Automatic occupancy updates from active leases, including expiry and termination.
- Rent payments: recording, searchable history, confirmed voiding, and tenant/lease payment history.
- Monthly rent balances: expected, paid, outstanding, and overdue, with company-scoped filters.
- An overview of active properties, total units, occupied units, and vacant units.
- Backend validation, company-scoped queries, role middleware, responsive forms/tables, and automated tests.

Maintenance, expenses, and financial dashboard analytics remain in Phases 6–8. Team invitations and password recovery are not implemented yet.

Detailed file changes and manual tests: [Phase 2](docs/phase-2.md) · [Phase 3](docs/phase-3.md) · [Phase 4](docs/phase-4.md) · [Phase 5](docs/phase-5.md).

## Technology

- Frontend: React, TypeScript, CSS, Vite, React Router.
- Backend: Node.js, Express, TypeScript, Zod, native scrypt password hashing.
- Database: PostgreSQL with the `pg` connection pool and SQL migrations.
- Testing: Node test runner, Supertest, and Playwright.
- Project tooling: npm workspaces with one root lockfile.

Use Node.js **22.12 or newer** (Node 24 is supported), npm, and PostgreSQL 17. Docker Desktop is optional. References: [Vite setup](https://vite.dev/guide/), [node-postgres pools](https://node-postgres.com/apis/pool), [Express security practices](https://expressjs.com/en/advanced/best-practice-security.html).

## Quick start for this existing workspace

Your local environment files and database credentials are already configured. Preserve them.

```powershell
cd 'C:\Users\DSU Student\property-project\trial-property-management'
npm.cmd install
npm.cmd run db:migrate
npm.cmd run dev
```

Open **http://127.0.0.1:5173** and choose **Create a company**. Registration creates your company and owner account. There are no preset demo passwords.

If the application is already running, open it instead of starting another copy. Use either `npm.cmd run dev` or the two separate commands below, not both.

```powershell
# Terminal 1, from the project root:
npm.cmd run dev:server
```

```powershell
# Terminal 2, from the project root:
npm.cmd run dev:client
```

The frontend uses port 5173; the API uses port 4000. Press Ctrl+C in the owning terminal to stop a dev server. Restart after changing dependencies or environment settings. `npm.cmd` avoids PowerShell execution-policy errors with `npm.ps1`; on other shells, `npm` is sufficient.

## Setup on a new machine

### 1. Install and configure

```powershell
npm.cmd install
if (!(Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
if (!(Test-Path client/.env)) { Copy-Item client/.env.example client/.env }
```

| File | Variable | Purpose |
| --- | --- | --- |
| `server/.env` | `NODE_ENV` | `development`, `test`, or `production` |
| `server/.env` | `HOST` | Defaults to local-only `127.0.0.1` |
| `server/.env` | `PORT` | Defaults to `4000` |
| `server/.env` | `DATABASE_URL` | Required PostgreSQL connection string |
| `server/.env` | `APP_ORIGINS` | Comma-separated browser origins allowed to change data |
| `client/.env` | `VITE_API_BASE_URL` | Keep `/api` for the same-origin setup |
| `client/.env` | `API_PROXY_TARGET` | Defaults to `http://127.0.0.1:4000` |

Development defaults allow localhost and 127.0.0.1 on ports 5173 and 4173. Production requires explicit HTTPS `APP_ORIGINS` and HTTPS hosting. The frontend proxy keeps `/api` requests same-origin; permissive CORS is not enabled. If you change the API port, update the proxy target too.

`.env` files are ignored by Git. Never put credentials in `VITE_` variables: those are visible in the browser. Percent-encode URL-reserved characters in database passwords. Sessions use random tokens with server-side hashes, so this implementation does not require a JWT/signing secret.

### 2. Create the PostgreSQL database

Choose one option.

**Docker Desktop:**

```powershell
docker compose up -d db
docker compose ps
```

The supplied Compose file creates `property_management` with the development credentials in `server/.env.example`. Its named volume persists data. `docker compose down` preserves that volume. Initialization credentials only take effect when the volume is first created.

**Installed PostgreSQL:**

In pgAdmin or SQL Shell, connect as your PostgreSQL administrator to the `postgres` database. Run separately, outside a transaction:

```sql
CREATE ROLE property_dev WITH LOGIN PASSWORD 'property_dev_password';
CREATE DATABASE property_management OWNER property_dev;
```

If the role/database already exists, use it instead of rerunning creation. Update `server/.env` to match your credentials. Example passwords are local development values only.

### 3. Check the connection and initialize tables

```powershell
npm.cmd run db:check
npm.cmd run db:migrate
```

The first command executes `SELECT 1`. The migration command creates:

- `schema_migrations` — migration history and checksums.
- `companies`, `users`, `sessions` — accounts and authentication.
- `properties`, `units` — company portfolios.
- `tenants`, `leases` — tenant profiles and agreements.
- `rent_charges`, `payments` — recorded monthly rent amounts and payment history.
- `lease_details`, `unit_occupancy` — views that derive lease status and occupancy from UTC dates.

Phase 4 installs PostgreSQL's bundled `btree_gist` extension in `public` for overlap constraints. The migration account needs permission to install it, or an administrator can install it first. See the [Phase 4 database setup](docs/phase-4.md#database-requirement).

Migrations run once, in order, within transactions. Rerunning the command is safe. Add a new migration rather than editing an applied one. Migrations use the same SQL files for source and compiled execution; retain `server/database/migrations` with the server build.

There is no seed command yet. Register a company through the UI and add sample properties/units using the [Phase 3 walkthrough](docs/phase-3.md). Automated tests create and remove their own test data; they never install shared demo credentials.

## Project structure

```text
client/
  src/
    components/     Status cards, tables, pagination, confirmation dialogs
    hooks/          Authentication, connection checks, API loading state
    layouts/        Workspace and connection-page layouts
    pages/          Authentication, overview, settings, property/unit pages
    services/       API clients
    types/          Account, property, unit, and response types
    App.tsx         Routes and authenticated-page protection
server/
  database/
    migrations/     Versioned PostgreSQL SQL files
  src/
    config/         Environment validation
    controllers/    HTTP request/response handlers
    database/       Pool, migration runner, connection check
    middleware/     Authentication, role checks, CSRF protection, errors
    repositories/   Company-scoped SQL queries
    routes/         Authentication, health, and portfolio routes
    services/       Authentication and transactional unit operations
    types/          Account/request types
    utils/          Password hashing and API errors
    validation/     Strict request and query schemas
    app.ts          Express app factory
    index.ts        Server startup/shutdown
  tests/
    integration/    Real PostgreSQL tests in isolated schemas
tests/e2e/          Real-browser integration tests
compose.yaml        Optional local PostgreSQL
```

## Security and data boundaries

The backend derives company identity from the authenticated user. It does not accept company IDs or roles during registration or portfolio writes. Property/unit queries filter by company ID. Compound foreign keys prevent a company's units from referencing another company's properties. OWNER and MANAGER can manage their own portfolio; role middleware can be extended for later features.

Passwords use salted scrypt hashes. Sessions use random 256-bit tokens; only token hashes are stored in PostgreSQL. Cookies are HttpOnly, SameSite=Strict, and Secure in production. Sessions last seven days, survive server restarts, and are revoked on logout.

Mutations require JSON plus `X-Requested-With: PropertyPlatform`; browser origins are checked. Authentication is rate-limited to 30 attempts per IP per 15 minutes. The limiter is in memory and will need a shared store for multiple production API instances.

The application is still under development. Team invitations, password recovery, and deployment hardening belong to subsequent work. Tenant, lease, and payment routes enforce OWNER/MANAGER access and company isolation. Payments only record rent received externally. Full monthly rent applies to partial months; see the [rent rules](docs/phase-5.md#rent-rules-used-in-this-mvp), including how recorded charges survive lease changes and termination.

## API and connectivity

The public connection page is **http://127.0.0.1:5173/setup**. It checks the frontend, backend, and database separately.

```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/test
Invoke-RestMethod http://127.0.0.1:4000/api/health/database
Invoke-RestMethod http://127.0.0.1:5173/api/test
```

Database health returns 503 when unavailable; PowerShell reports that as an error. Authenticated routes return 401 without a valid session. Cross-company record IDs return 404.

See [authentication endpoints](docs/phase-2.md#api), [property/unit endpoints](docs/phase-3.md#rest-api), [tenant/lease endpoints](docs/phase-4.md#rest-api), and [payment endpoints](docs/phase-5.md#rest-api) for request details.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Integration tests use `DATABASE_URL` and require permission to create schemas. Each file creates a random schema, runs migrations there, and deletes only that schema afterward. Browser tests use the local development API, create uniquely named test companies, and remove only their own records. Migrate the database before running browser tests. Playwright starts dev servers if necessary, or reuses servers already running on the configured ports.

The test suite covers authentication, expiry/revocation, secure cookies, validation, CSRF/rate limiting, role access, company isolation, cross-company foreign keys, properties/units, pagination, status changes, and browser workflows.

### Run compiled output locally

```powershell
npm.cmd run build
npm.cmd run start -w server
```

In another terminal:

```powershell
npm.cmd run preview -w client
```

Open http://127.0.0.1:4173. Vite preview is for local verification. Production hosting needs static frontend delivery and a same-origin `/api` reverse proxy to Express.

## Troubleshooting

- **Port already in use:** the app may already be running. Open the URL first; stop the owning terminal with Ctrl+C before restarting. Do not run both combined and separate dev commands.
- **Database unavailable:** check PostgreSQL availability and `DATABASE_URL`; run `npm.cmd run db:check`.
- **Sign-in/portfolio API fails after updating:** run `npm.cmd run db:migrate`, then restart the API. Preserve existing `.env` credentials.
- **Request origin rejected:** use port 5173 or configure its exact origin in `APP_ORIGINS`; restart the backend.
- **Too many sign-in attempts:** wait 15 minutes. For local testing, restarting the API clears its in-memory limiter.
- **Session missing:** use the same browser hostname consistently. Cookies for `localhost` and `127.0.0.1` are separate.
- **No active units after deactivation:** use the inactive-property filters or reactivate the property. Records were preserved.

## Remaining phases

6. Maintenance requests.
7. Expenses and financial dashboard analytics.
8. Expanded permissions, security review, responsive design, and testing.
