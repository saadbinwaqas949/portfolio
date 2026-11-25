// The end is the start again: same bench, same pad. The drone comes home, the
// letters slide back together, the goggles come off.
import { useRef, useState } from 'react';
import { Cat } from '../components/Cat';
import { Icon } from '../components/Icon';
import { Portrait, type PortraitApi } from '../components/Portrait';
import { useSite } from '../content';
import { pinProgress, useGsap } from '../lib/hooks';
import { emit, gsap, isTouch, reduced, scrollToId } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import { smooth } from '../world/kit';
import type { Letter, LetterStage } from '../world/letters';
import { emWidth } from '../world/letters';
import { getWorld } from '../world/World';
import { padStage, type PadStage } from '../world/stages/pad';

export function Contact() {
  const site = useSite();
  const { contact, person } = site;
  const p = useRef(0);
  const pad = useRef<PadStage | null>(null);
  const portrait = useRef<PortraitApi>(null);
  const [copied, setCopied] = useState(false);

  const padEl = useStage<HTMLDivElement>((el) => {
    const s = padStage(el, 'land');
    s.exit = { x: -10, y: 8 };
    s.p = 1;
    pad.current = s;
    return s;
  });

  const root = useGsap<HTMLElement>(
    (el) => {
      reveals(el);
      const copy = el.querySelector<HTMLElement>('.ct-copy')!;
      const st = pinProgress(el.querySelector<HTMLElement>('.ct-pin')!, (v) => {
        p.current = v;
        const w = getWorld();
        if (w) w.track.bonus = smooth(0.3, 0.95, v);
        const home = 1 - smooth(0.02, 0.8, v);
        if (pad.current) pad.current.p = home;
        portrait.current?.goggles(1 - smooth(0.8, 0.9, v));
        portrait.current?.wind(smooth(0.3, 0.5, v) * (1 - smooth(0.7, 0.8, v)));
        const inn = smooth(0.3, 0.62, v);
        gsap.set(copy, { x: -(1 - inn) * innerWidth * 0.5, rotate: -(1 - inn) * 7, opacity: inn });
      });
      return () => st.kill();
    },
    [site],
  );

  const wire = (letters: Letter[], stage: LetterStage) => {
    const calm = reduced();
    const seeds = letters.map((l) => ({ a: Math.sin(l.i * 12.9 + 2), b: Math.cos(l.i * 7.3 + 1) }));
    stage.drive = (t) => {
      const v = p.current;
      letters.forEach((l, i) => {
        const s = l.s;
        const at = 0.06 + i * 0.035;
        const f = calm ? 0 : 1 - smooth(at, at + 0.36, v);
        s.k = calm ? 1 : smooth(0.0, 0.05, v);
        s.x = seeds[i].a * f * 1300;
        s.y = (seeds[i].b * 700 + 500) * f;
        s.z = Math.sin(f * Math.PI) * 260 + f * 120;
        s.rx = seeds[i].a * f * 2.4;
        s.ry = seeds[i].b * f * 2;
        s.rz = seeds[i].a * f * 3.2;
        const chat = (pad.current?.wash ?? 0) * (1 - f);
        s.rz += Math.sin(t * 47 + i * 2) * 0.01 * chat;
        s.z += Math.abs(Math.sin(t * 39 + i)) * 3 * chat;
      });
    };
  };

  const copyMail = async () => {
    try {
      await navigator.clipboard.writeText(person.email);
      setCopied(true);
      emit('smile', true);
      setTimeout(() => {
        setCopied(false);
        emit('smile', false);
      }, 2400);
    } catch {
      location.href = 'mailto:' + person.email;
    }
  };

  const title = contact.title.toUpperCase();
  return (
    <footer id="contact" data-sec ref={root} className="contact">
      <div className="ct-pin" data-pin style={{ height: '230vh' }}>
        <div className="pin hero ct">
          <div className="hero-names" style={{ ['--em' as any]: emWidth(title) }}>
            <Letters as="h2" text={title} style="kraft" depth={56} shy={0.8} className="hero-first ct-first" onLetters={wire} />
          </div>
          <div className="hero-figure">
            <Portrait api={portrait} start="up" />
          </div>
          <div className="hero-copy ct-copy">
            <p className="hero-line">{contact.text}</p>
            <div className="ct-act">
              {person.email ? (
                <button type="button" className="plug" onClick={copyMail} onPointerEnter={() => emit('smile', true)} onPointerLeave={() => !copied && emit('smile', false)}>
                  {copied ? contact.copied : contact.button}
                </button>
              ) : null}
              {person.email ? (
                <a className="tlink" href={'mailto:' + person.email}>
                  {person.email}
                </a>
              ) : null}
              {person.phone ? (
                <a className="tlink" href={'tel:' + person.phone.replace(/\s+/g, '')}>
                  {person.phone}
                </a>
              ) : null}
            </div>
            <ul className="ct-links">
              {person.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    <Icon name={l.icon ?? ''} />
                    <span>{l.label}</span>
                  </a>
                </li>
              ))}
              {person.resume ? (
                <li>
                  <a href={person.resume} target="_blank" rel="noreferrer">
                    <Icon name="file" />
                    <span>CV</span>
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
          <div className="hero-pad" ref={padEl} />
          <Cat />
          <div className="ct-foot">
            <span>{contact.footer}</span>
            <button type="button" className="tlink" onClick={() => scrollToId('top')}>
              Fly again
            </button>
          </div>
          <div className="hero-track" data-track="[[0.435,0],[0.435,0.87]]" data-track-s="[[0.004,0],[0.004,0.8]]" aria-hidden />
        </div>
      </div>
    </footer>
  );
}
