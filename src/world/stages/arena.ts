// The sumo ring. Scrolls through the NERC story, then hands you the controls.
import * as THREE from 'three';
import { angleDelta, clamp, damp, lerp, smooth } from '../kit';
import { makeCar, makeDohyo, type Robot } from '../models/robots';
import * as tex from '../textures';
import type { Stage, World } from '../World';

const R = 385; // ring radius, mm
const REACH = 96; // half length of a bot where ploughs meet

interface Pose {
  x: number;
  y: number;
  a: number; // heading, radians, 0 = +x
  z: number;
  tip: number;
  v: number; // wheel speed for show
  on: boolean;
}

interface Body {
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  w: number;
  out: number; // seconds since falling out, 0 while in
}

export interface ArenaStage extends Stage {
  p: number;
  mode: 'scroll' | 'game';
  you: number;
  them: number;
  phase: 'idle' | 'count' | 'bout' | 'over';
  count: number;
  points: { a: { x: number; y: number }; b: { x: number; y: number } };
  tags: { a: number; b: number; bName: string };
  start(): void;
  stop(): void;
  onChange?: () => void;
  onHit?: (power: number) => void;
}

const seg = (p: number, a: number, b: number) => smooth(a, b, p);
const lin = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const easeIn = (t: number) => t * t * t;

