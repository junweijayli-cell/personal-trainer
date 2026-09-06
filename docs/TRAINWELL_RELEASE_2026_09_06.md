# TrainWell: name, typography, and pricing update

## Requested changes

- Product name: **TrainWell**, unchanged in English and Simplified Chinese.
- Global monthly subscription: **US$5 per month**.
- Global annual subscription: **US$30 per year**, 50% less than twelve monthly payments.
- Fix overlapping headings and check phone and desktop layouts in both languages.

## Implementation

Renamed the landing page, account and workout screens, camera copy, browser metadata, installation name, account-export filename, and email templates. Existing account/session keys and saved device preferences retain their historical identifiers so the rename does not sign users out or discard data. The GitHub repository and website address remain unchanged.

The global offer is defined once in `supabase/functions/_shared/billing-policy.ts`. Both UI labels and server validation use this policy. Checkout rejects inactive, wrong-amount, wrong-currency, wrong-interval, metered, tiered, adjustable, or quantity-transformed prices before creating a Stripe customer or payment session. Actual Stripe Price IDs remain backend secrets. Mainland annual prepaid pricing still requires separate approval; no currency conversion was invented.

Removed compressed heading line heights throughout landing, authentication, training, camera setup, history, account, and subscription layouts. Chinese receives appropriate font fallbacks, natural letter spacing, and larger line height. Long names, translated labels, price badges, and narrow headers reflow. Desktop navigation is now visible, and initial hydration no longer overwrites a saved Chinese language preference.

## Server-side changes verified

- TrainWell confirmation and recovery subjects and bilingual HTML were saved in the Supabase dashboard; previews showed the intended name and preserved verification placeholders.
- SMTP sender display name was changed to TrainWell. Existing Gmail address, host, port, username, and encrypted password were preserved. No new email test was sent for this copy-only update.
- Updated functions were deployed to the existing supplied Supabase project. No database migration, trial change, credential change, or payment activation was performed.
- The deployed billing catalog returns the expected 503 while Stripe is unconfigured; unauthenticated Checkout returns 401. These checks created no customer or payment.

## Visual asset

The existing link-preview graphic was edited with the built-in GPT image tool and saved as `public/og-trainwell.png`. The image-generation skill kept the change limited to the requested name; the existing palette, track illustration, and supporting copy were retained. The original graphic remains available but is no longer used by app metadata.

Final image prompt:

> Use case: text-localization. Asset type: existing fitness web app social-link preview. Edit target: the provided og.png. Primary request: rename the displayed product from RELAY to exact case-sensitive "TrainWell". Text (verbatim): "TrainWell", "YOUR NEXT RIGHT MOVE", "Train for real life." Change only the old large RELAY name to TrainWell, fitting it cleanly within the same text area. Preserve the off-white textured background, lime racetrack arcs, orange chevron, dark ink text, other wording, and wide composition. Do not redesign the brand or add elements. Spell T-r-a-i-n-W-e-l-l exactly, capital T and W, lowercase other letters. Keep the entire name clearly readable with generous margins, no cropping.

## Local verification

- Lint, TypeScript, and the optimized GitHub Pages static build passed.
- All 34 unit tests passed, including branding/storage compatibility and 18 pricing-policy cases.
- All 28 isolated layout tests passed at 360, 390, 430, and 1480 pixels in English and Chinese. Coverage includes landing/pricing, signup, sign-in, password recovery, today's workout, history, account, four-step workout preparation, movement guide/detail, and expired-trial pricing. Four detector self-tests distinguish actual overlapping glyphs from normal inline punctuation and emphasis.
- Captured 120 checkpoint screenshots. Representative phone and desktop screenshots were also visually inspected, including the Chinese landing headline from the reported issue. No overlapping text or horizontal overflow was detected in the tested screen/viewport combinations.
- Added Chinese-language persistence regression coverage and automated bilingual layout checks to the GitHub Pages release workflow. Local browser checks use isolated fixtures, not real customer accounts. Live camera hardware/pose accuracy and payment lifecycle behavior were not tested in this release.

## Release limits

Public signup remains paused pending CAPTCHA and staging acceptance. Gmail remains a temporary demonstration sender. Stripe credentials, the two actual recurring Prices, webhook/portal setup, and payment lifecycle tests are still required before charging customers. This update is not a production-launch approval, a 500-user load test, or completion of the remaining routine videos.
