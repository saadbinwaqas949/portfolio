// DOM things that should react to the lamp: photo prints throw a shadow away
// from it and pick up a glossy highlight.
import { useEffect, type RefObject } from 'react';
import { getWorld } from '../world/World';
import { gsap } from './motion';

const visible = new Set<HTMLElement>();
let io: IntersectionObserver | null = null;
let running = false;

function tick() {
  const w = getWorld();
  if (!w || !visible.size) return;
  const lx = w.lampPos.x * 100 + w.vw / 2;
  const ly = -w.lampPos.y * 100 + w.vh / 2;
  const soft = 1 - w.room.v * 0.6;
  for (const el of visible) {
    const r = el.getBoundingClientRect();
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

export function useLit(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!io)
      io = new IntersectionObserver(
        (es) =>
          es.forEach((e) =>
            e.isIntersecting ? visible.add(e.target as HTMLElement) : visible.delete(e.target as HTMLElement),
          ),
        { rootMargin: '60px' },
      );
    io.observe(el);
    if (!running) {
      running = true;
      gsap.ticker.add(tick);
    }
    return () => {
      io?.unobserve(el);
      visible.delete(el);
    };
  }, [ref]);
}
