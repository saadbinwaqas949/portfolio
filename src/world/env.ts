// Something for metal to reflect: a dim blue room with a few softboxes.
// three.js normally prefilters an environment on the GPU, which costs over a
// second of shader compiling on integrated graphics. The room is simple enough
// to work out directly: every mip level is the same scene, blurred on paper.
import * as THREE from 'three';

const BASE = 64;

const BOXES = [
  { at: [0.45, 0.62, 0.65], size: 0.42, c: [5.2, 4.6, 3.8] },
  { at: [-0.75, 0.25, 0.6], size: 0.3, c: [2.0, 2.5, 3.6] },
  { at: [0.1, -0.72, 0.68], size: 0.22, c: [1.1, 1.2, 1.7] },
  { at: [-0.2, 0.95, -0.2], size: 0.5, c: [2.6, 2.8, 3.4] },
  { at: [0.95, 0.0, 0.1], size: 0.3, c: [1.6, 1.4, 1.2] },
].map((b) => ({ ...b, at: new THREE.Vector3(...(b.at as [number, number, number])).normalize() }));

// direction through a texel, per face, in the order +x -x +y -y +z -z
const FACES: ((s: number, t: number, v: THREE.Vector3) => THREE.Vector3)[] = [
  (s, t, v) => v.set(1, -t, -s),
  (s, t, v) => v.set(-1, -t, s),
  (s, t, v) => v.set(s, 1, t),
  (s, t, v) => v.set(s, -1, -t),
  (s, t, v) => v.set(s, -t, 1),
  (s, t, v) => v.set(-s, -t, -1),
];

const smooth = (x: number) => {
  const k = Math.max(0, Math.min(1, x));
  return k * k * (3 - 2 * k);
};

/** Light arriving along d, for a surface of the given roughness. */
function room(d: THREE.Vector3, rough: number, out: number[]) {
  const t = (d.y * 0.5 + 0.5) * (1 - rough * 0.45) + 0.5 * rough * 0.45;
  out[0] = 0.1 + 0.34 * t;
  out[1] = 0.13 + 0.4 * t;
  out[2] = 0.26 + 0.55 * t;
  for (const b of BOXES) {
    const dot = Math.max(-1, Math.min(1, d.dot(b.at)));
    const a = Math.acos(dot);
    // a sharp disc that spreads and dims as the surface gets rougher...
    const edge = 0.12 + rough * 1.1;
    const disc = smooth((b.size - a) / edge + 0.5) / (1 + ((rough * 1.5) / b.size) ** 2);
    // ...until only its diffuse share is left
    const share = ((2 * Math.PI * (1 - Math.cos(b.size))) / Math.PI) * Math.max(0, dot);
    const k = rough * rough;
    const f = disc * (1 - k) + share * k;
    out[0] += b.c[0] * f;
    out[1] += b.c[1] * f;
    out[2] += b.c[2] * f;
  }
}

function level(size: number, rough: number) {
  const v = new THREE.Vector3();
  const c = [0, 0, 0];
  const one = THREE.DataUtils.toHalfFloat(1);
  return FACES.map((dir) => {
    const px = new Uint16Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        dir(((x + 0.5) / size) * 2 - 1, ((y + 0.5) / size) * 2 - 1, v).normalize();
        room(v, rough, c);
        const i = (y * size + x) * 4;
        px[i] = THREE.DataUtils.toHalfFloat(c[0]);
        px[i + 1] = THREE.DataUtils.toHalfFloat(c[1]);
        px[i + 2] = THREE.DataUtils.toHalfFloat(c[2]);
        px[i + 3] = one;
      }
    const t = new THREE.DataTexture(px, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
    t.needsUpdate = true;
    return t;
  });
}

export function makeEnvironment(): THREE.CubeTexture {
  const mips: THREE.DataTexture[][] = [];
  const count = Math.log2(BASE); // levels after the first
  const max = count - 1; // the 1x1 level is there only to complete the chain
  for (let lod = 1; lod <= count; lod++) {
    const rough = 1 - Math.sqrt(Math.max(0, 1 - lod / max));
    mips.push(level(BASE >> lod, rough));
  }
  const cube = new THREE.CubeTexture(level(BASE, 0) as unknown as HTMLImageElement[]);
  cube.format = THREE.RGBAFormat;
  cube.type = THREE.HalfFloatType;
  cube.colorSpace = THREE.LinearSRGBColorSpace;
  cube.mapping = THREE.CubeReflectionMapping;
  cube.minFilter = THREE.LinearMipmapLinearFilter;
  cube.magFilter = THREE.LinearFilter;
  cube.generateMipmaps = false;
  (cube as any).mipmaps = mips.map((faces) => ({ image: faces }));
  // tells the renderer this one is already prefiltered
  (cube as any).isPMREMTexture = true;
  cube.needsUpdate = true;
  return cube;
}
