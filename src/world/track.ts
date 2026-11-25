// The black line down the page, and the line follower that drives it.
import * as THREE from 'three';
import { angleDelta, clamp, damp } from './kit';
import * as tex from './textures';
import { makeLineFollower, type LineFollower } from './models/lineFollower';
import type { World } from './World';

interface P {
  x: number;
  y: number;
}

/** Round every corner of a polyline, then resample it evenly. */
export function roundedPath(pts: P[], radius: number, step = 8): P[] {
  pts = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 3);
  const raw: P[] = [];
  const push = (p: P) => raw.push(p);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i === 0 || i === pts.length - 1) {
      push(p);
      continue;
    }
    const a = pts[i - 1];
    const b = pts[i + 1];
    const la = Math.hypot(a.x - p.x, a.y - p.y);
    const lb = Math.hypot(b.x - p.x, b.y - p.y);
    const r = Math.min(radius, la * 0.48, lb * 0.48);
    const s = { x: p.x + ((a.x - p.x) / la) * r, y: p.y + ((a.y - p.y) / la) * r };
    const e = { x: p.x + ((b.x - p.x) / lb) * r, y: p.y + ((b.y - p.y) / lb) * r };
    const N = 12;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const u = 1 - t;
      push({
        x: u * u * s.x + 2 * u * t * p.x + t * t * e.x,
        y: u * u * s.y + 2 * u * t * p.y + t * t * e.y,
      });
    }
  }
  const out: P[] = [];
  let carry = 0;
  for (let i = 1; i < raw.length; i++) {
    const a = raw[i - 1];
    const b = raw[i];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l < 1e-4) continue;
    let d = carry;
    while (d <= l) {
      const t = d / l;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      d += step;
    }
    carry = d - l;
  }
  out.push(raw[raw.length - 1]);
  return out;
}

