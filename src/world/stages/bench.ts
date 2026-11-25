// Stages for the drone section: the exploded quad and the parking bays.
import * as THREE from 'three';
import { clamp, damp, lerp, smooth } from '../kit';
import { makeF450, makePlane, makeQuad, type Quad } from '../models/quad';
import { makeFirstFpv, makeLongRange } from '../models/extra';
import { makeBox } from '../models/robots';
import type { Stage, World } from '../World';

export interface ExplodeStage extends Stage {
  p: number;
  spin: number;
  yaw: number;
  yawVel: number;
  quad: Quad;
  /** where each named part is on screen right now */
  points: Record<string, { x: number; y: number }>;
}

export function explodeStage(el: HTMLElement): ExplodeStage {
  const q = makeQuad();
  const g = new THREE.Group();
  g.add(q.group);
  const v = new THREE.Vector3();
  const st: ExplodeStage = {
    el,
    group: g,
    w: 0,
    h: 0,
    visible: false,
    margin: 100,
    p: 0,
    spin: 0,
    yaw: 0,
    yawVel: 0,
    quad: q,
    points: {},
    resize() {
      const k = Math.min(st.w / 410, st.h / 640);
      q.group.scale.setScalar((k * 1.06) / 100);
    },
    update({ t, dt, world }) {
      const p = st.p;
      const tilt = smooth(0.1, 0.3, p) * (1 - smooth(0.82, 0.96, p));
      const ex = smooth(0.26, 0.62, p) * (1 - smooth(0.76, 0.93, p));
      q.setExplode(ex);
      q.setRpm(Math.max(st.spin, smooth(0.94, 1, p) * 0.7));
      q.update(dt);
      st.yaw += st.yawVel * dt;
      st.yawVel = damp(st.yawVel, 0, 2.4, dt);
      const b = q.body;
      b.rotation.x = lerp(0, -1.08, tilt) + Math.sin(t * 0.8) * 0.02;
      b.rotation.z = lerp(0.5, -0.5, smooth(0.05, 0.8, p)) + st.yaw + Math.sin(t * 0.5) * 0.03;
      const s = q.group.scale.x;
      // keep the cloud of parts centred while it grows upwards
      q.group.position.set(0, (-ex * 74 + 22) * s * tilt, (0.2 + tilt * 2.4 + Math.sin(t * 1.4) * 0.05) * Math.min(1, st.w / 480));
      g.updateMatrixWorld(true);
      for (const k in q.anchors) {
        q.anchors[k].getWorldPosition(v);
        st.points[k] = world.project(v);
      }
    },
  };
  return st;
}

/* ------------------------------------------------------------------ */

export interface BayStage extends Stage {
  hot: number;
}

export function bayStage(el: HTMLElement, model: string): BayStage {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  let hot = 0;
  let span = 320;
  let step: (t: number, dt: number, h: number, w: World) => void = () => {};

  if (model === 'px4' || model === 'naze') {
    const d = model === 'px4' ? makeF450({ gps: true, front: 0xd42a24, back: 0xf2f4f8 }) : makeF450({ front: 0x15171c, back: 0x15171c, props: 0xffc21a });
    inner.add(d.group);
    span = 560;
    step = (t, dt, h) => {
      d.setRpm(0.08 + h * 0.92);
      d.update(dt);
      const s = inner.scale.x;
      d.group.position.z = 14 + (h * 1.5) / s + (Math.sin(t * 2) * 0.07 * h) / s;
      d.body.rotation.z = 0.35 + Math.sin(t * 0.5 + (model === 'px4' ? 0 : 2)) * 0.08;
      d.body.rotation.x = Math.sin(t * 2.2) * 0.07 * h;
      d.body.rotation.y = Math.cos(t * 1.8) * 0.07 * h;
    };
  } else if (model === 'plane') {
    const p = makePlane();
    inner.add(p.group);
    span = 640;
    let a = 0;
    step = (t, dt, h) => {
      p.setRpm(0.15 + h * 0.85);
      p.update(dt);
      a += dt * h * 1.7;
      const s = inner.scale.x;
      const r = (150 * h) as number;
      p.group.position.set(Math.cos(a) * r - r * 0.2, Math.sin(a) * r, 70 + (h * 1.7) / s);
      p.group.rotation.z = lerp(0.5, a + Math.PI / 2 - Math.PI / 2, 0) + (h > 0.02 ? a : 0.5 * (1 - h));
      p.body.rotation.y = -h * 0.55 + Math.sin(t * 1.3) * 0.03;
    };
  } else if (model === 'fpv1' || model === 'quad5' || model === 'longrange') {
    const q = model === 'fpv1' ? makeFirstFpv() : model === 'quad5' ? makeQuad() : makeLongRange();
    inner.add(q.group);
    span = model === 'longrange' ? 430 : 400;
    const seed = model === 'fpv1' ? 1 : model === 'quad5' ? 2.4 : 4;
    let yaw = seed;
    step = (t, dt, h) => {
      q.setRpm(h);
      q.update(dt);
      yaw += dt * (0.12 + h * (model === 'longrange' ? 0.3 : 1.6));
      const s = inner.scale.x;
      q.group.position.z = 16 + (h * 1.35) / s + (Math.sin(t * 2.3 + seed) * 0.06 * h) / s;
      q.group.position.x = model === 'longrange' ? -20 : 0;
      q.body.rotation.z = yaw;
      // it carves while it spins
      q.body.rotation.x = Math.sin(t * 1.9 + seed) * 0.2 * h;
      q.body.rotation.y = Math.cos(t * 1.6 + seed) * 0.24 * h;
    };
  } else {
    // a parcel with a quad inside
    const b = makeBox(300, 250, 150, 'CLIENT');
    inner.add(b.group);
    const q = makeQuad({ props: 0xff4b3e });
    q.group.scale.setScalar(0.72);
    inner.add(q.group);
    span = 430;
    step = (t, dt, h) => {
      b.open(smooth(0.05, 0.5, h));
      q.setRpm(h);
      q.update(dt);
      q.group.position.set(0, 0, 26 + smooth(0.35, 1, h) * 230 + Math.sin(t * 2.4) * 8 * h);
      q.body.rotation.z = 0.8 + h * 0.4;
      q.group.visible = h > 0.04;
      b.group.rotation.z = -0.14 + Math.sin(t * 24) * 0.012 * (1 - Math.abs(h * 2 - 1)) * (h > 0.02 && h < 0.5 ? 1 : 0);
    };
  }

  const st: BayStage = {
    el,
    group: g,
    w: 0,
    h: 0,
    visible: false,
    hot: 0,
    resize() {
      inner.scale.setScalar((Math.min(st.w, st.h) * 0.86) / span / 100);
    },
    update({ t, dt, world, cx, cy }) {
      let want = st.hot;
      // on touch, whatever is near the middle of the screen wakes up
      if (world.touch) want = Math.max(want, 1 - clamp(Math.abs(cy) / (world.vh / 100 / 3.2)));
      hot = damp(hot, want, 3.2, dt);
      step(t, dt, hot, world);
      void cx;
    },
  };
  return st;
}
