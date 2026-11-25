import { useEffect, useMemo, useRef } from 'react';
import { useSite } from '../content';
import { Portrait, type PortraitApi } from '../components/Portrait';
import { useGsap, pinProgress } from '../lib/hooks';
import { emit, gsap, introIsDone, isTouch, onIntro, reduced, scrollToId, SplitText } from '../lib/motion';
import { Letters, useStage } from '../world/hooks';
import type { Letter, LetterStage } from '../world/letters';
import { smooth } from '../world/kit';
import { emWidth } from '../world/letters';
import { padStage, type PadStage } from '../world/stages/pad';

interface Intro {
  z: number;
  rx: number;
  ry: number;
  rz: number;
  k: number;
}

/** "things that {fly}, {fight}" becomes links that act out their verb. */
function Line({ text }: { text: string }) {
  // keep "{fly}," glued together so the comma never wraps alone
  const bits = useMemo(() => text.split(/(\{[^}]+\}[.,;:!?]?)/g).filter(Boolean), [text]);
  return (
    <p className="hero-line">
      {bits.map((b, i) => {
        if (!b.startsWith('{')) return <span key={i} className="hl-t">{b}</span>;
        const end = b.indexOf('}');
        const word = b.slice(1, end);
        const tail = b.slice(end + 1);
        const id = word.split(' ')[0].toLowerCase();
        return (
          <span className="verb-wrap" key={i}>
          <a
            href={'#' + id}
            className={'verb verb-' + id}
            onClick={(e) => {
              e.preventDefault();
              scrollToId(id);
            }}
            onPointerEnter={() => emit('smile', true)}
            onPointerLeave={() => emit('smile', false)}
          >
            {id === 'fight'
              ? word.split('').map((c, k) => (
                  <span key={k} style={{ ['--i' as any]: k }}>
                    {c}
                  </span>
                ))
              : word}
            <svg viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden>
              <path d="M2 9 C20 3 34 12 52 8 S92 4 118 9" pathLength={1} />
            </svg>
          </a>
          {tail}
          </span>
        );
      })}
    </p>
  );
}

