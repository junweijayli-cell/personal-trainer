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

Release and public-site verification will be recorded after deployment. The original dirty app checkout, billing, SMTP and database are preserved.
