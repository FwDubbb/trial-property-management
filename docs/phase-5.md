# Phase 5: rent and payment tracking

## What is available

- **Payments → Rent balances:** choose a month to see expected rent, payments allocated to that month, outstanding rent, and overdue rent. Search by tenant, unit, or property; filter by property and status.
- **Record payment:** select a lease, rent month, amount received, payment date, method, reference, and notes.
- **Payment history:** search by tenant/home/reference and filter by rent month, property, method, and recorded/voided status. Lists are paginated.
- **Payment details:** linked tenant/unit/property, recorded-by information, timestamps, and confirmed voiding with a required reason.
- Tenant profiles show monthly balances and payment history. Lease pages show their payment history and a shortcut to record payment.
- OWNER and MANAGER can manage only their own company's payment records.

This phase records money received outside the app. It does not transfer money, issue refunds, collect deposits, or process card payments.

## Run locally

The migration has already been applied to this workspace. From the project root on another installation:

```powershell
npm.cmd run db:migrate
npm.cmd run dev
```

Keep existing `.env` files and credentials. If the API and frontend are already running, use them instead of starting another copy. Open **http://127.0.0.1:5173/payments** and sign in.

No new npm dependencies are required. Migration `004_rent_payments.sql` adds `rent_charges` and `payments`; existing migrations remain unchanged.

## Rent rules used in this MVP

1. A rent period is a calendar month (`YYYY-MM`). Each lease overlapping that month contributes its full monthly rent, including a partial first or last month. There is no daily proration.
2. Rent is due on the first of the month, or the lease start date when it starts later in that month. Dates and overdue transitions use UTC. Refresh an open page to see a date transition.
3. Each payment belongs to one lease and one rent month. Its **payment date** is the date money was received, and can differ from the rent month. For example, a September receipt allocated to August settles August rent. Split a receipt covering several months into separate entries.
4. **Expected** is the rent for that month. **Paid** is the sum of its non-voided payments. **Outstanding** is expected minus paid. Payments must be positive, have at most two decimal places, and cannot exceed the remaining balance. A zero-rent lease is already settled.
5. All monetary calculations and balance comparisons use PostgreSQL exact numeric arithmetic. The unit's advertised rent and the lease's security deposit do not affect expected rent.
6. Totals match the current filters and include every matching row, across all pages. Paid totals measure allocation to a rent month, not cash collected by receipt date. Inactive properties and expired leases remain available for collecting arrears.

| Condition | Displayed status |
| --- | --- |
| Outstanding is zero | Paid |
| Outstanding remains after the due date | Overdue |
| Some rent paid, due date has not passed | Partially paid |
| Nothing paid, due date has not passed | Unpaid |

An overdue row that has received a partial payment also says **Partially paid** below its badge. The Overdue filter takes precedence over Partially paid and Unpaid.

### Preserving recorded amounts

Until its first payment, a month's expected rent follows the lease's current dates and rent. The first payment saves that month's expected amount and due date in `rent_charges`. Later lease edits cannot change that recorded month. Voiding all its payments still preserves its original expected amount.

Terminating a lease removes unrecorded months after the termination month. Cancelling a lease before its start removes all its unrecorded months. **Recorded months retain their charges and payments, including prepaid future months, after termination.** Termination handles occupancy; it does not cancel recorded charges, issue credits, or refund money. Charge adjustments, credits, refunds, custom due dates, and late fees are outside this phase. Review prepaid months before terminating a lease.

Saved payment entries are not edited or deleted through the API. To correct an entry, void it with a reason and record a replacement. Voiding excludes its amount from paid totals, retains the original record, and records who voided it and when. It does not reverse a bank or mobile-money transfer.

## Manual test

