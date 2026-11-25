// The cat from Saad's GitHub avatar. Watches the lamp like a laser pointer,
// swats at it when it gets close, and says what the GitHub bio says.
import { useEffect, useRef } from 'react';
import { gsap, isTouch, reduced } from '../lib/motion';
import { getWorld } from '../world/World';

const INK = '#0b1433';

export function Cat({ className = '' }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const say = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const svg = ref.current!;
    const head = svg.querySelector<SVGGElement>('.cat-head')!;
    const shines = svg.querySelectorAll<SVGGElement>('.cat-shine');
    const pupils = svg.querySelectorAll<SVGGElement>('.cat-eye');
    const ears = svg.querySelectorAll<SVGGElement>('.cat-ear');
    const paws = Array.from(svg.querySelectorAll<SVGGElement>('.cat-paw'));
    const tail = svg.querySelector<SVGPathElement>('.cat-tail')!;
    const tail2 = svg.querySelector<SVGPathElement>('.cat-tail-w')!;
    let lx = 0;
    let ly = 0;
    let blink = 0;
    let next = 2;
    let swat = [0, 0];
    let cool = 0;
    let lastD = 9999;
    const calm = reduced();

    const tick = (t: number, d: number) => {
      const dt = Math.min(0.05, d / 1000);
      const r = svg.getBoundingClientRect();
      if (r.bottom < -40 || r.top > innerHeight + 40) return;
      const w = getWorld();
      const px = w ? w.lampPos.x * 100 + w.vw / 2 : innerWidth / 2;
      const py = w ? -w.lampPos.y * 100 + w.vh / 2 : 0;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.5;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, dist / 240);
      const k = 1 - Math.exp(-dt * 9);
      lx += ((dx / dist) * m - lx) * k;
      ly += ((dy / dist) * m - ly) * k;
      head.setAttribute('transform', `translate(${(lx * 9).toFixed(1)} ${(ly * 6).toFixed(1)}) rotate(${(lx * 5).toFixed(1)} 110 120)`);
      shines.forEach((s) => s.setAttribute('transform', `translate(${(lx * 6).toFixed(1)} ${(ly * 5).toFixed(1)})`));
      if (t > next) {
        blink = 1;
        next = t + 1.6 + Math.random() * 4;
      }
      blink = Math.max(0, blink - dt * 6);
      const sc = Math.max(0.08, 1 - Math.sin(blink * Math.PI));
      // pupils go huge when the light is near
      const wide = 1 + Math.max(0, 1 - dist / 300) * 0.16;
      pupils.forEach((p) => (p.style.transform = `scale(${wide.toFixed(2)}, ${(sc * wide).toFixed(2)})`));
      ears.forEach((e, i) => (e.style.transform = `rotate(${((i ? 1 : -1) * Math.max(0, Math.sin(t * 1.7 + i * 2)) ** 12 * 14).toFixed(1)}deg)`));

      cool -= dt;
      if (!calm && dist < r.width * 0.95 && Math.abs(lastD - dist) > 4 && cool <= 0 && dy < r.height * 0.3) {
        const i = dx > 0 ? 1 : 0;
        swat[i] = 1;
        cool = 0.32;
      }
      lastD = dist;
      paws.forEach((p, i) => {
        swat[i] = Math.max(0, swat[i] - dt * 4.2);
        const s = Math.sin(swat[i] * Math.PI);
        p.setAttribute('transform', `translate(${(lx * 34 * s).toFixed(1)} ${(-54 * s + ly * 14 * s).toFixed(1)}) rotate(${((i ? 1 : -1) * s * 18).toFixed(1)} ${i ? 150 : 70} 190)`);
      });
      const a = Math.sin(t * 1.6) * 22 + Math.sin(t * 3.1) * 8;
      const path = `M196 204 C${228 + a * 0.3} 190 ${226 + a} 150 ${212 + a} 118`;
      tail.setAttribute('d', path);
      tail2.setAttribute('d', path);
    };
    gsap.ticker.add(tick);

    const meow = () => {
      const s = say.current!;
      gsap.killTweensOf(s);
      gsap.fromTo(s, { scale: 0, rotate: -16, opacity: 1 }, { scale: 1, rotate: -4, duration: 0.5, ease: 'back.out(2.4)' });
      gsap.to(s, { opacity: 0, y: -18, duration: 0.4, delay: 1.6, onComplete: () => void gsap.set(s, { y: 0 }) });
      gsap.fromTo(svg, { scaleY: 0.92, scaleX: 1.06 }, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1.2,0.4)', transformOrigin: '50% 100%' });
    };
    svg.parentElement!.addEventListener('click', meow);
    const host = svg.parentElement!;
    return () => {
      gsap.ticker.remove(tick);
      host.removeEventListener('click', meow);
    };
  }, []);

  const ln = { stroke: INK, strokeWidth: 5 } as const;
  return (
    <button type="button" className={'cat ' + className} aria-label="Pet the cat" data-cursor={isTouch() ? undefined : 'Pet'} data-nolock>
      <span className="cat-say note" ref={say} aria-hidden>
        meow meow
      </span>
      <svg ref={ref} viewBox="0 0 250 210" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path className="cat-tail-w" d="M196 204 C228 190 226 150 212 118" stroke="#fff" strokeWidth="34" />
        <path className="cat-tail" d="M196 204 C228 190 226 150 212 118" stroke={INK} strokeWidth="24" />
        <path d="M196 204 C228 190 226 150 212 118" stroke="#8a93a6" strokeWidth="14" style={{ display: 'none' }} />
        <g fill="#fff" stroke="#fff" strokeWidth="18">
          <path d="M38 210C30 170 60 140 110 140C160 140 192 170 186 210Z" />
        </g>
        <path d="M38 212C30 170 60 140 110 140C160 140 192 170 186 212" fill="#8a93a6" {...ln} />
        <path d="M78 212C80 180 94 168 110 168C126 168 140 180 142 212" fill="#fff" />
        <g className="cat-head">
          <g fill="#fff" stroke="#fff" strokeWidth="19">
            <path d="M40 104C36 56 66 36 110 36C154 36 184 56 180 104C178 148 150 170 110 170C70 170 42 148 40 104Z" />
            <path d="M50 70L42 12L92 44Z M170 70L178 12L128 44Z" />
          </g>
          <g className="cat-ear" style={{ transformOrigin: '64px 56px' }}>
            <path d="M50 72L42 14L92 44Z" fill="#8a93a6" {...ln} />
            <path d="M56 54L53 32L74 45Z" fill="#ff9d95" />
          </g>
          <g className="cat-ear" style={{ transformOrigin: '156px 56px' }}>
            <path d="M170 72L178 14L128 44Z" fill="#8a93a6" {...ln} />
            <path d="M164 54L167 32L146 45Z" fill="#ff9d95" />
          </g>
          <path d="M40 104C36 56 66 36 110 36C154 36 184 56 180 104C178 148 150 170 110 170C70 170 42 148 40 104Z" fill="#fff" />
          <path d="M40 108C35 56 66 36 110 36C154 36 185 56 180 108C166 92 150 90 140 98C134 84 124 68 110 68C96 68 86 84 80 98C70 90 54 92 40 108Z" fill="#8a93a6" />
          <path d="M96 40V58M110 37V62M124 40V58" {...ln} />
          <path d="M40 104C36 56 66 36 110 36C154 36 184 56 180 104C178 148 150 170 110 170C70 170 42 148 40 104Z" {...ln} strokeWidth="5.5" />
          <g className="cat-eye" style={{ transformOrigin: '78px 112px' }}>
            <circle cx="78" cy="112" r="16" fill={INK} />
            <g className="cat-shine" fill="#fff">
              <circle cx="82" cy="107" r="5" />
              <circle cx="74" cy="117" r="2.4" />
            </g>
          </g>
          <g className="cat-eye" style={{ transformOrigin: '142px 112px' }}>
            <circle cx="142" cy="112" r="16" fill={INK} />
            <g className="cat-shine" fill="#fff">
              <circle cx="146" cy="107" r="5" />
              <circle cx="138" cy="117" r="2.4" />
            </g>
          </g>
          <path d="M102 130H118L110 139Z" fill="#ff6b7c" stroke={INK} strokeWidth="4" />
          <path d="M110 140V146M110 146C104 155 93 155 88 148M110 146C116 155 127 155 132 148" {...ln} strokeWidth="4.5" />
          <path d="M58 132L26 126M58 141L28 146M162 132L194 126M162 141L192 146" stroke={INK} strokeWidth="3.2" />
        </g>
        {[70, 150].map((x) => (
          <g className="cat-paw" key={x}>
            <path d={`M${x - 24} 212C${x - 28} 184 ${x - 14} 172 ${x} 172C${x + 14} 172 ${x + 28} 184 ${x + 24} 212Z`} fill="#fff" stroke="#fff" strokeWidth="14" />
            <path d={`M${x - 24} 214C${x - 28} 184 ${x - 14} 172 ${x} 172C${x + 14} 172 ${x + 28} 184 ${x + 24} 214`} fill="#fff" {...ln} />
            <path d={`M${x - 9} 188V200M${x + 9} 188V200`} {...ln} strokeWidth="4" />
          </g>
        ))}
      </svg>
    </button>
  );
}
