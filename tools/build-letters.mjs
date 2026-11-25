// Turns the display font into plain outline data so the 3D letters can be
// extruded in the browser. Run with: node tools/build-letters.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as opentype from 'opentype.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'node_modules/@fontsource/dela-gothic-one/files');
const buf = fs.readFileSync(path.join(dir, 'dela-gothic-one-latin-400-normal.woff'));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const parse = opentype.parse ?? opentype.default?.parse;
const font = parse(ab);

const chars =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  '.,:;!?&\'"()-+/#@%*=’‘“”–—';

const r = (n) => Math.round(n);
const glyphs = {};
for (const ch of chars) {
  const g = font.charToGlyph(ch);
  if (!g || g.index === 0) { console.log('missing', ch); continue; }
  const p = g.getPath(0, 0, font.unitsPerEm);
  const out = [];
  for (const c of p.commands) {
    if (c.type === 'M') out.push('M', r(c.x), r(-c.y));
    else if (c.type === 'L') out.push('L', r(c.x), r(-c.y));
    else if (c.type === 'Q') out.push('Q', r(c.x1), r(-c.y1), r(c.x), r(-c.y));
    else if (c.type === 'C') out.push('C', r(c.x1), r(-c.y1), r(c.x2), r(-c.y2), r(c.x), r(-c.y));
    else if (c.type === 'Z') out.push('Z');
  }
  glyphs[ch] = { a: r(g.advanceWidth), p: out };
}
const data = {
  name: 'Dela Gothic One',
  upm: font.unitsPerEm,
  asc: font.ascender,
  desc: font.descender,
  cap: font.tables.os2?.sCapHeight ?? 0,
  glyphs,
};
fs.mkdirSync(path.join(root, 'src/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'src/data/letters.json'), JSON.stringify(data));
console.log('glyphs', Object.keys(glyphs).length, 'upm', data.upm, 'asc', data.asc, 'desc', data.desc, 'cap', data.cap,
  'bytes', fs.statSync(path.join(root, 'src/data/letters.json')).size);
