import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES_DIR = process.env.IMAGES_DIR
  ? path.resolve(process.env.IMAGES_DIR)
  : path.join(ROOT, 'public', 'images');
const MANIFEST_FILE = path.join(ROOT, 'src', 'data', 'uploads.json');

const BUCKET = process.env.R2_BUCKET ?? 'cache-images';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CONTENT_TYPES = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.avif': 'image/avif',
};

const force = process.argv.includes('--force');
const withOriginals = process.argv.includes('--originals');

async function listFiles(dir, prefix) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && CONTENT_TYPES[path.extname(e.name).toLowerCase()])
    .map((e) => ({ key: `${prefix}${e.name}`, file: path.join(dir, e.name) }));
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function checkWrangler() {
  try {
    execSync('wrangler --version', { stdio: 'ignore' });
  } catch {
    throw new Error('Wrangler not found. Run: npm install -g wrangler && wrangler login');
  }
}

function put(key, file) {
  const type = CONTENT_TYPES[path.extname(file).toLowerCase()];
  execSync(
    `wrangler r2 object put "${BUCKET}/${key}" --file "${file}" --content-type "${type}" --cache-control "${CACHE_CONTROL}" --remote`,
    { stdio: 'inherit' },
  );
}

async function main() {
  checkWrangler();

  const targets = [
    ...(await listFiles(path.join(IMAGES_DIR, 'thumbs'), 'thumbs/')),
    ...(await listFiles(path.join(IMAGES_DIR, 'medium'), 'medium/')),
    ...(withOriginals ? await listFiles(IMAGES_DIR, 'originals/') : []),
  ];

  if (targets.length === 0) {
    console.log('Nothing to upload. Run "pnpm embed" first to generate the image variants.');
    return;
  }

  const manifest = await readManifest();
  let uploaded = 0;
  let skipped = 0;

  for (const { key, file } of targets) {
    const hash = createHash('sha1')
      .update(await readFile(file))
      .digest('hex');

    if (!force && manifest[key] === hash) {
      skipped++;
      continue;
    }

    console.log(`\n→ ${key}`);
    put(key, file);
    manifest[key] = hash;
    uploaded++;

    // Guardamos tras cada subida: si se interrumpe, no se repite lo ya subido.
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
    await writeFile(MANIFEST_FILE, JSON.stringify(sorted, null, 2) + '\n');
  }

  console.log(`\n✔ ${uploaded} uploaded, ${skipped} already up to date (bucket: ${BUCKET})`);
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  process.exit(1);
});