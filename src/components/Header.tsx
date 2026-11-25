import { useEffect, useRef, useState } from 'react';
import { useSite } from '../content';
import { batchTriggers } from '../lib/hooks';
import { gsap, holdScroll, onIntro, scrollToId, ScrollTrigger } from '../lib/motion';
import { whenWorld } from '../world/World';

/** Pull-cord switch for the ceiling light. Drag it or click it. */
function Cord() {
  const root = useRef<HTMLButtonElement>(null);
  const [on, setOn] = useState(false);
  const live = useRef(false);

  useEffect(() => {
    const el = root.current!;
    const path = el.querySelector<SVGPathElement>('path')!;
    const knob = el.querySelector<SVGGElement>('g')!;
    const REST = 74;
    const s = { x: 0, y: REST, vx: 0, vy: 0 };
    let held = false;
    let armed = false;
    let ox = 0;
    let oy = 0;
    let moved = 0;

    const toggle = () => {
      live.current = !live.current;
      setOn(live.current);
      document.documentElement.classList.toggle('lights-on', live.current);
      whenWorld((w) => gsap.to(w.room, { v: live.current ? 1 : 0, duration: live.current ? 0.9 : 0.6, ease: live.current ? 'rough({strength:1.4,points:14,clamp:true})' : 'power2.out' }));
    };

    const draw = () => {
      const bend = s.x * 0.55;
      path.setAttribute('d', `M40 -10 Q${40 + bend * 0.2} ${s.y * 0.5} ${40 + s.x} ${s.y}`);
      knob.setAttribute('transform', `translate(${40 + s.x} ${s.y}) rotate(${-s.x * 0.7})`);
    };
    draw();

    let last = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.033, last ? t - last : 0.016);
      last = t;
      if (held) return;
      s.vx += (-s.x * 120 - s.vx * 4.2) * dt;
      s.vy += ((REST - s.y) * 320 - s.vy * 12) * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.x) + Math.abs(s.y - REST) > 0.02) draw();
    };
    gsap.ticker.add(tick);

    const down = (e: PointerEvent) => {
      held = true;
      armed = true;
      moved = 0;
      ox = e.clientX - s.x;
      oy = e.clientY - s.y;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!held) {
        // brushing past makes it swing
        s.vx += e.movementX * 5;
        return;
      }
      const nx = Math.max(-30, Math.min(30, e.clientX - ox));
      const ny = Math.max(REST - 6, Math.min(REST + 58, e.clientY - oy));
      moved += Math.abs(nx - s.x) + Math.abs(ny - s.y);
      s.x = nx;
      s.y = ny;
      if (armed && ny > REST + 34) {
        armed = false;
        toggle();
      }
      draw();
    };
    const up = () => {
      if (held && moved < 5) {
        s.vy = 620;
        toggle();
      }
      held = false;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        s.vy = 620;
        toggle();
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', key);
    return () => {
      gsap.ticker.remove(tick);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('keydown', key);
    };
  }, []);

  return (
    <button ref={root} className="cord" type="button" aria-pressed={on} aria-label="Ceiling light" data-nolock data-cursor="Pull">
      <svg viewBox="0 0 80 170" aria-hidden>
        <path d="M40 -10V74" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <g>
          <path d="M-5 0h10l3 10-2 16a6 6 0 0 1-12 0l-2-16z" fill="#ffc21a" />
          <path d="M-5 0h10l1.4 5h-12.8z" fill="#ffe39a" />
        </g>
      </svg>
    </button>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 92 48" className="logo-svg" aria-hidden>
      <path className="lg-a" d="M34 8H14.5a8 8 0 0 0 0 16h11a8 8 0 0 1 0 16H6" />
      <path className="lg-b" d="M42 8l10 30a2.4 2.4 0 0 0 4.6 0L64 19l7.4 19a2.4 2.4 0 0 0 4.6 0L86 8" />
      <circle className="lg-dot" r="4.4" cx="34" cy="8" />
    </svg>
  );
}

export function Header() {
  const site = useSite();
  const root = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('top');
  const items = site.layout.filter((l) => l.visible && l.inNav);

  useEffect(() => {
    const off = onIntro(() => {
      gsap.fromTo('.hd [data-in]', { y: -26, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.8, delay: 0.5 });
    });
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    // the LED marks the section you are in
    const sts: ScrollTrigger[] = [];
    let dead = false;
    batchTriggers(() => {
      if (!dead) {
        // clear at the start and at the end, shaded in between
        sts.push(
          ScrollTrigger.create({
            start: 90,
            endTrigger: '#contact',
            end: 'top 12%',
            toggleClass: { targets: root.current, className: 'shade' },
          }),
        );
        document.querySelectorAll<HTMLElement>('[data-sec]').forEach((sec) => {
          sts.push(
            ScrollTrigger.create({
              trigger: sec,
              start: 'top 45%',
              end: 'bottom 45%',
              onToggle: (s) => s.isActive && setActive(sec.id),
            }),
          );
        });
      }
      return () => {};
    });
    return () => {
      dead = true;
      sts.forEach((s) => s.kill());
    };
  }, [site]);

  useEffect(() => {
    holdScroll(open);
    document.documentElement.classList.toggle('menu-open', open);
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('keydown', esc);
    gsap.fromTo('.menu a', { yPercent: 110, rotate: 4 }, { yPercent: 0, rotate: 0, stagger: 0.05, duration: 0.7, delay: 0.15 });
    return () => removeEventListener('keydown', esc);
  }, [open]);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    requestAnimationFrame(() => scrollToId(id));
    history.replaceState(null, '', id === 'top' ? location.pathname : '#' + id);
  };

  return (
    <>
      <header className="hd" ref={root}>
        <a href="#top" className="hd-logo" onClick={go('top')} data-in aria-label={`${site.person.first} ${site.person.last}, back to top`}>
          <Logo />
        </a>
        <nav className="hd-nav" aria-label="Sections">
          {items.map((l) => (
            <a key={l.id} href={'#' + l.id} onClick={go(l.id)} data-in className={active === l.id ? 'on' : ''} aria-current={active === l.id ? 'true' : undefined}>
              <i />
              <span data-t={l.nav}>{l.nav}</span>
            </a>
          ))}
          <a href="#contact" onClick={go('contact')} data-in className={'hd-cta ' + (active === 'contact' ? 'on' : '')}>
            <i />
            <span data-t="Say hi">Say hi</span>
          </a>
        </nav>
        <button className="hd-burger" data-in type="button" aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)}>
          <span>{open ? 'Close' : 'Menu'}</span>
          <svg viewBox="0 0 30 20" aria-hidden>
            <path d="M2 4h26" />
            <path d="M2 16h26" />
          </svg>
        </button>
      </header>
      <Cord />
      <div className={'menu ' + (open ? 'open' : '')} id="menu" aria-hidden={!open} inert={!open} data-lenis-prevent>
        <nav aria-label="Menu">
          {[{ id: 'top', nav: 'Start' }, ...items, { id: 'contact', nav: 'Say hi' }].map((l) => (
            <span className="menu-row" key={l.id}>
              <a href={'#' + l.id} onClick={go(l.id)}>
                {l.nav}
              </a>
            </span>
          ))}
        </nav>
      </div>
    </>
  );
}
