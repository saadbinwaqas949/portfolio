// The CODShield conveyor: a parcel is packed, checked at three gates and then
// carried off by a drone.
import * as THREE from 'three';
import { box, clamp, cylX, damp, decal, lerp, mesh, smooth, outline } from '../kit';
import { onTheme } from '../../lib/theme';
import { M } from '../materials';
import { makeQuad } from '../models/quad';
import { makeBox } from '../models/robots';
import * as tex from '../textures';
import type { Stage } from '../World';

export interface BeltStage extends Stage {
  p: number;
}

/** scroll progress at which the parcel reaches and leaves each gate */
export const GATES = [
  { x: 0.4, at: 0.37, go: 0.47, label: 'ADDRESS', color: 0xffc21a },
  { x: 0.58, at: 0.53, go: 0.64, label: 'RISK', color: 0xff8a1a },
  { x: 0.76, at: 0.7, go: 0.79, label: 'CALL', color: 0x46ff8a },
];

const gateMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
onTheme((light) => gateMat.color.setHex(light ? 0xf2f4f8 : 0x2a313c));

export function beltStage(el: HTMLElement): BeltStage {
  const group = new THREE.Group();
  const labels: THREE.MeshLambertMaterial[] = [];
  let day = false;
  const paintLabels = () => labels.forEach((m) => m.color.setHex(day ? 0x16265f : 0xcfe3ff));
  onTheme((light) => {
    day = light;
    paintLabels();
  });

  // ---- belt ---------------------------------------------------------------
  const chev = tex.label('chevron', 256, 256, (g) => {
    g.fillStyle = '#16181f';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#2a2e39';
    g.lineWidth = 16;
    for (let x = -256; x < 512; x += 128) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 70, 128);
      g.lineTo(x, 256);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,.035)';
    for (let y = 0; y < 256; y += 6) g.fillRect(0, y, 256, 2);
  });
  const beltTex = chev.clone();
  beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
  beltTex.needsUpdate = true;
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ map: beltTex }));
  belt.receiveShadow = true;
  belt.position.z = 0.16;
  group.add(belt);
  const frame = new THREE.Group();
  group.add(frame);

  // ---- gates ----------------------------------------------------------------
  const gates = GATES.map((g) => {
    const o = new THREE.Group();
    const strip = new THREE.MeshBasicMaterial({ color: g.color, toneMapped: false });
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.6),
      new THREE.MeshBasicMaterial({ map: tex.glow(), color: g.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.position.z = 0.2;
    o.add(glow);
    group.add(o);
    return { ...g, o, strip, glow, heat: 0 };
  });

  // ---- parcel -----------------------------------------------------------------
  const parcel = new THREE.Group();
  const pb = makeBox(210, 170, 120);
  parcel.add(pb.group);
  const address = decal(
    104,
    66,
    tex.label('addr', 416, 264, (g, w, h) => {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#10131c';
      for (let i = 0; i < 4; i++) g.fillRect(28, 34 + i * 34, 240 - i * 34, 14);
      for (let x = 290; x < 390; x += 9) g.fillRect(x, 30, 3 + ((x * 7) % 5), 118);
      g.fillRect(28, 194, 360, 8);
      g.font = '700 46px "Barlow Condensed", Arial';
      g.fillText('COD', 30, 248);
    }),
    -34,
    -34,
    125,
  );
  const sticker = new THREE.Mesh(new THREE.CircleGeometry(17, 30), new THREE.MeshLambertMaterial({ color: 0xff9d1a, polygonOffset: true, polygonOffsetFactor: -2 }));
  sticker.position.set(66, 46, 125.4);
  const stamp = decal(
    96,
    48,
    tex.label('stampok', 384, 192, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#0b7a43';
      g.fillStyle = '#0b7a43';
      g.lineWidth = 12;
      g.strokeRect(12, 12, w - 24, h - 24);
      g.font = '700 74px "Barlow Condensed", Arial';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('CONFIRMED', w / 2, h / 2 + 4, w - 60);
    }),
    42,
    -38,
    125.6,
  );
  stamp.rotation.z = 0.22;
  parcel.add(address, sticker, stamp);
  // something to pack
  const shirt = mesh(new THREE.BoxGeometry(110, 86, 20), M.solid(0xe5322d, 0.8), 0, 0, 0);
  parcel.add(shirt);
  group.add(parcel);

  const quad = makeQuad();
  group.add(quad.group);

  let bw = 14;
  const K = 0.0056;
  let k = K;
  let lastX = 0;
  let off = 0;
  let sway = 0;

  const st: BeltStage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    margin: 200,
    p: 0,
    resize() {
      bw = st.w / 100;
      const bh = st.h / 100;
      belt.scale.set(bw + 4, bh * 0.62, 1);
      beltTex.repeat.set((bw + 4) / 1.5, 1);
      k = K * clamp(st.h / 190, 0.6, 1.1);
      frame.clear();
      for (const s of [-1, 1]) {
        frame.add(box(bw + 4, 0.16, 0.3, M.alu(), 0, s * (bh * 0.31 + 0.1), 0.02));
      }
      for (let x = -bw / 2; x < bw / 2; x += 1.4) {
        for (const s of [-1, 1]) {
          const bolt = cylX(0.05, 0.02, M.darkMetal(), x, s * (bh * 0.31 + 0.1), 0.33, 10);
          bolt.rotation.y = Math.PI / 2;
          frame.add(bolt);
        }
      }
      gates.forEach((g) => {
        g.o.position.x = (g.x - 0.5) * bw;
        g.o.scale.x = clamp(bw / 9, 0.48, 1);
        for (const c of [...g.o.children]) if (c !== g.glow) g.o.remove(c);
        const span = bh * 0.62 + 0.66;
        for (const s of [-1, 1]) g.o.add(box(0.34, 0.3, 1.25, M.darkMetal(), 0, (s * span) / 2, 0));
        g.o.add(outline(box(0.5, span + 0.34, 0.16, gateMat, 0, 0, 1.22), 0x9fcbff, 0.7, 0.3));
        for (const s of [-1, 1]) {
          const l = mesh(new THREE.BoxGeometry(0.05, span, 0.05), g.strip, s * 0.27, 0, 1.22);
          l.castShadow = false;
          g.o.add(l);
        }
        const d = decal(
          span * 0.8,
          span * 0.2,
          tex.label('gate' + g.label, 512, 128, (c, w, h) => {
            c.clearRect(0, 0, w, h);
            c.fillStyle = '#fff';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.font = '700 96px "Barlow Condensed", Arial';
            c.fillText(g.label, w / 2, h / 2 + 4);
          }),
          0,
          0,
          1.4,
        );
        d.rotation.z = Math.PI / 2;
        labels.push(d.material as THREE.MeshLambertMaterial);
        paintLabels();
        g.o.add(d);
      });
    },
    update({ t, dt }) {
      const p = st.p;
      const gx = (f: number) => (f - 0.5) * bw;
      // where along the line
      let x = lerp(gx(-0.08), gx(0.2), smooth(0.0, 0.07, p));
      let start = 0.31;
      for (const g of GATES) {
        x = lerp(x, gx(g.x), smooth(start, g.at, p));
        start = g.go;
      }
      x = lerp(x, gx(0.87), smooth(start, start + 0.06, p));
      const lift = smooth(0.89, 1, p);
      off += (x - lastX) / 1.5;
      lastX = x;
      beltTex.offset.x = -off % 1;

      const close = smooth(0.24, 0.31, p);
      pb.open(1 - close);
      const drop = smooth(0.1, 0.18, p);
      shirt.position.z = 30 + (1 - drop) * 260;
      shirt.visible = p > 0.08 && close < 0.98;
      shirt.rotation.z = (1 - drop) * 1.2 + 0.1;
      const shown = (a: number) => smooth(a, a + 0.025, p);
      const place = (o: THREE.Object3D, v: number, base: number) => {
        o.visible = v > 0.01;
        o.scale.setScalar(base * (1 + (1 - v) * 1.2));
        ((o as THREE.Mesh).material as THREE.Material).opacity = v;
      };
      (sticker.material as THREE.Material).transparent = true;
      place(address, shown(0.4), 1);
      place(sticker, shown(0.585), 1);
      place(stamp, shown(0.745), 1);

      sway = damp(sway, Math.sin(t * 1.8) * 0.06, 4, dt);
      parcel.scale.setScalar(k);
      parcel.position.set(x - lift * 2.4, lift * 5.2, 0.17 + lift * 4.6);
      parcel.rotation.set(sway * lift * 2, sway * lift * 2, Math.sin(x * 3) * 0.012 + lift * 0.4);

      // the drone comes in from the right, grips, leaves
      const arrive = smooth(0.8, 0.875, p);
      quad.group.visible = p > 0.795;
      quad.setRpm(quad.group.visible ? 1 : 0);
      quad.update(dt);
      quad.group.scale.setScalar(k * 1.05);
      quad.group.position.set(
        lerp(gx(1.15), x, arrive) - lift * 2.4,
        lerp(4.6, 0, arrive) + lift * 5.2,
        lerp(4, 130 * k + 0.32, arrive) + lift * 4.6 + Math.sin(t * 2.3) * 0.03,
      );
      quad.body.rotation.x = (1 - arrive) * 0.5 - lift * 0.3 + sway;
      quad.body.rotation.y = (1 - arrive) * -0.5 + lift * 0.35;
      quad.body.rotation.z = 0.3 + lift * 0.3;

      gates.forEach((g) => {
        const near = p > g.at - 0.02 && p < g.go + 0.01 ? 1 : 0;
        g.heat = damp(g.heat, near, 7, dt);
        (g.glow.material as THREE.MeshBasicMaterial).opacity = g.heat * (0.55 + Math.sin(t * 16) * 0.12);
        const passed = p > g.go;
        g.strip.color.setHex(passed ? 0x2fae62 : g.color);
        if (!passed) g.strip.color.multiplyScalar(0.28 + g.heat * (0.7 + Math.sin(t * 18) * 0.3));
      });
    },
  };
  return st;
}
