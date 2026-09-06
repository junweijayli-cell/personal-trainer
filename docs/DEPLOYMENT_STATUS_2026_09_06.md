# Relay deployment and routine-media audit — 2026-09-06

## Hosting

- Frontend: https://junweijayli-cell.github.io/personal-trainer/
- Backend: Supabase project `yvcdlrnjhhafywawuknj`, Mumbai (`ap-south-1`). This is the project supplied by the owner; it is not the Singapore region from the original plan.
- Migration `202609020001_production_foundation.sql` is applied and recorded in Supabase migration history.
- Eleven public tables are protected by row-level security. Personal tables restrict access to the authenticated owner; billing events and the billing audit log have no direct client access.
- Five Edge Functions are deployed: account deletion, billing catalog, checkout creation, customer portal creation, and Stripe webhook.
- Core authentication settings are deployed: email confirmation, six-digit OTP, 15-minute expiry, 60-second resend interval, ten-character minimum password, refresh-token rotation, and GitHub Pages redirects. Existing TOTP configuration was preserved.
- GitHub receives only public Supabase configuration. Backend secret/service credentials are not embedded in the website or committed.

## Not yet launch-ready

1. **Customer email delivery:** the owner saved temporary Gmail SMTP on 2026-09-06. A fresh dashboard load confirmed custom SMTP enabled at `smtp.gmail.com:465`; confirmation and recovery templates were then saved through template-only updates, preserving the SMTP settings. A limited real-delivery/code check passed. Production Resend/domain setup is still pending. Email confirmation has not been disabled. Public signup remains explicitly paused with `NEXT_PUBLIC_SIGNUP_ENABLED=false` pending CAPTCHA and staging acceptance; existing-account sign-in remains available.
2. **Staging acceptance:** a limited SMTP delivery check reached the owner's Gmail inbox from the configured Gmail sender, with readable English and Chinese content. The delivered code verified its disposable account; incorrect and reused codes were rejected, and trial duration was exactly seven server-calculated days. This is not staging acceptance or a full browser signup test. Resend, recovery delivery, expired-code waiting, rate-limit behavior, and the complete staging journey still need acceptance. Mocked UI tests are not evidence of delivered email.
3. **Payments:** Stripe credentials, approved prices, portal configuration, and webhook registration are absent. Prepared functions do not mean billing is active; no charges were made.
4. **Launch operations:** CAPTCHA, monitoring, backup/restore acceptance, staging isolation, final legal/privacy review, and the planned regional load test are still pending. No 500-user load test was performed against this free project.
5. **Automated backend deployment:** the existing GitHub backend workflow remains gated. The first deployment used the locally authenticated official Supabase CLI; database/service secrets were not uploaded to GitHub.

## Routine videos: 4 of 26 complete

All four active MP4s are published, return HTTP 200 with `video/mp4`, and match local file sizes:

- Bodyweight squat
- Incline push-up
- Reverse lunge
- Barbell back squat

The other 22 routines use the automatic three-image guide at 1.4 seconds per frame. All 78 phase images are present. Automatic image switching is not an actual generated movement video.

Missing videos: glute bridge, plank rotation, forearm plank, bird dog, dead bug, goblet squat, dumbbell RDL, dumbbell floor press, dumbbell row, band row, bench step-up, kettlebell deadlift, lat pulldown, leg press, cable chest press, suspension row, stability-ball curl, medicine-ball press, stationary bike, chin tuck, side neck isometric, and upper-trap stretch.

The app identifies the four active videos as Higgsfield assets. The inspected ComfyUI output directory contained no routine videos; its latest log contained startup/cache messages only, and no ComfyUI/Python process was running. There is no evidence that the requested ComfyUI routine batch finished. Six older RIFE/Blender MP4s remain as unused legacy assets. No video generation was started during this deployment audit.

## Improvements made while connecting the backend

- Password recovery can return to sign-in rather than trapping the user in its modal.
- Email resend has a countdown and obtains a fresh CAPTCHA challenge.
- Expired memberships retain access to account export and deletion.
- Export reads all nine user-readable account tables with pagination, including older workouts and wellness records.
- Starting a workout rechecks membership access with the server.
- Email-setup status is explained in English and Simplified Chinese.

## Verification record

- Lint, TypeScript/production build, and 13 unit tests passed locally.
- Four isolated browser regression scenarios passed for bilingual password recovery, fresh CAPTCHA resends, and signup-readiness messaging. These used mocked email/backend responses.
- Live API smoke test passed all 12 check groups (44 requests): unverified-account lockout, exactly seven server-calculated trial days, trial idempotency across sessions, profile/equipment/plan/schedule/workout storage, wellness consent, second-client synchronization, cross-account read/write denial, client billing mutation denial, expiry protection, and the deployed deletion function. Both disposable accounts and their data were removed. This did not send emails, perform a browser signup, or test payments.
- The smoke script's three credential/target guard tests passed. It accepts keys over stdin, never prints them, and refuses any other project or a run without explicit disposable-account opt-in.
- The first one-email SMTP check reached the inbox but stopped because the command runner closed stdin before code entry. Its uniquely tagged disposable account was removed automatically; this attempt did not verify a code or establish trial acceptance.
- The corrected SMTP check passed four groups (seven API requests): incorrect-code rejection, delivered six-digit code verification, exactly seven server-calculated trial days, and reused-code rejection. Two test emails total were delivered across the initial and corrected runs; both uniquely tagged disposable accounts and their cascading data were permanently removed. No existing user account was changed. Recovery delivery, resend, elapsed expiry, payments, full browser E2E, and load behavior were not tested by this check.
- Four local SMTP-script guard tests passed for recipient validation, exact-project opt-in, one-use loopback input restrictions, and strict code validation. The loopback receiver holds input only in memory, binds only to `127.0.0.1`, rejects browser-origin requests, and closes after receipt or timeout. The recipient is supplied through the process environment, not committed. Service credentials, account passwords, and codes are not committed or printed by the script. Lint and the existing 13 unit tests also passed after the email setup work.
- GitHub Pages runs its own mobile checks and production build before publishing these changes; inspect the commit's workflow run for the final release result.
