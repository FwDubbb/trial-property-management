# Phase 4: tenants and leases

## What changed

- Tenant lists, search, housing filters, creation, editing, and profiles.
- Contact information, emergency contacts, notes, the current rental unit, and lease history in each profile.
- Lease creation, editing, search, status/property filters, detail pages, and confirmed termination with a recorded reason.
- Automatic occupancy from lease dates, consistent across unit details, unit lists, property counts, and the overview.
- Company isolation, OWNER/MANAGER access, backend validation, and database constraints against overlapping leases.

Payment and maintenance history panels explain that those modules are not available yet. No payment or maintenance records are fabricated; those features remain in Phases 5 and 6.

## Files added or changed

| Area | Files |
| --- | --- |
| Database | `server/database/migrations/003_tenants_leases.sql` creates tenants, leases, constraints, and date-derived views |
| Backend validation | `server/src/validation/tenancy.ts` |
| Company-scoped SQL | `server/src/repositories/tenantRepository.ts`, `leaseRepository.ts` |
| Lease transactions | `server/src/services/leaseService.ts` |
| REST API | `server/src/controllers/tenancyController.ts`, existing `routes/portfolioRoutes.ts` |
| Occupancy integration | Existing `unitRepository.ts`, `propertyRepository.ts`, and `unitService.ts` |
| Frontend | Tenant and lease list/form/detail pages, `LeaseHistory`, `LeasesTable`, and `types/tenancy.ts` |
| Existing UI | Routes, sidebar, unit details/forms, and confirmation dialog |
| Tests | `server/tests/integration/tenancy.test.ts`, `tests/e2e/tenancy.spec.ts` |

## Run locally

From the project root:

```powershell
npm.cmd run db:migrate
npm.cmd run dev
```

The migration has already been applied in this workspace. Rerunning it is safe. Preserve your existing `.env` files and database credentials. If both development servers are already running, use them instead of starting duplicates.

Open **http://127.0.0.1:5173** and sign in. **Tenants** and **Leases** are now in the sidebar. The original connection page remains at `/setup`.

### Database requirement

