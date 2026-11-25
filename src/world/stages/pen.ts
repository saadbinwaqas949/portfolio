// One board per robot. Each robot actually does its job on it.
import * as THREE from 'three';
import { angleDelta, box, clamp, cyl, damp, mesh, roundedRect } from '../kit';
import { M } from '../materials';
import { makeLineFollower } from '../models/lineFollower';
import { makeBall, makeCar, type Robot } from '../models/robots';
import { ribbon } from '../track';
import type { Frame, Stage } from '../World';

interface Agent {
  x: number;
  y: number;
  a: number;
  v: number;
  w: number;
}

function steer(g: Agent, tx: number, ty: number, top: number, dt: number, turn = 6, stop = 10) {
  const dx = tx - g.x;
  const dy = ty - g.y;
  const d = Math.hypot(dx, dy);
  const diff = angleDelta(g.a, Math.atan2(dy, dx));
  g.w = damp(g.w, clamp(diff * turn, -4.6, 4.6), 12, dt);
  const ahead = Math.max(0, Math.cos(diff));
  g.v = damp(g.v, d < stop ? 0 : top * ahead * Math.min(1, d / 90), 6, dt);
  g.a += g.w * dt;
  g.x += Math.cos(g.a) * g.v * dt;
  g.y += Math.sin(g.a) * g.v * dt;
  return d;
}

const SCALE = 0.0058; // units per mm inside a pen

function boardMaterial() {
  return [
    new THREE.MeshLambertMaterial({ color: 0xf3f6fb, emissive: 0xb9c8ee, emissiveIntensity: 0.16 }),
    M.solid(0xcfd8ea, 0.8),
  ];
}

export interface PenStage extends Stage {
  /** pointer is inside the pen element */
  inside: boolean;
  onGoal?: () => void;
}

