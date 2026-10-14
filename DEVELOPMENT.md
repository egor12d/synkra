# SYNKRA — Development & Operations

[← Portfolio overview](README.md) · [English / Русский review guide](REVIEW.md)

## Local setup

Use Node.js 24 LTS (Node 22.13+ can run the application, but the backend test runner uses Node's built-in SQLite).

```powershell
npm ci
node scripts/init-local.mjs
node scripts/start-local.mjs
```

The local initializer copies `.dev.vars.example` only when `.dev.vars` is absent, and applies tracked Drizzle migrations to `.wrangler/state`. The starter opens on port 5174, or the PORT environment variable. Existing migration history and client data are preserved. The current development session may be on a different port if 3000 is occupied; use the URL printed by the server.

Set `BOOTSTRAP_ADMIN_EMAIL` in `.dev.vars` to your actual administration email before registering that account. Register with a real password, open `/api/dev/mailbox` on localhost, and follow the verification link. Only the matching, verified email becomes ADMIN. No public default password and no first-user administrator are provided. Client email confirmation is optional until EMAIL_API_URL, EMAIL_API_KEY and EMAIL_FROM are configured. REQUIRE_EMAIL_VERIFICATION=true or false explicitly overrides that default. Administrator bootstrap always requires actual verification, even in optional mode.

Repeated migration runs:

```powershell
node scripts/migrate-local.mjs
```

The supplied local Wrangler configuration is exclusively for local D1 migrations. Production binding configuration remains `.openai/hosting.json` and the generated hosting configuration. Databases previously populated by manually replaying SQL need their migration ledger reconciled before adopting tracked migrations; back up that database first.

Catalog seed initialization inserts source records into D1 in batches of fifty, with version markers and INSERT OR IGNORE. All API catalog reads, prices and statistics subsequently come from stored JSON records. Existing edits and deleted records survive deployment and reseeding. Future sample class sessions are added with date-specific IDs; historical bookings remain stored. No request creates database tables.

## Working flows

- Register, verify email, sign in, edit profile, change/reset password, export or close the account.
- Search and filter catalogs, inspect clubs on a geographic Ukraine map and save favorites.
- Build, schedule and edit workouts; record completed exercises, duration, calories and measurements.
- Plan meals by date and meal; save diary entries with servings and nutrition totals.
- Reserve a class with atomic capacity and duplicate checks; cancel a future reservation.
- Create a server-priced order, complete LiqPay checkout after merchant configuration, inspect a persisted membership and its generated QR card.
- Operate leads, staff notes, role assignments, tickets, content and CSV exports through the admin panel.

Roles are CLIENT, TRAINER, MANAGER and ADMIN. TRAINER currently has client capabilities. A MANAGER must be assigned `managedClubIds` by an ADMIN; orders, leads, clients, memberships and exports are restricted to those clubs. Managers cannot assign roles, modify catalog content or access central support/outbox data. ADMIN controls the whole operation.

## Environment

Copy the documented keys from `.dev.vars.example`. Keep credentials in local ignored files or the hosting platform's secret store, never in browser code.

| Variable | Purpose |
|---|---|
| APP_URL | Public HTTPS origin for email and payment callbacks |
| BOOTSTRAP_ADMIN_EMAIL | Explicit, email-verified initial administrator |
| REQUIRE_EMAIL_VERIFICATION | Optional owner override; true requires confirmation, false permits unverified client bookings/orders |
| EMAIL_API_URL / EMAIL_API_KEY / EMAIL_FROM | HTTP transactional email provider, using a Resend-compatible payload |
| LIQPAY_PUBLIC_KEY / LIQPAY_PRIVATE_KEY | Merchant checkout and callback credentials |
| LIQPAY_VERSION | 7 by default; 3 explicitly enables the legacy SHA1 protocol |
| PAYMENT_TOKEN_ENCRYPTION_KEY | Independent 32-byte Base64 AES-GCM key; generated once by local initialization, preserved across restarts |
| ALLOW_DEMO_PAYMENTS | Local test payment controls; public hosts always reject them |
| TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME / TELEGRAM_WEBHOOK_SECRET | Bot delivery, linking and authenticated incoming updates |
| CRON_SECRET | Bearer secret for an external scheduler |
| GOOGLE_MAPS_API_KEY | Optional, referrer-restricted public browser key; SVG map remains the fallback |
| GOOGLE_SHEETS_WEBHOOK_URL / GOOGLE_SHEETS_WEBHOOK_SECRET | Optional manual export integration |

For local mail, `/api/dev/mailbox` shows the actual queued messages and token links only on a loopback host. Worker runtimes use an HTTP email provider rather than SMTP. Essential authentication and financial messages are transactional; reminder settings are stored in the profile.

## Payment connection

Configure a LiqPay merchant account, its approved domain and the public HTTPS APP_URL. Version 7 signs checkout and callbacks with SHA3-256, implemented with portable `@noble/hashes`; version 3 uses the legacy SHA1 form. Reference: [LiqPay official request/signature documentation](https://www.liqpay.ua/doc/api/internet_acquiring/token?tab=0).

Callback URL: `/api/payments/webhook`. The server checks the signature, merchant key, version, action, currency, exact minor-unit amount and provider reference. A checkout redirect never activates a membership. Repeated callbacks cannot duplicate a membership; refunds revoke it. Only minimal technical payment metadata is retained, never card data or raw provider payloads.

Before selling a club, enter its genuine verified address/coordinates and confirm its partnership through admin content. City-center sample points cannot become verified clubs. Seed clubs/trainers are clearly marked examples, so live checkout and public booking for unconfirmed sessions are blocked. Demo payment success/failure/cancel/refund are available only when explicitly enabled on localhost, and every resulting order/membership remains labeled as a test.

## Saved cards and merchant launch

Cards are entered only in the official LiqPay hosted checkout/widget. SYNKRA rejects raw card number, PAN and CVV/CVC fields. Saving is an explicit client opt-in: the server records consent before adding `recurringbytoken: 1`. Only a matching signed successful callback may create a saved method. The bank token is AES-GCM encrypted with a per-token random IV and authenticated user/merchant context. The browser receives only method ID, brand, an actual last-four suffix when the provider supplies four digits, and the default flag. A provider mask exposing only two suffix digits results in `last4: null`; missing digits are never invented.

`node scripts/init-local.mjs` creates the encryption key once in ignored `.dev.vars` when absent or empty. A valid existing key is never rotated on restart; an invalid existing key stops initialization with a configuration error. Back up this key separately and preserve it when moving the database. For production, add that same key to the hosting secret store. Losing or replacing it makes existing saved methods unreadable; do not publish it or place it in client variables.

Clients can list/delete their own methods and choose a default. Deleting a method removes the encrypted token; replayed callbacks cannot resurrect it. Closing an account removes its saved methods. A saved-card purchase sends `action: paytoken`, the stored server-priced amount, the client's IP and `is_recurring: false` to the fixed official LiqPay API endpoint. It is a user-triggered payment, not automatic renewal. The gateway response never activates membership: the verified webhook remains authoritative. A durable per-order attempt prevents double-click charges and automatic retries after uncertain timeouts. Pending or 3DS-required states remain pending; only HTTPS redirects on LiqPay-owned hosts are exposed. Unsupported bank challenge forms are not manufactured, and checkout cannot silently start a second charge for an existing saved-card attempt.

Before a live launch:

1. Obtain and activate your own LiqPay merchant account and token-payment permission; the code cannot create or approve a merchant account.
2. Configure the approved public HTTPS domain in `APP_URL`, the matching merchant public/private keys, and the separate encryption secret in production hosting.
3. Apply the generated D1 migrations, including `0003_minor_cyclops.sql`; preserve the existing database and key.
4. Enter genuine partner clubs and verified addresses. Live checkout still requires confirmed partnership; the code does not automatically confirm seed records.
5. Validate normal payment, token opt-in, saved-card payment, 3DS/pending, duplicate callback, failure and refund using the merchant's permitted test setup before enabling actual sales.

Test payment endpoints default to disabled in both the sample and local environment. Existing marked test orders remain historical records; regression tests enable simulation explicitly. The automated suite uses a fake gateway and performs no external charge. No live bank transaction or merchant-specific 3DS flow has been acceptance-tested without your merchant account and domain. Official sources: [checkout/token issuance](https://www.liqpay.ua/doc/api/internet_acquiring/checkout?tab=0) and [token payment](https://www.liqpay.ua/doc/api/internet_acquiring/token?tab=0).

## Telegram and scheduling

Register an HTTPS Telegram webhook at `/api/telegram/webhook` with a secret token. Link the private chat using the cabinet's one-use, ten-minute `/start` link. Commands: `/profile`, `/membership`, `/schedule`, `/workouts`, `/unlink`, `/help`.

The Worker includes a fifteen-minute scheduled handler for membership expiry, reminder generation, expired-token cleanup and durable outbox delivery. Retain the cron trigger in production deployment. An ADMIN can also call `/api/admin/automation/run`; an external scheduler can POST `/api/automation/cron` using the CRON_SECRET Bearer header. Delivery retries five times and retains failures for review. See AUTOMATION.md for actual behavior and limits.

## Optional Google Sheets

Deploy `integrations/google-sheets.gs` as an Apps Script Web App under the spreadsheet owner's account. Set its Script Properties `SYNKRA_SECRET` and `SYNKRA_SPREADSHEET_ID`; configure the matching HTTPS webhook URL and secret in SYNKRA. An ADMIN can POST `/api/admin/export/google-sheets` with `{ "kind": "users" }`, `leads` or `orders`. The adapter exports current persisted data and checks the receiver's acknowledgement. This external integration requires your Google account and deployment; it has not been tested against a live Google account in this build. CSV download remains available without it.

## Validation and production build

```powershell
node node_modules/typescript/bin/tsc --noEmit
npm run lint
node --import ./scripts/windows-os-compat.mjs scripts/test-backend.mjs
node --test scripts/test-catalog.mjs
node --import ./scripts/windows-os-compat.mjs scripts/run-framework.mjs build
```

The optional Windows shim falls back only when a restricted sandbox blocks native `os.userInfo`; ordinary machines retain the native implementation. The backend suite runs the actual dispatcher and generated migrations using a D1-shaped wrapper over persistent SQLite. It checks 157 assertions including password security, role and club isolation, CSRF, token replay, restarts, ownership, capacity, payment signatures/amounts/idempotency/refunds, persistent catalog edits/deletion, CRM, tickets, QR, exports and account closure. It does not stand in for live provider acceptance tests. Actual Worker/browser checks and the final build status are recorded in IMPLEMENTATION_STATUS.md.

After a production build, the starter supports `npm start` for the built local Worker. Deploy through the configured hosting platform; do not publish `wrangler.local.json` as a live environment or ship `.dev.vars`, `.wrangler/state`, tests' local SQLite files or private secrets. Do not copy the local test-payment flag into production.

## Structure and launch inputs

`app/`, `components/`: pages/interface. `lib/catalog.ts`, `lib/geo.ts`, `lib/data/`: seed and map geography. `lib/server/`: authentication, domain API, commerce and automation. `db/schema.ts`, `drizzle/`: authoritative schema and generated migrations. `scripts/`: local lifecycle and verification. `build/sites-worker.ts`: hosting fetch/connector context and scheduled tasks.

Read ARCHITECTURE.md and AUTOMATION.md for invariants and limits. Software includes working local business processes and configurable external adapters. Commercial launch also requires genuine partner records, operational staff, legal/company/contact texts, domain/email setup and provider credentials. These inputs are not fabricated. No live bank transaction, Telegram bot or Google account connection is represented as already configured.

## Local owner access

Set BOOTSTRAP_ADMIN_EMAIL in ignored .dev.vars to an existing account and run Start-SYNKRA.cmd. The trusted local configure-local-admin.mjs command assigns ADMIN without changing the password or fabricating email verification. It also runs when the local server is already healthy. This operator command is not exposed over HTTP and does not run in hosted Workers; public registration bootstrap still requires actual verification. See Админка.md.
