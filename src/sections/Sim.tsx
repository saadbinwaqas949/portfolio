import { Deck } from '../components/Deck';
import { Kitty } from '../components/Kitty';
import { Print } from '../components/Print';
import { SimRun } from '../components/SimRun';
import { useSite } from '../content';
import { useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';
import { gsap, reduced } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters } from '../world/hooks';
import type { Letter, LetterStage } from '../world/letters';

/** The title is computed: every letter runs through a few wrong answers first. */
function converge(letters: Letter[], stage: LetterStage) {
  if (reduced()) return;
  const q = letters.map((_, i) => ({ e: 1, seed: i * 7.13 }));
  letters.forEach((l) => (l.s.k = 0));
  const off = onceInView(
    stage.el,
    () => letters.forEach((_, i) => gsap.to(q[i], { e: 0, duration: 1.5 + i * 0.09, ease: 'steps(9)' })),
    16,
  );
  stage.drive = (t) => {
    letters.forEach((l, i) => {
      const e = q[i].e;
      l.s.k = e >= 1 ? 0 : 1;
      const n = Math.floor(e * 9) + q[i].seed;
      l.s.x = Math.sin(n * 12.9) * 150 * e;
      l.s.y = Math.cos(n * 7.7) * 130 * e;
      l.s.z = Math.abs(Math.sin(n * 3.3)) * 420 * e + Math.sin(t * 1.6 + i) * 1.5;
      l.s.rx = Math.sin(n * 5.1) * 1.6 * e;
      l.s.ry = Math.cos(n * 4.3) * 1.6 * e;
    });
  };
  return off;
}

export function Sim() {
  const site = useSite();
  const s = site.sim;
  const root = useGsap<HTMLElement>((el) => reveals(el), [site]);
  return (
    <section id="sim" data-sec ref={root} className="simsec">
      <div className="section sec-head" data-track="[[0.5,0],[0.5,0.14],[0.022,0.14],[0.022,1]]" data-track-s="[[0.004,0],[0.004,1]]">
        <div className="wrap">
          <Letters as="h2" text={s.title.toUpperCase()} style="steel" depth={32} bevel={2} curve={6} className="title3d long" onLetters={converge} />
          <p className="lede" data-rv="lines">{s.intro}</p>
        </div>
      </div>
      <div className="section sim-main" data-track="[[0.022,0],[0.022,0.95],[0.5,0.95],[0.5,1]]" data-track-s="[[0.004,0],[0.004,1]]">
        <div className="wrap">
          <div className="sim-top">
            <h3>{s.main}</h3>
            <p>{s.mainText}</p>
          </div>
          <div className="kt-on sim-on">
            <Deck clips={s.clips} skin="sim" label={s.main} />
            <Kitty pose="loaf" coat="calico" className="on-sim" say="crashed again" />
          </div>
          {s.others.length ? (
            <p className="sim-others">
              {s.others.map((o) => (
                <span className="dymo" data-rv="dymo" key={o}>
                  {o}
                </span>
              ))}
              <span>{s.othersText}</span>
            </p>
          ) : null}
        </div>
        <div className="wrap sim-two">
          <div className="sim-gz">
            <Print img={s.gazebo.image} rot={-2.5} limits={[0.74, 2.1]} />
            <h3>{s.gazebo.title}</h3>
            <p>{s.gazebo.text}</p>
          </div>
          <div className="sim">
            <div className="sim-head">
              <h3>{s.game.title}</h3>
              <p>{s.game.text}</p>
            </div>
            <div className="goggles">
              <SimRun label={s.game.text} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
