import { useRef } from 'react';
import { Kitty } from '../components/Kitty';
import { Print } from '../components/Print';
import { useSite } from '../content';
import { useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';

import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import { trayStage, type TrayStage } from '../world/stages/misc';
import { popLetters } from './About';

/** chips per group in the tray; everything else is in the list below it */
const EACH = 4;
const COLORS = [0x2f6bff, 0xffc21a, 0x22c3c9, 0xe5322d, 0x1fb573, 0xff8a3d, 0xff7ab8, 0x8b5cf6];
const CSS = ['#2f6bff', '#ffc21a', '#22c3c9', '#e5322d', '#1fb573', '#ff8a3d', '#ff7ab8', '#8b5cf6'];

export function Toolbox() {
  const site = useSite();
  const t = site.toolbox;
  const stage = useRef<TrayStage | null>(null);
  const arrived = useRef(false);
  const tray = useStage<HTMLDivElement>(
    (el) => {
      const s = trayStage(
        el,
        t.groups.flatMap((g, i) => g.items.slice(0, EACH).map((name) => ({ name, color: COLORS[i % COLORS.length] }))),
      );
      stage.current = s;
      if (arrived.current) s.drop();
      return s;
    },
    [t.groups],
  );
  const root = useGsap<HTMLElement>(
    (el) => {
      const off = reveals(el);
      const first = onceInView(
        el.querySelector('.tray')!,
        () => {
          arrived.current = true;
          stage.current?.drop();
        },
        28,
      );
      return () => {
        off?.();
        first();
      };
    },
    [site],
  );
  const count = t.groups.reduce((n, g) => n + Math.min(EACH, g.items.length), 0);

  return (
    <section id="toolbox" data-sec ref={root} className="toolbox">
      <div
        className="section"
        data-track="[[0.972,0],[0.972,0.945],[0.435,0.945],[0.435,1]]" data-track-s="[[0.004,0],[0.004,1]]"
      >
        <div className="wrap">
          <div className="tool-head">
            <Letters as="h2" text={t.title.toUpperCase()} style="wood" depth={30} bevel={2} curve={6} className="title3d long" onLetters={(l, s) => popLetters(l, s)} />
            <p className="lede" data-rv="lines">{t.intro}</p>
          </div>
          <Kitty pose="peek" coat="ginger" className="on-tray" />
          <div className="tray" ref={tray} data-cursor="Sweep" style={{ ['--n' as any]: count, touchAction: 'pan-y' }} aria-hidden />
          <div className="skills">
            {t.groups.map((g, i) => (
              <div className="skill" key={g.name} style={{ ['--c' as any]: CSS[i % CSS.length] }}>
                <h3>{g.name}</h3>
                <ul>
                  {g.items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {t.courses.length ? (
            <ul className="courses">
              {t.courses.map((c, i) => (
                <li key={i}>
                  <b>{c.name}</b>
                  <span>{c.date}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {t.photos.length ? (
            <div className="tool-photos">
              {t.photos.map((im, i) => (
                <Print key={im.src + i} img={im} rot={i % 2 ? 2 : -2} limits={[0.9, 3.4]} tape={false} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
