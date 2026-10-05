import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useStore } from '@nanostores/react';
import type { Artwork } from '../lib/artworks';
import type { CanvasItem } from '../lib/canvas';
import { $activeId, $openId } from '../stores/gallery';
import Lightbox from './Lightbox';

interface Props {
  items: CanvasItem[];
  artworks: Artwork[];
}

interface View {
  x: number;
  y: number;
  k: number;
}

const FIT_PADDING = 64;
const ABS_MIN_K = 0.05;
const MAX_K = 5;
const DRAG_THRESHOLD = 4;
const BUTTON_ZOOM = 1.4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function CanvasView({ items, artworks }: Props) {
  const activeId = useStore($activeId);

  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 0, k: 1 });
  const minK = useRef(ABS_MIN_K);
  const interacted = useRef(false);
  const dragged = useRef(false);

  const bounds = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const item of items) {
      minX = Math.min(minX, item.cx - item.width / 2);
      minY = Math.min(minY, item.cy - item.height / 2);
      maxX = Math.max(maxX, item.cx + item.width / 2);
      maxY = Math.max(maxY, item.cy + item.height / 2);
    }
    return { minX, minY, maxX, maxY };
  }, [items]);

  const apply = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const { x, y, k } = view.current;
    world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${k})`;
    world.style.setProperty('--inv', String(1 / k));
  }, []);

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || items.length === 0) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;

    const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const k = clamp(
      Math.min((width - 2 * FIT_PADDING) / boundsWidth, (height - 2 * FIT_PADDING) / boundsHeight),
      ABS_MIN_K,
      MAX_K,
    );

    minK.current = Math.max(ABS_MIN_K, k * 0.5);
    view.current = {
      k,
      x: width / 2 - ((bounds.minX + bounds.maxX) / 2) * k,
      y: height / 2 - ((bounds.minY + bounds.maxY) / 2) * k,
    };
    apply();
  }, [apply, bounds, items.length]);

  const zoomAt = useCallback(
    (nextK: number, px: number, py: number) => {
      const current = view.current;
      const k = clamp(nextK, minK.current, MAX_K);
      const ratio = k / current.k;
      view.current = {
        k,
        x: px - (px - current.x) * ratio,
        y: py - (py - current.y) * ratio,
      };
      apply();
    },
    [apply],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      interacted.current = true;
      zoomAt(view.current.k * factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
    },
    [zoomAt],
  );

  const centerOn = useCallback(
    (cx: number, cy: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const { k } = view.current;
      interacted.current = true;
      view.current = {
        k,
        x: viewport.clientWidth / 2 - cx * k,
        y: viewport.clientHeight / 2 - cy * k,
      };
      apply();
    },
    [apply],
  );

  const resetView = useCallback(() => {
    interacted.current = false;
    fit();
  }, [fit]);

  // Ajuste inicial y reajuste al cambiar el tamaño (mientras el usuario no haya movido la vista).
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    fit();
    viewport.dataset.ready = 'true';

    const observer = new ResizeObserver(() => {
      if (!interacted.current) fit();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fit]);

  // Rueda, arrastre y pellizco.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const pointers = new Map<number, { x: number; y: number }>();
    let origin: { x: number; y: number; vx: number; vy: number } | null = null;
    let dragging = false;
    let pinchDistance = 0;

    const distance = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };

    const midpoint = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      interacted.current = true;
      const rect = viewport.getBoundingClientRect();
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const speed = event.ctrlKey ? 0.01 : 0.0015;
      zoomAt(
        view.current.k * Math.exp(-delta * speed),
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest('.canvas-controls')) return;

      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pointers.size === 1) {
        origin = { x: event.clientX, y: event.clientY, vx: view.current.x, vy: view.current.y };
        dragging = false;
        dragged.current = false;
      } else if (pointers.size === 2) {
        origin = null;
        pinchDistance = distance();
        dragged.current = true;
      }
    };

    const onMove = (event: PointerEvent) => {
      const pointer = pointers.get(event.pointerId);
      if (!pointer) return;

      const previousMid = midpoint();
      pointer.x = event.clientX;
      pointer.y = event.clientY;

      if (pointers.size === 1 && origin) {
        const dx = event.clientX - origin.x;
        const dy = event.clientY - origin.y;

        if (!dragging) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          dragging = true;
          dragged.current = true;
          interacted.current = true;
          viewport.setPointerCapture(event.pointerId);
          viewport.dataset.dragging = 'true';
        }

        view.current = { ...view.current, x: origin.vx + dx, y: origin.vy + dy };
        apply();
      } else if (pointers.size === 2) {
        const nextDistance = distance();
        const mid = midpoint();
        if (!pinchDistance || !mid || !previousMid) return;

        interacted.current = true;
        const rect = viewport.getBoundingClientRect();
        view.current = {
          ...view.current,
          x: view.current.x + (mid.x - previousMid.x),
          y: view.current.y + (mid.y - previousMid.y),
        };
        zoomAt(view.current.k * (nextDistance / pinchDistance), mid.x - rect.left, mid.y - rect.top);
        pinchDistance = nextDistance;
      }
    };

    const onUp = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }
      pinchDistance = 0;

      const remaining = [...pointers.values()][0];
      if (pointers.size === 1 && remaining) {
        origin = { x: remaining.x, y: remaining.y, vx: view.current.x, vy: view.current.y };
        dragging = true;
      } else {
        origin = null;
        dragging = false;
        delete viewport.dataset.dragging;
      }

      if (pointers.size === 0) {
        window.setTimeout(() => {
          dragged.current = false;
        }, 0);
      }
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('pointerdown', onDown);
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onUp);

    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('pointerdown', onDown);
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerup', onUp);
      viewport.removeEventListener('pointercancel', onUp);
    };
  }, [apply, zoomAt]);

  // Teclado: + - 0.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ($openId.get() || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '+' || event.key === '=') zoomBy(BUTTON_ZOOM);
      else if (event.key === '-' || event.key === '_') zoomBy(1 / BUTTON_ZOOM);
      else if (event.key === '0') resetView();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomBy, resetView]);

  if (items.length === 0) {
    return (
      <p className="placeholder">
        No artworks mapped yet. Run <code>pnpm embed</code> and reload.
      </p>
    );
  }

  const active = activeId ? items.find((item) => item.id === activeId) : undefined;

  return (
    <>
      <div ref={viewportRef} className="canvas-viewport" role="group" aria-label="Artwork map">
        <div ref={worldRef} className="canvas-world">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="canvas-item"
              data-artwork-id={item.id}
              data-active={activeId === item.id}
              aria-label={`${item.number} ${item.title ?? 'Untitled'} ${item.author ?? ''}`.trim()}
              style={{
                left: item.cx - item.width / 2,
                top: item.cy - item.height / 2,
                width: item.width,
                height: item.height,
              }}
              onPointerEnter={() => $activeId.set(item.id)}
              onPointerLeave={() => $activeId.set(null)}
              onFocus={(event) => {
                if (event.currentTarget.matches(':focus-visible')) {
                  $activeId.set(item.id);
                  centerOn(item.cx, item.cy);
                }
              }}
              onBlur={() => $activeId.set(null)}
              onClick={() => {
                if (!dragged.current) $openId.set(item.id);
              }}
            >
              <img
                src={item.thumb}
                width={item.width}
                height={item.height}
                alt=""
                decoding="async"
                draggable={false}
              />
            </button>
          ))}
        </div>

        <div className="canvas-caption" aria-hidden="true">
          {active && (
            <>
              <span className="num">{active.number}</span>
              {active.title && <strong>{active.title}</strong>}
              {active.author && <span>{active.author}</span>}
              {active.date && <span className="date">{active.date}</span>}
            </>
          )}
        </div>

        <div className="canvas-controls">
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / BUTTON_ZOOM)}>
            −
          </button>
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(BUTTON_ZOOM)}>
            +
          </button>
          <button type="button" aria-label="Fit all artworks" onClick={resetView}>
            fit
          </button>
        </div>
      </div>
      <Lightbox artworks={artworks} />
    </>
  );
}