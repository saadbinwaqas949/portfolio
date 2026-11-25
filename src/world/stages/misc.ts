// Smaller stages: the sealed crate, spinning medals and the chip tray.
import * as THREE from 'three';
import { clamp, damp, mesh, smooth } from '../kit';
import { M } from '../materials';
import { makeBox, makeCar, makeChip, makeMedal } from '../models/robots';
import * as tex from '../textures';
import type { Stage } from '../World';

/* ------------------------------------------------------------------ */
/* Crate                                                               */
/* ------------------------------------------------------------------ */
export interface CrateStage extends Stage {
  poke(): void;
  /** 0..1 how open it should rest */
  rest: number;
}

export function crateStage(el: HTMLElement, label: string): CrateStage {
  const group = new THREE.Group();
  const b = makeBox(330, 270, 170, label);
  const box = new THREE.Group();
  box.add(b.group);
  group.add(box);
  const light = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 460),
    new THREE.MeshBasicMaterial({ map: tex.glow(), color: 0xffc85a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  light.position.z = 190;
  box.add(light);
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(310, 250), new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0, toneMapped: false }));
  inner.position.z = 120;
  box.add(inner);
  // motes that escape when it opens
  const N = 70;
  const pos = new Float32Array(N * 3);
  const seed = Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 250, y: (Math.random() - 0.5) * 190, v: 0.3 + Math.random(), o: Math.random() }));
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ map: tex.glow(), size: 0.13, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false });
  const pts = new THREE.Points(pg, pm);
  pts.frustumCulled = false;
  box.add(pts);

  let open = 0;
  let want = 0;
  let pokeT = 0;
  let shake = 0;

  const st: CrateStage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    rest: 0,
    poke() {
      pokeT = 1.5;
      shake = 1;
    },
    resize() {
      box.scale.setScalar(Math.min(st.w / 420, st.h / 380) / 100);
    },
    update({ t, dt, world, cx, cy }) {
      const d = Math.hypot(world.lampPos.x - cx, world.lampPos.y - cy);
      const near = 1 - smooth(1, 3.6, d);
      pokeT = Math.max(0, pokeT - dt);
      // something inside reacts to the light
      const knock = Math.max(0, Math.sin(t * 2.3) * Math.sin(t * 5.1)) ** 3;
      want = Math.max(st.rest, pokeT > 0 ? 0.42 : near * (0.05 + knock * 0.12));
      open = damp(open, want, pokeT > 0 ? 9 : 6, dt);
      shake = damp(shake, near * 0.45 + (pokeT > 0 ? 0.6 : 0), 5, dt);
      b.open(open);
      if (b.tape) b.tape.visible = st.rest < 0.02 && open < 0.24;
      box.position.set(Math.sin(t * 53) * 0.02 * shake, Math.cos(t * 47) * 0.02 * shake, 0.02 + knock * near * 0.12);
      box.rotation.z = -0.1 + Math.sin(t * 41) * 0.014 * shake;
      const glow = clamp(open * 2.6) * (0.8 + Math.sin(t * 19) * 0.12 + Math.sin(t * 7) * 0.08);
      (light.material as THREE.MeshBasicMaterial).opacity = glow * 0.75;
      (inner.material as THREE.MeshBasicMaterial).opacity = Math.min(1, glow * 1.4);
      pm.opacity = glow;
      for (let i = 0; i < N; i++) {
        const q = seed[i];
        const f = (q.o + t * 0.22 * q.v) % 1;
        pos[i * 3] = q.x * (0.5 + f * 1.3) + Math.sin(t * 2 + i) * 8;
        pos[i * 3 + 1] = q.y * (0.5 + f * 1.3);
        pos[i * 3 + 2] = 150 + f * 420;
      }
      pg.attributes.position.needsUpdate = true;
    },
  };
  return st;
}

