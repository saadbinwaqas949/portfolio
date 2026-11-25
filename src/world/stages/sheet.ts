// Big flat sheets that lie on the mat behind DOM content: drawing paper,
// cardboard, carbon plate, felt. They catch the lamp like everything else.
import * as THREE from 'three';
import { isLight, onTheme } from '../../lib/theme';
import { M } from '../materials';
import * as tex from '../textures';
import { cyl, mesh, outline, roundedRect } from '../kit';
import type { Stage } from '../World';

export type SheetKind = 'paper' | 'kraft' | 'carbon' | 'wood' | 'black';

export interface SheetOptions {
  kind: SheetKind;
  radius?: number; // px
  thick?: number; // px
  z?: number; // px above the mat
  screws?: boolean;
  tape?: boolean;
  /** finger joint on an edge */
  fingers?: 'left' | 'right';
  grid?: boolean;
}

function paperTexture(w: number, h: number) {
  const c = document.createElement('canvas');
  const k = Math.min(1, 2048 / Math.max(w, h));
  c.width = Math.max(2, Math.round(w * k));
  c.height = Math.max(2, Math.round(h * k));
  const g = c.getContext('2d')!;
  const day = isLight();
  g.scale(k, k);
  g.fillStyle = day ? '#f4f7fc' : '#0d131b';
  g.fillRect(0, 0, w, h);
  const r = tex.rng(3);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = day ? `rgba(40,70,140,${r() * 0.03})` : `rgba(150,190,240,${r() * 0.025})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
  }
  g.strokeStyle = day ? 'rgba(52,110,220,.13)' : 'rgba(120,180,255,.07)';
  g.lineWidth = 1;
  for (let x = (w / 2) % 20; x < w; x += 20) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  for (let y = (h / 2) % 20; y < h; y += 20) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.strokeStyle = day ? 'rgba(52,110,220,.26)' : 'rgba(120,180,255,.15)';
  for (let x = (w / 2) % 100; x < w; x += 100) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  for (let y = (h / 2) % 100; y < h; y += 100) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  // drawing border with zone marks
  g.strokeStyle = day ? '#16265f' : '#6fa8dc';
  g.lineWidth = 2.5;
  g.strokeRect(22, 22, w - 44, h - 44);
  g.lineWidth = 1;
  g.strokeRect(14, 14, w - 28, h - 28);
  const n = Math.max(2, Math.round(w / 240));
  g.font = '600 12px "Barlow Condensed", Arial';
  g.fillStyle = day ? '#16265f' : '#6fa8dc';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 1; i < n; i++) {
    const x = (w / n) * i;
    for (const y of [14, h - 22]) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 8);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function sheetStage(el: HTMLElement, o: SheetOptions): Stage {
  const group = new THREE.Group();
  let body: THREE.Mesh | null = null;
  let extras: THREE.Object3D[] = [];
  let paperMat: THREE.MeshLambertMaterial | null = null;
  const screws: THREE.Object3D[] = [];

  const s: Stage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    margin: 400,
    cover: true,
    resize() {
      const w = s.w;
      const h = s.h;
      if (!w || !h) return;
      const W = w / 100;
      const H = h / 100;
      const thick = (o.thick ?? (o.kind === 'paper' ? 1.2 : o.kind === 'kraft' ? 14 : 9)) / 100;
      body?.geometry.dispose();
      if (body) group.remove(body);
      extras.forEach((e) => group.remove(e));
      extras = [];
      screws.length = 0;

      let shape: THREE.Shape;
      if (o.fingers) {
        // finger joint: N fingers, complementary on the two sides
        const n = 7;
        const f = 0.34;
        const step = H / n;
        shape = new THREE.Shape();
        if (o.fingers === 'right') {
          shape.moveTo(-W / 2, -H / 2);
          for (let i = 0; i < n; i++) {
            const x = i % 2 ? W / 2 - f : W / 2;
            shape.lineTo(x, -H / 2 + step * i);
            shape.lineTo(x, -H / 2 + step * (i + 1));
          }
          shape.lineTo(-W / 2, H / 2);
          shape.closePath();
        } else {
          shape.moveTo(W / 2, -H / 2);
          shape.lineTo(W / 2, H / 2);
          for (let i = n - 1; i >= 0; i--) {
            const x = i % 2 ? -W / 2 - f : -W / 2;
            shape.lineTo(x, -H / 2 + step * (i + 1));
            shape.lineTo(x, -H / 2 + step * i);
          }
          shape.closePath();
        }
      } else {
        shape = roundedRect(W, H, (o.radius ?? 10) / 100);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 8 });

      let mats: THREE.Material[];
      switch (o.kind) {
        case 'paper': {
          paperMat?.map?.dispose();
          paperMat?.dispose();
          const t = paperTexture(w, h);
          t.repeat.set(1 / W, 1 / H);
          t.offset.set(0.5, 0.5);
          paperMat = new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: 0xc9d6f5, emissiveIntensity: isLight() ? 0.36 : 0.62 });
          mats = [paperMat, M.solid(isLight() ? 0xe6ecf7 : 0x1a222d, 0.9)];
          break;
        }
        case 'kraft':
          mats = isLight() ? [M.kraft(), M.kraftEdge()] : [M.kraftNight(), M.kraftNightEdge()];
          break;
        case 'carbon':
          mats = [M.carbon(1 / 0.8), M.carbonEdge()];
          break;
        case 'wood':
          mats = [M.woodU(), M.solid(0xcaa56a, 0.85)];
          break;
        default:
          mats = [M.solid(0x101319, 0.8), M.solid(0x0b0d12, 0.8)];
      }
      body = mesh(geo, mats, 0, 0, (o.z ?? 2) / 100);
      body.castShadow = true;
      if (o.kind !== 'paper') outline(body, 0x7d93ad, 0.5, 0.14);
      group.add(body);

      const top = (o.z ?? 2) / 100 + thick;
      if (o.screws) {
        for (const sx of [-1, 1])
          for (const sy of [-1, 1]) {
            const g = new THREE.Group();
            const head = cyl(0.13, 0.07, M.darkMetal(), 0, 0, 0, 24, 0.11);
            const hex = cyl(0.055, 0.01, M.solid(0x050608, 0.6), 0, 0, 0.068, 6);
            g.add(head, hex);
            g.position.set(sx * (W / 2 - 0.34), sy * (H / 2 - 0.34), top);
            group.add(g);
            extras.push(g);
            screws.push(g);
          }
      }
      if (o.tape) {
        for (const sx of [-1, 1])
          for (const sy of [-1, 1]) {
            const t = mesh(new THREE.PlaneGeometry(1.15, 0.34), M.tape(), sx * (W / 2 - 0.08), sy * (H / 2 - 0.08), top + 0.012);
            t.rotation.z = sx * sy * -0.78;
            t.castShadow = false;
            group.add(t);
            extras.push(t);
          }
      }
    },
    update({ world }) {
      // screws turn as you scroll past
      for (let i = 0; i < screws.length; i++) screws[i].rotation.z = world.worldScroll * 0.006 * (i % 2 ? 1 : -1);
    },
    dispose() {
      off();
      body?.geometry.dispose();
      paperMat?.map?.dispose();
      paperMat?.dispose();
    },
  };
  let first = true;
  const off = onTheme(() => (first ? (first = false) : s.resize?.(null as never)));
  return s;
}

