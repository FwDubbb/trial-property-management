# Phase 7: expenses and dashboard analytics

## What changed

- **Expenses:** record property costs, view details, search descriptions/properties, filter by month/category/property/status, and paginate results.
- Expense categories: Repairs, Utilities, Property taxes, Insurance, Cleaning, Landscaping, Supplies, Other.
- **Void with a reason:** remove an incorrect entry from totals while preserving its amount, author, timestamp, and correction history.
- Property detail pages now include expense history and a record-expense shortcut.
- **Overview dashboard:** current portfolio counts, tenant counts, open maintenance requests, monthly rent totals, expenses, and rent received less expenses.
- Six-month comparison of receipts and expenses, monthly expenses by category, recent payments, and recent maintenance requests.
- Month and property filters, loading/error/empty states, refresh action, and responsive layouts.

## Run locally

In PowerShell or Command Prompt, from the project root:

```powershell
npm.cmd run db:migrate
npm.cmd run dev
```

Open **http://127.0.0.1:5173** and sign in. Choose **Expenses** in the sidebar to record spending. If the app is already running, open the URL instead of starting another copy.

Migration `006_expenses.sql` has already been applied in this workspace. It adds `expenses` and its indexes/constraints; earlier migrations are unchanged. Existing `.env` files and credentials are preserved. There are no new npm dependencies.

## How the dashboard calculates totals

| Metric | Meaning |
| --- | --- |
| Total properties / units | All company records matching the property filter, including inactive properties |
| Occupied / vacant units | Current occupancy from the existing lease-aware unit view |
| Total tenants | All company tenants; with a property filter, distinct tenants having any lease at that property |
| Open maintenance | Submitted, Assigned, or In progress requests, including those on inactive properties |
| Expected rent | Rent scheduled for the selected rent month, following Phase 5's full-month and recorded-charge rules |
| Paid toward rent | Non-voided payments allocated to the selected rent month, regardless of receipt date |
| Outstanding rent | Expected rent minus payments allocated to that rent month |
| Rent received | Non-voided payments whose payment dates fall in the selected calendar month, regardless of rent allocation |
| Total expenses | Non-voided expenses whose paid dates fall in the selected calendar month |
| Rent less expenses | Rent received minus total expenses; negative amounts are allowed |

For example, a **200.00** payment received in October for September rent increases October's **Rent received**, and September's **Paid toward rent**. It does not settle October rent. A **50.00** expense paid in October reduces October's **Rent less expenses** by 50.00.

Portfolio counts and recent maintenance describe current records, regardless of the selected month. Financial cards and recent payments follow the selected month. The six-month comparison ends with that month and includes zero-activity months. Property filtering applies to every section.

The dashboard uses the same rent calculation as the Payments page. Earlier lease edits/termination and recorded-charge rules still apply. Outstanding rent is for the selected rent month, not an accumulated all-time balance. Overdue amounts are evaluated against today's UTC date, not a historical month-end snapshot.

All financial sums and differences use PostgreSQL exact numeric arithmetic. Dashboard queries run within one read-only, repeatable-read transaction so a concurrent payment does not produce inconsistent cards. Inactive properties remain in historical financial totals. Voiding a record updates the original activity month's totals.

Amounts use the application's existing currency convention; there is no currency conversion. Record all amounts consistently. These are totals of entered rent receipts and expenses, not a complete accounting profit statement. Deposits, unpaid invoices, refunds, credits, depreciation, and other income are not added automatically.

## Expense rules

- Record expenses already paid, using the date paid. Dates may be backdated but cannot be in the future relative to the current UTC date.
- Amounts must be positive, finite, no more than 9,999,999,999.99, and have at most two decimal places.
- Every expense belongs to one property owned by the signed-in company. Historical costs may be entered for inactive properties.
- OWNER and MANAGER can record and void their company's expenses and view dashboard analytics.
- The expense list's **Recorded total** includes all matching pages and excludes voided entries. Filtering to Voided therefore shows a recorded total of zero while preserving the original entries in the table.
- Entries are immutable through the API. Correct a mistake by voiding with a reason and recording a replacement. Voiding does not move money or request a refund.
- A submission UUID makes retries idempotent: retrying the same ID/body returns the original entry. Changing the body under the same ID is rejected. A new/replacement expense needs a new ID.

## Manual test

