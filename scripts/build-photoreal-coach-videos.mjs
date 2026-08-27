import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const toolRoot = join(root, '.video-tools');
const sourceRoot = join(toolRoot, 'photoreal');
const rifeRoot = join(toolRoot, 'rife', 'rife-ncnn-vulkan-20221029-windows');
const rife = join(rifeRoot, 'rife-ncnn-vulkan.exe');
const ffmpegRoot = join(toolRoot, 'imageio_ffmpeg', 'binaries');
const ffmpeg = join(ffmpegRoot, readdirSync(ffmpegRoot).find((file) => file.startsWith('ffmpeg') && file.endsWith('.exe')));
const gpu = process.env.RIFE_GPU ?? '1';

const exercises = [
  { slug: 'squat', poster: 'squat-realistic.png', posterFrame: 2 },
  { slug: 'reverse-lunge', poster: 'reverse-lunge-realistic.png', posterFrame: 3 },
  { slug: 'incline-pushup', poster: 'incline-pushup-realistic.png', posterFrame: 2 },
  { slug: 'glute-bridge', poster: 'glute-bridge-realistic.png', posterFrame: 3 },
  { slug: 'plank-rotation', poster: 'plank-rotation-realistic.png', posterFrame: 3 },
  { slug: 'forearm-plank', poster: 'forearm-plank-realistic.png', posterFrame: 0 },
];

if (!existsSync(rife) || !existsSync(ffmpeg)) {
  throw new Error('Photoreal video tools are missing from .video-tools.');
}

for (const exercise of exercises) {
  const exerciseRoot = join(sourceRoot, exercise.slug);
  const grid = join(exerciseRoot, 'motion-grid.png');
  const keys = join(exerciseRoot, 'keys-final');
  const loopInput = join(exerciseRoot, 'loop-input-final');
  const frames = join(exerciseRoot, 'loop-frames-final');
  mkdirSync(keys, { recursive: true });
  mkdirSync(loopInput, { recursive: true });
  mkdirSync(frames, { recursive: true });

  const metadata = await sharp(grid).metadata();
  const cellWidth = Math.floor(metadata.width / 2);
  const cellHeight = Math.floor(metadata.height / 2);
  const outputWidth = cellWidth - (cellWidth % 2);
  const outputHeight = cellHeight - (cellHeight % 2);
  const cells = [[0, 0], [cellWidth, 0], [0, cellHeight], [cellWidth, cellHeight]];

  await Promise.all(cells.map(([left, top], index) => sharp(grid)
    .extract({ left, top, width: outputWidth, height: outputHeight })
    .png()
    .toFile(join(keys, `${String(index).padStart(2, '0')}.png`))));

  const loop = [0, 1, 2, 3, 2, 1, 0];
  loop.forEach((key, index) => copyFileSync(
    join(keys, `${String(key).padStart(2, '0')}.png`),
    join(loopInput, `${String(index).padStart(8, '0')}.png`),
  ));

  execFileSync(rife, [
    '-i', loopInput,
    '-o', frames,
    '-n', '91',
    '-m', 'rife-v4.6',
    '-g', gpu,
  ], { stdio: 'inherit' });

  const video = join(root, 'public', 'videos', `${exercise.slug}.mp4`);
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', '30',
    '-i', join(frames, '%08d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    video,
  ], { stdio: 'inherit' });

  copyFileSync(
    join(keys, `${String(exercise.posterFrame).padStart(2, '0')}.png`),
    join(root, 'public', 'exercises', exercise.poster),
  );
  console.log(`Built ${exercise.slug}`);
}
