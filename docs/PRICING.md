# TrainWell pricing

## Approved global offer

| Plan | Currency | Recurring charge | Billing period |
| --- | --- | --- | --- |
| Monthly | USD | US$10 | One month |
| Annual | USD | US$60 | One year |

The annual plan saves US$60, or 50%, compared with twelve monthly payments (US$120). Both plans are recurring; users can cancel future renewal from Stripe Customer Portal. The seven-day free trial starts after email verification using server time, requires no payment method, and does not turn into a paid subscription without Checkout.

English and Simplified Chinese interfaces display `US$` so the currency is explicit. These USD prices apply only to the global market. Mainland China retains separately configured annual prepaid access for 365 days, with no automatic renewal; its amount and currency are not approved by this change and must not be inferred through a conversion.

## Implementation and activation

`supabase/functions/_shared/billing-policy.ts` is the single source for the published USD amounts and the server-side Price validation. Landing, paywall, and account membership copy reuse it through `app/pricing.ts`. The browser still sends only `monthly` or `annual`; actual Stripe Price IDs come only from backend secrets.

Stripe catalog retrieval and Checkout fail closed when configured Prices do not match the approved amount, USD currency, one-month/one-year interval, active status, and fixed licensed price structure. Price validation happens before customer/session creation. Mainland prices must be active fixed one-time Prices and do not inherit the global USD amount.

This code change does **not** create Stripe products or Prices, install credentials, activate Checkout, or make any charge. The local policy tests do not prove a Stripe payment has succeeded. Before payment activation, supply the eligible merchant account, real test-mode Price IDs and secret key, webhook signing secret, portal configuration, and approved tax setup; then deploy the changed Edge Functions and complete test-mode Checkout/webhook/renewal acceptance. Production remains gated on those steps.

The prior US$5/US$30 Prices are superseded for new checkout requests and fail the updated validator. Do not alter existing subscriptions implicitly; any price migration needs a separate review of webhook handling and customer notice. Existing test-mode Price IDs must be replaced with newly approved US$10/US$60 Prices before payment activation.
