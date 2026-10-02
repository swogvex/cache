import { useStore } from '@nanostores/react';
import { $mode } from '../stores/gallery';

export default function ModeToggle() {
  const mode = useStore($mode);
  const next = mode === 'cursor' ? 'stage' : 'cursor';

  return (
    <button
      type="button"
      className="nav-link"
      aria-label={`Switch to ${next} mode`}
      onClick={() => $mode.set(next)}
    >
      {next}
    </button>
  );
}