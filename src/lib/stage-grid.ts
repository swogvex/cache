export interface StageMetrics {
  /** Ancho del panel del stage en px. */
  width: number;
  /** Alto máximo de la imagen en px (múltiplo de la altura de fila). */
  height: number;
  /** Número de columnas del panel (7). */
  columns: number;
  /** Separación entre columnas en px. */
  gap: number;
}

export interface StageFit {
  columns: number;
  /** true si ninguna columna encaja y hay que ajustar por altura. */
  fitHeight: boolean;
}

/** Margen para absorber redondeos (la imagen puede pasarse un 2 % del alto). */
const TOLERANCE = 0.02;

/**
 * Devuelve cuántas columnas ocupa una imagen: la más cercana a su tamaño
 * natural (a la altura máxima del stage) sin superar esa altura.
 */
export function fitToGrid(ratio: number, metrics: StageMetrics): StageFit {
  const { width, height, columns, gap } = metrics;
  const colWidth = (width - (columns - 1) * gap) / columns;
  const naturalWidth = height * ratio;

  let best: { columns: number; distance: number } | null = null;

  for (let n = 1; n <= columns; n++) {
    const spanWidth = n * colWidth + (n - 1) * gap;
    if (spanWidth / ratio > height * (1 + TOLERANCE)) continue;

    const distance = Math.abs(spanWidth - naturalWidth);
    if (!best || distance < best.distance) best = { columns: n, distance };
  }

  return best ? { columns: best.columns, fitHeight: false } : { columns: 1, fitHeight: true };
}