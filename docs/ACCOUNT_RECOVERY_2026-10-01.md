# Account recovery and access-code repair — 2026-10-01

## Incident and restoration

The existing Supabase project `yvcdlrnjhhafywawuknj` reported `INACTIVE`. Its pause notification was dated September 28. The static website continued to load, but account and recovery requests could not reach an active backend. Restoring the existing project through the Supabase Management API returned it to `ACTIVE_HEALTHY`; the owner's existing browser session then loaded successfully.

The owner account remains email-verified, has a password configured, and is not banned. No password/hash was retrieved or changed. The Gmail sender settings, confirmation requirement, CAPTCHA, redirects, and 60-second email interval were preserved. One owner-requested recovery email was accepted after restoration and visibly delivered in Gmail from `TrainWell / 悦练 <trainwell.win@gmail.com>` with the bilingual recovery subject. The owner must enter and submit any new password privately; inbox delivery is verified, while completion of the private password change is not yet confirmed.

Both public exports contain the existing Turnstile public site key. The backend still enforces Turnstile. The diagnostic recovery email used the authorized server-side recovery endpoint; it does not establish full public CAPTCHA/recovery acceptance.

## Changes

- Keep structured Supabase errors for sign-in, recovery, and password updates. Present safe bilingual distinctions between unavailable services, connection failures, invalid credentials, expired reset sessions, CAPTCHA failures, and rate limits. Never display raw provider details or reveal whether a recovery address exists.
- Correct access-code redemption to call its database RPC with the verified user's client. The former service-role call lost `auth.uid()` and incorrectly raised `Authentication required` for signed-in users. The previous diagnosis that this was an expired browser session was incorrect.
- Deploy only `redeem-promo-code`, with authentication still enforced by `authenticatedUser().auth.getUser()` and the database RPC. No migrations or blanket Supabase configuration push were needed.

## Acceptance

- Lint, TypeScript, 214 unit tests, and production export passed.
- English/Chinese browser authentication checks: 10 passed, 1 intentionally skipped (separate signup-disabled variant).
- Endpoint regression tests exercise the real redemption handler, ensure it uses the user client instead of the admin client, hash the code before the RPC, ignore an untrusted recipient field, and reject missing authentication.
- The previously generated one-code monthly batch was redeemed on the owner account. Database and live website confirm access from `2026-10-01T14:49:16.230153Z` to `2026-10-31T14:49:16.230153Z`, with no charge or renewal. A transient request timeout during backend recovery was retried with the same code; exactly one grant exists.

## Operations

The free Supabase project remains subject to inactivity pausing. For a continuously available paid application, review a paid Supabase plan with the owner; no upgrade or new recurring charge was authorized or made. No artificial keep-alive job was added. Restore the same project if paused and check `/auth/v1/health`, project status, and actual inbox delivery before assuming a password is incorrect.

## Release record

- Fix commit: `8a959574603b71b433082697f9a508a4b1c0d827`; reviewed and merged in [PR #9](https://github.com/junweijayli-cell/personal-trainer/pull/9).
- Production merge: `1e4d22efc145f7f718d6b6de2d478d6e26927a72`.
- PR validation and database checks passed before merge. The production database check also passed; the automatic backend workflow was skipped as configured because the affected function was deployed separately.
- Supabase `redeem-promo-code` version 3 is active. Anonymous redemption is rejected. Auth configuration, Stripe functions, existing subscriptions, and database migrations were not changed.
- Cloudflare Pages production deployment `82915dbd-4f8b-41bb-a6ea-7ef7e7c45156` succeeded. A fresh request to `https://trainwell.win/` returned HTTP 200, all nine referenced JavaScript files returned HTTP 200, and the deployed bundle contains the new account-service and credential feedback. A refreshed browser account page displayed the owner's monthly code membership.
- The initial GitHub Pages run stalled downloading Ubuntu packages from the runner's Azure mirror; its replacement attempt also downloaded dependencies slowly. Follow-up commit `2acde4926102afc424d67bb7d880540c51e5b2e1` switches that mirror entry to Ubuntu's main HTTPS archive and configures 30-second transport timeouts with two retries in the Pages and release-validation jobs. YAML parsing and whitespace checks passed; every application test remains in place.
- Cloudflare Pages also successfully deployed follow-up commit `2acde49` as deployment `b09eb464-8b01-4a42-9506-58ccfad6873f`.
- GitHub Pages [replacement production run](https://github.com/junweijayli-cell/personal-trainer/actions/runs/36883513168) succeeded, including lint, all 214 unit tests, mobile, bilingual layout, mocked authentication/recovery, legal dialogs, production export, and deployment. The mirror change completed dependency installation successfully.
- Final fresh requests to both `https://trainwell.win/` and `https://junweijayli-cell.github.io/personal-trainer/` returned HTTP 200. Each page's nine referenced JavaScript files returned HTTP 200, and both deployed bundles contain the new account-service and credential feedback.

The private password-change step remains unconfirmed. If the delivered recovery link expires, request a fresh email through Forgot password and have the owner enter and submit the new password privately. Do not infer a new password sign-in from an existing session being restored. No credentials or usable access codes belong in this document.
