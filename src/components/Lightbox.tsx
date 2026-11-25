import { useEffect, useRef, useState } from 'react';
import { gsap, holdScroll, on, reduced } from '../lib/motion';

interface Item {
  type: 'yt' | 'img' | 'video';
  id?: string;
  src?: string;
  alt?: string;
  title?: string;
}

export function Lightbox() {
  const [item, setItem] = useState<Item | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => on('lightbox', (i: Item) => setItem(i)), []);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (item) {
      d.showModal();
      holdScroll(true);
      if (!reduced()) {
        gsap.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.25 });
        gsap.fromTo('.lb-frame', { scale: 0.7, rotate: -5, y: 90 }, { scale: 1, rotate: 0, y: 0, duration: 0.75, ease: 'back.out(1.4)' });
      }
    } else if (d.open) {
      d.close();
      holdScroll(false);
    }
  }, [item]);

  const close = () => setItem(null);
  return (
    <dialog
      className="lb"
      ref={dlg}
      onClose={() => {
        close();
        holdScroll(false);
      }}
      onClick={(e) => e.target === dlg.current && close()}
      aria-label={item?.title || 'Viewer'}
      data-lenis-prevent
    >
      {item && (
        <div className="lb-frame">
          {item.type === 'yt' && (
            <iframe
              className="lb-vid"
              src={`https://www.youtube-nocookie.com/embed/${item.id}?autoplay=1&rel=0`}
              title={item.title || 'Video'}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
          {item.type === 'video' && <video className="lb-vid" src={item.src} controls autoPlay playsInline />}
          {item.type === 'img' && <img className="lb-img" src={item.src} alt={item.alt} />}
          {item.title ? <p className="lb-cap note">{item.title}</p> : null}
          <button className="lb-x" type="button" onClick={close} autoFocus>
            Close
          </button>
        </div>
      )}
    </dialog>
  );
}