The migration uses PostgreSQL's bundled `btree_gist` extension to reject overlapping date ranges, including concurrent inserts. It is installed in the `public` schema. The migration account needs permission to install this trusted extension, or an administrator can install it first:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
```

Existing migration files are unchanged. Keep the SQL migration directory with compiled server deployments. See PostgreSQL's [range constraints](https://www.postgresql.org/docs/17/rangetypes.html#RANGETYPES-CONSTRAINT) and [btree_gist documentation](https://www.postgresql.org/docs/17/btree-gist.html).

## Manually test

1. Open **Tenants → Add tenant**. Enter Ama Mensah, a phone/email, and emergency contact information. Save and refresh the profile.
2. Click **Edit tenant**, change a contact detail, and save. Search for the tenant by name, phone, or email in the tenant list.
3. From the profile, choose **Create lease**. Select a rental unit, a start date of today or earlier, a future end date, monthly rent, and security deposit.
4. After saving, verify **Active** on the lease. Open the tenant profile: its current unit and current lease should appear. Open the unit: it should show **Occupied**. The overview/property occupied counts should also update.
5. Open **Edit unit**. Occupancy is disabled while an active or upcoming lease controls the unit. Other details remain editable; changing a unit's advertised rent does not change the lease's agreed rent.
6. Try another lease for the same unit with overlapping dates, or for the same tenant in another unit during the same dates. Expect a helpful conflict error. A next term can start the day after the existing end date.
7. Create a future lease for another available unit. It should be **Upcoming**, and the unit should remain vacant until its start date. Leases can also be scheduled after an existing active lease ends.
8. Open an active lease and choose **Terminate lease**. Cancel first and verify nothing changes. Reopen the dialog, enter a reason, and confirm. The lease becomes **Terminated**, the unit becomes vacant if no other current lease applies, and the tenant's profile retains the lease history.
9. To test expiry without waiting, create a lease with both dates in the past for a vacant unit, or edit an active lease so its start/end are in the past. It becomes **Expired**, supplies no current-unit assignment, and is read-only afterward.
10. Use tenant housing filters and lease status/property/search filters. Resize the browser to a phone width; tables should scroll within their panels and forms should stack.
11. In a private window, sign in to another company. Its tenants, leases, and pickers must contain only its own data. A tenant/lease URL copied from the first company must show “not found.”

## Status and occupancy rules

| Condition | Lease status | Effect |
| --- | --- | --- |
| Termination recorded | Terminated | Releases its reservation immediately |
| End date before today's UTC date | Expired | No current occupancy |
| Start date after today's UTC date | Upcoming | Reserves the future dates |
| Today lies between start and end, inclusive | Active | Unit is occupied; tenant has a current unit |

These values are computed by PostgreSQL views on each read, not stored statuses that need a nightly job. Refresh an already-open page to see date changes. The end date is included: a lease ending September 30 remains active that day, and a consecutive lease can start October 1. This MVP uses one primary tenant per lease and rejects overlapping leases for the same tenant as well as for the same unit.

Creating a current/upcoming lease prepares the unit to fall back to **Vacant** when the lease ends. Manual occupancy from Phase 3 is preserved until you attach a current lease or change it manually. Importing an expired lease does not clear existing manual occupancy. A manually occupied unit must have its current lease recorded or be made vacant before a future lease can be scheduled.

Units in Maintenance/Unavailable status cannot receive current or upcoming leases. A lease reservation also prevents unit edits from making the unit unavailable or overriding its occupancy. Lease creation/editing and unit editing share a parent-property lock, so concurrent changes cannot bypass these checks.

Deactivating a property hides it from the active portfolio but does not terminate leases. Leases remain visible in history and can still be terminated while the property is inactive. Reactivate the property to create/edit its leases.

The tenant and unit on a saved lease cannot be changed. Edit terms/dates while the lease is active/upcoming, or terminate it and create a new agreement. Ended leases are read-only. Termination releases the booked period from overlap checks; its original terms, timestamp, and reason remain available as history. There is no delete endpoint for tenants or leases in this phase.

Monthly rent and deposit are recorded amounts using the company's existing currency convention. No funds are processed or payment entries created. Lease rent is independent of the unit's advertised rent.

## REST API

All routes require a signed-in OWNER or MANAGER. Company identity always comes from the authenticated account. Mutations require JSON and `X-Requested-With: PropertyPlatform`, as in earlier phases.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/tenants` | Search, housing filter, pagination |
| POST | `/api/tenants` | Create tenant |
| GET | `/api/tenants/:id` | Profile and current unit/lease |
| PUT | `/api/tenants/:id` | Edit contact details |
| GET | `/api/leases` | Search, filters, pagination/history |
| POST | `/api/leases` | Create lease |
| GET | `/api/leases/options` | Company-scoped tenant/unit choices |
| GET | `/api/leases/:id` | Lease details |
| PUT | `/api/leases/:id` | Edit an active/upcoming lease |
| POST | `/api/leases/:id/terminate` | `{ "reason": "Tenant moved out" }` |

Tenant fields: `firstName`, `lastName`, `phone`, `email`, `emergencyContactName`, `emergencyContactPhone`, `notes`. First and last names are required. Current unit and lease are derived, not editable tenant fields.

Lease fields: `tenantId`, `unitId`, `startDate`, `endDate`, `monthlyRent`, `securityDeposit`, `notes`. Status is derived; sending `status`, `companyId`, or unexpected fields is rejected. Dates must be real `YYYY-MM-DD` dates; money must be non-negative with at most two decimal places.

Tenant filters: `q`, `housing=all|housed|unassigned`, `page`, `pageSize`.

Lease filters: `q`, `status=ACTIVE|UPCOMING|EXPIRED|TERMINATED`, `tenantId`, `unitId`, `propertyId`, `page`, `pageSize`. These power both the lease list and tenant/unit history. Default page size is 20, maximum 100.

## Automated verification

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
npm.cmd run test:e2e
```

Integration tests use isolated PostgreSQL schemas and delete only those schemas. Browser tests create uniquely named companies and delete only their own records. Coverage includes contact edits, current assignments, inclusive date boundaries, overlap constraints, concurrent bookings, expiry without a job, termination, read-only history, role access, company isolation, frontend workflows, and mobile overflow.

Phase 5 (rent/payment tracking) has not been started.
