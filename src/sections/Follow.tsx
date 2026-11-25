import { useRef, useState } from 'react';
import { Print } from '../components/Print';
import { useSite, type Robot } from '../content';
import { useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';
import { gsap, reduced } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import type { Letter, LetterStage } from '../world/letters';
import { penStage, type PenStage } from '../world/stages/pen';

/** Letters drive in nose to tail along a wavy line, then park. */
function convoy(letters: Letter[], stage: LetterStage) {
  if (reduced()) return;
  const st = { v: 0 };
  letters.forEach((l) => (l.s.k = 0));
  const off = onceInView(
    stage.el,
    () => {
      letters.forEach((l) => (l.s.k = 1));
      gsap.to(st, { v: 1, duration: 2.4, ease: 'power2.out' });
    },
    18,
  );
  stage.drive = (t) => {
    letters.forEach((l) => {
      const left = (1 - st.v) * 2200;
      const path = (x: number) => Math.sin(x * 0.0052) * 120 * Math.min(1, left / 700);
      const x = l.hx + left;
      l.s.x = left;
      l.s.y = path(x) - path(l.hx) * 0;
      l.s.rz = Math.cos(x * 0.0052) * 0.55 * Math.min(1, left / 500) + Math.sin(t * 2.2 + l.i * 0.7) * 0.012;
      if (left < 1) {
        l.s.y = Math.sin(t * 1.4 + l.i * 0.6) * 3;
      }
    });
  };
  return off;
}

function Pen({ r }: { r: Robot }) {
  const stage = useRef<PenStage | null>(null);
  const [goals, setGoals] = useState(0);
  const floor = useStage<HTMLDivElement>(
    (el) => {
      const s = penStage(el, r.model);
      s.onGoal = () => setGoals((g) => g + 1);
      stage.current = s;
      return s;
    },
    [r.model],
  );
  const inside = (v: boolean) => () => {
    if (stage.current) stage.current.inside = v;
  };
  const hint: Record<string, string> = { line: 'Bend it', avoid: 'Block it', soccer: 'Kick', bluetooth: 'Drive', sumo1: 'Aim', sumo2: 'Dare it' };
  return (
    <article className="pen">
      <div className="pen-floor" ref={floor} data-cursor={hint[r.model]} onPointerEnter={inside(true)} onPointerLeave={inside(false)} style={{ touchAction: 'pan-y' }}>
        {r.model === 'soccer' && goals > 0 ? (
          <span className="pen-goal" key={goals}>
            Goal
          </span>
        ) : null}
      </div>
      <div className="pen-text">
        <h3>{r.name}</h3>
        <p>{r.text}</p>
        {r.note ? <span className="dymo" data-rv="dymo">{r.note}</span> : null}
      </div>
    </article>
  );
}

export function Follow() {
  const site = useSite();
  const f = site.follow;
  const root = useGsap<HTMLElement>(
    (el) => {
      reveals(el);
    },
    [site],
  );
  const rots = [-4, 3, -2.5, 4, -3];
  return (
    <section id="follow" data-sec ref={root} className="follow">
      <div
        className="section sec-head"
        data-track="[[0.975,0],[0.975,0.32],[0.82,0.4],[0.9,0.5],[0.78,0.6],[0.9,0.7],[0.5,0.82],[0.04,0.82],[0.04,1]]" data-track-s="[[0.004,0],[0.004,0.66],[0.996,0.86],[0.996,1]]"
      >
        <div className="wrap">
          <Letters as="h2" text={f.title.toUpperCase()} style="kraft" depth={36} className="title3d long" onLetters={convoy} />
          <p className="lede" data-rv="lines">{f.intro}</p>
        </div>
      </div>
      <div className="section pens-sec" data-track="[[0.04,0],[0.04,0.97],[0.5,0.97],[0.5,1]]" data-track-s="[[0.996,0],[0.996,1]]">
        <div className="wrap pens">
          {f.robots.map((r, i) => (
            <Pen r={r} key={r.name + i} />
          ))}
        </div>
        {f.photos.length ? (
          <div className="wrap follow-photos">
            {f.photos.map((im, i) => (
              <Print key={im.src + i} img={im} rot={rots[i % rots.length]} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
