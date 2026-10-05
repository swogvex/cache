import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import { access, copyFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_ROOT = path.join(ROOT, 'cache');
const CONTENT_DIR = path.join(APP_ROOT, 'src', 'content', 'artworks');
// Temporal hasta la v1.0: más adelante será la carpeta que subas a R2.
const IMAGES_DIR = path.join(APP_ROOT, 'public', 'images');
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const exists = (p) =>
  access(p).then(
    () => true,
    () => false,
  );

const clean = (s) =>
  s
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim();

const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

async function uniqueSlug(base, ext) {
  let slug = base;
  let n = 2;
  while (
    (await exists(path.join(CONTENT_DIR, `${slug}.md`))) ||
    (await exists(path.join(IMAGES_DIR, `${slug}${ext}`)))
  ) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const input = argv[2]
      ? clean(argv.slice(2).join(' '))
      : clean(await rl.question('Image path: '));

    const src = path.resolve(input);
    if (!(await exists(src))) throw new Error(`File not found: ${src}`);

    const srcExt = path.extname(src).toLowerCase();
    if (!ALLOWED.has(srcExt)) {
      throw new Error(`Unsupported format "${srcExt}". Use: ${[...ALLOWED].join(', ')}`);
    }
    const ext = srcExt === '.jpeg' ? '.jpg' : srcExt;

    const meta = await sharp(src).metadata();
    let { width, height } = meta;
    if (!width || !height) throw new Error('Could not read the image dimensions.');
    // Las orientaciones EXIF 5-8 giran la imagen 90°: intercambiamos ancho y alto.
    if (meta.orientation && meta.orientation >= 5) [width, height] = [height, width];

    const title = (await rl.question('Title (Enter to skip): ')).trim();
    const author = (await rl.question('Author (Enter to skip): ')).trim();
    const date = (
      await rl.question('Date, e.g. 1903 / 1903-05-12 / c. 1977 (Enter to skip): ')
    ).trim();

    const base = slugify(title) || slugify(path.basename(src, path.extname(src))) || 'artwork';
    const slug = await uniqueSlug(base, ext);
    const imageName = `${slug}${ext}`;

    // JSON.stringify genera cadenas YAML válidas (acentos, comillas, dos puntos...).
    const lines = ['---'];
    if (title) lines.push(`title: ${JSON.stringify(title)}`);
    if (author) lines.push(`author: ${JSON.stringify(author)}`);
    if (date) lines.push(`date: ${JSON.stringify(date)}`);
    lines.push(
      `added: ${new Date().toISOString()}`,
      `image: ${imageName}`,
      `width: ${width}`,
      `height: ${height}`,
      '---',
      '',
    );

    await copyFile(src, path.join(IMAGES_DIR, imageName), constants.COPYFILE_EXCL);
    await writeFile(path.join(CONTENT_DIR, `${slug}.md`), lines.join('\n'), { flag: 'wx' });

    console.log(`\n✔ Created src/content/artworks/${slug}.md`);
    console.log(`✔ Copied image to public/images/${imageName} (${width}×${height})`);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  exit(1);
});
