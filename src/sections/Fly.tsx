import { useRef, useState } from 'react';
import { Print } from '../components/Print';
import { Sheet } from '../components/Sheet';
import { SimRun } from '../components/SimRun';
import { media, useSite, youtubeId, type Aircraft } from '../content';
import { pinProgress, useFrame, useGsap } from '../lib/hooks';
import { whileInView } from '../lib/inview';
import { emit, gsap, reduced } from '../lib/motion';
import { reveals } from '../lib/reveal';
import { Letters, useStage } from '../world/hooks';
import { damp, smooth } from '../world/kit';
import type { Letter, LetterStage } from '../world/letters';
import { bayStage, explodeStage, type BayStage, type ExplodeStage } from '../world/stages/bench';

/** Letters that take off when you reach them and then hover. */
export function hoverLetters(letters: Letter[], stage: LetterStage) {
  const st = { v: 0 };
  const calm = reduced();
  if (calm) st.v = 0.4;
  const off = whileInView(
    stage.el,
    (on) => !calm && gsap.to(st, { v: on ? 1 : 0, duration: on ? 1.8 : 0.9, ease: on ? 'power2.inOut' : 'bounce.out', overwrite: true }),
    '-5% 0px -20% 0px',
  );
  stage.drive = (t) => {
    letters.forEach((l, i) => {
      const v = st.v;
      const ph = i * 1.9;
      l.s.z = v * (92 + Math.sin(t * 1.5 + ph) * 20);
      l.s.rx = v * Math.sin(t * 1.1 + ph) * 0.1;
      l.s.ry = v * Math.cos(t * 1.3 + ph) * 0.1;
      l.s.rz = v * Math.sin(t * 0.8 + ph) * 0.03;
      l.s.x = v * Math.sin(t * 0.7 + ph) * 5;
      l.s.y = v * Math.cos(t * 0.9 + ph) * 5;
    });
  };
  return off;
}

function Bay({ a, i }: { a: Aircraft; i: number }) {
  const stage = useRef<BayStage | null>(null);
  const ref = useStage<HTMLDivElement>(
    (el) => {
      const s = bayStage(el, a.model);
      stage.current = s;
      return s;
    },
    [a.model],
  );
  const yt = youtubeId(a.video);
  const hot = (v: number) => () => {
    if (stage.current) stage.current.hot = v;
  };
  return (
    <article className="bay" onPointerEnter={hot(1)} onPointerLeave={hot(0)}>
      <div className="bay-spot" aria-hidden>
        <svg viewBox="0 0 300 300" data-rv="draw">
          <path d="M4 54V4h50M246 4h50v50M296 246v50h-50M54 296H4v-50" />
        </svg>
        <div className="bay-stage" ref={ref} />
      </div>
      {a.status ? <span className="dymo red" data-rv="dymo">{a.status}</span> : null}
      <h3>{a.name}</h3>
      <p>{a.text}</p>
      {a.images.length ? (
        <div className="bay-shots">
          {a.images.map((im, k) => (
            <Print key={k} img={im} video={k === 0 ? a.video : undefined} rot={k % 2 ? 4 : -3} ratio="4/3" />
          ))}
        </div>
      ) : yt ? (
        <button type="button" className="tlink" onClick={() => emit('lightbox', { type: 'yt', id: yt, title: a.name })}>
          Watch it fly
        </button>
      ) : null}
      {a.link ? (
        <a className="tlink" href={a.link} target="_blank" rel="noreferrer">
          More about this build
        </a>
      ) : null}
      <span hidden>{i}</span>
    </article>
  );
}

