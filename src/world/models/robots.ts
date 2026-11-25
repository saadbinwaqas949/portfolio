// The small Arduino robots. Based on the soccer bot in Saad's photos: popsicle
// sticks, laminated cardboard, yellow gear motors, an Uno and a red L298N.
// Millimetres, facing +y.
import * as THREE from 'three';
import { bake, box, cyl, cylX, decal, group, keep, mesh, plate, rbox, roundedRect, sphere, wire } from '../kit';
import { M } from '../materials';
import * as tex from '../textures';
import { ttWheel } from './lineFollower';

export interface Robot {
  group: THREE.Group;
  body: THREE.Group;
  /** roll the wheels: speeds in mm/s */
  drive(left: number, right: number, dt: number): void;
  radius: number;
  extra: Record<string, THREE.Object3D>;
}

export function arduinoUno() {
  const g = group();
  g.add(rbox(53, 68, 2, 3, M.pcbBlue(), 0, 0, 0, 0.3));
  g.add(box(12, 16, 11, M.alu(), -14, 30, 2));
  g.add(box(9, 14, 11, M.black(), 18, 29, 2));
  g.add(box(8, 35, 4, M.blackGloss(), 4, -8, 3));
  for (let i = 0; i < 14; i++) for (const s of [-1, 1]) g.add(box(0.8, 1, 3, M.steel(), 4 + s * 4.6, 6.5 - i * 2.3, 1.6));
  g.add(box(3, 46, 8.5, M.black(), -24, -4, 2));
  g.add(box(3, 40, 8.5, M.black(), 24, -10, 2));
  g.add(cyl(3, 5, M.alu(), -10, 10, 2, 12));
  g.add(cyl(3, 5, M.alu(), -3, 14, 2, 12));
  g.add(box(6, 6, 3, M.red(), -19, 14, 2));
  return g;
}

export function l298n() {
  const g = group();
  g.add(rbox(43, 43, 2, 2, M.pcbRed(), 0, 0, 0, 0.3));
  const sink = group();
  for (let i = 0; i < 6; i++) sink.add(box(2, 14, 20, M.black(), -8 + i * 3.4, 8, 2));
  sink.add(box(22, 3, 20, M.black(), 0.5, 8, 2));
  g.add(sink);
  for (const [x, y] of [[-17, -2], [17, -2]] as const) g.add(box(7, 11, 9, M.blue(), x, y, 2));
  g.add(box(16, 8, 9, M.blue(), -6, -17, 2));
  g.add(cyl(4, 8, M.darkMetal(), 12, -13, 2, 14));
  g.add(cyl(4, 8, M.darkMetal(), -14, 14, 2, 14));
  return g;
}

export function lipo(label = '3S', hex = 0x8c1c1c) {
  const g = group();
  g.add(rbox(34, 66, 22, 4, M.solid(hex, 0.45), 0, 0, 0, 1.6));
  g.add(
    decal(
      28,
      56,
      tex.label('lipo' + label, 180, 360, (c, w, h) => {
        c.fillStyle = '#ffe9b0';
        c.fillRect(0, 0, w, h);
        c.fillStyle = '#1a0c08';
        c.fillRect(0, 0, w, h * 0.2);
        c.save();
        c.translate(w / 2, h * 0.6);
        c.rotate(-Math.PI / 2);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '900 92px "Dela Gothic One", Arial Black';
        c.fillText(label, 0, 4);
        c.restore();
      }),
      0,
      0,
      22.2,
    ),
  );
  return g;
}

const jumper = (pts: [number, number, number][], hex: number) => wire(pts, M.solid(hex, 0.6), 1.1, 20);

export interface CarOptions {
  chassis?: 'wood' | 'acrylic' | 'metal' | 'card';
  front?: 'plough' | 'wedge' | 'fork' | 'sonar' | 'none';
  battery?: string;
  trim?: number;
  bt?: boolean;
  wheels?: 'tt' | 'slick';
}

