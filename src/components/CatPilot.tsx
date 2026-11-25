// The pilot is a cat. Goggles on the forehead, radio in its paws; once the props
// spin up the goggles drop and show real flight footage.
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { media } from '../content';
import { gsap, introIsDone, on, onIntro, reduced } from '../lib/motion';
import { CatHead, COATS, headEdge, LINE, lookAt } from './Kitty';

export interface PilotApi {
  /** 0 goggles up, 1 goggles down */
  goggles(v: number): void;
  /** 0..1: prop wash */
  wind(v: number): void;
}

const c = COATS.grey;
const BODY = 'M96 612C84 500 138 398 240 398C342 398 396 500 384 612Z';
const TAIL = 'M366 560C440 566 462 492 432 442C418 418 430 396 452 398';
const o = { stroke: LINE, strokeWidth: 6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export function CatPilot({ api, start = 'up' }: { api?: Ref<PilotApi>; /** where the goggles start */ start?: 'up' | 'down' }) {
  const root = useRef<HTMLButtonElement>(null);
  const want = useRef(start === 'down' ? 1 : 0);
  const windV = useRef(0);
  const flip = useRef(false);
  const [word, setWord] = useState('');

  useImperativeHandle(api, () => ({
    goggles: (v) => (want.current = v),
    wind: (v) => (windV.current = v),
  }));

  useEffect(() => {
    const el = root.current!;
    const q = (s: string) => Array.from(el.querySelectorAll<SVGGElement>(s));
    const video = el.querySelector('video')!;
    const feed = el.querySelector<HTMLElement>('.cp-feed')!;
    const gog = q('.cp-gog')[0];
    const head = q('.cp-head')[0];
    const pupils = q('.kt-pupil');
    const eyes = q('.kt-eye');
    const ears = q('.kt-ear');
    const ants = q('.cp-ant');
    const tail = q('.cp-tail')[0];
    const scarf = q('.cp-scarf')[0];
    const sticks = q('.cp-stick');
    const paws = q('.cp-paw');
    const calm = reduced();
    const s = { x: 0, y: 0, g: want.current, gv: 0, blink: 0, next: 2, ear: 0, earAt: 3, jolt: 0 };
    let seen = true;
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (calm) return;
      if (seen) video.play().catch(() => undefined);
      else video.pause();
    });
    io.observe(el);
    const offs = [on('startle', () => (s.jolt = 1)), on('smile', (v: boolean) => el.classList.toggle('happy', v))];

    const tick = (time: number, delta: number) => {
      if (!seen) return;
      const dt = Math.min(0.05, delta / 1000);
      const r = el.getBoundingClientRect();
      const p = lookAt();
      const dx = p.x - (r.left + r.width / 2);
      const dy = p.y - (r.top + r.height * 0.42);
      const d = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, d / 220);
      const k = 1 - Math.exp(-dt * 8);
      s.x += ((dx / d) * m - s.x) * k;
      s.y += ((dy / d) * m - s.y) * k;
      s.jolt *= Math.exp(-dt * 5);
      const wd = calm ? 0 : windV.current;
      // goggles swing down on a spring
      const to = flip.current ? 1 - Math.round(want.current) : want.current;
      s.gv += ((to - s.g) * 190 - s.gv * 17) * dt;
      s.g += s.gv * dt;
      const up = 1 - s.g;
      const shake = calm ? 0 : s.jolt * Math.sin(time * 46) * 3;
      const hx = s.x * 8;
      const hy = s.y * 5 + shake + (calm ? 0 : Math.sin(time * 1.8) * 1.6);
      const hr = s.x * 2.6;
      head.setAttribute('transform', `translate(${(240 + hx).toFixed(2)} ${(262 + hy).toFixed(2)}) rotate(${hr.toFixed(2)})`);
      gog.setAttribute('transform', `translate(0 ${(-102 * up).toFixed(2)}) scale(${(1 - up * 0.1).toFixed(3)} ${(1 - up * 0.2).toFixed(3)})`);
      // the screen is HTML so it can hold a video: same move, in the drawing's units
      const u = r.width / 480;
      feed.style.transform = `translate(${(hx * u).toFixed(2)}px, ${((hy - 102 * up) * u).toFixed(2)}px) rotate(${hr.toFixed(2)}deg) scale(${(1 - up * 0.1).toFixed(3)}, ${(1 - up * 0.2).toFixed(3)})`;
      feed.style.opacity = String(Math.max(0, Math.min(1, (s.g - 0.55) / 0.4)));
      video.style.transform = `scale(1.25) rotate(${(s.x * 5).toFixed(1)}deg)`;
      pupils.forEach((g) => g.setAttribute('transform', `translate(${(s.x * 12).toFixed(1)} ${(s.y * 10).toFixed(1)})`));
      s.next -= dt;
      if (s.next < 0) {
        s.blink = 1;
        s.next = 2.2 + Math.random() * 3;
      }
      s.blink = Math.max(0, s.blink - dt * 6);
      const lid = 1 - Math.sin(Math.min(1, s.blink) * Math.PI) * 0.94;
      eyes.forEach((e) => (e.style.transform = `scaleY(${lid.toFixed(3)})`));
      s.earAt -= dt;
      if (s.earAt < 0) {
        s.ear = 1;
        s.earAt = 3 + Math.random() * 5;
      }
      s.ear = Math.max(0, s.ear - dt * 2.4);
      ears.forEach((e, i) => e.setAttribute('transform', `rotate(${((calm ? 0 : Math.sin(s.ear * 22) * 8 * s.ear * (i ? 1 : 0.25) - Math.sin(time * 21 + i) * 5 * wd) + wd * -4 - s.jolt * 5).toFixed(1)} -92 -70)`));
      ants.forEach((a, i) => a.setAttribute('transform', `rotate(${(Math.sin(time * 19 + i) * 8 * wd + s.x * -4 + shake * 2).toFixed(1)} ${i ? 78 : -78} -40)`));
      tail.setAttribute('transform', `rotate(${(calm ? 0 : Math.sin(time * 1.5) * 5 + Math.sin(time * 9) * 5 * wd).toFixed(2)} 366 560)`);
      scarf.setAttribute('transform', `rotate(${(Math.sin(time * 14) * 12 * wd + wd * 26).toFixed(1)} 318 420)`);
      const thr = -0.5 + s.g * 1.1 + wd * 0.3;
      const a = [
        [s.x * 8, -thr * 9],
        [s.x * 9, s.y * 9],
      ];
      sticks.forEach((g, i) => g.setAttribute('transform', `translate(${a[i][0].toFixed(1)} ${a[i][1].toFixed(1)})`));
      paws.forEach((g, i) => g.setAttribute('transform', `translate(${(a[i][0] * 0.8).toFixed(1)} ${(a[i][1] * 0.8).toFixed(1)})`));
    };
    gsap.ticker.add(tick);

    // pops up from behind the bench once the lamp is on
    let tw: gsap.core.Tween | null = null;
    const inner = el.querySelector('.cp-in');
    if (!calm && !introIsDone() && start === 'up') gsap.set(inner, { yPercent: 110 });
    const off = onIntro(() => {
      if (!calm && start === 'up') tw = gsap.to(inner, { yPercent: 0, duration: 1.1, delay: 0.5, ease: 'back.out(1.5)' });
    });
    return () => {
      gsap.ticker.remove(tick);
      io.disconnect();
      off();
      tw?.kill();
      offs.forEach((f) => f());
    };
  }, [start]);

  return (
    <button
      type="button"
      className="catpilot"
      ref={root}
      aria-label="The pilot is a cat. Flip its goggles"
      data-cursor="Goggles"
      data-nolock
      onClick={() => {
        flip.current = !flip.current;
        setWord(flip.current ? 'ready!' : 'meow');
        setTimeout(() => setWord(''), 1400);
      }}
    >
      <span className="cp-in">
        <span className={'kt-say' + (word ? ' on' : '')} aria-hidden>
          {word || 'meow'}
        </span>
        <svg viewBox="0 0 480 608" aria-hidden>
          {/* sticker edge */}
          <g className="kt-edge" style={{ strokeWidth: 22 }}>
            <path d={BODY} />
          </g>
          <g className="cp-tail">
            <path className="kt-edge" d={TAIL} style={{ fill: 'none', strokeWidth: 62 }} />
            <path d={TAIL} fill="none" {...o} strokeWidth="42" />
            <path d={TAIL} fill="none" stroke={c.base} strokeWidth="30" strokeLinecap="round" />
            <path d="M428 434C420 416 432 398 452 398M446 500C448 482 444 464 436 450" fill="none" stroke={c.dark} strokeWidth="30" strokeLinecap="butt" opacity=".75" />
          </g>
          <path d={BODY} fill={c.base} {...o} />
          <path d="M240 410C178 416 160 500 176 612H304C320 500 302 416 240 410Z" fill={c.light} />
          <path d="M104 520l34 8M100 556l36 4M376 520l-34 8M380 556l-36 4" fill="none" stroke={c.dark} strokeWidth="11" strokeLinecap="round" />
          <g className="cp-head" transform="translate(240 262)">
            <g className="kt-edge" style={{ strokeWidth: 22 }}>
              {headEdge}
            </g>
            <CatHead coat="grey">
              <g className="cp-gog">
                <path d="M-158 6C-150 -2 -144 -4 -136 -4M158 6C150 -2 144 -4 136 -4" className="cp-strap" />
                {[-1, 1].map((s) => (
                  <g className="cp-ant" key={s}>
                    <path d={`M${s * 78} -40L${s * 98} -96`} {...o} strokeWidth="9" />
                    <circle cx={s * 100} cy="-102" r="13" fill="#e5322d" {...o} strokeWidth="5" />
                    <circle cx={s * 100 - 4} cy="-106" r="3.6" fill="#ffb3ac" />
                  </g>
                ))}
                <path d="M-112 -46H112C130 -46 142 -34 142 -16V34C142 56 130 66 112 66H40C22 66 18 48 0 48C-18 48 -22 66 -40 66H-112C-130 66 -142 56 -142 34V-16C-142 -34 -130 -46 -112 -46Z" fill="#232b3d" {...o} />
                <path d="M-112 -46H112C130 -46 142 -34 142 -16V-8H-142V-16C-142 -34 -130 -46 -112 -46Z" fill="#3a4763" />
                <rect x="-118" y="-26" width="236" height="70" rx="18" fill="#0c101a" />
                <path d="M-96 34L-58 -26H-26L-64 34ZM-44 34L-6 -26H6L-32 34Z" fill="#fff" opacity=".1" />
                <text x="0" y="22" textAnchor="middle" className="cp-tag">
                  SAAD
                </text>
                <circle cx="122" cy="-34" r="5" className="cp-led" />
              </g>
            </CatHead>
          </g>
          {/* bandana */}
          <path d="M140 408C186 446 294 446 340 408C336 436 300 456 276 462L246 506C242 512 238 512 234 506L204 462C180 456 144 436 140 408Z" fill="#e5322d" {...o} />
          <g className="cp-scarf">
            <path d="M318 420C350 416 372 430 384 452C366 452 350 448 336 442C346 456 348 468 346 480C330 468 318 446 318 420Z" fill="#e5322d" {...o} />
          </g>
          <g fill="#fff" opacity=".9">
            <circle cx="180" cy="432" r="5" />
            <circle cx="212" cy="446" r="5" />
            <circle cx="268" cy="446" r="5" />
            <circle cx="300" cy="432" r="5" />
            <circle cx="240" cy="470" r="5" />
          </g>
          {/* radio */}
          <path d="M214 500L206 462M266 500L274 462" {...o} strokeWidth="9" />
          <path d="M150 516C146 498 158 490 176 490H304C322 490 334 498 330 516L342 612H138Z" fill="#2a3142" {...o} />
          <path d="M150 516C146 498 158 490 176 490H304C322 490 334 498 330 516L331 524H149Z" fill="#3d475e" />
          <rect x="212" y="566" width="56" height="34" rx="5" fill="#9fe08a" {...o} strokeWidth="5" />
          <path d="M220 578h30M220 588h20" stroke="#2f5a2a" strokeWidth="4" strokeLinecap="round" />
          <circle cx="186" cy="546" r="27" fill="#151a26" {...o} strokeWidth="5" />
          <circle cx="294" cy="546" r="27" fill="#151a26" {...o} strokeWidth="5" />
          {[186, 294].map((x) => (
            <g className="cp-stick" key={x}>
              <circle cx={x} cy="546" r="12" fill="#ffc21a" {...o} strokeWidth="4.5" />
            </g>
          ))}
          {[0, 1].map((i) => {
            const X = i ? 336 : 144;
            const s = i ? -1 : 1;
            return (
              <g className="cp-paw" key={i}>
                <path d={`M${X - s * 46} 612C${X - s * 54} 556 ${X - s * 24} 528 ${X + s * 8} 528C${X + s * 34} 528 ${X + s * 46} 548 ${X + s * 38} 566C${X + s * 30} 582 ${X + s * 18} 590 ${X + s * 14} 612Z`} fill={c.light} {...o} />
                <path d={`M${X + s * 12} 546c${s * 8} 4 ${s * 12} 10 ${s * 12} 18M${X - s * 6} 550c${s * 8} 4 ${s * 12} 12 ${s * 12} 20`} fill="none" {...o} strokeWidth="4.5" />
              </g>
            );
          })}
        </svg>
        <span className="cp-feed">
          <video src={media('media/clips/goggles.mp4')} poster={media('media/clips/goggles.webp')} muted loop playsInline preload="metadata" tabIndex={-1} />
          <i />
        </span>
      </span>
    </button>
  );
}
