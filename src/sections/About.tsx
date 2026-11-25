// A long board is fed across the bench: cardboard on one half, carbon fibre on
// the other, finger-jointed in the middle.
import { useRef } from 'react';
import * as THREE from 'three';
import { Print } from '../components/Print';
import { Sheet } from '../components/Sheet';
import { useSite } from '../content';
import { pinProgress, useGsap } from '../lib/hooks';
import { onceInView } from '../lib/inview';
import { gsap, reduced, scrollToId } from '../lib/motion';
import { reveals, scrubWords } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import { damp, smooth } from '../world/kit';
import { makeQuad } from '../world/models/quad';
import { makeMedal } from '../world/models/robots';
import type { Letter, LetterStage } from '../world/letters';

/** Letters that hop up one by one when they come on screen. */
export function popLetters(letters: Letter[], stage: LetterStage, below = 12, opts: { z?: number; stagger?: number } = {}) {
  if (reduced()) return;
  letters.forEach((l) => {
    l.s.k = 0;
    l.s.z = opts.z ?? 420;
  });
  return onceInView(
    stage.el,
    () =>
      letters.forEach((l, i) => {
        const a = Math.sin(i * 5.7) * 0.7;
        gsap
          .timeline({ delay: i * (opts.stagger ?? 0.06) })
          .set(l.s, { k: 1, rz: a, rx: a * 0.7, ry: -a * 0.6 })
          .to(l.s, { z: 0, rz: 0, rx: 0, ry: 0, duration: 0.45, ease: 'power3.in' })
          .to(l.s, { z: 20, duration: 0.12, ease: 'power2.out' })
          .to(l.s, { z: 0, duration: 0.14, ease: 'power2.in' });
      }),
    below,
  );
}

export function About() {
  const site = useSite();
  const a = site.about;
  const p = useRef(0);

  const quadEl = useStage<HTMLDivElement>((el) => {
    const q = makeQuad();
    const g = new THREE.Group();
    g.add(q.group);
    let spin = 0;
    return {
      el,
      group: g,
      w: 0,
      h: 0,
      visible: false,
      margin: 200,
      resize() {
        q.group.scale.setScalar((Math.min(this.w, this.h) / 100 / 289) * 0.98);
      },
      update({ t, dt, world }) {
        spin = damp(spin, 0.35 + smooth(0.55, 1, p.current) * 0.65, 2, dt);
        q.setRpm(spin);
        q.update(dt);
        q.group.position.z = 0.7 + Math.sin(t * 1.6) * 0.12;
        q.body.rotation.x = Math.sin(t * 1.1) * 0.07 - world.pointer.y * 0.02;
        q.body.rotation.y = Math.cos(t * 1.3) * 0.07 + world.pointer.x * 0.02;
        q.body.rotation.z = -0.5 + Math.sin(t * 0.4) * 0.14;
      },
    };
  });

  const medalEl = useStage<HTMLDivElement>((el) => {
    const m = makeMedal('1');
    const g = new THREE.Group();
    g.add(m);
    let spin = 0;
    let vel = 0;
    let last = 0;
    return {
      el,
      group: g,
      w: 0,
      h: 0,
      visible: false,
      resize() {
        m.scale.setScalar((this.w / 100 / 110) * 0.98);
      },
      update({ t, dt, world, cx, cy }) {
        const d = Math.hypot(world.pointer.x - cx, world.pointer.y - cy);
        if (d < 1.6 && !world.touch) vel += (world.pointer.x - last) * 3;
        last = world.pointer.x;
        vel += -spin * 4 * dt - vel * 1.1 * dt;
        spin += vel * dt;
        m.rotation.set(-0.25 + Math.sin(t * 0.9) * 0.08, spin + Math.sin(t * 0.7) * 0.35, Math.sin(t * 0.8) * 0.06);
        m.position.set(0, -0.35, 1.1);
      },
    };
  });

  const root = useGsap<HTMLElement>(
    (el) => {
      const track = el.querySelector<HTMLElement>('.ab-track')!;
      const from = el.querySelector<HTMLElement>('.ab-from');
      const st = pinProgress(el.querySelector<HTMLElement>('.ab-pin')!, (v) => {
        p.current = v;
        // dwell on each half, slide in the middle
        const f = smooth(0.2, 0.8, v);
        gsap.set(track, { x: -f * innerWidth });
        if (from) gsap.set(from, { rotate: -4 + f * 10 });
      });
      reveals(el);
      const s = el.querySelector<HTMLElement>('.ab-statement p');
      if (s) scrubWords(s);

      // discipline list: the lamp picks the row
      const rows = gsap.utils.toArray<HTMLElement>('.ab-list li', el); // not the links: those have CSS transitions
      rows.forEach((r, i) => {
        if (reduced()) return;
        const tw = gsap.from(r, { xPercent: i % 2 ? 12 : -12, opacity: 0, duration: 0.9, paused: true });
        onceInView(r, () => tw.play(), 8);
      });
      return () => st.kill();
    },
    [site],
  );

  return (
    <section id="about" data-sec ref={root} className="about">
      <h2 className="sr">{a.title}</h2>
      <div className="ab-pin" data-pin style={{ height: '260vh' }}>
        <div className="pin">
          <div className="ab-track">
            <div className="ab-panel">
              <Sheet kind="kraft" fingers="right" className="ab-sheet ab-sheet-l">
                <div className="ab-in">
                  <div className="ab-text">
                    <span className="dymo" data-rv="dymo">{a.left.label}</span>
                    <Letters text={a.left.title} style="card" depth={34} lift={17} decorative className="ab-word" onLetters={(l, s) => popLetters(l, s, 24)} />
                    <p className="ab-body" data-rv="lines">{a.left.text}</p>
                  </div>
                  <div className="ab-media">
                    {a.left.image?.src ? <Print img={a.left.image} rot={3.5} ratio="4/3" /> : null}
                    <span className="note ab-from" aria-hidden>
                      from this
                    </span>
                  </div>
                </div>
              </Sheet>
            </div>
            <div className="ab-panel">
              <Sheet kind="carbon" fingers="left" className="ab-sheet ab-sheet-r">
                <div className="ab-in">
                  <div className="ab-media ab-quad" ref={quadEl} />
                  <div className="ab-text">
                    <span className="dymo yellow">{a.right.label}</span>
                    <Letters text={a.right.title} style="metal" depth={24} bevel={2} curve={6} lift={12} decorative className="ab-word" />
                    <p className="ab-body">{a.right.text}</p>
                  </div>
                </div>
              </Sheet>
            </div>
          </div>
        </div>
      </div>

      <div className="ab-after wrap" data-track="[[0.5,-0.02],[0.5,0.1],[0.045,0.1],[0.045,0.86],[0.5,0.86],[0.5,1]]" data-track-s="[[0.5,0],[0.004,0.06],[0.004,1]]">
        <div className="ab-statement">
          <div className="ab-medal" ref={medalEl} aria-hidden />
          <p>{a.statement}</p>
        </div>
        <ul className="ab-list">
          {a.disciplines.map((d, i) => (
            <li key={i}>
              <a
                href={'#' + d.link}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToId(d.link);
                }}
              >
                <b>{d.name}</b>
                <span>{d.text}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
