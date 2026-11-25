import { useRef } from 'react';
import { Print } from '../components/Print';
import { useSite } from '../content';
import { useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';
import { reduced } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import type { Letter, LetterStage } from '../world/letters';
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

export function Chimera() {
  const site = useSite();
  const c = site.chimera;
  const stage = useRef<CrateStage | null>(null);
  const box = useStage<HTMLButtonElement>(
    (el) => {
      const s = crateStage(el, c.title.toUpperCase());
      s.rest = c.open ? 1 : 0;
      stage.current = s;
      return s;
    },
    [c.open, c.title],
  );
  const root = useGsap<HTMLElement>((el) => reveals(el), [site]);

  return (
    <section id="chimera" data-sec ref={root} className="chimera">
      <div
        className="section"
        data-track="[[0.5,0],[0.5,0.1],[0.045,0.1],[0.045,0.9],[0.5,0.9],[0.5,1]]" data-track-s="[[0.004,0],[0.004,1]]"
      >
        <div className="wrap chi">
          <div className="chi-text">
            <Letters as="h2" text={c.title.toUpperCase()} style="foam" depth={30} bevel={2} curve={6} className="chi-title" onLetters={glitch} />
            <p className="lede" data-rv="lines">{c.open && c.story ? c.story : c.teaser}</p>
            {c.open && c.link?.url ? (
              <a className="tlink" href={c.link.url} target="_blank" rel="noreferrer">
                {c.link.label || 'See more'}
              </a>
            ) : null}
          </div>
          <button type="button" className="chi-box" ref={box} data-cursor={c.open ? undefined : 'Peek'} data-nolock aria-label={c.open ? c.title : `${c.title}: peek inside the box`} onClick={() => stage.current?.poke()} />
        </div>
        {c.open && c.images.length ? (
          <div className="wrap follow-photos">
            {c.images.map((im, i) => (
              <Print key={im.src + i} img={im} rot={i % 2 ? 3 : -3.5} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
