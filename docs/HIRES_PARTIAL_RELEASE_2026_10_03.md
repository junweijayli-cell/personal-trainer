# TrainWell partial high-resolution exercise-video release — October 3, 2026

This user-authorized partial release replaces **15 of the 22 deployed exercise videos** with visually approved 1152 × 1536 ComfyUI renders while preserving the latest guided timers, Annie/Lea coach voices, membership, payment-confirmation, and account-recovery behavior from pre-release `main` revision `b03599d35aa8ef14d3d17cf9edf827769fa794a4`.

High-resolution replacements: resistance-band row, Smith-machine squat, cable chest press, dumbbell floor press, dumbbell Romanian deadlift, dumbbell row, glute bridge, goblet squat, incline push-up, kettlebell deadlift, lat pulldown, leg press, bodyweight squat, stability-ball curl, and suspension row.

Each replacement is silent H.264 MP4, 1152 × 1536, 24 fps, 124 frames, `yuv420p`, CRF 19, fast-start enabled, fully decoded, hash-verified, and accepted after normal-speed playback plus intermediate-frame review. The updated [acceptance evidence](approved-exercise-videos.json) records hashes, model settings, prompts, source hashes, technical checks, and specific review notes.

This is intentionally a mixed-resolution partial release. Reverse lunge, bird dog, upper-trap stretch, forearm plank, bench step-up, stationary bike, and medicine-ball press retain their previously deployed videos. Plank rotation, dead bug, chin tuck, and side-neck isometric retain three-position photo demonstrations. Upper-trap high-resolution candidate 1 was excluded for prohibited zoom/reframing; chin-tuck remains excluded after three rejected candidates.

The registry therefore remains at 22 mapped videos across 26 exercises. The shared media-cache version is `20261003-hires-partial`, ensuring both root-domain and GitHub Pages clients fetch the new assets without removing the established fallbacks.

## Required validation

- Validate all 22 release MP4 files for decoding, dimensions, frame rate, codec, pixel format, and audio absence; verify the 15 new files for fast-start metadata and against their approved SHA-256 hashes. The inherited reverse-lunge fallback decodes normally but retains its existing non-fast-start container until its own approved replacement is available.
- Run lint, TypeScript, all unit tests, Cloudflare and GitHub Pages production builds, static-export checks, and the desktop plus 360/390/430 Playwright suites.
- Verify both deployed domains, including video downloads, playback progression, guide switching, photo fallback, reduced motion, inactive pausing, landing preview, guided timers, and coach audio.
