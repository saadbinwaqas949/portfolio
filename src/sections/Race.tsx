import { useEffect, useRef, useState } from 'react';
import { Kitty } from '../components/Kitty';
import { Print } from '../components/Print';
import { useSite } from '../content';
import { pinProgress, useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';
import { gsap, reduced } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import { smooth } from '../world/kit';
import type { Letter, LetterStage } from '../world/letters';
import { raceStage, type RaceStage } from '../world/stages/race';

/** Letters arrive flat out, brake hard and rock back on their springs. */
function brake(letters: Letter[], stage: LetterStage) {
  if (reduced()) return;
  const q = letters.map(() => ({ x: -2400, r: 0 }));
  letters.forEach((l) => (l.s.k = 0));
  const off = onceInView(
    stage.el,
    () =>
      letters.forEach((l, i) => {
        const n = letters.length - 1 - i;
        l.s.k = 1;
        gsap.fromTo(q[i], { x: -2400 }, { x: 0, duration: 0.85, delay: n * 0.1, ease: 'expo.out' });
        gsap.fromTo(q[i], { r: 0 }, { keyframes: [{ r: -0.24, duration: 0.2, delay: 0.16 }, { r: 0.07, duration: 0.18 }, { r: 0, duration: 0.5, ease: 'elastic.out(1,0.4)' }], delay: n * 0.1 });
      }),
    16,
  );
  stage.drive = () =>
    letters.forEach((l, i) => {
      l.s.x = q[i].x;
      l.s.rz = q[i].r * 0.5;
      l.s.ry = q[i].r;
    });
  return off;
}

function Countdown({ iso }: { iso: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const to = Date.parse(iso);
    if (!isFinite(to)) return;
    const f = () => setLeft(to - Date.now());
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, [iso]);
  if (left === null || left < 0) return null;
  const s = Math.floor(left / 1000);
  const parts: [number, string][] = [
    [Math.floor(s / 86400), 'days'],
    [Math.floor(s / 3600) % 24, 'hours'],
    [Math.floor(s / 60) % 60, 'minutes'],
    [s % 60, 'seconds'],
  ];
  return (
    <div className="rc-count" role="timer" aria-label={`${parts[0][0]} days to go`}>
      {parts.map(([v, l]) => (
        <span key={l} aria-hidden>
          <b key={v}>{String(v).padStart(2, '0')}</b>
          {l}
        </span>
      ))}
    </div>
  );
}

export function Race() {
  const site = useSite();
  const r = site.race;
  const stage = useRef<RaceStage | null>(null);
  const [cheer, setCheer] = useState(0);
  const [go, setGo] = useState(0); // 0 idle, 1-5 lights, 6 away
  const tunnel = useStage<HTMLDivElement>((el) => {
    const s = raceStage(el);
    s.onDone = () => setGo(0);
    stage.current = s;
    return s;
  });

  useEffect(() => {
    if (!go || go > 5) return;
    const id = setTimeout(() => setGo(go + 1), go === 5 ? 500 + Math.random() * 900 : 420);
    if (go === 5) return () => clearTimeout(id);
    return () => clearTimeout(id);
  }, [go]);
  useEffect(() => {
    if (go === 6) {
      stage.current?.launch();
      setCheer((n) => n + 1);
    }
  }, [go]);

  const root = useGsap<HTMLElement>(
    (el) => {
      reveals(el);
      const facts = gsap.utils.toArray<HTMLElement>('.rc-fact', el);
      const st = pinProgress(el.querySelector<HTMLElement>('.rc-pin')!, (v) => {
        if (stage.current) stage.current.fan = smooth(0.02, 0.6, v);
        const calm = reduced();
        facts.forEach((f, i) => {
          const a = calm ? 1 : smooth(0.06 + i * 0.1, 0.16 + i * 0.1, v);
          gsap.set(f, { opacity: a, x: (1 - a) * 60 });
          f.style.setProperty('--d', a.toFixed(3));
        });
      });
      // the bars of the score sheet fill to their share
      const bars = gsap.utils.toArray<HTMLElement>('.rc-bar i', el);
      const off = onceInView(el.querySelector('.rc-judged')!, () => {
        if (!reduced()) gsap.from(bars, { scaleX: 0, duration: 1.1, stagger: 0.09, ease: 'power3.out' });
      });
      return () => {
        st.kill();
        off();
      };
    },
    [site],
  );
  const max = Math.max(1, ...r.judged.map((j) => parseFloat(j.value) || 0));

  return (
    <section id="race" data-sec ref={root} className="race">
      <div className="section sec-head" data-track="[[0.5,0],[0.5,0.12],[0.94,0.12],[0.94,0.9],[0.022,0.9],[0.022,1]]" data-track-s="[[0.004,0],[0.004,1]]">
        <div className="wrap rc-head">
          <div>
            <Letters as="h2" text={r.title.toUpperCase()} style="carbon" depth={38} bevel={2.5} curve={7} ink={0xff6a5e} className="title3d" onLetters={brake} />
            <p className="lede" data-rv="lines">{r.lead}</p>
          </div>
          <div className="rc-card">
            <span className="dymo green" data-rv="dymo">{r.status}</span>
            <h3>{r.event}</h3>
            <p>
              {r.date}. {r.place}.
            </p>
            <Countdown iso={r.iso} />
          </div>
        </div>
      </div>

      <div className="rc-pin" data-pin style={{ height: '300vh' }}>
        <div className="pin rc-stick">
          <div className="rc-tunnel" ref={tunnel} data-cursor="Smoke" />
          <div className={'rc-lights' + (go ? ' on' : '')} aria-hidden>
            {[1, 2, 3, 4, 5].map((n) => (
              <i key={n} className={go >= n && go < 6 ? 'lit' : ''} />
            ))}
          </div>
          <ul className="rc-facts">
            {r.stats.map((s, i) => (
              <li className="rc-fact" key={i}>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
          <div className="rc-foot">
            <p className="note">{r.stand}</p>
            <Kitty pose="sit" coat="ginger" className="rc-cat" cheer={cheer} say="go go go" />
            <button type="button" className="plug" disabled={go > 0} onClick={() => setGo(1)}>
              {go > 5 ? 'Away' : go ? 'Hold' : r.launch}
            </button>
          </div>
        </div>
      </div>

      <div className="section rc-more" data-track="[[0.022,0],[0.022,0.95],[0.5,0.95],[0.5,1]]" data-track-s="[[0.004,0],[0.004,1]]">
        <div className="wrap rc-two">
          <p className="rc-text" data-rv="lines">{r.text}</p>
          <div className="rc-judged">
            <h3>{r.judgedTitle}</h3>
            <dl>
              {r.judged.map((j, i) => (
                <div key={i} className="rc-bar">
                  <dt>{j.label}</dt>
                  <dd>{j.value}</dd>
                  <i style={{ width: `${((parseFloat(j.value) || 0) / max) * 100}%` }} />
                </div>
              ))}
            </dl>
            {r.link.url ? (
              <a className="tlink" href={r.link.url} target="_blank" rel="noreferrer">
                {r.link.label}
              </a>
            ) : null}
          </div>
        </div>
        <div className="wrap rc-clips">
          {r.clips.map((c, i) => (
            <Print key={c.src} img={c} rot={[-2.2, 1.8, -1.4, 2.4][i % 4]} limits={[1, 1.9]} />
          ))}
        </div>
      </div>
    </section>
  );
}
