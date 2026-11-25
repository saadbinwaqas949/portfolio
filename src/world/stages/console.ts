// A handheld on the bench. Cartridges lie in a row; pick one and it flies into
// the slot, the screen boots and cycles through real screenshots.
import * as THREE from 'three';
import { gsap } from '../../lib/motion';
import { clamp, cyl, damp, mesh, plate, roundedRect, smooth } from '../kit';
import { M } from '../materials';
import * as tex from '../textures';
import type { Stage } from '../World';

export interface CartInfo {
  name: string;
  color: string;
  images: string[];
}

export interface ConsoleStage extends Stage {
  select(i: number, instant?: boolean): void;
  hover(i: number): void;
  press(key: 'left' | 'right' | 'a' | 'b'): void;
  nextShot(): void;
  current: number;
}

interface Cart {
  g: THREE.Group;
  home: THREE.Vector3;
  rot: number;
  k: number; // 0 at home, 1 in the slot
  lift: number;
  scale: number;
}

const SW = 640;
const SH = 360;

export function consoleStage(el: HTMLElement, consoleEl: HTMLElement, buttons: HTMLElement[], carts: CartInfo[]): ConsoleStage {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  /* ---- screen ------------------------------------------------------- */
  const cv = document.createElement('canvas');
  cv.width = SW;
  cv.height = SH;
  const g = cv.getContext('2d')!;
  const small = document.createElement('canvas');
  const sg = small.getContext('2d')!;
  const screenTex = new THREE.CanvasTexture(cv);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), screenMat);

  const images = new Map<string, HTMLImageElement>();
  const load = (src: string) => {
    let im = images.get(src);
    if (!im) {
      im = new Image();
      im.decoding = 'async';
      im.src = src;
      images.set(src, im);
    }
    return im;
  };

  let boot = 0; // seconds since the last cartridge went in
  let shot = 0;
  let shotT = 0;
  let prevSrc = '';
  let paint = 0;

  const cover = (c: CanvasRenderingContext2D, im: HTMLImageElement, w: number, h: number) => {
    const k = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const iw = im.naturalWidth * k;
    const ih = im.naturalHeight * k;
    c.drawImage(im, (w - iw) / 2, (h - ih) / 2, iw, ih);
  };

  const drawScreen = (t: number) => {
    const c = carts[st.current];
    g.fillStyle = '#05070c';
    g.fillRect(0, 0, SW, SH);
    if (!c) return;
    if (boot < 0.35) {
      // static while the cartridge seats
      for (let i = 0; i < 260; i++) {
        const v = Math.floor(Math.random() * 120);
        g.fillStyle = `rgb(${v},${v},${v + 20})`;
        g.fillRect(Math.random() * SW, Math.random() * SH, 6 + Math.random() * 60, 2 + Math.random() * 5);
      }
    } else if (boot < 1.25) {
      const k = smooth(0.35, 0.8, boot);
      g.fillStyle = c.color;
      g.fillRect(0, SH / 2 - (SH / 2) * k, SW, SH * k);
      g.save();
      g.translate(SW / 2, SH / 2 - 20 + (1 - k) * -220);
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '92px "Jersey 10", monospace';
      g.shadowColor = 'rgba(0,0,0,.35)';
      g.shadowOffsetY = 6;
      g.fillText(c.name, 0, 0, SW * 0.9);
      g.restore();
      if (boot > 0.85 && Math.floor(boot * 8) % 2) {
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.font = '34px "Jersey 10", monospace';
        g.fillText('SW ROBOTICS', SW / 2, SH * 0.74);
      }
    } else {
      const src = c.images[shot % Math.max(1, c.images.length)];
      const im = src ? load(src) : null;
      if (im?.complete && im.naturalWidth) {
        // dissolve through big pixels
        const f = clamp(shotT / 0.55);
        const prev = prevSrc ? images.get(prevSrc) : null;
        if (f < 1) {
          const showNew = f > 0.5;
          const q = showNew ? (1 - f) * 2 : f * 2;
          const px = Math.max(1, Math.round(1 + q * 34));
          const w = Math.max(8, Math.round(SW / px));
          const h = Math.max(5, Math.round(SH / px));
          small.width = w;
          small.height = h;
          const pic = showNew || !prev?.naturalWidth ? im : prev;
          cover(sg, pic, w, h);
          g.imageSmoothingEnabled = false;
          g.drawImage(small, 0, 0, w, h, 0, 0, SW, SH);
          g.imageSmoothingEnabled = true;
        } else {
          const z = 1 + Math.min(0.05, shotT * 0.012);
          g.save();
          g.translate(SW / 2, SH / 2);
          g.scale(z, z);
          g.translate(-SW / 2, -SH / 2);
          cover(g, im, SW, SH);
          g.restore();
        }
      }
      // page dots
      const n = c.images.length;
      for (let i = 0; i < n; i++) {
        g.fillStyle = i === shot % n ? '#fff' : 'rgba(255,255,255,.35)';
        g.fillRect(SW / 2 - n * 11 + i * 22, SH - 20, 14, 7);
      }
    }
    // LCD
    g.fillStyle = 'rgba(0,0,0,.16)';
    for (let y = 0; y < SH; y += 3) g.fillRect(0, y, SW, 1);
    const roll = ((t * 60) % (SH + 120)) - 60;
    const gr = g.createLinearGradient(0, roll - 50, 0, roll + 50);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,.05)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, roll - 50, SW, 100);
    screenTex.needsUpdate = true;
  };

  /* ---- shell --------------------------------------------------------- */
  const shellMat = M.solid(0xffc21a, 0.42);
  const bezelMat = M.solid(0x0c0e14, 0.3);
  const parts: THREE.Object3D[] = [];
  const keys: Record<string, { o: THREE.Object3D; z: number; d: number }> = {};
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex.glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4 }),
  );
  glow.position.z = 0.02;
  group.add(glow);

  let W = 8;
  let H = 4.2;
  const slot = new THREE.Vector3();
  let cartW = 1.4;

  const buildShell = () => {
    parts.forEach((p) => body.remove(p));
    parts.length = 0;
    const add = (o: THREE.Object3D) => {
      parts.push(o);
      body.add(o);
      return o;
    };
    const D = 0.46;
    const shape = roundedRect(W, H, H * 0.34);
    add(plate(shape, D, shellMat, 0.02, 0.09, 14));
    // bezel + screen
    const bw = W * 0.56;
    const bh = bw * (SH / SW) + W * 0.035;
    add(plate(roundedRect(bw + W * 0.03, bh, W * 0.022), 0.05, bezelMat, D + 0.005, 0.015, 8));
    screen.scale.set(bw * 0.985, bw * 0.985 * (SH / SW), 1);
    screen.position.set(0, 0, D + 0.062);
    add(screen);
    // cartridge slot at the top
    add(mesh(new THREE.BoxGeometry(W * 0.2, 0.1, 0.22), M.solid(0x1a1407, 0.8), 0, H / 2 - 0.02, D * 0.55 + 0.02));
    // d-pad
    const dz = D + 0.02;
    const dp = new THREE.Group();
    const arm = W * 0.048;
    dp.add(plate(roundedRect(arm * 3.4, arm * 1.12, 0.05), 0.16, bezelMat, 0, 0.03, 4));
    dp.add(plate(roundedRect(arm * 1.12, arm * 3.4, 0.05), 0.16, bezelMat, 0, 0.03, 4));
    dp.position.set(-W * 0.385, H * 0.02, dz);
    add(dp);
    keys.pad = { o: dp, z: dz, d: 0 };
    // buttons
    const mk = (k: string, x: number, y: number, hex: number) => {
      const b = cyl(W * 0.034, 0.17, M.solid(hex, 0.35), 0, 0, 0, 32, W * 0.031);
      const o = new THREE.Group();
      o.add(b);
      o.position.set(x, y, dz - 0.02);
      add(o);
      keys[k] = { o, z: dz - 0.02, d: 0 };
    };
    mk('a', W * 0.417, H * 0.085, 0xe5322d);
    mk('b', W * 0.345, -H * 0.085, 0x1747c9);
    // speaker holes
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) add(cyl(0.035, 0.02, bezelMat, W * 0.34 + i * 0.16, -H * 0.31 - j * 0.1 + i * 0.06, dz, 10));
    // start / select
    for (const s of [-1, 1]) {
      const p = plate(roundedRect(W * 0.05, W * 0.014, W * 0.007), 0.06, bezelMat, 0, 0.015, 6);
      p.position.set(-W * 0.385 + s * W * 0.034, -H * 0.36, dz);
      p.rotation.z = 0.3;
      add(p);
    }
    // power LED
    const led = cyl(0.045, 0.03, M.led(0x46ff8a), W * 0.31, H * 0.33, dz, 14);
    led.castShadow = false;
    add(led);
  };

  /* ---- cartridges ------------------------------------------------------ */
  const cs: Cart[] = carts.map((c, i) => {
    const o = new THREE.Group();
    const w = 1;
    const h = 1.12;
    const col = new THREE.Color(c.color);
    const dark = col.clone().multiplyScalar(0.55);
    const bodyM = new THREE.MeshLambertMaterial({ color: col });
    const darkM = new THREE.MeshLambertMaterial({ color: dark });
    const sh = roundedRect(w, h, 0.07);
    o.add(plate(sh, 0.16, bodyM, 0, 0.02, 6));
    for (let k = 0; k < 5; k++) {
      const rib = mesh(new THREE.BoxGeometry(0.035, 0.13, 0.03), darkM, -0.2 + k * 0.1, h / 2 - 0.1, 0.17);
      o.add(rib);
    }
    const lab = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.84, h * 0.64),
      new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    lab.position.set(0, -h * 0.1, 0.164);
    lab.receiveShadow = true;
    o.add(lab);
    // label art: first screenshot over a strip with the name
    if (c.images[0]) {
      const im = load(c.images[0]);
      const make = () => {
        const L = document.createElement('canvas');
        L.width = 384;
        L.height = 328;
        const q = L.getContext('2d')!;
        cover(q, im, 384, 328);
        q.fillStyle = c.color;
        q.fillRect(0, 248, 384, 80);
        q.fillStyle = '#fff';
        q.textAlign = 'center';
        q.textBaseline = 'middle';
        q.font = '62px "Jersey 10", monospace';
        q.fillText(c.name, 192, 290, 360);
        const tx = new THREE.CanvasTexture(L);
        tx.colorSpace = THREE.SRGBColorSpace;
        tx.anisotropy = 4;
        const m = lab.material as THREE.MeshLambertMaterial;
        m.map = tx;
        m.needsUpdate = true;
      };
      if (im.complete && im.naturalWidth) make();
      else im.addEventListener('load', make, { once: true });
    }
    group.add(o);
    return { g: o, home: new THREE.Vector3(), rot: Math.sin(i * 4.3) * 0.13, k: 0, lift: 0, scale: 1 };
  });

  let hovered = -1;
  let inserted = -1;

  const st: ConsoleStage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    margin: 240,
    current: 0,
    select(i, instant) {
      if (i === inserted && !instant) return;
      const old = inserted;
      inserted = i;
      st.current = i;
      if (old >= 0 && old !== i) gsap.to(cs[old], { k: 0, duration: 0.7, ease: 'power3.inOut', overwrite: true });
      if (instant) {
        cs[i].k = 1;
        boot = 2;
        return;
      }
      boot = -0.55;
      shot = 0;
      shotT = 0;
      prevSrc = '';
      gsap.to(cs[i], {
        k: 1,
        duration: 0.75,
        delay: 0.1,
        ease: 'power3.inOut',
        overwrite: true,
        onComplete: () => {
          boot = 0;
          gsap.fromTo(body.position, { y: -0.14 }, { y: 0, duration: 0.5, ease: 'elastic.out(1.4,0.35)' });
        },
      });
    },
    hover(i) {
      hovered = i;
    },
    press(k) {
      const key = keys[k === 'left' || k === 'right' ? 'pad' : k];
      if (!key) return;
      key.d = 1;
      if (k === 'left' || k === 'right') key.o.rotation.y = k === 'left' ? -0.12 : 0.12;
      gsap.to(key, { d: 0, duration: 0.35, ease: 'power2.out' });
      gsap.to(key.o.rotation, { y: 0, duration: 0.35 });
    },
    nextShot() {
      const c = carts[st.current];
      if (!c || boot < 1.25) return;
      prevSrc = c.images[shot % c.images.length];
      shot++;
      shotT = 0;
    },
    resize() {
      const host = el.getBoundingClientRect();
      const r = consoleEl.getBoundingClientRect();
      const ox = (r.left + r.width / 2 - host.left - host.width / 2) / 100;
      const oy = -(r.top + r.height / 2 - host.top - host.height / 2) / 100;
      W = r.width / 100;
      H = r.height / 100;
      buildShell();
      body.position.set(0, 0, 0);
      body.parent!.remove(body);
      const holder = (group.userData.holder as THREE.Group) ?? new THREE.Group();
      group.userData.holder = holder;
      holder.position.set(ox, oy, 0);
      holder.add(body);
      group.add(holder);
      glow.position.set(ox, oy, 0.02);
      glow.scale.set(W * 1.75, H * 2.3, 1);
      cartW = W * 0.175;
      slot.set(ox, oy + H / 2 + cartW * 0.3, 0.2);
      buttons.forEach((b, i) => {
        if (!cs[i]) return;
        const q = b.getBoundingClientRect();
        cs[i].home.set((q.left + q.width / 2 - host.left - host.width / 2) / 100, -(q.top + q.height / 2 - host.top - host.height / 2) / 100, 0.01);
        cs[i].scale = (Math.min(q.width, q.height * 0.86) / 100) * 0.94;
      });
    },
    update({ t, dt, world }) {
      boot += dt;
      shotT += dt;
      const c = carts[st.current];
      if (boot > 1.25 && c && shotT > 3 && c.images.length > 1) st.nextShot();
      paint += dt;
      if (paint > 1 / 24) {
        paint = 0;
        drawScreen(t);
      }
      for (const k in keys) keys[k].o.position.z = keys[k].z - keys[k].d * 0.07;
      const gm = glow.material as THREE.MeshBasicMaterial;
      if (c) gm.color.lerp(new THREE.Color(c.color), 1 - Math.exp(-dt * 4));
      gm.opacity = (boot < 0 ? 0.08 : 0.3 + Math.sin(t * 7) * 0.02) * (1 - world.room.v * 0.7);

      cs.forEach((k, i) => {
        const hot = hovered === i && inserted !== i ? 1 : 0;
        k.lift = damp(k.lift, hot, 10, dt);
        const e = k.k;
        // arc up, turn over the console, then slide down into the slot
        const go = smooth(0, 0.7, e);
        const drop = smooth(0.7, 1, e);
        const x = k.home.x + (slot.x - k.home.x) * go;
        const y = k.home.y + (slot.y + cartW * 0.75 - k.home.y) * go - cartW * 0.75 * drop;
        const z = k.home.z + Math.sin(Math.min(1, e / 0.72) * Math.PI) * 2.6 + k.lift * 0.5 + e * 0.12;
        k.g.position.set(x, y, z);
        const sc = k.scale + (cartW - k.scale) * go;
        k.g.scale.setScalar(sc * (1 + k.lift * 0.06));
        k.g.rotation.set(-k.lift * 0.18 + Math.sin(go * Math.PI) * -0.5, Math.sin(go * Math.PI) * 0.6 + k.lift * Math.sin(t * 3) * 0.06, k.rot * (1 - go) * (1 - k.lift * 0.7));
      });
    },
    dispose() {
      screenTex.dispose();
    },
  };
  return st;
}
