// The 5-inch quad, modelled on the parts list in Saad's build log:
// Mark4 225 mm frame, 2306.5 motors in royal blue, SpeedyBee F405 stack,
// Caddx Ratel 2, FlySky receiver, 4S 1500 mAh, tri-blade 5.1 props.
// Units are millimetres; the nose points at +y.
import * as THREE from 'three';
import { bake, box, circlePath, clamp, cyl, damp, decal, group, keep, mesh, plate, rbox, roundedRect, wire } from '../kit';
import { M } from '../materials';
import * as tex from '../textures';

export interface Quad {
  group: THREE.Group;
  /** inner group: tilt this, not the outer one */
  body: THREE.Group;
  /** named points for callouts */
  anchors: Record<string, THREE.Object3D>;
  setRpm(v: number): void;
  setExplode(v: number): void;
  setWire(v: boolean): void;
  update(dt: number): void;
  rpm: number;
}

let bladeGeo: THREE.BufferGeometry | null = null;
function propGeometry(radius: number) {
  if (bladeGeo) return bladeGeo;
  const N = 18;
  const K = 6;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let b = 0; b < 3; b++) {
    const base = pos.length / 3;
    const ang = (b / 3) * Math.PI * 2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const r = 6 + (radius - 6) * t;
      const chord = 15 * Math.sin(Math.PI * (0.16 + 0.8 * Math.pow(t, 0.8))) * (t > 0.96 ? 0.6 : 1) + 2.5;
      const twist = 0.75 - 0.52 * t;
      const sweep = -4 * Math.sin(t * Math.PI * 0.9) + t * t * 5;
      for (let k = 0; k <= K; k++) {
        const u = k / K - 0.5;
        const c = u * chord + sweep;
        const camber = (0.25 - u * u) * 4.2 * (1 - t * 0.4);
        const y = c * Math.cos(twist);
        const z = c * Math.sin(twist) * 0.8 + camber;
        pos.push(r * ca - y * sa, r * sa + y * ca, z);
      }
    }
    for (let i = 0; i < N; i++)
      for (let k = 0; k < K; k++) {
        const a = base + i * (K + 1) + k;
        idx.push(a, a + K + 1, a + 1, a + 1, a + K + 1, a + K + 2);
      }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return (bladeGeo = g);
}

