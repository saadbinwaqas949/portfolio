// Targeting reticle. Idles as a small crosshair, locks on to anything you can
// click, and names the action when the element asks for it.
import { useEffect, useRef } from 'react';
import { gsap, isTouch, reduced } from '../lib/motion';

const HOT = 'a, button, [role="button"], [data-lock], input, textarea, summary';

export function Cursor() {
  const root = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isTouch()) return;
    const el = root.current!;
    const dot = el.querySelector<HTMLElement>('.cu-dot')!;
    const box = el.querySelector<HTMLElement>('.cu-box')!;
    const label = tag.current!;
    document.documentElement.classList.add('has-cursor');

    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let bx = x;
    let by = y;
    let bw = 26;
    let bh = 26;
    let spin = 0;
    let target: HTMLElement | null = null;
    let seen = false;
    let down = false;
    let text = '';
    const calm = reduced();

    const look = (t: HTMLElement | null) => {
      const hit = t?.closest?.(HOT) as HTMLElement | null;
      target = hit && !hit.hasAttribute('data-nolock') ? hit : null;
      const said = (t?.closest?.('[data-cursor]') as HTMLElement | null)?.dataset.cursor ?? '';
      if (said !== text) {
        text = said;
        if (said) label.textContent = said;
        label.classList.toggle('on', !!said);
      }
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!seen) {
        seen = true;
        bx = x;
        by = y;
        el.style.opacity = '1';
      }
      look(e.target as HTMLElement);
    };
    const leave = () => {
      seen = false;
      el.style.opacity = '0';
    };
    const dn = () => (down = true);
    const up = () => (down = false);

    let last = 0;
    let lastScroll = 0;
    let checkAt = 0;
    const tick = (time: number) => {
      const dt = Math.min(0.05, last ? time - last : 0.016);
      last = time;
      if (seen && scrollY !== lastScroll && time > checkAt) {
        lastScroll = scrollY;
        checkAt = time + 0.12;
        look(document.elementFromPoint(x, y) as HTMLElement | null);
      }
      let tx = x;
      let ty = y;
      let tw = down ? 16 : 26;
      let th = tw;
      const locked = target && target.isConnected;
      if (locked) {
        const r = target!.getBoundingClientRect();
        if (r.width < 520 && r.height < 320 && r.width > 0) {
          const pad = down ? 3 : 7;
          tx = r.left + r.width / 2 + (x - (r.left + r.width / 2)) * 0.08;
          ty = r.top + r.height / 2 + (y - (r.top + r.height / 2)) * 0.08;
          tw = r.width + pad * 2;
          th = r.height + pad * 2;
        } else {
          tw = th = down ? 40 : 54;
        }
      }
      const k = calm ? 1 : 1 - Math.exp(-dt * (locked ? 20 : 26));
      bx += (tx - bx) * k;
      by += (ty - by) * k;
      bw += (tw - bw) * k;
      bh += (th - bh) * k;
      const want = locked ? 0 : 45;
      spin += (want - spin) * k;
      dot.style.transform = `translate3d(${x}px,${y}px,0) scale(${locked ? 0.6 : 1})`;
      box.style.transform = `translate3d(${bx}px,${by}px,0) translate(-50%,-50%) rotate(${spin}deg)`;
      box.style.width = `${bw}px`;
      box.style.height = `${bh}px`;
      box.classList.toggle('locked', !!locked);
      label.style.transform = `translate3d(${x + 22}px,${y + 20}px,0)`;
    };
    addEventListener('pointermove', move, { passive: true });
    addEventListener('pointerdown', dn, { passive: true });
    addEventListener('pointerup', up, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    gsap.ticker.add(tick);
    return () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerdown', dn);
      removeEventListener('pointerup', up);
      document.documentElement.removeEventListener('pointerleave', leave);
      gsap.ticker.remove(tick);
      document.documentElement.classList.remove('has-cursor');
    };
  }, []);

  return (
    <div className="cursor" ref={root} aria-hidden>
      <div className="cu-box">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="cu-dot" />
      <span className="cu-tag" ref={tag} />
    </div>
  );
}
