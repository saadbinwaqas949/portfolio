import { useEffect, useRef, useState, type ComponentType } from 'react';
import { normalise, site as initial, SiteContext, type Site } from './content';
import { Cursor } from './components/Cursor';
import { Header } from './components/Header';
import { Lightbox } from './components/Lightbox';
import { Loader } from './components/Loader';
import { ScrollTrigger } from './lib/motion';
import { getWorld } from './world/World';
import { About } from './sections/About';
import { Chimera } from './sections/Chimera';
import { Contact } from './sections/Contact';
import { Custom } from './sections/Custom';
import { Fight } from './sections/Fight';
import { Fly } from './sections/Fly';
import { Follow } from './sections/Follow';
import { Hero } from './sections/Hero';
import { Log } from './sections/Log';
import { Play } from './sections/Play';
import { Ship } from './sections/Ship';
import { Toolbox } from './sections/Toolbox';

const SECTIONS: Record<string, ComponentType> = {
  about: About,
  fly: Fly,
  fight: Fight,
  follow: Follow,
  play: Play,
  ship: Ship,
  chimera: Chimera,
  log: Log,
  toolbox: Toolbox,
};

const preview = import.meta.env.DEV && new URLSearchParams(location.search).has('studio');

export function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [site, setSite] = useState<Site>(initial);
  const [revs, setRevs] = useState<Record<string, number>>({});

  // whenever the page changes height, lay the mat out again
  useEffect(() => {
    let timer = 0;
    let h = 0;
    const ro = new ResizeObserver(() => {
      const nh = document.documentElement.scrollHeight;
      if (Math.abs(nh - h) < 2) return;
      h = nh;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        ScrollTrigger.refresh();
        getWorld()?.measure();
      }, 160);
    });
    ro.observe(document.body);
    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  }, []);

  // live preview: the Studio sends drafts while you type
  useEffect(() => {
    if (!preview) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      if (e.data?.type === 'studio:content') {
        // only the sections that changed are rebuilt
        const dirty: string[] = e.data.dirty ?? ['all'];
        setSite(normalise(e.data.site));
        setRevs((r) => {
          const n = { ...r };
          for (const d of dirty) n[d] = (n[d] ?? 0) + 1;
          return n;
        });
        setTimeout(() => {
          ScrollTrigger.refresh();
          getWorld()?.measure();
        }, 120);
      }
    };
    addEventListener('message', onMsg);
    import('./lib/preview').then((m) => m.startPreview());
    window.parent?.postMessage({ type: 'studio:ready' }, location.origin);
    return () => removeEventListener('message', onMsg);
  }, []);

  const rev = (id: string) => `${id}:${revs.all ?? 0}:${revs[id] ?? 0}`;
  return (
    <SiteContext.Provider value={site}>
      <a className="skip" href="#fly">
        Skip to the work
      </a>
      <div className="bench" aria-hidden>
        <canvas ref={canvas} />
      </div>
      <Header />
      <main id="main">
        <Hero key={rev('hero')} />
        {site.layout
          .filter((l) => l.visible)
          .map((l) => {
            const S = SECTIONS[l.id];
            if (S) return <S key={rev(l.id)} />;
            const c = site.custom.find((x) => x.id === l.id);
            return c ? <Custom key={rev('custom') + l.id} c={c} /> : null;
          })}
        <Contact key={rev('contact')} />
      </main>
      <Loader canvas={canvas} quick={preview} />
      <Lightbox />
      <Cursor />
    </SiteContext.Provider>
  );
}