1. Create a tenant and a lease with a start date of **today**, a future end date, and rent of **1,200.30**. The security deposit can be any amount.
2. Open **Payments** and select the current month. Verify expected **1,200.30**, paid **0.00**, outstanding **1,200.30**, status **Unpaid**.
3. Click **Record payment** on that row. Enter **400.10**, today's date, **Mobile money**, and a reference such as `MOMO-001`. Save and refresh the payment detail page; its information should persist.
4. Return to Rent balances. Verify **Partially paid**, paid **400.10**, outstanding **800.20**.
5. Record the remaining **800.20**. Verify **Paid** and outstanding **0.00**. The form should no longer accept another payment for that settled month.
6. Open Payment history. Search `MOMO-001`; try method, month, property, and status filters. Open the tenant profile and lease page and verify the same payment appears there.
7. Open the first payment and click **Void payment**. Cancel once. Reopen, try confirming without a reason, then enter `Wrong receipt` and confirm. The entry remains as **Voided** and outstanding rent returns to **400.10**. A replacement entry can settle it again.
8. For overdue rent, use a lease that started in a previous month and choose that month. An unpaid or partly paid balance should show **Overdue**. Record a payment received today against that earlier rent month; only that month's balance should change.
9. Try an amount greater than the balance, an invalid date, or a future payment date. Expect a helpful validation error. Choose a month outside the lease and verify recording is disabled.
10. In another company account, verify its payment options, history, and balances contain only its records. Opening a copied payment URL from the first company should show not found.
11. Resize to a phone width. Filters and summary cards should stack; tables scroll inside their panels.

## Files added or changed

| Area | Files |
| --- | --- |
| Database | `server/database/migrations/004_rent_payments.sql` |
| Validation | `server/src/validation/payments.ts`; exports shared date/money validation from `tenancy.ts` |
| SQL and reports | `server/src/repositories/paymentRepository.ts` |
| Transactions | `server/src/services/paymentService.ts` |
| API | `server/src/controllers/paymentController.ts`; routes in `portfolioRoutes.ts` |
| Frontend | `PaymentsPage.tsx`, `PaymentFormPage.tsx`, `PaymentDetailPage.tsx`, `components/PaymentHistory.tsx`, `types/payments.ts`, `payments.css` |
| Integration | App routes, sidebar, tenant profile, lease detail page, stylesheet import |
| Tests | `server/tests/integration/payments.test.ts`, `tests/e2e/payments.spec.ts` |

## REST API

All routes require an authenticated OWNER or MANAGER. Company and actor IDs come from the session. Mutations require JSON and `X-Requested-With: PropertyPlatform`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/payments` | Search/filter payment history |
| POST | `/api/payments` | Record rent received |
| GET | `/api/payments/rent` | Monthly rent rows and filtered summary |
| GET | `/api/payments/options` | Company-scoped lease choices |
| GET | `/api/payments/:id` | Payment and audit details |
| POST | `/api/payments/:id/void` | Void with `{ "reason": "Wrong receipt" }` |

Record body:

```json
{
  "leaseId": "<lease UUID>",
  "period": "2026-09",
  "amount": 400.10,
  "paymentDate": "2026-09-16",
  "method": "MOBILE_MONEY",
  "reference": "MOMO-001",
  "notes": "September rent installment",
  "requestId": "<new UUID for this submission>"
}
```

Methods: `CASH`, `BANK_TRANSFER`, `MOBILE_MONEY`, `CHECK`, `OTHER`. Reference and notes are optional.

`requestId` prevents duplicate records when retrying an interrupted submission. Retry with the **same ID and body** to retrieve the saved entry (HTTP 200); a first successful submission returns 201. Reusing the ID with different fields returns 409. Retrying a voided entry returns that voided entry, without recreating a payment. A genuinely new or replacement payment needs a new ID.

Common query fields: `q`, `tenantId`, `leaseId`, `propertyId`, `page`, `pageSize` (default 20, maximum 100). Unknown fields are rejected.

- Payment history also accepts optional `period`, `method`, and `state=RECORDED|VOIDED`. Omitting period returns all months.
- Rent balances accept `period` (defaults to the current UTC month) and `status=PAID|PARTIALLY_PAID|UNPAID|OVERDUE`.
- The backend obtains tenant, unit, and property from the lease. Those IDs and `companyId` are not accepted in payment bodies.

Payment writes and voids share the parent-property lock used by lease edits and termination. The outstanding balance is rechecked inside the transaction, so simultaneous submissions cannot overpay a month. Composite foreign keys enforce company ownership for charges, leases, and recorded/voiding users.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:integration
npm.cmd run test:e2e
```

Phase 5 adds 11 PostgreSQL integration tests and 2 browser tests. The complete suite has 8 baseline tests, 37 database integration tests, and 9 browser tests. Database tests create isolated schemas. Browser tests create uniquely named companies and delete only their own records afterward.

The main overview's financial analytics remain part of Phase 7. Phase 6 is maintenance requests.
