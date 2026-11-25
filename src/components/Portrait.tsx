// Line-art Saad, as a die-cut sticker. Eyes follow the cursor, he blinks, his
// head turns a little, and the FPV goggles drop over his glasses when he flies.
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { gsap, on, onIntro, reduced } from '../lib/motion';
import { getWorld } from '../world/World';

export interface PortraitApi {
  /** 0 = goggles up in the hair, 1 = over the eyes */
  goggles(v: number): void;
  /** 0..1 wind from the props */
  wind(v: number): void;
}

const INK = '#0b1433';
let uid = 0;

export function Portrait({ className = '', api, start = 'up' }: { className?: string; api?: Ref<PortraitApi>; start?: 'up' | 'down' }) {
  const root = useRef<SVGSVGElement>(null);
  const id = useRef('pt' + ++uid).current;
  const gog = useRef({ v: start === 'down' ? 1 : 0, scrub: 0, held: start === 'down' });
  const wind = useRef(0);

  useImperativeHandle(api, () => ({
    goggles: (v) => (gog.current.scrub = v),
    wind: (v) => (wind.current = v),
  }));

  useEffect(() => {
    const svg = root.current!;
    const q = <T extends SVGElement>(s: string) => Array.from(svg.querySelectorAll<T>(s));
    const irises = q('.pt-iris');
    const leds = q('.pt-led');
    const eyes = q('.pt-eye');
    const goggles = svg.querySelector<SVGGElement>('.pt-gog')!;
    const brows = svg.querySelector<SVGGElement>('.pt-brows')!;
    const mouth = svg.querySelector<SVGGElement>('.pt-mouth')!;
    const grin = svg.querySelector<SVGGElement>('.pt-grin')!;
    const hairs = q('.pt-hair');
    const layers = q<SVGGElement>('[data-z]').map((g) => ({ g, z: parseFloat(g.dataset.z!) }));
    const glare = q('.pt-glare');
    const calm = reduced();

    let lx = 0;
    let ly = 0;
    let happy = 0;
    let happyWant = 0;
    let blink = 0;
    let nextBlink = 2.5;
    let goggleV = gog.current.v;
    let startle = 0;

    const offs = [
      on('smile', (v: boolean) => (happyWant = v ? 1 : 0)),
      on('startle', () => (startle = 1)),
    ];

    const tick = (time: number, delta: number) => {
      const dt = Math.min(0.05, delta / 1000);
      const r = svg.getBoundingClientRect();
      if (r.bottom < -50 || r.top > innerHeight + 50 || !r.width) return;
      // look where the lamp is; on touch that is the wandering light
      const w = getWorld();
      let px: number;
      let py: number;
      if (w) {
        px = w.lampPos.x * 100 + w.vw / 2;
        py = -w.lampPos.y * 100 + w.vh / 2;
      } else {
        px = innerWidth / 2;
        py = innerHeight / 2;
      }
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * 0.46;
      const dx = px - cx;
      const dy = py - cy;
      const d = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, d / 260);
      const tx = (dx / d) * m;
      const ty = (dy / d) * m;
      const k = 1 - Math.exp(-dt * 10);
      lx += (tx - lx) * k;
      ly += (ty - ly) * k;

      for (const i of irises) i.setAttribute('transform', `translate(${(lx * 10).toFixed(2)} ${(ly * 6.5).toFixed(2)})`);
      for (const l of leds) l.setAttribute('transform', `translate(${Math.round(lx * 3) * 6} ${Math.round(ly * 1.4) * 6})`);
      if (!calm) for (const { g, z } of layers) g.setAttribute('transform', `translate(${(lx * z * 7).toFixed(2)} ${(ly * z * 4.5).toFixed(2)})`);
      for (const g of glare) g.setAttribute('transform', `translate(${(-lx * 9).toFixed(1)} ${(-ly * 7).toFixed(1)})`);

      // blinking
      if (time > nextBlink) {
        blink = 1;
        nextBlink = time + 1.8 + Math.random() * 3.6;
        if (Math.random() < 0.2) nextBlink = time + 0.24;
      }
      blink = Math.max(0, blink - dt * 6.5);
      const shut = Math.sin(Math.min(1, blink) * Math.PI);
      const open = Math.max(0.06, 1 - shut) * (1 + startle * 0.28);
      for (const e of eyes) e.style.transform = `scaleY(${open.toFixed(3)})`;

      startle = Math.max(0, startle - dt * 1.1);
      happy += (happyWant - happy) * (1 - Math.exp(-dt * 9));
      brows.style.transform = `translate(0, ${(-ly * -3 - happy * 5 - startle * 12).toFixed(2)}px)`;
      mouth.style.opacity = happy > 0.5 ? '0' : '1';
      grin.style.opacity = happy > 0.5 ? '1' : '0';
      grin.style.transform = `scaleY(${(0.5 + happy * 0.5).toFixed(3)})`;

      // goggles: scrubbed by the take-off, or toggled by a click
      const g = gog.current;
      const want = Math.max(g.scrub, g.held ? 1 : 0);
      goggleV += (want - goggleV) * (1 - Math.exp(-dt * 11));
      const bob = wind.current * Math.sin(time * 34) * 1.2;
      goggles.setAttribute(
        'transform',
        `translate(${(lx * 9).toFixed(2)} ${(goggleV * 152 + ly * 5 + bob).toFixed(2)}) rotate(${(-5 * (1 - goggleV)).toFixed(2)} 210 90) `,
      );
      svg.style.setProperty('--led', goggleV > 0.82 ? '1' : '0');
      for (let i = 0; i < hairs.length; i++) {
        const s = wind.current * (6 + i * 3) * (0.7 + 0.3 * Math.sin(time * 21 + i));
        hairs[i].style.transform = `skewX(${(s + lx * -1.4).toFixed(2)}deg)`;
      }
    };
    gsap.ticker.add(tick);

    const ctx = gsap.context(() => {}, svg);
    const offIntro = onIntro(() => {
      if (calm) return;
      ctx.add(() => {
        gsap
          .timeline({ delay: 0.45 })
          .fromTo('.pt-all', { y: 300, rotate: 5, transformOrigin: '50% 100%' }, { y: 0, rotate: 0, duration: 1.0, ease: 'back.out(1.15)' })
          .fromTo('.pt-ln', { drawSVG: '0%' }, { drawSVG: '100%', duration: 1.1, stagger: 0.025, ease: 'power2.inOut' }, 0.35)
          .fromTo('.pt-fl', { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.04 }, 0.9)
          .fromTo('.pt-drop', { y: -190, rotate: 18, opacity: 0, transformOrigin: '50% 50%' }, { y: 0, rotate: 0, opacity: 1, duration: 0.8, ease: 'bounce.out' }, 1.35);
      });
    });

    const click = () => {
      gog.current.held = !gog.current.held;
      startle = gog.current.held ? 0 : 1;
    };
    svg.addEventListener('click', click);
    return () => {
      gsap.ticker.remove(tick);
      offs.forEach((f) => f());
      offIntro();
      ctx.revert();
      svg.removeEventListener('click', click);
    };
  }, []);

  const ln = { className: 'pt-ln', stroke: INK, strokeWidth: 5 } as const;
  return (
    <svg
      ref={root}
      className={'portrait ' + className}
      viewBox="0 0 420 520"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Line drawing of Saad with round glasses and FPV goggles pushed up into his hair. His eyes follow your cursor."
      data-cursor="Goggles"
    >
      <defs>
        <pattern id={id + 'dots'} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <circle cx="3.5" cy="3.5" r="1.75" fill="#ff6b5c" />
        </pattern>
        <pattern id={id + 'hatch'} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2.6" height="7" fill="#7fa8ff" />
        </pattern>
        <clipPath id={id + 'eL'}>
          <path d="M149 237 Q170 214 193 235 Q173 254 149 237Z" />
        </clipPath>
        <clipPath id={id + 'eR'}>
          <path d="M227 235 Q250 214 271 237 Q247 254 227 235Z" />
        </clipPath>
      </defs>
      <g className="pt-all">
        {/* die-cut paper */}
        <g fill="#fff" stroke="#fff" strokeWidth="27">
          <path d="M46 560 C48 470 60 432 100 414 C130 400 160 396 168 380 L252 380 C260 396 290 400 320 414 C360 432 372 470 374 560Z" />
          <path d="M120 222 C104 170 106 118 138 90 C166 62 246 58 280 86 C316 114 316 174 300 222 C304 286 296 290 268 320 C256 336 254 360 254 384 H166 C166 360 164 336 152 320 C124 290 118 262 120 222Z" />
          <path d="M124 222 C106 210 98 230 106 252 C111 268 124 272 130 264Z M296 222 C314 210 322 230 314 252 C309 268 296 272 290 264Z" />
        </g>

        {/* shirt: the fill sits a few px off the line, like a cheap print */}
        <g className="pt-fl" transform="translate(6 6)">
          <path d="M46 560 C48 470 60 432 100 414 C130 400 160 396 168 380 L252 380 C260 396 290 400 320 414 C360 432 372 470 374 560 Z" fill="#cfe2ff" />
          <path d="M286 408 C340 424 366 460 374 560 H296 C306 490 306 440 286 408Z" fill="#a5c5ff" />
        </g>
        <path {...ln} d="M44 560 C48 470 60 432 100 414 C112 408 124 405 134 402" strokeWidth="5.5" />
        <path {...ln} d="M376 560 C372 470 360 432 320 414 C308 408 296 405 286 402" strokeWidth="5.5" />

        {/* neck */}
        <path className="pt-fl" d="M174 342 C190 366 232 366 246 342 L250 376 C228 396 192 394 170 376Z" fill={`url(#${id}hatch)`} />
        <path {...ln} d="M171 336 C173 354 172 370 164 382" />
        <path {...ln} d="M249 336 C247 354 248 370 256 382" />

        {/* collar */}
        <path d="M166 380 L134 404 L178 444 L210 410 L242 444 L286 404 L254 380 C236 404 184 404 166 380Z" fill="#fff" />
        <path {...ln} d="M166 380 L134 404 L178 444 L210 410 L242 444 L286 404 L254 380 C236 404 184 404 166 380Z" />
        <path {...ln} d="M210 410 V500" />
        <circle className="pt-fl" cx="223" cy="444" r="4.2" fill={INK} />
        <circle className="pt-fl" cx="223" cy="474" r="4.2" fill={INK} />

        {/* head */}
        <g data-z="-0.5">
          <path {...ln} d="M124 222 C106 210 98 230 106 252 C111 268 124 272 130 264" fill="#fff" />
          <path {...ln} d="M296 222 C314 210 322 230 314 252 C309 268 296 272 290 264" fill="#fff" />
          <path {...ln} d="M112 232 C116 232 120 240 118 250" strokeWidth="4" />
          <path {...ln} d="M308 232 C304 232 300 240 302 250" strokeWidth="4" />
        </g>
        <g data-z="0.15">
          <path d="M124 186 C120 240 124 286 152 320 C176 350 244 350 268 320 C296 286 300 240 296 186 Z" fill="#fff" />
          <path className="pt-fl" d="M266 190 C284 230 288 288 252 333 C282 318 300 270 297 190Z" fill="#dbe8ff" />
          <path {...ln} d="M124 190 C120 242 124 286 152 320 C176 350 244 350 268 320 C296 286 300 242 296 190" strokeWidth="5.5" />
        </g>
        <g data-z="0.7">
          <circle className="pt-fl" cx="148" cy="287" r="17" fill={`url(#${id}dots)`} />
          <circle className="pt-fl" cx="270" cy="287" r="17" fill={`url(#${id}dots)`} />
          <g className="pt-mouth">
            <path {...ln} d="M180 304 Q212 324 244 300" />
            <path {...ln} d="M200 323 Q212 328 224 322" strokeWidth="3.5" />
          </g>
          <g className="pt-grin" style={{ opacity: 0, transformOrigin: '212px 300px' }}>
            <path d="M174 298 Q212 306 250 296 C248 332 180 336 174 298Z" fill={INK} stroke={INK} strokeWidth="5" />
            <path d="M181 303 Q212 309 243 301 L241 309 Q212 317 184 311Z" fill="#fff" />
            <path d="M196 324 Q212 316 230 322 Q212 332 196 324Z" fill="#ff6b5c" />
          </g>
        </g>
        <g data-z="1.25">
          <path {...ln} d="M212 238 C210 256 200 269 205 277 C210 284 220 282 224 277" strokeWidth="4.5" />
        </g>

        {/* glasses: lens, then eyes, then frame, then glare */}
        <g data-z="0.95">
          <ellipse className="pt-fl" cx="170" cy="238" rx="37" ry="33" fill="#d9ecff" />
          <ellipse className="pt-fl" cx="250" cy="238" rx="37" ry="33" fill="#d9ecff" />
          <g className="pt-eye" style={{ transformOrigin: '171px 236px' }}>
            <path d="M149 237 Q170 214 193 235 Q173 254 149 237Z" fill="#fff" />
            <g clipPath={`url(#${id}eL)`}>
              <g className="pt-iris">
                <circle cx="171" cy="235" r="11" fill={INK} />
                <circle cx="175" cy="230.5" r="3.4" fill="#fff" />
              </g>
            </g>
            <path d="M147 237 Q170 211 195 234" stroke={INK} strokeWidth="5" />
          </g>
          <g className="pt-eye" style={{ transformOrigin: '249px 236px' }}>
            <path d="M227 235 Q250 214 271 237 Q247 254 227 235Z" fill="#fff" />
            <g clipPath={`url(#${id}eR)`}>
              <g className="pt-iris">
                <circle cx="249" cy="235" r="11" fill={INK} />
                <circle cx="253" cy="230.5" r="3.4" fill="#fff" />
              </g>
            </g>
            <path d="M225 234 Q250 211 273 237" stroke={INK} strokeWidth="5" />
          </g>
        </g>
        <g data-z="0.85">
          <g className="pt-brows">
            <path className="pt-ln" d="M142 203 Q166 187 196 198" stroke={INK} strokeWidth="9.5" />
            <path className="pt-ln" d="M224 198 Q254 187 278 203" stroke={INK} strokeWidth="9.5" />
          </g>
        </g>
        <g data-z="1.1">
          <ellipse {...ln} cx="170" cy="238" rx="37" ry="33" />
          <ellipse {...ln} cx="250" cy="238" rx="37" ry="33" />
          <path {...ln} d="M206 233 Q210 225 214 233" />
          <path {...ln} d="M133 233 L121 227" />
          <path {...ln} d="M287 233 L299 227" />
          <g className="pt-glare" stroke="#fff" strokeWidth="5.5">
            <path d="M150 224 L164 212" />
            <path d="M157 232 L166 224" strokeWidth="3.5" />
            <path d="M230 224 L244 212" />
            <path d="M237 232 L246 224" strokeWidth="3.5" />
          </g>
        </g>

        {/* hair */}
        <g data-z="0.45">
          <g className="pt-hair" style={{ transformOrigin: '210px 220px' }}>
            <path
              className="pt-fl"
              d="M120 224 C102 170 104 116 138 88 C168 60 250 56 284 86 C318 116 318 176 300 224 C301 202 297 184 287 169 C262 178 238 167 226 148 C206 176 162 182 138 172 C127 188 122 206 120 224Z"
              fill={INK}
            />
            <path {...ln} d="M120 224 C102 170 104 116 138 88 C168 60 250 56 284 86 C318 116 318 176 300 224 C301 202 297 184 287 169 C262 178 238 167 226 148 C206 176 162 182 138 172 C127 188 122 206 120 224Z" />
          </g>
          <g className="pt-hair" stroke="#5d86ff" strokeWidth="4" style={{ transformOrigin: '210px 220px' }}>
            <path className="pt-ln" d="M146 154 C154 128 178 108 212 102" />
            <path className="pt-ln" d="M166 160 C178 138 200 122 230 118" />
            <path className="pt-ln" d="M250 108 C276 116 292 136 295 162" />
            <path className="pt-ln" d="M238 148 C254 153 270 154 285 150" />
          </g>
        </g>

        {/* goggles: a second piece of paper */}
        <g className="pt-drop">
          <g className="pt-gog">
            <g fill="#fff" stroke="#fff" strokeWidth="22">
              <path d="M132 34 H288 C300 34 306 42 306 54 V88 C306 100 300 106 288 106 H236 C226 106 224 96 210 96 C196 96 194 106 184 106 H132 C120 106 114 100 114 88 V54 C114 42 120 34 132 34Z" />
              <path d="M138 34 V8 M282 34 V8" strokeWidth="26" />
            </g>
            <path d="M138 34 V14 M282 34 V14" stroke={INK} strokeWidth="6" />
            <circle cx="138" cy="9" r="8" fill="#e5322d" stroke={INK} strokeWidth="5" />
            <circle cx="282" cy="9" r="8" fill="#e5322d" stroke={INK} strokeWidth="5" />
            <path
              d="M132 34 H288 C300 34 306 42 306 54 V88 C306 100 300 106 288 106 H236 C226 106 224 96 210 96 C196 96 194 106 184 106 H132 C120 106 114 100 114 88 V54 C114 42 120 34 132 34Z"
              fill="#1b2340"
              stroke={INK}
              strokeWidth="5.5"
            />
            <path d="M133 44 H287 C293 44 296 48 296 54 V86 C296 92 293 96 287 96 H240 C228 94 224 86 210 86 C196 86 192 94 180 96 H133 C127 96 124 92 124 86 V54 C124 48 127 44 133 44Z" fill="#11172c" />
            <path d="M133 44 H287 C293 44 296 48 296 54 V60 H124 V54 C124 48 127 44 133 44Z" fill="#2f6bff" />
            <path d="M136 51 H188" stroke="#9fc2ff" strokeWidth="4" />
            <g className="pt-leds" fill="#ffc21a">
              <g className="pt-led">
                <path d="M156 64h18v6h6v12h-6v6h-18v-6h-6V70h6z" />
                <path d="M158 70h6v6h-6z" fill="#11172c" />
              </g>
              <g className="pt-led">
                <path d="M246 64h18v6h6v12h-6v6h-18v-6h-6V70h6z" />
                <path d="M248 70h6v6h-6z" fill="#11172c" />
              </g>
            </g>
            <text className="pt-sw" x="210" y="80" textAnchor="middle" fontFamily="'Dela Gothic One', Arial Black" fontSize="17" fill="#ffc21a">
              SW
            </text>
          </g>
        </g>
      </g>
    </svg>
  );
}