export function makeCar(o: CarOptions = {}): Robot {
  const outer = group();
  const body = group();
  outer.add(body);
  const extra: Record<string, THREE.Object3D> = {};
  const chassis = o.chassis ?? 'wood';
  const mats = {
    wood: M.wood(),
    acrylic: M.solid(o.trim ?? 0x1f9d58, 0.3),
    metal: M.alu(),
    card: M.kraftMM(),
  };
  const base = mats[chassis];

  // ---- deck --------------------------------------------------------------
  if (chassis === 'wood') {
    // popsicle sticks, side by side
    for (let i = 0; i < 6; i++) body.add(plate(roundedRect(17, 150 - (i % 2) * 6, 8, -45 + i * 18, (i % 2) * 2), 3, base, 26, 0.4, 5));
    for (const y of [-54, 52]) body.add(plate(roundedRect(126, 15, 7, 0, y), 3, base, 29, 0.4, 5));
  } else {
    body.add(plate(roundedRect(110, 146, chassis === 'metal' ? 6 : 20), chassis === 'metal' ? 5 : 4, base, 26, 0.6, 6));
    if (chassis === 'metal') for (const [x, y] of [[46, 64], [-46, 64], [46, -64], [-46, -64]] as const) body.add(cyl(3.2, 2.4, M.darkMetal(), x, y, 31, 6));
  }

  // ---- motors + wheels -----------------------------------------------------
  const wheels: THREE.Object3D[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      body.add(rbox(20, 62, 19, 3, M.tt(), sx * 41, sy * 40, 8));
      body.add(cyl(9, 16, M.alu(), sx * 41, sy * 16, 9, 16));
      const w = ttWheel(32, 24);
      w.position.set(sx * 70, sy * 46, 32);
      keep(w);
      body.add(w);
      wheels.push(w);
    }

  // ---- electronics -----------------------------------------------------------
  const uno = arduinoUno();
  uno.position.set(-20, 18, 33);
  const drv = l298n();
  drv.position.set(24, -22, 33);
  const bat = lipo(o.battery ?? '3S');
  bat.position.set(-26, -40, 32);
  body.add(uno, drv, bat);
  body.add(rbox(15, 12, 10, 2, M.black(), 28, -60, 32));
  body.add(box(7, 8, 4, M.red(), 28, -60, 42));
  body.add(wire([[-26, -72, 44], [-30, -86, 54], [0, -82, 56], [22, -68, 46]], M.red(), 2));
  body.add(wire([[-18, -72, 44], [-14, -88, 50], [12, -80, 50], [20, -42, 44]], M.black(), 2));
  body.add(rbox(16, 14, 9, 2, M.tt(), -2, -72, 44));
  body.add(jumper([[4, 20, 44], [20, 30, 62], [26, 8, 56], [24, -2, 42]], 0x7c3aed));
  body.add(jumper([[4, 14, 44], [24, 22, 58], [32, 6, 54], [28, -2, 42]], 0x19b36b));
  body.add(jumper([[4, 8, 44], [18, 16, 60], [18, 4, 54], [20, -2, 42]], 0xf2f4f8));
  body.add(jumper([[4, 2, 44], [30, 10, 56], [38, 0, 50], [32, -4, 42]], 0xffc21a));
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      body.add(wire([[24 + sx * 14, -24, 44], [sx * 34, sy * 22, 40], [sx * 44, sy * 26, 30]], M.black(), 1.3));

  // ---- front end -----------------------------------------------------------------
  let reach = 78;
  if (o.front === 'plough' || o.front === 'fork') {
    // three layers of cardboard, flutes showing
    const slab = (w: number, h: number, x: number, y: number, z: number, t = 4) => {
      const m = mesh(new THREE.BoxGeometry(w, t, h), [M.kraftEdgeMM(), M.kraftEdgeMM(), M.kraftMM(), M.kraftMM(), M.kraftEdgeMM(), M.kraftEdgeMM()], x, y, z + h / 2);
      return m;
    };
    if (o.front === 'plough') {
      for (let i = 0; i < 3; i++) body.add(slab(168, 52, 0, 84 + i * 4.2, 3));
      const ramp = mesh(new THREE.BoxGeometry(166, 34, 3), M.kraftMM(), 0, 110, 12);
      ramp.rotation.x = 0.62;
      body.add(ramp);
      reach = 122;
    } else {
      for (let i = 0; i < 2; i++) body.add(slab(170, 30, 0, 82 + i * 4.2, 16));
      for (const s of [-1, 1])
        for (let i = 0; i < 2; i++) {
          const arm = slab(46, 46, s * (78 - i * 4.2), 112, 3);
          arm.rotation.z = Math.PI / 2 - s * 0.14;
          body.add(arm);
        }
      for (const s of [-1, 1]) {
        const st = plate(roundedRect(9, 70, 4, 0, 0), 2, M.wood(), 0, 0.2, 5);
        st.position.set(s * 66, 102, 30);
        st.rotation.set(0.25, 0, s * 0.35);
        body.add(st);
      }
      reach = 132;
    }
  } else if (o.front === 'wedge') {
    const w = new THREE.Shape();
    w.moveTo(0, 0);
    w.lineTo(58, 0);
    w.lineTo(0, 40);
    w.closePath();
    const geo = new THREE.ExtrudeGeometry(w, { depth: 168, bevelEnabled: false });
    geo.translate(0, 0, -84);
    // profile is drawn in (y, z), extruded along x
    geo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
    body.add(mesh(geo, M.alu(), 0, 76, 2));
    body.add(box(170, 6, 44, M.solid(o.trim ?? 0xd42a24, 0.4), 0, 74, 4));
    reach = 136;
  } else if (o.front === 'sonar') {
    const s = group();
    s.add(box(46, 3, 21, M.pcbBlue(), 0, 0, 0));
    for (const x of [-13, 13]) {
      const eye = mesh(new THREE.CylinderGeometry(8.2, 8.2, 12, 22), M.alu(), x, 8, 10.5);
      s.add(eye);
      s.add(mesh(new THREE.CylinderGeometry(6.8, 6.8, 1, 20), M.darkMetal(), x, 14.2, 10.5));
    }
    const servo = group();
    servo.add(box(23, 13, 22, M.solid(0x2458d8, 0.4), 0, 0, 0));
    servo.position.set(0, 66, 29);
    body.add(servo);
    s.position.set(0, 68, 52);
    keep(s);
    body.add(s);
    extra.sonar = s;
    reach = 90;
  }
  if (o.bt) {
    body.add(rbox(16, 36, 3, 1, M.pcbBlue(), 30, 40, 40));
    body.add(box(12, 12, 2, M.alu(), 30, 46, 43));
    const led = keep(cyl(2.4, 3, new THREE.MeshBasicMaterial({ color: 0x46a6ff, toneMapped: false }), 30, 28, 43, 10));
    led.castShadow = false;
    body.add(led);
    extra.led = led;
    body.add(jumper([[26, 24, 44], [10, 10, 60], [-18, 8, 50]], 0xffc21a));
  }
  if (chassis === 'wood') {
    // bumpers: a popsicle stick down each side
    for (const s of [-1, 1]) {
      const st = plate(roundedRect(10, 150, 5), 2.4, M.wood(), 0, 0.2, 5);
      st.rotation.y = s * 1.2;
      st.position.set(s * 92, 0, 34);
      body.add(st);
      body.add(box(30, 9, 2.4, M.wood(), s * 78, 0, 30));
    }
  }
  bake(body);

  return {
    group: outer,
    body,
    radius: reach,
    extra,
    drive(l, r, dt) {
      wheels[0].rotation.x -= (l * dt) / 32;
      wheels[1].rotation.x -= (l * dt) / 32;
      wheels[2].rotation.x -= (r * dt) / 32;
      wheels[3].rotation.x -= (r * dt) / 32;
    },
  };
}