export function makeProp(radius: number, color: number, flip: boolean) {
  const g = group();
  const blades = mesh(propGeometry(radius), M.prop(color));
  const hub = cyl(7, 7, M.prop(color), 0, 0, -2.5, 20);
  const spin = group(blades, hub);
  if (flip) spin.scale.x = -1;
  spin.name = 'spin';
  g.add(spin);
  g.userData.spins = true;
  keep(g);
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.MeshBasicMaterial({ map: tex.propBlur(), color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  blur.position.z = 1.5;
  blur.name = 'blur';
  g.add(blur);
  return { g, spin, blur, dir: flip ? -1 : 1 };
}

export function makeMotor(bell: THREE.Material) {
  const g = group();
  g.add(cyl(14, 4, M.black(), 0, 0, 0, 28));
  g.add(cyl(12.4, 5, M.copper(), 0, 0, 4, 18));
  g.add(cyl(14, 9, bell, 0, 0, 8, 32));
  const ring = roundedRect(26, 26, 13);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ring.holes.push(circlePath(3, Math.cos(a) * 8.2, Math.sin(a) * 8.2));
  }
  g.add(plate(ring, 1.6, bell, 17, 0.3, 10));
  g.add(cyl(2.6, 12, M.steel(), 0, 0, 17, 12));
  g.add(cyl(4.6, 5, M.solid(0x22262e, 0.4, 0.6), 0, 0, 26.5, 6));
  return g;
}

function buildQuad(opts: { props?: number; bell?: THREE.Material }): THREE.Group {
  const outer = group();
  const body = group();
  outer.add(body);
  const anchor = (name: string, parent: THREE.Object3D, x: number, y: number, z: number) => {
    const o = new THREE.Object3D();
    o.name = '@' + name;
    o.position.set(x, y, z);
    parent.add(o);
  };
  const bell = opts.bell ?? M.anodBlue();
  const propColor = opts.props ?? 0xffc21a;
  const carbon = M.carbon(1 / 42);
  const cf: THREE.Material[] = [carbon, M.carbonEdge()];
  const D = 79.5; // 225 mm across the diagonal
  const add = (o: THREE.Object3D, ex: number, ey: number, ez: number, order = 0) => {
    if (!(o as THREE.Mesh).isMesh && !o.userData.spins) bake(o);
    o.userData.part = { home: o.position.toArray(), explode: [ex, ey, ez], order };
    body.add(o);
    return o;
  };

  // ---- arms ------------------------------------------------------------
  const L = Math.hypot(D, D);
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
    const s = new THREE.Shape();
    s.moveTo(14, -7.5);
    s.lineTo(L - 16, -6.4);
    s.absarc(L, 0, 14.5, -Math.PI * 0.82, Math.PI * 0.82, false);
    s.lineTo(L - 16, 6.4);
    s.lineTo(14, 7.5);
    s.closePath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.78;
      s.holes.push(circlePath(1.7, L + Math.cos(a) * 8, Math.sin(a) * 8));
    }
    s.holes.push(circlePath(3.4, L, 0));
    const arm = plate(s, 5, cf, 0, 0.4, 14);
    arm.rotation.z = Math.atan2(sy, sx);
    const wrap = group(arm);
    add(wrap, sx * 20, sy * 20, -26, 1);
    if (sx === 1 && sy === 1) anchor('frame', wrap, D * 0.55, D * 0.55, 5);
  }

  // ---- bottom plate -----------------------------------------------------
  const bp = roundedRect(46, 108, 12);
  bp.holes.push(circlePath(2, 15, 15), circlePath(2, -15, 15), circlePath(2, 15, -15), circlePath(2, -15, -15));
  for (const y of [-40, 40]) bp.holes.push(roundedRect(22, 10, 4, 0, y) as unknown as THREE.Path);
  add(group(plate(bp, 2.4, cf, 5, 0.3, 8)), 0, 0, 14, 2);

  // ---- motors + props ------------------------------------------------------
  let mi = 0;
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
    const m = makeMotor(bell);
    m.position.set(sx * D, sy * D, 5);
    add(m, sx * 24, sy * 24, 34, 1);
    if (mi === 1) anchor('motors', m, 0, 0, 16);
    const p = makeProp(65, propColor, mi % 2 === 0);
    p.g.position.set(sx * D, sy * D, 30);
    add(p.g, sx * 24, sy * 24, 112, 0);
    if (mi === 0) anchor('props', p.g, 36, 0, 0);
    p.g.userData.dir = p.dir;
    mi++;
  }

  // ---- stack ------------------------------------------------------------------
  const esc = group();
  esc.add(rbox(44, 40, 1.8, 4, M.pcbBlack(), 0, 0, 0));
  for (let i = 0; i < 4; i++)
    for (const s of [-1, 1]) {
      esc.add(box(6, 6, 1.8, M.blackGloss(), -15 + i * 10, s * 13, 1.8));
      esc.add(box(5, 3, 0.6, M.gold(), -15 + i * 10, s * 18.4, 1.8));
    }
  esc.add(cyl(5, 12, M.solid(0x20242c, 0.35), 0, -27, -4, 18));
  for (const [x, y] of [[15, 15], [-15, 15], [15, -15], [-15, -15]] as const) esc.add(cyl(3, 4, M.solid(0xff7a1a, 0.7), x, y, 1.8, 12));
  esc.position.set(0, 0, 12);
  add(esc, 0, 0, 44, 2);
  anchor('esc', esc, -20, 10, 2);

  const fc = group();
  fc.add(rbox(37, 37, 1.6, 4, M.pcbBlack(), 0, 0, 0));
  fc.add(box(10, 10, 1.4, M.blackGloss(), 2, 2, 1.6));
  fc.add(box(5, 5, 1, M.blackGloss(), -10, -8, 1.6));
  fc.add(box(6, 4, 1.2, M.alu(), 11, -10, 1.6));
  fc.add(box(8, 6, 3, M.alu(), -17, 0, 1.6));
  for (let i = 0; i < 7; i++) fc.add(box(2.4, 2.4, 0.5, M.gold(), -12 + i * 4, 16.4, 1.6));
  const led = cyl(1.4, 1.2, M.led(0x46ff8a), 13, 12, 1.6, 8);
  fc.add(led);
  fc.position.set(0, 0, 22);
  add(fc, 0, 0, 84, 3);
  anchor('fc', fc, 18, 4, 2);

  // ---- camera --------------------------------------------------------------------
  const cam = group();
  cam.add(box(19, 14, 19, M.black(), 0, 0, -9.5));
  const barrel = mesh(new THREE.CylinderGeometry(7, 8, 9, 24), M.blackGloss(), 0, 11, 0);
  cam.add(barrel);
  const glass = mesh(new THREE.SphereGeometry(6, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.lens(), 0, 15, 0);
  cam.add(glass);
  cam.rotation.x = 0.42;
  cam.position.set(0, 46, 22);
  const camPod = group(cam);
  for (const s of [-1, 1]) {
    const side = new THREE.Shape();
    side.moveTo(34, 7);
    side.lineTo(58, 9);
    side.quadraticCurveTo(62, 22, 54, 34);
    side.lineTo(36, 36);
    side.closePath();
    const p = plate(side, 2, cf, 0, 0.2, 6);
    // stand the cage plate on its edge
    p.geometry.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
    p.position.set(s * 13 - 1, 0, 0);
    camPod.add(p);
  }
  add(camPod, 0, 66, 22, 2);
  anchor('camera', camPod, 0, 60, 24);

  // ---- receiver + video transmitter --------------------------------------------------
  const rx = group();
  rx.add(rbox(16, 24, 7, 2, M.black(), 0, 0, 0));
  rx.add(box(10, 5, 1, M.white(), 0, 4, 7));
  rx.add(wire([[-5, -12, 4], [-16, -30, 6], [-44, -42, 8]], M.black(), 0.7));
  rx.add(wire([[5, -12, 4], [16, -30, 6], [44, -42, 8]], M.black(), 0.7));
  rx.position.set(-11, -40, 10);
  add(rx, -56, -30, 18, 2);
  anchor('receiver', rx, -6, 0, 7);

  const vtx = group();
  vtx.add(rbox(24, 26, 2, 2, M.pcbGreen(), 0, 0, 0));
  for (let i = 0; i < 6; i++) vtx.add(box(20, 1.6, 6, M.darkMetal(), 0, -9 + i * 3.6, 2));
  vtx.position.set(9, -40, 10);
  add(vtx, 54, -30, 22, 2);
  anchor('vtx', vtx, 8, 0, 8);

  const ant = group();
  ant.add(wire([[0, 0, 0], [0, -14, 6], [0, -34, 18]], M.black(), 1.3));
  const pop = cyl(9, 8, M.red(), 0, -40, 20, 24);
  pop.rotation.x = -1.0;
  ant.add(pop);
  ant.position.set(2, -54, 18);
  add(ant, 10, -58, 52, 1);
  anchor('antenna', ant, 0, -40, 24);

  // ---- standoffs + top plate ---------------------------------------------------------
  const posts = group();
  for (const [x, y] of [[17, 50], [-17, 50], [17, 28], [-17, 28], [17, -28], [-17, -28], [17, -50], [-17, -50]] as const) posts.add(cyl(2.5, 25, bell, x, y, 7.4, 10));
  add(posts, 0, 0, 40, 2);
  const tp = roundedRect(40, 124, 10, 0, 2);
  for (const y of [-34, 2, 38]) tp.holes.push(roundedRect(20, 18, 6, 0, y) as unknown as THREE.Path);
  const topPlate = group(plate(tp, 2, cf, 32.4, 0.25, 8));
  add(topPlate, 0, 0, 132, 4);
  anchor('plates', topPlate, 18, -30, 34);

  // ---- battery --------------------------------------------------------------------------
  const batt = group();
  batt.add(rbox(36, 75, 34, 5, M.solid(0x15171c, 0.5), 0, 0, 0, 2.4));
  batt.add(
    decal(
      30,
      66,
      tex.label('cnhl', 240, 528, (g, w, h) => {
        g.fillStyle = '#ffc21a';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#14161c';
        g.fillRect(0, h * 0.62, w, h * 0.38);
        g.save();
        g.translate(w / 2, h * 0.31);
        g.rotate(-Math.PI / 2);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '900 112px "Dela Gothic One", Arial Black, sans-serif';
        g.fillText('4S', 0, -26);
        g.font = '700 62px "Barlow Condensed", Arial';
        g.fillText('1500 mAh', 0, 66);
        g.restore();
        g.fillStyle = '#ffc21a';
        g.save();
        g.translate(w / 2, h * 0.81);
        g.rotate(-Math.PI / 2);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '900 96px "Dela Gothic One", Arial Black, sans-serif';
        g.fillText('100C', 0, 0);
        g.restore();
      }),
      0,
      0,
      34.3,
    ),
  );
  batt.add(box(37.2, 14, 35.4, M.solid(0x2a2d35, 0.85), 0, 4, 0));
  batt.add(wire([[-6, -37, 20], [-10, -52, 24], [-4, -62, 18]], M.red(), 2.2));
  batt.add(wire([[6, -37, 20], [10, -52, 24], [4, -62, 18]], M.black(), 2.2));
  batt.add(rbox(15, 14, 8, 2, M.tt(), 0, -68, 13));
  batt.position.set(0, 2, 35);
  add(batt, 0, 0, 206, 5);
  anchor('battery', batt, 16, 22, 34);

  return outer;
}

