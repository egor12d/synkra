# SYNKRA architecture

SYNKRA runs React and App Router routes on Vinext with a Cloudflare Worker. Persistent application data lives in D1 (SQLite), using a Drizzle schema and versioned generated SQL migrations. D1 replaces the originally proposed PostgreSQL/Redis stack to fit the hosting runtime. Browser storage is limited to interface preferences; accounts, sessions, workouts, food entries, payments, bookings and CRM records live on the server.

## Boundaries

`app/` defines pages and the catch-all API route. `components/` implements the Ukrainian interface. `lib/catalog.ts` contains seed inputs. A versioned initializer persists them into `content` in batches of fifty; catalog reads, prices and statistics subsequently use those stored JSON records. INSERT OR IGNORE preserves edits and deletion tombstones. Class seed IDs are date-specific. `lib/server/api.ts` validates requests with Zod and dispatches domain routes. `auth.ts` owns identity, `commerce.ts` owns orders and payment callbacks, `automation.ts` owns delivery and scheduled tasks, `store.ts` owns parameterized D1 access. `db/schema.ts` is the migration authority. `build/sites-worker.ts` preserves the hosting connector context and adds the scheduled handler.

## Identity and security

Passwords use WebCrypto PBKDF2-SHA256 with a random 256-bit salt and 100,000 iterations. Session cookies hold random opaque tokens; the database stores SHA-256 token hashes, expiry and user references. Production cookies are Secure, HttpOnly and SameSite=Lax. Session lifetime is 30 days. Email verification and password reset tokens expire, are hashed and consumed once. Resetting a password revokes existing sessions. Client email confirmation defaults to optional when no HTTP email provider is configured; REQUIRE_EMAIL_VERIFICATION=true/false overrides the policy. Booking and ordering read that policy without changing the actual verified flag. Authentication responses disclose delivery availability and local mailbox access; registration does not claim an email was sent until the outbox confirms delivery.

The default role is CLIENT. No first registrant becomes an administrator. A configured `BOOTSTRAP_ADMIN_EMAIL` becomes ADMIN only after proving ownership through email verification. ADMIN can grant roles to other verified accounts. MANAGER requires administrator-assigned managedClubIds and can operate only those clubs' CRM, clients, orders and memberships. Exports share that scope. MANAGER cannot change roles or catalogs, assign its own scope, or read central tickets/outbox data. TRAINER currently has client account capabilities; a separate trainer business console is not implemented. ADMIN cannot demote or delete their own active administrative account.

Writes require the application Origin. Payment, Telegram and cron callbacks have separate cryptographic or secret authentication. Database-backed request rate limits survive process restarts. SQL values are bound parameters. User-owned objects use ownership checks independently of their IDs. CSV values escape delimiters and spreadsheet formula prefixes.

## Principal entities

`users`, `sessions`, `tokens`, `rate_limits`; `favorites`, `workouts`, `workout_logs`, `progress`, `nutrition`; `class_sessions`, `bookings`; `leads`, `lead_notes`; `orders`, `payments`, `memberships`, `payment_methods`, `payment_attempts`; `notifications`, `outbox`; `tickets`, `ticket_replies`; `audit`, `content`, `telegram_updates`.

Foreign keys protect relationships. Unique constraints cover email, user/class booking, favorite identity, payment provider reference, membership/order and notification event keys. Indexes support user timelines, class capacity, CRM status and pending delivery. D1 batches provide transactional payment activation and registration. Capacity checks and booking insertion happen in a single SQL statement.

## Commerce

The browser submits a club and plan ID. The server determines the price and duration from the current catalog. Money is stored as integer minor units; currency is UAH. Orders cannot activate a membership from a checkout redirect. Only a verified callback or explicitly enabled loopback test payment can do so.

The LiqPay adapter uses version 7 and SHA3-256 according to current official documentation. Legacy version 3/SHA1 is explicitly configurable. The callback verifies the signature, public key, action, API version, currency, exact amount and provider reference. Sandbox callbacks are rejected as real payments. Successful callbacks create one membership per order, advance CRM and create durable notifications. Repeated callbacks cannot duplicate the membership. Refund callbacks revoke the membership. Live checkout requires a confirmed partner club and HTTPS APP_URL.

No real payment provider account or transaction is included. Seed clubs are examples and cannot be sold as verified live clubs. Production test payments remain blocked even when a mistakenly copied flag says true: loopback host verification is also required.

## Operational limits

The admin snapshot caps users at 200 and most business lists at 500, exposing truncation flags. CSV exports include the entire selected table. Admin event delivery uses reconnecting server-sent snapshots with a ten-second retry; it is not a WebSocket service. The scheduler runs every fifteen minutes. The outbox retries five times and then retains the error for staff review; it does not provide exactly-once delivery guarantees for providers without an idempotency API. Local delivery exposes emails only over loopback.

Closing an account removes personal working data and sessions and anonymizes its user/lead identity. Financial order/payment/membership records retain a pseudonymous user ID. Business owners must configure the applicable retention period and their own legal texts before real use.

This project does not contain PostgreSQL, SMTP, Redis, BullMQ, automatic Google Sheets background synchronization or a separate mobile app. CSV can be imported into a spreadsheet; an optional manual Apps Script export adapter is included and requires the owner's Google deployment and secret. Partner verification, genuine club/trainer records, business policy, domain, email and Telegram credentials are operational inputs; they cannot be truthfully synthesized from a software specification.