export function Hero() {
  const site = useSite();
  const { hero, person } = site;
  const p = useRef(0);
  const portrait = useRef<PortraitApi>(null);
  const pad = useRef<PadStage | null>(null);

  const padEl = useStage<HTMLDivElement>((el) => {
    const s = padStage(el, 'take');
    pad.current = s;
    return s;
  });

  const root = useGsap<HTMLElement>((el) => {
    const copy = el.querySelector<HTMLElement>('.hero-copy')!;
    const hint = el.querySelector<HTMLElement>('.hero-hint')!;
    const figure = el.querySelector<HTMLElement>('.hero-figure')!;
    const st = pinProgress(el, (v) => {
      p.current = v;
      if (pad.current) pad.current.p = v;
      // goggles on before the props start
      portrait.current?.goggles(smooth(0.02, 0.1, v));
      portrait.current?.wind(smooth(0.08, 0.24, v) * (1 - smooth(0.5, 0.7, v)));
      const out = smooth(0.3, 0.72, v);
      gsap.set(copy, { x: -out * innerWidth * 0.75, rotate: -out * 9, opacity: 1 - smooth(0.4, 0.75, v) });
      gsap.set(hint, { opacity: 1 - smooth(0.0, 0.06, v) });
      const f = smooth(0.42, 0.86, v);
      gsap.set(figure, { yPercent: f * 118, rotate: f * 11 });
    });

    const off = onIntro(() => {
      if (reduced()) return;
      const split = new SplitText(el.querySelectorAll('.hl-t'), { type: 'words' });
      gsap
        .timeline({ delay: 0.85 })
        .from([...split.words, ...el.querySelectorAll('.verb')], { yPercent: 60, opacity: 0, rotate: 5, stagger: 0.045, duration: 0.7 })
        .from('.hero-sub', { opacity: 0, y: 20, duration: 0.6 }, '-=0.45')
        .from('.hero-badges .dymo', { xPercent: -30, opacity: 0, clipPath: 'inset(0 100% 0 0)', stagger: 0.09, duration: 0.6, ease: 'power4.out', clearProps: 'clipPath' }, '-=0.4')
        .from('.hero-hint', { opacity: 0, y: 14, duration: 0.6 }, '-=0.2');
    });
    return () => {
      off();
      st.kill();
    };
  }, [site]);

  // ---- name letters: drop in, then get blown off the mat by the props --------
  const wire = (letters: Letter[], stage: LetterStage, order: number) => {
    const calm = reduced();
    const intro: Intro[] = letters.map(() => (introIsDone() || calm ? { z: 0, rx: 0, ry: 0, rz: 0, k: 1 } : { z: 1050, rx: 0, ry: 0, rz: 0, k: 0 }));
    const seeds = letters.map((l) => ({ a: Math.sin(l.i * 12.9 + order * 4.1), b: Math.cos(l.i * 7.3 + order * 2.7) }));
    stage.drive = (t) => {
      const v = p.current;
      const ps = pad.current;
      const blip = ps?.wash ?? 0;
      letters.forEach((l, i) => {
        const n = intro[i];
        const s = l.s;
        s.k = n.k;
        s.x = s.y = 0;
        s.z = n.z;
        s.rx = n.rx;
        s.ry = n.ry;
        s.rz = n.rz;
        if (!ps || v <= 0) return;
        const dx = stage.group.position.x * 100 + l.hx + l.ox - ps.group.position.x * 100;
        const dy = stage.group.position.y * 100 + l.hy + l.oy - ps.group.position.y * 100;
        const d = Math.hypot(dx, dy) || 1;
        const start = 0.16 + Math.min(0.2, d * 0.00017);
        const f = smooth(start, start + 0.42, v);
        const push = f * f;
        // chatter on the mat before it lets go
        const chat = Math.min(1, blip * 1.4) * (1 - f);
        s.rz += Math.sin(t * 47 + i * 2) * 0.012 * chat;
        s.z += Math.abs(Math.sin(t * 39 + i)) * 3 * chat;
        s.x += (dx / d) * push * (1500 + seeds[i].a * 240);
        s.y += (dy / d) * push * (1300 + seeds[i].b * 260) + push * 160;
        s.z += Math.sin(f * Math.PI) * 230;
        s.rx += seeds[i].a * f * 2.6;
        s.ry += seeds[i].b * f * 2.2;
        s.rz += seeds[i].a * f * 3.4;
      });
    };
    if (introIsDone() || calm) return;
    const off = onIntro(() => {
      letters.forEach((l, i) => {
        const n = intro[i];
        const at = 0.05 + order * 0.52 + i * (order ? 0.045 : 0.15);
        const z0 = order ? 560 : 1050;
        gsap
          .timeline({ delay: at })
          .set(n, { k: 1, z: z0, rx: seeds[i].a * 0.5, ry: seeds[i].b * 0.5, rz: seeds[i].a * 0.6 })
          .to(n, { z: 0, rx: 0, ry: 0, rz: 0, duration: 0.42, ease: 'power3.in' })
          .add(() => {
            if (!order) emit('thud', i);
            emit('startle');
          })
          .to(n, { z: order ? 14 : 34, rz: seeds[i].b * 0.03, duration: 0.13, ease: 'power2.out' })
          .to(n, { z: 0, rz: 0, duration: 0.15, ease: 'power2.in' })
          .to(n, { z: order ? 3 : 7, duration: 0.07, ease: 'power2.out' })
          .to(n, { z: 0, duration: 0.08, ease: 'power2.in' });
      });
    });
    return off;
  };

  // the whole page jolts when a letter lands
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.hero-shake');
    if (!main || reduced()) return;
    const off = onThud(() => gsap.fromTo(main, { y: 7 }, { y: 0, duration: 0.4, ease: 'elastic.out(1.4,0.35)' }));
    return off;
  }, []);

  return (
    <section
      className="hero-pin"
      id="top"
      data-sec
      data-pin
      ref={root}
      style={{ height: '250vh' }}
    >
      <div className="pin hero">
        <div className="hero-shake">
          <h1 className="sr">
            {person.first} {person.last}
          </h1>
          <div className="hero-names" style={{ ['--em' as any]: emWidth(person.first.toUpperCase()) }}>
            <Letters text={person.first.toUpperCase()} style="kraft" depth={56} shy={0.8} decorative className="hero-first" onLetters={(l, s) => wire(l, s, 0)} />
          </div>
          <div className="hero-figure">
            <Portrait api={portrait} />
          </div>
          <div className="hero-copy">
            <Letters text={person.last.toUpperCase()} style="kraft" depth={26} shy={0.6} decorative className="hero-last" onLetters={(l, s) => wire(l, s, 1)} />
            <Line text={hero.line} />
            <p className="hero-sub">{hero.sub}</p>
            <ul className="hero-badges">
              {hero.badges.map((b, i) => (
                <li key={i}>
                  <span className={'dymo ' + b.color}>{b.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div
            className="hero-pad"
            ref={padEl}
            onPointerEnter={() => pad.current && gsap.to(pad.current, { blip: 1, duration: 0.3 })}
            onPointerLeave={() => pad.current && gsap.to(pad.current, { blip: 0, duration: 0.8 })}
          />
          <p className="hero-hint note" aria-hidden>
            {hero.scrollHint}
            <svg viewBox="0 0 60 74" aria-hidden>
              <path d="M44 4 C8 14 4 42 26 64" />
              <path d="M8 56 L27 66 L34 46" />
            </svg>
          </p>
        </div>
        <div className="hero-track" data-track="[[0.405,0.86],[0.405,1.0]]" data-track-s="[[0.5,0.965],[0.5,1]]" aria-hidden />
      </div>
    </section>
  );
}

// small indirection so the effect above can live outside the GSAP context
import { on } from '../lib/motion';
function onThud(f: () => void) {
  return on('thud', f);
}