export function ribbon(pts: P[], width: number, scale = 0.01, flipY = true) {
  const n = pts.length;
  const pos = new Float32Array(n * 6);
  const uv = new Float32Array(n * 4);
  const nor = new Float32Array(n * 6);
  const idx: number[] = [];
  let run = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / l;
    const ny = (b.x - a.x) / l;
    const p = pts[i];
    const sy = flipY ? -1 : 1;
    pos.set(
      [
        (p.x + (nx * width) / 2) * scale, (p.y + (ny * width) / 2) * scale * sy, 0,
        (p.x - (nx * width) / 2) * scale, (p.y - (ny * width) / 2) * scale * sy, 0,
      ],
      i * 6,
    );
    nor.set([0, 0, 1, 0, 0, 1], i * 6);
    if (i) run += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    uv.set([0, run / 100, 1, run / 100], i * 4);
    if (i) {
      const k = i * 2;
      flipY ? idx.push(k - 2, k, k - 1, k - 1, k, k + 1) : idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export class Track {
  group = new THREE.Group();
  tape: THREE.Mesh;
  bot: LineFollower;
  private pts: P[] = [];
  private yMax: Float32Array = new Float32Array(0);
  private s = 0;
  private v = 0;
  private heading = -Math.PI / 2;
  private u = { uS: { value: 0 }, uTime: { value: 0 } };
  length = 0;
  enabled = true;
  /** lets the bot run on while the last section is pinned */
  bonus = 0;
  private marks = new THREE.Group();
  private sink = 0;
  private lastWs = 0;

  constructor() {
    const m = new THREE.MeshLambertMaterial({ color: 0x0b0c10, side: THREE.DoubleSide });
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vT;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvT = uv;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vT; uniform float uS, uTime;')
        .replace(
          '#include <emissivemap_fragment>',
          `float mid = 1.0 - smoothstep(0.05, 0.12, abs(vT.x - 0.5));
           float done = 1.0 - smoothstep(uS - 0.25, uS - 0.1, vT.y);
           float run = smoothstep(0.75, 1.0, fract(vT.y * 0.45 - uTime * 0.9));
           float dash = step(0.42, fract(vT.y * 2.5));
           totalEmissiveRadiance += vec3(1.0, 0.72, 0.1) * mid * dash * done * (0.35 + 0.9 * run);`,
        );
    };
    this.tape = new THREE.Mesh(new THREE.BufferGeometry(), m);
    this.tape.receiveShadow = true;
    this.tape.frustumCulled = false;
    this.bot = makeLineFollower();
    // start and finish lines
    const flag = tex.label('flag', 256, 64, (g) => {
      for (let x = 0; x < 16; x++)
        for (let y = 0; y < 4; y++) {
          g.fillStyle = (x + y) % 2 ? '#f4f7ff' : '#0b0c10';
          g.fillRect(x * 16, y * 16, 16, 16);
        }
    });
    for (let i = 0; i < 2; i++) {
      const f = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.375),
        new THREE.MeshLambertMaterial({ map: flag, polygonOffset: true, polygonOffsetFactor: -4 }),
      );
      f.receiveShadow = true;
      this.marks.add(f);
    }
    this.group.add(this.tape, this.marks, this.bot.group);
  }

  /** Collect waypoints from every [data-track] element and lay the tape. */
  build(world: World) {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-track]'));
    const pts: P[] = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const top = r.top + scrollY;
      let list: [number, number][];
      try {
        list = JSON.parse(((world.vw < 820 || world.vh < 520) && el.dataset.trackS) || el.dataset.track!);
      } catch {
        continue;
      }
      for (const [fx, fy] of list) {
        pts.push({ x: (fx - 0.5) * world.vw, y: world.toMatY(top + fy * r.height) });
      }
    }
    if (pts.length < 2) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const phone = world.vw < 820 || world.vh < 520;
    this.pts = roundedPath(pts, phone ? 34 : 90, 8);
    const g = ribbon(this.pts, phone ? 14 : 22);
    this.tape.geometry.dispose();
    this.tape.geometry = g;
    this.length = (this.pts.length - 1) * 8;
    const a = this.pts[0];
    const z = this.pts[this.pts.length - 1];
    const k = phone ? 0.62 : 1;
    this.marks.children[0].position.set(a.x / 100, -a.y / 100, 0.004);
    this.marks.children[1].position.set(z.x / 100, -z.y / 100, 0.004);
    this.marks.children.forEach((m) => m.scale.setScalar(k));
    // running maximum of y: lets us ask "how far along is the bot allowed to be"
    this.yMax = new Float32Array(this.pts.length);
    let m = -Infinity;
    for (let i = 0; i < this.pts.length; i++) {
      m = Math.max(m, this.pts[i].y);
      this.yMax[i] = m;
    }
    this.bot.group.scale.setScalar(phone ? 0.0047 : 0.0086);
  }

  private targetS(y: number) {
    let lo = 0;
    let hi = this.yMax.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.yMax[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    return lo * 8;
  }

  private at(s: number): P {
    const f = clamp(s / 8, 0, this.pts.length - 1.001);
    const i = Math.floor(f);
    const t = f - i;
    const a = this.pts[i];
    const b = this.pts[Math.min(i + 1, this.pts.length - 1)];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** Bot position in client px, used by the cat and by section triggers. */
  client = { x: 0, y: 0 };

  update(world: World, dt: number) {
    if (this.pts.length < 3 || !this.enabled) return;
    const ws = world.worldScroll;
    this.tape.position.set(0, (ws + world.vh / 2) / 100, 0.012);
    this.marks.position.copy(this.tape.position);

    const jumped = Math.abs(ws - this.lastWs) > world.vh * 1.6;
    this.lastWs = ws;
    const goal = this.targetS(ws + world.vh * (0.62 + this.bonus * 0.4));
    if (jumped) {
      this.s = goal;
      this.v = 0;
    } else {
      const want = clamp((goal - this.s) * 5.2, -2600, 2600);
      this.v = damp(this.v, want, 9, dt);
      this.s = clamp(this.s + this.v * dt, 0, this.length);
    }
    const p = this.at(this.s);
    const q = this.at(this.s + 14);
    const dir = Math.atan2(-(q.y - p.y), q.x - p.x);
    this.heading += angleDelta(this.heading, dir) * (1 - Math.exp(-14 * dt));
    // a real line follower never drives straight
    const wob = Math.sin(this.s * 0.05) * Math.min(1, Math.abs(this.v) / 300);
    const nx = -Math.sin(this.heading);
    const ny = Math.cos(this.heading);
    const x = (p.x + nx * wob * 4) / 100;
    const y = (-p.y + ws + world.vh / 2 + ny * wob * 4) / 100;
    const b = this.bot;
    const cx = x * 100 + world.vw / 2;
    const cy = -y * 100 + world.vh / 2;
    this.sink = damp(this.sink, world.covered(cx, cy, 34) ? 1 : 0, 9, dt);
    b.group.position.set(x, y, -this.sink * 1.1);
    b.group.visible = this.sink < 0.97;
    b.group.rotation.z = this.heading - Math.PI / 2 + wob * 0.1;
    b.update(world.t, dt, this.v, wob);
    this.client.x = x * 100 + world.vw / 2;
    this.client.y = -y * 100 + world.vh / 2;
    this.u.uS.value = this.s / 100;
    this.u.uTime.value = world.t;
  }
}
