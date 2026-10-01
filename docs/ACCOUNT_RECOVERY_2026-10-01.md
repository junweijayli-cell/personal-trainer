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

Deployment commit and host results will be recorded after release verification. No credentials or usable access codes belong in this document.