/** The ring: a black disc with a white edge, 770 mm for the class. */
export function makeDohyo() {
  const g = group();
  const R = 385;
  const t = tex.label('dohyo', 1024, 1024, (c) => {
    const C = 512;
    c.fillStyle = '#f3f5fa';
    c.fillRect(0, 0, 1024, 1024);
    c.fillStyle = '#1d212b';
    c.beginPath();
    c.arc(C, C, 479, 0, 7);
    c.fill();
    const r = tex.rng(77);
    // scuffs from a season of bouts
    for (let i = 0; i < 260; i++) {
      c.strokeStyle = `rgba(190,205,235,${0.03 + r() * 0.09})`;
      c.lineWidth = 1 + r() * 4;
      const a = r() * 6.28;
      const d = r() * 400;
      c.beginPath();
      c.arc(C + Math.cos(a) * d, C + Math.sin(a) * d, 20 + r() * 120, r() * 6, r() * 6 + 0.9);
      c.stroke();
    }
    c.fillStyle = '#8a4a1e';
    c.fillRect(C - 130, C - 66, 15, 132);
    c.fillRect(C + 115, C - 66, 15, 132);
  });
  const top = cyl(R, 25, [M.solid(0xf3f5fa, 0.7), new THREE.MeshLambertMaterial({ map: t }), M.black()], 0, 0, 0, 96);
  g.add(top);
  return g;
}

/** Gold medal on a ribbon, face up. */
export function makeMedal(text = '1', metal: 'gold' | 'silver' | 'bronze' = 'gold', ribbon = 0xd9b86a) {
  const g = group();
  const mat = M[metal]();
  const face = new THREE.Shape();
  face.absarc(0, 0, 40, 0, Math.PI * 2, false);
  g.add(plate(face, 6, mat, -3, 1.4, 48));
  for (const z of [3, -3]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(34, 1.6, 10, 64), mat);
    ring.position.z = z;
    ring.castShadow = true;
    g.add(ring);
  }
  // laurel dots
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const s = sphere(1.7, mat, Math.cos(a) * 29, Math.sin(a) * 29, 3, 8);
    g.add(s);
  }
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 8.5 : 20;
    i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.add(plate(star, 4, mat, 2, 1, 4));
  const loop = new THREE.Mesh(new THREE.TorusGeometry(8, 2, 10, 28), mat);
  loop.position.y = 46;
  loop.castShadow = true;
  g.add(loop);
  const rib = M.solid(ribbon, 0.85);
  for (const s of [-1, 1]) {
    const b = box(22, 130, 1.4, rib, s * 24, 112, -1);
    b.rotation.z = s * 0.34;
    g.add(b);
  }
  bake(g);
  g.userData.text = text;
  return g;
}

