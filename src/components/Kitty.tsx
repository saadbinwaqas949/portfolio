// The cats. One head, several poses and coats. They watch the lamp, blink,
// twitch an ear, purr when petted and say so when clicked.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { emit, gsap, reduced } from '../lib/motion';
import { getWorld } from '../world/World';

export type Coat = 'grey' | 'ginger' | 'black' | 'cream' | 'calico';
export type Pose = 'peek' | 'sit' | 'loaf' | 'hang';

export const COATS: Record<Coat, { base: string; dark: string; light: string; iris: string }> = {
  grey: { base: '#98a4b8', dark: '#6b778d', light: '#ffffff', iris: '#59d39a' },
  ginger: { base: '#f3a552', dark: '#d27d27', light: '#fff3e2', iris: '#7ac74f' },
  black: { base: '#39404e', dark: '#242a35', light: '#4c5567', iris: '#ffc21a' },
  cream: { base: '#f3e2c4', dark: '#d9bd8e', light: '#fffaf0', iris: '#6bb6f0' },
  calico: { base: '#f6efe6', dark: '#e59a49', light: '#ffffff', iris: '#59c7a8' },
};
export const LINE = '#1a2130';

/** What the cats look at, in client px. */
export function lookAt() {
  const w = getWorld();
  return w ? { x: w.lampPos.x * 100 + w.vw / 2, y: -w.lampPos.y * 100 + w.vh / 2 } : { x: innerWidth / 2, y: innerHeight / 2 };
}

