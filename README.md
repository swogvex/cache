# Cache

Art gallery built with Astro, React and TypeScript. Images live in Cloudflare R2 (`covers.swogvex.dev`); the site is deployed on Vercel.

## Add an artwork

```powershell
pnpm new "C:\path\to\artwork.jpg"   # creates the .md and copies the image
pnpm embed                          # thumbnails, medium size, canvas map
pnpm upload                         # sends new images to R2
git add .
git commit -m "add: artwork"
git push                            # Vercel deploys automatically
```

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local dev server (images from `public/images`) |
| `pnpm check` | Type check |
| `pnpm build` | Production build |
| `pnpm new` | New artwork from an image |
| `pnpm embed` | Image variants + CLIP embeddings + canvas layout |
| `pnpm upload` | Upload variants to R2 (`--originals`, `--force`) |

## Environment

`PUBLIC_IMAGES_BASE_URL` — base URL of the images. Default `/images` (local). Production: `https://covers.swogvex.dev`.

Never overwrite an image with the same file name (assets are cached for a year): rename it instead.