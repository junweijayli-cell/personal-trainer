import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const outputDirectory = path.resolve('public/exercises/phase-guides');
await mkdir(outputDirectory, { recursive: true });

for (const entry of process.argv.slice(2)) {
  const separator = entry.lastIndexOf('|');
  if (separator < 1) throw new Error(`Invalid phase asset entry: ${entry}`);
  const source = entry.slice(0, separator);
  const filename = entry.slice(separator + 1);
  await sharp(source)
    .resize({ width: 720, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(outputDirectory, filename));
  process.stdout.write(`${filename}\n`);
}
