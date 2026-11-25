// The newer machines: race car, Chimera, metal sumo, big quad, first FPV
// quad and the walking robot. Millimetres, +x right, +y forward, +z up.
import * as THREE from 'three';
import { bake, box, circlePath, cyl, cylX, group, keep, mesh, plate, rbox, roundedRect, strokes, wire } from '../kit';
import { M } from '../materials';
import { makeMotor, makeProp, makeQuad, type Quad } from './quad';
import { makeCar, type CarOptions, type Robot } from './robots';

/** Cylinder lying along y. */
function cylY(r: number, len: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 20, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, len, seg);
  return mesh(g, mat, x, y, z);
}

/* ------------------------------------------------------------------ */
/* Sumo, the all-metal one                                             */
/* ------------------------------------------------------------------ */
export function makeMetalSumo(o: CarOptions = {}): Robot {
  const r = makeCar({ chassis: 'metal', front: 'wedge', trim: 0xe5322d, battery: '4S', ...o });
  const g = group();
  // steel side plates with bolt holes, four gear motors standing up
  for (const sx of [-1, 1]) {
    g.add(box(4, 150, 40, M.steel(), sx * 55, 0, 8));
    for (const y of [-58, -20, 20, 58]) g.add(cylX(4.4, 3, M.darkMetal(), sx * 58.4, y, 30, 6));
    for (const sy of [-1, 1]) {
      g.add(box(30, 34, 24, M.steel(), sx * 36, sy * 46, 32));
      g.add(cyl(15.5, 52, M.alu(), sx * 36, sy * 46, 56, 26));
      g.add(cyl(15.5, 5, M.solid(0xe9dfc2, 0.6), sx * 36, sy * 46, 108, 26));
      g.add(cyl(4, 5, M.darkMetal(), sx * 36, sy * 46, 113, 10));
    }
  }
  g.add(box(106, 4, 34, M.steel(), 0, -74, 10));
  bake(g);
  r.body.add(g);
  return r;
}

/* ------------------------------------------------------------------ */
/* Race Pakistan car                                                   */
/* ------------------------------------------------------------------ */
/** Half width, underside and top of the body along the car, nose to tail. */
const BODY: [number, number, number, number][] = [
  // x, half width, z low, z high
  [104, 3, 8, 11],
  [96, 7, 7, 14],
  [80, 9.5, 6, 18],
  [62, 11, 6, 23],
  [44, 15, 5.5, 30],
  [24, 19.5, 5, 41],
  [4, 21.5, 5, 50],
  [-14, 21.5, 5, 53],
  [-34, 20, 6, 51.5],
  [-54, 16.5, 9, 47],
  [-74, 13.5, 14, 43],
  [-92, 12, 18, 41.5],
  [-97, 11.4, 18.6, 41],
];
const cr = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

/** The body at any x: [half width, low, high]. */
export function carSection(x: number): [number, number, number] {
  const n = BODY.length;
  if (x >= BODY[0][0] || x <= BODY[n - 1][0]) return [0, 14, 14];
  let i = 0;
  while (i < n - 2 && x < BODY[i + 1][0]) i++;
  const t = (BODY[i][0] - x) / (BODY[i][0] - BODY[i + 1][0]);
  const g = (k: number) => cr(BODY[Math.max(0, i - 1)][k], BODY[i][k], BODY[i + 1][k], BODY[Math.min(n - 1, i + 2)][k], t);
  return [g(1), g(2), g(3)];
}

function carRing(x: number, m: number, out: THREE.Vector3[]) {
  const [w, lo, hi] = carSection(x);
  const c = (lo + hi) / 2;
  const h = (hi - lo) / 2;
  for (let j = 0; j < m; j++) {
    const a = (j / m) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // superellipse: flat floor, rounded shoulders
    const e = sa < 0 ? 0.5 : 0.8;
    out.push(new THREE.Vector3(x, Math.sign(ca) * Math.abs(ca) ** 0.72 * w, c + Math.sign(sa) * Math.abs(sa) ** e * h));
  }
}

