# Annie and Lea coach voices — 2026-09-12

The owner selected audition A (Annie, English) and F (Lea, Mandarin). Both use HeyGen's speech endpoint at speed 0.88, matching the approved slower samples. This release replaces device speech synthesis with those recordings for the guided workout and camera coach.

## Voice pack and playback

- 134 mono MP3 recordings, approximately 2.52 MB total, cover shared coaching phrases, counts, camera prompts and all 26 exercise cues in both languages. Versioned files live under `public/audio/coach/20260912-af/`.
- `app/coach-voice-assets.json` records text, approved source voice, speed and SHA-256 for every shipped clip. `app/coach-voice-lines.json` contains shared spoken scripts. Generation results and original WAV files remain in ignored `work/natural-voices/`; they contain no application credentials. `scripts/prepare-coach-voices.mjs` converts those generation results using `FFMPEG_BIN` (or ffmpeg on PATH).
- Voice recordings load from the app's own hosting target with its correct base path. No user profile, workout data, or runtime text is sent to HeyGen. The app needs no HeyGen key and makes no per-workout generation requests.
- Counting clips preload before a voiced set starts. Silence is trimmed without changing speech pitch or the approved speaking speed. Late counts are dropped; they cannot replay out of order. Brief counts do not interrupt a conversational response. Pausing, language changes, microphone listening, voice mute and session exit invalidate old playback. Failed assets leave visible cues and a voice retry, without reverting to device speech.
- Countdown and rep speech use short number recordings; longer explanations remain in rest periods and coach responses. The summary speaks a fixed completion phrase while the screen retains the exact completed-set total. Music still softens during speech.
- The selected voice name appears above the session. Bilingual privacy copy explains hosted AI recordings and the separate optional browser speech-recognition service. Cloudflare's microphone policy now permits same-origin microphone use, allowing the existing explicit Talk to coach permission flow; geolocation remains disabled.

## Verification

- Lint, TypeScript and 202 unit/lifecycle tests passed locally. Voice tests cover every asset's approved voice and hash, all exercise mappings, base paths, music ducking, cancellation, language switching, delayed counts, mute/failure handling and slower response priority.
- Nine focused mobile browser checks passed, including native audio output for Annie and Lea, mute cancellation, timer/rest reminders, commands and both language layouts. Existing voice tests now observe recording playback rather than mocked device TTS.
- All 134 final MP3s decoded in Chrome and contained nonzero audio. Every 1–5 countdown clip fits below 0.98 seconds. Combined decoded duration is about 302 seconds. Mobile screenshots were inspected in both languages.

## Published release

- Implementation `a1ee9756f04bb424ac4d4eb3465a6926de4cacd5`, with explicit-resume improvement `2b891602fc4b45ae2a96994284b277721877ce77`, merged through [PR #5](https://github.com/junweijayli-cell/personal-trainer/pull/5). Production code commit: `bb1962a3e85a7b0244debeed4bec3da69c5b43ff`.
- [Release validation 34626680998](https://github.com/junweijayli-cell/personal-trainer/actions/runs/34626680998) passed lint, TypeScript, 202 unit/lifecycle tests, 124 layout/browser checks, 8 authentication checks (one intentionally skipped), 6 legal checks, both static builds and the Cloudflare export asset/secret scan.
- Cloudflare production deployment `e7172be7-2570-4b24-adfb-364426608cfd` succeeded. Live HTTP checks confirmed both language rest-finished recordings match the approved asset hashes, serve as audio/mpeg and carry immutable caching. The same-origin microphone policy is active.
- A fresh disposable verified account exercised `https://trainwell.win/` without application mocks: native Annie audio, rep timing, pause, Chinese/Lea playback after switching language, same-origin recording requests and exit all passed. Both mobile screenshots were inspected. The disposable account and training data were removed.

- [GitHub Pages deployment 34627347296](https://github.com/junweijayli-cell/personal-trainer/actions/runs/34627347296) succeeded after repeated release checks. The same fresh-account, native-audio flow passed on `https://junweijayli-cell.github.io/personal-trainer/`, including both approved voices, pause, language switching, local asset requests and exit. English/Chinese mobile screenshots were inspected and the disposable account and data were removed.

Both public sites are verified. The original dirty app checkout, billing, SMTP and database are preserved. No credential or account-verification steps remain for this release.
