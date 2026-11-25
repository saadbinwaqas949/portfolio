// The line follower that drives the page. Faces +y, units are millimetres.
import * as THREE from 'three';
import { bake, box, cyl, cylX, group, keep, mesh, plate, rbox, roundedRect, circlePath, wire } from '../kit';
import { M } from '../materials';
import * as tex from '../textures';

export interface LineFollower {
  group: THREE.Group;
  update(t: number, dt: number, speed: number, wobble: number): void;
}

/** Small rubber wheel on a yellow hub, axle along x. */
export function ttWheel(r = 33, w = 24) {
  const g = group();
  const tyre = cylX(r, w, M.rubber());
  g.add(tyre);
  const spokes = group();
  for (const s of [-1, 1]) {
    spokes.add(cylX(r * 0.68, 2, M.tt(), s * (w / 2 + 0.2), 0, 0, 26));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const b = mesh(new THREE.BoxGeometry(1.4, r * 0.52, 5), M.ttDark(), s * (w / 2 + 1.4), Math.sin(a) * r * 0.36, Math.cos(a) * r * 0.36);
      b.rotation.x = -a;
      spokes.add(b);
    }
    spokes.add(cylX(5, 3, M.white(), s * (w / 2 + 2), 0, 0, 14));
  }
  g.add(spokes);
  // tread blocks, so you can see it turn
  const tread = new THREE.BoxGeometry(w * 0.94, 4, 3);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const b = mesh(tread, M.rubber(), 0, Math.sin(a) * (r + 0.4), Math.cos(a) * (r + 0.4));
    b.rotation.x = -a;
    g.add(b);
  }
  bake(g);
  return g;
}

export function makeLineFollower(): LineFollower {
  const g = group();
  const body = group();
  g.add(body);

  // two-deck chassis in red acrylic
  const deck = roundedRect(92, 124, 26);
  deck.holes.push(circlePath(5, 30, 44), circlePath(5, -30, 44), circlePath(5, 30, -44), circlePath(5, -30, -44));
  body.add(plate(deck, 4, M.red(), 14, 0.6));
  for (const [x, y] of [[30, 44], [-30, 44], [30, -44], [-30, -44]] as const) body.add(cyl(3, 22, M.gold(), x, y, 18, 8));
  const top = roundedRect(84, 104, 22);
  body.add(plate(top, 3.4, M.red(), 40, 0.6));

  // drive wheels
  const wl = ttWheel(30, 20);
  const wr = ttWheel(30, 20);
  wl.position.set(-60, -22, 30);
  wr.position.set(60, -22, 30);
  g.add(wl, wr);
  for (const s of [-1, 1]) body.add(rbox(30, 66, 20, 3, M.tt(), s * 32, -22, 18));

  // sensor bar
  body.add(rbox(96, 18, 4, 3, M.pcbBlue(), 0, 72, 12));
  body.add(box(14, 26, 4, M.red(), 0, 60, 14));
  const leds: THREE.Mesh[] = [];
  const ledMats: THREE.MeshBasicMaterial[] = [];
  for (let i = -2; i <= 2; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0xff2b2b, toneMapped: false });
    ledMats.push(m);
    const l = keep(cyl(3.6, 4, m, i * 19, 72, 16, 12));
    l.castShadow = false;
    leds.push(l);
    body.add(l);
    body.add(box(8, 6, 5, M.black(), i * 19, 64, 14));
  }

  // brain, driver, battery
  body.add(rbox(22, 48, 3, 1, M.pcbBlue(), -22, 10, 46));
  body.add(box(9, 14, 3, M.black(), -22, 4, 49));
  body.add(box(8, 8, 4, M.alu(), -22, 34, 49));
  for (const s of [-1, 1]) body.add(box(2.4, 42, 4, M.black(), -22 + s * 9.4, 8, 49));
  body.add(rbox(30, 30, 3, 1, M.pcbRed(), 20, 22, 46));
  body.add(box(16, 10, 10, M.blackGloss(), 20, 26, 49));
  body.add(box(22, 6, 8, M.blue(), 20, 10, 49));
  body.add(rbox(58, 24, 18, 6, M.solid(0x1d58ff, 0.42), 0, -32, 44));
  body.add(box(12, 24.4, 18.4, M.white(), -14, -32, 44));

  body.add(wire([[-12, 20, 50], [0, 44, 60], [-8, 66, 20]], M.solid(0x7c3aed), 1.2));
  body.add(wire([[-8, 18, 50], [10, 50, 64], [6, 66, 20]], M.solid(0x19b36b), 1.2));
  body.add(wire([[20, 8, 52], [34, -10, 60], [24, -26, 60]], M.red(), 1.5));
  body.add(wire([[26, 8, 52], [42, -8, 58], [20, -36, 62]], M.black(), 1.5));

  // headlights: two sprites that glow on the mat
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(210, 250),
    new THREE.MeshBasicMaterial({
      map: tex.glow(),
      color: 0xffd98a,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    }),
  );
  beam.position.set(0, 150, 2);
  g.add(beam);
  for (const s of [-1, 1]) {
    const l = cyl(5, 8, M.led(0xfff1c8), s * 36, 58, 20, 12);
    l.castShadow = false;
    body.add(l);
  }

  bake(body);
  g.scale.setScalar(0.0086);

  return {
    group: g,
    update(t, dt, speed, wob) {
      const spin = (speed * dt) / 26;
      wl.rotation.x -= spin * (1 - wob * 0.1);
      wr.rotation.x -= spin * (1 + wob * 0.1);
      const go = Math.min(1, Math.abs(speed) / 400);
      body.position.z = Math.sin(t * 31) * 0.7 * go;
      body.rotation.y = wob * 0.03;
      body.rotation.x = -go * 0.02;
      for (let i = 0; i < 5; i++) {
        const on = Math.abs(i - 2 - wob * 1.6) < 0.95;
        ledMats[i].color.setHex(on ? 0xff4a3a : 0x4a0d0d);
      }
      (beam.material as THREE.MeshBasicMaterial).opacity = 0.3 + go * 0.2 + Math.sin(t * 3) * 0.02;
    },
  };
}