/** A five-spoke wheel like the one in the CAD. Axis along y. */
export function raceWheel() {
  const g = group();
  const rim = new THREE.Shape();
  rim.absarc(0, 0, 15, 0, Math.PI * 2, false);
  rim.holes.push(circlePath(13.1));
  g.add(plate(rim, 17, M.solid(0xc7ced8, 0.36, 0.5), -8.5, 0, 22));
  const hub = new THREE.Shape();
  hub.absarc(0, 0, 4, 0, Math.PI * 2, false);
  hub.holes.push(circlePath(2));
  g.add(plate(hub, 17, M.alu(), -8.5, 0, 14));
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Shape();
    // a curved blade from hub to rim, thin in the middle
    s.moveTo(3.4, -1.5);
    s.quadraticCurveTo(8, -0.6, 13.2, -4.4);
    s.lineTo(13.4, 2.6);
    s.quadraticCurveTo(8.4, 1.6, 3.4, 1.7);
    s.closePath();
    const p = plate(s, 9, M.solid(0x16a37a, 0.42), -4.5, 0, 8);
    p.rotation.z = (i / 5) * Math.PI * 2;
    g.add(p);
  }
  bake(g);
  const w = group(g);
  g.rotation.x = Math.PI / 2;
  return keep(w);
}

export interface RaceCar {
  group: THREE.Group;
  wheels: THREE.Object3D[];
}

export function makeRaceCar(): RaceCar {
  const car = group();
  const still = group();
  // ---- body, lofted --------------------------------------------------------
  const N = 46;
  const Mr = 28;
  const v: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) carRing(103.9 - (i / N) * 200.8, Mr, v);
  const pos: number[] = [];
  v.forEach((p) => pos.push(p.x, p.y, p.z));
  const idx: number[] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < Mr; j++) {
      const a = i * Mr + j;
      const b = i * Mr + ((j + 1) % Mr);
      idx.push(a, a + Mr, b, b, a + Mr, b + Mr);
    }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bg.setIndex(idx);
  bg.computeVertexNormals();
  const body = mesh(bg, new THREE.MeshStandardMaterial({ color: 0x39424f, roughness: 0.3, metalness: 0.3 }));
  car.add(body);
  // its drawing: sections and flow lines, like the wireframe in CAD
  const seg: number[] = [];
  const push = (a: THREE.Vector3, b: THREE.Vector3) => seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (let i = 0; i <= N; i += 3) for (let j = 0; j < Mr; j++) push(v[i * Mr + j], v[i * Mr + ((j + 1) % Mr)]);
  for (let j = 0; j < Mr; j += 4) for (let i = 0; i < N; i++) push(v[i * Mr + j], v[(i + 1) * Mr + j]);
  car.add(strokes(seg, 0x9fcbff, 0.5, 0.14));
  // an accent line along the shoulder
  const acc: number[] = [];
  for (const side of [1, -1])
    for (let i = 4; i < N - 3; i++) {
      const j = side > 0 ? 3 : Mr / 2 - 3;
      const a = v[i * Mr + j];
      const b = v[(i + 1) * Mr + j];
      acc.push(a.x, a.y * 1.01, a.z + 0.3, b.x, b.y * 1.01, b.z + 0.3);
    }
  car.add(strokes(acc, 0xffc21a, 0.95, 0.85));

  // ---- wings ---------------------------------------------------------------
  const foil = (chord: number, t: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(chord * 0.1, t * 1.2, chord * 0.5, t, chord, 0);
    s.bezierCurveTo(chord * 0.5, t * 0.28, chord * 0.1, -t * 0.3, 0, 0);
    return s;
  };
  const wing = (chord: number, t: number, span: number, x: number, z: number, pitch: number) => {
    const p = plate(foil(chord, t), span, M.solid(0xe5322d, 0.35), 0, 0, 16);
    const w = group(p);
    // shape x is chordwise, its y is up, and the extrusion is the span
    p.rotation.x = Math.PI / 2;
    p.position.set(0, span / 2, 0);
    w.rotation.y = pitch;
    w.position.set(x, 0, z);
    return w;
  };
  still.add(wing(20, 3.4, 76, 84, 6.5, 0.06));
  still.add(wing(22, 3.8, 58, -98, 58, 0.12));
  for (const s of [-1, 1]) {
    still.add(box(20, 1.4, 9, M.solid(0xe5322d, 0.4), 94, s * 38, 4));
    still.add(box(24, 1.4, 13, M.solid(0xe5322d, 0.4), -87, s * 29, 52));
    still.add(box(12, 2, 18, M.solid(0x20262f, 0.5), -86, s * 8, 40));
  }
  // axles, tether guides, the mouth of the CO2 chamber
  for (const x of [66, -64]) {
    const ax = cylY(1.5, 60, M.steel(), x, 0, 15, 10);
    still.add(ax);
  }
  for (const x of [50, -70]) still.add(box(6, 6, 3, M.darkMetal(), x, 0, 2.4));
  const mouth = cylX(9.6, 4, M.solid(0x050608, 0.8), -96.5, 0, 30, 26);
  still.add(mouth);
  bake(still);
  car.add(still);

  const wheels: THREE.Object3D[] = [];
  for (const x of [66, -64])
    for (const s of [-1, 1]) {
      const w = raceWheel();
      w.position.set(x, s * 33, 15);
      car.add(w);
      wheels.push(w);
    }
  return { group: car, wheels };
}

