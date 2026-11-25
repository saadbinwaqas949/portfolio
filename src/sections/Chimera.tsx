import { useRef, useState } from 'react';
import { Print } from '../components/Print';
import { useSite } from '../content';
import { pinProgress, useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';
import { gsap, reduced, scrollToY } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import { clamp } from '../world/kit';
import type { Letter, LetterStage } from '../world/letters';
import { chimeraStage, type ChimeraMode, type ChimeraStage } from '../world/stages/chimera';
import { crateStage, type CrateStage } from '../world/stages/misc';

/** Letters that will not sit still: they jump, misregister and settle again. */
function glitch(letters: Letter[], stage: LetterStage) {
  if (reduced()) return;
  const s = letters.map(() => ({ t: 0, x: 0, y: 0, r: 0, z: 0, k: 0 }));
  let live = false;
  const off = onceInView(stage.el, () => (live = true), 15);
  letters.forEach((l) => (l.s.k = 0));
  stage.drive = (t, dt) => {
    if (!live) return;
    letters.forEach((l, i) => {
      const q = s[i];
      q.t -= dt;
      if (q.t <= 0) {
        const wild = Math.random() < 0.26;
        q.t = wild ? 0.05 + Math.random() * 0.1 : 0.4 + Math.random() * 1.8;
        q.x = wild ? (Math.random() - 0.5) * 46 : 0;
        q.y = wild ? (Math.random() - 0.5) * 30 : 0;
        q.r = wild ? (Math.random() - 0.5) * 0.5 : 0;
        q.z = wild ? Math.random() * 60 : 0;
        q.k = wild && Math.random() < 0.25 ? 0.001 : 1;
      }
      l.s.x = q.x;
      l.s.y = q.y;
      l.s.rz = q.r;
      l.s.z = q.z + Math.sin(t * 3 + i) * 1.5;
      l.s.k = q.k;
    });
  };
  return off;
}

const ICONS: Record<string, string> = {
  car: 'M4 20h40M10 20a5 5 0 1 0 .1 0M38 20a5 5 0 1 0 .1 0M4 18l5-9h22l9 9',
  boat: 'M4 18h40l-7 9H11zM24 18V4l12 12M2 31c5-4 8 3 13 0s8 3 13 0 8 3 13 0',
  plane: 'M2 20l44-8-44-8 8 8zM10 12h36M18 4l-6-3M18 20l-6 3',
  quad: 'M14 10l20 14M34 10L14 24M14 10a7 7 0 1 0 .1 0M34 10a7 7 0 1 0 .1 0M14 24a7 7 0 1 0 .1 0M34 24a7 7 0 1 0 .1 0',
};

export function Chimera() {
  const site = useSite();
  const c = site.chimera;
  const crate = useRef<CrateStage | null>(null);
  const craft = useRef<ChimeraStage | null>(null);
  const pin = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState(0);
  const now = useRef(0);

  const box = useStage<HTMLButtonElement>(
    (el) => {
      const s = crateStage(el, c.title.toUpperCase());
      s.rest = c.open ? 0.92 : 0;
      crate.current = s;
      return s;
    },
    [c.open, c.title],
  );
  const stand = useStage<HTMLDivElement>((el) => {
    const s = chimeraStage(el);
    s.mode = (c.modes[now.current]?.id as ChimeraMode) ?? 'car';
    craft.current = s;
    return s;
  });

  const root = useGsap<HTMLElement>(
    (el) => {
      reveals(el);
      const pinEl = el.querySelector<HTMLElement>('.chm-pin');
      const steps = gsap.utils.toArray<HTMLElement>('.chm-step', el);
      const kills: (() => void)[] = [];
      if (pinEl && c.modes.length) {
        const st = pinProgress(pinEl, (v) => {
          const n = Math.min(c.modes.length - 1, Math.floor(clamp(v * 1.02) * c.modes.length));
          pinEl.style.setProperty('--v', v.toFixed(4));
          if (n === now.current) return;
          now.current = n;
          setMode(n);
          if (craft.current) craft.current.mode = (c.modes[n].id as ChimeraMode) ?? 'car';
        });
        kills.push(() => st.kill());
      }
      steps.forEach((s) => kills.push(onceInView(s, () => s.classList.add('in'), 24)));
      return () => kills.forEach((f) => f());
    },
    [site],
  );

  const jump = (i: number) => {
    const p = pin.current;
    if (!p) return;
    const r = p.getBoundingClientRect();
    const len = r.height - innerHeight;
    scrollToY(scrollY + r.top + (len * (i + 0.5)) / c.modes.length);
  };

  const closed = !c.open;
  return (
    <section id="chimera" data-sec ref={root} className="chimera">
      <div className="section" data-track="[[0.5,0],[0.5,0.1],[0.022,0.1],[0.022,1]]" data-track-s="[[0.004,0],[0.004,1]]">
        <div className="wrap chi">
          <div className="chi-text">
            <Letters as="h2" text={c.title.toUpperCase()} style="foam" depth={30} bevel={2} curve={6} className="chi-title" onLetters={glitch} />
            {c.open && c.status ? <span className="dymo red" data-rv="dymo">{c.status}</span> : null}
            <p className="lede" data-rv="lines">{c.teaser}</p>
            {c.open && c.story ? <p className="chi-story">{c.story}</p> : null}
            {c.open && c.link?.url ? (
              <a className="tlink" href={c.link.url} target="_blank" rel="noreferrer">
                {c.link.label || 'See more'}
              </a>
            ) : null}
          </div>
          <button type="button" className="chi-box" ref={box} data-cursor={closed ? 'Peek' : undefined} data-nolock aria-label={closed ? `${c.title}: peek inside the box` : c.title} onClick={() => crate.current?.poke()} />
        </div>
      </div>

      {closed || !c.modes.length ? null : (
        <div className="chm-pin" data-pin ref={pin} style={{ height: `${c.modes.length * 90 + 60}vh` }}>
          <div className="pin chm">
            <div className="chm-stand" ref={stand} data-cursor="Look" />
            <div className="chm-side">
              <ul className="chm-tabs">
                {c.modes.map((m, i) => (
                  <li key={m.id}>
                    <button type="button" aria-pressed={i === mode} onClick={() => jump(i)}>
                      <svg viewBox="0 0 48 34" aria-hidden>
                        <path d={ICONS[m.id] ?? ICONS.car} />
                      </svg>
                      {m.title}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="chm-copy">
                {c.modes.map((m, i) => (
                  <p key={m.id} className={i === mode ? 'on' : ''} aria-hidden={i !== mode}>
                    {m.text}
                  </p>
                ))}
              </div>
              <dl className="chm-stats">
                {c.stats.map((s, i) => (
                  <div key={i}>
                    <dd>{s.value}</dd>
                    <dt>{s.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
            {c.uses.length ? (
              <div className="chm-uses" aria-label={'Uses: ' + c.uses.join(', ')}>
                <div aria-hidden>
                  {[...c.uses, ...c.uses, ...c.uses].map((u, i) => (
                    <span key={i}>{u}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {closed ? null : (
        <div className="section chm-story" data-track="[[0.022,0],[0.022,0.02],[0.5,0.04],[0.5,1]]" data-track-s="[[0.004,0],[0.004,1]]">
          <div className="wrap">
            <ol className="chm-steps">
              {c.chapters.map((s, i) => {
                const im = c.images[i];
                return (
                  <li className="chm-step" key={i}>
                    <div className="chm-words">
                      <span className={'dymo ' + (s.result === 'out' ? 'red' : '')}>{s.when}</span>
                      <h3>{s.title}</h3>
                      <p>{s.text}</p>
                    </div>
                    {im ? <Print img={im} rot={i % 2 ? 2.4 : -2.4} limits={[0.9, 2.2]} /> : null}
                  </li>
                );
              })}
            </ol>
            {c.images.length > c.chapters.length ? (
              <div className="follow-photos">
                {c.images.slice(c.chapters.length).map((im, i) => (
                  <Print key={im.src + i} img={im} rot={i % 2 ? 3 : -3} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
