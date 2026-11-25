// A small kitten seen from above, face tipped up so you can see it. Millimetres,
// facing +y, sitting on z = 0. It glows a little, so it is there at night too.
import * as THREE from 'three';
import { bake, group, keep, mesh, sphere } from '../kit';

export interface Kitten {
  group: THREE.Group;
  update(t: number, dt: number, lookX: number, lookY: number): void;
}

const fur = (hex: number) => new THREE.MeshLambertMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.22 });

export function makeKitten(coat: 'ginger' | 'grey' | 'cream' = 'ginger'): Kitten {
  const C = { ginger: [0xf3a552, 0xfff3e2, 0xd27d27], grey: [0x98a4b8, 0xffffff, 0x6b778d], cream: [0xf3e2c4, 0xfffaf0, 0xd9bd8e] }[coat];
  const base = fur(C[0]);
  const light = fur(C[1]);
  const dark = fur(C[2]);
  const ink = new THREE.MeshBasicMaterial({ color: 0x11151f });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pink = fur(0xff8d94);
  const g = group();
  const body = group();
  const b = sphere(17, base, 0, -12, 13, 24);
  b.scale.set(1, 1.25, 0.85);
  body.add(b);
  for (const y of [-22, -13, -4]) {
    const s = mesh(new THREE.TorusGeometry(15.4, 1.5, 6, 18, 2.2), dark, 0, y, 12);
    s.rotation.set(Math.PI / 2, 0, (Math.PI - 2.2) / 2);
    body.add(s);
  }
  for (const s of [-1, 1]) {
    const p = sphere(6.4, light, s * 9, 15, 5, 14);
    p.scale.set(1, 1.35, 0.8);
    body.add(p);
  }
  bake(body, false);
  g.add(body);

  // head, tilted back
  const head = group();
  const inner = group();
  const sk = sphere(17.5, base, 0, 0, 0, 26);
  sk.scale.set(1.12, 1, 0.94);
  inner.add(sk);
  const muz = sphere(8.6, light, 0, 6.4, 11.2, 18);
  muz.scale.set(1.35, 0.8, 0.62);
  inner.add(muz);
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.ConeGeometry(7, 13, 4), base, s * 11.4, -13.5, 6);
    e.rotation.set(Math.PI, 0.5, s * -0.42);
    inner.add(e);
    const e2 = mesh(new THREE.ConeGeometry(3.6, 8, 4), pink, s * 11.2, -12.2, 9.4);
    e2.rotation.set(Math.PI, 0.5, s * -0.42);
    inner.add(e2);
  }
  inner.add(sphere(1.9, pink, 0, 8.6, 15.2, 10));
  for (const x of [-5.5, 0, 5.5]) {
    const st = mesh(new THREE.BoxGeometry(1.7, 7, 1.2), dark, x, -8.4, 14.6 - Math.abs(x) * 0.16);
    st.rotation.x = 0.5;
    inner.add(st);
  }
  bake(inner, false);
  const eyes: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const e = group(mesh(new THREE.CircleGeometry(4.5, 20), ink), mesh(new THREE.CircleGeometry(1.5, 12), shine, 1.5, -1.6, 0.2));
    e.position.set(s * 7.3, 0.6, 16.1);
    e.rotation.set(0, s * 0.24, 0);
    e.traverse((o) => {
      o.castShadow = false;
    });
    inner.add(keep(e));
    eyes.push(e);
  }
  head.add(inner);
  head.position.set(0, 10, 24);
  g.add(keep(head));

  // tail in beads
  const beads: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const m = sphere(4.4 - i * 0.16, i > 6 ? dark : base, 0, 0, 0, 10);
    beads.push(m);
    g.add(m);
  }

  let lx = 0;
  let ly = 0;
  let blink = 2;
  return {
    group: g,
    update(t, dt, wx, wy) {
      const k = 1 - Math.exp(-dt * 6);
      lx += (wx - lx) * k;
      ly += (wy - ly) * k;
      head.rotation.set(-0.12 - ly * 0.28, lx * 0.34, -lx * 0.22 + Math.sin(t * 1.3) * 0.04);
      body.scale.set(1, 1, 1 + Math.sin(t * 2.6) * 0.03);
      blink -= dt;
      if (blink < -0.14) blink = 2 + Math.random() * 3;
      eyes.forEach((e) => (e.scale.y = blink < 0 ? 0.12 : 1));
      beads.forEach((m, i) => {
        const a = Math.sin(t * 2.1 - i * 0.32) * 0.5;
        m.position.set(Math.sin(a + 0.5) * i * 4.2, -30 - i * 3.4 + Math.abs(i - 4) * 0.2, 8 + i * 1.1);
      });
    },
  };
}
