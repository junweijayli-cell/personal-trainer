import { createHash } from 'node:crypto';
import { copyFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const campaign = resolve(process.argv[2] ?? '');
const root = resolve(import.meta.dirname, '..');
const approvedIds = [
  'band-row',
  'barbell-squat',
  'cable-chest-press',
  'dumbbell-floor-press',
  'dumbbell-rdl',
  'dumbbell-row',
  'glute-bridge',
  'goblet-squat',
  'incline-pushup',
  'kettlebell-deadlift',
  'lat-pulldown',
  'leg-press',
  'squat',
  'stability-ball-curl',
  'suspension-row',
];

if (!process.argv[2]) throw new Error('Pass the absolute high-resolution campaign directory.');

const evidencePath = join(root, 'docs', 'approved-exercise-videos.json');
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

for (const id of approvedIds) {
  const state = JSON.parse(readFileSync(join(campaign, id, 'state.json'), 'utf8'));
  const attempt = state.attempts.at(-1);
  if (attempt.status !== 'approved' || !attempt.review?.accepted) {
    throw new Error(`${id} is not approved in campaign state.`);
  }

  const source = join(campaign, id, `web-${attempt.attempt}.mp4`);
  const actualHash = digest(source);
  if (actualHash !== attempt.review_video_sha256) {
    throw new Error(`${id} release hash differs from campaign state.`);
  }

  const destination = join(root, 'public', 'exercises', 'videos', `${id}.mp4`);
  copyFileSync(source, destination);
  const installedHash = digest(destination);
  if (installedHash !== actualHash) throw new Error(`${id} copy verification failed.`);

  evidence[id] = {
    sha256: installedHash,
    review: attempt.review,
    settings: attempt.settings,
    sources: attempt.sources,
    workflow_sha256: attempt.workflow_sha256,
    actual_graph_sha256: attempt.actual_graph_sha256,
    prompt: attempt.graph['6'].inputs.prompt,
    models: {
      unet_name: attempt.graph['3'].inputs.unet_name,
      clip_name: attempt.graph['4'].inputs.clip_name,
      vae_name: attempt.graph['5'].inputs.vae_name,
    },
    elapsed_seconds: attempt.elapsed_seconds,
    execution_seconds: attempt.execution_seconds,
    bytes: statSync(destination).size,
    prompt_id: attempt.prompt_id,
    attempt: attempt.attempt,
    peak_gpu_memory_mib: attempt.peak_gpu_memory_mib,
    technical_checks: attempt.technical_checks,
    review_encoding: attempt.review_encoding,
    release_tier: '1152x1536-high-resolution',
  };
  console.log(`${id}: ${installedHash}`);
}

const ordered = Object.fromEntries(Object.entries(evidence).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(evidencePath, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(`Installed ${approvedIds.length} approved high-resolution videos.`);
