// Plugging in the battery. The gap between the two XT60 halves is the load
// progress; when they meet, the lamp comes on.
import { useEffect, useRef, useState } from 'react';
import { createWorld } from '../world/World';
import { finishIntro, gsap, holdScroll, reduced, startScroll, startWorldClock, ScrollTrigger } from '../lib/motion';

function Connector({ male = false }: { male?: boolean }) {
  return (
    <svg viewBox="0 0 220 120" className="xt" aria-hidden>
      {male ? (
        <>
          <path d="M96 42H220" stroke="#e5322d" strokeWidth="17" />
          <path d="M96 78H220" stroke="#191b22" strokeWidth="17" />
          <path d="M96 37H220" stroke="#ff8a80" strokeWidth="3" opacity=".7" />
          <path d="M96 73H220" stroke="#4a4f5d" strokeWidth="3" opacity=".8" />
          <rect x="2" y="35" width="46" height="13" rx="6.5" fill="url(#pin)" />
          <rect x="2" y="72" width="46" height="13" rx="6.5" fill="url(#pin)" />
          <path d="M44 22h62v76H44l-12-12V34z" fill="#ffc21a" />
          <path d="M44 22h62v14H40z" fill="#ffdf7d" />
          <path d="M34 86l10 12h62V84H36z" fill="#cf9200" />
          <path d="M66 22v76M76 22v76M86 22v76" stroke="#cf9200" strokeWidth="3" opacity=".6" />
        </>
      ) : (
        <>
          <path d="M0 42H124" stroke="#e5322d" strokeWidth="17" />
          <path d="M0 78H124" stroke="#191b22" strokeWidth="17" />
          <path d="M0 37H124" stroke="#ff8a80" strokeWidth="3" opacity=".7" />
          <path d="M0 73H124" stroke="#4a4f5d" strokeWidth="3" opacity=".8" />
          <path d="M112 22h78l28 12v52l-28 12h-78z" fill="#ffc21a" />
          <path d="M112 22h78l28 12v8l-28-6h-78z" fill="#ffdf7d" />
          <path d="M112 98h78l28-12v-7l-28 6h-78z" fill="#cf9200" />
          <path d="M132 22v76M142 22v76M152 22v76" stroke="#cf9200" strokeWidth="3" opacity=".6" />
          <ellipse cx="214" cy="42" rx="4" ry="7" fill="#5c4100" />
          <ellipse cx="214" cy="78" rx="4" ry="7" fill="#5c4100" />
        </>
      )}
      <defs>
        <linearGradient id="pin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4cf" />
          <stop offset=".5" stopColor="#e7b54a" />
          <stop offset="1" stopColor="#9a6a12" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const FONTS = [
  '400 40px "Dela Gothic One"',
  '400 18px Barlow',
  '600 18px Barlow',
  '700 18px "Barlow Condensed"',
  '500 18px "Shantell Sans Variable"',
  '400 18px "Jersey 10"',
];

export function Loader({ canvas, quick }: { canvas: React.RefObject<HTMLCanvasElement | null>; quick?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = root.current!;
    const left = el.querySelector<HTMLElement>('.ld-l')!;
    const right = el.querySelector<HTMLElement>('.ld-r')!;
    const volts = el.querySelector<HTMLElement>('.ld-v')!;
    const bars = el.querySelectorAll<HTMLElement>('.ld-bars i');
    const flash = el.querySelector<HTMLElement>('.ld-flash')!;
    const still = reduced();
    startScroll();
    holdScroll(true);
    scrollTo(0, 0);

    const state = { p: 0 };
    const draw = () => {
      const gap = (1 - state.p) * Math.max(160, innerWidth * 0.36);
      left.style.transform = `translate3d(${-gap}px,-50%,0) rotate(${(1 - state.p) * -2.5}deg)`;
      right.style.transform = `translate3d(${gap}px,-50%,0) rotate(${(1 - state.p) * 3}deg)`;
      volts.textContent = (16.8 * state.p).toFixed(1);
    };
    draw();

    let cancelled = false;
    const to = (p: number, d: number) =>
      new Promise<void>((r) => gsap.to(state, { p, duration: still ? 0.01 : d, ease: 'power2.inOut', onUpdate: draw, onComplete: () => r() }));

    (async () => {
      const fonts = Promise.race([
        Promise.all(FONTS.map((f) => document.fonts.load(f))).catch(() => undefined),
        new Promise((r) => setTimeout(r, 3500)),
      ]);
      const opening = to(0.5, quick ? 0.1 : 0.8);
      await fonts;
      if (cancelled) return;
      // build the bench while the plugs are still travelling
      const w = createWorld(canvas.current!);
      w?.resize(true);
      const ready = w ? w.renderer.compileAsync(w.scene, w.camera).catch(() => undefined) : Promise.resolve();
      await opening;
      const creep = gsap.to(state, { p: 0.88, duration: 3.4, ease: 'power1.out', onUpdate: draw });
      await Promise.race([ready, new Promise((r) => setTimeout(r, 6000))]);
      creep.kill();
      if (cancelled) return;
      if (w) {
        w.started = true;
        startWorldClock(w);
      }
      ScrollTrigger.refresh();
      // two frames, so the first (slow) one is behind us before anything moves
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      if (cancelled) return;

      // ---- contact -------------------------------------------------------
      const lamp = w?.lampPower ?? { v: 0 };
      const spark = w?.spark ?? { v: 0 };
      const open = () => {
        holdScroll(false);
        finishIntro();
        if (w) setTimeout(() => (w.canBuild = true), 1400);
      };
      if (still || quick) {
        state.p = 1;
        draw();
        lamp.v = 1;
        setGone(true);
        open();
        return;
      }
      gsap.fromTo(spark, { v: 1.6 }, { v: 0, duration: 1.8, delay: 0.24, ease: 'power2.out' });
      bars.forEach((b, i) => gsap.fromTo(b, { opacity: 0.2, scaleY: 0.5 }, { opacity: 1, scaleY: 1, duration: 0.08, delay: 0.22 + i * 0.11, repeat: 1, yoyo: true }));
      gsap
        .timeline()
        .to(state, { p: 1, duration: 0.22, ease: 'power4.in', onUpdate: draw }, 0)
        .fromTo(flash, { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.06, ease: 'none' }, 0.22)
        .to(flash, { opacity: 0, scale: 1.9, duration: 0.42, ease: 'power2.out' }, 0.28)
        .fromTo([left, right], { x: '+=0' }, { x: (i) => (i ? 5 : -5), duration: 0.05, yoyo: true, repeat: 3, ease: 'none' }, 0.22)
        // an old lamp warming up
        .set(lamp, { v: 0.75 }, 0.36)
        .set(lamp, { v: 0.05 }, 0.43)
        .set(lamp, { v: 0.55 }, 0.54)
        .set(lamp, { v: 0.12 }, 0.6)
        .to(lamp, { v: 1, duration: 0.45, ease: 'power2.out' }, 0.7)
        .to('.ld-ui', { opacity: 0, duration: 0.18 }, 0.46)
        .to(el, { backgroundColor: 'rgba(5,14,52,0)', duration: 0.4, ease: 'power2.out' }, 0.48)
        .to(left, { yPercent: 190, rotate: -24, opacity: 0, duration: 0.48, ease: 'power2.in' }, 0.52)
        .to(right, { yPercent: 170, rotate: 26, opacity: 0, duration: 0.48, ease: 'power2.in' }, 0.56)
        .add(open, 0.66)
        .add(() => setGone(true), 1.08);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;
  return (
    <div className="loader" ref={root} role="status" aria-label="Loading">
      <div className="ld-l">
        <div className="ld-wire" />
        <Connector />
      </div>
      <div className="ld-r">
        <Connector male />
        <div className="ld-wire" />
      </div>
      <div className="ld-flash" />
      <div className="ld-ui" aria-hidden>
        <div className="ld-volts">
          <span className="ld-v">0.0</span>
          <span className="ld-u">volts</span>
        </div>
        <div className="ld-bars">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