/** Cardboard parcel with opening flaps. Size in mm. */
export function makeBox(w = 200, d = 160, h = 130, print = '') {
  const g = group();
  const face = M.kraftMM();
  const edge = M.kraftEdgeMM();
  const t = 4;
  const wall = (ww: number, hh: number) => mesh(new THREE.BoxGeometry(ww, t, hh), [edge, edge, face, face, edge, edge]);
  for (const s of [-1, 1]) {
    const a = wall(w, h);
    a.position.set(0, (s * d) / 2, h / 2);
    g.add(a);
    const b = wall(d, h);
    b.rotation.z = Math.PI / 2;
    b.position.set((s * w) / 2, 0, h / 2);
    g.add(b);
  }
  const floor = box(w, d, t, M.solid(0x5d4122, 0.95), 0, 0, 0);
  g.add(floor);
  const flaps: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const hinge = group();
    hinge.position.set(0, (s * d) / 2, h);
    const f = mesh(new THREE.BoxGeometry(w, d / 2 - 1, t), [edge, edge, edge, edge, face, face], 0, (-s * d) / 4, t / 2);
    hinge.add(f);
    g.add(hinge);
    flaps.push(hinge);
  }
  let tape: THREE.Mesh | null = null;
  tape = box(w + 1, 34, 0.8, M.solid(0xd8b777, 0.35), 0, 0, h + t);
  g.add(tape);
  if (print) {
    const dec = decal(
      w * 0.62,
      w * 0.2,
      tex.label('print' + print, 512, 166, (c, cw, ch) => {
        c.clearRect(0, 0, cw, ch);
        c.fillStyle = 'rgba(38,22,8,.82)';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '400 92px "Dela Gothic One", Arial Black';
        c.fillText(print, cw / 2, ch / 2, cw * 0.95);
      }),
      0,
      d * 0.28,
      h + t + 0.6,
    );
    g.add(dec);
    (g.userData as any).decal = dec;
  }
  return {
    group: g,
    flaps,
    tape,
    open(v: number) {
      flaps[0].rotation.x = v * 2.35;
      flaps[1].rotation.x = -v * 2.35;
      if (tape) tape.visible = v < 0.02;
      const dec = g.userData.decal as THREE.Mesh | undefined;
      if (dec) dec.visible = v < 0.05;
    },
  };
}

/** Black DIP chip with a laser-etched name, or a blank for layout. */
export function makeChip(name: string, pins: number) {
  const g = group();
  const w = Math.max(60, pins * 9.2);
  const body = rbox(w, 34, 13, 2, M.solid(0x17191f, 0.62), 0, 0, 4, 1.4);
  g.add(body);
  for (let i = 0; i < pins; i++) {
    const x = -w / 2 + (w / pins) * (i + 0.5);
    for (const s of [-1, 1]) {
      g.add(box(4, 7, 1.6, M.alu(), x, s * 20, 8));
      g.add(box(3, 1.6, 9, M.alu(), x, s * 23.4, 0));
    }
  }
  bake(g);
  const cw = 1024;
  const ch = Math.round((cw * 30) / (w - 4));
  g.add(
    decal(
      w - 4,
      30,
      tex.label('chip' + name, cw, ch, (c, W, H) => {
        c.clearRect(0, 0, W, H);
        c.fillStyle = 'rgba(226,232,244,.92)';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        // the colour stripe covers the first 8 units, so centre in what is left
        const x0 = (W * 11) / (w - 4);
        const x1 = W - (W * 3.5) / (w - 4);
        let px = H * 0.5;
        c.font = `600 ${px}px "Barlow Condensed", Arial Narrow`;
        const tw = c.measureText(name).width;
        if (tw > x1 - x0) px *= (x1 - x0) / tw;
        c.font = `600 ${px}px "Barlow Condensed", Arial Narrow`;
        c.fillText(name, (x0 + x1) / 2, H * 0.53);
      }),
      0,
      0,
      17.2,
    ),
  );
  g.userData.w = w;
  g.userData.h = 48;
  return g;
}

export function makeBall(r = 20) {
  return sphere(r, M.orange(), 0, 0, r, 26);
}
