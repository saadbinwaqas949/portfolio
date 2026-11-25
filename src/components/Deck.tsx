// A video receiver. Pick a channel and it tunes in through static, like finding
// your quad on the goggles. Clips are short; it moves on by itself.
import { useCallback, useEffect, useRef, useState } from 'react';
import { media, type Img } from '../content';
import { gsap, reduced } from '../lib/motion';

const RACEBAND = [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917];

export function Deck({ clips, skin = 'fpv', label }: { clips: Img[]; skin?: 'fpv' | 'sim'; label: string }) {
  const [i, setI] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const noise = useRef<HTMLCanvasElement>(null);
  const bar = useRef<HTMLElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const live = useRef(false);
  const clip = clips[i] ?? clips[0];

  /** a burst of analogue snow */
  const hiss = useCallback((frames: number) => {
    const cv = noise.current;
    if (!cv || reduced()) return;
    const c = cv.getContext('2d')!;
    const d = c.createImageData(cv.width, cv.height);
    let n = frames;
    cv.style.opacity = '1';
    const run = () => {
      const roll = Math.random() * cv.height;
      for (let y = 0; y < cv.height; y++) {
        const band = Math.abs(y - roll) < 7 ? 120 : 0;
        for (let x = 0; x < cv.width; x++) {
          const k = (y * cv.width + x) * 4;
          const v = Math.random() * 150 + band;
          d.data[k] = v * 0.86;
          d.data[k + 1] = v * 0.95;
          d.data[k + 2] = v + 22;
          d.data[k + 3] = 255;
        }
      }
      c.putImageData(d, 0, 0);
      cv.style.opacity = String(Math.min(1, n / (frames * 0.55)));
      if (n-- > 0) requestAnimationFrame(run);
      else cv.style.opacity = '0';
    };
    run();
  }, []);

  const go = useCallback(
    (n: number) => {
      hiss(22);
      setI(((n % clips.length) + clips.length) % clips.length);
    },
    [clips.length, hiss],
  );

  useEffect(() => {
    const v = video.current!;
    v.load();
    if (live.current && !reduced()) v.play().catch(() => undefined);
    const ol = list.current;
    const li = ol?.children[i] as HTMLElement | undefined;
    if (ol && li) ol.scrollTo({ top: li.offsetTop - ol.clientHeight / 2 + li.clientHeight / 2, left: li.offsetLeft - ol.clientWidth / 2 + li.clientWidth / 2, behavior: reduced() ? 'auto' : 'smooth' });
  }, [i]);

  useEffect(() => {
    const el = root.current!;
    const v = video.current!;
    const io = new IntersectionObserver(
      ([e]) => {
        live.current = e.isIntersecting;
        if (reduced()) return;
        if (e.isIntersecting) {
          hiss(26);
          v.play().catch(() => undefined);
        } else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    const tick = () => {
      if (live.current && bar.current && v.duration) bar.current.style.transform = `scaleX(${(v.currentTime / v.duration).toFixed(3)})`;
    };
    gsap.ticker.add(tick);
    return () => {
      io.disconnect();
      gsap.ticker.remove(tick);
    };
  }, [hiss]);

  if (!clip) return null;
  const ch = skin === 'fpv' ? `R${i + 1} ${RACEBAND[i % 8]}` : `Cut ${i + 1}`;
  return (
    <div className={'deck deck-' + skin} ref={root}>
      <div className="dk-screen" data-cursor="Next" onClick={() => go(i + 1)}>
        <video ref={video} src={media(clip.video || '')} poster={media(clip.src)} muted playsInline preload="none" onEnded={() => go(i + 1)} aria-label={clip.alt} />
        <canvas ref={noise} width={160} height={100} aria-hidden />
        <div className="dk-osd" aria-hidden>
          <b>{ch}</b>
          <span>{clip.caption}</span>
        </div>
        <i className="dk-bar" ref={bar as any} aria-hidden />
      </div>
      <div className="dk-side">
        <button type="button" className="dk-knob" aria-label="Next channel" data-cursor="Tune" onClick={() => go(i + 1)} style={{ ['--turn' as any]: `${(i / clips.length) * 300 - 150}deg` }}>
          <svg viewBox="0 0 120 120" aria-hidden>
            {clips.map((_, k) => {
              const a = ((k / clips.length) * 300 - 150 - 90) * (Math.PI / 180);
              return <line key={k} className={k === i ? 'on' : ''} x1={60 + Math.cos(a) * 49} y1={60 + Math.sin(a) * 49} x2={60 + Math.cos(a) * 57} y2={60 + Math.sin(a) * 57} />;
            })}
            <g className="dk-dial">
              <circle cx="60" cy="60" r="40" />
              <circle cx="60" cy="60" r="31" className="t" />
              {Array.from({ length: 24 }, (_, k) => {
                const a = (k / 24) * Math.PI * 2;
                return <line key={k} className="t" x1={60 + Math.cos(a) * 33} y1={60 + Math.sin(a) * 33} x2={60 + Math.cos(a) * 39} y2={60 + Math.sin(a) * 39} />;
              })}
              <line className="on" x1="60" y1="24" x2="60" y2="40" />
            </g>
          </svg>
        </button>
        <ol className="dk-list" ref={list} aria-label={label}>
          {clips.map((c, k) => (
            <li key={c.src + k}>
              <button type="button" aria-pressed={k === i} onClick={() => go(k)}>
                <img src={media(c.src)} alt="" loading="lazy" />
                <b>{skin === 'fpv' ? 'R' + (k + 1) : k + 1}</b>
                <span>{c.caption}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
