# TrainWell custom-domain deployment

Target: https://trainwell.win (canonical), with https://www.trainwell.win redirecting to it.
Source: https://github.com/junweijayli-cell/personal-trainer, branch `main`.
Hosting: Cloudflare Pages static export; accounts remain in the existing Supabase project.

## Build settings

- Git repository root: `/` (the repository itself is the application, not its parent local folder).
- Build command: `npm run lint && npm test && npm run build && node scripts/check-static-export.mjs`
- Output directory: `out`
- Node version: `22.19.0`
- `DEPLOY_TARGET=cloudflare-pages`
- `NEXT_PUBLIC_SITE_URL=https://trainwell.win`
- `NEXT_PUBLIC_SUPABASE_URL=https://yvcdlrnjhhafywawuknj.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: existing project's public publishable key only.
- `NEXT_PUBLIC_MARKET=global`
- `NEXT_PUBLIC_SIGNUP_ENABLED=true` for the protected preview after the 2026-09-06 signup fix; keep `false` on unconfigured deployments. Full staging/production acceptance remains a separate launch gate.
- Copy the public Turnstile site key and Sentry DSN only after those services are configured for this hostname.

Do not place Stripe, SMTP, database, service-role, or other secret keys in this static build or in GitHub source. Do not upload the old `out` build: its scripts were compiled with `/personal-trainer` as the base path. Cloudflare must build the new root-domain export from the reviewed commit.

Add both domains through Pages > Custom domains. Inspect existing DNS before accepting changes; preserve mail, domain-verification, and unrelated records. No paid plan or mainland hosting service is authorized by this deployment.

Cloudflare Pages `_redirects` only supports path sources, not host-level rules. Configure a zone Single Redirect named `TrainWell www to canonical domain`, matching `https://www.trainwell.win/*`, redirecting to `https://trainwell.win/${1}` with status 301 and **Preserve query string** enabled. Keep the legacy path redirects in `public/_redirects`.

### Completed domain cutover — 2026-09-06

- Git-connected Cloudflare Pages project `trainwell` deployed from main; both apex and www report Active / SSL enabled.
- `https://trainwell.win/` serves HTTP 200; HTTP upgrades to HTTPS. `https://www.trainwell.win/?reset=1` redirects 301 to `https://trainwell.win/?reset=1`.
- Supabase Site URL, four exact apex/www return URLs, backend `APP_URL`, and allowed origins updated. Legacy return URLs retained; SMTP/security settings were not overwritten.
- Follow-up signup fix configured a real Cloudflare Turnstile widget on the frontend and Supabase Auth. Its secret is backend-only; the public site key is provided to Cloudflare/GitHub builds. See `AUTH_SIGNUP_FIX_2026_09_06.md` for test boundaries.
- Public preview HTML and all 124 referenced/static assets passed HTTP/MIME checks; four MP4s have valid file signatures. Browser playback and account/email acceptance are separate checks.

## Backend cutover checklist

After the domain has a valid HTTPS deployment:

1. In Supabase Auth > URL Configuration, set Site URL to `https://trainwell.win/`, add the exact root and `?reset=1` redirect URLs listed in `supabase/config.toml`, and retain legacy URLs during transition.
2. Change only backend `APP_URL` to `https://trainwell.win` and append the apex/www origins to the existing allowed origins. Keep these values in Supabase's secret store even though the URLs are public.
3. Do **not** push the entire local Supabase configuration: that could overwrite the working Gmail SMTP credentials, templates, and security settings. Do not rotate or expose credentials during a domain cutover.
4. Verify CORS for the new domain and that a disallowed origin does not receive an allow-origin match. Verify the new-domain login/recovery flows separately; do not claim a live OTP test without actually delivering and verifying an email.
5. Future Stripe Checkout/Portal return URLs use backend `APP_URL`. The webhook remains on the Supabase hostname. Payments remain inactive until Stripe setup and acceptance tests are complete.

Signing in again is expected on the new origin. Supabase account data is unchanged; browser-only preferences and unsynced drafts do not automatically transfer from github.io to trainwell.win. Do not copy authentication tokens between origins.

## Global and mainland-China boundaries

Cloudflare global hosting is not the Cloudflare China Network. The Free plan does not include mainland points of presence. A successful overseas check cannot establish China availability. Test landing, exercise media, Supabase Auth/database requests, recovery email, and any CAPTCHA/payment dependencies from real mainland networks before representing this as a China-ready launch.

No mainland mirror, data migration, or cross-border synchronization is performed here. A dependable mainland deployment still needs the previously planned local infrastructure, operating-partner/compliance review, and applicable ICP/PSB filings. Existing global account data remains in the currently configured Mumbai Supabase project; it has **not** moved to Singapore or mainland China.

## Validation and rollback

- Run unit and mobile tests; build a fresh root-domain export.
- Confirm HTML, scripts, styles, installable-app manifest, exercise images/video, and on-device pose assets load at the root without `/personal-trainer` dependencies.
- Confirm HTTPS, www redirect, security headers, English/Chinese navigation, backend connectivity, and signup/payment launch gates.
- Preserve the previous deployment until the custom-domain release is verified. Use Cloudflare's previous successful deployment for later rollbacks; do not delete DNS or backend data as rollback.

References: [Cloudflare Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [China Network requirements](https://developers.cloudflare.com/china-network/get-started/), [GitHub Pages commercial-use restriction](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#pages).