const templates = new Map<string, THREE.Group>();

/** Every quad on the page is a light copy of one built model. */
export function makeQuad(opts: { props?: number } = {}): Quad {
  const key = String(opts.props ?? '');
  let tpl = templates.get(key);
  if (!tpl) templates.set(key, (tpl = buildQuad(opts)));
  const outer = tpl.clone(true);
  const body = outer.children[0] as THREE.Group;
  const anchors: Record<string, THREE.Object3D> = {};
  const parts: { o: THREE.Object3D; home: THREE.Vector3; explode: THREE.Vector3; order: number }[] = [];
  const props: { spin: THREE.Object3D; blur: THREE.Mesh; dir: number }[] = [];
  body.traverse((o) => {
    if (o.name[0] === '@') anchors[o.name.slice(1)] = o;
    const d = o.userData.part;
    if (d) parts.push({ o, home: new THREE.Vector3(...(d.home as [number, number, number])), explode: new THREE.Vector3(...(d.explode as [number, number, number])), order: d.order });
    if (o.userData.dir) {
      const blur = o.getObjectByName('blur') as THREE.Mesh;
      blur.material = (blur.material as THREE.Material).clone();
      props.push({ spin: o.getObjectByName('spin')!, blur, dir: o.userData.dir });
    }
  });

  let rpm = 0;
  let want = 0;
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x9fd2ff, wireframe: true, transparent: true, opacity: 0.35 });
  const original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  const quad: Quad = {
    group: outer,
    body,
    anchors,
    rpm: 0,
    setRpm(v) {
      want = v;
    },
    setExplode(v) {
      for (const p of parts) {
        // parts further up the stack leave first
        const d = 0.06 * p.order;
        const k = clamp((v - d) / (1 - 0.36));
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        p.o.position.copy(p.home).addScaledVector(p.explode, e);
      }
    },
    setWire(on) {
      body.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (on) {
          if (!original.has(m)) original.set(m, m.material);
          m.material = wireMat;
        } else if (original.has(m)) {
          m.material = original.get(m)!;
        }
      });
    },
    update(dt) {
      rpm = damp(rpm, want, want > rpm ? 2.2 : 1.2, dt);
      quad.rpm = rpm;
      for (const p of props) {
        p.spin.rotation.z += p.dir * rpm * dt * 70;
        const f = clamp((rpm - 0.22) / 0.5);
        (p.blur.material as THREE.MeshBasicMaterial).opacity = f * 0.62;
        p.blur.rotation.z -= p.dir * dt * 9;
        p.spin.visible = f < 0.98;
        p.blur.visible = f > 0.01;
      }
    },
  };
  return quad;
}