export function Fly() {
  const site = useSite();
  const f = site.fly;
  const b = f.build;
  const stage = useRef<ExplodeStage | null>(null);
  const [wire, setWire] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const prog = useRef(0);

  const stageEl = useStage<HTMLDivElement>((el) => {
    const s = explodeStage(el);
    stage.current = s;
    s.p = prog.current;
    return s;
  });

  const root = useGsap<HTMLElement>(
    (el) => {
      reveals(el);
      const pin = el.querySelector<HTMLElement>('.fly-pin')!;
      const tags = gsap.utils.toArray<HTMLElement>('.fly-part', el);
      const block = el.querySelector<HTMLElement>('.tblock')!;
      const st = pinProgress(pin, (v) => {
        prog.current = v;
        if (stage.current) stage.current.p = v;
        tags.forEach((tag, i) => {
          const at = 0.36 + (i / Math.max(1, tags.length)) * 0.2;
          const k = smooth(at, at + 0.05, v) * (1 - smooth(0.78, 0.86, v));
          tag.style.setProperty('--k', k.toFixed(3));
        });
        gsap.set(block, { opacity: smooth(0.02, 0.1, v) });
      });
      return () => st.kill();
    },
    [site],
  );

  // Labels pick the side and the slot nearest their part, then a leader line
  // is drawn from the label to wherever that part is right now.
  const slots = useRef<{ left: boolean; y: number }[]>([]);
  const settled = useRef(false);
  useFrame(sheet, (dt) => {
    const st = stage.current;
    const sv = svg.current;
    if (!st || !sv || !root.current) return;
    const box = sv.getBoundingClientRect();
    const paths = sv.querySelectorAll<SVGPathElement>('path');
    const dots = sv.querySelectorAll<SVGCircleElement>('circle');
    const tags = Array.from(root.current.querySelectorAll<HTMLElement>('.fly-part'));
    const pts = tags.map((t) => st.points[t.dataset.anchor!]);
    if (pts.some((q) => !q)) return;
    const ks = tags.map((t) => parseFloat(t.style.getPropertyValue('--k') || '0'));
    const shown = Math.max(...ks) > 0.01;

    if (!shown || !settled.current) {
      // left column is shorter, the project text sits above it
      const order = tags.map((_, i) => i).sort((m, n) => pts[m].x - pts[n].x);
      const nLeft = Math.floor(tags.length * 0.45);
      slots.current = tags.map((_, i) => ({ left: order.indexOf(i) < nLeft, y: slots.current[i]?.y ?? 0 }));
      settled.current = true;
    }
    for (const side of [true, false]) {
      const ids = tags.map((_, i) => i).filter((i) => slots.current[i].left === side);
      ids.sort((m, n) => pts[m].y - pts[n].y);
      // between the project text above and the buttons / title block below
      const slim = box.width < 700;
      const under = (q: string) => (root.current?.querySelector(q)?.getBoundingClientRect().bottom ?? box.top) - box.top;
      const over = (q: string) => (root.current?.querySelector(q)?.getBoundingClientRect().top ?? box.bottom) - box.top;
      const top = slim ? under('.fly-info') + 26 : side ? under('.fly-info') + 34 : box.height * 0.1;
      const bot = slim ? over('.fly-tools') - 30 : side ? over('.fly-tools') - 62 : over('.tblock') - 74;
      ids.forEach((i, n) => {
        const want = ids.length > 1 ? top + ((bot - top) * n) / (ids.length - 1) : (top + bot) / 2;
        const sl = slots.current[i];
        sl.y = shown ? damp(sl.y, want, 9, dt) : want;
        const tag = tags[i];
        tag.classList.toggle('lf', side);
        tag.style.transform = `translateY(${(sl.y + (1 - ks[i]) * 16).toFixed(1)}px)`;
      });
    }
    tags.forEach((tag, i) => {
      const k = ks[i];
      const path = paths[i];
      const dot = dots[i];
      if (!path || !dot) return;
      if (k < 0.01) {
        path.style.opacity = dot.style.opacity = '0';
        return;
      }
      const r = tag.getBoundingClientRect();
      const left = slots.current[i].left;
      const x0 = (left ? r.right + 9 : r.left - 9) - box.left;
      const y0 = r.top + 13 - box.top;
      const x1 = pts[i].x - box.left;
      const y1 = pts[i].y - box.top;
      const dir = left ? 1 : -1;
      const run = Math.max(14, Math.min(60, Math.abs(x1 - x0) * 0.3));
      const ex = x0 + dir * run * Math.min(1, k * 2);
      const t2 = Math.max(0, k * 2 - 1);
      path.setAttribute('d', `M${x0} ${y0}H${ex}L${ex + (x1 - ex) * t2} ${y0 + (y1 - y0) * t2}`);
      path.style.opacity = '1';
      dot.setAttribute('cx', String(x1));
      dot.setAttribute('cy', String(y1));
      dot.style.opacity = t2 > 0.95 ? '1' : '0';
    });
  });

  const spin = (v: number) => () => {
    if (stage.current) stage.current.spin = v;
  };
  const drag = useRef({ on: false, x: 0 });

  const ordered = b.parts;

  return (
    <section id="fly" data-sec ref={root} className="fly">
      <div
        className="section sec-head fly-head"
        data-track="[[0.5,0.02],[0.5,0.16],[0.94,0.16],[0.94,0.8],[0.5,0.8],[0.5,1]]" data-track-s="[[0.004,0],[0.004,0.1],[0.996,0.22],[0.996,1]]"
      >
        <div className="wrap">
          <Letters as="h2" text={f.title.toUpperCase()} style="carbon" depth={34} bevel={2.5} curve={7} className="title3d" onLetters={hoverLetters} />
          <p className="lede" data-rv="lines">{f.intro}</p>
        </div>
      </div>

      <div className="fly-pin" data-pin style={{ height: '440vh' }}>
        <div className="pin fly-stick" ref={sheet}>
          <Sheet kind="paper" tape radius={3} z={2} className="fly-sheet">
            <div
              className="fly-stage"
              ref={stageEl}
              data-cursor="Turn"
              style={{ touchAction: 'pan-y' }}
              onPointerDown={(e) => {
                drag.current = { on: true, x: e.clientX };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drag.current.on || !stage.current) return;
                const dx = e.clientX - drag.current.x;
                drag.current.x = e.clientX;
                stage.current.yaw += dx * 0.009;
                stage.current.yawVel = dx * 0.5;
              }}
              onPointerUp={() => (drag.current.on = false)}
              onPointerCancel={() => (drag.current.on = false)}
            />
            <svg className="fly-lines" ref={svg} aria-hidden>
              {ordered.map((_, i) => (
                <path key={i} />
              ))}
              {ordered.map((_, i) => (
                <circle key={i} r="4.5" />
              ))}
            </svg>
            <ul className="fly-parts">
              {ordered.map((p, i) => (
                <li className="fly-part" key={i} data-anchor={p.anchor}>
                  <b>{p.name}</b>
                  <span>{p.note}</span>
                </li>
              ))}
            </ul>
            <div className="fly-info">
              <h3>{b.name}</h3>
              <p>{b.text}</p>
              <a className="tlink ink" href={b.link.url} target="_blank" rel="noreferrer">
                {b.link.label}
              </a>
            </div>
            <div className="fly-tools">
              <button
                type="button"
                onPointerDown={spin(1)}
                onPointerUp={spin(0)}
                onPointerLeave={spin(0)}
                onKeyDown={(e) => e.key === ' ' && spin(1)()}
                onKeyUp={spin(0)}
              >
                Hold to spin up
              </button>
              <button
                type="button"
                aria-pressed={wire}
                onClick={() => {
                  stage.current?.quad.setWire(!wire);
                  setWire(!wire);
                }}
              >
                {wire ? 'Show solid' : 'Show wireframe'}
              </button>
            </div>
            <dl className="tblock">
              <div className="tb-title">
                <dt>Title</dt>
                <dd>{b.tag}</dd>
              </div>
              {b.stats.map((s, i) => (
                <div key={i}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
              <div>
                <dt>Drawn and built by</dt>
                <dd>
                  {site.person.first} {site.person.last}
                </dd>
              </div>
            </dl>
          </Sheet>
        </div>
      </div>

      <div className="section fly-extra" data-track="[[0.5,0],[0.5,0.08],[0.06,0.08],[0.06,0.92],[0.5,0.92],[0.5,1]]" data-track-s="[[0.996,0],[0.996,1]]">
        <div className="wrap fly-two">
          <div className="fly-note">
            <Print img={f.notebook.image} rot={-4} ratio="3/4" className="notebook" />
            <p className="note" data-rv="mark">{f.notebook.caption}</p>
          </div>
          <div className="sim">
            <div className="sim-head">
              <h3>{f.sim.title}</h3>
              <p>{f.sim.text}</p>
            </div>
            <div className="goggles">
              {f.sim.video && youtubeId(f.sim.video) ? (
                <button type="button" className="sim-vid" onClick={() => emit('lightbox', { type: 'yt', id: youtubeId(f.sim.video), title: f.sim.title })}>
                  <img src={f.sim.poster ? media(f.sim.poster) : `https://i.ytimg.com/vi/${youtubeId(f.sim.video)}/hqdefault.jpg`} alt="" loading="lazy" />
                  <span className="pb">
                    <svg viewBox="0 0 24 24">
                      <path d="M4 2l17 10L4 22z" fill="#0b1433" />
                    </svg>
                  </span>
                </button>
              ) : f.sim.video ? (
                <video className="sim-cv" src={media(f.sim.video)} poster={f.sim.poster ? media(f.sim.poster) : undefined} muted loop autoPlay playsInline />
              ) : (
                <SimRun label={f.sim.text} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="section fly-hangar" data-track="[[0.5,0],[0.5,0.04],[0.975,0.04],[0.975,0.96],[0.5,0.96],[0.5,1]]" data-track-s="[[0.996,0],[0.996,0.95],[0.004,1]]">
        <div className="wrap bays">
          {f.aircraft.map((a, i) => (
            <Bay key={i} a={a} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
