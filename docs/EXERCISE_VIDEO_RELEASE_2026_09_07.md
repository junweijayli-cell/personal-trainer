# TrainWell approved exercise videos — September 7, 2026

This media update was rebased on September 8 onto current main revision `1e1506579f1d964d65c99ca60a51e0f8c0b4b5dd`. It adds 18 reviewed motion clips to the four existing videos, bringing available video coverage to **22 of 26 exercises**. The latest bilingual TrainWell branding, prices, signup protection, account services, public demo billing and deployment configuration are preserved.

New clips: glute bridge, bird dog, lat pulldown, dumbbell row, stability-ball curl, upper-trap stretch, forearm plank, goblet squat, dumbbell Romanian deadlift, resistance-band row, bench step-up, suspension row, stationary bike, dumbbell floor press, kettlebell deadlift, leg press, cable chest press and medicine-ball press.

Plank rotation, dead bug, chin tuck and side-neck isometric retain their photo demonstrations because their generated candidates did not pass review. Rejected candidates and intermediate media are excluded from this release.

The added files are silent H.264 MP4, 768 × 1024, 24 fps, `yuv420p`, CRF 19, with fast-start metadata. They total 13,216,893 bytes. The four original videos retain their original hashes. [Acceptance evidence](approved-exercise-videos.json) records source hashes, prompts, model filenames, seeds, settings, job IDs and specific visual-review decisions.

The exercise registry and media cache version are updated. A narrowly scoped viewer fix keeps the complete video inside the preview, lets the mobile container fit its video and controls, and makes the close button accessible above the tabs. The existing playback-error photo fallback and workout behavior remain in place.

## Validation

- Lint and all 160 unit tests pass on the September 8 base, including catalog mapping, file hashes and the four photo-only exercises.
- All 22 assets decode and advance in the browser at desktop and 360/390/430-pixel widths: 88 asset checks.
- Twelve workout-view checks pass across those widths: full framing and native controls, photo fallback, and exercise switching after a playback failure.
- All 60 current bilingual layout and account-switching checks pass using isolated local account fixtures.
- The 18 new files pass full FFmpeg decoding, accepted-hash, dimensions, duration, pixel-format, silent-stream and fast-start checks.
- Root-domain Cloudflare and GitHub Pages production builds pass. The Cloudflare static-export check confirms root asset paths and per-file size limits.

Run the media suite locally with `npx playwright test --config tests/media.playwright.config.ts`. To verify a deployed frontend, set `E2E_MEDIA_URL` to `https://trainwell.win` or `https://junweijayli-cell.github.io/personal-trainer` before running it. Account requests in this suite are intercepted locally; this verifies published frontend behavior, not a real signup or email journey.

Publishing follows the existing Git-connected Cloudflare Pages project and GitHub Pages workflow when this update reaches `main`. Production asset hashes and browser playback must be verified after those deployments complete. The pre-update main revision above remains available for rollback.

The existing 22-video set is also preserved in a separate, hash-verified local archive. One new 1152 × 1536 glute bridge test is being rendered in local ComfyUI at the user's request. That candidate is excluded from this release; further higher-resolution rendering and replacement await the user's review.
