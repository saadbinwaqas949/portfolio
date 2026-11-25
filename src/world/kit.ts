// Little helpers for building models out of primitives. Models are built in
// millimetres with +x right, +y up the page and +z towards the viewer.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Mat = THREE.Material | THREE.Material[];

export function mesh(geo: THREE.BufferGeometry, mat: Mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function group(...kids: THREE.Object3D[]) {
  const g = new THREE.Group();
  if (kids.length) g.add(...kids);
  return g;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

/** Box with its base sitting at z. */
export function box(w: number, h: number, d: number, mat: Mat, x = 0, y = 0, z = 0) {
  const g = cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  return mesh(g, mat, x, y, z + d / 2);
}

/** Cylinder standing on z. */
export function cyl(r: number, h: number, mat: Mat, x = 0, y = 0, z = 0, seg = 28, rTop = r) {
  const g = cached(`c${r},${rTop},${h},${seg}`, () => {
    const c = new THREE.CylinderGeometry(rTop, r, h, seg);
    c.rotateX(Math.PI / 2);
    return c;
  });
  return mesh(g, mat, x, y, z + h / 2);
}

/** Cylinder lying along x. */
export function cylX(r: number, len: number, mat: Mat, x = 0, y = 0, z = 0, seg = 24) {
  const g = cached(`cx${r},${len},${seg}`, () => {
    const c = new THREE.CylinderGeometry(r, r, len, seg);
    c.rotateZ(Math.PI / 2);
    return c;
  });
  return mesh(g, mat, x, y, z);
}

export function sphere(r: number, mat: Mat, x = 0, y = 0, z = 0, seg = 24) {
  const g = cached(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.6)));
  return mesh(g, mat, x, y, z);
}

export function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function circlePath(r: number, cx = 0, cy = 0) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}

/** Flat plate cut from a shape, base at z. */
export function plate(
  shape: THREE.Shape | THREE.Shape[],
  depth: number,
  mat: Mat,
  z = 0,
  bevel = 0,
  curveSegments = 12,
) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments,
  });
  g.translate(0, 0, bevel);
  return mesh(g, mat, 0, 0, z);
}

/** Rounded box lying flat, base at z. */
export function rbox(w: number, h: number, d: number, r: number, mat: Mat, x = 0, y = 0, z = 0, bevel = 0.8) {
  const m = plate(roundedRect(w, h, r), d, mat, 0, Math.min(bevel, d / 2 - 0.01), 5);
  m.position.set(x, y, z);
  return m;
}

/** A wire through a list of points. */
export function wire(pts: [number, number, number][], mat: Mat, r = 1.1, seg = 28) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, seg, r, 6, false), mat);
}

/** Sticker facing the viewer. */
export function decal(w: number, h: number, t: THREE.Texture, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({
      map: t,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent damping. */
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Pull one material group out of a geometry. */
function slice(g: THREE.BufferGeometry, start: number, count: number) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    out.setAttribute(
      name,
      new THREE.BufferAttribute((a.array as Float32Array).slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize),
    );
  }
  return out;
}

// Plain-colour parts all share two materials and carry their colour per vertex,
// so a whole robot body costs a handful of draw calls.
let vcSolid: THREE.MeshStandardMaterial | null = null;
let vcMetal: THREE.MeshStandardMaterial | null = null;
const solidMat = () => (vcSolid ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
const metalMat = () => (vcMetal ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.92 }));

function shared(mat: THREE.Material): THREE.Material {
  const m = mat as THREE.MeshStandardMaterial;
  if ((m.type !== 'MeshStandardMaterial' && m.type !== 'MeshLambertMaterial') || m.map || m.transparent || m.emissive.getHex() !== 0 || m.vertexColors) return mat;
  return (m.metalness ?? 0) > 0.4 ? metalMat() : solidMat();
}

/**
 * Merge everything under a node into one mesh per material. Nodes flagged with
 * userData.keep (wheels, props, anything animated) are left alone.
 */
export function bake(root: THREE.Object3D): THREE.Object3D {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const dead: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    if (o !== root && o.userData.keep) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && m.castShadow && !(m.material as THREE.Material).transparent && (m.material as THREE.Material).type !== 'MeshBasicMaterial') {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      const groups = [...m.geometry.groups];
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const n = g.getAttribute('position').count;
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      const add = (mat: THREE.Material, geo: THREE.BufferGeometry) => {
        geo.clearGroups();
        const to = shared(mat);
        if (to !== mat) {
          const c = (mat as THREE.MeshStandardMaterial).color;
          const k = geo.getAttribute('position').count;
          const arr = new Float32Array(k * 3);
          for (let i = 0; i < k; i++) arr.set([c.r, c.g, c.b], i * 3);
          geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        }
        if (!buckets.has(to)) buckets.set(to, []);
        buckets.get(to)!.push(geo);
      };
      if (Array.isArray(m.material)) {
        for (const gr of groups.length ? groups : [{ start: 0, count: n, materialIndex: 0 }])
          add(m.material[gr.materialIndex ?? 0], slice(g, gr.start, gr.count));
      } else add(m.material, g);
      dead.push(m);
    }
    for (const c of [...o.children]) walk(c);
  };
  walk(root);
  for (const m of dead) {
    for (const c of [...m.children]) root.attach(c);
    m.parent?.remove(m);
  }
  for (const [mat, list] of buckets) {
    const g = list.length > 1 ? mergeGeometries(list, false) : list[0];
    if (g) root.add(mesh(g, mat));
  }
  return root;
}

export const keep = <T extends THREE.Object3D>(o: T): T => {
  o.userData.keep = true;
  return o;
};
