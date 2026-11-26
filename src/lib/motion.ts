// GSAP, Lenis and the one clock that drives DOM and WebGL together.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { RoughEase } from 'gsap/EasePack';
import Lenis from 'lenis';
import type { World } from '../world/World';

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin, ScrambleTextPlugin, RoughEase);

/** Draggable on demand: registering it puts a blocking touchmove listener on
 *  the window, which phones (where nothing is dragged) are better without. */
let dragReady = false;
export function dragKit() {
  if (!dragReady) {
    gsap.registerPlugin(Draggable, InertiaPlugin);
    dragReady = true;
  }
  return Draggable;
}
gsap.defaults({ ease: 'power3.out', duration: 0.8 });
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, SplitText, Draggable };

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = () => matchMedia('(hover: none), (pointer: coarse)').matches;

let lenis: Lenis | null = null;

export function startScroll() {
  if (lenis) return lenis;
  lenis = new Lenis({
    // Touch scrolling stays native. Lenis would still listen to every touch
    // with a blocking (non-passive) handler, which makes the phone wait for
    // the main thread before it moves the page: the scroll lags the finger
    // whenever a frame runs long. Give it nothing to listen to on touch.
    eventsTarget: isTouch() ? document.createElement('div') : window,
    lerp: reduced() ? 1 : 0.1,
    wheelMultiplier: 1,
    smoothWheel: !reduced(),
    prevent: (n) => !!(n as HTMLElement).closest?.('[data-lenis-prevent]'),
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

/* ---- the order of every frame ------------------------------------------
   Scroll first, then the layout reads the frame needs, then GSAP's tweens,
   then the 3D world, and only after that the tickers that write styles.
   Reading a rect after something wrote a style forces the browser to lay
   the page out again; doing that ten times a frame made phones stutter. */
const watched = new Map<Element, DOMRect>();

/** Measure an element once per frame, before anything writes. Returns a stop function. */
export function watchRect(el: Element) {
  watched.set(el, el.getBoundingClientRect());
  return () => {
    watched.delete(el);
  };
}

/** The element's rect as measured at the start of this frame (live if it is not watched). */
export const rectOf = (el: Element) => watched.get(el) ?? el.getBoundingClientRect();

// ahead of GSAP's own update
gsap.ticker.add(
  (time) => {
    lenis?.raf(time * 1000);
    for (const el of watched.keys()) watched.set(el, el.getBoundingClientRect());
  },
  false,
  true,
);

// right after GSAP's tweens and before any component's ticker (this module loads first)
let world: World | null = null;
let last = 0;
gsap.ticker.add(() => {
  if (!world) return;
  const now = performance.now();
  const dt = last ? (now - last) / 1000 : 0.016;
  last = now;
  world.tick(dt);
});

export function startWorldClock(w: World) {
  world = w;
  last = 0;
}

export function scrollToId(id: string, immediate = false) {
  const el = id === 'top' ? document.body : document.getElementById(id);
  if (!el) return;
  lenis?.scrollTo(el, { duration: 1.6, immediate, easing: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2), force: true });
  if (!lenis) el.scrollIntoView();
}

export function scrollToY(y: number) {
  if (lenis) lenis.scrollTo(y, { duration: 1.1, force: true });
  else scrollTo(0, y);
}

export const holdScroll = (on: boolean) => (on ? lenis?.stop() : lenis?.start());

/* ---- intro gate: sections wait for the loader ------------------------ */
let introDone = false;
const waiting: (() => void)[] = [];
export function onIntro(f: () => void) {
  if (introDone) f();
  else waiting.push(f);
  return () => {
    const i = waiting.indexOf(f);
    if (i >= 0) waiting.splice(i, 1);
  };
}
export function finishIntro() {
  if (introDone) return;
  introDone = true;
  waiting.splice(0).forEach((f) => f());
}
export const introIsDone = () => introDone;

/* ---- tiny event bus -------------------------------------------------- */
type Handler = (payload?: any) => void;
const bus = new Map<string, Set<Handler>>();
export function on(ev: string, f: Handler) {
  if (!bus.has(ev)) bus.set(ev, new Set());
  bus.get(ev)!.add(f);
  return () => {
    bus.get(ev)!.delete(f);
  };
}
export const emit = (ev: string, payload?: any) => bus.get(ev)?.forEach((f) => f(payload));
