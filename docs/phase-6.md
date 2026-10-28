# Phase 6: maintenance requests

## What changed

- Create and edit maintenance requests for a rental unit or an entire property.
- Record a generated request number, title, description, priority, submitted date, assigned person, and notes.
- Track Submitted, Assigned, In progress, Completed, and Cancelled statuses.
- Automatically record completion time; reopen closed requests with a reason.
- Search requests and filter by status, priority, and property, with pagination.
- View maintenance history on property, unit, and tenant detail pages.
- Preserve activity history with the acting user, timestamp, status, priority, assignment, and any status-change note.
- Enforce company isolation and OWNER/MANAGER access. Reject stale changes instead of overwriting another manager's work.

## Run locally

From PowerShell:

```powershell
cd 'C:\Users\DSU Student\property-project\trial-property-management'
npm.cmd run db:migrate
npm.cmd run dev
```

Open **http://127.0.0.1:5173/maintenance** and sign in. Keep the terminal open. If the app is already running, open the URL instead of starting another copy.

The migration is already applied in this workspace. It is safe to run the migration command again. Preserve existing `.env` credentials. No new npm dependencies are required.

## Manual test

1. Open **Maintenance → Add request**. Select an active property, a unit, and optionally a tenant. Enter `Kitchen sink leaking`, describe the issue, and choose **High** priority. Save without an assignee.
2. Verify **Submitted**, the generated request number, and the linked property/unit/tenant. Refresh to verify persistence.
3. Choose **Edit request**. Enter `Kofi Plumbing` in **Assigned to** and save. The status becomes **Assigned**.
4. Choose **Start work**, add an optional note, and confirm. Verify **In progress** and an entry in Activity history.
5. Choose **Mark completed**, add a repair note, and confirm. Verify **Completed** and a completion date. Editing is unavailable while closed.
6. Choose **Reopen request**. Try confirming without a reason, then enter `Leak returned` and confirm. The request returns to **Assigned** (or **Submitted** if unassigned). The current completion date clears; the earlier completion and its note remain in Activity history.
7. Choose **Cancel request**. Cancel the dialog first, then reopen it and confirm with a reason. Verify **Cancelled** and the preserved history.
8. Search for `sink` or the request number. Try status, priority, and property filters. The request also appears on the related property, unit, and linked tenant pages.
9. Create another request with **Property-wide / common area** selected. Tenant selection stays disabled; no unit or tenant is required.
10. Open the same request's edit form in two tabs. Save a change in one, then try saving the older form. Expect a conflict message and **Reload latest details**, rather than losing the first change.
11. Sign in to another company in a private browser window. Its lists and selectors must not show the first company's records. A copied request URL should return not found.
12. Resize to phone width. Details and actions should stack, and tables should scroll within their panels.

## Workflow rules

| Action | Result |
| --- | --- |
| Create without an assignee | Submitted |
| Create with an assignee, or assign a Submitted request | Assigned |
| Remove the assignee from an Assigned request | Submitted |
| Start work with an assignee | In progress |
| Return an In progress request to Assigned | Assigned |
| Complete any open request | Completed; completion timestamp recorded by the server |
| Cancel any open request with a reason | Cancelled; history preserved |
| Reopen a closed request with a reason | Assigned if an assignee exists, otherwise Submitted |

- Priorities are **Low, Medium, High, Emergency**. Open requests appear first, ordered by priority and then newest submission date. Closed requests remain searchable.
- The property is required; unit and tenant are optional. Linking a tenant requires a unit and an existing lease connecting that tenant to the unit. Current, past, and upcoming lease records are accepted.
- Property, unit, and tenant links are fixed after creation. Cancel an incorrectly linked request and create a replacement.
- New requests require an active property. Existing requests remain editable and can be completed, cancelled, or reopened after property deactivation.
- An assignee is a free-text employee/contractor name, not a new user account. Assignment does not send notifications.
- In progress requests must keep an assignee. Closed requests must be reopened before their details can be edited.
- Completion times come from the server and display in the browser's local timezone. The submitted date is a date-only value, validated against the current UTC date; it may be backdated but not future-dated.
- Reopening clears the current completion timestamp, while activity history retains earlier completion events. History records who changed a request and its status/assignment/priority; it is not a full revision archive of previous descriptions and notes.
- Maintenance status does not change unit occupancy or lease/payment records. There is no delete endpoint.

## Files added or changed

| Area | Files |
| --- | --- |
| Database | `server/database/migrations/005_maintenance.sql` creates `maintenance_requests`, `maintenance_events`, and a composite unit/property constraint |
| Validation | `server/src/validation/maintenance.ts` |
| Company-scoped queries | `server/src/repositories/maintenanceRepository.ts` |
| Workflow transactions | `server/src/services/maintenanceService.ts` |
| API handlers and routes | `server/src/controllers/maintenanceController.ts`, existing `routes/portfolioRoutes.ts` |
| UI | `MaintenancePage.tsx`, `MaintenanceFormPage.tsx`, `MaintenanceDetailPage.tsx`, `components/MaintenanceList.tsx`, `types/maintenance.ts`, `maintenance.css` |
| Existing pages | App routes, sidebar, stylesheet import, property/unit/tenant history panels |
| Tests | `server/tests/integration/maintenance.test.ts`, `tests/e2e/maintenance.spec.ts` |

## REST API

All endpoints require an authenticated OWNER or MANAGER. Company and actor identity come from the session. Mutations require JSON and `X-Requested-With: PropertyPlatform`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/maintenance` | Search, filters, pagination |
| GET | `/api/maintenance/options` | Company-owned properties, units, and eligible tenants |
| GET | `/api/maintenance/:id` | Request details and activity events |
| POST | `/api/maintenance` | Create a request |
| PUT | `/api/maintenance/:id` | Edit details on an open request |
| PATCH | `/api/maintenance/:id/status` | Change status or reopen |

Create fields: `propertyId`, optional nullable `unitId` and `tenantId`, `title`, `description`, `priority`, `submittedDate`, optional `assignedTo` and `notes`. The server chooses the initial status from the assignment. Client-supplied company, status, completion timestamp, or other unknown fields are rejected.

Update fields: `title`, `description`, `priority`, `submittedDate`, `assignedTo`, `notes`, and the current `version` returned by GET. Omitted optional text fields become empty strings, so submit the complete form values.

Status body example:

```json
{
  "status": "COMPLETED",
  "version": 3,
  "reason": "Replaced seal and verified repair"
}
```

`reason` is required for cancellation and reopening; otherwise it is optional. Reopening uses `ASSIGNED` when the request has an assignee, or `SUBMITTED` otherwise. Each successful edit/status change increments `version`. Outdated versions receive HTTP 409 and make no changes.

List queries: `q`, `status`, `priority`, `propertyId`, `unitId`, `tenantId`, `page`, `pageSize` (default 20, maximum 100). Search includes title, description, request number, assigned person, property, unit, and tenant name. Status values use uppercase identifiers such as `IN_PROGRESS`.

Transactions keep request updates and activity entries together. Row locks and version checks prevent concurrent edits from overwriting one another. Composite foreign keys enforce company ownership and ensure a selected unit belongs to the request's property.

## Verification

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
npm.cmd run test:e2e
```

Phase 6 adds 9 database integration tests and 2 browser tests. The complete suite contains 8 baseline tests, 46 database integration tests, and 11 browser tests. Integration tests use isolated PostgreSQL schemas. Browser tests create uniquely named companies and remove only their own records.

Phase 7 (expenses and dashboard analytics) has not been started.
