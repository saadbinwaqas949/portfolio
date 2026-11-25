// Chimera on its stand: one airframe, four lives. It morphs between car, boat,
// plane and multirotor, and the ground under it is drawn to match.
import * as THREE from 'three';
import { clamp, damp, strokes } from '../kit';
import { makeChimera } from '../models/extra';
import type { Stage } from '../World';

export type ChimeraMode = 'car' | 'boat' | 'plane' | 'quad';
export interface ChimeraStage extends Stage {
  mode: ChimeraMode;
}

export function chimeraStage(el: HTMLElement): ChimeraStage {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);
  const ch = makeChimera();
  const craft = new THREE.Group();
  craft.add(ch.group);
  rig.add(craft);

  // ---- what it stands on ------------------------------------------------------
  const fade = (l: THREE.LineSegments) => {
    const m = (l.material as THREE.ShaderMaterial).clone();
    m.uniforms = { ...(l.material as THREE.ShaderMaterial).uniforms, uGain: { value: 0 }, uRest: { value: 0 } };
    l.material = m;
    return { l, set: (v: number) => {
      m.uniforms.uGain.value = v;
      m.uniforms.uRest.value = v * 0.8;
      l.visible = v > 0.01;
    } };
  };
  const roadSeg: number[] = [];
  for (const x of [-170, 170]) roadSeg.push(x, -420, 0, x, 420, 0);
  for (let y = -480; y < 480; y += 80) roadSeg.push(0, y, 0, 0, y + 42, 0);
  const road = fade(strokes(roadSeg, 0x9fcbff));
  const water: number[] = [];
  for (let k = 0; k < 13; k++) {
    const y = -420 + k * 70;
    for (let i = 0; i < 40; i++) {
      const x = -300 + i * 15;
      const f = (q: number) => Math.sin(q * 0.045 + k * 1.7) * 9;
      water.push(x, y + f(x), 0, x + 15, y + f(x + 15), 0);
    }
  }
  const sea = fade(strokes(water, 0x5fb8ff));
  const wake: number[] = [];
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) wake.push(s * 84, -120 - k * 26, 1, s * (120 + k * 26), -260 - k * 46, 1);
  const trail = fade(strokes(wake, 0xcfe6ff));
  const streak: number[] = [];
  for (let k = 0; k < 46; k++) {
    const x = ((k * 97) % 620) - 310;
    const y = ((k * 211) % 900) - 450;
    streak.push(x, y, 0, x, y - 40 - (k % 5) * 22, 0);
  }
  const sky = fade(strokes(streak, 0x9fcbff));
  const ringSeg: number[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const b = ((i + 1) / 48) * Math.PI * 2;
    ringSeg.push(Math.cos(a), Math.sin(a), 0, Math.cos(b), Math.sin(b), 0);
  }
  const rings = [0, 1, 2].flatMap((r) =>
    [[84, 120], [-84, 120], [0, -80]].map(([x, y]) => {
      const f = fade(strokes(ringSeg, 0xffc21a));
      f.l.position.set(x, y, 0);
      return { ...f, o: r / 3 };
    }),
  );
  rig.add(road.l, sea.l, trail.l, sky.l, ...rings.map((r) => r.l));

  const w = { car: 0, boat: 0, plane: 0, quad: 1 };
  let yaw = 0.5;
  let front = 0;
  let rear = 0;

  const st: ChimeraStage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    margin: 100,
    mode: 'car',
    resize() {
      rig.scale.setScalar(Math.min(st.w / 640, st.h / 500) / 100);
      rig.position.z = 1.1;
    },
    update({ t, dt, world, cx, cy }) {
      for (const k of ['car', 'boat', 'plane', 'quad'] as const) w[k] = damp(w[k], st.mode === k ? 1 : 0, 3.4, dt);
      const px = clamp((world.lampPos.x - cx) / 5, -1, 1);
      const py = clamp((world.lampPos.y - cy) / 4, -1, 1);
      yaw = damp(yaw, 0.46 + px * 0.5 + Math.sin(t * 0.3) * 0.12, 2.6, dt);
      // look at it from above and behind
      rig.rotation.set(-0.86 + py * 0.16, 0, 0);
      const bank = w.plane * Math.sin(t * 0.9) * 0.26;
      craft.rotation.set(w.quad * Math.sin(t * 1.4) * 0.05 + w.boat * Math.sin(t * 1.9) * 0.05 - w.plane * 0.07, bank + w.boat * Math.sin(t * 1.5) * 0.06, yaw);
      const bob = w.quad * (86 + Math.sin(t * 1.7) * 14) + w.plane * (74 + Math.sin(t * 1.2) * 10) + w.boat * (46 + Math.sin(t * 1.9) * 7) + w.car * (52 + Math.sin(t * 44) * 0.7);
      craft.position.set(0, 0, bob);
      ch.tilt(clamp(w.plane + w.car * 0.0 + w.boat * 0.85));
      ch.wheels(w.car, dt * 8 * w.car);
      ch.floats(w.boat);
      front = damp(front, w.quad * 1 + w.plane * 1.1 + w.boat * 0.7 + w.car * 0.04, 3, dt);
      rear = damp(rear, w.quad * 1 + w.boat * 0.02 + w.car * 0.02, 3, dt);
      ch.rotors(front, rear, dt);
      road.set(w.car * 0.5);
      road.l.rotation.z = yaw;
      sea.set(w.boat * 0.5);
      sea.l.position.y = -((t * 46) % 70);
      trail.set(w.boat * 0.6);
      trail.l.rotation.z = yaw;
      sky.set(w.plane * 0.42);
      sky.l.rotation.z = yaw;
      sky.l.position.z = 30;
      const ry = -((t * 240) % 80);
      road.l.position.set(-Math.sin(yaw) * ry, Math.cos(yaw) * ry, 0);
      const sy = -((t * 420) % 300);
      sky.l.position.x = -Math.sin(yaw) * sy;
      sky.l.position.y = Math.cos(yaw) * sy;
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      rings.forEach((r, i) => {
        const f = (r.o + t * 0.7) % 1;
        r.set(w.quad * (1 - f) * 0.55);
        r.l.scale.setScalar(30 + f * 80);
        const [x, y] = [[84, 120], [-84, 120], [0, -80]][i % 3];
        r.l.position.set(x * c - y * s, x * s + y * c, 2);
      });
    },
  };
  return st;
}