/* ------------------------------------------------------------------ */
/* Medal                                                               */
/* ------------------------------------------------------------------ */
export function medalStage(el: HTMLElement, metal: 'gold' | 'silver' | 'bronze' = 'gold', ribbon = 0xd9b86a): Stage {
  const group = new THREE.Group();
  const m = makeMedal('1', metal, ribbon);
  group.add(m);
  let spin = 0;
  let vel = 0;
  let last = 0;
  const st: Stage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    resize() {
      m.scale.setScalar(((st.w / 100) * 0.98) / 110);
    },
    update({ t, dt, world, cx, cy }) {
      const d = Math.hypot(world.pointer.x - cx, world.pointer.y - cy);
      if (d < 1.5 && !world.touch) vel += (world.pointer.x - last) * 3;
      last = world.pointer.x;
      vel += world.scrollVel * 0.0006 * dt * 60 * 0.06;
      vel += -spin * 4 * dt - vel * 1.1 * dt;
      spin += vel * dt;
      m.rotation.set(-0.25 + Math.sin(t * 0.9) * 0.08, spin + Math.sin(t * 0.7) * 0.35, Math.sin(t * 0.8) * 0.06);
      m.position.set(0, -0.35, 1.0);
    },
  };
  return st;
}

/* ------------------------------------------------------------------ */
/* Chip tray: sweep the parts around                                   */
/* ------------------------------------------------------------------ */
interface Chip {
  o: THREE.Group;
  x: number;
  y: number;
  a: number;
  vx: number;
  vy: number;
  w: number;
  /** half length of the spine and radius of the capsule, px */
  hl: number;
  r: number;
  z: number;
  vz: number;
}

export interface TrayStage extends Stage {
  drop(): void;
}