/* ------------------------------------------------------------------ */
/* Chimera                                                             */
/* ------------------------------------------------------------------ */
export interface Chimera {
  group: THREE.Group;
  /** front rotors: 0 up (hover), 1 forward (cruise) */
  tilt(v: number): void;
  /** wheels: 0 tucked, 1 down */
  wheels(v: number, spin: number): void;
  /** floats: 0 gone, 1 down */
  floats(v: number): void;
  rotors(front: number, rear: number, dt: number): void;
}

/** Chord back along -y, thickness up, span along -x. */
const AERO = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0));

export function makeChimera(): Chimera {
  const g = group();
  const frame = group();
  const blue = M.solid(0x2c466e, 0.42, 0.2);
  const pale = M.solid(0x8fb7d8, 0.5);
  const dark = M.solid(0x23272e, 0.6);
  const grey = M.solid(0x8d949e, 0.55);
  const foil = (chord: number, t: number) => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(chord * 0.04, t * 1.1, chord * 0.42, t * 1.15, chord, 0);
    s.bezierCurveTo(chord * 0.55, -t * 0.1, chord * 0.1, -t * 0.36, 0, 0);
    return s;
  };
  // wing: chord along -y, span along x
  const aero = (chord: number, t: number, span: number, mat: THREE.Material, y: number, z: number) => {
    const p = plate(foil(chord, t), span, mat, 0, 0, 18);
    const w = group(p);
    p.quaternion.setFromRotationMatrix(AERO);
    p.position.set(span / 2, 0, 0);
    w.position.set(0, y, z);
    return w;
  };
  frame.add(aero(62, 11, 400, blue, 30, 0));
  frame.add(aero(44, 8, 236, dark, -156, 2));
  for (const s of [-1, 1]) {
    frame.add(cylY(5, 190, M.solid(0x1d3fa8, 0.4, 0.3), s * 84, -70, 2));
    frame.add(cylY(4.4, 92, s > 0 ? pale : M.solid(0xdfe6ee, 0.5), s * 84, 74, 2));
    frame.add(rbox(44, 60, 16, 6, pale, s * 84, -2, -3, 1.5));
    const fin = new THREE.Shape();
    fin.moveTo(-20, 0);
    fin.lineTo(22, 0);
    fin.lineTo(14, 54);
    fin.lineTo(-12, 54);
    fin.closePath();
    const f = plate(fin, 12, grey, -6, 1.2, 4);
    const fg = group(f);
    f.quaternion.setFromRotationMatrix(AERO);
    f.position.set(2, 0, 0);
    fg.position.set(s * 106, -176, 4);
    frame.add(fg);
  }
  frame.add(cylX(3.6, 168, pale, 0, -54, 2));
  frame.add(cylX(3.6, 168, pale, 0, -104, 2));
  frame.add(cylY(3.4, 52, pale, 0, -80, 2));
  frame.add(rbox(46, 54, 34, 9, pale, 0, 0, -2, 3));
  frame.add(wire([[-60, 10, 10], [-30, 4, 16], [-18, 0, 20]], M.red(), 1.4));
  frame.add(wire([[60, 10, 10], [30, 4, 16], [18, 0, 20]], M.black(), 1.4));
  bake(frame);
  g.add(frame);

  const pods: THREE.Group[] = [];
  const props: THREE.Object3D[] = [];
  const makeHead = (front: boolean) => {
    const pod = group();
    const m = makeMotor(M.darkMetal());
    m.scale.setScalar(0.9);
    pod.add(m);
    const p = makeProp(62, 0x1f3f9c, !front);
    p.g.position.z = 26;
    pod.add(p.g);
    props.push(p.spin);
    return pod;
  };
  for (const s of [-1, 1]) {
    const pod = makeHead(true);
    pod.position.set(s * 84, 120, 4);
    g.add(keep(pod));
    pods.push(pod);
  }
  const rear = makeHead(false);
  rear.position.set(0, -80, 4);
  g.add(keep(rear));

  const gear: THREE.Group[] = [];
  const drums: THREE.Object3D[] = [];
  for (const [x, y, r, w] of [[84, 66, 24, 34], [-84, 66, 24, 34], [106, -164, 13, 12], [-106, -164, 13, 12]] as const) {
    const leg = group();
    const strut = box(4, 8, 26, grey, 0, 0, -26);
    leg.add(strut);
    const d = group();
    d.add(cylX(r, w, M.rubber(), 0, 0, 0, 26));
    d.add(cylX(r * 0.62, w + 1.5, grey, 0, 0, 0, 18));
    for (let i = 0; i < 6; i++) {
      const b = box(w + 2, 3, 3, M.darkMetal(), 0, 0, 0);
      const a = (i / 6) * Math.PI * 2;
      b.position.set(0, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      d.add(b);
    }
    bake(d);
    const dk = keep(group(d));
    dk.position.z = -26;
    leg.add(dk);
    drums.push(dk);
    leg.position.set(x, y, 0);
    g.add(keep(leg));
    gear.push(leg);
  }

  const floats: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const f = group();
    const hull = new THREE.CapsuleGeometry(17, 190, 6, 18);
    const h = mesh(hull, M.solid(0xe8edf4, 0.45));
    h.scale.set(1, 1, 0.8);
    f.add(h);
    const keel: number[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const b = ((i + 1) / 24) * Math.PI * 2;
      const y = (q: number) => Math.sin(q) * 112;
      const x = (q: number) => Math.cos(q) * 17;
      keel.push(x(a), y(a), 8, x(b), y(b), 8);
    }
    f.add(strokes(keel, 0x9fcbff, 0.7, 0.14));
    f.add(box(5, 5, 22, grey, 0, 44, 8), box(5, 5, 22, grey, 0, -44, 8));
    f.position.set(s * 84, -24, -34);
    g.add(keep(f));
    floats.push(f);
  }

  return {
    group: g,
    tilt(v) {
      pods.forEach((p) => {
        p.rotation.x = -v * (Math.PI / 2);
        p.position.z = 4 + (1 - v) * 4;
      });
    },
    wheels(v, spin) {
      gear.forEach((l) => {
        l.visible = v > 0.02;
        l.rotation.x = (1 - v) * 1.5;
        l.scale.setScalar(0.35 + 0.65 * v);
      });
      drums.forEach((d) => (d.rotation.x -= spin));
    },
    floats(v) {
      floats.forEach((f) => {
        f.visible = v > 0.02;
        f.position.z = -34 + (1 - v) * 26;
        f.scale.setScalar(0.25 + 0.75 * v);
      });
    },
    rotors(front, rearV, dt) {
      props[0].rotation.z += front * dt * 26;
      props[1].rotation.z -= front * dt * 26;
      props[2].rotation.z += rearV * dt * 26;
    },
  };
}

