# Mainland China deployment runbook

The China release is deliberately separate from the global account region. It uses the same application code, but has independent infrastructure, credentials, backups, email, monitoring, and customer records.

## Hard launch gates

Do not publish the mainland production domain until all of these are complete:

- Alibaba Cloud account and mainland operating entity or approved operating partner
- required ICP filing or commercial ICP licence determination
- PSB filing and required public footer information
- legal review of privacy, sensitive health consent, export/deletion, fitness disclaimer, cross-border boundaries, and Alipay/card terms
- approved `cn.<domain>`, TLS certificate, OSS bucket, CDN distribution, and WAF rules
- Alibaba DirectMail sender domain with SPF/DKIM
- disaster recovery owner and 24/7 incident contact

## Frontend

The manual `Build and publish Relay China frontend` workflow builds with `DEPLOY_TARGET=china`, uses the China Supabase endpoint and publishable key, and uploads `out/` to OSS. Configure its `china-production` environment with approval protection.

Required secrets:

- `CHINA_SUPABASE_URL`
- `CHINA_SUPABASE_PUBLISHABLE_KEY`
- `CHINA_CAPTCHA_SITE_KEY`
- `CHINA_SENTRY_DSN`
- `ALIBABA_OSS_ACCESS_KEY_ID`
- `ALIBABA_OSS_ACCESS_KEY_SECRET`

Required variables:

- `ALIBABA_OSS_REGION`
- `ALIBABA_OSS_ENDPOINT`
- `ALIBABA_OSS_BUCKET`

Use a deployment-only RAM role limited to the exact bucket and CDN purge actions. Do not reuse the Alibaba account owner key.

## Self-hosted Supabase

Deploy the official self-hosted Supabase Docker stack into a private VPC. Pin the repository commit and every image digest after staging validation; never track `latest`. Place Postgres and storage on encrypted persistent disks. Expose only the API gateway through the load balancer/WAF. Restrict SSH, database, metrics, and dashboard access to the operator network.

Apply `supabase/migrations` in sequence using a migration identity. Mount `supabase/functions` into the Edge Runtime functions volume. Configure GoTrue for six-digit confirmation OTP, the bilingual templates, Alibaba DirectMail SMTP, rate limits, CAPTCHA, the final site URL, and approved redirects.

The China environment needs independent server secrets:

- `APP_URL=https://cn.<domain>`
- `ALLOWED_ORIGINS=https://cn.<domain>`
- `APP_MARKET=cn`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_CN_ANNUAL`
- `STRIPE_CURRENCY_CN=cny`
- Supabase URL, anon key, and service-role key managed only on the China hosts

The annual Checkout function uses `mode=payment`, requests Alipay and eligible cards, and grants 365 days only after a verified success webhook. It does not represent Alipay as a recurring subscription.

## Operations

- Create encrypted daily database backups and copy them to a second mainland region/account.
- Test an isolated restore quarterly and record recovery time and data-loss window.
- Monitor database saturation, replication/backup failures, API p95, error percentage, SMTP delivery, WAF blocks, TLS expiry, Edge Function errors, and failed webhooks.
- Patch the operating system and reviewed Supabase images on a staged monthly cadence, with an emergency path for critical vulnerabilities.
- Mirror exercise images and future approved videos to OSS/CDN. Do not mirror user camera footage because it is not uploaded by default.
- Run `tests/load/relay.js` against the China catalog endpoint at 500 users for 30 minutes; require under 1% server errors and API p95 below 750 ms.
- Never automatically synchronize mainland user records to Singapore. A future support-assisted region migration requires separate legal and technical design.

## Release sequence

1. Validate a pinned self-hosted release in China staging.
2. Apply database migrations and deploy Edge Functions.
3. Complete Auth, DirectMail, Turnstile-equivalent CAPTCHA, Stripe test-mode, webhook, alert, and backup checks.
4. Run bilingual phone E2E, RLS tests, Alipay asynchronous payment cases, and the load profile.
5. Obtain legal/partner and operations sign-off.
6. Publish the static frontend to a versioned OSS prefix, promote it atomically, then purge only changed CDN assets.
