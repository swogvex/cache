const MAX_PULL = 28;
const RESISTANCE = 0.2;
const SETTLE_MS = 170;
const SPRING = 'transform 860ms cubic-bezier(0.18, 0.9, 0.22, 1)';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Rebote elástico del contenido al llegar al principio o al final de la página. */
export function initBounce(target: HTMLElement): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let offset = 0;
  let settling = false;
  let timer = 0;

  let touching = false;
  let pulling = false;
  let startY = 0;
  let baseOffset = 0;

  const locked = () => document.body.style.overflow === 'hidden';
  const atTop = () => window.scrollY <= 0;
  const atBottom = () =>
    Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;

  const currentOffset = () => {
    const transform = getComputedStyle(target).transform;
    return transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
  };

  // Si empieza un nuevo gesto mientras el muelle aún vuelve, partimos de la posición real.
  const sync = () => {
    if (!settling) return;
    offset = currentOffset();
    settling = false;
  };

  const render = () => {
    target.style.transition = 'none';
    target.style.transform = `translate3d(0, ${offset}px, 0)`;
  };

  const release = () => {
    if (offset === 0) {
      target.style.transition = '';
      target.style.transform = '';
      return;
    }
    offset = 0;
    settling = true;
    target.style.transition = SPRING;
    target.style.transform = 'translate3d(0, 0, 0)';
  };

  target.addEventListener('transitionend', (event) => {
    if (event.target !== target || offset !== 0) return;
    settling = false;
    target.style.transition = '';
    target.style.transform = '';
  });

  // Rueda y trackpad.
  window.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || locked()) return;
      sync();

      const pullingTop = event.deltaY < 0 && atTop();
      const pullingBottom = event.deltaY > 0 && atBottom();
      if (!pullingTop && !pullingBottom && offset === 0) return;

      event.preventDefault();

      const deltaY = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      let delta = -deltaY * RESISTANCE;
      // Cuanto más se estira, más cuesta; al volver hacia el borde no hay resistencia.
      if (offset === 0 || Math.sign(delta) === Math.sign(offset)) {
        delta *= 1 - Math.min(Math.abs(offset) / (MAX_PULL * 1.2), 1) * 0.8;
      }

      let next = clamp(offset + delta, -MAX_PULL, MAX_PULL);
      // Al cruzar el cero, el scroll normal retoma el control.
      if (offset !== 0 && Math.sign(next) !== Math.sign(offset)) next = 0;

      offset = next;
      render();
      window.clearTimeout(timer);
      timer = window.setTimeout(release, SETTLE_MS);
    },
    { passive: false },
  );

  // Pantallas táctiles.
  window.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length !== 1 || locked()) return;
      sync();
      touching = true;
      pulling = false;
      startY = touch.clientY;
    },
    { passive: true },
  );

  window.addEventListener(
    'touchmove',
    (event) => {
      const touch = event.touches[0];
      if (!touching || !touch || locked()) return;

      const move = touch.clientY - startY;
      if (!pulling) {
        if ((move > 0 && atTop()) || (move < 0 && atBottom())) {
          pulling = true;
          startY = touch.clientY;
          baseOffset = offset;
        } else {
          return;
        }
      }

      event.preventDefault();
      const raw = baseOffset + (touch.clientY - startY) * 0.75;
      const x = Math.abs(raw) / MAX_PULL;
      offset = Math.sign(raw) * MAX_PULL * (1 - Math.exp(-x * 2.1));
      render();
    },
    { passive: false },
  );

  const endTouch = () => {
    touching = false;
    pulling = false;
    window.clearTimeout(timer);
    release();
  };

  window.addEventListener('touchend', endTouch, { passive: true });
  window.addEventListener('touchcancel', endTouch, { passive: true });
}
