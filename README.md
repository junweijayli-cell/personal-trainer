# Relay Coach

Relay is a phone-first virtual personal trainer. The application recommends a complete workout, adapts it to available equipment and chosen body areas, shows each movement in full-body stages, records training and wellness progress, and can provide on-device camera guidance.

This repository now contains the production authentication, database, trial, billing, regional deployment, and test foundation. The former browser-only demo account system has been removed.

## Production architecture

| Market | Static frontend | Account and data region | Payments |
| --- | --- | --- | --- |
| Global | GitHub Pages | Managed Supabase, Singapore | Stripe monthly or annual subscription |
| Mainland China | Alibaba Cloud OSS/CDN | Self-hosted Supabase, Alibaba Cloud China | Stripe Checkout annual prepaid access with Alipay and eligible cards |

Accounts have one home region. The application does not automatically copy personal, health, or camera data between regions. Camera frames stay on the device by default; only workout scores and correction summaries are stored.

## What is implemented

- Email/password signup, six-digit email OTP verification, resend, sign-in, sign-out, session recovery, and password reset through Supabase Auth
- A seven-day trial created by a PostgreSQL trigger only after verified email, using database server time
- Server-backed profiles, preferences, plans, schedules, sessions, exercise logs, wellness logs, reminders, memberships, billing events, and billing audit records
- Row Level Security on every exposed table, with user-scoped policies and server-only billing writes
- Explicit health-data consent, JSON account export, account deletion, and a one-time import of safe device workout data
- Stripe-hosted Checkout and Customer Portal functions; verified and idempotent webhooks are the only source of access changes
- Global recurring monthly/annual plans and mainland annual prepaid access
- English and Simplified Chinese account, workout, validation, and billing experiences
- GitHub Pages, Supabase, and Alibaba OSS deployment workflows
- Mobile tests at 360, 390, and 430 pixels, server-time trial tests, database policy tests, staged account tests, and a 500-user regional API load test
- Sentry browser initialization with personal email removed from events

## Local development

Use Node.js 22 or newer.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Without Supabase public configuration, the product remains safely browsable but account creation is disabled and clearly labelled as unavailable.

To run a full local backend, install Docker and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), then run `supabase start` and `supabase db reset` from this directory.

## Quality checks

```bash
npm run lint
npm test
npm run build
npm run test:e2e:mobile
```

Database security is tested in GitHub Actions using `supabase/tests/database/rls.test.sql`. The optional staging account journey uses `E2E_ACCOUNT_EMAIL` and `E2E_ACCOUNT_PASSWORD`; keep both in protected CI secrets and never commit them.

For each regional backend, run the 30-minute load profile with k6:

```bash
k6 run -e RELAY_API_URL=https://REGION_PROJECT/functions/v1/get-billing-catalog tests/load/relay.js
```

## Launch configuration

The exact secret and dashboard checklist is in [docs/OPERATIONS.md](docs/OPERATIONS.md). At minimum, launch requires:

- a managed Supabase project in Singapore for global accounts
- a verified Resend sending domain and custom SMTP configured in Supabase Auth
- a Stripe merchant account, products, Prices, Customer Portal, and webhook endpoint
- GitHub Actions secrets for the public frontend and backend deployment
- for mainland China: an Alibaba Cloud account, operating partner review, ICP/PSB approval, OSS/CDN, DirectMail, and a hardened self-hosted Supabase environment

Until those external services and secrets are supplied, the repository is production-shaped but live signup, real email, payment, and mainland deployment cannot be activated.

## Privacy and safety

Relay provides fitness guidance, not medical diagnosis. Sensitive health logging requires separate consent. Users can export or delete their account data. Raw camera video is not uploaded by default, and movement feedback is an estimate rather than a substitute for a qualified coach or clinician.
