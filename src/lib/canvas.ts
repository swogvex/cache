import canvasData from '../data/canvas.json';
import type { Artwork } from './artworks';

export interface CanvasItem {
  id: string;
  number: string;
  title: string | null;
  author: string | null;
  date: string | null;
  thumb: string;
  /** Tamaño de la miniatura en el mundo del canvas (px a zoom 1). */
  width: number;
  height: number;
  /** Centro de la miniatura en el mundo del canvas. */
  cx: number;
  cy: number;
}

export interface CanvasScene {
  items: CanvasItem[];
  /** Obras sin coordenadas (hay que ejecutar `pnpm embed`). */
  missing: string[];
}

const coords = canvasData as unknown as Record<string, readonly [number, number] | undefined>;

const TILE_AREA = 110 * 110;
const PER_ITEM = 170;
const MIN_WORLD = 700;
const MAX_WORLD = 3200;

const round = (n: number) => Math.round(n * 10) / 10;

export function buildCanvas(artworks: Artwork[]): CanvasScene {
  const placedCount = artworks.filter((artwork) => coords[artwork.id]).length;
  const world = Math.min(MAX_WORLD, Math.max(MIN_WORLD, Math.sqrt(placedCount) * PER_ITEM));
  const missing: string[] = [];

  const items = artworks.flatMap((artwork): CanvasItem[] => {
    const point = coords[artwork.id];
    if (!point) {
      missing.push(artwork.id);
      return [];
    }

    // Todas las miniaturas tienen la misma área, sea cual sea su proporción.
    const ratio = artwork.image.width / artwork.image.height;
    const width = Math.sqrt(TILE_AREA * ratio);

    return [
      {
        id: artwork.id,
        number: artwork.number,
        title: artwork.title,
        author: artwork.author,
        date: artwork.date,
        thumb: artwork.image.thumb,
        width: round(width),
        height: round(width / ratio),
        cx: round(point[0] * world),
        cy: round(point[1] * world),
      },
    ];
  });

  return { items, missing };
}