1. Create a tenant and a current lease with rent **1,000.30**. Record a current-month rent payment of **400.10**.
2. Open the property's page and choose **Record expense**. Select **Repairs**, enter `Replaced kitchen sink seal`, amount **125.15**, today's paid date, and a receipt reference in Notes.
3. Save and refresh the detail page. Verify its amount, category, property, notes, and recorded-by information.
4. Open **Expenses**. Search `sink`; try category, property, month, and record-status filters. The recorded total should include all matching non-voided expenses.
5. Open **Overview** and select that property and month. With only the entries above, expect:
   - Expected rent: **1,000.30**
   - Paid toward rent / Rent received: **400.10** each
   - Outstanding rent: **600.20**
   - Total expenses: **125.15**
   - Rent less expenses: **274.95**
6. Check Repairs in the expense-category summary, the six-month comparison, and recent payments. Create a maintenance request and verify the open count and recent activity after refreshing.
7. Select a different property or month. Financial values must match that selection. Current portfolio counts should not become historical counts when changing the month.
8. Open the expense and choose **Void expense**. Cancel once, then confirm with a reason. The entry remains visible as Voided. The selected month's expense total returns to zero and rent less expenses becomes **400.10**.
9. Record a late payment against an earlier rent month. Verify the distinction between its receipt month and its allocated rent month using the dashboard and Payments page.
10. In another company account, verify that expenses, selectors, analytics, and recent activity contain only its records. A copied expense URL should return not found.
11. Test phone width: cards and forms should stack, and the comparison table should scroll inside its panel.

## Files added or changed

| Area | Files |
| --- | --- |
| Database | `server/database/migrations/006_expenses.sql` |
| Validation | `server/src/validation/expenses.ts` |
| Company-scoped queries | `server/src/repositories/expenseRepository.ts`, `dashboardRepository.ts` |
| Recording/voiding transactions | `server/src/services/expenseService.ts` |
| REST API | `server/src/controllers/financeController.ts`, existing `routes/portfolioRoutes.ts` |
| Expense UI | `ExpensesPage.tsx`, `ExpenseFormPage.tsx`, `ExpenseDetailPage.tsx`, `components/ExpenseList.tsx` |
| Dashboard | `pages/OverviewPage.tsx`, `types/finance.ts`, `finance.css` |
| Integration | App routes, sidebar, stylesheet import, property expense history |
| Tests | `server/tests/integration/finance.test.ts`, `tests/e2e/finance.spec.ts` |

## REST API

All routes require an authenticated OWNER or MANAGER. Company and actor identity come from the session. Mutations require JSON and `X-Requested-With: PropertyPlatform`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | Portfolio, monthly rent/cash totals, categories, trend, recent activity |
| GET | `/api/expenses` | Expense list and filtered recorded total |
| GET | `/api/expenses/:id` | Expense details and audit information |
| POST | `/api/expenses` | Record an expense |
| POST | `/api/expenses/:id/void` | Void using `{ "reason": "Incorrect receipt" }` |

Record fields: `propertyId`, `category`, `description`, `amount`, `expenseDate`, optional `notes`, and `requestId` (UUID). Category values are `REPAIRS`, `UTILITIES`, `PROPERTY_TAXES`, `INSURANCE`, `CLEANING`, `LANDSCAPING`, `SUPPLIES`, `OTHER`. First successful submission returns 201; an identical retry returns 200, including a previously voided entry without reactivating it.

Expense list filters: `q`, `propertyId`, `category`, `period=YYYY-MM`, `state=RECORDED|VOIDED`, `page`, `pageSize` (default 20, maximum 100). Omitting period includes all dates.

Dashboard filters: `period=YYYY-MM` (defaults to current UTC month), optional `propertyId`. A property from another company produces empty scoped analytics and exposes no foreign records. Unknown fields are rejected on all endpoints.

## Verification

```powershell
npm.cmd run build
npm.cmd test
node --import tsx --test --test-concurrency=1 server/tests/integration/*.test.ts
npm.cmd run test:e2e -- --workers=1
```

The sequential database and browser commands reduce memory pressure on this development machine. Run the commands one at a time. If PowerShell cannot start because of resource pressure, use Command Prompt from the project directory.

Phase 7 adds 6 database integration tests and 1 browser workflow. The complete suite contains 8 baseline tests, 52 database integration tests, and 12 browser tests. Tests cover exact cents, monthly date boundaries including leap days, late rent allocations, void exclusions, empty reports, negative differences, inactive properties, roles, company isolation, retry protection, and mobile overflow.

Phase 8 (expanded permissions, security, responsive review, and testing) has not been started.
