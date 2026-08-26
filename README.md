# Relay Coach

Relay is a phone-first virtual personal trainer: open it, see today’s complete workout, learn each movement, and train with optional live camera guidance.

## Product capabilities

- A three-step phone setup that previews the plan, selects video or camera coaching, and checks the training space
- A focused 24-minute workout with six demonstrations animated by one consistent digital coach, plus reps, sets, rest, and form cues
- Optional on-device pose tracking, rep counting, joint-angle feedback, and voice cues
- Secure ChatGPT account sign-in using the visitor’s email-based account
- Account-bound workout history, daily wellness check-ins, goals, and weekly training schedule
- Water, sleep, meal quality, energy, and recovery notes stored in Cloudflare D1
- A responsive, installable mobile web app with camera processing that stays in the browser

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The local Sites runtime supplies a test identity and a local D1 database. Camera access is optional; production camera access requires HTTPS.

## Quality checks

```bash
npm run db:generate
npm run build
npx eslint app db drizzle.config.ts
```

## Privacy and safety

Camera frames are processed locally and are never saved or uploaded by Relay. Only completed workout totals are stored. Movement feedback is an estimate from visible body landmarks, not medical advice or a substitute for a qualified coach or clinician.
