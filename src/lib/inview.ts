// One-shot "has come on screen" callbacks. An observer never forces layout, so
// a hundred of these cost nothing, unlike a hundred scroll triggers.
type Entry = { el: Element; run: () => void };
const pools = new Map<number, { io: IntersectionObserver; map: Map<Element, Entry[]> }>();

function pool(bottom: number) {
  let p = pools.get(bottom);
  if (p) return p;
  const map = new Map<Element, Entry[]>();
  const io = new IntersectionObserver(
    (list) => {
      for (const e of list) {
        // also fire for things already scrolled past, so nothing stays hidden
        if (!e.isIntersecting && e.boundingClientRect.bottom > 0) continue;
        const jobs = map.get(e.target);
        map.delete(e.target);
        io.unobserve(e.target);
        jobs?.forEach((j) => j.run());
      }
    },
    { rootMargin: `0px 0px -${bottom}% 0px` },
  );
  pools.set(bottom, (p = { io, map }));
  return p;
}

/** Run once when the top of el rises past (100 - bottom)% of the screen. */
export function onceInView(el: Element, run: () => void, bottom = 14) {
  const p = pool(bottom);
  const job = { el, run };
  const list = p.map.get(el);
  if (list) list.push(job);
  else p.map.set(el, [job]);
  p.io.observe(el);
  return () => {
    const l = p.map.get(el);
    if (!l) return;
    const i = l.indexOf(job);
    if (i >= 0) l.splice(i, 1);
    if (!l.length) {
      p.map.delete(el);
      p.io.unobserve(el);
    }
  };
}

/** Called with true/false as el enters and leaves the screen. */
export function whileInView(el: Element, f: (on: boolean) => void, margin = '0px') {
  const io = new IntersectionObserver(([e]) => f(e.isIntersecting), { rootMargin: margin });
  io.observe(el);
  return () => io.disconnect();
}
