// A photo print lying on the mat. Drag it, throw it, click to look closer.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useGSAP } from '@gsap/react';
import sizes from 'virtual:media-sizes';
import { media, youtubeId, type Img } from '../content';
import { useLit } from '../lib/lit';
import { Draggable, dragKit, emit, gsap, isTouch, reduced } from '../lib/motion';

let top = 10;

export function Print({
  img,
  video,
  className = '',
  rot = 0,
  ratio,
  limits = [0.74, 2.1],
  style,
  drag = true,
  tape = true,
  reveal = true,
  eager,
}: {
  img: Img;
  video?: string;
  className?: string;
  rot?: number;
  /** 'a/b' to force a shape; left out, the print follows the photo */
  ratio?: string;
  /** tallest and widest shape (width / height) allowed when following the photo */
  limits?: [number, number];
  style?: CSSProperties;
  drag?: boolean;
  tape?: boolean;
  reveal?: boolean;
  eager?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  // photos added since the dev server started are measured when they load
  const [seen, setSeen] = useState<[number, number] | null>(null);
  const size = sizes[img.src] ?? seen ?? [4, 3];
  const own = +Math.min(limits[1], Math.max(limits[0], size[0] / size[1])).toFixed(3);
  const [fw, fh] = ratio ? ratio.split('/').map(Number) : [own, 1];
  const ar = fw / (fh || 1);
  useLit(ref);
  const yt = video ? youtubeId(video) : null;
  const clip = img.video ? media(img.video) : '';
  const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = vid.current;
    if (!v || reduced()) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => undefined) : v.pause()), { threshold: 0.2 });
    io.observe(v);
    return () => io.disconnect();
  }, [clip]);
  const open = () => {
    if (clip) return emit('lightbox', { type: 'video', src: clip, title: img.caption || img.alt });
    if (yt) emit('lightbox', { type: 'yt', id: yt, title: img.caption || img.alt });
    else if (video) emit('lightbox', { type: 'video', src: media(video), title: img.caption || img.alt });
    else emit('lightbox', { type: 'img', src: media(img.src), alt: img.alt, title: img.caption });
  };

  useGSAP(
    () => {
      const el = ref.current!;
      gsap.set(el, { rotate: rot });
      if (!drag || isTouch()) return;
      const spin = gsap.quickTo(el, 'rotate', { duration: 0.5, ease: 'power3.out' });
      dragKit().create(el, {
        type: 'x,y',
        inertia: true,
        allowContextMenu: true,
        dragClickables: true,
        zIndexBoost: false,
        onPress() {
          el.style.zIndex = String(++top);
          gsap.to(el, { scale: 1.05, duration: 0.25 });
        },
        onDrag(this: Draggable) {
          spin(rot + gsap.utils.clamp(-14, 14, this.deltaX * 1.4));
        },
        onRelease() {
          gsap.to(el, { scale: 1, duration: 0.4 });
          spin(rot);
        },
        onClick: open,
      });
    },
    { scope: ref, dependencies: [rot, img.src] },
  );

  const playable = !!(yt || video);
  return (
    <figure
      ref={ref}
      className={`print ${playable ? 'play' : ''} ${className}`}
      style={{ ...style, ['--ar' as string]: ar }}
      data-rv={reveal ? 'toss' : undefined}
      data-cursor={playable || clip ? 'Play' : 'Look'}
      data-nolock
      role="button"
      tabIndex={0}
      aria-label={(playable ? 'Play video: ' : 'View photo: ') + (img.caption || img.alt)}
      onClick={() => {
        if (isTouch() || !drag) open();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <span className="sh" aria-hidden />
      <span className="pp" aria-hidden />
      <div className="im" style={{ aspectRatio: ar }}>
        {clip ? (
          <video ref={vid} src={clip} poster={media(img.src)} muted loop playsInline preload="none" aria-label={img.alt} />
        ) : null}
        <img
          hidden={!!clip}
          src={media(img.src)}
          alt={img.alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          style={img.focus ? { objectPosition: `50% ${img.focus === 'top' ? '12%' : img.focus === 'bottom' ? '92%' : '50%'}` } : undefined}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (!sizes[img.src] && w && h) setSeen([w, h]);
          }}
        />
        <span className="gl" aria-hidden />
      </div>
      {img.caption ? <figcaption>{img.caption}</figcaption> : null}
      {playable ? (
        <span className="pb" aria-hidden>
          <svg viewBox="0 0 24 24">
            <path d="M4 2l17 10L4 22z" fill="#0b1433" />
          </svg>
        </span>
      ) : null}
      {tape ? <span className="tape" aria-hidden /> : null}
    </figure>
  );
}
