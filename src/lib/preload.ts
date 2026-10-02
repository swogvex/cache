const preloaded = new Set<string>();

export function preload(src: string): void {
  if (typeof window === 'undefined' || preloaded.has(src)) return;
  preloaded.add(src);
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
}