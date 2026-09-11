# Billing address and payment confirmation — 2026-09-11

The requested checkout improvement collects the full card billing address in Stripe and saves it to the Stripe customer. The app database does not receive that address. Daily, monthly and annual live subscriptions retain their existing amounts and renewal rules.

Successful Checkout returns to a bilingual thank-you screen with the verified amount and plan, training and invoice links, and support contact. A new authenticated, read-only `get-checkout-confirmation` function checks the Stripe session's owner, customer, live/test mode, payment status and approved Price. Membership access still comes from authoritative webhook reconciliation. A return URL alone grants no access. Delayed or failed verification offers a status retry, without another charge. Account changes and navigation discard pending responses and clear return parameters.

New checkout operations are versioned. An ambiguous legacy request is recovered with its original Stripe idempotency parameters before its open session is expired and replaced by an address-collecting session. Existing paid subscriptions and historical records remain untouched.

Validation before release: lint, TypeScript and all 179 unit/lifecycle tests passed locally. All 32 focused bilingual payment/browser checks passed across 360, 390, 430 and 1480 pixel widths, covering confirmed, pending, retry, return URL, refresh and sign-out behavior. Screenshots were inspected in English and Chinese. Deployment and live verification results will be recorded below after rollout. No card charge is needed for this validation.

Deploy only `get-checkout-confirmation` and `create-checkout-session` individually. No migration, SMTP update or blanket Supabase configuration push is required. Preserve the original dirty `app` checkout and all unrelated work.
