import { useStore } from '@nanostores/react';
import { $activeId, $mode } from '../stores/gallery';

export default function ModeToggle() {
  const mode = useStore($mode);
  const next = mode === 'cursor' ? 'stage' : 'cursor';

  return (
    <button
      type="button"
      className="nav-link mode-toggle"
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        $mode.set(next);
        if (next === 'cursor') $activeId.set(null);
      }}
    >
      {next}
    </button>
  );
}