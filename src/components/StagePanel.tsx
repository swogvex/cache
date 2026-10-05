import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import type { Artwork } from '../lib/artworks';
import { preload } from '../lib/preload';
import { fitToGrid } from '../lib/stage-grid';
import { $activeId } from '../stores/gallery';

interface Props {
  artworks: Artwork[];
}

interface Metrics {
  width: number;
  height: number;
  gap: number;
}

const STAGE_COLUMNS = 7;
const RESERVE_ROWS = 5; // espacio inferior para el pie
const MIN_ROWS = 12;

function readPx(name: string, fallback: number): number {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

export default function StagePanel({ artworks }: Props) {
  const activeId = useStore($activeId);
  const ref = useRef<HTMLElement>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  // Medimos el panel y calculamos la altura del stage en múltiplos de fila.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth;
      if (width === 0) {
        setMetrics(null);
        return;
      }

      const rowHeight = readPx('--row-h', 24);
      const gap = readPx('--col-gap', 16);
      const paddingTop = parseFloat(getComputedStyle(el).paddingTop) || 0;
      const available = el.clientHeight - paddingTop - RESERVE_ROWS * rowHeight;
      const rows = Math.max(MIN_ROWS, Math.floor(available / rowHeight));
      const height = rows * rowHeight;

      setMetrics((prev) =>
        prev && prev.width === width && prev.height === height && prev.gap === gap
          ? prev
          : { width, height, gap },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Precarga de las obras vecinas.
  useEffect(() => {
    if (!activeId) return;
    const index = artworks.findIndex((item) => item.id === activeId);
    if (index === -1) return;
    for (const neighbor of [artworks[index - 1], artworks[index + 1]]) {
      if (neighbor) preload(neighbor.image.src);
    }
  }, [activeId, artworks]);

  const artwork = activeId ? (artworks.find((item) => item.id === activeId) ?? null) : null;

  const fit =
    artwork && metrics
      ? fitToGrid(artwork.image.width / artwork.image.height, {
          ...metrics,
          columns: STAGE_COLUMNS,
        })
      : null;

  return (
    <aside ref={ref} className="stage" aria-label="Artwork preview">
      {metrics && (
        <div className="stage-box" style={{ height: metrics.height }}>
          {artwork && fit && (
            <figure
              key={artwork.id}
              className="stage-figure"
              style={{
                gridColumn: `1 / span ${fit.columns}`,
                justifySelf: fit.fitHeight ? 'start' : undefined,
              }}
            >
              <img
                src={artwork.image.src}
                width={artwork.image.width}
                height={artwork.image.height}
                alt=""
                decoding="async"
                style={fit.fitHeight ? { width: 'auto', height: metrics.height } : undefined}
                ref={(el) => {
                  if (el?.complete && el.naturalWidth > 0) el.dataset.loaded = 'true';
                }}
                onLoad={(event) => {
                  event.currentTarget.dataset.loaded = 'true';
                }}
              />
              <figcaption className="stage-caption">
                <span className="num">{artwork.number}</span>
                {artwork.title && <strong>{artwork.title}</strong>}
                {artwork.author && <span>{artwork.author}</span>}
                {artwork.date && <span className="date">{artwork.date}</span>}
              </figcaption>
            </figure>
          )}
        </div>
      )}
    </aside>
  );
}