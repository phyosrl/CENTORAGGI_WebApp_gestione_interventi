// Smooth wheel scrolling: inseguimento esponenziale verso il target.
// Ogni notch della rotella aggiorna `targetY`; un singolo loop rAF avvicina
// `currentY` al target con un fattore costante per frame → durante scroll
// continui il movimento è uno solo, fluido, senza curve sovrapposte.
// Touchpad, gesture (Ctrl/Meta), prefers-reduced-motion e container
// scrollabili interni sono lasciati al browser.

const STEP = 110;           // px per notch della rotella
const SMOOTHING = 0.18;     // 0..1 — frazione avvicinata al target ogni frame (più alto = più reattivo)
const SNAP_DISTANCE = 0.5;  // px — sotto questa distanza si "aggancia" al target

// Trova il primo antenato scrollabile (verticalmente) sull'asse Y.
// Ritorna null se solo la finestra può scrollare.
function findScrollableAncestor(el: Element | null, deltaY: number): Element | null {
  let node: Element | null = el;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const oy = style.overflowY;
    const canScroll = (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
      node.scrollHeight > node.clientHeight;
    if (canScroll) {
      const atTop = node.scrollTop <= 0;
      const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function enableSmoothScroll(): () => void {
  if (typeof window === 'undefined') return () => {};

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return () => {};

  let currentY = window.scrollY;
  let targetY = window.scrollY;
  let rafId: number | null = null;
  let animating = false;

  const tick = () => {
    const diff = targetY - currentY;
    if (Math.abs(diff) < SNAP_DISTANCE) {
      currentY = targetY;
      window.scrollTo(0, currentY);
      rafId = null;
      animating = false;
      return;
    }
    currentY += diff * SMOOTHING;
    window.scrollTo(0, currentY);
    rafId = requestAnimationFrame(tick);
  };

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (e.deltaY === 0) return;

    // Tipico mouse a rotella: deltaMode=1 (LINE) o |deltaY| >= 40.
    // Touchpad: delta piccoli e continui → lasciati al browser.
    const isWheelMouse = e.deltaMode === 1 || Math.abs(e.deltaY) >= 40;
    if (!isWheelMouse) return;

    // Container scrollabile interno (modal, dropdown, textarea, lista) → no override.
    const inner = findScrollableAncestor(e.target as Element, e.deltaY);
    if (inner) return;

    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (!animating) currentY = window.scrollY;
    const baseY = animating ? targetY : currentY;
    if ((e.deltaY < 0 && baseY <= 0) || (e.deltaY > 0 && baseY >= max)) return;

    e.preventDefault();
    targetY = Math.max(0, Math.min(max, baseY + Math.sign(e.deltaY) * STEP));
    if (!animating) {
      animating = true;
      if (rafId == null) rafId = requestAnimationFrame(tick);
    }
  };

  // Se l'utente interagisce in altro modo, riallinea (no salti) ma non fermare brutalmente.
  const resync = () => {
    if (!animating) return;
    currentY = window.scrollY;
    targetY = window.scrollY;
  };
  const cancel = () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
    animating = false;
    currentY = window.scrollY;
    targetY = window.scrollY;
  };

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', cancel);
  window.addEventListener('mousedown', resync);
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('resize', resync);

  return () => {
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', cancel);
    window.removeEventListener('mousedown', resync);
    window.removeEventListener('touchstart', cancel);
    window.removeEventListener('resize', resync);
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}
