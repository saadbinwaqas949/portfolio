import { useRef, useState } from 'react';
import { Clothesline } from '../components/Clothesline';
import { Print } from '../components/Print';
import { useSite } from '../content';
import { pinProgress, useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';
import { gsap, reduced } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import { smooth } from '../world/kit';
import type { Letter, LetterStage } from '../world/letters';
import { beltStage, type BeltStage } from '../world/stages/belt';

/** Letters arrive in jerks, as if on a conveyor. */
function conveyor(letters: Letter[], stage: LetterStage) {
  if (reduced()) return;
  const st = { v: 0 };
  letters.forEach((l) => (l.s.k = 0));
  const off = onceInView(
    stage.el,
    () => {
      letters.forEach((l) => (l.s.k = 1));
      const tl = gsap.timeline();
      for (let i = 1; i <= 6; i++) tl.to(st, { v: i / 6, duration: 0.2, ease: 'power3.inOut' }).to({}, { duration: 0.07 });
    },
    20,
  );
  stage.drive = (t) => {
    letters.forEach((l) => {
      l.s.x = -(1 - st.v) * 1900;
      l.s.z = st.v < 1 ? Math.abs(Math.sin(t * 30 + l.i)) * 2.5 : 0;
      l.s.rz = st.v < 1 ? Math.sin(t * 24 + l.i * 2) * 0.012 : 0;
    });
  };
  return off;
}

function Gauge({ label }: { label: string }) {
  return (
    <svg className="gauge" viewBox="0 0 240 166" aria-hidden>
      <path d="M24 122A96 96 0 0 1 79 35" stroke="#1f9d58" />
      <path d="M86 31A96 96 0 0 1 154 31" stroke="#ff9d1a" />
      <path d="M161 35A96 96 0 0 1 216 122" stroke="#e5322d" />
      <g className="needle">
        <path d="M114 122L120 42L126 122Z" fill="#0b1433" stroke="none" />
        <circle cx="120" cy="122" r="11" fill="#0b1433" />
      </g>
      <text x="120" y="158" textAnchor="middle">
        {label}
      </text>
    </svg>
  );
}

export function Ship() {
  const site = useSite();
  const s = site.ship;
  const c = s.codshield;
  const belt = useRef<BeltStage | null>(null);
  const prog = useRef(0);
  const [said, setSaid] = useState(0);
  const [step, setStep] = useState(0);
  const typed = useRef({ said: -1, step: -1 });

  const beltEl = useStage<HTMLDivElement>((el) => {
    const b = beltStage(el);
    belt.current = b;
    b.p = prog.current;
    return b;
  });

  const root = useGsap<HTMLElement>(
    (el) => {
      reveals(el);
      const pin = el.querySelector<HTMLElement>('.cod-pin')!;
      const needle = el.querySelector<SVGGElement>('.needle');
      const after = el.querySelector<HTMLElement>('.addr-after');
      const st = pinProgress(pin, (v) => {
        prog.current = v;
        if (belt.current) belt.current.p = v;
        // chat: one message per slice of the first third
        const n = c.demo.chat.length;
        const k = Math.max(0, Math.min(n, Math.floor(((v - 0.03) / 0.24) * n + 1)));
        const nowSaid = v < 0.03 ? 0 : k;
        if (nowSaid !== typed.current.said) {
          typed.current.said = nowSaid;
          setSaid(nowSaid);
        }
        const nowStep = v < 0.32 ? 0 : v < 0.48 ? 1 : v < 0.65 ? 2 : v < 0.8 ? 3 : 4;
        if (nowStep !== typed.current.step) {
          const up = nowStep > typed.current.step;
          typed.current.step = nowStep;
          setStep(nowStep);
          if (nowStep === 1 && up && after && !reduced())
            gsap.fromTo(after, { scrambleText: '' }, { duration: 1.3, delay: 0.35, scrambleText: { text: c.demo.addressAfter, chars: 'lowerCase', speed: 0.6 }, ease: 'none' });
        }
        if (needle) {
          const g = smooth(0.5, 0.6, v);
          needle.style.transform = `rotate(${-88 + g * 1.76 * c.demo.risk + Math.sin(v * 160) * 2 * g * (1 - g)}deg)`;
        }
      });
      return () => st.kill();
    },
    [site],
  );

  return (
    <section id="ship" data-sec ref={root} className="ship">
      <div
        className="section sec-head"
        data-track="[[0.5,0],[0.5,0.14],[0.95,0.14],[0.95,0.5],[0.8,0.6],[0.8,0.8],[0.975,0.86],[0.975,1]]" data-track-s="[[0.004,0],[0.004,0.74],[0.996,0.94],[0.996,1]]"
      >
        <div className="wrap">
          <Letters as="h2" text={s.title.toUpperCase()} style="kraft" depth={58} className="title3d" onLetters={conveyor} />
          <p className="lede" data-rv="lines">{s.intro}</p>
        </div>
      </div>

      <div className="cod-pin" data-pin style={{ height: '520vh' }}>
        <div className="pin cod">
          <div className="cod-grid">
            <div className="phone" aria-label="Example chat with the shop assistant">
              <div className="ph-top">
                <i />
                <span>Shop chat</span>
              </div>
              <ol className="ph-chat">
                {c.demo.chat.map((m, i) => (
                  <li key={i} className={`${m.from} ${i < said ? 'in' : ''}`}>
                    {m.text}
                  </li>
                ))}
                <li className={'typing ' + (said < c.demo.chat.length && c.demo.chat[said]?.from === 'shop' ? 'in' : '')} aria-hidden>
                  <i />
                  <i />
                  <i />
                </li>
              </ol>
            </div>

            <div className="cod-main">
              <div className={'cod-intro ' + (step === 0 ? 'in' : '')}>
                <span className="dymo yellow">{c.status}</span>
                <h3>{c.name}</h3>
                <p>{c.text}</p>
              </div>
              <div className={'cod-card ' + (step === 1 ? 'in' : '')}>
                <h4>{c.points[1]?.title}</h4>
                <p className="addr-before">{c.demo.addressBefore}</p>
                <p className="addr-after">{c.demo.addressAfter}</p>
                <p className="cod-sub">{c.points[1]?.text}</p>
              </div>
              <div className={'cod-card ' + (step === 2 ? 'in' : '')}>
                <h4>{c.points[2]?.title}</h4>
                <div className="risk">
                  <Gauge label={c.demo.riskLabel} />
                  <ul>
                    {c.demo.reasons.map((r, i) => (
                      <li key={i} style={{ ['--i' as any]: i }}>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="cod-sub">{c.demo.note}</p>
              </div>
              <div className={'cod-card ' + (step === 3 ? 'in' : '')}>
                <h4>{c.points[3]?.title}</h4>
                <div className="call">
                  <svg viewBox="0 0 120 120" aria-hidden>
                    <circle className="rg" cx="60" cy="60" r="30" />
                    <circle className="rg" cx="60" cy="60" r="30" />
                    <circle cx="60" cy="60" r="30" fill="#1f9d58" />
                    <path d="M48 46c-4 4 0 14 8 22s18 12 22 8l4-6-10-8-5 4c-5-2-9-6-11-11l4-5-8-10z" fill="#fff" />
                  </svg>
                  <p>{c.points[3]?.text}</p>
                </div>
              </div>
              <div className={'cod-card ' + (step === 4 ? 'in' : '')}>
                <h4>Only now does it ship</h4>
                <p className="cod-sub big">{c.points[0]?.text}</p>
              </div>
            </div>
          </div>
          <div className="cod-belt" ref={beltEl} aria-hidden />
        </div>
      </div>

      <div className="section cod-more" data-track="[[0.975,0],[0.975,0.12],[0.04,0.12],[0.04,1]]" data-track-s="[[0.996,0],[0.996,1]]">
        <div className="wrap cod-cols">
          <div>
            <h3>Working now</h3>
            <ul className="ticks">
              {c.working.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Coming next</h3>
            <ul className="ticks open">
              {c.next.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Built with</h3>
            <p className="stack">
              {c.stack.map((x, i) => (
                <span className="dymo" data-rv="dymo" key={i}>
                  {x}
                </span>
              ))}
            </p>
            <a className="tlink" href={c.link.url} target="_blank" rel="noreferrer">
              {c.link.label}
            </a>
          </div>
        </div>
      </div>

      <div className="section rag" data-track="[[0.04,0],[0.04,0.9],[0.5,0.9],[0.5,1]]" data-track-s="[[0.996,0],[0.996,0.93],[0.004,1]]">
        <div className="wrap">
          <Clothesline />
          <div className="rag-cols">
            <div>
              <span className="dymo red" data-rv="dymo">{s.ragnready.status}</span>
              <h3 className="rag-name">{s.ragnready.name}</h3>
            </div>
            <div>
              <p className="rag-text" data-rv="lines">{s.ragnready.text}</p>
              <p className="stack">
                {s.ragnready.stack.map((x, i) => (
                  <span className="dymo" data-rv="dymo" key={i}>
                    {x}
                  </span>
                ))}
              </p>
              <a className="tlink" href={s.ragnready.link.url} target="_blank" rel="noreferrer">
                {s.ragnready.link.label}
              </a>
            </div>
          </div>
          {s.ragnready.images.length ? (
            <div className="follow-photos">
              {s.ragnready.images.map((im, i) => (
                <Print key={im.src + i} img={im} rot={i % 2 ? 3 : -3} />
              ))}
            </div>
          ) : null}
          {s.projects.map((p, i) => (
            <div className="rag-cols extra" key={i}>
              <div>
                {p.status ? <span className="dymo red" data-rv="dymo">{p.status}</span> : null}
                <h3 className="rag-name">{p.name}</h3>
              </div>
              <div>
                <p className="rag-text" data-rv="lines">{p.text}</p>
                <p className="stack">
                  {p.stack.map((x, k) => (
                    <span className="dymo" data-rv="dymo" key={k}>
                      {x}
                    </span>
                  ))}
                </p>
                {p.link?.url ? (
                  <a className="tlink" href={p.link.url} target="_blank" rel="noreferrer">
                    {p.link.label || 'See it'}
                  </a>
                ) : null}
                {p.images.length ? (
                  <div className="bay-shots">
                    {p.images.map((im, k) => (
                      <Print key={k} img={im} rot={k % 2 ? 3 : -3} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
