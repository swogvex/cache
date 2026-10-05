import { atom } from 'nanostores';

export type ViewMode = 'cursor' | 'stage';

/** Modo de previsualización del index. */
export const $mode = atom<ViewMode>('cursor');

/** Id de la obra resaltada (hover, foco o toque). */
export const $activeId = atom<string | null>(null);

/** Id de la obra abierta en el lightbox (null = cerrado). */
export const $openId = atom<string | null>(null);

/** Guías de grid visibles (tecla G). */
export const $grid = atom(false);

/** En modo cursor se limpia la obra activa al salir; en stage se conserva la última. */
export function releaseActive(): void {
  if ($mode.get() === 'cursor') $activeId.set(null);
}