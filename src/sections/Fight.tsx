import { useEffect, useRef, useState } from 'react';
import { Kitty } from '../components/Kitty';
import { Print } from '../components/Print';
import { useSite } from '../content';
import { pinProgress, useFrame, useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';
import { gsap, reduced } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import { smooth } from '../world/kit';
import type { Letter, LetterStage } from '../world/letters';
import { getWorld } from '../world/World';
import { arenaStage, type ArenaStage } from '../world/stages/arena';

/** The word charges in from both sides and keeps shoving itself. */
function brawl(letters: Letter[], stage: LetterStage) {
  if (reduced()) return;
  const mid = (letters.length - 1) / 2;
  const st = { v: 0 };
  letters.forEach((l) => (l.s.k = 0));
  const off = onceInView(
    stage.el,
    () => {
      letters.forEach((l) => (l.s.k = 1));
      gsap.fromTo(st, { v: 1 }, { v: 0, duration: 0.75, ease: 'power4.in' });
    },
    22,
  );
  let hit = 0;
  let landed = false;
  stage.drive = (t, dt) => {
    if (st.v <= 0.001 && !landed && letters[0].s.k) {
      landed = true;
      hit = 1;
    }
    hit = Math.max(0, hit - dt * 1.15);
    // every few seconds one end shoves the other
    const beat = (t * 0.42) % 1;
    const shove = beat < 0.12 ? Math.sin((beat / 0.12) * Math.PI) : 0;
    const dir = Math.floor(t * 0.42) % 2 ? 1 : -1;
    letters.forEach((l, i) => {
      const side = i < mid ? -1 : 1;
      const chain = dir > 0 ? i / letters.length : 1 - i / letters.length;
      const recoil = Math.sin(hit * 22) * hit * 18;
      l.s.x = side * st.v * 1500 + recoil * side + dir * shove * 22 * (1 - chain * 0.7);
      l.s.rz = side * st.v * 0.8 - recoil * 0.006 + dir * shove * 0.05 * (1 - chain);
      l.s.z = st.v * 60 + hit * 16;
      l.s.ry = side * st.v * 0.9;
    });
  };
  return off;
}

/** Gold letters slam down when the semi-final locks up. */
function slam(letters: Letter[], stage: LetterStage, prog: React.RefObject<number>) {
  const calm = reduced();
  stage.drive = () => {
    const p = prog.current ?? 0;
    letters.forEach((l, i) => {
      const at = 0.856 + i * 0.005;
      const k = calm ? (p > 0.86 ? 1 : 0) : smooth(at, at + 0.03, p);
      const e = 1 - (1 - k) ** 3;
      l.s.k = k > 0.001 ? 1 : 0;
      l.s.z = (1 - e) * 900;
      l.s.rx = (1 - e) * 1.2;
      l.s.rz = (1 - e) * (i % 2 ? 0.7 : -0.7);
    });
  };
}

export function Fight() {
  const site = useSite();
  const f = site.fight;
  const prog = useRef(0);
  const stage = useRef<ArenaStage | null>(null);
  const pin = useRef<HTMLDivElement>(null);
  const tagA = useRef<HTMLSpanElement>(null);
  const tagB = useRef<HTMLSpanElement>(null);
  const [hud, setHud] = useState({ mode: 'scroll', phase: 'idle', you: 0, them: 0, count: 3 });

  const ring = useStage<HTMLDivElement>((el) => {
    const s = arenaStage(el);
    stage.current = s;
    s.p = prog.current;
    s.onChange = () => setHud({ mode: s.mode, phase: s.phase, you: s.you, them: s.them, count: s.count });
    s.onHit = (power) => {
      if (reduced() || !pin.current) return;
      gsap.fromTo(pin.current, { x: power * 7, y: power * -5 }, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1.6,0.3)' });
    };
    return s;
  });

  const root = useGsap<HTMLElement>(
    (el) => {
      reveals(el);
      const pinEl = el.querySelector<HTMLElement>('.fight-pin')!;
      const cards = gsap.utils.toArray<HTMLElement>('.fi-round', el);
      const lead = el.querySelector<HTMLElement>('.fi-lead')!;
      const play = el.querySelector<HTMLElement>('.fi-play')!;
      const st = pinProgress(pinEl, (v) => {
        prog.current = v;
        const s = stage.current;
        if (s) {
          s.p = v;
          if (s.mode === 'game' && v < 0.9) s.stop();
        }
        const n = cards.length;
        cards.forEach((c, i) => {
          // first card holds through round one, the last until the slam
          const a = i === 0 ? 0.04 : 0.4 + ((i - 1) * 0.42) / Math.max(1, n - 1);
          const b = i === n - 1 ? 0.84 : 0.4 + (i * 0.42) / Math.max(1, n - 1) - 0.02;
          const inn = smooth(a, a + 0.05, v);
          const out = smooth(b, b + 0.03, v);
          gsap.set(c, { y: (1 - inn) * 70 - out * 70, opacity: inn * (1 - out), rotate: (1 - inn) * 3 - out * 3 });
        });
        gsap.set(lead, { opacity: smooth(0.86, 0.9, v) });
        gsap.set(play, { opacity: smooth(0.9, 0.95, v), y: (1 - smooth(0.9, 0.95, v)) * 30, pointerEvents: v > 0.91 ? 'auto' : 'none' });
      });
      return () => st.kill();
    },
    [site],
  );

  useFrame(pin, () => {
    const s = stage.current;
    const w = getWorld();
    if (!s || !w || !pin.current) return;
    const box = pin.current.getBoundingClientRect();
    const put = (el: HTMLElement | null, q: { x: number; y: number }, on: number, text?: string) => {
      if (!el) return;
      el.style.transform = `translate3d(${q.x - box.left}px,${q.y - box.top - 92}px,0) translate(-50%,-50%) scale(${on ? 1 : 0})`;
      if (text && el.textContent !== text) el.textContent = text;
    };
    const shown = s.mode === 'game' || (s.p > 0.06 && s.p < 0.995);
    put(tagA.current, s.points.a, shown ? s.tags.a : 0);
    put(tagB.current, s.points.b, shown ? s.tags.b : 0, s.tags.bName);
    // the lamp leans over the ring while the story plays
    const mid = s.mode === 'scroll' ? s.p > 0.02 && s.p < 0.98 : true;
    w.lock.w += ((mid ? (s.mode === 'game' ? 0.72 : 0.62) : 0) - w.lock.w) * 0.08;
    w.lock.x = s.group.position.x;
    w.lock.y = s.group.position.y;
  });

  useEffect(
    () => () => {
      const w = getWorld();
      if (w) w.lock.w = 0;
    },
    [],
  );

  const playing = hud.mode === 'game';
  return (
    <section id="fight" data-sec ref={root} className="fight">
      <div
        className="section sec-head"
        data-track="[[0.5,0],[0.5,0.14],[0.06,0.14],[0.06,0.82],[0.975,0.82],[0.975,1]]" data-track-s="[[0.004,0],[0.004,1]]"
      >
        <div className="wrap sec-right">
          <Letters as="h2" text={f.title.toUpperCase()} style="metal" depth={40} bevel={3} curve={6} className="title3d" onLetters={brawl} />
          <p className="lede" data-rv="lines">{f.text}</p>
        </div>
      </div>

      <div className="fight-pin" data-pin style={{ height: '480vh' }}>
        <div className="pin" ref={pin}>
          <div className="fi-grid">
            <div className="fi-side">
              <p className="fi-event">{f.event}</p>
              <p className="fi-long">{f.eventLong}</p>
              <div className="fi-rounds">
                {f.rounds.map((r, i) => (
                  <article className="fi-round" key={i}>
                    <span className={'dymo ' + (r.result === 'out' ? 'red' : r.result === 'won' ? 'green' : 'yellow')}>{r.when}</span>
                    <h3>{r.title}</h3>
                    <p>{r.text}</p>
                  </article>
                ))}
                <div className="fi-lead">
                  <Letters text={f.lead} style="gold" depth={34} bevel={3} curve={7} className="fi-gold" onLetters={(l, s) => slam(l, s, prog)} />
                  <p>{f.rounds[f.rounds.length - 1]?.text}</p>
                </div>
                <div className={'fi-play ' + (playing ? 'on' : '')}>
                  {playing ? (
                    <div className="fi-score" role="status">
                      <b>{hud.you}</b>
                      <span>You</span>
                      <b>{hud.them}</b>
                      <span>Robot</span>
                      <button type="button" className="tlink" onClick={() => stage.current?.stop()}>
                        End the bout
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3>{f.game.title}</h3>
                      <p>{f.game.text}</p>
                      <button type="button" className="plug" onClick={() => stage.current?.start()}>
                        {f.game.start}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="fi-ring" ref={ring} data-cursor={playing ? 'Push' : undefined} style={{ touchAction: playing ? 'none' : 'pan-y' }}>
              {playing && hud.phase === 'count' ? <span className="fi-count" key={hud.count}>{hud.count}</span> : null}
              {playing && hud.phase === 'over' ? <span className="fi-count small">Out!</span> : null}
            </div>
          </div>
          <span className="fi-tag dymo" ref={tagA} aria-hidden>
            {site.person.first}
          </span>
          <span className="fi-tag dymo red" ref={tagB} aria-hidden>
            University team
          </span>
        </div>
      </div>

      {f.photos.length ? (
        <div className="section fi-build" data-track="[[0.975,0],[0.975,0.08],[0.04,0.08],[0.04,0.94],[0.5,0.94],[0.5,1]]" data-track-s="[[0.004,0],[0.004,1]]">
          <div className="wrap">
            {f.photosTitle ? <h3 className="fi-buildh" data-rv="lines">{f.photosTitle}</h3> : null}
            <div className="fi-cats">
              <Kitty pose="peek" coat="black" say="hsss" />
              <Kitty pose="peek" coat="cream" say="mrrow" />
            </div>
            <div className="fi-strip">
              {f.photos.map((im, i) => (
                <Print key={im.src + i} img={im} rot={[-2.4, 1.6, -1.2, 2.2, -1.8, 1.4][i % 6]} ratio="4/3" />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
