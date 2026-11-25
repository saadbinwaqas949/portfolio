import { useRef } from 'react';
import { useSite } from '../content';
import { useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';

import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import { trayStage, type TrayStage } from '../world/stages/misc';
import { popLetters } from './About';

const COLORS = [0x2f6bff, 0xffc21a, 0xe5322d, 0x1fb573, 0xff7ab8, 0x8b5cf6];
const CSS = ['#2f6bff', '#ffc21a', '#e5322d', '#1fb573', '#ff7ab8', '#8b5cf6'];

export function Toolbox() {
  const site = useSite();
  const t = site.toolbox;
  const stage = useRef<TrayStage | null>(null);
  const arrived = useRef(false);
  const tray = useStage<HTMLDivElement>(
    (el) => {
      const s = trayStage(
        el,
        t.groups.flatMap((g, i) => g.items.map((name) => ({ name, color: COLORS[i % COLORS.length] }))),
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
  const count = t.groups.reduce((n, g) => n + g.items.length, 0);

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
          <ul className="tool-legend">
            {t.groups.map((g, i) => (
              <li key={g.name} style={{ ['--c' as any]: CSS[i % CSS.length] }}>
                {g.name}
                <span className="sr">: {g.items.join(', ')}</span>
              </li>
            ))}
          </ul>
          <div className="tray" ref={tray} data-cursor="Sweep" style={{ ['--n' as any]: count, touchAction: 'pan-y' }} aria-hidden />
          <ul className="flat-skills">
            {t.groups.flatMap((g) => g.items).map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
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
        </div>
      </div>
    </section>
  );
}
