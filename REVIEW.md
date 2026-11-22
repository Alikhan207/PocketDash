# Validation report

## Fixed

- Unified private authentication on Clerk; removed local password handling and mock authentication/data paths.
- Added isolated fictional demo workspaces, signed expiring demo cookies and server ownership checks.
- Corrected Next.js 15 asynchronous route parameters and client dynamic route access.
- Added initial PostgreSQL migration and composite uniqueness/consistency constraints.
- Corrected payment retry conflicts, form key reset, outstanding-balance updates and cash refresh after recording payments.
- Connected invoice editing to a real transactional save, added automatic invoice numbers, and displayed drafts/cancelled invoices in the invoice list.
- Connected customer phone to WhatsApp drafts, normalized Indian 10-digit numbers and saved edited reminder content before marking it sent.
- Added print/save-PDF action and invoice-only print styles.
- Centralized financial calculations for forecasts and alerts, excluding future actual receipts, drafts/cancellations and unscheduled collections.
- Connected 15-day what-if controls and both chart series, with reset that never changes invoice/payment data.
- Corrected forecast breakdown structure, INR displays, opening-balance form numeric values and expense category types.
- Reworked Today dashboard, navigation, readable typography and consistent dark theme; collections show real invoice balances and days overdue.

## Checks completed

8 calculation tests passed: 15-day delay, partial payments, cutoff dates, unscheduled invoices, overdue/paid bills, forecast horizons, zero/missing balance and Kolkata date rollover.

Production build and TypeScript checks passed. Small later integration/UI fixes were made; a final full build has not been repeated since.

14 database/API checkpoints passed against a fresh PostgreSQL instance:
1. Initial migration and database constraints.
2. Signed-out records rejected.
3. Demo sessions receive distinct owners and shops.
4. Cross-seller reads and writes rejected.
5. Cash baseline, five unscheduled invoices and delayed scenario without invoice mutation.
6. All 30/60/90-day forecast horizons.
7. Customer creation and automatically numbered itemised draft.
8. Persistent invoice edits and recalculated totals.
9. Advance payment, idempotent replay, conflicting replay, overpayment and future-date checks.
10. Final payment updates invoice status and cash.
11. Reminder draft creation, edit and explicit mark sent.
12. Bill settlement deducts actual cash.
13. Paired opening-balance validation, zero and same-day movements.
14. Database rejects an unpaired opening balance.

## Not verified / limitations

- Visual/mobile rendering, browser printing and clipboard behavior have not been verified in a real browser.
- Live Clerk sign-in, password recovery and webhook delivery require the owner's configured Clerk application and keys.
- No live deployment was performed.
- Existing real data was not migrated. Use a fresh database for this build.
- No load/concurrency stress test was completed. Serializable payment transactions and unique retry keys are in place.
- Not every rule or screen has been exhaustively verified.
