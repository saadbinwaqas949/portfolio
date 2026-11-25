import { createContext, useContext, useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { youtubeId, type Img } from '../src/content';
import { api, clone, getAt, mediaUrl, nice, type MediaItem } from './api';
import type { Field } from './schema';

export interface Ctx {
  site: any;
  set(path: string, value: unknown): void;
  media: MediaItem[];
  setMedia(m: MediaItem[]): void;
  pick(opts: { dir: string; kind: 'image' | 'video' | 'doc'; many?: boolean }): Promise<string[]>;
  open: Set<string>;
  toggle(path: string, on?: boolean): void;
  say(msg: string, bad?: boolean): void;
}
export const Studio = createContext<Ctx>(null!);
export const useStudio = () => useContext(Studio);

const join = (a: string, b: string) => (a ? `${a}.${b}` : b);

function Label({ f, id, children, path }: { f: { label: string; help?: string }; id?: string; children: ReactNode; path: string }) {
  return (
    <div className="f" data-path={path}>
      <label className="f-l" htmlFor={id}>
        {f.label}
      </label>
      {children}
      {f.help ? <p className="f-h">{f.help}</p> : null}
    </div>
  );
}

function Grow({ id, value, rows = 2, onChange, placeholder }: { id: string; value: string; rows?: number; onChange(v: string): void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [value]);
  return <textarea ref={ref} id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

/** Drop photos from the desktop straight onto a field. */
function useDrop(dir: string, accept: (srcs: string[]) => void, single = false) {
  const s = useStudio();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const take = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    const got: string[] = [];
    for (const f of single ? files.slice(0, 1) : files) {
      try {
        const r = await api.upload(f, dir);
        got.push(r.src);
        s.setMedia(r.media);
      } catch (e) {
        s.say(`${f.name}: ${(e as Error).message}`, true);
      }
    }
    setBusy(false);
    if (got.length) accept(got);
  };
  return {
    over,
    busy,
    take,
    props: {
      onDragOver: (e: DragEvent) => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        void take([...e.dataTransfer.files]);
      },
      onPaste: (e: React.ClipboardEvent) => {
        const files = [...e.clipboardData.files];
        if (files.length) {
          e.preventDefault();
          void take(files);
        }
      },
    },
  };
}

/** Grab a frame from a video and store it as its cover. */
async function coverOf(src: string): Promise<string> {
  const v = document.createElement('video');
  v.muted = true;
  v.preload = 'auto';
  v.src = mediaUrl(src);
  await new Promise((ok, no) => {
    v.onloadeddata = ok;
    v.onerror = no;
  });
  v.currentTime = Math.min(v.duration * 0.4, v.duration - 0.05);
  await new Promise((ok) => (v.onseeked = ok));
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d')!.drawImage(v, 0, 0);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
  if (!blob) return '';
  const name = src.split('/').pop()!.replace(/\.[^.]+$/, '') + '.jpg';
  const r = await api.upload(new File([blob], name, { type: 'image/jpeg' }), 'clips');
  return r.src;
}

