import { useEffect, useRef } from 'react';
import { Print } from '../components/Print';
import { useSite, youtubeId, type EventItem } from '../content';
import { useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';
import { emit, gsap, reduced } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import type { Letter, LetterStage } from '../world/letters';
import { getWorld } from '../world/World';
import { medalStage, showBotStage } from '../world/stages/misc';
import { popLetters } from './About';

const TAPE: Record<string, string> = { won: 'green', award: 'yellow', semi: 'yellow', out: 'red', part: '', demo: 'blue' };

/** These letters fall over. */
function flop(letters: Letter[], stage: LetterStage) {
  if (reduced()) return;
  const s = letters.map((l) => ({ f: 0, dir: l.i % 2 ? 1 : -1 }));
  letters.forEach((l) => (l.s.k = 0));
  const off = onceInView(
    stage.el,
    () =>
      letters.forEach((l, i) => {
        gsap.fromTo(l.s, { k: 0 }, { k: 1, duration: 0.25, delay: 0.5 + i * 0.05 });
        gsap.to(s[i], { f: 1, duration: 1.1, delay: 1.1 + (i % 4) * 0.12 + i * 0.03, ease: 'bounce.out' });
      }),
    18,
  );
  stage.drive = (t) => {
    letters.forEach((l, i) => {
      const f = s[i].f;
      l.s.rz = s[i].dir * f * (0.06 + (i % 3) * 0.035);
      l.s.y = -f * (3 + (i % 3) * 6);
      l.s.x = s[i].dir * f * 2;
      l.s.z = (1 - f) * 30 * l.s.k;
      l.s.ry = Math.sin(t * 0.6 + i) * 0.015;
    });
  };
  return off;
}

function Medal() {
  const ref = useStage<HTMLDivElement>((el) => medalStage(el));
  return <div className="pass-medal" ref={ref} aria-hidden />;
}

function Bot() {
  const ref = useStage<HTMLDivElement>((el) => showBotStage(el));
  return <div className="pass-bot" ref={ref} aria-hidden />;
}

function Watch({ e }: { e: EventItem }) {
  const yt = youtubeId(e.video);
  if (!yt) return null;
  return (
    <button type="button" className="tlink" onClick={() => emit('lightbox', { type: 'yt', id: yt, title: e.title })}>
      Watch the video
    </button>
  );
}

/** Headline events hang on a lanyard and swing as you scroll. */
function Pass({ e, i }: { e: EventItem; i: number }) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = card.current;
    if (!el || reduced()) return;
    let a = 0;
    let v = 0;
    let on = false;
    let lastX = 0;
    const tick = (t: number, d: number) => {
      const dt = Math.min(0.033, d / 1000);
      const w = getWorld();
      v += ((w ? w.scrollVel : 0) * (i % 2 ? 0.0009 : -0.0009) - a * 16 - v * 1.5 + Math.sin(t * 0.8 + i) * 0.1) * dt;
      v = Math.max(-2.4, Math.min(2.4, v));
      a += v * dt;
      el.style.transform = `rotate(${((a * 180) / Math.PI).toFixed(2)}deg)`;
    };
    const move = (ev: PointerEvent) => {
      v += (ev.clientX - lastX) * 0.004;
      lastX = ev.clientX;
    };
    const enter = (ev: PointerEvent) => (lastX = ev.clientX);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointermove', move);
    const io = new IntersectionObserver(([x]) => {
      if (x.isIntersecting && !on) {
        on = true;
        gsap.ticker.add(tick);
      } else if (!x.isIntersecting && on) {
        on = false;
        gsap.ticker.remove(tick);
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      gsap.ticker.remove(tick);
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointermove', move);
    };
  }, [i]);

  const rots = [-5, 4, -3, 6];
  return (
    <article className={'pass-row ' + (i % 2 ? 'flip' : '')}>
      <div className="pass" ref={card}>
        <div className="pass-strap" aria-hidden />
        <div className="pass-clip" aria-hidden />
        <div className="pass-card">
          <p className="pass-host">{e.host}</p>
          <h3>{e.title}</h3>
          {e.date ? <p className="pass-date">{e.date}</p> : null}
          <p className="pass-result">{e.result}</p>
          <p className="pass-text">{e.text}</p>
          {e.entries.length ? (
            <ul className="pass-entries">
              {e.entries.map((x, k) => (
                <li key={k}>
                  <span>{x.name}</span>
                  <span className={'dymo ' + (TAPE[x.kind] ?? '')}>{x.result}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <Watch e={e} />
        </div>
      </div>
      <div className="pass-side">
        {e.kind === 'won' ? <Medal /> : null}
        {e.photos.length === 0 && e.kind !== 'won' ? <Bot /> : null}
        {e.photos.map((im, k) => (
          <Print key={im.src + k} img={im} rot={rots[(k + i) % 4]} limits={[0.52, 1.5]} />
        ))}
      </div>
    </article>
  );
}

export function Log() {
  const site = useSite();
  const g = site.log;
  const root = useGsap<HTMLElement>((el) => reveals(el), [site]);

  const big = g.events.filter((e) => e.importance >= 3);
  const mid = g.events.filter((e) => e.importance === 2);
  const small = g.events.filter((e) => e.importance <= 1);

  // "Won some, lost some": the first half stands up, the second half falls over
  const words = g.title.toUpperCase();
  const cut = words.includes(', ') ? words.indexOf(', ') : -1;
  const up = cut > 0 ? words.slice(0, cut + 1) : words;
  const down = cut > 0 ? words.slice(cut + 2) : '';
  const lipo = site.extra.lipo;

  return (
    <section id="log" data-sec ref={root} className="log">
      <div
        className="section sec-head"
        data-track="[[0.5,0],[0.5,0.08],[0.965,0.08],[0.965,0.86],[0.5,0.86],[0.5,1]]" data-track-s="[[0.004,0],[0.004,1]]"
      >
        <div className="wrap">
          <h2 className="sr">{g.title}</h2>
          <Letters text={up} style="gold" depth={34} bevel={3} curve={7} decorative className="title3d long" onLetters={(l, s) => popLetters(l, s, 18, { z: 700, stagger: 0.07 })} />
          {down ? <Letters text={down} style="steel" depth={30} bevel={2} curve={6} decorative className="title3d long" onLetters={flop} /> : null}
          <p className="lede" data-rv="lines">{g.intro}</p>
        </div>
      </div>

      <div className="section passes" data-track="[[0.5,0],[0.46,0.12],[0.54,0.24],[0.46,0.36],[0.54,0.5],[0.46,0.64],[0.54,0.78],[0.5,0.9],[0.5,1]]" data-track-s="[[0.004,0],[0.004,1]]">
        <div className="wrap">
          {big.map((e, i) => (
            <Pass e={e} i={i} key={e.title + i} />
          ))}
        </div>
      </div>

      {mid.length ? (
        <div className="section mids" data-track="[[0.5,0],[0.5,0.03],[0.03,0.03],[0.03,1]]" data-track-s="[[0.004,0],[0.004,1]]">
          <div className="wrap mid-grid">
            {mid.map((e, i) => (
              <article className="mid" key={e.title + i}>
                {e.photos[0] ? <Print img={e.photos[0]} video={e.video} rot={i % 2 ? 2.5 : -3} limits={[0.95, 2.3]} /> : null}
                <span className={'dymo ' + (TAPE[e.kind] ?? '')} data-rv="dymo">
                  {e.result}
                </span>
                <h3>{e.title}</h3>
                <p className="mid-host">
                  {e.host}
                  {e.date ? <span>{e.date}</span> : null}
                </p>
                {e.text ? <p>{e.text}</p> : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {small.length ? (
        <div className="section smalls" data-track="[[0.03,0],[0.03,1]]" data-track-s="[[0.004,0],[0.004,1]]">
          <div className="wrap">
            <ul className="small-list">
              {small.map((e, i) => (
                <li key={e.title + i}>
                  <b>{e.title}</b>
                  <span>{e.host}</span>
                  <span>{e.date}</span>
                  <span className={'dymo ' + (TAPE[e.kind] ?? '')} data-rv="dymo">
                    {e.result}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {lipo.show ? (
        <div className="section lipo" data-track="[[0.03,0],[0.03,0.9],[0.972,0.9],[0.972,1]]" data-track-s="[[0.004,0],[0.004,1]]">
          <div className="wrap lipo-in">
            <Print img={lipo.image} video={lipo.video} rot={-3} ratio="4/3" className="burnt" />
            <div>
              <h3>{lipo.title}</h3>
              <p className="note" data-rv="mark">{lipo.text}</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
