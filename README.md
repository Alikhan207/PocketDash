# PocketDash

A back office for a student selling printed T-shirts and crochet gifts. Customers, invoices, manual payment records, reminder drafts and 30/60/90-day cash forecasts.

## Start here (Windows, macOS or Linux)

1. Open the `PocketDash` folder in Codebenders.
2. Install Node.js 22 LTS and run `npm ci` in its terminal.
3. Copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`).
4. Set `DATABASE_URL` for a PostgreSQL database. If you use Docker Desktop, `docker compose up -d db` starts the local database matching the example URL.
5. Generate the demo signing secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste it into `AUTH_SECRET`. Keep `ENABLE_DEMO=true` to try the app without Clerk.
6. Run `npm run db:deploy`, then `npm run dev`.
7. Open http://localhost:3000 and click **Try the demo**. Each browser session gets its own fictional shop, customers and invoices.

Credentials, `node_modules` and build output are not committed. The first install downloads dependencies. Do not enable `MOCK_MODE`.

## Private seller accounts — Clerk

Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the same Clerk application, enable email/password authentication and verification in Clerk, and restart the app. Private sign-up/sign-in/password recovery and profile changes use Clerk's components. The local seller and shop are created from the verified Clerk identity, never from an identity supplied in a request body. Private records have ownership checks on the server.

For profile updates and account-deletion synchronization, configure Clerk events `user.updated` and `user.deleted` at `/api/webhooks/clerk` and set `CLERK_WEBHOOK_SIGNING_SECRET`. Do not paste secret keys into source files or commit `.env`. Live Clerk sign-in and webhook delivery still need verification with your own keys.

## Demo walkthrough

The sample shop is **Thread & Bloom**. It starts with ₹8,000 cash, a ₹6,000 campus order collectible in three days, five overdue unscheduled invoices, a ₹10,000 printer bill in five days and a later ₹500 restock bill.

- Today shows balances, overdue customers and linked actions.
- Invoices: create an itemised draft, edit it, issue it, and record an advance or final payment. Drafts and cancelled invoices are excluded from receivables/forecast.
- Invoice detail: create/edit/copy a reminder; open WhatsApp when a phone number exists; explicitly record it as sent after you send it. Copy/open does not mark it sent.
- **Print / Save PDF** opens the browser print dialog. Select **Save as PDF**. The print stylesheet includes only the invoice.
- Cash forecast: compare 30, 60 and 90 days. Delay TB-1001 by 15 days: minimum cash falls to −₹2,000. Reset leaves the real invoice unchanged.
- Give overdue invoices an expected date to move them from the unscheduled list into the dated forecast.
- Add bills and record their paid dates. Settings controls shop details and opening cash.

## Cash rules

The opening balance is cash at the **start** of its effective date. Transactions before that date are already included; recorded receipts and bill payments on or after that date, through today, are counted once. Dates use Asia/Kolkata calendar days. Money calculations use integer paise or database decimals.

Forecast cash = available cash + scheduled outstanding invoice collections − unpaid bills. Missed collection dates are unscheduled until updated. Overdue bills count today unless revised. Same-day movements are netted; intraday cash timing is not modelled. Only entered records are included; these are estimates, not bank verification or AI predictions.

Recorded payments are immutable in this MVP. Review their amounts/dates before saving; payment corrections/refunds are not included. Bills support one full settlement. There are no bank integrations, automatic WhatsApp messages or marketplace/checkout.

## Database migrations

`npm run db:deploy` installs the included fresh-database migration. It includes per-shop invoice-number uniqueness, per-invoice payment-key uniqueness, paired opening balance/date constraints and payment-date/status checks.

Use a **new database** for this corrected build. The original archive had no migration history, and private existing records were not available for a safe data migration. Do not run the initial migration over an existing populated schema. Back up existing data and plan its migration separately.

## Deployment

Use a Node-compatible Next.js host and a persistent PostgreSQL database. Configure environment variables, run the migration once, build with `npm run build`, then run `npm start`. The Clerk public key must be present at build time as well as runtime. Enable HTTPS in production (the demo cookie is secure in production). Keep the public repository free of secrets. No live deployment was created during this review.

## Validation

See `REVIEW.md` for validation results and known limitations. Commands:

- `npm test` — 8 cash/date calculation tests.
- `npm run typecheck` — TypeScript validation.
- `npm run build` — production build.
- `npm run test:integration` — starts an isolated disposable PostgreSQL instance and local app, then exercises API workflows. Uses port 55433 for its database and 3100 for the app; requires supported local PostgreSQL binaries. It does not touch your configured application database.
