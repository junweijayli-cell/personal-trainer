# Guided workout partner — 2026-09-11

## Delivered behavior

Start today's workout, choose focus/equipment, complete the ready check, then press **Start set**. The guided session counts a three-second preparation, each paced rep, optional breaks between reps, side changes and prescribed rests between sets. Timed holds and bike intervals use their prescribed seconds. A visible session clock tracks time excluding pauses. Rest completion speaks a reminder and waits for **I'm ready** before beginning the next set.

The bilingual coach counts reps, offers encouragement, repeats each exercise's key cue and responds to requests to pause, continue, slow down or take more rest. The same requests work through buttons and optional single-command voice input. Voice recognition depends on browser support and microphone permission; failure leaves all button controls available. The page explains browser speech-provider processing and does not record or save transcripts. Spoken output uses device/browser English or Chinese voices with visible fallback cues.

Optional original instrumental gym music is synthesized on the device, with Energy/Focus styles, independent volume, voice ducking and mute. Music and timers pause when the page is hidden; input listening stops. Closing the session disposes the audio context and stops the microphone. Keep the page foregrounded while training, or resume explicitly after returning. No background alarm is promised for a locked phone.

Camera coaching remains available, shares the session timer and audio controls, and pauses its movement analysis with the session. Timed rep counts are labeled as pacing rather than camera detection. Completed sets and actual tracked time are shown in the summary. Ending early saves only completed sets; retrying an ambiguous save reuses a stable session ID instead of creating duplicate history.

## Acceptance evidence

- Lint, TypeScript and 194 unit/lifecycle tests passed locally, including new timer coverage for all phases, sides, holds, pause/drift, duplicate actions, partial summaries and English/Chinese commands.
- Focused browser checks passed for rep and rest timing, the spoken rest-finished cue, pause/resume, voice commands and permission-error fallback, completed-set saving/retry, and English/Chinese mobile layouts.
- A real browser AudioContext test measured nonzero music output, silence during pause, output after resume and a closed audio context after leaving. It does not merely assert that the music button changed state.
- Mobile screenshots were inspected and the timer is checked to be in the initial viewport. The existing video/guide layout was adjusted so it cannot cover the new clock.
- A complete planned session was exercised through the UI; the final set reached the summary once and immediately stopped active voice input.
- A disposable verified account tested the production database save policy. Repeated writes with one session ID retained a single original record and its completed-set count. The disposable account and training data were removed afterward.

Full release validation and production deployment identifiers will be recorded after rollout. This is a frontend-only release; no Stripe, SMTP, Supabase function or database migration changes are required. The original dirty `app` checkout remains untouched.
