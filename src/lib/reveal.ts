// Entrances. Each material arrives its own way: tape feeds out of the label
// maker, prints get tossed on the mat, marker is written, text rises in lines.
import { onceInView } from './inview';
import { gsap, reduced, SplitText } from './motion';

export function reveals(root: HTMLElement) {
  if (reduced()) return;
  const offs: (() => void)[] = [];
  const each = (sel: string, f: (el: HTMLElement, i: number) => void) =>
    root.querySelectorAll<HTMLElement>(sel).forEach(f);
  const play = (el: Element, tw: gsap.core.Animation, bottom = 14) => {
    offs.push(onceInView(el, () => tw.play(), bottom));
  };

  each('[data-rv="lines"]', (el) => {
    let shown = false;
    let tw: gsap.core.Tween | null = null;
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (s) => {
        // after a re-split (fonts, resize) there is nothing left to animate
        if (shown) return;
        tw = gsap.from(s.lines, {
          yPercent: 108,
          rotate: 2.5,
          transformOrigin: '0% 100%',
          duration: 0.95,
          stagger: 0.075,
          ease: 'power4.out',
          paused: true,
        });
        return tw;
      },
    });
    offs.push(
      onceInView(el, () => {
        shown = true;
        tw?.play();
      }),
    );
  });

  each('[data-rv="dymo"]', (el, i) => {
    const n = Math.max(4, (el.textContent ?? '').length);
    play(
      el,
      gsap.fromTo(
        el,
        { clipPath: 'inset(-10% 100% -10% 0%)' },
        { clipPath: 'inset(-10% 0% -10% 0%)', duration: n * 0.032, ease: `steps(${n})`, delay: (i % 5) * 0.05, clearProps: 'clipPath', paused: true },
      ),
      10,
    );
  });

  each('[data-rv="mark"]', (el) => {
    play(
      el,
      gsap.fromTo(
        el,
        { clipPath: 'inset(-30% 100% -30% -4%)' },
        { clipPath: 'inset(-30% -6% -30% -4%)', duration: 0.9, ease: 'power2.inOut', clearProps: 'clipPath', paused: true },
      ),
    );
  });

  each('[data-rv="toss"]', (el, i) => {
    const dir = i % 2 ? 1 : -1;
    const d = (i % 4) * 0.08;
    const tl = gsap.timeline({ paused: true });
    tl.from(el, { scale: 1.5, opacity: 0, rotate: `+=${dir * 16}`, x: dir * 90, y: -70, duration: 0.75, ease: 'power3.out' }, d);
    const tape = el.querySelector('.tape');
    if (tape) tl.from(tape, { scaleY: 0, opacity: 0, rotate: -14, duration: 0.45, ease: 'back.out(2)' }, d + 0.5);
    tl.add(() => el.classList.add('seen'), d + 0.15);
    play(el, tl, 8);
  });

  each('[data-rv="draw"]', (el) => {
    play(
      el,
      gsap.from(el.querySelectorAll('path, line, circle, rect, polyline, ellipse'), {
        drawSVG: '0%',
        duration: 1.2,
        stagger: 0.04,
        ease: 'power2.inOut',
        paused: true,
      }),
    );
  });

  return () => offs.forEach((f) => f());
}

/** Words light up one after another as a paragraph crosses the screen. */
export function scrubWords(el: HTMLElement) {
  if (reduced()) return;
  SplitText.create(el, {
    type: 'words',
    autoSplit: true,
    onSplit: (s) =>
      gsap.fromTo(
        s.words,
        { opacity: 0.16 },
        {
          opacity: 1,
          stagger: 0.1,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 46%', scrub: 0.4 },
        },
      ),
  });
}
