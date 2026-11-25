// The bench. One fixed WebGL canvas behind the page; 100 px = 1 unit and the
// mat lies at z = 0, so anything placed on it lines up with the DOM exactly.
import * as THREE from 'three';
import { makeEnvironment } from './env';
import { makeDust, makeMat } from './mat';
import { damp, lerp } from './kit';
import { Track } from './track';

export const U = 100;
const CAM = 14; // camera height in units: sets how strong the perspective is

export interface Frame {
  t: number;
  dt: number;
  world: World;
  /** centre of the stage element in world units */
  cx: number;
  cy: number;
}

export interface Stage {
  el: HTMLElement;
  group: THREE.Object3D;
  /** size of the element in px */
  w: number;
  h: number;
  visible: boolean;
  /** the line follower goes underneath this one */
  cover?: boolean;
  rect?: DOMRect;
  /** shaders are compiled, safe to draw */
  ready?: boolean;
  /** extra px around the viewport in which the stage keeps running */
  margin?: number;
  update?(f: Frame): void;
  resize?(world: World): void;
  dispose?(): void;
}

export type Quality = 'high' | 'mid' | 'low' | 'min';

/**
 * What each tier may spend. Shadows are never switched off, only made coarser
 * and refreshed less often: turning one off would recompile every shader.
 */
