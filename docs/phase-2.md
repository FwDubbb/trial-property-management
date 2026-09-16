# Phase 2: authentication and companies

## Added and changed

- `server/database/migrations/001_auth.sql`: companies, users, and persistent sessions, with foreign keys and indexes.
- `server/src/database/migrations.ts` and `migrate.ts`: repeatable, transactional migration runner; checksums prevent accidentally editing an applied migration.
- `server/src/services/authService.ts`, `controllers/authController.ts`, `routes/authRoutes.ts`: company/owner registration, login, logout, and current account.
- `server/src/utils/password.ts`: salted scrypt password hashes. Plain passwords are never stored or returned.
- `server/src/middleware/auth.ts` and `csrf.ts`: authentication, role checks, and protection for state-changing requests.
- `client/src/hooks/useAuth.tsx`, `pages/AuthPage.tsx`, `layouts/WorkspaceLayout.tsx`, `App.tsx`: account state, registration/login forms, protected routes, workspace layout, and sign-out.
- `server/tests/integration/auth.test.ts` and `tests/e2e/auth.spec.ts`: PostgreSQL integration and browser tests.

## Run

From the project root:

```powershell
npm.cmd install
npm.cmd run db:migrate
npm.cmd run dev
```

If your development servers are already running, use them; do not start a duplicate on the same ports. Restart them after dependency or environment changes. Do not overwrite your existing `server/.env` or its working database credentials.

The default permitted browser origins are `http://127.0.0.1:5173`, `http://localhost:5173`, and the same hosts on preview port 4173. Set `APP_ORIGINS` in `server/.env` to a comma-separated list if you use other origins. Production requires explicit HTTPS origins and HTTPS hosting; session cookies become Secure in production.

## Manually test

1. Open http://127.0.0.1:5173. The application should ask you to sign in.
2. Click **Create a company**. Enter a company name, your name, email, and matching passwords of at least 12 characters.
3. Registration signs you in as the company’s **Owner**. Verify your company name in the header and your account in **Settings**.
4. Refresh the page or close/reopen the browser. You should remain signed in for up to seven days, unless you sign out.
5. Click **Sign out**, then sign in with the same email/password. A wrong password should show a helpful error.
6. Try registering with the same email again; the API rejects it without leaving an extra company behind.
7. Use a private browser window to register a different company. Each account must show its own company.
8. The original connection checks are still available at `/setup`.

## API

| Method | Endpoint | Body / result |
| --- | --- | --- |
| POST | `/api/auth/register` | `companyName`, `name`, `email`, `password`; creates a company and OWNER |
| POST | `/api/auth/login` | `email`, `password`; establishes a fresh session |
| GET | `/api/auth/me` | Current public account and company fields, or 401 |
| POST | `/api/auth/logout` | `{}`; revokes the session and clears its cookie |

POST/PUT/PATCH/DELETE calls require `Content-Type: application/json` and `X-Requested-With: PropertyPlatform`. Browser origins are checked against `APP_ORIGINS`. The frontend supplies these headers automatically. No permissive CORS headers are sent.

Session cookies are HttpOnly and SameSite=Strict. Only SHA-256 hashes of random 256-bit session tokens are stored in PostgreSQL. Sessions expire after seven days and are removed on logout; expired rows are cleaned when new sessions are created. Sessions survive API restarts. Authentication endpoints limit requests per IP (30 in 15 minutes); this in-memory limiter is suitable for one API process. Multi-instance production hosting would require a shared limiter store.

Emails are globally unique because sign-in uses email and password. Registration creates a new company; it never accepts a supplied company ID or role. The schema and permission middleware support OWNER and MANAGER; team invitations/account provisioning are not part of this phase.

## Automated checks

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
npm.cmd run test:e2e
```

Integration tests need a PostgreSQL account with permission to create schemas. They use a random schema, then drop only that schema. Browser tests create uniquely named test companies and delete only those records afterward. Run browser tests against a local development database.