export function trayStage(el: HTMLElement, items: { name: string; color: number }[]): TrayStage {
  const group = new THREE.Group();
  const K = 1.9; // px per mm
  const chips: Chip[] = items.map((it) => {
    const pins = clamp(Math.round(it.name.length * 0.85), 4, 16);
    const o = makeChip(it.name, pins);
    const w = o.userData.w as number;
    const stripe = mesh(new THREE.BoxGeometry(5, 30, 0.6), M.solid(it.color, 0.5), -w / 2 + 7, 0, 17.4);
    o.add(stripe);
    o.scale.setScalar(K / 100);
    group.add(o);
    const L = (w * K) / 2;
    const r = 24 * K;
    return { o, x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0, hl: Math.max(4, L - r * 0.7), r, z: 0, vz: 0 };
  });
  let W = 800;
  let H = 500;
  let dropped = false;
  let held: Chip | null = null;
  let hx = 0;
  let hy = 0;
  let pvx = 0;
  let pvy = 0;
  let lpx = 0;
  let lpy = 0;
  let wasDown = false;
  let k = 1;

  const place = () => {
    // loose grid, shuffled a little
    const cols = Math.max(2, Math.round(W / 320));
    chips.forEach((c, i) => {
      const cx = i % cols;
      const cy = Math.floor(i / cols);
      const rows = Math.ceil(chips.length / cols);
      c.x = ((cx + 0.5) / cols - 0.5) * W * 0.94 + Math.sin(i * 9.1) * 20;
      c.y = (0.5 - (cy + 0.5) / rows) * H * 0.9 + Math.cos(i * 5.7) * 12;
      c.a = Math.sin(i * 3.3) * 0.5;
      c.vx = c.vy = c.w = 0;
    });
  };

  const seg = (c: Chip) => {
    const dx = Math.cos(c.a) * c.hl * k;
    const dy = Math.sin(c.a) * c.hl * k;
    return [c.x - dx, c.y - dy, c.x + dx, c.y + dy] as const;
  };
  const closest = (px: number, py: number, s: readonly [number, number, number, number]) => {
    const vx = s[2] - s[0];
    const vy = s[3] - s[1];
    const l = vx * vx + vy * vy || 1;
    const u = clamp(((px - s[0]) * vx + (py - s[1]) * vy) / l);
    return [s[0] + vx * u, s[1] + vy * u] as const;
  };
  const shove = (c: Chip, px: number, py: number, nx: number, ny: number, amt: number) => {
    c.x += nx * amt;
    c.y += ny * amt;
    // off-centre pushes turn it
    const rx = px - c.x;
    const ry = py - c.y;
    c.a += ((rx * ny - ry * nx) * amt) / ((c.hl * k + c.r * k) ** 2 * 1.4);
  };

  const st: TrayStage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    margin: 80,
    drop() {
      if (dropped) return;
      dropped = true;
      chips.forEach((c, i) => {
        c.z = 500 + i * 60;
        c.vz = 0;
        c.w = (Math.random() - 0.5) * 3;
      });
    },
    resize() {
      W = st.w;
      H = st.h;
      k = clamp(W / 900, 0.56, 1);
      chips.forEach((c) => c.o.scale.setScalar((K * k) / 100));
      place();
    },
    update({ dt, world }) {
      const px = (world.pointer.x - group.position.x) * 100;
      const py = (world.pointer.y - group.position.y) * 100;
      pvx = damp(pvx, (px - lpx) / Math.max(dt, 0.008), 18, dt);
      pvy = damp(pvy, (py - lpy) / Math.max(dt, 0.008), 18, dt);
      lpx = px;
      lpy = py;
      const over = Math.abs(px) < W / 2 + 40 && Math.abs(py) < H / 2 + 40;
      const down = world.pointer.down;
      if (down && !wasDown && over) {
        for (const c of chips) {
          const q = closest(px, py, seg(c));
          if (Math.hypot(px - q[0], py - q[1]) < c.r * k) {
            held = c;
            const ca = Math.cos(-c.a);
            const sa = Math.sin(-c.a);
            hx = (px - c.x) * ca - (py - c.y) * sa;
            hy = (px - c.x) * sa + (py - c.y) * ca;
          }
        }
      }
      if (!down) held = null;
      wasDown = down;

      const sub = 2;
      const h = dt / sub;
      for (let n = 0; n < sub; n++) {
        for (const c of chips) {
          if (held === c) {
            const ca = Math.cos(c.a);
            const sa = Math.sin(c.a);
            const gx = c.x + hx * ca - hy * sa;
            const gy = c.y + hx * sa + hy * ca;
            const fx = (px - gx) * 190;
            const fy = (py - gy) * 190;
            c.vx += (fx - c.vx * 16) * h;
            c.vy += (fy - c.vy * 16) * h;
            c.w += (((gx - c.x) * fy - (gy - c.y) * fx) / 9000 - c.w * 8) * h;
          }
          c.vx *= 1 - 3.4 * h;
          c.vy *= 1 - 3.4 * h;
          c.w *= 1 - 3.8 * h;
          c.x += c.vx * h;
          c.y += c.vy * h;
          c.a += c.w * h;
          // fall
          c.vz -= 3600 * h;
          c.z += c.vz * h;
          if (c.z < 0) {
            c.z = 0;
            c.vz = c.vz < -160 ? -c.vz * 0.32 : 0;
            if (c.vz) c.w += (Math.random() - 0.5) * 1.6;
          }
        }
        // the cursor sweeps parts aside
        if (over && !held && world.pointer.seen && (!world.touch || down)) {
          for (const c of chips) {
            if (c.z > 40) continue;
            const q = closest(px, py, seg(c));
            const dx = q[0] - px;
            const dy = q[1] - py;
            const d = Math.hypot(dx, dy) || 1;
            const min = c.r * k + 20;
            if (d < min) {
              const nx = dx / d;
              const ny = dy / d;
              shove(c, q[0], q[1], nx, ny, (min - d) * 0.5);
              const along = pvx * nx + pvy * ny;
              if (along > 0) {
                c.vx += nx * along * 0.35;
                c.vy += ny * along * 0.35;
                c.w += ((q[0] - c.x) * ny - (q[1] - c.y) * nx) * along * 0.000035;
              }
            }
          }
        }
        for (let i = 0; i < chips.length; i++) {
          for (let j = i + 1; j < chips.length; j++) {
            const a = chips[i];
            const b = chips[j];
            if (Math.abs(a.z - b.z) > 60) continue;
            const reach = (a.hl + a.r + b.hl + b.r) * k;
            if (Math.abs(a.x - b.x) > reach || Math.abs(a.y - b.y) > reach) continue;
            const sa = seg(a);
            const sb = seg(b);
            // closest approach by checking each end against the other spine
            let best = 1e9;
            let p1: readonly [number, number] = [0, 0];
            let p2: readonly [number, number] = [0, 0];
            const tries: [readonly [number, number], readonly [number, number]][] = [
              [[sa[0], sa[1]], closest(sa[0], sa[1], sb)],
              [[sa[2], sa[3]], closest(sa[2], sa[3], sb)],
              [closest(sb[0], sb[1], sa), [sb[0], sb[1]]],
              [closest(sb[2], sb[3], sa), [sb[2], sb[3]]],
              [closest(b.x, b.y, sa), [b.x, b.y]],
              [[a.x, a.y], closest(a.x, a.y, sb)],
            ];
            for (const [u, v] of tries) {
              const d = Math.hypot(u[0] - v[0], u[1] - v[1]);
              if (d < best) {
                best = d;
                p1 = u;
                p2 = v;
              }
            }
            const min = (a.r + b.r) * k * 0.92;
            if (best < min) {
              const nx = (p2[0] - p1[0]) / (best || 1);
              const ny = (p2[1] - p1[1]) / (best || 1);
              const amt = (min - best) * 0.5;
              const ha = held === a ? 0.15 : 1;
              const hb = held === b ? 0.15 : 1;
              shove(a, p1[0], p1[1], -nx, -ny, amt * ha * 0.9);
              shove(b, p2[0], p2[1], nx, ny, amt * hb * 0.9);
              const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
              if (rel > 0) {
                const J = rel * 0.55;
                a.vx -= nx * J * ha;
                a.vy -= ny * J * ha;
                b.vx += nx * J * hb;
                b.vy += ny * J * hb;
              }
            }
          }
        }
        for (const c of chips) {
          const s = seg(c);
          const r = c.r * k;
          for (const e of [0, 2]) {
            const ex = s[e];
            const ey = s[e + 1];
            if (ex > W / 2 - r) {
              shove(c, ex, ey, -1, 0, ex - (W / 2 - r));
              c.vx = Math.min(c.vx, 0) - Math.abs(c.vx) * 0.2;
            }
            if (ex < -W / 2 + r) {
              shove(c, ex, ey, 1, 0, -W / 2 + r - ex);
              c.vx = Math.max(c.vx, 0) + Math.abs(c.vx) * 0.2;
            }
            if (ey > H / 2 - r) {
              shove(c, ex, ey, 0, -1, ey - (H / 2 - r));
              c.vy = Math.min(c.vy, 0);
            }
            if (ey < -H / 2 + r) {
              shove(c, ex, ey, 0, 1, -H / 2 + r - ey);
              c.vy = Math.max(c.vy, 0);
            }
          }
        }
      }
      for (const c of chips) {
        c.o.position.set(c.x / 100, c.y / 100, 0.005 + c.z / 100 + (held === c ? 0.25 : 0));
        c.o.rotation.set(0, 0, c.a);
        c.o.visible = dropped;
      }
    },
  };
  return st;
}

