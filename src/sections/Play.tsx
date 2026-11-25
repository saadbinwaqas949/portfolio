import { Kitty } from '../components/Kitty';
import { useEffect, useRef, useState } from 'react';
import { media, useSite } from '../content';
import { useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';
import { gsap, reduced } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import type { Letter, LetterStage } from '../world/letters';
import type { World } from '../world/World';
import { consoleStage, type ConsoleStage } from '../world/stages/console';

/** Plastic letters on springs: they bounce in, then hop when you touch them. */
function bouncy(letters: Letter[], stage: LetterStage, world: World) {
  if (reduced()) return;
  const s = letters.map(() => ({ z: 900, v: 0, on: false, sq: 0 }));
  letters.forEach((l) => (l.s.k = 0));
  const off = onceInView(stage.el, () => s.forEach((b, i) => gsap.delayedCall(i * 0.11, () => (b.on = true))), 20);
  stage.drive = (t, dt) => {
    letters.forEach((l, i) => {
      const b = s[i];
      if (!b.on) return;
      l.s.k = 1;
      const px = world.pointer.x * 100 - stage.group.position.x * 100 - l.hx - l.ox;
      const py = world.pointer.y * 100 - stage.group.position.y * 100 - l.hy - l.oy;
      if (!world.touch && Math.hypot(px, py) < 95 && b.z < 4 && world.pointer.seen) b.v = 520;
      if (world.touch && b.z < 2 && Math.random() < dt * 0.22) b.v = 420;
      b.v -= 2600 * dt;
      b.z += b.v * dt;
      if (b.z < 0) {
        b.z = 0;
        if (b.v < -200) b.sq = Math.min(1, -b.v / 1800);
        b.v = -b.v * 0.46;
        if (Math.abs(b.v) < 60) b.v = 0;
      }
      b.sq *= 1 - 7 * dt;
      l.s.z = b.z;
      l.s.k = 1 + Math.sin(b.sq * 9) * b.sq * 0.14;
      l.s.rz = Math.sin(t * 4 + i) * Math.min(0.2, b.z * 0.0012);
      l.s.rx = Math.min(0.5, b.z * 0.002) * Math.sin(t * 5 + i * 2);
    });
  };
  return off;
}

export function Play() {
  const site = useSite();
  const p = site.play;
  const [cur, setCur] = useState(0);
  const stage = useRef<ConsoleStage | null>(null);
  const info = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const arrived = useRef(false);

  const wrap = useStage<HTMLDivElement>(
    (el) => {
      const con = el.querySelector<HTMLElement>('.console')!;
      const btns = Array.from(el.querySelectorAll<HTMLElement>('.cart'));
      const s = consoleStage(
        el,
        con,
        btns,
        p.games.map((g) => ({ name: g.name, color: g.color, images: g.images.map((i) => media(i.src)) })),
      );
      stage.current = s;
      if (arrived.current) s.select(0);
      return s;
    },
    [p.games],
  );

  const root = useGsap<HTMLElement>(
    (el) => {
      const off = reveals(el);
      // first cartridge goes in when you arrive
      const first = onceInView(
        el.querySelector('.console')!,
        () => {
          arrived.current = true;
          stage.current?.select(0);
        },
        38,
      );
      return () => {
        off?.();
        first();
      };
    },
    [site],
  );

  const pick = (i: number) => {
    const n = (i + p.games.length) % p.games.length;
    touched.current = true;
    stage.current?.select(n);
    setCur(n);
  };

  useEffect(() => {
    if (!touched.current || reduced() || !info.current) return;
    const el = info.current;
    gsap.fromTo(el.querySelector('h3'), { scrambleText: '' }, { duration: 0.8, scrambleText: { text: p.games[cur].name, chars: 'upperCase', speed: 0.5 }, ease: 'none' });
    gsap.fromTo(el.querySelectorAll('[data-sw]'), { x: 34, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.07, duration: 0.6, delay: 0.1 });
  }, [cur, p.games]);

  const g = p.games[Math.min(cur, p.games.length - 1)];
  if (!g) return null;
  const press = (k: 'left' | 'right' | 'a' | 'b') => stage.current?.press(k);

  return (
    <section id="play" data-sec ref={root} className="play">
      <div
        className="section sec-head"
        data-track="[[0.5,0],[0.5,0.12],[0.06,0.12],[0.06,0.82],[0.975,0.82],[0.975,1]]" data-track-s="[[0.996,0],[0.996,0.16],[0.004,0.36],[0.004,1]]"
      >
        <div className="wrap sec-right">
          <Letters as="h2" text={p.title.toUpperCase()} style="toy" depth={52} bevel={6} curve={7} className="title3d" onLetters={bouncy} />
          <p className="lede" data-rv="lines">{p.intro}</p>
        </div>
      </div>
      <div className="section" style={{ paddingTop: 0 }} data-track="[[0.975,0],[0.975,0.95],[0.5,0.95],[0.5,1]]" data-track-s="[[0.004,0],[0.004,1]]">
        <div
          className="wrap con-wrap"
          ref={wrap}
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') pick(cur + 1);
            if (e.key === 'ArrowLeft') pick(cur - 1);
          }}
        >
          <div className="con-top">
            <div className="console">
              <button type="button" className="c-screen" aria-label="Next screenshot" data-cursor="Next shot" data-nolock onClick={() => stage.current?.nextShot()} />
              <button type="button" className="c-left" aria-label="Previous game" onClick={() => (press('left'), pick(cur - 1))} />
              <button type="button" className="c-right" aria-label="Next game" onClick={() => (press('right'), pick(cur + 1))} />
              <button
                type="button"
                className="c-a"
                aria-label={'Play ' + g.name}
                data-cursor="Play"
                onClick={() => {
                  press('a');
                  window.open(g.url, '_blank', 'noopener');
                }}
              />
              <button type="button" className="c-b" aria-label="Next screenshot" data-cursor="Next shot" onClick={() => (press('b'), stage.current?.nextShot())} />
            </div>
            <div className="con-info" ref={info} aria-live="polite">
              <p className="con-count" data-sw>
                {cur + 1}/{p.games.length}
              </p>
              <h3 key={g.name}>{g.name}</h3>
              <p className="con-text" data-sw>
                {g.text}
              </p>
              <div data-sw>
                {g.tag ? <span className="dymo red">{g.tag}</span> : null}
                <span className="dymo">{g.platform === 'browser' ? 'Plays in the browser' : 'Windows download'}</span>
              </div>
              <a className="plug" href={g.url} target="_blank" rel="noreferrer" data-sw>
                {g.platform === 'browser' ? 'Play it' : 'Get it'}
              </a>
            </div>
            <Kitty pose="sit" coat="grey" className="play-cat" cheer={cur + 1} say="player two" />
          </div>
          <div className="carts" role="group" aria-label="Games">
            {p.games.map((k, i) => (
              <button
                type="button"
                className="cart"
                key={k.name}
                aria-pressed={i === cur}
                style={{ ['--cc' as any]: k.color }}
                data-cursor={i === cur ? 'Playing' : 'Insert'}
                data-nolock
                onClick={() => pick(i)}
                onPointerEnter={() => stage.current?.hover(i)}
                onPointerLeave={() => stage.current?.hover(-1)}
                onFocus={() => stage.current?.hover(i)}
                onBlur={() => stage.current?.hover(-1)}
              >
                <span>{k.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="wrap play-more">
          <a className="tlink" href={p.profile} target="_blank" rel="noreferrer">
            All games on itch.io
          </a>
        </div>
      </div>
    </section>
  );
}
