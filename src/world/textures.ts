// Every surface on the bench is drawn here, in code, at load time.
// No texture downloads: cardboard, carbon, wood, PCB and the hidden
// schematic layer that the lamp reveals.
import * as THREE from 'three';

type Ctx = CanvasRenderingContext2D;

/** Small deterministic random so the bench looks the same on every visit. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // software canvas: these are drawn once and uploaded, never shown
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}

function finish(
  c: HTMLCanvasElement,
  opts: { srgb?: boolean; repeat?: boolean; aniso?: number } = {},
) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opts.aniso ?? 4;
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function once(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) cache.set(key, (t = make()));
  return t;
}

/* ------------------------------------------------------------------ */
/* Cardboard                                                           */
/* ------------------------------------------------------------------ */

function paintKraft(g: Ctx, w: number, h: number, seed: number, base = '#c8a274') {
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // big soft blotches
  for (let i = 0; i < (w * h) / 9000; i++) {
    const x = r() * w, y = r() * h, s = 30 + r() * 120;
    const gr = g.createRadialGradient(x, y, 0, x, y, s);
    const dark = r() > 0.5;
    gr.addColorStop(0, dark ? 'rgba(110,74,36,.07)' : 'rgba(255,226,176,.07)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  // flutes showing through the liner
  for (let x = 0; x < w; x += 13) {
    const gr = g.createLinearGradient(x, 0, x + 13, 0);
    gr.addColorStop(0, 'rgba(90,58,24,.10)');
    gr.addColorStop(0.5, 'rgba(255,232,190,.08)');
    gr.addColorStop(1, 'rgba(90,58,24,.10)');
    g.fillStyle = gr;
    g.fillRect(x, 0, 13, h);
  }
  // fibres
  for (let i = 0; i < (w * h) / 95; i++) {
    const x = r() * w, y = r() * h, l = 2 + r() * 12, a = r() * Math.PI;
    g.strokeStyle = r() > 0.45 ? `rgba(255,228,182,${0.05 + r() * 0.13})` : `rgba(84,52,20,${0.04 + r() * 0.12})`;
    g.lineWidth = 0.5 + r() * 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
}

export const kraft = () =>
  once('kraft', () => {
    const [c, g] = canvas(1024, 1024);
    paintKraft(g, 1024, 1024, 7);
    return finish(c);
  });

/** A flattened shipping box: the hero letters are cut out of this. */
export const kraftBox = () =>
  once('kraftBox', () => {
    const W = 2048, H = 1024;
    const [c, g] = canvas(W, H);
    paintKraft(g, W, H, 21);
    const ink = 'rgba(38,22,8,.72)';
    g.strokeStyle = ink;
    g.fillStyle = ink;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    const arrows = (x: number, y: number, s: number) => {
      g.lineWidth = s * 0.1;
      for (const dx of [0, s * 0.85]) {
        g.beginPath();
        g.moveTo(x + dx, y + s);
        g.lineTo(x + dx, y);
        g.moveTo(x + dx - s * 0.28, y + s * 0.32);
        g.lineTo(x + dx, y);
        g.lineTo(x + dx + s * 0.28, y + s * 0.32);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(x - s * 0.35, y + s * 1.2);
      g.lineTo(x + s * 1.2, y + s * 1.2);
      g.stroke();
    };
    const glass = (x: number, y: number, s: number) => {
      g.lineWidth = s * 0.09;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + s * 0.1, y + s * 0.45);
      g.quadraticCurveTo(x + s * 0.4, y + s * 0.8, x + s * 0.7, y + s * 0.45);
      g.lineTo(x + s * 0.8, y);
      g.closePath();
      g.moveTo(x + s * 0.4, y + s * 0.66);
      g.lineTo(x + s * 0.4, y + s * 1.1);
      g.moveTo(x + s * 0.1, y + s * 1.14);
      g.lineTo(x + s * 0.7, y + s * 1.14);
      g.stroke();
    };
    const barcode = (x: number, y: number, w: number, h: number, seed: number) => {
      const r = rng(seed);
      let cx = x;
      while (cx < x + w) {
        const bw = 2 + r() * 7;
        g.fillRect(cx, y, bw, h);
        cx += bw + 3 + r() * 6;
      }
    };
    const text = (s: string, x: number, y: number, px: number, rot = 0) => {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.font = `700 ${px}px "Barlow Condensed", Arial Narrow, sans-serif`;
      g.fillText(s, 0, 0);
      g.restore();
    };
    arrows(150, 120, 120);
    text('FRAGILE', 330, 720, 92, -0.02);
    glass(1010, 560, 130);
    barcode(560, 170, 240, 110, 3);
    text('4S 1500', 1270, 250, 80);
    arrows(1580, 520, 130);
    text('THIS SIDE UP', 1180, 860, 74);
    barcode(1690, 160, 220, 90, 12);
    text('LAHORE', 60, 470, 70, -Math.PI / 2 + 0.02);
    glass(1930, 800, 90);
    g.strokeRect(540, 560, 250, 130);
    text('QTY 1', 575, 650, 78);
    return finish(c);
  });

/** Cut edge of corrugated board: liner, flute, liner. Repeats per layer. */
export const kraftEdge = () =>
  once('kraftEdge', () => {
    const W = 128, H = 96;
    const [c, g] = canvas(W, H);
    g.fillStyle = '#6b4824';
    g.fillRect(0, 0, W, H);
    g.lineWidth = 15;
    g.strokeStyle = '#c0925a';
    g.beginPath();
    for (let x = -8; x <= W + 8; x += 2) {
      const y = H / 2 + Math.sin((x / W) * Math.PI * 4) * (H / 2 - 17);
      x === -8 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#d3a871';
    g.fillRect(0, 0, W, 11);
    g.fillRect(0, H - 11, W, 11);
    g.fillStyle = 'rgba(60,36,12,.5)';
    g.fillRect(0, 11, W, 3);
    g.fillRect(0, H - 14, W, 3);
    return finish(c);
  });

/* ------------------------------------------------------------------ */
/* Carbon fibre, 2x2 twill                                             */
/* ------------------------------------------------------------------ */

const TWILL = 8; // cells per tile
function twillIsWarp(x: number, y: number) {
  return ((x + y) & 3) < 2;
}

export const carbonMap = () =>
  once('carbonMap', () => {
    const S = 256, cell = S / TWILL;
    const [c, g] = canvas(S, S);
    const r = rng(4);
    for (let y = 0; y < TWILL; y++)
      for (let x = 0; x < TWILL; x++) {
        const warp = twillIsWarp(x, y);
        const px = x * cell, py = y * cell;
        const gr = warp
          ? g.createLinearGradient(px, 0, px + cell, 0)
          : g.createLinearGradient(0, py, 0, py + cell);
        const hi = warp ? '#33363d' : '#22242a', lo = warp ? '#17181c' : '#0f1013';
        gr.addColorStop(0, lo);
        gr.addColorStop(0.5, hi);
        gr.addColorStop(1, lo);
        g.fillStyle = gr;
        g.fillRect(px, py, cell, cell);
        // individual filaments
        g.globalAlpha = 0.16;
        for (let i = 0; i < 7; i++) {
          g.fillStyle = r() > 0.5 ? '#6f7580' : '#000';
          if (warp) g.fillRect(px + r() * cell, py, 1, cell);
          else g.fillRect(px, py + r() * cell, cell, 1);
        }
        g.globalAlpha = 1;
      }
    return finish(c);
  });

export const carbonNormal = () =>
  once('carbonNormal', () => {
    const S = 256, cell = S / TWILL;
    const [c, g] = canvas(S, S);
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
        const fx = (x % cell) / cell - 0.5, fy = (y % cell) / cell - 0.5;
        const warp = twillIsWarp(cx, cy);
        // each tow is a little cylinder, so the lamp rolls across it
        const nx = warp ? fx * 1.1 : fx * 0.15;
        const ny = warp ? fy * 0.15 : fy * 1.1;
        const nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
        const i = (y * S + x) * 4;
        img.data[i] = (nx * 0.5 + 0.5) * 255;
        img.data[i + 1] = (-ny * 0.5 + 0.5) * 255;
        img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    return finish(c, { srgb: false });
  });

/* ------------------------------------------------------------------ */
/* Wood (popsicle sticks, plywood)                                     */
/* ------------------------------------------------------------------ */

export const wood = () =>
  once('wood', () => {
    const [c, g] = canvas(512, 256);
    const r = rng(90);
    g.fillStyle = '#e2c493';
    g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 150; i++) {
      const y = r() * 256;
      g.strokeStyle = r() > 0.5 ? `rgba(140,96,48,${0.06 + r() * 0.13})` : `rgba(255,240,208,${0.08 + r() * 0.16})`;
      g.lineWidth = 0.6 + r() * 2;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(170, y + (r() - 0.5) * 14, 340, y + (r() - 0.5) * 14, 512, y + (r() - 0.5) * 6);
      g.stroke();
    }
    return finish(c);
  });

/* ------------------------------------------------------------------ */
/* Circuit boards                                                      */
/* ------------------------------------------------------------------ */

export function pcb(key: string, base: string, trace: string, seed: number) {
  return once('pcb' + key, () => {
    const S = 512;
    const [c, g] = canvas(S, S);
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      g.strokeStyle = trace;
      g.globalAlpha = 0.35 + r() * 0.3;
      g.lineWidth = 2 + r() * 3;
      let x = Math.round((r() * S) / 16) * 16, y = Math.round((r() * S) / 16) * 16;
      let d = Math.floor(r() * 8);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        const l = 16 + r() * 90;
        x += Math.cos((d * Math.PI) / 4) * l;
        y += Math.sin((d * Math.PI) / 4) * l;
        g.lineTo(x, y);
        d += r() > 0.5 ? 1 : -1;
      }
      g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = '#d9b45a';
      g.beginPath();
      g.arc(x, y, 5, 0, 7);
      g.fill();
      g.fillStyle = '#10131a';
      g.beginPath();
      g.arc(x, y, 2.2, 0, 7);
      g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.font = '600 18px "Barlow Condensed", Arial';
    for (let i = 0; i < 16; i++) g.fillText('RCDUL'[Math.floor(r() * 5)] + Math.floor(r() * 30), r() * S, r() * S);
    return finish(c);
  });
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export function label(
  key: string,
  w: number,
  h: number,
  draw: (g: Ctx, w: number, h: number) => void,
) {
  return once('label' + key, () => {
    const [c, g] = canvas(w, h);
    draw(g, w, h);
    return finish(c, { repeat: false });
  });
}

/* ------------------------------------------------------------------ */
/* Mat surface noise: r fine grain, g knife scratches, b large blotch  */
/* ------------------------------------------------------------------ */

export const matNoise = () =>
  once('matNoise', () => {
    const S = 512;
    const [c, g] = canvas(S, S);
    const r = rng(33);
    const img = g.createImageData(S, S);
    const d = new Uint32Array(img.data.buffer);
    for (let i = 0; i < d.length; i++) d[i] = 0xff800000 | Math.floor(r() * 255);
    g.putImageData(img, 0, 0);
    // knife scratches go into green
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x = r() * S;
      const y = r() * S;
      const a = (Math.floor(r() * 4) * Math.PI) / 4 + (r() - 0.5) * 0.5;
      const l = 20 + r() * r() * 260;
      g.strokeStyle = `rgba(0,${80 + r() * 170},0,${0.25 + r() * 0.55})`;
      g.lineWidth = 0.5 + r() * 0.9;
      for (const ox of [0, -S, S])
        for (const oy of [0, -S, S]) {
          g.beginPath();
          g.moveTo(x + ox, y + oy);
          g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
          g.stroke();
        }
    }
    return finish(c, { srgb: false, aniso: 1 });
  });

/* ------------------------------------------------------------------ */
/* The hidden schematic. R = ink, G = distance along trace (for        */
/* travelling pulses), B = pads and solid parts.                       */
/* ------------------------------------------------------------------ */

export const schematic = () =>
  once('schematic', () => {
    const S = 2048;
    const [c, g] = canvas(S, S);
    const r = rng(1204);
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'lighten';
    g.lineCap = 'round';
    g.lineJoin = 'round';

    // draw inside the tile, plus a copy across a seam only when one is close
    const wrapAt = (x: number, y: number, pad: number, fn: (ox: number, oy: number) => void) => {
      const bx = -Math.floor(x / S) * S;
      const by = -Math.floor(y / S) * S;
      const lx = x + bx;
      const ly = y + by;
      const xs = [bx];
      const ys = [by];
      if (lx < pad) xs.push(bx + S);
      if (lx > S - pad) xs.push(bx - S);
      if (ly < pad) ys.push(by + S);
      if (ly > S - pad) ys.push(by - S);
      for (const ox of xs) for (const oy of ys) fn(ox, oy);
    };

    // ---- routed traces ------------------------------------------------
    const STEP = 32;
    for (let i = 0; i < 64; i++) {
      let x = Math.round((r() * S) / STEP) * STEP;
      let y = Math.round((r() * S) / STEP) * STEP;
      let d = Math.floor(r() * 4) * 2;
      let dist = r() * 600;
      const bundle = r() > 0.72 ? 3 : 1;
      const segs = 3 + Math.floor(r() * 6);
      const pts: [number, number][] = [[x, y]];
      for (let k = 0; k < segs; k++) {
        const l = STEP * (1 + Math.floor(r() * 7));
        x += Math.round(Math.cos((d * Math.PI) / 4)) * l;
        y += Math.round(Math.sin((d * Math.PI) / 4)) * l;
        pts.push([x, y]);
        d += r() > 0.5 ? 1 : -1;
      }
      for (let b = 0; b < bundle; b++) {
        const off = b * 13;
        let run = dist;
        for (let k = 1; k < pts.length; k++) {
          const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
          const len = Math.hypot(bx - ax, by - ay);
          const n = Math.max(1, Math.round(len / 10));
          for (let m = 0; m < n; m++) {
            const t0 = m / n, t1 = (m + 1) / n;
            const ph = Math.floor((((run + len * t0) % 520) / 520) * 255);
            g.strokeStyle = `rgb(255,${ph},0)`;
            g.lineWidth = bundle > 1 ? 2.2 : 3.2;
            wrapAt(ax + (bx - ax) * t0 + off, ay + (by - ay) * t0 + off, 18, (ox, oy) => {
              g.beginPath();
              g.moveTo(ax + (bx - ax) * t0 + off + ox, ay + (by - ay) * t0 + off + oy);
              g.lineTo(ax + (bx - ax) * t1 + off + ox, ay + (by - ay) * t1 + off + oy);
              g.stroke();
            });
          }
          run += len;
        }
        for (const [px, py] of [pts[0], pts[pts.length - 1]])
          wrapAt(px + off, py + off, 18, (ox, oy) => {
            g.strokeStyle = 'rgb(255,0,255)';
            g.lineWidth = 4;
            g.beginPath();
            g.arc(px + off + ox, py + off + oy, 8, 0, 7);
            g.stroke();
          });
      }
    }

    // ---- drawn parts ----------------------------------------------------
    const pen = (w = 2.4, a = 1) => {
      g.strokeStyle = `rgba(230,0,120,${a})`;
      g.fillStyle = `rgba(230,0,120,${a})`;
      g.lineWidth = w;
    };
    const at = (x: number, y: number, rot: number, s: number, fn: () => void) => {
      g.save();
      g.translate(x, y);
      g.rotate(rot);
      g.scale(s, s);
      fn();
      g.restore();
    };
    const line = (...p: number[]) => {
      g.beginPath();
      g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
      g.stroke();
    };
    const ring = (x: number, y: number, rad: number) => {
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.stroke();
    };
    const note = (s: string, x: number, y: number, px: number) => {
      g.font = `500 ${px}px "Shantell Sans Variable", "Barlow", sans-serif`;
      g.fillText(s, x, y);
    };

    const quad = () => {
      pen(3);
      for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        line(22 * sx, 22 * sy, 128 * sx, 128 * sy);
        line(34 * sx, 14 * sy, 140 * sx, 118 * sy);
        ring(136 * sx, 126 * sy, 24);
        ring(136 * sx, 126 * sy, 8);
        g.setLineDash([10, 9]);
        ring(136 * sx, 126 * sy, 96);
        g.setLineDash([]);
      }
      g.strokeRect(-34, -78, 68, 156);
      g.strokeRect(-24, -24, 48, 48);
      ring(0, -70, 12);
      pen(1.6);
      line(-136, 250, 136, 250);
      line(-136, 238, -136, 262);
      line(136, 238, 136, 262);
      note('225 mm', -44, 284, 30);
    };
    const sumo = () => {
      pen(3);
      ring(0, 0, 190);
      ring(0, 0, 172);
      line(-40, -30, -40, 30);
      line(40, -30, 40, 30);
      g.strokeRect(-96, -32, 64, 64);
      g.strokeRect(32, -32, 64, 64);
      line(-32, -36, -20, 0, -32, 36);
      line(32, -36, 20, 0, 32, 36);
      pen(1.6);
      line(-210, 0, -260, 0);
      line(-260, 0, -246, -8);
      line(-260, 0, -246, 8);
      line(210, 0, 260, 0);
      line(260, 0, 246, -8);
      line(260, 0, 246, 8);
      note('push', -40, 236, 32);
    };
    const gear = (n: number, rad: number) => {
      pen(2.6);
      g.beginPath();
      for (let i = 0; i < n * 4; i++) {
        const a = (i / (n * 4)) * Math.PI * 2;
        const rr = i % 4 < 2 ? rad : rad * 0.84;
        i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.stroke();
      ring(0, 0, rad * 0.3);
      ring(0, 0, rad * 0.58);
    };
    const chip = (pins: number, w: number, h: number, name: string) => {
      pen(2.6);
      g.strokeRect(-w / 2, -h / 2, w, h);
      for (let i = 0; i < pins; i++) {
        const x = -w / 2 + (w / pins) * (i + 0.5);
        line(x, -h / 2, x, -h / 2 - 16);
        line(x, h / 2, x, h / 2 + 16);
      }
      g.beginPath();
      g.arc(-w / 2, 0, 9, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      g.font = '600 26px "Barlow Condensed", Arial';
      g.fillText(name, -w / 2 + 22, 9);
    };
    const hbridge = () => {
      pen(2.6);
      ring(0, 0, 34);
      note('M', -12, 12, 34);
      line(-34, 0, -90, 0);
      line(34, 0, 90, 0);
      for (const s of [-1, 1]) {
        line(s * 90, -90, s * 90, 90);
        for (const v of [-1, 1]) {
          line(s * 70, v * 46, s * 110, v * 46);
          line(s * 78, v * 58, s * 102, v * 58);
          line(s * 110, v * 52, s * 140, v * 52);
        }
      }
      line(-90, -90, 90, -90);
      line(-90, 90, 90, 90);
      note('L298N', -44, -108, 28);
    };
    const lfr = () => {
      pen(6, 0.9);
      g.beginPath();
      g.moveTo(-220, 60);
      g.bezierCurveTo(-120, -120, -40, 160, 60, 0);
      g.bezierCurveTo(110, -80, 190, -60, 230, 40);
      g.stroke();
      pen(2.2);
      for (let i = -2; i <= 2; i++) ring(i * 22, -96, 8);
      g.strokeRect(-62, -116, 124, 40);
      note('e = Σ wᵢ·sᵢ', -66, -136, 30);
    };
    const pad = () => {
      pen(3);
      g.beginPath();
      g.moveTo(-120, -20);
      g.bezierCurveTo(-120, -80, 120, -80, 120, -20);
      g.bezierCurveTo(150, 90, 100, 110, 60, 50);
      g.lineTo(-60, 50);
      g.bezierCurveTo(-100, 110, -150, 90, -120, -20);
      g.stroke();
      line(-86, -8, -46, -8);
      line(-66, -28, -66, 12);
      ring(56, -22, 10);
      ring(86, -2, 10);
      ring(56, 18, 10);
      ring(26, -2, 10);
    };
    const battery = () => {
      pen(3);
      for (let i = 0; i < 4; i++) {
        line(-60 + i * 40, -40, -60 + i * 40, 40);
        line(-44 + i * 40, -20, -44 + i * 40, 20);
      }
      line(-60, 0, -120, 0);
      line(76, 0, 136, 0);
      note('4S  16.8V', -58, 84, 32);
    };
    const servo = () => {
      pen(2.6);
      g.strokeRect(-70, -30, 140, 90);
      g.strokeRect(-100, -6, 200, 14);
      ring(-30, -44, 18);
      line(-30, -44, 60, -90);
      ring(60, -90, 6);
    };
    const bracket = () => {
      pen(2.6);
      line(-110, 60, -110, -60, -90, -60, -90, 40, 90, 40, 90, 60, -110, 60);
      ring(-100, -30, 5);
      ring(40, 50, 5);
      g.setLineDash([14, 8, 3, 8]);
      line(-150, 50, 130, 50);
      g.setLineDash([]);
      pen(1.6);
      line(-110, 92, 90, 92);
      line(-110, 82, -110, 102);
      line(90, 82, 90, 102);
      note('40', -24, 124, 28);
    };

    at(380, 330, 0.12, 1, quad);
    at(1570, 560, -0.06, 1, sumo);
    at(1060, 250, 0, 1, () => gear(14, 110));
    at(1204, 356, 0.2, 1, () => gear(10, 78));
    at(860, 700, 0, 1, hbridge);
    at(300, 900, 0, 1, () => chip(14, 340, 96, 'ATmega328P'));
    at(1180, 1010, 0.05, 1.1, lfr);
    at(1720, 1180, -0.1, 1, pad);
    at(560, 1290, 0, 1, battery);
    at(250, 1620, 0.1, 1.1, sumo);
    at(920, 1600, -0.12, 1, quad);
    at(1400, 1540, 0, 1.1, bracket);
    at(1790, 1690, 0, 1, () => chip(8, 220, 90, 'F405'));
    at(1500, 1860, 0, 1, servo);
    at(1790, 170, 0.1, 1, bracket);
    at(620, 1930, 0, 1, () => gear(16, 96));
    pen(2);
    note('check polarity!', 650, 470, 36);
    note('props on last', 1380, 860, 36);
    note('works on my bench', 640, 1120, 34);
    note('CW', 80, 560, 34);
    note('CCW', 560, 110, 34);

    const t = finish(c, { srgb: false, aniso: 1 });
    return t;
  });

/* ------------------------------------------------------------------ */
/* Soft round sprite for glows and dust                                */
/* ------------------------------------------------------------------ */

export const glow = () =>
  once('glow', () => {
    const S = 128;
    const [c, g] = canvas(S, S);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,.55)');
    gr.addColorStop(0.6, 'rgba(255,255,255,.12)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    return finish(c, { repeat: false });
  });

/** Soft disc used when a propeller spins fast. */
export const propBlur = () =>
  once('propBlur', () => {
    const S = 256;
    const [c, g] = canvas(S, S);
    g.translate(S / 2, S / 2);
    const gr = g.createRadialGradient(0, 0, 8, 0, 0, 126);
    gr.addColorStop(0, 'rgba(255,255,255,.5)');
    gr.addColorStop(0.2, 'rgba(255,255,255,.16)');
    gr.addColorStop(0.72, 'rgba(255,255,255,.26)');
    gr.addColorStop(0.94, 'rgba(255,255,255,.42)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 126, 0, 7);
    g.fill();
    // the strobing ghost of three blades
    for (let b = 0; b < 3; b++) {
      for (let i = 0; i < 10; i++) {
        g.fillStyle = `rgba(255,255,255,${0.05 - i * 0.004})`;
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, 120, (b / 3) * 6.283 + i * 0.07, (b / 3) * 6.283 + 0.16 + i * 0.07);
        g.closePath();
        g.fill();
      }
    }
    return finish(c, { repeat: false });
  });
