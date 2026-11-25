// The Studio backend. Runs only inside `npm run dev` / `npm run studio`, only
// answers requests from this computer, and is never part of the built site.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';

const IMAGE = /\.(jpe?g|png|webp|avif|gif|tiff?|heic|heif)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;
const DOC = /\.pdf$/i;
const MAX_UPLOAD = 90 * 1024 * 1024;
const KEEP_BACKUPS = 40;

export function studio(): Plugin {
  let root = process.cwd();
  const at = (...p: string[]) => path.join(root, ...p);
  const contentFile = () => at('content', 'site.json');
  const historyDir = () => at('content', '.history');
  const mediaDir = () => at('public', 'media');

  const send = (res: ServerResponse, code: number, body: unknown) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };

  const read = (req: IncomingMessage, limit: number) =>
    new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > limit) {
          reject(new Error(`That file is larger than ${Math.round(limit / 1048576)} MB.`));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

  const git = (args: string[], timeout = 120_000) =>
    new Promise<{ ok: boolean; out: string }>((resolve) => {
      execFile('git', args, { cwd: root, timeout, windowsHide: true, maxBuffer: 4e6 }, (err, stdout, stderr) =>
        resolve({ ok: !err, out: `${stdout}${stderr}`.trim() }),
      );
    });

  /** Only this machine, only this page. */
  const allowed = (req: IncomingMessage) => {
    const ip = req.socket.remoteAddress ?? '';
    const local = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    const host = (req.headers.host ?? '').replace(/:\d+$/, '');
    const hostOk = ['localhost', '127.0.0.1', '[::1]'].includes(host);
    const origin = req.headers.origin;
    const originOk = !origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
    // a custom header forces a CORS preflight, so other sites cannot post here
    const headerOk = req.method === 'GET' || req.headers['x-studio'] === '1';
    return local && hostOk && originOk && headerOk;
  };

  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'file';

  /** Resolve a media path and refuse anything outside public/media. */
  const inMedia = (src: string) => {
    const rel = src.replace(/^\/+/, '').replace(/^media\//, '');
    const full = path.resolve(mediaDir(), rel);
    if (!full.startsWith(path.resolve(mediaDir()) + path.sep)) throw new Error('That path is outside the media folder.');
    return full;
  };

  async function listMedia() {
    const out: { src: string; size: number; time: number; kind: string }[] = [];
    const walk = async (dir: string) => {
      for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else if (IMAGE.test(e.name) || VIDEO.test(e.name) || DOC.test(e.name) || /\.svg$/i.test(e.name)) {
          const s = await fsp.stat(full);
          out.push({
            src: 'media/' + path.relative(mediaDir(), full).split(path.sep).join('/'),
            size: s.size,
            time: s.mtimeMs,
            kind: VIDEO.test(e.name) ? 'video' : DOC.test(e.name) ? 'doc' : 'image',
          });
        }
      }
    };
    if (fs.existsSync(mediaDir())) await walk(mediaDir());
    return out.sort((a, b) => b.time - a.time);
  }

  async function history() {
    if (!fs.existsSync(historyDir())) return [];
    return (await fsp.readdir(historyDir())).filter((f) => f.endsWith('.json')).sort().reverse();
  }

  async function backup() {
    if (!fs.existsSync(contentFile())) return;
    await fsp.mkdir(historyDir(), { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fsp.copyFile(contentFile(), path.join(historyDir(), stamp + '.json'));
    for (const old of (await history()).slice(KEEP_BACKUPS)) await fsp.rm(path.join(historyDir(), old), { force: true });
  }

  async function writeContent(site: unknown) {
    if (!site || typeof site !== 'object' || Array.isArray(site)) throw new Error('Nothing to save.');
    const text = JSON.stringify(site, null, 2) + '\n';
    JSON.parse(text);
    await backup();
    // write beside, then swap, so a crash can never leave half a file
    const tmp = contentFile() + '.tmp';
    await fsp.writeFile(tmp, text, 'utf8');
    await fsp.rename(tmp, contentFile());
  }

  async function gitState() {
    const inside = await git(['rev-parse', '--is-inside-work-tree']);
    if (!inside.ok) return { repo: false, branch: '', remote: '', changes: 0 };
    const [branch, remote, status] = await Promise.all([
      git(['rev-parse', '--abbrev-ref', 'HEAD']),
      git(['remote', 'get-url', 'origin']),
      git(['status', '--porcelain']),
    ]);
    return {
      repo: true,
      branch: branch.ok ? branch.out : '',
      remote: remote.ok ? remote.out.replace(/\/\/[^@/]+@/, '//') : '',
      changes: status.ok && status.out ? status.out.split('\n').length : 0,
    };
  }

  async function saveUpload(name: string, dir: string, data: Buffer) {
    const folder = slug(dir || 'photos');
    const target = path.join(mediaDir(), folder);
    await fsp.mkdir(target, { recursive: true });
    const unique = (base: string, ext: string) => {
      let f = `${base}${ext}`;
      let i = 2;
      while (fs.existsSync(path.join(target, f))) f = `${base}-${i++}${ext}`;
      return f;
    };
    const base = slug(name);
    if (IMAGE.test(name)) {
      const sharp = (await import('sharp')).default;
      // rotate() applies the camera orientation; re-encoding drops EXIF and GPS
      const img = sharp(data, { failOn: 'none', animated: /\.gif$/i.test(name) }).rotate();
      const file = unique(base, '.webp');
      const info = await img
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 83 })
        .toFile(path.join(target, file));
      return { src: `media/${folder}/${file}`, width: info.width, height: info.height, size: info.size, kind: 'image' };
    }
    if (VIDEO.test(name) || DOC.test(name)) {
      const ext = path.extname(name).toLowerCase();
      const file = unique(base, ext);
      await fsp.writeFile(path.join(target, file), data);
      return { src: `media/${folder}/${file}`, size: data.length, kind: VIDEO.test(name) ? 'video' : 'doc' };
    }
    throw new Error('Use a photo (jpg, png, webp, gif, heic), a video (mp4, webm) or a PDF.');
  }

  return {
    name: 'portfolio-studio',
    apply: 'serve',
    configResolved(c) {
      root = c.root;
    },
    handleHotUpdate(ctx) {
      // the Studio already pushed this change into its preview
      if (path.resolve(ctx.file) === path.resolve(contentFile())) {
        const mods = ctx.server.moduleGraph.getModulesByFile(ctx.file.split(path.sep).join('/'));
        mods?.forEach((m) => ctx.server.moduleGraph.invalidateModule(m));
        ctx.server.ws.send({ type: 'custom', event: 'site-json' });
        return [];
      }
    },
    configureServer(server) {
      server.middlewares.use('/__studio', async (req, res) => {
        if (!allowed(req)) return send(res, 403, { error: 'The Studio only answers this computer.' });
        const url = new URL(req.url ?? '/', 'http://localhost');
        const route = `${req.method} ${url.pathname.replace(/\/$/, '')}`;
        try {
          switch (route) {
            case 'GET /state':
              return send(res, 200, {
                site: JSON.parse(await fsp.readFile(contentFile(), 'utf8')),
                media: await listMedia(),
                history: await history(),
                git: await gitState(),
              });
            case 'GET /git':
              return send(res, 200, await gitState());
            case 'POST /save': {
              const body = JSON.parse((await read(req, 8e6)).toString('utf8'));
              await writeContent(body.site);
              return send(res, 200, { ok: true, history: await history(), git: await gitState() });
            }
            case 'POST /upload': {
              const data = await read(req, MAX_UPLOAD);
              if (!data.length) throw new Error('That file is empty.');
              const out = await saveUpload(url.searchParams.get('name') ?? 'file', url.searchParams.get('dir') ?? 'photos', data);
              return send(res, 200, { ...out, media: await listMedia() });
            }
            case 'POST /trash': {
              const { src } = JSON.parse((await read(req, 1e5)).toString('utf8'));
              const full = inMedia(String(src));
              const bin = at('content', '.history', 'trash');
              await fsp.mkdir(bin, { recursive: true });
              await fsp.rename(full, path.join(bin, `${Date.now()}-${path.basename(full)}`));
              return send(res, 200, { ok: true, media: await listMedia() });
            }
            case 'POST /restore': {
              const { file } = JSON.parse((await read(req, 1e5)).toString('utf8'));
              const name = path.basename(String(file));
              const site = JSON.parse(await fsp.readFile(path.join(historyDir(), name), 'utf8'));
              return send(res, 200, { site });
            }
            case 'POST /publish': {
              const { message } = JSON.parse((await read(req, 1e5)).toString('utf8'));
              const log: string[] = [];
              const state = await gitState();
              if (!state.repo) throw new Error('This folder is not a git repository yet.');
              await git(['add', '-A']);
              const staged = await git(['diff', '--cached', '--quiet']);
              if (!staged.ok) {
                const msg = String(message || 'Update portfolio content').slice(0, 200);
                const c = await git(['commit', '-m', msg]);
                log.push(c.out);
                if (!c.ok) return send(res, 200, { ok: false, log: log.join('\n') });
              } else log.push('Nothing new to commit.');
              if (!state.remote) {
                log.push('Saved on this computer. There is no GitHub repository connected yet.');
                return send(res, 200, { ok: false, log: log.join('\n'), git: await gitState() });
              }
              const p = await git(['push', '-u', 'origin', state.branch || 'main'], 180_000);
              log.push(p.out);
              return send(res, 200, { ok: p.ok, log: log.join('\n'), git: await gitState() });
            }
            default:
              return send(res, 404, { error: 'Unknown request.' });
          }
        } catch (e) {
          return send(res, 400, { error: e instanceof Error ? e.message : String(e) });
        }
      });
    },
  };
}