export function arenaStage(el: HTMLElement): ArenaStage {
  const group = new THREE.Group();
  const ring = makeDohyo();
  const world = new THREE.Group(); // everything in mm
  world.add(ring);
  group.add(world);

  const ours = makeCar({ chassis: 'wood', front: 'plough', battery: '3S' });
  const theirs = makeCar({ chassis: 'metal', front: 'wedge', trim: 0xd42a24, battery: '4S' });
  const last = makeCar({ chassis: 'metal', front: 'wedge', trim: 0x1f56ff, battery: '4S' });
  for (const b of [ours, theirs, last]) {
    b.group.scale.setScalar(0.94);
    world.add(b.group);
  }

  // ---- sparks ----------------------------------------------------------------
  const N = 120;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const sp = Array.from({ length: N }, () => ({ x: 0, y: 0, z: -99, vx: 0, vy: 0, vz: 0, life: 0 }));
  let cursor = 0;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      map: tex.glow(),
      size: 0.2,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  pts.frustumCulled = false;
  world.add(pts);
  const burst = (x: number, y: number, n: number, power: number) => {
    for (let i = 0; i < n; i++) {
      const s = sp[cursor++ % N];
      const a = Math.random() * 6.283;
      const v = (80 + Math.random() * 420) * power;
      s.x = x;
      s.y = y;
      s.z = 34;
      s.vx = Math.cos(a) * v;
      s.vy = Math.sin(a) * v;
      s.vz = 90 + Math.random() * 260 * power;
      s.life = 0.25 + Math.random() * 0.4;
    }
  };

  const place = (r: Robot, q: Pose, t: number, dt: number) => {
    r.group.visible = q.on;
    if (!q.on) return;
    r.group.position.set(q.x, q.y, 25 + q.z);
    r.group.rotation.set(0, 0, q.a - Math.PI / 2);
    r.body.rotation.x = q.tip;
    r.body.position.z = Math.sin(t * 43 + q.x) * Math.min(1.4, Math.abs(q.v) * 0.004);
    r.drive(q.v, q.v, dt);
  };

  // ---- scroll choreography -------------------------------------------------------
  const A: Pose = { x: 0, y: 0, a: 0, z: 0, tip: 0, v: 0, on: true };
  const B: Pose = { ...A };
  const C: Pose = { ...A };

  let shake = 0;
  let lastHit = -1;
  const hitAt = (id: number, x: number, y: number, power: number) => {
    if (lastHit === id) return;
    lastHit = id;
    burst(x, y, 46, power);
    shake = 1;
    st.onHit?.(power);
  };

  function pose(p: number, t: number, dt: number) {
    const wob = Math.sin(t * 37) * 2.2;
    A.on = B.on = true;
    C.on = p > 0.72;
    A.z = B.z = C.z = A.tip = B.tip = C.tip = 0;
    A.v = B.v = C.v = 0;

    if (p < 0.4) {
      // ---- first try ----
      const inn = seg(p, 0.0, 0.1);
      A.x = lerp(-900, -168, inn);
      A.y = lerp(-160, 0, inn);
      A.a = lerp(0.35, 0, inn);
      B.x = lerp(900, 168, inn);
      B.y = lerp(160, 0, inn);
      B.a = Math.PI + lerp(0.35, 0, inn);
      A.v = B.v = inn < 1 ? 400 * (1 - inn) + 40 : 0;
      const ch = easeIn(lin(p, 0.15, 0.2));
      A.x = lerp(A.x, -REACH, ch);
      B.x = lerp(B.x, REACH, ch);
      const push = lin(p, 0.2, 0.31);
      const e = push * push * (3 - 2 * push);
      if (p > 0.2) {
        hitAt(1, 0, 0, 1.1);
        A.x = -REACH - e * 320;
        B.x = REACH - e * 320;
        A.y = Math.sin(push * 5) * 16 + wob * (1 - push);
        B.y = A.y * 0.6;
        A.a = Math.sin(push * 6) * 0.1;
        A.v = 520;
        B.v = 560;
        if (push > 0.02 && push < 0.98 && Math.random() < 0.3) burst(B.x - REACH, A.y, 2, 0.5);
      } else lastHit = lastHit === 1 ? 0 : lastHit;
      const fall = lin(p, 0.305, 0.36);
      if (fall > 0) {
        A.x -= fall * 190;
        A.z = -easeIn(Math.min(1, fall * 1.6)) * 26;
        A.tip = -Math.sin(Math.min(1, fall * 1.5) * Math.PI) * 0.5;
        B.x = lerp(B.x, -150, fall);
      }
      st.tags.bName = 'University team';
    } else if (p < 0.76) {
      // ---- second try ----
      const back = seg(p, 0.4, 0.49);
      A.x = lerp(-640, -168, back);
      A.y = lerp(-250, 0, back);
      A.a = lerp(1.0, 0, back);
      B.x = lerp(-150, 168, back);
      B.y = lerp(0, 0, back) + Math.sin(back * Math.PI) * 70;
      B.a = Math.PI;
      A.v = back < 1 ? 420 : 0;
      B.v = back < 1 ? -320 : 0;
      const ch = easeIn(lin(p, 0.53, 0.575));
      A.x = lerp(A.x, -REACH, ch);
      B.x = lerp(B.x, REACH, ch);
      const push = lin(p, 0.575, 0.67);
      const e = push * push * (3 - 2 * push);
      if (p > 0.575) {
        hitAt(2, 0, 0, 1.3);
        A.x = -REACH + e * 330;
        B.x = REACH + e * 330;
        A.y = wob * (1 - push);
        B.y = Math.sin(push * 6) * 18;
        B.a = Math.PI + Math.sin(push * 7) * 0.12;
        A.v = 600;
        B.v = 480;
        if (push > 0.02 && push < 0.98 && Math.random() < 0.3) burst(A.x + REACH, A.y, 2, 0.5);
      } else lastHit = lastHit === 2 ? 0 : lastHit;
      const fall = lin(p, 0.665, 0.72);
      if (fall > 0) {
        B.x += fall * 300;
        B.z = -easeIn(Math.min(1, fall * 1.6)) * 26;
        B.tip = -Math.sin(Math.min(1, fall * 1.5) * Math.PI) * 0.5;
        A.x = lerp(A.x, -168, fall);
        A.v = -300 * (1 - fall);
        B.on = fall < 0.96;
      }
      C.on = false;
      st.tags.bName = 'University team';
      if (p > 0.72) {
        B.on = false;
        A.x = -168;
      }
    }
    if (p >= 0.72) {
      // ---- semi-final ----
      B.on = false;
      C.on = true;
      const inn = seg(p, 0.72, 0.79);
      A.x = -168;
      A.y = 0;
      A.a = 0;
      C.x = lerp(950, 168, inn);
      C.y = lerp(-220, 0, inn);
      C.a = Math.PI - lerp(0.45, 0, inn);
      C.v = inn < 1 ? 400 : 0;
      const ch = easeIn(lin(p, 0.82, 0.855));
      A.x = lerp(A.x, -REACH, ch);
      C.x = lerp(C.x, REACH, ch);
      if (p > 0.855) {
        hitAt(3, 0, 0, 1.6);
        // locked: neither gives
        const turn = (p - 0.855) * 2.2 + Math.sin(t * 0.9) * 0.16;
        const sway = Math.sin(t * 1.7) * 26;
        A.x = -Math.cos(turn) * REACH + sway;
        A.y = -Math.sin(turn) * REACH + wob;
        A.a = turn;
        C.x = Math.cos(turn) * REACH + sway;
        C.y = Math.sin(turn) * REACH + wob;
        C.a = Math.PI + turn;
        A.v = C.v = 700;
        A.tip = C.tip = Math.sin(t * 40) * 0.012;
        if (Math.random() < 0.4) burst(sway, wob, 2, 0.55);
      } else lastHit = lastHit === 3 ? 0 : lastHit;
      st.tags.bName = 'Semi-final opponent';
    }

    place(ours, A, t, dt);
    place(theirs, B, t, dt);
    place(last, C, t, dt);
  }

  // ---- game -----------------------------------------------------------------------
  const me: Body = { x: -168, y: 0, a: 0, vx: 0, vy: 0, w: 0, out: 0 };
  const foe: Body = { x: 168, y: 0, a: Math.PI, vx: 0, vy: 0, w: 0, out: 0 };
  let clock = 0;
  let aiT = 0;
  let aiBias = 0;

  const reset = () => {
    Object.assign(me, { x: -168, y: 0, a: 0, vx: 0, vy: 0, w: 0, out: 0 });
    Object.assign(foe, { x: 168, y: 0, a: Math.PI, vx: 0, vy: 0, w: 0, out: 0 });
    st.phase = 'count';
    st.count = 3;
    clock = 0;
    st.onChange?.();
  };

  const stepBody = (b: Body, tx: number, ty: number, throttle: number, power: number, dt: number) => {
    const dx = tx - b.x;
    const dy = ty - b.y;
    const want = Math.atan2(dy, dx);
    const diff = angleDelta(b.a, want);
    b.w = damp(b.w, clamp(diff * 7, -5.4, 5.4), 14, dt);
    b.a += b.w * dt;
    const c = Math.cos(b.a);
    const s = Math.sin(b.a);
    // wheels grip sideways, drive forwards
    let fwd = b.vx * c + b.vy * s;
    let lat = -b.vx * s + b.vy * c;
    const aligned = Math.max(0.12, Math.cos(diff));
    const top = 560 * power * throttle * aligned;
    fwd = damp(fwd, top, 4.6, dt);
    lat = damp(lat, 0, 9, dt);
    b.vx = fwd * c - lat * s;
    b.vy = fwd * s + lat * c;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    return fwd;
  };

  function game(t: number, dt: number, w: World) {
    const s = world.scale.x;
    const px = (w.pointer.x - group.position.x) / s;
    const py = (w.pointer.y - group.position.y) / s;
    let fa = 0;
    let fb = 0;
    clock += dt;
    if (st.phase === 'count') {
      const c = 3 - Math.floor(clock / 0.55);
      if (c !== st.count) {
        st.count = c;
        st.onChange?.();
      }
      if (c <= 0) {
        st.phase = 'bout';
        clock = 0;
        st.onChange?.();
      }
    } else if (st.phase === 'bout') {
      const d = Math.hypot(px - me.x, py - me.y);
      fa = stepBody(me, px, py, clamp((d - 30) / 110), 1, dt);
      // the other driver: charge, sometimes feint, get smarter each time it loses
      aiT -= dt;
      if (aiT <= 0) {
        aiT = 0.35 + Math.random() * 0.5;
        aiBias = (Math.random() - 0.5) * (150 - Math.min(110, st.you * 30));
      }
      const lead = 0.12 + Math.min(0.2, st.you * 0.04);
      const tx = me.x + me.vx * lead - me.y * 0.001 * aiBias;
      const ty = me.y + me.vy * lead + aiBias * 0.6;
      const nearEdge = Math.hypot(foe.x, foe.y) > R - 120;
      fb = stepBody(foe, nearEdge ? tx * 0.4 : tx, nearEdge ? ty * 0.4 : ty, 1, 0.8 + Math.min(0.3, st.you * 0.06), dt);
      // contact
      const nx0 = foe.x - me.x;
      const ny0 = foe.y - me.y;
      const dist = Math.hypot(nx0, ny0) || 1;
      const min = 176;
      if (dist < min) {
        const nx = nx0 / dist;
        const ny = ny0 / dist;
        const over = (min - dist) / 2;
        me.x -= nx * over;
        me.y -= ny * over;
        foe.x += nx * over;
        foe.y += ny * over;
        const rel = (me.vx - foe.vx) * nx + (me.vy - foe.vy) * ny;
        if (rel > 0) {
          const j = rel * 0.56;
          me.vx -= nx * j;
          me.vy -= ny * j;
          foe.vx += nx * j;
          foe.vy += ny * j;
          if (rel > 190) {
            burst(me.x + nx * 88, me.y + ny * 88, 22, Math.min(1.2, rel / 600));
            shake = Math.min(1, rel / 700);
            st.onHit?.(rel / 700);
          }
        }
        // whoever is pointing at the other pushes harder
        const ga = Math.max(0, Math.cos(me.a) * nx + Math.sin(me.a) * ny) * Math.max(0, fa);
        const gb = Math.max(0, -Math.cos(foe.a) * nx - Math.sin(foe.a) * ny) * Math.max(0, fb);
        const net = (ga - gb) * 1.15;
        me.vx += nx * net * dt * 4;
        me.vy += ny * net * dt * 4;
        foe.vx += nx * net * dt * 6;
        foe.vy += ny * net * dt * 6;
        if (Math.random() < 0.25) burst(me.x + nx * 88, me.y + ny * 88, 1, 0.4);
      }
      const ro = Math.hypot(me.x, me.y);
      const rf = Math.hypot(foe.x, foe.y);
      if (ro > R - 6 || rf > R - 6) {
        if (rf > ro) st.you++;
        else st.them++;
        (rf > ro ? foe : me).out = 0.001;
        st.phase = 'over';
        clock = 0;
        st.onChange?.();
      }
    } else if (st.phase === 'over') {
      for (const b of [me, foe])
        if (b.out) {
          b.out += dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vx *= 1 - 2.2 * dt;
          b.vy *= 1 - 2.2 * dt;
          const d = Math.hypot(b.x, b.y) || 1;
          b.vx += (b.x / d) * 260 * dt;
          b.vy += (b.y / d) * 260 * dt;
        }
      if (clock > 1.5) reset();
    }
    const q = (b: Body, v: number): Pose => ({
      x: b.x,
      y: b.y,
      a: b.a,
      z: b.out ? -Math.min(26, b.out * 120) : 0,
      tip: b.out ? -Math.sin(Math.min(1, b.out * 2) * Math.PI) * 0.45 : 0,
      v: st.phase === 'count' ? 0 : v,
      on: true,
    });
    place(ours, q(me, fa), t, dt);
    place(last, { ...q(foe, fb), on: false }, t, dt);
    place(theirs, q(foe, fb), t, dt);
    Object.assign(A, q(me, fa));
    Object.assign(B, q(foe, fb));
    C.on = false;
    st.tags.bName = 'Robot';
  }

  const v = new THREE.Vector3();
  const st: ArenaStage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    margin: 260,
    p: 0,
    mode: 'scroll',
    you: 0,
    them: 0,
    phase: 'idle',
    count: 3,
    points: { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } },
    tags: { a: 0, b: 0, bName: 'University team' },
    start() {
      if (st.mode === 'game') return;
      st.mode = 'game';
      st.you = st.them = 0;
      reset();
    },
    stop() {
      if (st.mode === 'scroll') return;
      st.mode = 'scroll';
      st.phase = 'idle';
      st.onChange?.();
    },
    resize() {
      const d = Math.min(st.w, st.h);
      world.scale.setScalar(d / 100 / (R * 2));
    },
    update({ t, dt, world: w }) {
      const p = st.p;
      // the ring thumps down
      const drop = st.mode === 'game' ? 1 : smooth(-0.02, 0.05, p);
      ring.position.z = (1 - drop) * 900;
      ring.rotation.z = (1 - drop) * 0.8;
      if (st.mode === 'game') game(t, dt, w);
      else pose(p, t, dt);

      for (let i = 0; i < N; i++) {
        const s = sp[i];
        if (s.life > 0) {
          s.life -= dt;
          s.vz -= 900 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.z = Math.max(27, s.z + s.vz * dt);
          s.vx *= 1 - 2 * dt;
          s.vy *= 1 - 2 * dt;
        } else s.z = -999;
        pos[i * 3] = s.x;
        pos[i * 3 + 1] = s.y;
        pos[i * 3 + 2] = s.z;
        const f = Math.max(0, s.life * 2.4);
        col[i * 3] = f * 1.6;
        col[i * 3 + 1] = f * 1.0;
        col[i * 3 + 2] = f * 0.3;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      shake = damp(shake, 0, 7, dt);
      world.position.set(Math.sin(t * 71) * 0.05 * shake, Math.cos(t * 83) * 0.05 * shake, 0.01);

      group.updateMatrixWorld(true);
      ours.group.getWorldPosition(v);
      st.points.a = w.project(v);
      (C.on ? last : theirs).group.getWorldPosition(v);
      st.points.b = w.project(v);
      st.tags.a = A.on && A.z > -20 ? 1 : 0;
      st.tags.b = (C.on ? C : B).on && (C.on ? C : B).z > -20 ? 1 : 0;
    },
  };
  return st;
}
