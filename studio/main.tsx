import '@fontsource/dela-gothic-one/latin-400.css';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import './studio.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { LayoutItem, Site } from '../src/content';
import { api, clone, flatten, getAt, setAt, type GitState, type MediaItem, type State } from './api';
import { Fields, Picker, Studio, type Ctx } from './fields';
import { dirtyFor, PANELS, QUICK } from './schema';

const DRAFT = 'portfolio-studio-draft';
const BUILTIN = ['about', 'fly', 'fight', 'follow', 'play', 'ship', 'chimera', 'log', 'toolbox'];
const DEVICES = { desktop: 0, tablet: 820, phone: 390 } as const;

/** Keep the page order in step with the list of extra sections. */
function syncLayout(s: Site): Site {
  let n = 1;
  const taken = new Set([...BUILTIN, ...s.custom.map((c) => c.id).filter(Boolean)]);
  const custom = s.custom.map((c) => {
    if (c.id) return c;
    let id = 'section-' + n;
    while (taken.has(id)) id = 'section-' + ++n;
    taken.add(id);
    return { ...c, id };
  });
  const ids = new Set(custom.map((c) => c.id));
  let layout = s.layout.filter((l) => BUILTIN.includes(l.id) || ids.has(l.id));
  for (const c of custom) {
    const at = layout.findIndex((l) => l.id === c.id);
    if (at < 0) {
      const before = layout.findIndex((l) => l.id === 'log');
      const item: LayoutItem = { id: c.id, nav: c.title || 'New', visible: true, inNav: false };
      layout = before < 0 ? [...layout, item] : [...layout.slice(0, before), item, ...layout.slice(before)];
    }
  }
  return { ...s, custom, layout };
}

