import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import sharp from 'sharp';
import umapPkg from 'umap-js';

const { UMAP } = umapPkg;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_ROOT = path.join(ROOT, 'cache');
const CONTENT_DIR = path.join(APP_ROOT, 'src', 'content', 'artworks');
// Carpeta local con las imágenes originales (por defecto, la de pruebas).
const IMAGES_DIR = process.env.IMAGES_DIR
  ? path.resolve(process.env.IMAGES_DIR)
  : path.join(APP_ROOT, 'public', 'images');
const THUMBS_DIR = path.join(IMAGES_DIR, 'thumbs');
const DATA_DIR = path.join(APP_ROOT, 'src', 'data');
const CANVAS_FILE = path.join(DATA_DIR, 'canvas.json');
const CACHE_FILE = path.join(DATA_DIR, 'embeddings.json');

const MODEL = 'Xenova/clip-vit-base-patch32';
const THUMB_SIZE = 512;
const PADDING = 0.04;
const VALID_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  );

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const round = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(vector) {
  const norm = Math.hypot(...vector) || 1;
  return vector.map((v) => v / norm);
}

function cosineDistance(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, 1 - dot);
}

async function loadWorks() {
  const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith('.md')).sort();
  const works = [];

  for (const file of files) {
    const id = path.basename(file, '.md');
    if (!VALID_ID.test(id)) {
      console.warn(
        `! Skipping "${file}": use lowercase letters, numbers and hyphens in the file name.`,
      );
      continue;
    }
    const { data } = matter(await readFile(path.join(CONTENT_DIR, file), 'utf8'));
    if (typeof data.image !== 'string' || !data.image) {
      console.warn(`! Skipping "${file}": missing "image" field.`);
      continue;
    }
    works.push({ id, image: data.image });
  }
  return works;
}

async function ensureThumb(imageFile) {
  const src = path.join(IMAGES_DIR, imageFile);
  const out = path.join(THUMBS_DIR, `${path.parse(imageFile).name}.webp`);
  const [srcStat, outStat] = await Promise.all([stat(src), stat(out).catch(() => null)]);
  if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) return false;

  await sharp(src)
    .rotate()
    .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(out);
  return true;
}

let embedder = null;

async function getEmbedder() {
  if (embedder) return embedder;

  const { AutoProcessor, CLIPVisionModelWithProjection, RawImage } =
    await import('@huggingface/transformers');
  console.log('Loading CLIP model (the first run downloads it and can take a few minutes)...');
  const processor = await AutoProcessor.from_pretrained(MODEL);
  const model = await CLIPVisionModelWithProjection.from_pretrained(MODEL);

  embedder = async (file) => {
    const { data, info } = await sharp(file)
      .rotate()
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const image = new RawImage(new Uint8ClampedArray(data), info.width, info.height, info.channels);
    const inputs = await processor(image);
    const { image_embeds } = await model(inputs);
    return Array.from(image_embeds.data);
  };
  return embedder;
}

function layout(vectors) {
  const n = vectors.length;
  if (n === 0) return [];
  if (n === 1) return [[0.5, 0.5]];
  if (n < 5) {
    return vectors.map((_, i) => {
      const angle = (i / n) * Math.PI * 2;
      return [0.5 + 0.3 * Math.cos(angle), 0.5 + 0.3 * Math.sin(angle)];
    });
  }

  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: Math.min(15, n - 1),
    minDist: 0.25,
    spread: 1,
    random: mulberry32(42),
    distanceFn: cosineDistance,
  });
  return umap.fit(vectors);
}

function toUnitSquare(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const rangeX = Math.max(...xs) - minX;
  const rangeY = Math.max(...ys) - minY;
  const scale = Math.max(rangeX, rangeY) || 1;
  const offsetX = (1 - rangeX / scale) / 2;
  const offsetY = (1 - rangeY / scale) / 2;
  const inner = 1 - 2 * PADDING;

  return points.map(([x, y]) => [
    round(PADDING + ((x - minX) / scale + offsetX) * inner, 4),
    round(PADDING + ((y - minY) / scale + offsetY) * inner, 4),
  ]);
}

async function main() {
  await mkdir(THUMBS_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  const works = await loadWorks();
  const cache = await readJson(CACHE_FILE, { model: MODEL, entries: {} });
  const previous = cache.model === MODEL ? cache.entries : {};
  const entries = {};
  let embedded = 0;
  let reused = 0;
  let thumbs = 0;

  for (const work of works) {
    const src = path.join(IMAGES_DIR, work.image);
    const cached = previous[work.id];

    if (!(await exists(src))) {
      if (cached) {
        entries[work.id] = cached;
        reused++;
        console.warn(`! "${work.image}" not found locally, using cached embedding for ${work.id}.`);
      } else {
        console.warn(`! "${work.image}" not found in ${IMAGES_DIR}, skipping ${work.id}.`);
      }
      continue;
    }

    if (await ensureThumb(work.image)) thumbs++;

    const hash = createHash('sha1')
      .update(await readFile(src))
      .digest('hex');

    if (cached && cached.hash === hash) {
      entries[work.id] = cached;
      reused++;
      continue;
    }

    const embed = await getEmbedder();
    const vector = normalize(await embed(src)).map((v) => round(v, 5));
    entries[work.id] = { hash, vector };
    embedded++;
    console.log(`  embedded ${work.id}`);
  }

  const ids = Object.keys(entries).sort();
  const points = toUnitSquare(layout(ids.map((id) => entries[id].vector)));
  const canvas = Object.fromEntries(ids.map((id, i) => [id, points[i]]));

  await writeFile(CANVAS_FILE, JSON.stringify(canvas, null, 2) + '\n');
  await writeFile(
    CACHE_FILE,
    JSON.stringify({
      model: MODEL,
      entries: Object.fromEntries(ids.map((id) => [id, entries[id]])),
    }),
  );

  console.log(
    `\n✔ ${ids.length} artworks mapped (${embedded} new, ${reused} cached, ${thumbs} thumbnails created)`,
  );
  if (ids.length > 0 && ids.length < 5) {
    console.log(
      '  Tip: with fewer than 5 artworks they are placed in a circle; add more for a real map.',
    );
  }
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  process.exit(1);
});
