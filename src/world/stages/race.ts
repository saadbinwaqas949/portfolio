// The wind tunnel: the race car side-on, with air drawn as lines that part
// around it. Lines speed up (and warm up) where they squeeze over the body.
import * as THREE from 'three';
import { clamp, damp, INK, mesh, smooth, strokes } from '../kit';
import { carSection, makeRaceCar } from '../models/extra';
import { M } from '../materials';
import * as tex from '../textures';
import type { Stage } from '../World';

export interface RaceStage extends Stage {
  /** 0..1 fan speed from scrolling */
  fan: number;
  launch(): void;
  onDone?: () => void;
}

/** Body outline for the air, wheels and wings folded in. */
function shape(x: number): [number, number] {
  let [, lo, hi] = carSection(x);
  if (x > 98 || x < -97) {
    const f = x > 0 ? smooth(150, 98, x) : smooth(-190, -97, x);
    const c = x > 0 ? 10 : 30;
    return [c, (x > 0 ? 3 : 15) * f];
  }
  for (const w of [66, -64]) {
    const d = Math.abs(x - w);
    if (d < 22) {
      const h = Math.sqrt(Math.max(0, 1 - (d / 22) ** 2)) * 15;
      hi = Math.max(hi, 15 + h);
      lo = Math.min(lo, 15 - h);
    }
  }
  return [(lo + hi) / 2, (hi - lo) / 2 + 2];
}