/** F450-style frame: the older PX4 and Naze32 builds. */
export function makeF450(opts: { gps?: boolean; front?: number; back?: number; props?: number } = {}) {
  const outer = group();
  const body = group();
  outer.add(body);
  const front = M.solid(opts.front ?? 0xd42a24, 0.5);
  const back = M.solid(opts.back ?? 0xf2f4f8, 0.5);
  const D = 159;
  const L = Math.hypot(D, D);
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
    const arm = group();
    const s = new THREE.Shape();
    s.moveTo(20, -15);
    s.lineTo(L - 26, -9);
    s.absarc(L, 0, 20, -Math.PI * 0.85, Math.PI * 0.85, false);
    s.lineTo(L - 26, 9);
    s.lineTo(20, 15);
    s.closePath();
    for (let i = 0; i < 4; i++) {
      const x0 = 46 + i * 34;
      const hole = new THREE.Path();
      hole.moveTo(x0, -7 + i);
      hole.lineTo(x0 + 24, 6 - i);
      hole.lineTo(x0, 7 - i);
      hole.closePath();
      s.holes.push(hole);
    }
    arm.add(plate(s, 14, sy > 0 ? front : back, 12, 1, 10));
    arm.rotation.z = Math.atan2(sy, sx);
    body.add(arm);
    const leg = box(14, 14, 24, sy > 0 ? front : back, sx * D, sy * D, -10);
    body.add(leg);
  }
  const p1 = roundedRect(120, 120, 34);
  body.add(plate(p1, 2.4, M.pcbBlack(), 10, 0.3));
  const p2 = roundedRect(110, 110, 34);
  body.add(plate(p2, 2.4, M.pcbBlack(), 30, 0.3));
  const props: ReturnType<typeof makeProp>[] = [];
  let i = 0;
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
    const m = makeMotor(M.copper());
    m.scale.setScalar(1.15);
    m.position.set(sx * D, sy * D, 26);
    body.add(m);
    const p = makeProp(65, opts.props ?? 0xf2f4f8, i % 2 === 0);
    p.g.scale.setScalar(1.72);
    p.g.position.set(sx * D, sy * D, 58);
    body.add(p.g);
    props.push(p);
    i++;
  }
  // flight controller, receiver, battery, wires
  body.add(rbox(50, 80, 15, 6, M.black(), 0, 0, 34));
  body.add(box(26, 12, 1, M.white(), 0, 10, 49));
  body.add(rbox(26, 40, 14, 3, M.black(), 42, -14, 33));
  body.add(rbox(40, 100, 26, 5, M.solid(0xffc21a, 0.5), 0, 0, -18));
  body.add(wire([[20, 30, 46], [44, 34, 60], [50, 6, 46]], M.solid(0xf2f4f8), 1.4));
  body.add(wire([[20, 24, 46], [48, 30, 58], [46, -4, 46]], M.red(), 1.4));
  body.add(wire([[-22, 34, 46], [-60, 70, 40], [-100, 108, 30]], M.red(), 1.8));
  body.add(wire([[22, 34, 46], [60, 70, 40], [100, 108, 30]], M.black(), 1.8));
  if (opts.gps) {
    body.add(cyl(2.4, 60, M.darkMetal(), -34, 30, 32, 10));
    body.add(cyl(27, 12, M.black(), -34, 30, 90, 30));
    body.add(cyl(10, 1, M.white(), -34, 30, 102, 20));
  }
  bake(body);
  let rpm = 0;
  let want = 0;
  return {
    group: outer,
    body,
    setRpm(v: number) {
      want = v;
    },
    update(dt: number) {
      rpm = damp(rpm, want, 2, dt);
      for (const p of props) {
        p.spin.rotation.z += p.dir * rpm * dt * 60;
        const f = clamp((rpm - 0.25) / 0.5);
        (p.blur.material as THREE.MeshBasicMaterial).opacity = f * 0.6;
        p.spin.visible = f < 0.98;
        p.blur.visible = f > 0.01;
      }
    },
  };
}

