// `virtual:media-sizes`: the pixel size of every picture in public/media, so a
// print has its final shape before the photo loads and the page never jumps.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { Plugin } from 'vite';

const ID = 'virtual:media-sizes';
const REAL = '\0' + ID;

export function mediaSizes(): Plugin {
  let pub = '';
  return {
    name: 'portfolio-media-sizes',
    configResolved(c) {
      pub = c.publicDir;
    },
    resolveId: (id) => (id === ID ? REAL : undefined),
    async load(id) {
      if (id !== REAL) return;
      const dir = path.join(pub, 'media');
      const out: Record<string, [number, number]> = {};
      const files = fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }) : [];
      for (const f of files) {
        if (!/\.(webp|jpe?g|png|avif|gif)$/i.test(f)) continue;
        try {
          const m = await sharp(path.join(dir, f)).metadata();
          // photos turned by their EXIF tag report the stored, unturned size
          const turned = (m.orientation ?? 1) >= 5;
          const key = 'media/' + f.split(path.sep).join('/');
          if (m.width && m.height) out[key] = turned ? [m.height, m.width] : [m.width, m.height];
        } catch {
          // not a readable picture: the print falls back to measuring it
        }
      }
      return `export default ${JSON.stringify(out)}`;
    },
  };
}
