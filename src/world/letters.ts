// Any text on the page can become solid letters lying on the mat.
// The DOM keeps the real text (for layout, search and screen readers); this
// puts a mesh exactly where each character sits.
import * as THREE from 'three';
import data from '../data/letters.json';
import { M } from './materials';
import { U, type Stage, type World } from './World';

type Glyph = { a: number; p: (string | number)[] };
const glyphs = data.glyphs as unknown as Record<string, Glyph>;
const UPM = data.upm;
/** baseline offset inside a line-height:1 box, as a fraction of font size */
const BASE = (1 - (data.asc - data.desc) / UPM) / 2 + data.asc / UPM;

/** Width of a string in em, for fitting headlines to the page. */
export function emWidth(text: string) {
  let w = 0;
  for (const c of text) w += (glyphs[c]?.a ?? (c === ' ' ? 280 : 700)) / UPM;
  return +w.toFixed(3);
}

export type LetterStyle = 'kraft' | 'carbon' | 'metal' | 'toy' | 'gold' | 'wood' | 'foam' | 'ink' | 'steel';

const shapeCache = new Map<string, THREE.Shape[]>();
function shapesFor(ch: string): THREE.Shape[] {
  const hit = shapeCache.get(ch);
  if (hit) return hit;
  const g = glyphs[ch];
  if (!g) return [];
  const path = new THREE.ShapePath();
  const p = g.p;
  for (let i = 0; i < p.length; ) {
    const c = p[i++];
    const n = () => (p[i++] as number) / UPM;
    if (c === 'M') path.moveTo(n(), n());
    else if (c === 'L') path.lineTo(n(), n());
    else if (c === 'Q') path.quadraticCurveTo(n(), n(), n(), n());
    else if (c === 'C') path.bezierCurveTo(n(), n(), n(), n(), n(), n());
  }
  const s = path.toShapes();
  shapeCache.set(ch, s);
  return s;
}

const geoCache = new Map<string, THREE.BufferGeometry>();