/** High-wing foam trainer: the first RC plane. Nose at +y. */
export function makePlane() {
  const outer = group();
  const body = group();
  outer.add(body);
  const foam = M.solid(0xf2f4f8, 0.8);
  const trim = M.solid(0xe5322d, 0.6);
  const fus = new THREE.Shape();
  fus.moveTo(-26, 150);
  fus.lineTo(26, 150);
  fus.lineTo(30, 60);
  fus.lineTo(12, -190);
  fus.lineTo(-12, -190);
  fus.lineTo(-30, 60);
  fus.closePath();
  body.add(plate(fus, 52, foam, -26, 3));
  const wing = new THREE.Shape();
  wing.moveTo(-300, 78);
  wing.quadraticCurveTo(0, 104, 300, 78);
  wing.lineTo(296, 4);
  wing.lineTo(-296, 4);
  wing.closePath();
  body.add(plate(wing, 14, foam, 30, 3));
  for (const s of [-1, 1]) {
    body.add(box(120, 72, 1, trim, s * 220, 42, 44.2));
    body.add(box(150, 18, 7, trim, s * 190, -4, 34));
  }
  const tail = new THREE.Shape();
  tail.moveTo(-104, -150);
  tail.quadraticCurveTo(0, -132, 104, -150);
  tail.lineTo(100, -204);
  tail.lineTo(-100, -204);
  tail.closePath();
  body.add(plate(tail, 7, trim, 8, 1));
  const fin = box(7, 66, 78, foam, 0, -176, 12);
  body.add(fin);
  body.add(box(8, 20, 70, trim, 0, -206, 14));
  const nose = group();
  const motor = mesh(new THREE.CylinderGeometry(14, 14, 16, 22), M.copper(), 0, 158, 0);
  nose.add(motor);
  const spinner = mesh(new THREE.ConeGeometry(12, 22, 20), trim, 0, 178, 0);
  nose.add(spinner);
  const blade = mesh(new THREE.BoxGeometry(128, 3, 12), M.solid(0x16181d, 0.4), 0, 168, 0);
  const prop = keep(group(blade));
  prop.position.set(0, 0, 0);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(66, 36),
    new THREE.MeshBasicMaterial({ map: tex.propBlur(), transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }),
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 168, 0);
  body.add(nose, prop, disc);
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.CylinderGeometry(20, 20, 8, 20), M.rubber(), s * 52, 70, -62);
    w.rotation.z = Math.PI / 2;
    body.add(w);
    body.add(wire([[0, 70, -24], [s * 24, 70, -44], [s * 48, 70, -62]], M.steel(), 2));
  }
  bake(body);
  let spin = 1;
  return {
    group: outer,
    body,
    setRpm(v: number) {
      spin = v;
    },
    update(dt: number) {
      prop.position.set(0, 168, 0);
      blade.position.set(0, 0, 0);
      prop.rotation.y += dt * 50 * spin;
      (disc.material as THREE.MeshBasicMaterial).opacity = 0.7 * spin;
    },
  };
}
