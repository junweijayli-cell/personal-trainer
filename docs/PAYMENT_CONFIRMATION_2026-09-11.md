# Billing address and payment confirmation — 2026-09-11

The requested checkout improvement collects the full card billing address in Stripe and saves it to the Stripe customer. The app database does not receive that address. Daily, monthly and annual live subscriptions retain their existing amounts and renewal rules.

Successful Checkout returns to a bilingual thank-you screen with the verified amount and plan, training and invoice links, and support contact. A new authenticated, read-only `get-checkout-confirmation` function checks the Stripe session's owner, customer, live/test mode, payment status and approved Price. Membership access still comes from authoritative webhook reconciliation. A return URL alone grants no access. Delayed or failed verification offers a status retry, without another charge. Account changes and navigation discard pending responses and clear return parameters.

New checkout operations are versioned. An ambiguous legacy request is recovered with its original Stripe idempotency parameters before its open session is expired and replaced by an address-collecting session. Existing paid subscriptions and historical records remain untouched.

Validation before release: lint, TypeScript and all 179 unit/lifecycle tests passed locally. All 32 focused bilingual payment/browser checks passed across 360, 390, 430 and 1480 pixel widths, covering confirmed, pending, retry, return URL, refresh and sign-out behavior. Screenshots were inspected in English and Chinese.

Deploy only `get-checkout-confirmation` and `create-checkout-session` individually. No migration, SMTP update or blanket Supabase configuration push is required. Preserve the original dirty `app` checkout and all unrelated work.

## Published release and acceptance

- Implementation `fa1f3824f8be7c20a122ce3092bab291daf02af1`, merged through [PR #3](https://github.com/junweijayli-cell/personal-trainer/pull/3). Production code commit: `2dcd74a7ee98531b8a66c155bfcb11669cb95f6a`.
- [Release validation 34609937419](https://github.com/junweijayli-cell/personal-trainer/actions/runs/34609937419) passed lint, TypeScript, 179 unit/lifecycle tests, 84 bilingual layout checks, 8 authentication checks (one intentionally skipped), 6 legal checks and both hosting exports. The Cloudflare export passed the asset and secret scan. [Database checks 34609937355](https://github.com/junweijayli-cell/personal-trainer/actions/runs/34609937355) passed.
- Cloudflare production deployment `1f54fc48-a7ac-4ba4-829d-70c02fa8e67a` succeeded. [GitHub Pages build and deployment 34610415821](https://github.com/junweijayli-cell/personal-trainer/actions/runs/34610415821) succeeded, including the mobile suite and repeated release checks.
- Both affected Supabase functions were deployed individually. The read-only confirmation endpoint was deployed first, followed by the frontend and then the new Checkout creator. No subscription, Price, webhook, SMTP or runtime-mode changes were made.
- Live Stripe inspection verified the required billing-address setting, new success URL, correct USD amounts and day/month/year intervals for all three plans. The hosted live card form displayed address, address line 2, country and postal-code inputs. The deployed public Checkout endpoint was separately checked with an authenticated disposable account.
- The new receipt verifier was checked read-only against an existing completed live payment and returned a confirmed receipt. An actual unpaid disposable checkout returned pending; an invalid session was rejected. No new card charge or subscription was submitted during verification.
- Fresh mobile checks against both public sites verified the real authenticated pending-confirmation page in English and Chinese, status retry availability, preserved trial access and return-parameter cleanup. Confirmed receipts and delayed membership activation were covered by the isolated browser suite.
- All disposable open sessions were expired, and the unsubscribed disposable Stripe customer and Supabase account were removed. The temporary service-only `trainwell-payment-ux-check` function was deleted after validation. No account or credential steps remain for this change.

Start a fresh checkout from Account → Membership plans to see the full address form. Existing paid subscribers can continue using Account → Manage billing. Full billing addresses stay in Stripe, outside the app database.