function ImageBox({ path, dir, caption = true, onRemove }: { path: string; dir: string; caption?: boolean; onRemove?(): void }) {
  const s = useStudio();
  const v: Img = getAt(s.site, path) ?? { src: '', alt: '' };
  const id = useId();
  const drop = useDrop(dir, ([src]) => s.set(path, { ...v, src }), true);
  const choose = async () => {
    const [src] = await s.pick({ dir, kind: 'image' });
    if (src) s.set(path, { ...v, src });
  };
  const [clip, setClip] = useState('');
  const chooseClip = async () => {
    const [video] = await s.pick({ dir: 'clips', kind: 'video' });
    if (!video) return;
    setClip('Making a cover picture');
    const cover = await coverOf(video).catch(() => '');
    setClip('');
    s.set(path, { ...v, video, src: cover || v.src });
  };
  return (
    <div className={'img ' + (drop.over ? 'over' : '')} {...drop.props} data-path={join(path, 'src')}>
      <button type="button" className="img-th" onClick={choose}>
        {drop.busy ? <span>Uploading</span> : v.src ? <img src={mediaUrl(v.src)} alt="" /> : <span>Choose or drop a photo</span>}
      </button>
      <div className="img-t">
        <label htmlFor={id}>Describe the photo</label>
        <input id={id} value={v.alt ?? ''} placeholder="For screen readers and Google" onChange={(e) => s.set(join(path, 'alt'), e.target.value)} className={v.src && !v.alt ? 'warn' : ''} />
        {caption ? <input value={v.caption ?? ''} placeholder="Handwritten caption (optional)" onChange={(e) => s.set(join(path, 'caption'), e.target.value)} aria-label="Caption" /> : null}
        <div className="row">
          {v.src ? (
            <select value={v.focus ?? ''} aria-label="Keep in view" title="Which part to keep when the photo is cropped" onChange={(e) => s.set(join(path, 'focus'), e.target.value)}>
              <option value="">Keep the middle</option>
              <option value="top">Keep the top</option>
              <option value="bottom">Keep the bottom</option>
            </select>
          ) : null}
          <button type="button" className="b sm" onClick={choose}>
            {v.src ? 'Replace' : 'Choose'}
          </button>
          <button type="button" className="b sm" disabled={!!clip} onClick={v.video ? () => s.set(path, { ...v, video: '' }) : chooseClip} title={v.video || 'A short silent video that plays here'}>
            {clip || (v.video ? 'Remove clip' : 'Add a clip')}
          </button>
          {v.src ? (
            <button type="button" className="b sm ghost" onClick={() => (onRemove ? onRemove() : s.set(path, { src: '', alt: '', caption: '' }))}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Reorderable rows: drag the handle or use the arrows. */
function useReorder(list: any[], write: (l: any[]) => void) {
  const from = useRef(-1);
  const [over, setOver] = useState(-1);
  const move = (a: number, b: number) => {
    if (b < 0 || b >= list.length || a === b) return;
    const n = [...list];
    const [x] = n.splice(a, 1);
    n.splice(b, 0, x);
    write(n);
  };
  return {
    over,
    move,
    row: (i: number) => ({
      onDragOver: (e: DragEvent) => {
        if (from.current < 0) return;
        e.preventDefault();
        setOver(i);
      },
      onDrop: (e: DragEvent) => {
        if (from.current < 0) return;
        e.preventDefault();
        e.stopPropagation();
        move(from.current, i);
        from.current = -1;
        setOver(-1);
      },
    }),
    handle: (i: number) => ({
      draggable: true,
      onDragStart: (e: DragEvent) => {
        from.current = i;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
      },
      onDragEnd: () => {
        from.current = -1;
        setOver(-1);
      },
    }),
  };
}

function Strings({ f, path }: { f: Extract<Field, { k: 'strings' }>; path: string }) {
  const s = useStudio();
  const list: string[] = getAt(s.site, path) ?? [];
  const [draft, setDraft] = useState('');
  const write = (l: string[]) => s.set(path, l);
  const r = useReorder(list, write);
  const add = () => {
    const bits = draft.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
    if (bits.length) write([...list, ...bits]);
    setDraft('');
  };
  return (
    <Label f={f} path={path}>
      <ul className="tags">
        {list.map((x, i) => (
          <li key={i} {...r.row(i)} className={r.over === i ? 'over' : ''}>
            <span className="grip" {...r.handle(i)} aria-hidden>
              ⠿
            </span>
            <input value={x} aria-label={f.one} data-path={join(path, String(i))} onChange={(e) => s.set(join(path, String(i)), e.target.value)} size={Math.max(3, x.length)} />
            <button type="button" aria-label={'Remove ' + x} onClick={() => write(list.filter((_, k) => k !== i))}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="row">
        <input value={draft} placeholder={`Add a ${f.one}, or several with commas`} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        <button type="button" className="b" onClick={add} disabled={!draft.trim()}>
          Add
        </button>
      </div>
    </Label>
  );
}

function Images({ f, path }: { f: Extract<Field, { k: 'images' }>; path: string }) {
  const s = useStudio();
  const list: Img[] = getAt(s.site, path) ?? [];
  const write = (l: Img[]) => s.set(path, l);
  const add = (srcs: string[]) => write([...list, ...srcs.map((src) => ({ src, alt: '', caption: '' }))]);
  const drop = useDrop(f.dir, add);
  const r = useReorder(list, write);
  return (
    <Label f={f} path={path}>
      <div className={'imgs ' + (drop.over ? 'over' : '')} {...drop.props}>
        {list.map((_, i) => (
          <div key={i} className={'imgs-row ' + (r.over === i ? 'over' : '')} {...r.row(i)}>
            <span className="grip" {...r.handle(i)} title="Drag to reorder" aria-hidden>
              ⠿
            </span>
            <ImageBox path={join(path, String(i))} dir={f.dir} onRemove={() => write(list.filter((_, k) => k !== i))} />
          </div>
        ))}
        <button type="button" className="dropz" onClick={async () => add(await s.pick({ dir: f.dir, kind: 'image', many: true }))}>
          {drop.busy ? 'Uploading' : 'Drop photos here, or click to choose'}
        </button>
      </div>
    </Label>
  );
}

function List({ f, path }: { f: Extract<Field, { k: 'list' }>; path: string }) {
  const s = useStudio();
  const list: any[] = getAt(s.site, path) ?? [];
  const write = (l: any[]) => s.set(path, l);
  const r = useReorder(list, write);
  const add = () => {
    const x = clone(f.blank);
    write(f.top ? [x, ...list] : [...list, x]);
    s.toggle(join(path, String(f.top ? 0 : list.length)), true);
  };
  return (
    <div className="f list" data-path={path}>
      <div className="list-h">
        <span className="f-l">
          {f.label} <i>{list.length}</i>
        </span>
        <button type="button" className="b sm" onClick={add}>
          Add {f.one}
        </button>
      </div>
      {f.help ? <p className="f-h">{f.help}</p> : null}
      <ul className="items">
        {list.map((x, i) => {
          const p = join(path, String(i));
          const open = s.open.has(p);
          const th = f.thumb?.(x);
          return (
            <li key={i} className={`item ${open ? 'open' : ''} ${r.over === i ? 'over' : ''}`} {...r.row(i)} data-item={p}>
              <div className="item-h">
                <span className="grip" {...r.handle(i)} title="Drag to reorder" aria-hidden>
                  ⠿
                </span>
                <button type="button" className="item-t" aria-expanded={open} onClick={() => s.toggle(p)}>
                  {th ? <img src={mediaUrl(th)} alt="" /> : null}
                  <span>
                    <b>{f.title(x) || `New ${f.one}`}</b>
                    {f.sub?.(x) ? <small>{f.sub(x)}</small> : null}
                  </span>
                </button>
                <button type="button" className="ic" aria-label="Move up" disabled={i === 0} onClick={() => r.move(i, i - 1)}>
                  ↑
                </button>
                <button type="button" className="ic" aria-label="Move down" disabled={i === list.length - 1} onClick={() => r.move(i, i + 1)}>
                  ↓
                </button>
              </div>
              {open ? (
                <div className="item-b">
                  <Fields fields={f.item} path={p} />
                  <div className="row end">
                    <button type="button" className="b sm ghost" onClick={() => write([...list.slice(0, i + 1), clone(x), ...list.slice(i + 1)])}>
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="b sm danger"
                      onClick={() => {
                        write(list.filter((_, k) => k !== i));
                        s.toggle(p, false);
                        s.say(`Removed. Undo brings it back.`);
                      }}
                    >
                      Remove {f.one}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Group({ f, path }: { f: Extract<Field, { k: 'group' }>; path: string }) {
  const s = useStudio();
  const key = path + '#group';
  const open = f.closed ? s.open.has(key) : !s.open.has(key);
  return (
    <fieldset className={'grp ' + (open ? 'open' : '')} data-group={key} data-closed={f.closed ? 1 : 0}>
      <legend>
        <button type="button" aria-expanded={open} onClick={() => s.toggle(key)}>
          {f.label}
        </button>
      </legend>
      {f.help && open ? <p className="f-h">{f.help}</p> : null}
      {open ? <Fields fields={f.fields} path={path} /> : null}
    </fieldset>
  );
}

function FileField({ f, path }: { f: Extract<Field, { k: 'file' }>; path: string }) {
  const s = useStudio();
  const v: string = getAt(s.site, path) ?? '';
  const drop = useDrop(f.dir, ([src]) => s.set(path, src), true);
  const mine = v && !/^https?:/.test(v);
  return (
    <Label f={f} path={path}>
      <div className={'filef ' + (drop.over ? 'over' : '')} {...drop.props}>
        {mine && f.kind === 'image' ? <img src={mediaUrl(v)} alt="" /> : null}
        <span className="filef-n">{drop.busy ? 'Uploading' : mine ? v.split('/').pop() : 'Drop a file here'}</span>
        <button
          type="button"
          className="b sm"
          onClick={async () => {
            const [src] = await s.pick({ dir: f.dir, kind: f.kind });
            if (src) s.set(path, src);
          }}
        >
          Choose
        </button>
        {mine ? (
          <button type="button" className="b sm ghost" onClick={() => s.set(path, '')}>
            Clear
          </button>
        ) : null}
      </div>
    </Label>
  );
}

function One({ f, base }: { f: Field; base: string }) {
  const s = useStudio();
  const id = useId();
  const path = join(base, f.key);
  const v = getAt(s.site, path);
  switch (f.k) {
    case 'text':
    case 'url':
      return (
        <Label f={f} id={id} path={path}>
          <input id={id} type={f.k === 'url' ? 'url' : 'text'} value={v ?? ''} placeholder={f.placeholder ?? (f.k === 'url' ? 'https://' : '')} onChange={(e) => s.set(path, e.target.value)} />
        </Label>
      );
    case 'youtube': {
      const yt = youtubeId(v ?? '');
      return (
        <Label f={f} id={id} path={path}>
          <input id={id} type="text" value={v && /^https?:|^[\w-]{11}$/.test(v) ? v : ''} placeholder="Paste a YouTube link" onChange={(e) => s.set(path, e.target.value.trim())} />
          {yt ? <img className="yt" src={`https://i.ytimg.com/vi/${yt}/mqdefault.jpg`} alt="" /> : v && /^https?:/.test(v) ? <p className="f-h bad">That does not look like a YouTube link.</p> : null}
        </Label>
      );
    }
    case 'area':
      return (
        <Label f={f} id={id} path={path}>
          <Grow id={id} rows={f.rows} value={v ?? ''} placeholder={f.placeholder} onChange={(x) => s.set(path, x)} />
        </Label>
      );
    case 'color':
      return (
        <Label f={f} id={id} path={path}>
          <div className="row">
            <input id={id} type="color" value={v || '#2f6bff'} onChange={(e) => s.set(path, e.target.value)} />
            <input value={v ?? ''} onChange={(e) => s.set(path, e.target.value)} aria-label="Colour code" />
          </div>
        </Label>
      );
    case 'toggle':
      return (
        <div className="f" data-path={path}>
          <label className="tog">
            <input type="checkbox" checked={!!v} onChange={(e) => s.set(path, e.target.checked)} />
            <i />
            <span>{f.label}</span>
          </label>
          {f.help ? <p className="f-h">{f.help}</p> : null}
        </div>
      );
    case 'select':
      return (
        <Label f={f} id={id} path={path}>
          <select id={id} value={v ?? ''} onChange={(e) => s.set(path, e.target.value)}>
            {f.options.some(([o]) => o === v) ? null : <option value={v ?? ''}>{v || 'Choose'}</option>}
            {f.options.map(([o, n]) => (
              <option key={o} value={o}>
                {n}
              </option>
            ))}
          </select>
        </Label>
      );
    case 'range':
      return (
        <Label f={f} id={id} path={path}>
          {f.marks ? (
            <div className="seg" role="radiogroup" aria-label={f.label}>
              {f.marks.map((m, i) => (
                <button key={m} type="button" role="radio" aria-checked={(v ?? f.min) === f.min + i} onClick={() => s.set(path, f.min + i)}>
                  {m}
                </button>
              ))}
            </div>
          ) : (
            <div className="row">
              <input id={id} type="range" min={f.min} max={f.max} value={v ?? f.min} onChange={(e) => s.set(path, +e.target.value)} />
              <output>{v ?? f.min}</output>
            </div>
          )}
        </Label>
      );
    case 'strings':
      return <Strings f={f} path={path} />;
    case 'image':
      return (
        <Label f={f} path={path}>
          <ImageBox path={path} dir={f.dir} caption={f.caption} />
        </Label>
      );
    case 'images':
      return <Images f={f} path={path} />;
    case 'file':
      return <FileField f={f} path={path} />;
    case 'link':
      return (
        <Label f={f} path={path}>
          <div className="row">
            <input value={getAt(s.site, join(path, 'label')) ?? ''} placeholder="Text" aria-label={f.label + ' text'} data-path={join(path, 'label')} onChange={(e) => s.set(join(path, 'label'), e.target.value)} />
            <input value={getAt(s.site, join(path, 'url')) ?? ''} placeholder="https://" aria-label={f.label + ' address'} data-path={join(path, 'url')} onChange={(e) => s.set(join(path, 'url'), e.target.value)} />
          </div>
        </Label>
      );
    case 'group':
      return <Group f={f} path={path} />;
    case 'list':
      return <List f={f} path={path} />;
  }
}

export function Fields({ fields, path = '' }: { fields: Field[]; path?: string }) {
  return (
    <>
      {fields.map((f, i) => (
        <One key={f.key + f.k + i} f={f} base={path} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Media picker                                                        */
/* ------------------------------------------------------------------ */
export function Picker({
  kind,
  dir,
  many,
  onDone,
}: {
  kind: 'image' | 'video' | 'doc';
  dir: string;
  many?: boolean;
  onDone(srcs: string[]): void;
}) {
  const s = useStudio();
  const [sel, setSel] = useState<string[]>([]);
  const [folder, setFolder] = useState('all');
  const [used, setUsed] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const drop = useDrop(dir, (srcs) => (many ? setSel((x) => [...x, ...srcs]) : onDone(srcs)), !many);
  useEffect(() => {
    ref.current?.showModal();
    setUsed(new Set([...JSON.stringify(s.site).matchAll(/media\/[^"]+/g)].map((m) => m[0])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const items = s.media.filter((m) => m.kind === kind);
  const folders = [...new Set(items.map((m) => m.src.split('/')[1]))];
  const shown = items.filter((m) => folder === 'all' || m.src.split('/')[1] === folder);
  const hit = (src: string) => {
    if (!many) return onDone([src]);
    setSel((x) => (x.includes(src) ? x.filter((y) => y !== src) : [...x, src]));
  };
  return (
    <dialog ref={ref} className={'dlg picker ' + (drop.over ? 'over' : '')} onClose={() => onDone([])} onClick={(e) => e.target === ref.current && onDone([])} {...drop.props}>
      <div className="dlg-in">
        <header>
          <h2>Choose {many ? 'photos' : kind === 'image' ? 'a photo' : kind === 'video' ? 'a video' : 'a PDF'}</h2>
          <button type="button" className="b" onClick={() => file.current?.click()}>
            {drop.busy ? 'Uploading' : 'Upload from this computer'}
          </button>
          <input ref={file} type="file" hidden multiple={many} accept={kind === 'image' ? 'image/*' : kind === 'video' ? 'video/*' : 'application/pdf'} onChange={(e) => void drop.take([...(e.target.files ?? [])])} />
          <button type="button" className="b ghost" onClick={() => onDone([])}>
            Cancel
          </button>
        </header>
        {kind === 'image' ? <p className="f-h">You can drop files anywhere in this window. Photos are resized, and location data is removed.</p> : null}
        <div className="chips">
          {['all', ...folders].map((x) => (
            <button key={x} type="button" aria-pressed={folder === x} onClick={() => setFolder(x)}>
              {x}
            </button>
          ))}
        </div>
        <div className="pgrid">
          {shown.map((m) => (
            <figure key={m.src} className={sel.includes(m.src) ? 'sel' : ''}>
              <button type="button" onClick={() => hit(m.src)}>
                {m.kind === 'image' ? <img src={mediaUrl(m.src)} alt="" loading="lazy" /> : <span>{m.src.split('/').pop()}</span>}
              </button>
              <figcaption>
                <span title={m.src}>{m.src.split('/').pop()}</span>
                <small>{nice(m.size)}</small>
                {used.has(m.src) ? (
                  <small>in use</small>
                ) : (
                  <button
                    type="button"
                    className="ic"
                    title="Move to trash"
                    aria-label={'Move to trash: ' + m.src}
                    onClick={async () => {
                      try {
                        s.setMedia((await api.trash(m.src)).media);
                      } catch (e) {
                        s.say((e as Error).message, true);
                      }
                    }}
                  >
                    ✕
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
          {!shown.length ? <p className="empty">Nothing here yet. Drop files in this window to add them.</p> : null}
        </div>
        {many ? (
          <footer>
            <button type="button" className="b main" disabled={!sel.length} onClick={() => onDone(sel)}>
              Add {sel.length || ''} {sel.length === 1 ? 'photo' : 'photos'}
            </button>
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
