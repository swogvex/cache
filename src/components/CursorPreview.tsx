import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import type { Artwork } from '../lib/artworks';
import { preload } from '../lib/preload';
import { $activeId, $mode, $openId } from '../stores/gallery';

interface Props {
  artworks: Artwork[];
}

interface Pointer {
  x: number;
  y: number;
  mouse: boolean;
}

const MAX_W = 360;
const MAX_H = 256;
const OFFSET = 24;
const MARGIN = 12;

function fit(width: number, height: number) {
  const scale = Math.min(MAX_W / width, MAX_H / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export default function CursorPreview({ artworks }: Props) {
  const activeId = useStore($activeId);
  const mode = useStore($mode);
  const openId = useStore($openId);

  const boxRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<Pointer>({ x: -1, y: -1, mouse: false });
  const frame = useRef(0);

  const artwork =
    mode === 'cursor' && !openId && activeId
      ? (artworks.find((item) => item.id === activeId) ?? null)
      : null;

  const place = useCallback(() => {
    const box = boxRef.current;
    if (!box) return;

    const { x, y, mouse } = pointer.current;
    if (!mouse) {
      box.style.visibility = 'hidden';
      return;
    }

    const w = box.offsetWidth;
    const h = box.offsetHeight;

    let left = x + OFFSET;
    if (left + w > window.innerWidth - MARGIN) left = x - OFFSET - w;
    left = clamp(left, MARGIN, window.innerWidth - w - MARGIN);

    const top = clamp(y - h / 2, MARGIN, window.innerHeight - h - MARGIN);

    box.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    box.style.visibility = 'visible';
  }, []);

  // Seguimiento del puntero (un solo listener, actualizado una vez por frame).
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointer.current = {
        x: event.clientX,
        y: event.clientY,
        mouse: event.pointerType === 'mouse',
      };
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        place();
      });
    };

    // Si el usuario navega con teclado, ocultamos la preview hasta que vuelva a mover el ratón.
    const onKey = () => {
      pointer.current.mouse = false;
      place();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [place]);

  // Al cambiar de obra, recolocamos antes de pintar para evitar parpadeos.
  useLayoutEffect(() => {
    place();
  }, [artwork?.id, place]);

  // Precarga de las obras vecinas.
  useEffect(() => {
    if (!activeId) return;
    const index = artworks.findIndex((item) => item.id === activeId);
    if (index === -1) return;
    for (const neighbor of [artworks[index - 1], artworks[index + 1]]) {
      if (neighbor) preload(neighbor.image.src);
    }
  }, [activeId, artworks]);

  if (!artwork) return null;

  const size = fit(artwork.image.width, artwork.image.height);

  return (
    <div
      ref={boxRef}
      className="cursor-preview"
      style={{ width: size.width, height: size.height }}
      aria-hidden="true"
    >
      <img
        key={artwork.id}
        src={artwork.image.src}
        alt=""
        decoding="async"
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0) el.dataset.loaded = 'true';
        }}
        onLoad={(event) => {
          event.currentTarget.dataset.loaded = 'true';
        }}
      />
    </div>
  );
}