# Guided workout partner — 2026-09-11

Update 2026-09-12: the device speech described below has been replaced by the owner's selected Annie (English) and Lea (Mandarin) recordings at a slower pace. See [Natural voices release](NATURAL_VOICES_2026-09-12.md) for current playback behavior and deployment evidence.

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

## Release and production verification

- Implementation commits `9a65c6c452fc002d0796adc156197ae2a6b175f4` and `6dd2ca1b6e8c075ee9777a04c3a7f475efc0b55f` merged through [PR #4](https://github.com/junweijayli-cell/personal-trainer/pull/4). Production code commit: `cb2e0b01f3d5d8a105b2a6d1f0734bda5733fb3a`.
- [Final release validation 34616848751](https://github.com/junweijayli-cell/personal-trainer/actions/runs/34616848751) passed lint, TypeScript, 194 unit/lifecycle tests, 116 bilingual layout and trainer checks, 8 authentication checks (one intentionally skipped), 6 legal checks and both hosting exports. The Cloudflare export passed the asset and secret scan.
- Native Chrome speech synthesis completed both English and Chinese spoken prompts. Installed voices and microphone recognition support vary by device; this does not claim universal browser microphone support.
- Cloudflare production deployment `387add7b-e330-47f9-9219-2c5a6c1e7d50` succeeded. A fresh, verified disposable account exercised the actual public site at `https://trainwell.win/`: initial timer visibility, start countdown into rep timing, music controls, frozen elapsed time during pause, English/Chinese mobile screens and clean exit. The temporary account and training data were removed, and both rendered screenshots were inspected.

- [GitHub Pages build and deployment 34617817188](https://github.com/junweijayli-cell/personal-trainer/actions/runs/34617817188) succeeded, including repeated unit, mobile, 116 layout, authentication and legal checks. The same fresh-account production flow passed at `https://junweijayli-cell.github.io/personal-trainer/`; English/Chinese mobile screenshots were inspected and the disposable account and data were removed.

This is a frontend-only release; no Stripe, SMTP, Supabase function or database migration changes were required. The original dirty `app` checkout remains untouched. There are no outstanding account steps for this release.

## Requirement audit

| Requested behavior | Evidence |
| --- | --- |
| Explicit session/set start | Existing session setup leads to the new Start set button; public browser check starts the countdown and enters rep timing. |
| Time each rep, breaks and total session | Pure clock tests cover rep pace, rep breaks, prescribed set rests, timed holds, sides and total elapsed time. Bilingual UI tests exercise the timer transitions and pause/resume. |
| Gym background music | Native AudioContext measurement proves output, silence during pause, resumed output and resource cleanup. Public mobile controls verified. |
| Spoken rest-finished reminders | Bilingual UI tests observe the actual reminder dispatched to speech synthesis after the rest boundary. Native browser voice playback independently completes in both languages. |
| Supportive two-way coaching | English/Chinese coach responses, slower pace, more rest, readiness, repeat cues and optional spoken commands are implemented. UI tests cover command dispatch and microphone-error fallback; unknown input requests a supported command. |
| Complete and save a workout | All planned sets reach summary exactly once and stop active listening. Save/retry UI tests retain one session ID; production database checks preserve a single original completed-set record on retry. |

Start from Today, complete the workout setup, then use **Start set**. Turn **Voice on** for spoken coaching and **Gym music on** for accompaniment. **Talk to coach** accepts a short command with microphone permission; the equivalent buttons remain available. Keep the page open while training: switching away pauses the session, and returning requires Resume.
