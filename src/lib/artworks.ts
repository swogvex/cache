import { getCollection } from 'astro:content';
import { PUBLIC_IMAGES_BASE_URL } from 'astro:env/client';

export interface Artwork {
  id: string;
  number: string;
  title: string | null;
  author: string | null;
  date: string | null;
  image: {
    src: string;
    width: number;
    height: number;
  };
}

const base = PUBLIC_IMAGES_BASE_URL.replace(/\/+$/, '');

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
        src: `${base}/${entry.data.image}`,
        width: entry.data.width,
        height: entry.data.height,
      },
    }));
}