const TIERS: Record<Quality, { px: number; dpr: number; lamp: number; sky: number; lampEvery: number; skyEvery: number }> = {
  high: { px: 4.4e6, dpr: 1.75, lamp: 2048, sky: 2048, lampEvery: 1, skyEvery: 1 },
  mid: { px: 2.1e6, dpr: 1.4, lamp: 1024, sky: 1024, lampEvery: 1, skyEvery: 2 },
  low: { px: 1.35e6, dpr: 1, lamp: 1024, sky: 512, lampEvery: 2, skyEvery: 4 },
  min: { px: 0.85e6, dpr: 1, lamp: 512, sky: 256, lampEvery: 3, skyEvery: 6 },
};
const ORDER: Quality[] = ['high', 'mid', 'low', 'min'];

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  lamp: THREE.SpotLight;
  sky: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  mat = makeMat();
  dust = makeDust(130);
  track = new Track();
  stages = new Set<Stage>();
  canvas: HTMLCanvasElement;

  vw = 1;
  vh = 1;
  over = 0; // canvas overscan in px (touch only)
  scrollY = 0;
  /** scroll position with pinned distance removed: this is where the mat is */
  worldScroll = 0;
  scrollVel = 0;
  t = 0;

  touch = matchMedia('(hover: none), (pointer: coarse)').matches;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  quality: Quality;

  pointer = { x: 0, y: 0, cx: 0, cy: 0, seen: false, down: false, speed: 0 };
  lampPos = new THREE.Vector3(0, 0, 4.2);
  private lampVel = new THREE.Vector2();
  /** 0..1, driven by the intro flicker */
  lampPower = { v: 0 };
  /** 0 = lamp only, 1 = ceiling light on */
  room = { v: 0 };
  spark = { v: 0 };
  /** places that can pull the lamp on touch screens */
  attract: { x: number; y: number } | null = null;
  /** a section can pull the lamp towards a point; w is how hard */
  lock = { x: 0, y: 0, w: 0 };

  private pins: HTMLElement[] = [];
  private pinInfo: { top: number; len: number }[] = [];
  private frameTimes: number[] = [];
  private frameNo = 0;
  private lastChange = 0;
  private ceiling: Quality = 'high';
  paused = false;
  onFrame = new Set<(w: World, dt: number) => void>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
    this.quality = this.touch || weak ? 'mid' : 'high';
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.setClearColor(0x0a1b55, 1);
    // integrated graphics start one step down
    try {
      const gl = r.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      if (/intel|uhd|iris|mali|adreno|powervr|swiftshader|llvmpipe/i.test(name) && this.quality === 'high') this.quality = 'mid';
    } catch {
      /* keep the default */
    }

    this.scene.environment = makeEnvironment();

    this.hemi = new THREE.HemisphereLight(0x9db4ff, 0x10206a, 0.5);
    this.scene.add(this.hemi);

    this.sky = new THREE.DirectionalLight(0xbfd0ff, 0.5);
    this.sky.position.set(-4, 5, 9);
    this.sky.castShadow = true;
    this.sky.shadow.bias = -0.0004;
    this.sky.shadow.normalBias = 0.02;
    this.sky.shadow.radius = 5;
    this.scene.add(this.sky, this.sky.target);

    this.lamp = new THREE.SpotLight(0xfff0dc, 60, 0, 0.98, 1, 1.5);
    this.lamp.castShadow = true;
    this.lamp.shadow.bias = -0.0006;
    this.lamp.shadow.normalBias = 0.03;
    this.lamp.shadow.camera.near = 0.3;
    this.lamp.shadow.camera.far = 14;
    this.lamp.shadow.radius = 4;
    this.scene.add(this.lamp, this.lamp.target);

    this.scene.add(this.mat.plane, this.dust.pts, this.track.group);
    this.ceiling = this.quality;
    this.resize();
    this.bind();
  }

  private bind() {
    const move = (x: number, y: number) => {
      const p = this.pointer;
      p.speed = Math.hypot(x - p.cx, y - p.cy);
      p.cx = x;
      p.cy = y;
      p.x = (x - this.vw / 2) / U;
      p.y = -(y - this.vh / 2) / U;
      p.seen = true;
    };
    addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
    addEventListener(
      'pointerdown',
      (e) => {
        move(e.clientX, e.clientY);
        this.pointer.down = true;
      },
      { passive: true },
    );
    addEventListener('pointerup', () => (this.pointer.down = false), { passive: true });
    addEventListener('pointercancel', () => (this.pointer.down = false), { passive: true });
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      this.paused = document.hidden;
      this.frameTimes.length = 0;
    });
  }

  applyQuality() {
    const q = TIERS[this.quality];
    const area = Math.max(1, (this.vw || innerWidth) * ((this.vh || innerHeight) + this.over * 2));
    const dpr = Math.min(devicePixelRatio || 1, q.dpr, Math.sqrt(q.px / area));
    this.renderer.setPixelRatio(Math.max(0.5, dpr));
    const size = (l: THREE.DirectionalLight | THREE.SpotLight, n: number, every: number) => {
      l.shadow.autoUpdate = every === 1;
      l.shadow.needsUpdate = true;
      if (l.shadow.mapSize.x !== n) {
        l.shadow.mapSize.set(n, n);
        l.shadow.map?.dispose();
        (l.shadow as any).map = null;
      }
    };
    size(this.lamp, q.lamp, q.lampEvery);
    size(this.sky, q.sky, q.skyEvery);
    this.dust.u.uDpr.value = this.renderer.getPixelRatio();
    this.dust.pts.visible = this.quality !== 'min' && !this.reduced;
  }

  private lastW = 0;
  private lastH = 0;
  resize(force = false) {
    const vw = document.documentElement.clientWidth;
    let vh = innerHeight;
    // ignore address-bar wobble on phones
    if (!force && this.touch && vw === this.lastW && Math.abs(vh - this.lastH) < 140) return;
    this.lastW = vw;
    this.lastH = vh;
    this.vw = vw;
    this.vh = vh;
    this.over = this.touch ? Math.round(vh * 0.14) : 0;
    const H = vh + this.over * 2;
    this.applyQuality();
    this.renderer.setSize(vw, H, false);
    const c = this.canvas.style;
    c.width = vw + 'px';
    c.height = H + 'px';
    if (this.touch) {
      c.position = 'absolute';
      c.top = -this.over + 'px';
    } else {
      c.position = 'fixed';
      c.top = '0';
    }
    this.camera.aspect = vw / H;
    this.camera.fov = (2 * Math.atan(H / U / 2 / CAM) * 180) / Math.PI;
    this.camera.position.set(0, 0, CAM);
    this.camera.updateProjectionMatrix();
    this.mat.plane.scale.set(vw / U + 8, H / U + 8, 1);
    this.mat.u.uRes.value.set(vw, vh);

    const s = this.sky.shadow.camera;
    const hw = vw / U / 2 + 2.5;
    const hh = H / U / 2 + 2.5;
    s.left = -hw;
    s.right = hw;
    s.top = hh;
    s.bottom = -hh;
    s.near = 0.5;
    s.far = 24;
    s.updateProjectionMatrix();
    this.measure();
  }

  /** Re-read layout: pinned sections, stage sizes, the track. */
  measure() {
    const sy = scrollY;
    this.pins = Array.from(document.querySelectorAll<HTMLElement>('[data-pin]'));
    this.pinInfo = this.pins.map((p) => {
      const r = p.getBoundingClientRect();
      return { top: r.top + sy, len: Math.max(0, r.height - this.vh) };
    });
    for (const s of this.stages) this.sizeStage(s);
    this.track.build(this);
  }

  private sizeStage(s: Stage) {
    const w = s.el.offsetWidth;
    const h = s.el.offsetHeight;
    s.w = w;
    s.h = h;
    s.resize?.(this);
  }

  /** Pinned distance used up at a given page scroll. */
  pinned(y: number) {
    let c = 0;
    for (const p of this.pinInfo) c += Math.min(p.len, Math.max(0, y - p.top));
    return c;
  }

  /** Where a page position lands on the mat once pins above it are spent. */
  toMatY(pageY: number) {
    let c = 0;
    for (const p of this.pinInfo) if (pageY > p.top + this.vh) c += Math.min(p.len, Math.max(0, pageY - p.top - this.vh));
    return pageY - c;
  }

  add(s: Stage) {
    this.stages.add(s);
    this.scene.add(s.group);
    s.visible = false;
    s.group.visible = false;
    this.sizeStage(s);
    if (this.started) {
      // compile in the background, then let it be drawn
      s.ready = false;
      s.group.visible = true;
      this.renderer
        .compileAsync(s.group, this.camera, this.scene)
        .catch(() => undefined)
        .then(() => (s.ready = true));
      s.group.visible = false;
    } else s.ready = true;
    return () => {
      this.stages.delete(s);
      this.scene.remove(s.group);
      s.dispose?.();
    };
  }

  // ---- build things only when they are about to be needed -----------------
  started = false;
  /** off until the intro has had the first second to itself */
  canBuild = false;
  private pending: { el: HTMLElement; run: () => void }[] = [];
  private lastBuild = 0;
  private quietSince = 0;

  /** Run a builder once its element is within a couple of screens, or when idle. */
  lazy(el: HTMLElement, run: () => void) {
    const job = { el, run };
    if (this.reach(el) < 1.1) {
      run();
      return () => {};
    }
    this.pending.push(job);
    return () => {
      const i = this.pending.indexOf(job);
      if (i >= 0) this.pending.splice(i, 1);
    };
  }

  /** Distance from the viewport in screen heights, 0 when visible. */
  private reach(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const gap = r.top > this.vh ? r.top - this.vh : r.bottom < 0 ? -r.bottom : 0;
    return gap / this.vh;
  }

  private buildSome() {
    if (!this.pending.length || !this.canBuild) return;
    const now = this.t;
    if (Math.abs(this.scrollVel) > 30) this.quietSince = now;
    // one at a time, nearest first
    if (now - this.lastBuild < 0.08) return;
    this.lastBuild = now;
    let best = -1;
    let d = Infinity;
    for (let i = 0; i < this.pending.length; i++) {
      const g = this.reach(this.pending[i].el);
      if (g < d) {
        d = g;
        best = i;
      }
    }
    const idle = now - this.quietSince > 1.2 && now > 5;
    if (d < 1.4 || (idle && now - this.lastIdle > 0.45)) {
      this.lastIdle = now;
      const [job] = this.pending.splice(best, 1);
      job.run();
    }
  }
  private lastIdle = 0;

  /** Is a point on the mat hidden by a sheet? */
  covered(x: number, y: number, pad = 0) {
    for (const s of this.stages) {
      if (!s.cover || !s.visible || !s.rect) continue;
      const r = s.rect;
      if (x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad) return true;
    }
    return false;
  }

  /** Client px to world units on the mat. */
  toWorld(x: number, y: number, out = new THREE.Vector2()) {
    return out.set((x - this.vw / 2) / U, -(y - this.vh / 2) / U);
  }

  private v3 = new THREE.Vector3();
  /** World position to client px. */
  project(p: THREE.Vector3) {
    const v = this.v3.copy(p).project(this.camera);
    const H = this.vh + this.over * 2;
    return { x: ((v.x + 1) / 2) * this.vw, y: ((1 - v.y) / 2) * H - this.over };
  }

  tick(dt: number) {
    if (this.paused) return;
    const raw = dt;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const t = this.t;

    // ---- scroll ---------------------------------------------------------
    const y = window.scrollY;
    const ws = y - this.pinned(y);
    this.scrollVel = damp(this.scrollVel, (y - this.scrollY) / Math.max(dt, 0.001), 8, dt);
    this.scrollY = y;
    this.worldScroll = ws;
    if (this.touch) this.canvas.style.transform = `translate3d(0,${y}px,0)`;

    // ---- lamp -------------------------------------------------------------
    let tx: number;
    let ty: number;
    const p = this.pointer;
    if (this.touch || !p.seen) {
      if (this.attract) {
        tx = this.attract.x;
        ty = this.attract.y;
      } else {
        const hx = this.vw / U / 2;
        const hy = this.vh / U / 2;
        tx = Math.sin(t * 0.55) * hx * 0.62;
        ty = Math.sin(t * 0.83 + 1.1) * hy * 0.5;
      }
      if (p.down && p.seen) {
        tx = p.x;
        ty = p.y;
      }
    } else {
      tx = p.x;
      ty = p.y;
    }
    tx += (this.lock.x - tx) * this.lock.w;
    ty += (this.lock.y - ty) * this.lock.w;
    // a heavy lamp on a springy arm
    const k = 70;
    const c = 13;
    this.lampVel.x += ((tx - this.lampPos.x) * k - this.lampVel.x * c) * dt;
    this.lampVel.y += ((ty - this.lampPos.y) * k - this.lampVel.y * c) * dt;
    this.lampPos.x += this.lampVel.x * dt;
    this.lampPos.y += this.lampVel.y * dt;
    const power = this.lampPower.v;
    const room = Math.max(this.room.v, this.touch ? 0.2 : 0);
    this.lamp.position.copy(this.lampPos);
    this.lamp.target.position.set(this.lampPos.x - this.lampVel.x * 0.04, this.lampPos.y - this.lampVel.y * 0.04, 0);
    this.lamp.intensity = power * lerp(50, 14, room);
    this.sky.intensity = lerp(0.5, 2.3, room);
    this.hemi.intensity = lerp(0.3, 1.1, room);
    this.scene.environmentIntensity = lerp(0.36, 0.75, room);

    const mu = this.mat.u;
    mu.uScroll.value = ws;
    mu.uTime.value = t;
    mu.uLamp.value.set(this.lampPos.x * U, this.lampPos.y * U);
    mu.uLampOn.value = power;
    mu.uRoom.value = room;
    mu.uSpark.value = this.spark.v;
    const du = this.dust.u;
    du.uTime.value = t;
    du.uOn.value = power * (1 - room * 0.8);
    du.uLamp.value.copy(this.lampPos);
    du.uScroll.value = ws / U;

    for (const f of this.onFrame) f(this, dt);

    // ---- stages -------------------------------------------------------------
    for (const s of this.stages) {
      const r = s.el.getBoundingClientRect();
      const m = s.margin ?? 160;
      const vis = s.ready !== false && r.bottom > -m && r.top < this.vh + m && r.width > 0;
      s.visible = vis;
      s.rect = r;
      s.group.visible = vis;
      if (!vis) continue;
      const cx = (r.left + r.width / 2 - this.vw / 2) / U;
      const cy = -(r.top + r.height / 2 - this.vh / 2) / U;
      s.group.position.x = cx;
      s.group.position.y = cy;
      s.update?.({ t, dt, world: this, cx, cy });
    }
    this.track.update(this, dt);

    // coarser tiers refresh their shadows on alternate frames, never both at once
    const tier = TIERS[this.quality];
    this.frameNo++;
    if (tier.lampEvery > 1) this.lamp.shadow.needsUpdate = this.frameNo % tier.lampEvery === 0;
    if (tier.skyEvery > 1) this.sky.shadow.needsUpdate = this.frameNo % tier.skyEvery === 1;

    this.renderer.render(this.scene, this.camera);
    this.buildSome();
    this.watchSpeed(raw);
  }

  private slow = 0;
  private fast = 0;
  private ups = 0;
  /** Step down when the machine is struggling, back up if it was only busy. */
  private watchSpeed(dt: number) {
    // ignore the opening seconds and single long frames
    if (this.t < 7 || dt > 0.09) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 100) return;
    const list = this.frameTimes.sort((x, y) => x - y);
    const typical = list[60];
    this.frameTimes = [];
    this.slow = typical > 1 / 36 ? this.slow + 1 : 0;
    this.fast = typical < 1 / 56 ? this.fast + 1 : 0;
    const i = ORDER.indexOf(this.quality);
    const go = (q: Quality) => {
      this.quality = q;
      this.slow = this.fast = 0;
      this.lastChange = this.t;
      if (import.meta.env.DEV) console.info(`Quality: ${q} (${Math.round(1 / typical)} fps)`);
      this.resize(true);
    };
    if (this.t - this.lastChange < 4) return;
    if (this.slow >= 2 && i < ORDER.length - 1) go(ORDER[i + 1]);
    else if (this.fast >= 8 && this.ups < 2 && i > ORDER.indexOf(this.ceiling)) {
      this.ups++;
      go(ORDER[i - 1]);
    }
  }
}

/* ------------------------------------------------------------------ */
/* One shared world, created lazily                                     */
/* ------------------------------------------------------------------ */

let world: World | null = null;
const waiting: ((w: World) => void)[] = [];

export function createWorld(canvas: HTMLCanvasElement): World | null {
  if (world) return world;
  try {
    world = new World(canvas);
  } catch (err) {
    console.warn('WebGL is not available, showing the flat version.', err);
    document.documentElement.classList.add('no-webgl');
    return null;
  }
  document.documentElement.classList.add('webgl');
  if (import.meta.env.DEV) (window as any).__world = world;
  waiting.splice(0).forEach((f) => f(world!));
  return world;
}

export function whenWorld(f: (w: World) => void): () => void {
  if (world) {
    f(world);
    return () => {};
  }
  waiting.push(f);
  return () => {
    const i = waiting.indexOf(f);
    if (i >= 0) waiting.splice(i, 1);
  };
}

export const getWorld = () => world;
