import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import type { Artwork } from '../lib/artworks';
import { preload } from '../lib/preload';
import { $openId } from '../stores/gallery';

interface Props {
  artworks: Artwork[];
}

const SWIPE_DISTANCE = 50;

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function close() {
  $openId.set(null);
}

export default function Lightbox({ artworks }: Props) {
  const openId = useStore($openId);
  const index = openId ? artworks.findIndex((item) => item.id === openId) : -1;
  const artwork = index >= 0 ? (artworks[index] ?? null) : null;
  const isOpen = artwork !== null;
  const multiple = artworks.length > 1;

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastId = useRef<string | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const lastSwipe = useRef(-1000);

  const go = useCallback(
    (step: number) => {
      const total = artworks.length;
      if (total < 2 || index < 0) return;
      const next = artworks[(index + step + total) % total];
      if (next) $openId.set(next.id);
    },
    [artworks, index],
  );

  // Recuerda la obra mostrada para devolver el foco a su fila al cerrar.
  useEffect(() => {
    if (artwork) lastId.current = artwork.id;
  }, [artwork]);

  // Apertura/cierre: bloqueo de scroll y gestión del foco.
  useEffect(() => {
    if (!isOpen) return;

    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      const id = lastId.current;
      if (!id) return;
      document
        .querySelector<HTMLElement>(`[data-artwork-id="${CSS.escape(id)}"]`)
        ?.focus();
    };
  }, [isOpen]);

  // Teclado: ← → Esc y trampa de foco con Tab.
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        go(1);
      } else if (event.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const items = Array.from(dialog.querySelectorAll<HTMLElement>('button'));
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        const active = document.activeElement;
        const outside = !dialog.contains(active);

        if (event.shiftKey && (active === first || outside)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || outside)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, go]);

  // Precarga de las obras vecinas.
  useEffect(() => {
    if (index < 0) return;
    for (const neighbor of [artworks[index - 1], artworks[index + 1]]) {
      if (neighbor) preload(neighbor.image.src);
    }
  }, [index, artworks]);

  if (!artwork) return null;

  const label = [artwork.title, artwork.author].filter(Boolean).join(' — ') || 'Untitled';

  return (
    <div
      ref={dialogRef}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        if (performance.now() - lastSwipe.current < 400) return;
        close();
      }}
      onPointerDown={(event) => {
        if (event.pointerType === 'touch') {
          swipeStart.current = { x: event.clientX, y: event.clientY };
        }
      }}
      onPointerUp={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start || event.pointerType !== 'touch') return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
          lastSwipe.current = performance.now();
          go(dx < 0 ? 1 : -1);
        }
      }}
      onPointerCancel={() => {
        swipeStart.current = null;
      }}
    >
      <button
        ref={closeRef}
        type="button"
        className="lightbox-btn lightbox-close"
        aria-label="Close"
        onClick={close}
      >
        <Icon d="M6 6l12 12M18 6L6 18" />
      </button>

      {multiple && (
        <>
          <button
            type="button"
            className="lightbox-btn lightbox-prev"
            aria-label="Previous artwork"
            onClick={() => go(-1)}
          >
            <Icon d="M19 12H5M11 6l-6 6 6 6" />
          </button>
          <button
            type="button"
            className="lightbox-btn lightbox-next"
            aria-label="Next artwork"
            onClick={() => go(1)}
          >
            <Icon d="M5 12h14M13 6l6 6-6 6" />
          </button>
        </>
      )}

      <figure className="lightbox-figure">
        <img
          key={artwork.id}
          src={artwork.image.src}
          width={artwork.image.width}
          height={artwork.image.height}
          alt={label}
          decoding="async"
          draggable={false}
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) el.dataset.loaded = 'true';
          }}
          onLoad={(event) => {
            event.currentTarget.dataset.loaded = 'true';
          }}
        />
      </figure>

      <div className="lightbox-info" aria-live="polite">
        {artwork.title && <strong>{artwork.title}</strong>}
        {artwork.author && <span>{artwork.author}</span>}
        {artwork.date && <span className="date">{artwork.date}</span>}
      </div>
    </div>
  );
}