const ln = { fill: 'none', stroke: LINE, strokeWidth: 8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const SKULL = 'M-146 10C-150 -70 -92 -122 0 -122C92 -122 150 -70 146 10C144 82 84 122 0 122C-84 122 -144 82 -146 10Z';
const EAR = 'M-138 -36C-152 -108 -148 -166 -134 -170C-118 -174 -66 -140 -42 -106Z';

/** Outline of the head, for the sticker edge behind a cat. */
export const headEdge = (
  <>
    <path d={SKULL} />
    <path d={EAR} />
    <path d={EAR} transform="scale(-1 1)" />
  </>
);

/** Head around (0,0), 300 wide. `asleep` keeps the eyes shut. */
export function CatHead({ coat, asleep = false, children }: { coat: Coat; asleep?: boolean; children?: ReactNode }) {
  const c = COATS[coat];
  const clip = 'kt-face-' + coat;
  return (
    <g className="kt-head">
      <defs>
        <clipPath id={clip}>
          <path d={SKULL} />
        </clipPath>
      </defs>
      {[1, -1].map((s) => (
        <g key={s} transform={`scale(${s} 1)`}>
          <g className="kt-ear">
            <path d={EAR} fill={coat === 'calico' && s < 0 ? c.dark : c.base} stroke={LINE} strokeWidth="8" strokeLinejoin="round" />
            <path d="M-122 -62C-130 -110 -128 -138 -122 -142C-112 -142 -84 -124 -68 -102Z" fill="#ff9fa0" />
          </g>
        </g>
      ))}
      <path d={SKULL} fill={c.base} />
      <g clipPath={`url(#${clip})`}>
        {coat === 'calico' ? (
          <>
            <path d="M0 -130C60 -130 160 -110 160 10C120 20 80 -10 60 -50C40 -80 10 -90 0 -130Z" fill={c.dark} />
            <path d="M-160 -130H-20C-30 -90 -60 -70 -90 -60C-120 -50 -150 -30 -160 0Z" fill="#4a4f5c" />
          </>
        ) : null}
        <path d="M0 -44C-15 -12 -30 8 -66 24C-112 42 -118 96 -62 116C-40 122 -20 126 0 126C20 126 40 122 62 116C118 96 112 42 66 24C30 8 15 -12 0 -44Z" fill={c.light} />
        {coat === 'calico' ? null : <path d="M0 -120V-80M-28 -116L-21 -86M28 -116L21 -86M-150 18L-116 22M-146 46L-114 42M150 18L116 22M146 46L114 42" stroke={c.dark} strokeWidth="11" strokeLinecap="round" fill="none" />}
      </g>
      <ellipse cx="-100" cy="56" rx="21" ry="13" fill="#ff8d94" opacity=".45" />
      <ellipse cx="100" cy="56" rx="21" ry="13" fill="#ff8d94" opacity=".45" />
      <path d={SKULL} {...ln} />
      {asleep ? (
        <path d="M-88 8C-78 24 -46 24 -36 8M36 8C46 24 78 24 88 8" {...ln} />
      ) : (
        <>
          {[-62, 62].map((x) => (
            <g className="kt-eye" key={x} style={{ transformOrigin: `${x}px 6px` }}>
              <ellipse cx={x} cy="6" rx="35" ry="38" fill={c.iris} stroke={LINE} strokeWidth="7" />
              <g className="kt-pupil">
                <ellipse cx={x} cy="6" rx="22" ry="29" fill="#0d111b" />
                <circle cx={x + 9} cy="-8" r="9" fill="#fff" />
                <circle cx={x - 8} cy="18" r="4.6" fill="#fff" opacity=".85" />
              </g>
            </g>
          ))}
          <path className="kt-happy" d="M-92 14C-82 -14 -42 -14 -32 14M32 14C42 -14 82 -14 92 14" {...ln} />
        </>
      )}
      <path d="M-13 44C-6 39 6 39 13 44C12 54 4 60 0 60C-4 60 -12 54 -13 44Z" fill="#ff7d8b" stroke={LINE} strokeWidth="5" strokeLinejoin="round" />
      <path d="M0 60V68M0 68C-6 86 -30 88 -38 74M0 68C6 86 30 88 38 74" {...ln} strokeWidth="6.5" />
      <path d="M-92 58L-176 46M-92 70L-172 80M92 58L176 46M92 70L172 80" {...ln} strokeWidth="4" opacity=".75" />
      {children}
    </g>
  );
}

const paw = (x: number, y: number, c: (typeof COATS)[Coat], w = 24, h = 26, cls = '') => (
  <g className={cls}>
    <path d={`M${x - w} ${y + h}C${x - w - 4} ${y - 4} ${x - w * 0.6} ${y - h * 0.7} ${x} ${y - h * 0.7}C${x + w * 0.6} ${y - h * 0.7} ${x + w + 4} ${y - 4} ${x + w} ${y + h}Z`} fill={c.light} stroke={LINE} strokeWidth="4.4" strokeLinejoin="round" />
    <path d={`M${x - 7} ${y + 4}v${h - 6}M${x + 7} ${y + 4}v${h - 6}`} stroke={LINE} strokeWidth="3.4" strokeLinecap="round" />
  </g>
);

const BOX: Record<Pose, string> = { peek: '0 0 200 150', sit: '0 0 200 262', loaf: '0 0 260 150', hang: '0 0 170 280' };
const SAY = ['meow', 'mrrp', 'purr', 'mew mew', 'prrrt', 'meow meow'];
let said = 0;

export function Kitty({ coat = 'grey', pose = 'sit', className = '', style, flip = false, cheer = 0, say }: { coat?: Coat; pose?: Pose; className?: string; style?: CSSProperties; flip?: boolean; /** hop whenever this changes */ cheer?: number; say?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [word, setWord] = useState('');
  const c = COATS[coat];

  useEffect(() => {
    if (cheer && ref.current && !reduced()) gsap.fromTo(ref.current.querySelector('svg'), { y: 0 }, { keyframes: [{ y: -34, scaleY: 1.06, duration: 0.2, ease: 'power2.out' }, { y: 0, scaleY: 0.92, duration: 0.18, ease: 'power2.in' }, { scaleY: 1, duration: 0.2 }], transformOrigin: '50% 100%', repeat: 2 });
  }, [cheer]);

  useEffect(() => {
    const el = ref.current!;
    const q = (s: string) => Array.from(el.querySelectorAll<SVGGElement>(s));
    const eyes = q('.kt-eye');
    const pupils = q('.kt-pupil');
    const ears = q('.kt-ear');
    const tail = q('.kt-tail')[0];
    const head = q('.kt-hd')[0];
    const bat = q('.kt-bat')[0];
    const calm = reduced();
    const s = { x: 0, y: 0, blink: 0, next: 1 + Math.random() * 4, ear: 0, earAt: 2 + Math.random() * 5, bat: 0, cool: 0 };
    const seed = Math.random() * 9;
    let on = false;
    const tick = (time: number, delta: number) => {
      const dt = Math.min(0.05, delta / 1000);
      const r = el.getBoundingClientRect();
      const p = lookAt();
      const dx = p.x - (r.left + r.width / 2);
      const dy = p.y - (r.top + r.height * 0.4);
      const d = Math.hypot(dx, dy) || 1;
      const k = 1 - Math.exp(-dt * 9);
      const m = Math.min(1, d / 160);
      s.x += ((dx / d) * m * (flip ? -1 : 1) - s.x) * k;
      s.y += ((dy / d) * m - s.y) * k;
      pupils.forEach((g) => g.setAttribute('transform', `translate(${(s.x * 11).toFixed(1)} ${(s.y * 9).toFixed(1)})`));
      s.next -= dt;
      if (s.next < 0) {
        s.blink = 1;
        s.next = 2 + Math.random() * 4;
      }
      s.blink = Math.max(0, s.blink - dt * 6);
      const lid = 1 - Math.sin(Math.min(1, s.blink) * Math.PI) * 0.94;
      eyes.forEach((e) => (e.style.transform = `scaleY(${lid.toFixed(3)})`));
      s.earAt -= dt;
      if (s.earAt < 0) {
        s.ear = 1;
        s.earAt = 3 + Math.random() * 6;
      }
      s.ear = Math.max(0, s.ear - dt * 2.4);
      ears.forEach((e, i) => e.setAttribute('transform', `rotate(${((calm ? 0 : Math.sin(s.ear * 22) * 9 * s.ear * (i ? 1 : 0.2)) - s.x * 2).toFixed(1)} -92 -70)`));
      if (tail) tail.setAttribute('transform', `rotate(${(calm ? 0 : Math.sin(time * 1.7 + seed) * 9 + Math.sin(time * 3.1 + seed) * 3).toFixed(1)} ${tail.dataset.o})`);
      if (head) head.setAttribute('transform', `rotate(${(s.x * 4 + (calm ? 0 : Math.sin(time * 1.1 + seed) * 1)).toFixed(2)}) translate(${(s.x * 5).toFixed(1)} ${(s.y * 4 + (calm ? 0 : Math.sin(time * 1.9 + seed) * 1.5)).toFixed(1)})`);
      if (bat) {
        s.cool -= dt;
        if (d < r.width * 1.5 && s.cool < 0 && !calm) {
          s.bat = 1;
          s.cool = 1.1 + Math.random();
        }
        s.bat = Math.max(0, s.bat - dt * 2.1);
        const b = Math.sin(s.bat * Math.PI) * (0.75 + 0.25 * Math.sin(s.bat * 18));
        bat.setAttribute('transform', `translate(0 ${(-b * 62).toFixed(1)}) rotate(${(-b * 26).toFixed(1)} 136 214)`);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) gsap.ticker.add(tick);
      if (!e.isIntersecting && on) gsap.ticker.remove(tick);
      on = e.isIntersecting;
    });
    io.observe(el);
    return () => {
      io.disconnect();
      gsap.ticker.remove(tick);
    };
  }, [coat, pose, flip]);

  const pet = () => {
    setWord(say ?? SAY[said++ % SAY.length]);
    emit('startle');
    setTimeout(() => setWord(''), 1500);
  };
  const head = (x: number, y: number, k: number, asleep = false, tilt = 0) => (
    <g transform={`translate(${x} ${y}) scale(${k}) rotate(${tilt})`}>
      <g className="kt-hd">
        <CatHead coat={coat} asleep={asleep} />
      </g>
    </g>
  );
  const edge = (x: number, y: number, k: number, tilt = 0) => (
    <g transform={`translate(${x} ${y}) scale(${k}) rotate(${tilt})`} className="kt-edge" style={{ strokeWidth: 15 / k }}>
      {headEdge}
    </g>
  );

  return (
    <button type="button" ref={ref} className={`kitty kt-${pose} ${className}`} style={style} aria-label="Pet the cat" data-cursor="Pet" data-nolock onClick={pet}>
      <span className={'kt-say' + (word ? ' on' : '')} aria-hidden>
        {word || 'meow'}
      </span>
      <i className="kt-heart" aria-hidden />
      <svg viewBox={BOX[pose]} style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden>
        {pose === 'peek' ? (
          <>
            {edge(100, 92, 0.5)}
            {head(100, 92, 0.5)}
            {paw(46, 134, c, 19, 20)}
            {paw(154, 134, c, 19, 20)}
          </>
        ) : null}
        {pose === 'sit' ? (
          <>
            <g className="kt-edge" style={{ strokeWidth: 15 }}>
              <path d="M46 262C30 200 52 136 100 136C148 136 170 200 154 262Z" />
            </g>
            {edge(100, 92, 0.5)}
            <g className="kt-tail" data-o="150 248">
              <path className="kt-edge" d="M150 248C186 240 196 206 186 176" style={{ fill: 'none', strokeWidth: 38 }} />
              <path d="M150 248C186 240 196 206 186 176" fill="none" stroke={LINE} strokeWidth="25" strokeLinecap="round" />
              <path d="M150 248C186 240 196 206 186 176" fill="none" stroke={c.base} strokeWidth="16" strokeLinecap="round" />
              <path d="M188 190C189 185 188 180 186 176" fill="none" stroke={c.dark} strokeWidth="16" strokeLinecap="round" />
            </g>
            <path d="M46 262C30 200 52 136 100 136C148 136 170 200 154 262Z" fill={c.base} stroke={LINE} strokeWidth="4.6" strokeLinejoin="round" />
            <path d="M100 150C72 152 66 200 78 240H122C134 200 128 152 100 150Z" fill={c.light} />
            {head(100, 92, 0.5)}
            {paw(64, 236, c)}
            {paw(136, 236, c, 24, 26, 'kt-bat')}
          </>
        ) : null}
        {pose === 'loaf' ? (
          <>
            <g className="kt-edge" style={{ strokeWidth: 15 }}>
              <path d="M30 150C22 96 80 62 146 62C214 62 250 100 244 150Z" />
            </g>
            {edge(82, 92, 0.42)}
            <path d="M30 150C22 96 80 62 146 62C214 62 250 100 244 150Z" fill={c.base} stroke={LINE} strokeWidth="4.6" strokeLinejoin="round" />
            <path d="M150 66L154 88M176 68L176 90M202 78L197 98" stroke={c.dark} strokeWidth="7" strokeLinecap="round" />
            <g className="kt-tail" data-o="236 142">
              <path d="M238 140C206 154 160 146 138 138" fill="none" stroke={LINE} strokeWidth="24" strokeLinecap="round" />
              <path d="M238 140C206 154 160 146 138 138" fill="none" stroke={c.base} strokeWidth="15" strokeLinecap="round" />
              <path d="M150 142C146 141 142 139 138 138" fill="none" stroke={c.dark} strokeWidth="15" strokeLinecap="round" />
            </g>
            {head(82, 92, 0.42, true, 5)}
            <g className="kt-zzz">
              <path d="M24 34h12l-12 14h12" />
              <path d="M4 10h9l-9 11h9" />
            </g>
          </>
        ) : null}
        {pose === 'hang' ? (
          <>
            <g className="kt-edge" style={{ strokeWidth: 15 }}>
              <path d="M44 14L58 100M126 14L112 100" style={{ fill: 'none', strokeWidth: 46 }} />
              <path d="M50 140C40 210 56 262 85 262C114 262 130 210 120 140Z" />
            </g>
            {edge(85, 108, 0.44)}
            <g className="kt-tail" data-o="112 244">
              <path d="M108 246C140 252 150 228 142 206" fill="none" stroke={LINE} strokeWidth="22" strokeLinecap="round" />
              <path d="M108 246C140 252 150 228 142 206" fill="none" stroke={c.base} strokeWidth="14" strokeLinecap="round" />
            </g>
            <path d="M50 140C40 210 56 262 85 262C114 262 130 210 120 140Z" fill={c.base} stroke={LINE} strokeWidth="4.6" />
            <path d="M85 150C66 154 62 200 70 232H100C108 200 104 154 85 150Z" fill={c.light} />
            {[42, 128].map((x, i) => (
              <g key={x}>
                <path d={`M${x} 18L${i ? 112 : 58} 104`} stroke={LINE} strokeWidth="32" strokeLinecap="round" />
                <path d={`M${x} 18L${i ? 112 : 58} 104`} stroke={c.base} strokeWidth="23" strokeLinecap="round" />
                <circle cx={x} cy="18" r="15" fill={c.light} stroke={LINE} strokeWidth="4.4" />
              </g>
            ))}
            {head(85, 108, 0.44)}
            <ellipse cx="66" cy="264" rx="17" ry="13" fill={c.light} stroke={LINE} strokeWidth="4.4" />
            <ellipse cx="104" cy="264" rx="17" ry="13" fill={c.light} stroke={LINE} strokeWidth="4.4" />
          </>
        ) : null}
      </svg>
    </button>
  );
}
