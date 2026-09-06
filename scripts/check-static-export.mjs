import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const output = resolve('out');
const html = readFileSync(join(output, 'index.html'), 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"\s]+)"/g)]
  .map((match) => match[1])
  .filter((url) => url.startsWith('/') && !url.startsWith('//'));
assert(html.includes('https://trainwell.win/'), 'The canonical custom domain is missing.');
assert(!html.includes('/personal-trainer/_next/'), 'The export still uses GitHub subdirectory assets.');
for (const url of references) {
  const path = join(output, decodeURIComponent(url.split('?')[0]));
  assert(existsSync(path), `Missing exported asset: ${url}`);
}
for (const file of ['_headers', '_redirects', 'manifest.webmanifest']) {
  assert(existsSync(join(output, file)), `Missing deployment file: ${file}`);
}

let files = 0;
let bytes = 0;
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { scan(path); continue; }
    const size = statSync(path).size;
    assert(size <= 25 * 1024 * 1024, `Cloudflare's per-file limit is exceeded: ${entry.name}`);
    if (/\.(?:js|html|json|txt|map)$/.test(entry.name)) {
      const content = readFileSync(path, 'utf8');
      assert(!/(?:[sr]k_(?:live|test)_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{20,})/.test(content),
        'A server credential pattern was detected in the public export. Do not upload it.');
    }
    files += 1;
    bytes += size;
  }
}
scan(output);
console.log(JSON.stringify({ status: 'passed', rootAssetReferences: references.length, files, bytes }));
