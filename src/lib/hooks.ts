import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap, ScrollTrigger } from './motion';

/** GSAP context tied to an element; everything inside is reverted on unmount. */
export function useGsap<T extends HTMLElement>(
  fn: (el: T) => void | (() => void),
  deps: unknown[] = [],
): RefObject<T | null> {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    let clean: void | (() => void);
    const ctx = gsap.context(() => {
      clean = fn(ref.current!);
    }, ref.current);
    return () => {
      if (typeof clean === 'function') clean();
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

// Creating a trigger reads layout, and its callback usually writes styles.
// Doing that one by one makes the browser lay the page out dozens of times, so
// triggers asked for in the same tick are created together, then run together.
let queue: (() => () => void)[] = [];
let batching = false;
export function batchTriggers(job: () => () => void) {
  queue.push(job);
  if (queue.length === 1)
    queueMicrotask(() => {
      const list = queue;
      queue = [];
      batching = true;
      const after = list.map((j) => j());
      batching = false;
      after.forEach((f) => f());
    });
}

export interface Handle {
  kill(): void;
}

function tracked(vars: ScrollTrigger.StaticVars, f: (p: number) => void): Handle {
  let st: ScrollTrigger | null = null;
  let dead = false;
  batchTriggers(() => {
    if (dead) return () => {};
    st = ScrollTrigger.create({
      ...vars,
      onUpdate: (s) => !batching && f(s.progress),
      onRefresh: (s) => !batching && f(s.progress),
    });
    return () => st && f(st.progress);
  });
  return {
    kill() {
      dead = true;
      st?.kill();
    },
  };
}

/** Height of a pinned section: one screen plus the held stretch. Phones get a
 *  shorter stretch (--pin in base.css): a thumb flick covers less, and a long
 *  hold reads as the page refusing to scroll. */
export const pinH = (vh: number) => `calc(100vh + ${vh - 100} * var(--pin))`;

/** 0..1 progress of a tall pinned section. */
export const pinProgress = (el: HTMLElement, f: (p: number) => void) =>
  tracked({ trigger: el, start: 'top top', end: 'bottom bottom' }, f);

/** Run a callback every frame while the element is on screen. */
export function useFrame(ref: RefObject<HTMLElement | null>, f: (dt: number, t: number) => void) {
  const fn = useRef(f);
  fn.current = f;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let on = false;
    let last = 0;
    const tick = (time: number) => {
      const dt = Math.min(0.05, last ? time - last : 0.016);
      last = time;
      fn.current(dt, time);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !on) {
          on = true;
          last = 0;
          gsap.ticker.add(tick);
        } else if (!e.isIntersecting && on) {
          on = false;
          gsap.ticker.remove(tick);
        }
      },
      { rootMargin: '80px' },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      gsap.ticker.remove(tick);
    };
  }, [ref]);
}
