// Landing pad with the quad on it. Used for take-off in the hero and for the
// landing at the bottom of the page.
import * as THREE from 'three';
import { clamp, lerp, smooth } from '../kit';
import { makeQuad } from '../models/quad';
import * as tex from '../textures';
import type { Stage } from '../World';

export interface PadStage extends Stage {
  /** 0 parked, 1 gone */
  p: number;
  /** extra spin-up, e.g. on hover */
  blip: number;
  /** where it leaves to, in units from the pad */
  exit: { x: number; y: number };
  /** how far it slides towards the middle while climbing */
  drift: { x: number; y: number };
  quad: ReturnType<typeof makeQuad>;
  /** how hard the air is blowing right now, 0..1 */
  wash: number;
}

function padTexture(kind: 'take' | 'land') {
  return tex.label('pad' + kind, 1024, 1024, (g) => {
    const C = 512;
    g.clearRect(0, 0, 1024, 1024);
    g.strokeStyle = '#f4f7ff';
    g.fillStyle = '#f4f7ff';
    g.lineWidth = 16;
    g.beginPath();
    g.arc(C, C, 452, 0, 7);
    g.stroke();
    g.lineWidth = 5;
    g.beginPath();
    g.arc(C, C, 420, 0, 7);
    g.stroke();
    // degree ticks
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const r1 = i % 6 ? 470 : 466;
      const r2 = i % 6 ? 482 : 502;
      g.lineWidth = i % 6 ? 4 : 8;
      g.beginPath();
      g.moveTo(C + Math.cos(a) * r1, C + Math.sin(a) * r1);
      g.lineTo(C + Math.cos(a) * r2, C + Math.sin(a) * r2);
      g.stroke();
    }
    g.fillRect(C - 150, C - 190, 62, 380);
    g.fillRect(C + 88, C - 190, 62, 380);
    g.fillRect(C - 100, C - 32, 200, 64);
    // worn paint
    g.globalCompositeOperation = 'destination-out';
    const r = tex.rng(kind === 'take' ? 5 : 11);
    for (let i = 0; i < 2600; i++) {
      g.globalAlpha = 0.15 + r() * 0.65;
      g.beginPath();
      g.arc(r() * 1024, r() * 1024, r() * 3.2, 0, 7);
      g.fill();
    }
    for (let i = 0; i < 40; i++) {
      g.globalAlpha = 0.5;
      g.lineWidth = 1 + r() * 2;
      const x = r() * 1024;
      const y = r() * 1024;
      const a = r() * 6.3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * 160 * r(), y + Math.sin(a) * 160 * r());
      g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  });
}

export function padStage(el: HTMLElement, kind: 'take' | 'land' = 'take'): PadStage {
  const group = new THREE.Group();
  const quad = makeQuad();
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshLambertMaterial({ map: padTexture(kind), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  decal.receiveShadow = true;
  decal.position.z = 0.006;
  group.add(decal, quad.group);

  // dust pushed out by the props
  const N = 90;
  const dustPos = new Float32Array(N * 3);
  const seeds = Array.from({ length: N }, () => ({ a: Math.random() * 6.283, o: Math.random(), v: 0.6 + Math.random() * 0.8, z: Math.random() }));
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dm = new THREE.PointsMaterial({
    map: tex.glow(),
    size: 0.34,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    color: 0xcfe0ff,
    blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dg, dm);
  dust.frustumCulled = false;
  group.add(dust);

  let base = 0.01;
  const s: PadStage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    margin: 1600,
    p: 0,
    blip: 0,
    exit: { x: -9, y: 7 },
    drift: { x: 3, y: 1.6 },
    quad,
    wash: 0,
    resize() {
      const d = Math.min(s.w, s.h) / 100;
      decal.scale.set(d, d, 1);
      base = (d * 0.94) / 289;
      quad.group.scale.setScalar(base);
    },
    update({ t, dt }) {
      const p = s.p;
      const spool = smooth(0.02, 0.2, p);
      const rise = smooth(0.14, 0.66, p);
      const leave = smooth(0.5, 1, p);
      quad.setRpm(clamp(spool + s.blip * 0.5));
      quad.update(dt);
      const hover = rise * (1 - leave);
      const g = quad.group;
      g.position.set(
        s.exit.x * leave * leave + Math.sin(t * 1.3) * 0.06 * hover - rise * s.drift.x,
        s.exit.y * leave * leave + Math.cos(t * 1.7) * 0.05 * hover + rise * s.drift.y,
        5.2 * base + rise * 5.2 + Math.sin(t * 2.1) * 0.06 * hover,
      );
      const b = quad.body;
      const shake = spool * (1 - rise) * 0.012;
      b.rotation.x = lerp(0, -0.42, leave) + Math.sin(t * 1.9) * 0.05 * hover + Math.sin(t * 61) * shake;
      b.rotation.y = lerp(0, -0.55, leave) + Math.sin(t * 1.5 + 1) * 0.06 * hover + Math.cos(t * 57) * shake;
      b.rotation.z = 0.42 + rise * 0.35 + leave * 0.5;
      const air = quad.rpm * (1 - smooth(0.3, 0.85, rise));
      s.wash = air;
      dm.opacity = air * 0.34;
      dust.visible = air > 0.02;
      if (dust.visible) {
        const R = (s.w / 200) * 0.9;
        for (let i = 0; i < N; i++) {
          const q = seeds[i];
          const f = (q.o + t * q.v * 0.9) % 1;
          const r = R * (0.5 + f * 3.4);
          dustPos[i * 3] = Math.cos(q.a + f * 0.5) * r;
          dustPos[i * 3 + 1] = Math.sin(q.a + f * 0.5) * r;
          dustPos[i * 3 + 2] = 0.06 + f * q.z * 0.7;
        }
        dg.attributes.position.needsUpdate = true;
      }
    },
  };
  return s;
}
