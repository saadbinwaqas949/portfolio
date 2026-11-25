import type { Site } from '../src/content';

export interface MediaItem {
  src: string;
  size: number;
  time: number;
  kind: string;
}
export interface GitState {
  repo: boolean;
  branch: string;
  remote: string;
  changes: number;
}
export interface State {
  site: Site;
  media: MediaItem[];
  history: string[];
  git: GitState;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch('/__studio' + path, { ...init, headers: { 'x-studio': '1', ...(init.headers ?? {}) } });
  const body = await r.json().catch(() => ({ error: 'The Studio server did not answer.' }));
  if (!r.ok) throw new Error(body.error ?? 'Something went wrong.');
  return body as T;
}
const post = <T>(path: string, body: unknown) =>
  call<T>(path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

export const api = {
  state: () => call<State>('/state'),
  git: () => call<GitState>('/git'),
  save: (site: Site) => post<{ ok: true; history: string[]; git: GitState }>('/save', { site }),
  trash: (src: string) => post<{ media: MediaItem[] }>('/trash', { src }),
  restore: (file: string) => post<{ site: Site }>('/restore', { file }),
  publish: (message: string) => post<{ ok: boolean; log: string; git?: GitState }>('/publish', { message }),
  upload: (file: File, dir: string) =>
    call<{ src: string; kind: string; media: MediaItem[] }>(`/upload?name=${encodeURIComponent(file.name)}&dir=${encodeURIComponent(dir)}`, {
      method: 'POST',
      body: file,
      headers: { 'Content-Type': 'application/octet-stream' },
    }),
};

/* ---- paths ---------------------------------------------------------- */
export function getAt(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setAt<T>(obj: T, path: string, value: unknown): T {
  if (!path) return value as T;
  const [head, ...rest] = path.split('.');
  const base: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  base[head] = rest.length ? setAt(base[head] ?? (/^\d+$/.test(rest[0]) ? [] : {}), rest.join('.'), value) : value;
  return base;
}

/** Every string in the content with its path. */
export function flatten(obj: any, path = '', out: { path: string; value: string }[] = []) {
  if (typeof obj === 'string') out.push({ path, value: obj });
  else if (Array.isArray(obj)) obj.forEach((v, i) => flatten(v, path ? `${path}.${i}` : String(i), out));
  else if (obj && typeof obj === 'object') for (const k in obj) flatten(obj[k], path ? `${path}.${k}` : k, out);
  return out;
}

export const mediaUrl = (src: string) => (/^(https?:|data:|blob:|\/)/.test(src) ? src : '/' + src);
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
export const nice = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