/** em-sized outline extruded at its real size, so board thickness is honest. */
function letterGeometry(ch: string, fs: number, depth: number, curve: number, bevel: number) {
  const key = `${ch}|${Math.round(fs)}|${depth}|${curve}|${bevel}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const k = fs / U;
  const shapes = shapesFor(ch).map((s) => {
    const scale = (pth: THREE.Path) => {
      const q = new THREE.Path();
      q.setFromPoints(pth.getPoints(curve).map((v) => new THREE.Vector2(v.x * k, v.y * k)));
      return q;
    };
    const out = new THREE.Shape(scale(s).getPoints());
    out.holes = s.holes.map((h) => scale(h));
    return out;
  });
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments: 1,
  });
  g.translate(0, 0, bevel);
  if (geoCache.size > 260) {
    const first = geoCache.keys().next().value!;
    geoCache.delete(first);
  }
  geoCache.set(key, g);
  return g;
}

const TOY = [0xff4b3e, 0xffc21a, 0x19b36b, 0x2f6bff, 0xff7ab8];

function materialsFor(style: LetterStyle, i: number): THREE.Material[] {
  switch (style) {
    case 'kraft':
      return [M.kraftFace(), M.kraftEdge()];
    case 'carbon':
      return [M.carbon(1 / 0.62), M.carbonEdge()];
    case 'metal':
      return [M.alu(), M.steel()];
    case 'gold':
      return [M.gold(), M.gold()];
    case 'wood':
      return [M.woodU(), M.solid(0xcaa56a, 0.85)];
    case 'ink':
      return [M.solid(0x1b120a, 0.78), M.kraftEdge()];
    case 'steel':
      return [M.steel(), M.darkMetal()];
    case 'foam':
      return [M.solid(0xf4f6fa, 0.75), M.solid(0xdfe4ee, 0.8)];
    case 'toy': {
      const c = TOY[i % TOY.length];
      return [M.solid(c, 0.32), M.solid(c, 0.4)];
    }
  }
}

export interface Letter {
  ch: string;
  i: number;
  mesh: THREE.Mesh;
  /** animate these freely; they are offsets in px / radians / scale */
  s: { x: number; y: number; z: number; rx: number; ry: number; rz: number; k: number };
  /** rest position relative to the stage centre, px, y up */
  hx: number;
  hy: number;
  /** centre of the glyph relative to its own origin, px */
  ox: number;
  oy: number;
}

export interface LetterOptions {
  style: LetterStyle;
  depth?: number; // px
  curve?: number; // points per curve: low = knife-cut facets
  bevel?: number; // px
  /** letters lean away from the pointer */
  shy?: number;
  /** px above the mat, for letters that lie on a sheet */
  lift?: number;
}

export class LetterStage implements Stage {
  el: HTMLElement;
  group = new THREE.Group();
  w = 0;
  h = 0;
  visible = false;
  margin = 320;
  letters: Letter[] = [];
  private opt: Required<LetterOptions>;
  private spans: HTMLElement[];
  onReady?: (l: Letter[]) => void;
  /** runs each frame before letters are placed */
  drive?: (t: number, dt: number, world: World) => void;

  constructor(el: HTMLElement, opt: LetterOptions) {
    this.el = el;
    this.opt = { depth: 42, curve: 3, bevel: 0, shy: 0, lift: 0, ...opt };
    this.spans = Array.from(el.querySelectorAll<HTMLElement>('[data-ch]'));
    this.spans.forEach((sp, i) => {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), materialsFor(this.opt.style, i));
      mesh.castShadow = mesh.receiveShadow = true;
      this.group.add(mesh);
      this.letters.push({
        ch: sp.dataset.ch!,
        i,
        mesh,
        s: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, k: 1 },
        hx: 0, hy: 0, ox: 0, oy: 0,
      });
    });
  }

  resize() {
    const host = this.el.getBoundingClientRect();
    const fs = parseFloat(getComputedStyle(this.el).fontSize);
    const depth = (this.opt.depth / U) * Math.min(1, 0.45 + fs / 480);
    const cx = host.left + host.width / 2;
    const cy = host.top + host.height / 2;
    this.spans.forEach((sp, i) => {
      const l = this.letters[i];
      const r = sp.getBoundingClientRect();
      const size = parseFloat(getComputedStyle(sp).fontSize) || fs;
      const g = letterGeometry(l.ch, size, depth, this.opt.curve, Math.min(this.opt.bevel / U, depth * 0.3));
      l.mesh.geometry = g;
      // line boxes are 1em tall, so the baseline is a fixed fraction down
      l.hx = r.left - cx;
      l.hy = -(r.top + (r.height - size) / 2 + size * BASE - cy);
      if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox!;
      l.ox = ((b.min.x + b.max.x) / 2) * U;
      l.oy = ((b.min.y + b.max.y) / 2) * U;
      if (!isFinite(l.ox)) l.ox = l.oy = 0;
    });
    if (this.onReady) {
      const f = this.onReady;
      this.onReady = undefined;
      f(this.letters);
    }
  }

  private qx = new THREE.Vector3();
  update({ t, dt, world }: { t: number; dt: number; world: World }) {
    this.drive?.(t, dt, world);
    const px = world.pointer.x * U - this.group.position.x * U;
    const py = world.pointer.y * U - this.group.position.y * U;
    for (const l of this.letters) {
      const s = l.s;
      let rx = s.rx;
      let ry = s.ry;
      let z = s.z;
      if (this.opt.shy && world.pointer.seen && !world.touch) {
        const dx = l.hx + l.ox - px;
        const dy = l.hy + l.oy - py;
        const d = Math.hypot(dx, dy);
        const f = Math.max(0, 1 - d / 260) * this.opt.shy;
        // press down under the pointer, tip the near edge
        ry += (dx / 260) * f * 0.35;
        rx -= (dy / 260) * f * 0.35;
        z -= f * 6;
      }
      const m = l.mesh;
      // rotate about the glyph centre, not its baseline origin
      this.qx.set(-l.ox / U, -l.oy / U, 0).multiplyScalar(s.k);
      m.rotation.set(rx, ry, s.rz);
      this.qx.applyEuler(m.rotation);
      m.position.set(
        (l.hx + l.ox + s.x) / U + this.qx.x,
        (l.hy + l.oy + s.y) / U + this.qx.y,
        Math.max(-0.5, z / U) + 0.004 + this.opt.lift / U,
      );
      m.scale.setScalar(Math.max(0.0001, s.k));
      m.visible = s.k > 0.002;
    }
  }

  dispose() {
    this.letters.length = 0;
  }
}
