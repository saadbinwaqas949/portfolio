// Two benches. Dark: a bench at night, everything a line drawing until the lamp
// finds it. Light: the blue cutting mat with cardboard letters, ceiling light on.
// Anything that looks different in the two registers itself with onTheme.
import { flushSync } from 'react-dom';

const KEY = 'bench-light';
let light = false;
try {
  light = localStorage.getItem(KEY) === '1';
} catch {
  /* private window: start dark */
}

const subs = new Set<(light: boolean) => void>();

export const isLight = () => light;

/** Runs now and again on every switch. Returns the unsubscribe. */
export function onTheme(f: (light: boolean) => void) {
  subs.add(f);
  f(light);
  return () => {
    subs.delete(f);
  };
}

function paint() {
  const h = document.documentElement;
  h.classList.toggle('light', light);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#1248c4' : '#06080b');
}
paint();

function apply(next: boolean) {
  light = next;
  try {
    localStorage.setItem(KEY, next ? '1' : '0');
  } catch {
    /* not remembered, still switched */
  }
  paint();
  flushSync(() => subs.forEach((f) => f(next)));
}

let busy = false;

/** Switch benches. The new one spreads out from (x, y), where the cord hangs. */
export function toggleTheme(x: number, y: number, calm: boolean) {
  if (busy) return;
  const next = !light;
  const doc = document as Document & { startViewTransition?: (f: () => void) => { ready: Promise<void>; finished: Promise<void> } };
  if (!doc.startViewTransition || calm) {
    apply(next);
    return;
  }
  busy = true;
  const root = document.documentElement;
  root.classList.add('swapping');
  const vt = doc.startViewTransition(() => apply(next));
  vt.ready
    .then(() => {
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r * 0.16}px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 820, easing: 'cubic-bezier(0.55, 0.05, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => undefined);
  vt.finished
    .catch(() => undefined)
    .then(() => {
      busy = false;
      root.classList.remove('swapping');
    });
}
