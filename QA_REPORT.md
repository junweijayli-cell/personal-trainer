# Relay Coach launch-demo QA report

Date: 2026-09-02

## Test profile

- Phone viewport: 390 × 844
- Test identity: `victoryg•••@gmail.com` (masked for the public repository)
- Test password: generated only for the local demo and intentionally not recorded
- Account type: seven-day trial

## User journey tested

1. Opened the public landing experience on a phone-sized screen.
2. Switched English → Chinese → English.
3. Opened the seven-day trial form.
4. Entered name, email, password, password confirmation, and consent.
5. Generated and entered a six-digit demo verification code.
6. Reached the signed-in workout product with seven trial days remaining.
7. Signed out, then signed back in with the same local demo account.
8. Opened the member profile and confirmed trial status, training profile, and weekly schedule.
9. Built an equipment workout using a barbell rack and bench.
10. Advanced through the ready check into the full-body three-step movement guide.

## Feedback found and improvements applied

- Returning-user sign-in was hidden on small screens. The mobile header now keeps Sign in visible.
- Chinese mode still showed English units, workout metrics, muscle groups, and wellness labels. The primary training and health surfaces now translate these values.
- Entering a workout after scrolling left the page below the top of the coach image, which made the person look cropped. Every setup, exercise, and stage transition now returns to the top automatically.
- Account language previously referred to ChatGPT sign-in and cloud sync. It now accurately describes the GitHub demo and its on-device storage.
- Password requirements were easy to miss. The sign-up form now includes validation and a visible strength meter.
- Pricing is undecided. Monthly and annual plans clearly say “Price coming soon,” and the demo never presents a real charge.

## Production-readiness boundary

GitHub Pages is static hosting. It cannot securely send email, store password credentials, manage server-side trials, or charge subscriptions. The public demo therefore uses an explicit on-device verification simulator and hashes the demo password before local storage. It must not be treated as production authentication.

Before taking payments or onboarding real customers, connect a managed authentication and billing backend. Recommended minimum: Supabase Auth with email OTP, a database row for trial/subscription state, and Stripe Checkout with verified webhooks.
