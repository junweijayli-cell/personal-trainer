# Signup, legal notices, and domain follow-up — 2026-09-06

This follow-up supersedes the earlier report's paused-signup/CAPTCHA statements, not its outstanding commercial-launch gates.

## Causes and changes

- The deployed `NEXT_PUBLIC_SIGNUP_ENABLED=false` flag prevented the signup form from requesting any email. Protected preview signup is now enabled in Cloudflare and GitHub build configuration.
- Terms and Privacy were plain text with no document to open. Both now open keyboard-accessible bilingual dialogs from signup and the footer, preserving form values and focus. Agreement remains unchecked and explicitly required.
- Password recovery used to swallow all provider/network failures and claim an email was on its way. Failures now show an account-independent bilingual error; successful responses still do not disclose whether an account exists.
- Signup, sign-in, recovery, and resend require a fresh Turnstile token. Script load failures, challenge timeout, and retry have visible feedback. Compact challenges fit narrow forms.
- Supabase Auth now verifies Turnstile server-side. Email confirmation remains required. The previously configured Gmail SMTP sender is retained, not replaced or exposed.
- TrainWell is live at https://trainwell.win, with HTTPS and a query-preserving www redirect. Account return URLs and backend allowed origins include the new domain.

## Verification evidence

- 40 unit tests, lint, TypeScript, production static build and static-export checks passed.
- Six bilingual legal browser cases passed at 360, 390, and 430 pixels (18 screenshots).
- Eight mocked auth cases passed, including resend cooldown/fresh-token behavior, reset errors, blocked/expired security checks, and script retry. The separate disabled-signup case also passed.
- Cloudflare independently built the committed release, passed its checks, and published successfully.
- Actual-domain browser check opened Terms from signup and switched to Chinese. The live homepage video played with no video error and sufficient buffered data.
- Actual-domain HTTPS returned 200. `https://www.trainwell.win/?reset=1` returned 301 to the apex with its query intact. Legacy paths also preserved query strings.
- Backend CORS matches the new origin and does not grant a matching allow-origin header to an untrusted origin.
- A single intentionally invalid CAPTCHA probe returned `captcha_failed` before signup; it did not create a user or send an email.

Mocked tests and saved SMTP configuration do not prove delivery to an inbox. A fresh live email/OTP test after this release has not been completed; approval was requested for a single owner-email test rather than assuming permission to override the earlier staging-only plan. No load test or charge was performed.

## Remaining launch gates

Gmail is a temporary personal-mail sender, not a transactional-delivery guarantee. Complete staging OTP/recovery acceptance, sender-domain setup, monitoring and operations acceptance before advertising a production-ready service. Legal notices describe the preview; operator identity, final privacy/retention and commercial terms still require review. Profile limitations remain an optional profile field and should not contain medical diagnoses; wellness logs have a separate consent gate. Broader sensitive-data consent review remains outstanding. Stripe payment work remains paused and excluded from this release. Mainland-China availability has not been established by these overseas checks.