/* ------------------------------------------------------------------ */
/* More quads                                                          */
/* ------------------------------------------------------------------ */
/** The first FPV quad: tape-wrapped arms, red props. */
export function makeFirstFpv(): Quad {
  const q = makeQuad({ props: 0xff3b30 });
  const g = group();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const red = i >= 2;
    const s = rbox(26, 62, 15, 6, M.solid(red ? 0xc81e24 : 0x15171b, 0.34), 0, 0, -2, 2.4);
    const h = group(s);
    h.position.set(Math.cos(a) * 72, Math.sin(a) * 72, 0);
    h.rotation.z = a - Math.PI / 2;
    g.add(h);
  }
  bake(g);
  q.body.add(g);
  return q;
}

/** A big quad with a big pack, for the commissioned build. */
export function makeLongRange(): Quad {
  const q = makeQuad({ props: 0x8d98a8 });
  const g = group();
  g.add(rbox(58, 132, 44, 6, M.solid(0x2b313a, 0.5, 0.2), 0, -4, 42, 2));
  for (const y of [-40, 0, 40]) g.add(box(60, 13, 46, M.solid(0x14161a, 0.7), 0, y, 42));
  g.add(rbox(26, 26, 10, 3, M.solid(0xe8e2cf, 0.6), 0, -92, 52, 1));
  bake(g);
  q.body.add(g);
  return q;
}