export function raceStage(el: HTMLElement): RaceStage {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);
  const car = makeRaceCar();
  const turn = new THREE.Group();
  turn.add(car.group);
  rig.add(turn);

  // ---- air ------------------------------------------------------------------
  const uAir = {
    ...INK,
    uSpeed: { value: 0 },
    uAlpha: { value: 1 },
    uHalf: { value: 300 },
  };
  const air = new THREE.ShaderMaterial({
    uniforms: uAir,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute float aU, aSeed, aFast;
      varying float vU, vSeed, vFast, vX; varying vec3 vW;
      void main() {
        vU = aU; vSeed = aSeed; vFast = aFast; vX = position.x;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLamp; uniform float uOn, uTime, uSpeed, uAlpha, uHalf;
      varying float vU, vSeed, vFast, vX; varying vec3 vW;
      void main() {
        float run = fract(vU * 2.6 + vSeed - uTime * (0.16 + 0.5 * uSpeed) * (0.8 + 0.5 * vFast));
        float dash = smoothstep(0.35, 1.0, run) * (1.0 - smoothstep(0.985, 1.0, run));
        float edge = 1.0 - smoothstep(uHalf * 0.72, uHalf, abs(vX));
        float lamp = exp(-dot(vW.xy - uLamp.xy, vW.xy - uLamp.xy) / 1.6) * uOn;
        vec3 cold = vec3(0.38, 0.68, 1.0);
        vec3 hot = vec3(1.0, 0.72, 0.16);
        vec3 c = mix(cold, hot, clamp(vFast * 1.15, 0.0, 1.0));
        float a = (0.06 + dash * (0.34 + 0.5 * uSpeed)) * edge * (1.0 + lamp * 1.6);
        gl_FragColor = vec4(c, a * uAlpha);
        #include <colorspace_fragment>
      }`,
  });
  const lines = new THREE.LineSegments(new THREE.BufferGeometry(), air);
  lines.frustumCulled = false;
  rig.add(lines);

  const buildAir = (half: number) => {
    uAir.uHalf.value = half;
    const pos: number[] = [];
    const u: number[] = [];
    const sd: number[] = [];
    const fa: number[] = [];
    const layers = [0, -22, 22, -40, 40];
    const bs = [-34, -24, -16, -10, -5.5, -2.4, 2.4, 5, 8, 12, 17, 23, 30, 38, 48, 60, 75, 94, 118];
    const SEG = 110;
    layers.forEach((d, li) => {
      const thick = Math.sqrt(Math.max(0, 1 - (d / 46) ** 2));
      bs.forEach((b0, bi) => {
        const seed = ((bi * 0.381 + li * 0.617 + bi * li * 0.13) % 1 + 1) % 1;
        const b = b0 + (seed - 0.5) * 2.4;
        if (li > 2 && bi % 2) return;
        let px = 0;
        let py = 0;
        for (let i = 0; i <= SEG; i++) {
          const x = half - (i / SEG) * half * 2;
          const [c, t] = shape(x);
          const T = t * thick;
          const mid = 24 + (c - 24) * Math.exp(-Math.abs(b) / 26) * smooth(210, 60, Math.abs(x));
          let y = mid + Math.sign(b) * Math.sqrt(b * b + T * T);
          // the wake
          const back = smooth(-96, -190, x) * Math.exp(-(b * b) / 420);
          y += back * Math.sin(x * 0.07 + seed * 20) * 6 * (0.5 + seed);
          y = Math.max(1.2, y);
          const fast = clamp((Math.sqrt(b * b + T * T) / Math.max(3, Math.abs(b)) - 1) * 0.34) * smooth(200, 80, Math.abs(x));
          if (i) {
            pos.push(px, py, -d, x, y, -d);
            u.push((i - 1) / SEG, i / SEG);
            sd.push(seed, seed);
            fa.push(fast, fast);
          }
          px = x;
          py = y;
        }
      });
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1));
    g.setAttribute('aFast', new THREE.Float32BufferAttribute(fa, 1));
    lines.geometry.dispose();
    lines.geometry = g;
  };

  // ---- track ------------------------------------------------------------------
  const road = new THREE.Group();
  rig.add(road);
  let ticks: THREE.LineSegments | null = null;
  const buildRoad = (half: number) => {
    road.clear();
    const s: number[] = [];
    s.push(-half, 0, 0, half, 0, 0, -half, 2.2, 0, half, 2.2, 0);
    road.add(strokes(s, 0x9fcbff, 0.4, 0.4));
    const t: number[] = [];
    for (let x = -half - 40; x < half + 40; x += 20) t.push(x, -2, 0, x - 5, -9, 0);
    ticks = strokes(t, 0x9fcbff, 0.3, 0.3);
    road.add(ticks);
  };

  // ---- CO2 --------------------------------------------------------------------
  const N = 150;
  const pp = new Float32Array(N * 3);
  const puffs = Array.from({ length: N }, () => ({ x: 0, y: -9999, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }));
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pm = new THREE.PointsMaterial({ map: tex.glow(), size: 0.34, color: 0xcfe6ff, transparent: true, opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const pts = new THREE.Points(pg, pm);
  pts.frustumCulled = false;
  rig.add(pts);
  let cur = 0;

  let half = 300;
  let K = 1;
  let spin = 0;
  let speed = 0;
  let run = -1; // seconds since the launch, or -1
  let yaw = 0;
  let pitch = 0;

  const floor = mesh(new THREE.PlaneGeometry(1, 1), M.solid(0x0c1016, 0.9));
  floor.visible = false;
  rig.add(floor);

  const st: RaceStage = {
    el,
    group,
    w: 0,
    h: 0,
    visible: false,
    margin: 120,
    fan: 0,
    launch() {
      if (run < 0) run = 0;
    },
    resize() {
      if (!st.w) return;
      K = Math.min((st.w * 0.58) / 205, (st.h * 0.66) / 95);
      rig.scale.setScalar(K / 100);
      rig.position.set(0, (-st.h * 0.2) / 100, 0.75);
      half = st.w / 2 / K + 30;
      buildAir(half);
      buildRoad(half);
    },
    update({ t, dt, world, cx, cy }) {
      const px = clamp((world.lampPos.x - cx) / 4, -1, 1);
      const py = clamp((world.lampPos.y - cy) / 3, -1, 1);
      yaw = damp(yaw, px * 0.2, 4, dt);
      pitch = damp(pitch, 0.12 + py * 0.1, 4, dt);
      turn.rotation.set(-Math.PI / 2 + pitch, 0, 0);
      car.group.rotation.z = yaw;
      let x = 0;
      let boost = 0;
      if (run >= 0) {
        run += dt;
        const out = half + 150;
        if (run < 1.25) {
          // squat, then go
          const q = smooth(0.05, 1.25, run);
          x = q * q * out - Math.sin(Math.min(1, run / 0.12) * Math.PI) * 5;
          boost = smooth(0, 0.25, run) * 3.4;
          for (let i = 0; i < 4; i++) {
            const p = puffs[cur++ % N];
            p.x = x - 100;
            p.y = 30 + (Math.random() - 0.5) * 8;
            p.z = (Math.random() - 0.5) * 12;
            p.vx = -160 - Math.random() * 320;
            p.vy = (Math.random() - 0.5) * 70;
            p.vz = (Math.random() - 0.5) * 70;
            p.life = 0.5 + Math.random() * 0.6;
          }
        } else if (run < 1.7) x = out * 4;
        else if (run < 3) {
          const q = 1 - smooth(1.7, 3, run);
          x = -q * q * out;
          boost = q * 2;
        } else {
          run = -1;
          st.onDone?.();
        }
      }
      const want = 0.25 + st.fan * 0.75 + boost;
      speed = damp(speed, want, 3, dt);
      uAir.uSpeed.value = Math.min(1.6, speed);
      // the air is drawn for a parked car, so it thins out while the car is away
      uAir.uAlpha.value = damp(uAir.uAlpha.value, 1 - clamp(Math.abs(x) / 160) * 0.85, 8, dt);
      turn.position.set(x, 0, 0);
      car.group.position.z = Math.sin(t * 61) * 0.25 * Math.min(1, speed);
      spin += dt * (4 + speed * 16 + boost * 10);
      car.wheels.forEach((w) => (w.rotation.y = -spin));
      if (ticks) ticks.position.x = -((t * (30 + speed * 190)) % 20);
      for (let i = 0; i < N; i++) {
        const p = puffs[i];
        p.life -= dt;
        if (p.life > 0) {
          p.x += p.vx * dt;
          p.y = Math.max(2, p.y + p.vy * dt);
          p.z += p.vz * dt;
          p.vx *= 1 - dt * 2.4;
        } else p.y = -9999;
        pp[i * 3] = p.x;
        pp[i * 3 + 1] = p.y;
        pp[i * 3 + 2] = p.z;
      }
      pg.attributes.position.needsUpdate = true;
    },
    dispose() {
      lines.geometry.dispose();
      air.dispose();
    },
  };
  return st;
}
