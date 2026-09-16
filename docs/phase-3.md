# Phase 3: properties and units

## Added and changed

- `server/database/migrations/002_properties_units.sql`: properties and units with company IDs, constraints, compound foreign keys, and indexes.
- `server/src/repositories/`: company-scoped property and unit queries.
- `server/src/services/unitService.ts`: transactional unit creation/editing, with a parent-property lock to coordinate with deactivation.
- `server/src/controllers/propertyController.ts`, `unitController.ts`, and `routes/portfolioRoutes.ts`: protected REST endpoints.
- `server/src/validation/portfolio.ts`: strict backend validation for fields, IDs, filters, and pagination.
- `client/src/pages/Property*`, `PropertiesPage.tsx`, `Unit*`: lists, detail pages, forms, search, filters, pagination, and confirmation dialogs.
- `client/src/pages/OverviewPage.tsx`: live active-property and unit counts.
- `server/tests/integration/portfolio.test.ts`, `tests/e2e/portfolio.spec.ts`: isolation, database constraints, workflows, filtering, and mobile checks.

## Run

```powershell
npm.cmd run db:migrate
npm.cmd run dev
```

Use the already-running dev servers if ports 5173/4000 are occupied by this project. The migration command is repeatable and does not reset existing accounts or records.

## Manually test

1. Sign in, open **Properties**, and choose **Add property**. Try Mensah Apartments, 123 Example Street, Accra, Greater Accra, Ghana, Apartment.
2. Open the property details, edit its address or notes, save, and refresh to verify persistence.
3. Click **Add unit** from the property. Add 1A with two bedrooms, 1.5 bathrooms, rent 1250.50, and Vacant status.
4. The unit details should show the correct property. Edit its rent or occupancy status and save.
5. Open **Units**. Search by unit/property name; filter by property, unit status, and property status.
6. Add another unit, then return to the property. The unit count is derived from saved unit records, so there is no separate editable count to keep synchronized.
7. Try adding a duplicate `1A` or `1a` under the same property. A helpful error should appear. The same unit name is allowed in different properties.
8. Deactivate the property. A confirmation dialog appears first; Cancel must leave the property active. Confirming removes it from active lists/counts while preserving its units.
9. Change the property-list Status filter to **Inactive properties**, open the property, and reactivate it. Its original units should return to the active portfolio.
10. Open **Overview** to verify active property, unit, occupied, and vacant counts.
11. In a private browser window, create a different company. Its lists should be empty. Opening a property/unit URL copied from the first company should show “not found.”
12. Resize to a phone/tablet width. Forms stack vertically and wide tables scroll inside their panels.

Property deactivation is the supported removal operation. Unit removal is represented by **Unavailable** status; there is no destructive delete UI. Units cannot move between properties, because future leases and payments will depend on those relationships.

Unit status is manual in this phase; automatic occupancy updates from leases belong to Phase 4. Rent is recorded with two decimal places, using the currency chosen outside the app for that company; currency selection/conversion and payment calculations are not implemented here. Financial dashboard analytics belong to Phase 7.

## REST API

Every endpoint below requires a valid session. OWNER and MANAGER are permitted. Company identity comes exclusively from the authenticated account. Requests with company IDs or other unexpected body/filter fields are rejected.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/properties` | Search/filter/paginate properties |
| POST | `/api/properties` | Create property |
| GET | `/api/properties/options` | Company-scoped property picker |
| GET | `/api/properties/summary` | Active portfolio counts |
| GET | `/api/properties/:id` | Property details with actual unit counts |
| PUT | `/api/properties/:id` | Edit property details |
| PATCH | `/api/properties/:id/status` | `{ "active": false }` or `{ "active": true }` |
| GET | `/api/units` | Search/filter/paginate units |
| POST | `/api/units` | Create a unit in an active, owned property |
| GET | `/api/units/:id` | Unit details |
| PUT | `/api/units/:id` | Edit a unit in an active, owned property |

Property filters: `q`, `status=active|inactive|all`, `type=APARTMENT|HOUSE|TOWNHOUSE|COMMERCIAL|MIXED_USE|OTHER`, `page`, `pageSize`.

Unit filters: `q`, `propertyId`, `status=VACANT|OCCUPIED|MAINTENANCE|UNAVAILABLE`, `propertyStatus=active|inactive|all`, `page`, `pageSize`.

Page size defaults to 20 and is limited to 100. All writes require JSON and the CSRF protection header described in the [Phase 2 guide](phase-2.md). Unknown and other-company IDs return the same 404 response. Composite database foreign keys prevent cross-company property/unit links even if an API query is accidentally incorrect in a future change.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
npm.cmd run test:e2e
```

Integration tests cover two companies, ID guessing, spoofed company fields, create/edit operations, duplicate names, invalid rent/status inputs, filters and pagination, deactivation/reactivation, and MANAGER access. Browser tests cover property/unit creation and edits, confirmation cancellation, filters, persistence, and mobile overflow. Test data is isolated and cleaned up; no demo accounts with preset passwords are installed.