/* ------------------------------------------------------------------ */
/* Walking robot                                                       */
/* ------------------------------------------------------------------ */
export interface Walker {
  group: THREE.Group;
  step(phase: number, amp: number): void;
}

export function makeWalker(): Walker {
  const g = group();
  const body = group();
  body.add(rbox(70, 46, 46, 8, M.solid(0xf1f4f8, 0.5), 0, 0, 34, 2.5));
  body.add(rbox(58, 34, 4, 5, M.pcbBlue(), 0, 0, 80, 0.5));
  for (const s of [-1, 1]) body.add(cylY(8, 8, M.alu(), s * 16, 25, 60, 18), cylY(5.4, 9, M.black(), s * 16, 26, 60, 16));
  body.add(wire([[-20, -18, 82], [-30, -34, 70], [-24, -22, 50]], M.red(), 1.2), wire([[18, -18, 82], [30, -34, 70], [22, -22, 50]], M.tt(), 1.2));
  bake(body);
  g.add(body);
  const legs: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const l = group();
    l.add(rbox(18, 24, 24, 3, M.blue(), 0, 0, 8, 1));
    l.add(rbox(38, 66, 8, 8, M.solid(0x1d222b, 0.6), s * 4, 8, 0, 1.5));
    bake(l);
    l.position.set(s * 24, 0, 0);
    g.add(keep(l));
    legs.push(l);
  }
  return {
    group: g,
    step(p, amp) {
      legs.forEach((l, i) => {
        const q = p + i * Math.PI;
        l.position.y = Math.cos(q) * 17 * amp;
        l.position.z = Math.max(0, Math.sin(q)) * 13 * amp;
        l.rotation.x = Math.sin(q) * 0.22 * amp;
      });
      body.rotation.y = Math.sin(p) * 0.13 * amp;
      body.position.x = Math.sin(p) * 5 * amp;
      body.position.z = Math.abs(Math.cos(p)) * 3 * amp;
    },
  };
}

export { roundedRect };