export function penStage(el: HTMLElement, model: string): PenStage {
  const group = new THREE.Group();
  const mm = new THREE.Group();
  group.add(mm);
  let board: THREE.Mesh | null = null;
  let hw = 300;
  let hh = 220;

  type Step = (f: Frame, p: { x: number; y: number; near: boolean }) => void;
  let step: Step = () => {};
  let layout: () => void = () => {};

  const put = (r: Robot, g: Agent, dt: number, t: number) => {
    r.group.position.set(g.x, g.y, 0);
    r.group.rotation.z = g.a - Math.PI / 2;
    const side = g.w * 60;
    r.drive(g.v - side, g.v + side, dt);
    r.body.position.z = Math.sin(t * 40 + g.x) * Math.min(1.2, Math.abs(g.v) * 0.004);
  };
  const keepIn = (g: Agent, m: number) => {
    g.x = clamp(g.x, -hw + m, hw - m);
    g.y = clamp(g.y, -hh + m, hh - m);
  };

  const st: PenStage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    cover: true,
    margin: 60,
    inside: false,
    resize() {
      if (!st.w || !st.h) return;
      const k = SCALE * clamp(st.w / 400, 0.72, 1.15);
      mm.scale.setScalar(k);
      hw = st.w / 200 / k;
      hh = st.h / 200 / k;
      if (board) {
        board.geometry.dispose();
        mm.remove(board);
      }
      const geo = new THREE.ExtrudeGeometry(roundedRect(hw * 2, hh * 2, 22), { depth: 8, bevelEnabled: false, curveSegments: 8 });
      board = mesh(geo, boardMaterial(), 0, 0, 0);
      mm.add(board);
      layout();
    },
    update(f) {
      const { world } = f;
      const p = {
        x: (world.pointer.x - group.position.x) / mm.scale.x,
        y: (world.pointer.y - group.position.y) / mm.scale.x,
        near: false,
      };
      if (world.touch && !world.pointer.down) {
        // nobody is touching: let the wandering lamp play the cursor
        p.x = (world.lampPos.x - group.position.x) / mm.scale.x;
        p.y = (world.lampPos.y - group.position.y) / mm.scale.x;
      }
      p.near = Math.abs(p.x) < hw + 20 && Math.abs(p.y) < hh + 20;
      step(f, p);
    },
  };

  const actors = new THREE.Group();
  actors.position.z = 8;
  mm.add(actors);

  /* ---------------------------------------------------------------- */
  if (model === 'line') {
    const bot = makeLineFollower();
    bot.group.scale.setScalar(0.92);
    actors.add(bot.group);
    const tape = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ color: 0x0b0c10, side: THREE.DoubleSide }));
    tape.position.z = 0.8;
    tape.receiveShadow = true;
    tape.frustumCulled = false;
    actors.add(tape);
    let base: THREE.Vector3[] = [];
    let now: THREE.Vector3[] = [];
    let s = 0;
    let heading = 0;
    layout = () => {
      const X = hw - 74;
      const Y = hh - 64;
      const shape: [number, number][] = [
        [-1, -0.5], [-0.62, -1], [0.1, -0.78], [0.62, -1], [1, -0.4], [0.7, 0.25], [1, 0.85], [0.3, 1], [-0.1, 0.35], [-0.6, 0.95], [-1, 0.45],
      ];
      base = shape.map(([x, y]) => new THREE.Vector3(x * X, y * Y, 0));
      now = base.map((v) => v.clone());
    };
    step = ({ t, dt }, p) => {
      if (!base.length) return;
      base.forEach((b, i) => {
        let tx = b.x;
        let ty = b.y;
        if (p.near) {
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const f = Math.exp(-(dx * dx + dy * dy) / (2 * 130 * 130)) * 0.62;
          tx += dx * f;
          ty += dy * f;
        }
        now[i].x = damp(now[i].x, tx, 7, dt);
        now[i].y = damp(now[i].y, ty, 7, dt);
      });
      const curve = new THREE.CatmullRomCurve3(now, true, 'catmullrom', 0.5);
      const pts = curve.getPoints(150).map((v) => ({ x: v.x, y: v.y }));
      tape.geometry.dispose();
      tape.geometry = ribbon(pts, 20, 1, false);
      const len = curve.getLength();
      s = (s + (dt * 250) / len) % 1;
      const a = curve.getPoint(s);
      const b = curve.getPoint((s + 0.012) % 1);
      const want = Math.atan2(b.y - a.y, b.x - a.x);
      heading += angleDelta(heading, want) * (1 - Math.exp(-13 * dt));
      const wob = Math.sin(t * 11) * 0.8;
      bot.group.position.set(a.x - Math.sin(heading) * wob * 4, a.y + Math.cos(heading) * wob * 4, 0);
      bot.group.rotation.z = heading - Math.PI / 2 + wob * 0.1;
      bot.update(t, dt, 250, wob);
    };
  } else if (model === 'avoid') {
    const r = makeCar({ chassis: 'acrylic', trim: 0x1f9d58, front: 'sonar', battery: '2S' });
    actors.add(r.group);
    const g: Agent = { x: 0, y: 0, a: 0.6, v: 0, w: 0 };
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.96, 1, 40, 1, -0.42, 0.84),
        new THREE.MeshBasicMaterial({ color: 0x1b5cff, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      );
      m.position.z = 46;
      rings.push(m);
      actors.add(m);
    }
    // walls to find
    const blocks = [box(90, 34, 60, M.kraftMM(), 0, 0, 0), box(40, 100, 46, M.solid(0xff4b3e, 0.5), 0, 0, 0)];
    blocks.forEach((b) => actors.add(b));
    const at = [
      { x: 0, y: 0, r: 78 },
      { x: 0, y: 0, r: 80 },
    ];
    let turn = 1;
    let panic = 0;
    layout = () => {
      at[0].x = hw * 0.46;
      at[0].y = hh * 0.48;
      at[1].x = -hw * 0.5;
      at[1].y = -hh * 0.36;
      blocks.forEach((b, i) => b.position.set(at[i].x, at[i].y, b.position.z));
    };
    step = ({ t, dt }, p) => {
      const ahead = { x: g.x + Math.cos(g.a) * 120, y: g.y + Math.sin(g.a) * 120 };
      let blocked = Math.abs(ahead.x) > hw - 46 || Math.abs(ahead.y) > hh - 46;
      for (const o of at) if (Math.hypot(ahead.x - o.x, ahead.y - o.y) < o.r + 46) blocked = true;
      if (p.near && Math.hypot(ahead.x - p.x, ahead.y - p.y) < 120) blocked = true;
      if (blocked && panic <= 0) {
        // turn towards whichever side is open
        const probe = (s: number) => {
          const x = g.x + Math.cos(g.a + s * 1.1) * 140;
          const y = g.y + Math.sin(g.a + s * 1.1) * 140;
          let score = Math.min(hw - Math.abs(x), hh - Math.abs(y));
          for (const o of at) score = Math.min(score, Math.hypot(x - o.x, y - o.y) - o.r);
          if (p.near) score = Math.min(score, Math.hypot(x - p.x, y - p.y) - 60);
          return score;
        };
        turn = probe(1) > probe(-1) ? 1 : -1;
        panic = 0.32;
      }
      panic -= dt;
      const spin = panic > 0 || blocked;
      g.w = damp(g.w, spin ? turn * 3.6 : Math.sin(t * 0.7) * 0.5, 9, dt);
      g.v = damp(g.v, spin ? 24 : 210, 6, dt);
      g.a += g.w * dt;
      g.x += Math.cos(g.a) * g.v * dt;
      g.y += Math.sin(g.a) * g.v * dt;
      keepIn(g, 74);
      for (const o of at) {
        const dx = g.x - o.x;
        const dy = g.y - o.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < o.r + 74) {
          g.x = o.x + (dx / d) * (o.r + 74);
          g.y = o.y + (dy / d) * (o.r + 74);
        }
      }
      put(r, g, dt, t);
      const look = Math.sin(t * 3.4) * 0.6;
      if (r.extra.sonar) r.extra.sonar.rotation.z = look;
      rings.forEach((m, i) => {
        const f = (t * 0.9 + i / 4) % 1;
        m.position.set(g.x + Math.cos(g.a) * 76, g.y + Math.sin(g.a) * 76, 40);
        m.rotation.z = g.a + look;
        m.scale.setScalar(18 + f * 150);
        const mat = m.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - f) * 0.7;
        mat.color.setHex(spin ? 0xff2d20 : 0x1b5cff);
      });
    };
  } else if (model === 'soccer') {
    const r = makeCar({ chassis: 'wood', front: 'fork', battery: '3S' });
    r.group.scale.setScalar(0.86);
    actors.add(r.group);
    const ball = makeBall(21);
    actors.add(ball);
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0x35b53a }));
    pitch.receiveShadow = true;
    pitch.position.z = 0.4;
    actors.add(pitch);
    const lines = new THREE.Group();
    actors.add(lines);
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const goal = new THREE.Group();
    for (const y of [-64, 64]) goal.add(box(8, 8, 56, M.black(), 0, y, 0));
    goal.add(box(8, 136, 8, M.black(), 0, 0, 52));
    for (const y of [-64, 64]) goal.add(box(44, 6, 6, M.black(), 20, y, 0));
    actors.add(goal);
    const g: Agent = { x: -160, y: 0, a: 0, v: 0, w: 0 };
    const b = { x: 40, y: 0, vx: 0, vy: 0 };
    let cheer = 0;
    layout = () => {
      pitch.scale.set(hw * 2 - 40, hh * 2 - 40, 1);
      lines.clear();
      const bar = (w: number, h: number, x: number, y: number) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), white);
        m.position.set(x, y, 0.8);
        m.receiveShadow = true;
        lines.add(m);
      };
      bar(5, hh * 2 - 40, 0, 0);
      bar(hw * 2 - 40, 5, 0, hh - 22);
      bar(hw * 2 - 40, 5, 0, -hh + 22);
      const ring = new THREE.Mesh(new THREE.RingGeometry(58, 63, 44), white);
      ring.position.z = 0.8;
      lines.add(ring);
      goal.position.set(hw - 62, 0, 0);
    };
    step = ({ t, dt }, p) => {
      const gx = hw - 50;
      // line up behind the ball, then drive through it at the goal
      const toG = Math.atan2(-b.y, gx - b.x);
      const back = { x: b.x - Math.cos(toG) * 150, y: b.y - Math.sin(toG) * 150 };
      const behind = Math.abs(angleDelta(Math.atan2(b.y - g.y, b.x - g.x), toG)) < 0.5;
      if (cheer > 0) {
        cheer -= dt;
        g.w = damp(g.w, 7, 6, dt);
        g.v = damp(g.v, 0, 6, dt);
        g.a += g.w * dt;
        if (cheer <= 0) {
          b.x = 0;
          b.y = (Math.random() - 0.5) * hh * 0.9;
          b.vx = b.vy = 0;
        }
      } else if (behind) steer(g, b.x + Math.cos(toG) * 50, b.y + Math.sin(toG) * 50, 300, dt, 6, 4);
      else {
        const near = Math.hypot(g.x - b.x, g.y - b.y) < 190;
        const side = g.y > b.y ? 1 : -1;
        steer(g, near && g.x > back.x ? back.x - 30 : back.x, near && g.x > back.x ? b.y + side * 170 : back.y, 250, dt, 6, 12);
      }
      keepIn(g, 84);
      // contact: front pocket pushes, body bumps
      const dx = b.x - g.x;
      const dy = b.y - g.y;
      const fx = dx * Math.cos(g.a) + dy * Math.sin(g.a);
      const fy = -dx * Math.sin(g.a) + dy * Math.cos(g.a);
      if (fx > -70 && fx < 118 && Math.abs(fy) < 86) {
        if (fx > 40) {
          const sp = Math.max(g.v, 60) + 30;
          b.vx = Math.cos(g.a) * sp - Math.sin(g.a) * (fy > 60 ? 40 : fy < -60 ? -40 : -fy * 1.6);
          b.vy = Math.sin(g.a) * sp + Math.cos(g.a) * (fy > 60 ? 40 : fy < -60 ? -40 : -fy * 1.6);
          if (fx < 96) {
            b.x += Math.cos(g.a) * (96 - fx);
            b.y += Math.sin(g.a) * (96 - fx);
          }
        } else {
          const s = fy > 0 ? 1 : -1;
          b.vx += -Math.sin(g.a) * s * 260 * dt * 8;
          b.vy += Math.cos(g.a) * s * 260 * dt * 8;
        }
      }
      // you can kick it too
      if (p.near) {
        const kx = b.x - p.x;
        const ky = b.y - p.y;
        const kd = Math.hypot(kx, ky) || 1;
        if (kd < 52) {
          b.vx += (kx / kd) * 900 * dt * 4;
          b.vy += (ky / kd) * 900 * dt * 4;
        }
      }
      b.vx *= 1 - 1.5 * dt;
      b.vy *= 1 - 1.5 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (Math.abs(b.y) > hh - 44) {
        b.vy *= -0.6;
        b.y = clamp(b.y, -hh + 44, hh - 44);
      }
      if (b.x < -hw + 44) {
        b.vx *= -0.6;
        b.x = -hw + 44;
      }
      if (b.x > gx) {
        if (Math.abs(b.y) < 58 && cheer <= 0) {
          cheer = 1.5;
          st.onGoal?.();
        } else if (cheer <= 0) {
          b.vx *= -0.6;
          b.x = gx;
        }
        b.x = Math.min(b.x, hw - 40);
      }
      ball.position.set(b.x, b.y, 21);
      ball.rotation.x -= (b.vy * dt) / 21;
      ball.rotation.y += (b.vx * dt) / 21;
      put(r, g, dt, t);
    };
  } else if (model === 'bluetooth') {
    const r = makeCar({ chassis: 'acrylic', trim: 0xffc21a, front: 'none', bt: true, battery: '2S' });
    actors.add(r.group);
    const g: Agent = { x: 0, y: 0, a: 0, v: 0, w: 0 };
    const cones: THREE.Group[] = [];
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Group();
      c.add(cyl(26, 5, M.solid(0xff6a1a, 0.6), 0, 0, 0, 22));
      c.add(cyl(18, 44, M.solid(0xff6a1a, 0.6), 0, 0, 5, 22, 4));
      c.add(cyl(13.2, 10, M.white(), 0, 0, 18, 22, 10.2));
      actors.add(c);
      cones.push(c);
    }
    const where = cones.map(() => ({ x: 0, y: 0, vx: 0, vy: 0, tip: 0 }));
    let lap = 0;
    layout = () => {
      [[-0.45, -0.42], [0.45, -0.42], [0.45, 0.42], [-0.45, 0.42]].forEach(([x, y], i) => Object.assign(where[i], { x: x * hw, y: y * hh, vx: 0, vy: 0, tip: 0 }));
    };
    step = ({ t, dt, world }, p) => {
      const manual = p.near && (st.inside || world.pointer.down || world.touch);
      if (manual) steer(g, p.x, p.y, world.pointer.down ? 460 : 300, dt, 6.5, 46);
      else {
        lap += dt * 0.8;
        steer(g, Math.sin(lap) * hw * 0.62, Math.sin(lap * 2) * hh * 0.52, 250, dt);
      }
      keepIn(g, 82);
      where.forEach((c, i) => {
        const dx = c.x - g.x;
        const dy = c.y - g.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 106) {
          c.vx += (dx / d) * (106 - d) * 26 * dt + Math.cos(g.a) * g.v * dt * 5;
          c.vy += (dy / d) * (106 - d) * 26 * dt + Math.sin(g.a) * g.v * dt * 5;
          c.x += (dx / d) * (106 - d) * 0.4;
          c.y += (dy / d) * (106 - d) * 0.4;
        }
        c.vx *= 1 - 4 * dt;
        c.vy *= 1 - 4 * dt;
        c.x = clamp(c.x + c.vx * dt, -hw + 34, hw - 34);
        c.y = clamp(c.y + c.vy * dt, -hh + 34, hh - 34);
        const sp = Math.hypot(c.vx, c.vy);
        c.tip = damp(c.tip, Math.min(0.5, sp * 0.004), 8, dt);
        cones[i].position.set(c.x, c.y, 0);
        cones[i].rotation.set(-c.tip * Math.sign(c.vy || 1) * 0.8, c.tip * Math.sign(c.vx || 1) * 0.8, 0);
      });
      put(r, g, dt, t);
      const led = r.extra.led as THREE.Mesh | undefined;
      if (led) (led.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(t * (manual ? 26 : 5)) > 0 ? 0x46a6ff : 0x0c2440);
    };
  } else if (model === 'sumo1') {
    const r = makeCar({ chassis: 'card', front: 'plough', battery: '2S' });
    actors.add(r.group);
    const g: Agent = { x: -90, y: 0, a: 0, v: 0, w: 0 };
    const cans = [0, 1, 2].map((i) => {
      const c = new THREE.Group();
      c.add(cyl(24, 56, M.solid([0xe5322d, 0x1f56ff, 0x1f9d58][i], 0.3, 0.4), 0, 0, 0, 26));
      c.add(cyl(21, 3, M.alu(), 0, 0, 56, 26));
      actors.add(c);
      return { o: c, x: 0, y: 0, vx: 0, vy: 0, gone: 0 };
    });
    const drop = (c: (typeof cans)[number], i: number) => {
      c.x = (i - 1) * hw * 0.4 + (Math.random() - 0.5) * 60;
      c.y = (Math.random() - 0.5) * hh * 0.9;
      c.vx = c.vy = 0;
      c.gone = 0;
    };
    layout = () => cans.forEach(drop);
    step = ({ t, dt }, p) => {
      const live = cans.filter((c) => !c.gone);
      // push whatever is nearest the pointer, or just the nearest can
      const ref = p.near ? p : g;
      live.sort((m, n) => Math.hypot(m.x - ref.x, m.y - ref.y) - Math.hypot(n.x - ref.x, n.y - ref.y));
      const c = live[0];
      if (c) {
        const out = Math.atan2(c.y, c.x);
        const bx = c.x - Math.cos(out) * 160;
        const by = c.y - Math.sin(out) * 160;
        const lined = Math.abs(angleDelta(Math.atan2(c.y - g.y, c.x - g.x), out)) < 0.55 || Math.hypot(c.x, c.y) < 30;
        if (lined) steer(g, c.x + Math.cos(out) * 90, c.y + Math.sin(out) * 90, 320, dt, 6, 2);
        else steer(g, bx, by, 250, dt, 6, 14);
      }
      keepIn(g, 60);
      cans.forEach((k, i) => {
        if (k.gone) {
          k.gone += dt;
          if (k.gone > 1.1) drop(k, i);
        }
        const dx = k.x - g.x;
        const dy = k.y - g.y;
        const fx = dx * Math.cos(g.a) + dy * Math.sin(g.a);
        const fy = -dx * Math.sin(g.a) + dy * Math.cos(g.a);
        if (fx > 0 && fx < 136 && Math.abs(fy) < 100) {
          k.vx = Math.cos(g.a) * Math.max(g.v, 120) * 1.05;
          k.vy = Math.sin(g.a) * Math.max(g.v, 120) * 1.05;
          if (fx < 128) {
            k.x += Math.cos(g.a) * (128 - fx);
            k.y += Math.sin(g.a) * (128 - fx);
          }
        } else if (fx > -80 && fx <= 0 && Math.abs(fy) < 96) {
          const s = fy > 0 ? 1 : -1;
          k.x += -Math.sin(g.a) * s * 90 * dt;
          k.y += Math.cos(g.a) * s * 90 * dt;
        }
        k.vx *= 1 - 5 * dt;
        k.vy *= 1 - 5 * dt;
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        if (!k.gone && (Math.abs(k.x) > hw - 6 || Math.abs(k.y) > hh - 6)) k.gone = 0.001;
        const f = k.gone ? Math.min(1, k.gone * 2.4) : 0;
        k.o.position.set(k.x + k.vx * f * 0.1, k.y + k.vy * f * 0.1, -f * 70);
        k.o.rotation.set(0, f * 1.4, 0);
        k.o.scale.setScalar(k.gone > 0.5 ? Math.max(0.001, 1 - (k.gone - 0.5) * 3) : 1);
      });
      put(r, g, dt, t);
    };
  } else {
    // sumo v2: guards the middle, faces you down, lunges when you get close
    const r = makeCar({ chassis: 'metal', front: 'wedge', trim: 0xffc21a, battery: '4S' });
    actors.add(r.group);
    const g: Agent = { x: 0, y: 0, a: 0, v: 0, w: 0 };
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 80), new THREE.MeshLambertMaterial({ color: 0x0b0c10, side: THREE.DoubleSide }));
    ring.position.z = 0.6;
    ring.receiveShadow = true;
    actors.add(ring);
    let cool = 0;
    let lunge = 0;
    layout = () => ring.scale.setScalar(Math.min(hw, hh) - 22);
    step = ({ t, dt }, p) => {
      cool -= dt;
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      const R = Math.min(hw, hh) - 60;
      if (p.near && d < 260 && cool <= 0) {
        lunge = 0.42;
        cool = 1.5;
      }
      lunge -= dt;
      if (lunge > 0) {
        steer(g, p.x, p.y, 760, dt, 9, 2);
      } else if (p.near) {
        const want = Math.atan2(p.y - g.y, p.x - g.x);
        g.w = damp(g.w, clamp(angleDelta(g.a, want) * 7, -5, 5), 12, dt);
        g.a += g.w * dt;
        // creep back to the centre
        g.v = damp(g.v, 0, 8, dt);
        g.x = damp(g.x, 0, 1.6, dt);
        g.y = damp(g.y, 0, 1.6, dt);
      } else {
        g.w = damp(g.w, 1.1 + Math.sin(t) * 0.4, 4, dt);
        g.a += g.w * dt;
        g.v = damp(g.v, 0, 4, dt);
        g.x = damp(g.x, 0, 1.2, dt);
        g.y = damp(g.y, 0, 1.2, dt);
      }
      const r2 = Math.hypot(g.x, g.y);
      if (r2 > R) {
        g.x *= R / r2;
        g.y *= R / r2;
        g.v *= 0.5;
      }
      put(r, g, dt, t);
      r.body.rotation.x = lunge > 0 ? -0.05 : 0;
      if (p.near && cool < 0.3 && d < 340) r.body.position.z += Math.sin(t * 60) * 0.8;
    };
  }

  return st;
}
