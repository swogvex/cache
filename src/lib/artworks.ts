import { getCollection } from 'astro:content';
import { PUBLIC_IMAGES_BASE_URL } from 'astro:env/client';

export interface Artwork {
  id: string;
  number: string;
  title: string | null;
  author: string | null;
  date: string | null;
  image: {
    /** Versión grande (WebP, 2000 px): lightbox y stage. */
    src: string;
    /** Miniatura (WebP, 512 px): preview junto al cursor y canvas. */
    thumb: string;
    width: number;
    height: number;
  };
}

const base = PUBLIC_IMAGES_BASE_URL.replace(/\/+$/, '');

const stem = (file: string) => file.replace(/\.[^./]+$/, '');
const variantUrl = (dir: 'thumbs' | 'medium', file: string) =>
  `${base}/${dir}/${stem(file)}.webp`;

export async function getArtworks(): Promise<Artwork[]> {
  const entries = await getCollection('artworks');

  return entries
    .sort(
      (a, b) =>
        a.data.added.getTime() - b.data.added.getTime() || a.id.localeCompare(b.id),
    )
    .map((entry, index) => ({
      id: entry.id,
      number: String(index + 1).padStart(3, '0'),
      title: entry.data.title ?? null,
      author: entry.data.author ?? null,
      date: entry.data.date ?? null,
      image: {
        src: variantUrl('medium', entry.data.image),
        thumb: variantUrl('thumbs', entry.data.image),
        width: entry.data.width,
        height: entry.data.height,
      },
    }));
}