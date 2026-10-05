import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $grid } from '../stores/gallery';

const COLUMNS = Array.from({ length: 12 }, (_, i) => i);

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

export default function GridToggle() {
  const on = useStore($grid);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'g' || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      $grid.set(!$grid.get());
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className="grid-toggle"
        aria-pressed={on}
        aria-label="Toggle grid overlay (G)"
        title="Toggle grid (G)"
        onClick={() => $grid.set(!on)}
      >
        g
      </button>
      {on && (
        <div className="grid-overlay" aria-hidden="true">
          {COLUMNS.map((i) => (
            <span key={i} />
          ))}
        </div>
      )}
    </>
  );
}