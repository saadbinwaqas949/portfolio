// Baby clothes on a line. Each piece is a little pendulum: wind moves them, so
// does brushing past with the cursor, and you can pull them.
import { Kitty } from './Kitty';
import { useEffect, useRef, type ReactNode } from 'react';
import { gsap, reduced } from '../lib/motion';

const INK = 'var(--cl-ink)';
interface Piece {
  x: number;
  fill: string;
  body: string;
  extra: ReactNode;
  long: number;
}

const PIECES: Piece[] = [
  {
    x: 90,
    fill: '#ffd257',
    body: 'M-30 8L-16 3Q0 18 16 3L30 8L54 32L38 50L29 43V92Q29 104 17 108L9 120H-9L-17 108Q-29 104-29 92V43L-38 50L-54 32Z',
    extra: <path d="M-8 119Q0 110 8 119M-13 60h.1M0 60h.1M13 60h.1" stroke={INK} strokeWidth="5" />,
    long: 120,
  },
  {
    x: 258,
    fill: '#ff8f86',
    body: 'M-18 2Q0 24 18 2Q40 14 37 50Q33 92 0 95Q-33 92-37 50Q-40 14-18 2Z',
    extra: <path d="M-14 56Q0 72 14 56M-11 42v.1M11 42v.1" stroke={INK} strokeWidth="5" fill="none" />,
    long: 95,
  },
  {
    x: 412,
    fill: '#9ed8ff',
    body: 'M-34 4H34L41 122H9L3 48H-3L-9 122H-41Z',
    extra: <path d="M-33 20H33M16 34Q22 46 32 40" stroke={INK} strokeWidth="4" fill="none" />,
    long: 122,
  },
  {
    x: 566,
    fill: '#b6f0cf',
    body: 'M-40 66Q-40 12 0 12Q40 12 40 66Z M-46 64H46V86H-46Z',
    extra: <path d="M-24 64V86M-8 64V86M8 64V86M24 64V86" stroke={INK} strokeWidth="3.4" />,
    long: 86,
  },
  {
    x: 712,
    fill: '#ffffff',
    body: 'M-40 4H-16V58Q-16 66-8 70L2 76Q10 82 4 92Q-2 98-14 94L-32 84Q-40 80-40 68Z M8 4H32V58Q32 66 40 70L50 76Q58 82 52 92Q46 98 34 94L16 84Q8 80 8 68Z',
    extra: <path d="M-40 18H-16M8 18H32M-40 28H-16M8 28H32" stroke="#e5322d" strokeWidth="5" />,
    long: 92,
  },
  {
    x: 880,
    fill: '#d9c6ff',
    body: 'M-26 5L-12 1Q0 13 12 1L26 5L52 30L36 48L27 40V112H-27V40L-36 48L-52 30Z',
    extra: <path d="M0 52l7 14 15 2-11 10 3 15-14-7-14 7 3-15-11-10 15-2z" fill="#ffc21a" stroke={INK} strokeWidth="4" />,
    long: 112,
  },
];

const LINE_Y = 46;
const sag = (x: number) => LINE_Y + Math.sin((x / 980) * Math.PI) * 34;

export function Clothesline() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current!;
    const gs = Array.from(svg.querySelectorAll<SVGGElement>('.cl-piece'));
    const rope = svg.querySelector<SVGPathElement>('.cl-rope')!;
    const s = PIECES.map((_, i) => ({ a: 0, v: 0, ph: i * 1.7 }));
    let px = 0;
    let py = 0;
    let lastX = 0;
    let vel = 0;
    let on = false;
    let grab = -1;
    const local = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * 980;
      py = ((e.clientY - r.top) / r.height) * 250;
    };
    const move = (e: PointerEvent) => {
      local(e);
      vel = px - lastX;
      lastX = px;
      if (grab >= 0) return;
      PIECES.forEach((p, i) => {
        const dy = py - sag(p.x);
        if (dy > -8 && dy < p.long + 24 && Math.abs(px - p.x) < 60) s[i].v += vel * 0.02;
      });
    };
    const down = (e: PointerEvent) => {
      local(e);
      grab = PIECES.findIndex((p) => Math.abs(px - p.x) < 56 && py > sag(p.x) - 8 && py < sag(p.x) + p.long + 16);
      if (grab >= 0) svg.setPointerCapture(e.pointerId);
    };
    const up = () => (grab = -1);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);

    let t = 0;
    const tick = (_: number, d: number) => {
      const dt = Math.min(0.033, d / 1000);
      t += dt;
      const calm = reduced() ? 0 : 1;
      let pull = 0;
      let pullX = 490;
      PIECES.forEach((p, i) => {
        const q = s[i];
        if (grab === i) {
          const want = Math.atan2(-(px - p.x), Math.max(10, py - sag(p.x)));
          q.v += (want - q.a) * 90 * dt - q.v * 10 * dt;
          pull = Math.max(0, Math.min(34, Math.hypot(px - p.x, py - sag(p.x)) - p.long));
          pullX = p.x;
        }
        const wind = (Math.sin(t * 1.1 + q.ph) + Math.sin(t * 2.7 + q.ph * 2) * 0.5) * 0.5 * calm;
        q.v += (-q.a * 26 + wind - q.v * 1.5) * dt;
        q.a += q.v * dt;
      });
      PIECES.forEach((p, i) => {
        const bend = pull * Math.exp(-((p.x - pullX) ** 2) / 22000);
        gs[i].setAttribute('transform', `translate(${p.x} ${(sag(p.x) + bend).toFixed(2)}) rotate(${((s[i].a * 180) / Math.PI).toFixed(2)})`);
      });
      const pts: string[] = [];
      for (let x = 0; x <= 980; x += 35) pts.push(`${x} ${(sag(x) + pull * Math.exp(-((x - pullX) ** 2) / 22000)).toFixed(1)}`);
      rope.setAttribute('d', 'M' + pts.join('L'));
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) {
        on = true;
        gsap.ticker.add(tick);
      } else if (!e.isIntersecting && on) {
        on = false;
        gsap.ticker.remove(tick);
      }
    });
    io.observe(svg);
    return () => {
      io.disconnect();
      gsap.ticker.remove(tick);
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerdown', down);
      svg.removeEventListener('pointerup', up);
      svg.removeEventListener('pointercancel', up);
    };
  }, []);

  return (
    <div className="clothes-wrap">
    <svg ref={ref} className="clothes" viewBox="0 0 980 250" role="img" aria-label="Baby clothes hanging on a washing line" style={{ touchAction: 'pan-y' }} data-cursor="Tug">
      <path className="cl-rope" d="M0 46L980 46" fill="none" strokeLinecap="round" />
      {PIECES.map((p, i) => (
        <g className="cl-piece" key={i} transform={`translate(${p.x} ${sag(p.x)})`}>
          <path className="cl-back" d={p.body} strokeLinejoin="round" />
          <path className="cl-fill" d={p.body} fill={p.fill} />
          <path className="cl-line" d={p.body} style={{ ['--pc' as string]: p.fill }} strokeLinejoin="round" />
          <g strokeLinecap="round" strokeLinejoin="round">
            {p.extra}
          </g>
          {[-15, 15].map((x) => (
            <rect key={x} x={x - 4} y={-12} width="8" height="26" rx="3" className="cl-peg" />
          ))}
        </g>
      ))}
    </svg>
      <Kitty pose="hang" coat="grey" className="on-line" say="hang on" />
    </div>
  );
}
