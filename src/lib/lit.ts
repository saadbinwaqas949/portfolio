// DOM things that should react to the lamp: photo prints throw a shadow away
// from it and pick up a glossy highlight.
import { useEffect, type RefObject } from 'react';
import { getWorld } from '../world/World';
import { gsap, isTouch, rectOf, watchRect } from './motion';

const visible = new Map<HTMLElement, () => void>();
let io: IntersectionObserver | null = null;
let running = false;

function tick() {
  const w = getWorld();
  if (!w || !visible.size) return;
  const lx = w.lampPos.x * 100 + w.vw / 2;
  const ly = -w.lampPos.y * 100 + w.vh / 2;
  const soft = 1 - w.room.v * 0.6;
  // rects were measured at the start of the frame, so these writes force nothing
  for (const el of visible.keys()) {
    const r = rectOf(el);
    const dx = r.left + r.width / 2 - lx;
    const dy = r.top + r.height / 2 - ly;
    const d = Math.hypot(dx, dy) || 1;
    const len = Math.min(26, 4 + d * 0.032) * soft;
    el.style.setProperty('--sx', ((dx / d) * len).toFixed(1) + 'px');
    el.style.setProperty('--sy', ((dy / d) * len + 3).toFixed(1) + 'px');
    el.style.setProperty('--gx', (lx - r.left).toFixed(0) + 'px');
    el.style.setProperty('--gy', (ly - r.top).toFixed(0) + 'px');
  }
}

/** Phones: the lamp wanders by itself, and repainting a blurred shadow and a
 *  blended highlight on every photo every frame is what a phone can't afford.
 *  Light them once, from above and a little to the left. */
function still(el: HTMLElement) {
  el.style.setProperty('--sx', '-3px');
  el.style.setProperty('--sy', '11px');
  el.style.setProperty('--gx', '30%');
  el.style.setProperty('--gy', '12%');
}

export function useLit(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (isTouch()) {
      still(el);
      return;
    }
    if (!io)
      io = new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            const t = e.target as HTMLElement;
            if (e.isIntersecting && !visible.has(t)) visible.set(t, watchRect(t));
            else if (!e.isIntersecting) {
              visible.get(t)?.();
              visible.delete(t);
            }
          }),
        { rootMargin: '60px' },
      );
    io.observe(el);
    if (!running) {
      running = true;
      gsap.ticker.add(tick);
    }
    return () => {
      io?.unobserve(el);
      visible.get(el)?.();
      visible.delete(el);
    };
  }, [ref]);
}