function Order({ site, set }: { site: Site; set(path: string, v: unknown): void }) {
  const from = useRef(-1);
  const [over, setOver] = useState(-1);
  const list = site.layout;
  const move = (a: number, b: number) => {
    if (b < 0 || b >= list.length) return;
    const n = [...list];
    const [x] = n.splice(a, 1);
    n.splice(b, 0, x);
    set('layout', n);
  };
  const name = (id: string) => PANELS.find((p) => p.id === id)?.name ?? site.custom.find((c) => c.id === id)?.title ?? id;
  return (
    <div className="f">
      <p className="f-h">Drag to change the order of the page. Start and Contact always stay at the two ends.</p>
      <ul className="items order">
        {list.map((l, i) => (
          <li
            key={l.id}
            className={'item ' + (over === i ? 'over' : '') + (l.visible ? '' : ' off')}
            onDragOver={(e) => {
              if (from.current < 0) return;
              e.preventDefault();
              setOver(i);
            }}
            onDrop={(e) => {
              if (from.current < 0) return;
              e.preventDefault();
              move(from.current, i);
              from.current = -1;
              setOver(-1);
            }}
          >
            <div className="item-h">
              <span className="grip" draggable onDragStart={() => (from.current = i)} onDragEnd={() => ((from.current = -1), setOver(-1))} aria-hidden>
                ⠿
              </span>
              <b className="order-n">{name(l.id) || 'New section'}</b>
              <input value={l.nav} aria-label="Menu name" onChange={(e) => set(`layout.${i}.nav`, e.target.value)} />
              <label className="tog small">
                <input type="checkbox" checked={l.inNav} onChange={(e) => set(`layout.${i}.inNav`, e.target.checked)} />
                <i />
                <span>In menu</span>
              </label>
              <label className="tog small">
                <input type="checkbox" checked={l.visible} onChange={(e) => set(`layout.${i}.visible`, e.target.checked)} />
                <i />
                <span>Show</span>
              </label>
              <button type="button" className="ic" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
                ↑
              </button>
              <button type="button" className="ic" aria-label="Move down" disabled={i === list.length - 1} onClick={() => move(i, i + 1)}>
                ↓
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function App() {
  const [state, setState] = useState<State | null>(null);
  const [err, setErr] = useState('');
  const [site, setSite] = useState<Site | null>(null);
  const [saved, setSaved] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [git, setGit] = useState<GitState | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [panel, setPanel] = useState('start');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; bad?: boolean; k: number } | null>(null);
  const [picker, setPicker] = useState<{ dir: string; kind: 'image' | 'video' | 'doc'; many?: boolean; done(s: string[]): void } | null>(null);
  const [menu, setMenu] = useState(false);
  const [device, setDevice] = useState<keyof typeof DEVICES>('desktop');
  const [editMode, setEditMode] = useState(true);
  const [pub, setPub] = useState<{ open: boolean; busy: boolean; log: string; ok?: boolean; msg: string }>({ open: false, busy: false, log: '', msg: '' });
  const [hist, setHist] = useState(false);
  const past = useRef<Site[]>([]);
  const future = useRef<Site[]>([]);
  const lastEdit = useRef({ path: '', at: 0 });
  const frame = useRef<HTMLIFrameElement>(null);
  const dirty = useRef<Set<string>>(new Set());
  const timer = useRef(0);
  const siteRef = useRef<Site | null>(null);
  siteRef.current = site;
  const form = useRef<HTMLDivElement>(null);

  const say = useCallback((msg: string, bad?: boolean) => setToast({ msg, bad, k: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.bad ? 6000 : 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    api
      .state()
      .then((s) => {
        setState(s);
        setMedia(s.media);
        setGit(s.git);
        setHistory(s.history);
        setSaved(JSON.stringify(s.site));
        let start = s.site;
        try {
          const d = localStorage.getItem(DRAFT);
          if (d && d !== JSON.stringify(s.site)) {
            start = JSON.parse(d);
            say('Picked up your unsaved draft.');
          }
        } catch {
          /* no draft */
        }
        setSite(start);
      })
      .catch((e) => setErr((e as Error).message));
  }, [say]);

  const unsaved = !!site && JSON.stringify(site) !== saved;

  // ---- preview ----------------------------------------------------------
  const post = useCallback((msg: unknown) => frame.current?.contentWindow?.postMessage(msg, location.origin), []);
  const push = useCallback(
    (wait = 320) => {
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        post({ type: 'studio:content', site: siteRef.current, dirty: [...dirty.current] });
        dirty.current.clear();
      }, wait);
    },
    [post],
  );

  const write = useCallback(
    (next: Site, path: string) => {
      const prev = siteRef.current!;
      const now = Date.now();
      if (!(lastEdit.current.path === path && now - lastEdit.current.at < 1200)) {
        past.current.push(prev);
        if (past.current.length > 120) past.current.shift();
      }
      lastEdit.current = { path, at: now };
      future.current = [];
      const s = path.startsWith('custom') ? syncLayout(next) : next;
      dirtyFor(path).forEach((d) => dirty.current.add(d));
      setSite(s);
      siteRef.current = s;
      try {
        localStorage.setItem(DRAFT, JSON.stringify(s));
      } catch {
        /* storage full: the draft just will not survive a crash */
      }
      push();
    },
    [push],
  );
  const set = useCallback((path: string, value: unknown) => write(setAt(siteRef.current!, path, value), path), [write]);

  const jump = (dir: -1 | 1) => {
    const a = dir < 0 ? past.current : future.current;
    const b = dir < 0 ? future.current : past.current;
    const s = a.pop();
    if (!s) return;
    b.push(siteRef.current!);
    setSite(s);
    siteRef.current = s;
    lastEdit.current = { path: '', at: 0 };
    dirty.current.add('all');
    push(60);
  };

  const save = useCallback(async () => {
    if (!siteRef.current) return false;
    try {
      const r = await api.save(siteRef.current);
      setSaved(JSON.stringify(siteRef.current));
      setHistory(r.history);
      setGit(r.git);
      localStorage.removeItem(DRAFT);
      say('Saved on this computer.');
      return true;
    } catch (e) {
      say((e as Error).message, true);
      return false;
    }
  }, [say]);

  const publish = async () => {
    setPub((p) => ({ ...p, busy: true, log: 'Saving and uploading to GitHub. This can take a minute.' }));
    if (unsaved && !(await save())) return setPub((p) => ({ ...p, busy: false, log: 'Could not save, so nothing was published.' }));
    try {
      const r = await api.publish(pub.msg);
      if (r.git) setGit(r.git);
      setPub((p) => ({ ...p, busy: false, ok: r.ok, log: r.log }));
      if (r.ok) say('Published to GitHub.');
    } catch (e) {
      setPub((p) => ({ ...p, busy: false, ok: false, log: (e as Error).message }));
    }
  };

  // ---- keys ----------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if (mod && !typing && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        jump(e.shiftKey ? 1 : -1);
      }
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (siteRef.current && JSON.stringify(siteRef.current) !== saved) e.preventDefault();
    };
    addEventListener('keydown', onKey);
    addEventListener('beforeunload', leave);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('beforeunload', leave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, saved]);

  // ---- click to edit ----------------------------------------------------------
  const focusPath = useCallback((path: string) => {
    const ids = PANELS.find((p) => {
      const hit = (fields: any[], base: string): boolean =>
        fields.some((f) => {
          const at = base ? `${base}.${f.key}` : f.key;
          if (path === at || path.startsWith(at + '.')) return true;
          return false;
        });
      return hit(p.fields, '');
    });
    if (!ids) return false;
    setPanel(ids.id);
    // open every list item and closed group on the way
    setOpen((o) => {
      const n = new Set(o);
      const bits = path.split('.');
      for (let i = 1; i <= bits.length; i++) {
        const p = bits.slice(0, i).join('.');
        if (/^\d+$/.test(bits[i - 1])) n.add(p);
        n.add(p + '#want');
      }
      return n;
    });
    setTimeout(() => {
      const root = form.current;
      if (!root) return;
      // closed groups: open the ones that contain the path
      root.querySelectorAll<HTMLElement>('[data-group]').forEach((g) => {
        const key = g.dataset.group!.replace('#group', '');
        if ((path === key || path.startsWith(key + '.')) && !g.classList.contains('open')) g.querySelector<HTMLButtonElement>('legend button')?.click();
      });
      setTimeout(() => {
        let el: HTMLElement | null = null;
        const bits = path.split('.');
        for (let i = bits.length; i > 0 && !el; i--) el = root.querySelector<HTMLElement>(`[data-path="${bits.slice(0, i).join('.')}"]`);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.remove('flash');
        void el.offsetWidth;
        el.classList.add('flash');
        (el.matches('input,textarea') ? el : el.querySelector<HTMLElement>('input,textarea,select'))?.focus({ preventScroll: true });
      }, 90);
    }, 60);
    return true;
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const d = e.data;
      if (d?.type === 'studio:ready') {
        post({ type: 'studio:mode', edit: editMode });
        if (siteRef.current && JSON.stringify(siteRef.current) !== saved) {
          dirty.current.add('all');
          push(400);
        }
      }
      if (d?.type === 'studio:pick' && siteRef.current) {
        const norm = (s: string) => s.replace(/\s+/g, ' ').replace(/[{}]/g, '').trim().toLowerCase();
        const all = flatten(siteRef.current).filter((x) => x.value && !/^(media\/|https?:|#)/.test(x.value));
        const want = norm(d.text ?? '');
        const inSec = (p: string) => {
          const map: Record<string, string> = { top: 'hero', contact: 'contact' };
          const a = p.split('.')[0];
          return a === (map[d.sec] ?? d.sec) || (d.sec === 'log' && a === 'extra') || ((d.sec === 'top' || d.sec === 'contact') && a === 'person');
        };
        let hit: string | undefined;
        if (d.src) {
          const src = String(d.src);
          hit = flatten(siteRef.current).find((x) => src.endsWith(x.value) && x.value.startsWith('media/'))?.path;
        }
        if (!hit && want) {
          const score = (x: { path: string; value: string }) => {
            const v = norm(x.value);
            let s = 0;
            if (v === want) s = 100;
            else if (want.length > 8 && v.includes(want)) s = 70;
            else if (v.length > 3 && want.includes(v)) s = 30 + Math.min(30, v.length);
            return s ? s + (inSec(x.path) ? 25 : 0) : 0;
          };
          const best = all.map((x) => ({ p: x.path, s: score(x) })).sort((a, b) => b.s - a.s)[0];
          if (best && best.s >= 40) hit = best.p;
        }
        if (hit && focusPath(hit)) return;
        const sec = PANELS.find((p) => p.goto === d.sec);
        if (sec) setPanel(sec.id);
        else say('That part is not editable text.');
      }
    };
    addEventListener('message', onMsg);
    return () => removeEventListener('message', onMsg);
  }, [editMode, focusPath, post, push, saved, say]);

  useEffect(() => post({ type: 'studio:mode', edit: editMode }), [editMode, post]);

  const show = (id: string) => {
    setPanel(id);
    const g = PANELS.find((p) => p.id === id)?.goto;
    if (g) post({ type: 'studio:goto', id: g });
    form.current?.scrollTo({ top: 0 });
  };

  const addQuick = (q: (typeof QUICK)[number]) => {
    setMenu(false);
    const list = getAt(siteRef.current, q.path) ?? [];
    const x = clone(q.blank);
    set(q.path, q.top ? [x, ...list] : [...list, x]);
    const p = `${q.path}.${q.top ? 0 : list.length}`;
    show(q.panel);
    setOpen((o) => new Set([...o].filter((k) => !k.startsWith(q.path + '.')).concat(p)));
    setTimeout(() => focusPath(p + '.' + Object.keys(x as object).find((k) => k !== 'id')), 120);
  };

  const ctx = useMemo<Ctx | null>(
    () =>
      site && {
        site,
        set,
        media,
        setMedia,
        pick: (o) =>
          new Promise((resolve) =>
            setPicker({
              ...o,
              done: (s) => {
                setPicker(null);
                resolve(s);
              },
            }),
          ),
        open,
        toggle: (p, on) =>
          setOpen((o) => {
            const n = new Set(o);
            if (on ?? !n.has(p)) n.add(p);
            else n.delete(p);
            return n;
          }),
        say,
      },
    [site, set, media, open, say],
  );

  if (err)
    return (
      <div className="boot">
        <h1>The Studio could not start</h1>
        <p>{err}</p>
        <p>Close this window and start it again with “Edit Portfolio.bat”.</p>
      </div>
    );
  if (!site || !ctx || !state) return <div className="boot">Opening the bench</div>;

  const p = PANELS.find((x) => x.id === panel);
  return (
    <Studio.Provider value={ctx}>
      <header className="top">
        <b className="brand">Studio</b>
        <span className={'st ' + (unsaved ? 'un' : '')}>{unsaved ? 'Unsaved changes' : 'All saved'}</span>
        <div className="row">
          <button type="button" className="b ghost" disabled={!past.current.length} onClick={() => jump(-1)}>
            Undo
          </button>
          <button type="button" className="b ghost" disabled={!future.current.length} onClick={() => jump(1)}>
            Redo
          </button>
          <button type="button" className="b ghost" onClick={() => setHist(true)} disabled={!history.length}>
            Older versions
          </button>
        </div>
        <span className="sp" />
        <div className="addw">
          <button type="button" className="b add" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            Add something
          </button>
          {menu ? (
            <ul className="addm">
              {QUICK.map((q) => (
                <li key={q.name}>
                  <button type="button" onClick={() => addQuick(q)}>
                    {q.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button type="button" className="b" disabled={!unsaved} onClick={() => void save()} title="Ctrl+S">
          Save
        </button>
        <button type="button" className="b main" onClick={() => setPub({ open: true, busy: false, log: '', msg: 'Update portfolio content' })}>
          Publish
        </button>
      </header>

      <div className="cols">
        <nav className="side" aria-label="What to edit">
          {PANELS.map((x) => {
            const l = site.layout.find((k) => k.id === x.id);
            return (
              <button key={x.id} type="button" className={panel === x.id ? 'on' : ''} onClick={() => show(x.id)}>
                <b>
                  {x.name}
                  {l && !l.visible ? <i>hidden</i> : null}
                </b>
                <small>{x.hint}</small>
              </button>
            );
          })}
          <button type="button" className={panel === 'order' ? 'on' : ''} onClick={() => setPanel('order')}>
            <b>Page order</b>
            <small>Move, hide and rename sections</small>
          </button>
        </nav>

        <div className="form" ref={form}>
          <h1>{panel === 'order' ? 'Page order' : p?.name}</h1>
          {panel === 'order' ? <Order site={site} set={set} /> : p ? <Fields key={p.id} fields={p.fields} /> : null}
        </div>

        <div className="prev">
          <div className="prev-bar">
            <label className="tog small">
              <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
              <i />
              <span>Click the page to edit</span>
            </label>
            <span className="sp" />
            <div className="seg">
              {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => (
                <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)}>
                  {d}
                </button>
              ))}
            </div>
            <a className="b ghost sm" href="/" target="_blank" rel="noreferrer">
              Open full page
            </a>
          </div>
          <div className="prev-f" data-device={device}>
            <iframe ref={frame} src="/?studio=1" title="Live preview" style={DEVICES[device] ? { width: DEVICES[device] } : undefined} />
          </div>
        </div>
      </div>

      {picker ? <Picker kind={picker.kind} dir={picker.dir} many={picker.many} onDone={picker.done} /> : null}

      {pub.open ? (
        <div className="veil" onClick={(e) => e.target === e.currentTarget && !pub.busy && setPub((x) => ({ ...x, open: false }))}>
          <div className="dlg-in pub">
            <h2>Publish</h2>
            <p className="f-h">
              Saves, then sends everything to GitHub
              {git?.remote ? (
                <>
                  {' '}
                  (<code>{git.remote.replace(/\.git$/, '')}</code>)
                </>
              ) : null}
              . If GitHub Pages is switched on, the live site updates a minute or two later.
            </p>
            {git && !git.remote ? <p className="f-h bad">No GitHub repository is connected yet, so this will only save on this computer.</p> : null}
            <label className="f-l" htmlFor="pmsg">
              What changed
            </label>
            <input id="pmsg" value={pub.msg} onChange={(e) => setPub((x) => ({ ...x, msg: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && !pub.busy && void publish()} />
            {pub.log ? <pre className={pub.ok === false ? 'bad' : ''}>{pub.log}</pre> : null}
            <div className="row end">
              <button type="button" className="b ghost" disabled={pub.busy} onClick={() => setPub((x) => ({ ...x, open: false }))}>
                {pub.ok ? 'Done' : 'Cancel'}
              </button>
              <button type="button" className="b main" disabled={pub.busy} onClick={() => void publish()}>
                {pub.busy ? 'Publishing' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {hist ? (
        <div className="veil" onClick={(e) => e.target === e.currentTarget && setHist(false)}>
          <div className="dlg-in pub">
            <h2>Older versions</h2>
            <p className="f-h">Every save keeps a copy. Opening one puts it in the editor; nothing is overwritten until you save.</p>
            <ul className="hist">
              {history.map((h) => (
                <li key={h}>
                  <span>{new Date(h.replace('.json', '').replace(/T(\d+)-(\d+)-(\d+)-(\d+)Z/, 'T$1:$2:$3.$4Z')).toLocaleString()}</span>
                  <button
                    type="button"
                    className="b sm"
                    onClick={async () => {
                      try {
                        const r = await api.restore(h);
                        past.current.push(siteRef.current!);
                        setSite(r.site);
                        siteRef.current = r.site;
                        dirty.current.add('all');
                        push(60);
                        setHist(false);
                        say('Opened that version. Save to keep it.');
                      } catch (e) {
                        say((e as Error).message, true);
                      }
                    }}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div key={toast.k} className={'toast ' + (toast.bad ? 'bad' : '')} role="status">
          {toast.msg}
        </div>
      ) : null}
    </Studio.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
