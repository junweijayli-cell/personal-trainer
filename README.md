# Relay Coach

Relay is a phone-first virtual personal trainer: open it, see today’s complete workout, learn each movement, and train with optional live camera guidance.

## Product capabilities

- A three-step phone setup that previews the plan, selects video or camera coaching, and checks the training space
- A focused 24-minute workout with six demonstrations animated by one consistent digital coach, plus reps, sets, rest, and form cues
- Optional on-device pose tracking, rep counting, joint-angle feedback, and voice cues
- Phone-first landing page with English and Chinese switching
- Email, password, six-digit verification, seven-day trial, and monthly/annual subscription demo
- Device-local workout history, daily wellness check-ins, goals, and weekly training schedule
- A responsive, installable mobile web app with camera processing that stays in the browser

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Camera access is optional; production camera access requires HTTPS.

## GitHub Pages demo

Every push to `main` builds and deploys the static application through `.github/workflows/pages.yml`.

The GitHub Pages build intentionally labels account verification as a demo. Static hosting cannot securely send email, store credentials, or process subscriptions. A real launch should replace the local demo adapter with a managed email-auth service and payment provider. See `QA_REPORT.md` for the tested journey and launch boundary.

## Quality checks

```bash
npm run db:generate
npm run build
npx eslint app db drizzle.config.ts
```

## Privacy and safety

Camera frames are processed locally and are never saved or uploaded by Relay. Only completed workout totals are stored. Movement feedback is an estimate from visible body landmarks, not medical advice or a substitute for a qualified coach or clinician.