/* ------------------------------------------------------------------ */
/* A robot on a turntable, revving                                     */
/* ------------------------------------------------------------------ */
export function showBotStage(el: HTMLElement): Stage {
  const group = new THREE.Group();
  const car = makeCar({ chassis: 'wood', front: 'plough', battery: '3S' });
  const tilt = new THREE.Group();
  tilt.add(car.group);
  group.add(tilt);
  let spin = 0.6;
  let vel = 0.35;
  let last = 0;
  const st: Stage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    resize() {
      tilt.scale.setScalar(Math.min(st.w, st.h * 1.1) / 100 / 300);
    },
    update({ t, dt, world, cx, cy }) {
      const d = Math.hypot(world.pointer.x - cx, world.pointer.y - cy);
      if (d < 2 && !world.touch) vel += (world.pointer.x - last) * 1.6;
      last = world.pointer.x;
      vel = damp(vel, 0.35, 0.9, dt);
      spin += vel * dt;
      car.group.rotation.z = spin;
      tilt.rotation.x = -0.72 + Math.sin(t * 0.7) * 0.05;
      tilt.position.set(0, 0, 1.1);
      car.drive(260 + vel * 200, 260 - vel * 200, dt);
      car.body.position.z = Math.sin(t * 43) * 0.9;
    },
  };
  return st;
}
