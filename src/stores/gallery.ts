import { atom } from 'nanostores';

export type ViewMode = 'cursor' | 'stage';

/** Modo de previsualización del index. */
export const $mode = atom<ViewMode>('cursor');

/** Id de la obra resaltada (hover, foco o toque). */
export const $activeId = atom<string | null>(null);