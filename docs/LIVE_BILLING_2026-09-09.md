# TrainWell live daily membership release — 2026-09-09

## Outcome

The user authorized a US$1 daily recurring plan and a switch from sandbox to real payments. Public billing is now `mode=live`, `checkout_enabled=true`, with US$1/day, US$10/month and US$60/year. No real charge was submitted during agent validation.

Code release: `6e5ee32e9a7d734a193a0c2e7f94d962c2602c07`, merged through [PR #2](https://github.com/junweijayli-cell/personal-trainer/pull/2). Implementation commits: `c6b033a`, `e705ed3`. The release includes the previous approved exercise-video commit `5df3c4e`; the original dirty `app` checkout was preserved.

Successful production deployments:

- Cloudflare/trainwell.win: `6c7e49f8-cacb-4b59-b10f-c010fbea7eba`.
- GitHub Pages: [run 34297512722](https://github.com/junweijayli-cell/personal-trainer/actions/runs/34297512722), build and deploy succeeded.
- Five affected Supabase functions deployed individually: `create-checkout-session`, `create-customer-portal-session`, `get-billing-catalog`, `delete-account`, `stripe-webhook`. No blanket configuration push; existing Gmail SMTP and auth templates were preserved. The GitHub Supabase job remains disabled; deployment used authenticated CLI access.
- Migration `202609090001_live_daily_billing.sql` applied successfully, then operator-only `activate_live_billing()` ran while checkout was disabled. Demo billing identities/operations were archived; trial dates were preserved. Test memberships were not promoted into real paid memberships.

## Live Stripe configuration

Account `acct_1UCbSA2NL4JCx8SY`, TrainWell. Server preflight verified `charges_enabled`, `payouts_enabled` and `details_submitted` are true. Support email remains `trainwell.win@gmail.com`.

Product: `prod_VDtz6ekWOGwqaV`, TrainWell / 悦练 membership.

| Plan | Recurring amount | Live Price ID |
| --- | --- | --- |
| Daily | US$1 every day until canceled | `price_1UDSBj2NL4JCx8SY5KNYgefl` |
| Monthly | US$10 every month until canceled | `price_1UDSFo2NL4JCx8SYaTcL3FJC` |
| Annual | US$60 every year until canceled | `price_1UDSLA2NL4JCx8SYKmnCn36M` |

Live API/signing credentials were privately entered by the user into `STRIPE_LIVE_SECRET_KEY` and `STRIPE_LIVE_WEBHOOK_SECRET`. The three `STRIPE_LIVE_PRICE_*` values were saved separately. All original test/historical Prices and credentials remain separate.

Live webhook: `we_1UDST12NL4JCx8SYX1MrcnXu`, named TrainWell live memberships. URL: `https://yvcdlrnjhhafywawuknj.supabase.co/functions/v1/stripe-webhook`. API version: `2026-08-26.dahlia`. Eight events: Checkout completed; subscription created, updated, deleted, paused and resumed; invoice paid and payment failed.

Live default billing portal: `bpc_1UDSWi2NL4JCx8SYGBwGy41V`. Invoice history, payment method updates and cancellation at the paid-period end are enabled. Plan/quantity switching is off. Bilingual header and return to the TrainWell account were verified on the actual live portal.

## Acceptance evidence

- 165 unit/lifecycle tests, lint, TypeScript and database integration passed. Coverage includes live daily retry/session reuse, plan changes, live/test isolation, period expiry, and archived-demo cutover, plus preserved concurrency, ownership, invoice and webhook protections.
- 60 bilingual layout checks, 8 authentication/recovery checks (one intentionally skipped), 6 legal-dialog checks and both export targets passed on PR head `e705ed3`. The production Pages workflow also passed its mobile checks and full build. Runs: `34255341471`, `34255341517`, `34297512722`, `34297512767`.
- A disposable verified account exercised actual live Checkout for all three plans. Stripe API inspection verified `livemode=true`, subscription mode, USD amounts 100/1000/6000 cents, correct Price IDs and day/month/year intervals. All sessions were unpaid and had no subscription. The daily page visually showed US$1.00 every day with no Sandbox badge.
- Temporarily added `checkout.session.expired` to the live endpoint, expired the unpaid daily session, then verified Stripe event `evt_1UDZtp2NL4JCx8SYVzFS7vH2` had `livemode=true` and `pending_webhooks=0`. This exercised the actual live Stripe signing secret and production receiver without charging a card. Restored the original eight-event selection afterward.
- Live customer portal opened successfully. Opening/canceling unpaid Checkout did not create paid access: entitlement retained the original seven-day trial and a null paid-period end.
- Every disposable open session was expired; the unsubscribed disposable Stripe customer and Supabase account were deleted. The operator-only temporary `trainwell-live-validation` function was deleted after validation.
- Both production deployments succeeded. Fresh trainwell.win Account → Membership plans displayed all three enabled buttons, English/Chinese prices, and automatic renewal wording. GitHub Pages displayed the three prices and existing preview video; Chinese pricing layout was visually checked.
- Public catalog verified after enabling: `market=global`, `mode=live`, `enabled=true`, daily USD100/day, monthly USD1000/month, annual USD6000/year (amounts in cents).

## Operational notes

The seven-day verified-email trial remains available without a card. Buying starts the paid period immediately; daily subscriptions renew every day until canceled through Account → Manage billing. Returning from a Checkout URL alone never grants membership; verified authoritative subscription state controls access.

For an incident, the service role may set `billing_runtime.checkout_enabled=false` without disabling existing training access. Do not switch back to test mode by editing the row: live customer/subscription records must remain distinct. The existing demo archive is private and retained for reconciliation.

No actual live card payment or live renewal was performed; completed payment/access and renewal behavior have automated lifecycle coverage, while live Checkout, account/price configuration, portal and signed delivery were exercised without a charge. The first genuine purchase remains a customer action. Mainland payment activation and tax configuration were not changed.

The local full-suite attempt exhausted available system memory; the complete suites passed on clean GitHub runners. Do not kill unrelated user processes to repeat those tests locally.
