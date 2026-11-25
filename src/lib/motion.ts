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

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, MotionPathPlugin, ScrambleTextPlugin, Draggable, InertiaPlugin, RoughEase);
gsap.defaults({ ease: 'power3.out', duration: 0.8 });
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger, SplitText, Draggable };

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = () => matchMedia('(hover: none), (pointer: coarse)').matches;

let lenis: Lenis | null = null;

export function startScroll() {
  if (lenis) return lenis;
  lenis = new Lenis({
    lerp: reduced() ? 1 : 0.1,
    wheelMultiplier: 1,
    smoothWheel: !reduced(),
    prevent: (n) => !!(n as HTMLElement).closest?.('[data-lenis-prevent]'),
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((time) => lenis!.raf(time * 1000));
  return lenis;
}

export function startWorldClock(w: World) {
  let last = performance.now();
  // runs after Lenis and after every tween, so 3D and DOM agree on the frame
  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    w.tick(dt);
  });
}

export function scrollToId(id: string, immediate = false) {
  const el = id === 'top' ? document.body : document.getElementById(id);
  if (!el) return;
  lenis?.scrollTo(el, { duration: 1.6, immediate, easing: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2), force: true });
  if (!lenis) el.scrollIntoView();
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
