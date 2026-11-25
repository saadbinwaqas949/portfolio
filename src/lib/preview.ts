// Runs only inside the Studio's preview frame: scroll to the section being
// edited, outline what is under the cursor, and report what was clicked.
import { scrollToId } from './motion';

const TARGET = 'p,h1,h2,h3,h4,li,figcaption,.dymo,a,button,dd,dt,b,figure,.l3d,.addr-before,.addr-after';

export function startPreview() {
  let edit = true;
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;z-index:400;pointer-events:none;border:3px solid #ffc21a;border-radius:6px;display:none;box-shadow:0 0 0 2px rgba(8,16,60,.7)';
  document.body.appendChild(box);

  const read = (el: HTMLElement) => {
    const l3 = el.closest<HTMLElement>('.l3d');
    if (l3) return Array.from(l3.querySelectorAll<HTMLElement>('.l3d-w')).map((w) => Array.from(w.querySelectorAll<HTMLElement>('[data-ch]')).map((c) => c.dataset.ch).join('')).join(' ');
    return (el.innerText || el.textContent || '').trim();
  };
  const find = (x: number, y: number) => {
    for (const e of document.elementsFromPoint(x, y) as HTMLElement[]) {
      if (e === box || e.closest('.hd, .cord, .cursor, .loader')) continue;
      const t = e.closest<HTMLElement>(TARGET);
      if (t && t.closest('[data-sec]')) return t;
    }
    return null;
  };

  addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.data?.type === 'studio:goto') scrollToId(e.data.id);
    if (e.data?.type === 'studio:mode') {
      edit = !!e.data.edit;
      if (!edit) box.style.display = 'none';
    }
  });

  addEventListener(
    'pointermove',
    (e) => {
      if (!edit) return;
      const t = find(e.clientX, e.clientY);
      if (!t) {
        box.style.display = 'none';
        return;
      }
      const r = t.getBoundingClientRect();
      box.style.display = 'block';
      box.style.left = r.left - 5 + 'px';
      box.style.top = r.top - 5 + 'px';
      box.style.width = r.width + 10 + 'px';
      box.style.height = r.height + 10 + 'px';
    },
    { passive: true },
  );
  addEventListener('scroll', () => (box.style.display = 'none'), { passive: true });

  // photos are draggable and open on release, so while editing they never see the press
  for (const type of ['pointerdown', 'mousedown', 'touchstart'])
    addEventListener(
      type,
      (e) => {
        if (edit && (e.target as HTMLElement).closest?.('.print')) e.stopImmediatePropagation();
      },
      true,
    );

  addEventListener(
    'click',
    (e) => {
      if (!edit) return;
      const t = find(e.clientX, e.clientY);
      if (!t) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const img = t.matches('figure') ? t.querySelector('img') : null;
      parent.postMessage(
        {
          type: 'studio:pick',
          text: read(t),
          src: img?.getAttribute('src') ?? undefined,
          sec: t.closest<HTMLElement>('[data-sec]')?.id ?? '',
        },
        location.origin,
      );
    },
    true,
  );
}
