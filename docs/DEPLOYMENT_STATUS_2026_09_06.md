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

1. **Customer email delivery:** custom SMTP and a verified sender domain are missing. Supabase rejected the bilingual custom templates because the free project still uses its default mail provider. The templates remain in the repository, ready to apply after SMTP setup. Email confirmation has not been disabled. Public signup is explicitly paused with `NEXT_PUBLIC_SIGNUP_ENABLED=false`, and existing-account sign-in remains available.
2. **Real inbox testing:** signup email delivery, code entry, resend, and recovery delivery need a separate staging email test after SMTP setup. Mocked UI tests are not evidence of delivered email.
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
- GitHub Pages runs its own mobile checks and production build before publishing these changes; inspect the commit's workflow run for the final release result.
