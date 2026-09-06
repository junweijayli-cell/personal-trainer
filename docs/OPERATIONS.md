# Relay production operations

This runbook separates code that is already implemented from external service configuration that must be completed by an authorized operator. Use different Supabase, Stripe, SMTP, monitoring, and storage credentials for development, staging, and production.

## 1. Global account region

The original regional plan calls for Singapore. The user-supplied project `yvcdlrnjhhafywawuknj`, deployed on 2026-09-06, is in Mumbai (`ap-south-1`). Do not represent it as Singapore or mainland hosting. Changing database region requires a separately reviewed project migration. Do not reuse this database for mainland data residency. Keep deployment credentials in a password manager or the native CLI credential store.

Configure Auth as follows:

- Site URL: the final global app URL
- Redirect URLs: the final global app URL and staging URL, including their paths
- Email confirmation enabled
- OTP length: 6
- OTP expiry: 900 seconds
- Email resend minimum interval: 60 seconds
- Password minimum length: 10; enable leaked-password protection if available on the selected plan
- CAPTCHA: Cloudflare Turnstile for signup, sign-in, and password recovery
- Session refresh-token rotation enabled

Copy the bilingual HTML in `supabase/templates/confirmation.html` and `supabase/templates/recovery.html` into the corresponding Auth email templates. The confirmation template uses `{{ .Token }}` rather than a magic-link-only flow.

Configure verified Resend SMTP. Complete SPF and DKIM validation before sending production email. Supabase's default mail sender is not a production dependency.

Gmail SMTP is a temporary demo/testing option, not the production sending service. Enter its Google App Password directly into Supabase's server-side SMTP password field; never place it in source files, frontend configuration, GitHub Pages, or chat. Production sending still requires a suitable email provider and verified sending domain.

Supabase currently rejects custom email template changes on free projects using its default sender. Until custom SMTP is configured, CAPTCHA is active, and real email delivery and code verification pass staging acceptance, keep `NEXT_PUBLIC_SIGNUP_ENABLED=false` in GitHub; the app explains that email signup is being configured, while existing accounts can sign in. After configuring SMTP, update only the confirmation and recovery template subjects and HTML in the Auth email-template dashboard (or use a narrowly scoped Management API update of those template fields). Preserve the existing remote SMTP host, port, sender, username, and password. Do not run a blanket `supabase config push` for this step: the local configuration does not contain the operator's SMTP settings. Once these gates pass, set the signup flag to `true` and rebuild Pages. Do not disable email confirmation to bypass this gate.

The explicitly opted-in diagnostic `node scripts/smtp-email-smoke.mjs --project-ref yvcdlrnjhhafywawuknj --send-test-email --otp-loopback` sends one email to a unique owner-inbox alias. Set the authorized base Gmail inbox in `SMTP_TEST_INBOX` in the process environment; do not commit an operator's email or credentials. The script obtains credentials from the already-authenticated official CLI in memory, accepts the delivered code through a bounded one-use localhost endpoint, checks invalid/correct/reused codes and trial duration, then removes only its tagged disposable identity. Do not run it as an automatic job or load test. It does not replace staging acceptance, test password-reset delivery, or exercise the browser UI. Run its offline guards with `node scripts/smtp-email-smoke.test.mjs`.

## 2. Database and server functions

The `Deploy Relay Supabase backend` workflow applies reviewed migrations and deploys these functions:

- `create-checkout-session` — authenticated
- `create-customer-portal-session` — authenticated
- `get-billing-catalog` — public catalog only
- `delete-account` — authenticated
- `stripe-webhook` — public endpoint with Stripe signature verification

Set the GitHub repository variable `SUPABASE_DEPLOY_ENABLED=true` only after the production environment has approval protection. Add these production environment secrets:

| Secret | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | CLI deployment token |
| `SUPABASE_DB_PASSWORD` | migration connection |
| `SUPABASE_PROJECT_ID` | global project reference |

Set Edge Function secrets with `supabase secrets set` or the dashboard:

- `APP_URL`
- `ALLOWED_ORIGINS` — comma-separated origins only, without paths
- `APP_MARKET=global`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_ANNUAL`
- `STRIPE_CURRENCY_GLOBAL=usd`
- `SENTRY_DSN`

Supabase automatically provides its URL and service-role credentials to hosted Edge Functions. Never place service-role, database, Stripe, or SMTP secrets in `NEXT_PUBLIC_*` values.

## 3. Stripe test-mode configuration

Create one Relay product and two recurring Prices: monthly and annual. Put the Price IDs only in server secrets. Configure Customer Portal cancellation, payment-method updates, and invoice history.

Register the webhook endpoint at:

`https://PROJECT_REF.supabase.co/functions/v1/stripe-webhook`

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`
- `invoice.paid`
- `invoice.payment_failed`

Keep Stripe in test mode through acceptance. Test monthly and annual Checkout, cancellation, resubscription, failed renewal, duplicate/replayed webhook delivery, and out-of-order events. A Checkout success redirect never grants product access.

Enable Stripe Tax only after the legal entity, registrations, and launch countries are approved.

## 4. GitHub Pages frontend

Add these repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SIGNUP_ENABLED` — `false` until customer email delivery and templates pass acceptance
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`

Only the Supabase URL, publishable key, CAPTCHA site key, and public Sentry DSN are embedded in the static application. The Pages workflow runs lint, unit tests, and a production build before deployment.

The signup-readiness flag is a UI release gate, not a replacement for backend rate limiting, email confirmation, or CAPTCHA. Configure the latter before enabling public registration.

When a custom domain is available, point `app.<domain>` to GitHub Pages, update Supabase redirect URLs, `APP_URL`, `ALLOWED_ORIGINS`, Turnstile allowed hosts, and Stripe return URLs in one reviewed change.

## 5. Staging acceptance

Use the supplied test email only in staging. Store it as `E2E_ACCOUNT_EMAIL` and store its generated test password as `E2E_ACCOUNT_PASSWORD` in a protected environment. Do not commit either value.

Complete and record:

1. New signup and real six-digit OTP delivery.
2. Incorrect, expired, reused, and rate-limited OTP attempts.
3. Password reset with a generic response for both existing and nonexistent addresses.
4. Onboarding, workout completion, wellness consent and logging.
5. Second-device synchronization.
6. Trial expiry after exactly seven database-server days.
7. Export and deletion.
8. Stripe test-mode and test-clock lifecycle cases.
9. Cross-account RLS security tests.
10. 360, 390, and 430-pixel English and Chinese journeys.

## 6. Monitoring and recovery

Configure Sentry alerts for new releases and elevated error rates. Add external uptime checks for the global frontend, the catalog function, and an authenticated staging probe. Alert on failed `billing_events`, database CPU/storage/connection thresholds, SMTP rejection rate, backup failures, and certificate expiry.

Use Supabase point-in-time recovery or scheduled backups appropriate to the plan. Quarterly, restore a backup into an isolated project, verify row counts and authentication-linked profiles, and record recovery-point and recovery-time results. Retain the billing audit log according to the legal retention policy.

Do not send email addresses, raw health notes, camera images, access tokens, or Stripe secrets to Sentry or ordinary logs.

## 7. Mainland China release gate

Follow `deploy/china/README.md`. Do not enable `cn.<domain>` before the operating partner confirms the required ICP filing or licence, PSB filing, privacy notices, data residency, commercial payment model, and incident contacts.
