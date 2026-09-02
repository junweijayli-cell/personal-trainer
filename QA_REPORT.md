# Relay Coach production-foundation QA report

Date: 2026-09-02

## Completed verification

- Production Next.js static build: passed
- ESLint and TypeScript checks: passed
- Server-time membership/trial unit tests: 4 passed
- Mobile journeys at 360, 390, and 430 pixels: 9 passed
- Staging account tests: present and intentionally skipped until protected staging credentials are supplied
- Browser user review: landing page loaded, English and Chinese modes switched, signup modal opened, password and consent controls were present, and no browser errors or warnings were reported
- GitHub Pages base-path build: covered by the deployment workflow
- Database migrations and RLS pgTAP tests: automated in the database security workflow

## User journey covered by automation

1. Open the landing page on each supported phone width.
2. Switch from English to Chinese and confirm the translated account entry points.
3. Open the seven-day trial form.
4. Confirm name, email, strong-password, confirmation, consent, CAPTCHA, and six-digit verification surfaces.
5. Confirm that an unconfigured deployment cannot silently fall back to browser-only credentials.
6. With protected staging credentials, sign in to a real server-backed member account and open its plan.

## Security checks encoded in the product

- Trial dates are created only after email verification and compared using PostgreSQL server time.
- Clearing browser storage or changing a device clock cannot grant a second trial.
- Browser clients can only select `monthly` or `annual`; Price IDs and access durations are server-controlled.
- A Checkout return URL does not grant access. Only a signed Stripe webhook can change membership access.
- Webhook event IDs are persisted and duplicate delivery is idempotent.
- RLS tests cover cross-account profile and wellness access and membership write denial.
- Demo passwords, demo trial dates, and demo billing state are never imported.
- Password reset responses are generic to prevent account discovery.

## External tests required before accepting real customers

These checks require service accounts and cannot be truthfully completed in an unconfigured repository:

- deliver a real signup OTP and password-reset email through staging SMTP
- test incorrect, expired, reused, and rate-limited OTPs
- test second-device synchronization and deletion using a verified staging account
- complete Stripe monthly/annual lifecycle tests, webhook replay/out-of-order tests, and test-clock renewal/failure tests
- complete China Alipay asynchronous success/failure, prepaid renewal, and expiry tests
- run both regional k6 profiles at 500 concurrent users for 30 minutes
- restore a production-like backup into an isolated environment and document recovery time
- confirm Sentry, uptime, database, webhook, and backup alerts reach the operating team

No production claim should be made for an unchecked item above. Automated payments must remain in Stripe test mode until every applicable launch gate passes.
