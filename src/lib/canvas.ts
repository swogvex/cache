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
  /** Obras ubicadas automáticamente por no tener coordenadas generadas. */
  missing: string[];
}

const coords = canvasData as unknown as Record<string, readonly [number, number] | undefined>;

/** Área de cada miniatura (px² a zoom 1): todas igual, sea cual sea su proporción. */
const TILE_AREA = 110 * 110;
/** Separación mínima entre miniaturas (px a zoom 1). */
const GAP = 6;
/** Holgura inicial del mapa respecto al área total de las miniaturas. */
const SPREAD = 1.1;
/** Pasadas de compactado, con atracción hacia la posición original. */
const ITERATIONS = 400;
/** Fuerza con la que cada miniatura vuelve hacia su posición original por pasada. */
const PULL = 0.02;
/** Pasadas máximas del ajuste final sin atracción (garantiza cero solapes). */
const SETTLE_ITERATIONS = 400;

function fallbackPoint(id: string): readonly [number, number] {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  const x = (hash >>> 0) / 4294967296;
  hash = Math.imul(hash ^ 0x9e3779b9, 16777619);
  const y = (hash >>> 0) / 4294967296;
  return [0.04 + x * 0.92, 0.04 + y * 0.92];
}

interface Tile {
  artwork: Artwork;
  w: number;
  h: number;
  /** Posición original (proyección UMAP). */
  ax: number;
  ay: number;
  /** Posición actual. */
  x: number;
  y: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Separa las miniaturas que se solapan empujándolas por el eje de menor solape,
 * y las atrae hacia su posición original. Es determinista: mismo input, mismo mapa.
 */
function pack(tiles: Tile[]): void {
  const resolve = (pull: number): number => {
    let overlaps = 0;

    for (let i = 0; i < tiles.length; i++) {
      const a = tiles[i];
      if (!a) continue;

      for (let j = i + 1; j < tiles.length; j++) {
        const b = tiles[j];
        if (!b) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = (a.w + b.w) / 2 + GAP - Math.abs(dx);
        const overlapY = (a.h + b.h) / 2 + GAP - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        overlaps++;
        if (overlapX < overlapY) {
          const shift = (overlapX / 2) * (dx < 0 ? -1 : 1);
          a.x -= shift;
          b.x += shift;
        } else {
          const shift = (overlapY / 2) * (dy < 0 ? -1 : 1);
          a.y -= shift;
          b.y += shift;
        }
      }
    }

    if (pull > 0) {
      for (const tile of tiles) {
        tile.x += (tile.ax - tile.x) * pull;
        tile.y += (tile.ay - tile.y) * pull;
      }
    }

    return overlaps;
  };

  for (let i = 0; i < ITERATIONS; i++) resolve(PULL);

  let guard = 0;
  while (guard++ < SETTLE_ITERATIONS && resolve(0) > 0);
}

/** /images/foo.jpg → miniaturas y coordenadas ya vienen resueltas en `Artwork`. */
export function buildCanvas(artworks: Artwork[]): CanvasScene {
  const missing: string[] = [];
  const placed: { artwork: Artwork; point: readonly [number, number] }[] = [];

  for (const artwork of artworks) {
    const point = coords[artwork.id];
    if (!point) missing.push(artwork.id);
    placed.push({ artwork, point: point ?? fallbackPoint(artwork.id) });
  }

  // El mapa empieza compacto (área total ≈ área de las miniaturas) y se "descomprime" al separarlas.
  const span = Math.sqrt(artworks.length * TILE_AREA) * SPREAD;

  const tiles: Tile[] = placed.map(({ artwork, point }) => {
    const ratio = artwork.image.width / artwork.image.height;
    const w = Math.sqrt(TILE_AREA * ratio);
    const ax = point[0] * span;
    const ay = point[1] * span;
    return { artwork, w, h: w / ratio, ax, ay, x: ax, y: ay };
  });

  pack(tiles);

  const items = tiles.map((tile): CanvasItem => ({
    id: tile.artwork.id,
    number: tile.artwork.number,
    title: tile.artwork.title,
    author: tile.artwork.author,
    date: tile.artwork.date,
    thumb: tile.artwork.image.thumb,
    width: round(tile.w),
    height: round(tile.h),
    cx: round(tile.x),
    cy: round(tile.y),
  }));

  return { items, missing };
}
