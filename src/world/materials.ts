import * as THREE from 'three';
import { onTheme } from '../lib/theme';
import * as tex from './textures';

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
/** Matte surfaces: a much lighter shader than the physical one. */
const matte = ({ roughness, metalness, ...p }: THREE.MeshStandardMaterialParameters) => {
  void roughness;
  void metalness;
  return new THREE.MeshLambertMaterial(p as THREE.MeshLambertMaterialParameters);
};

const store = new Map<string, THREE.Material>();
function once<T extends THREE.Material>(key: string, make: () => T): T {
  let m = store.get(key) as T | undefined;
  if (!m) store.set(key, (m = make()));
  return m;
}

/** Clone a shared texture with its own tiling. */
export function tiled(t: THREE.Texture, rx: number, ry: number) {
  const c = t.clone();
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  return c;
}

export const M = {
  // ---- cardboard -----------------------------------------------------
  kraftFace: () => once('kraftFace', () => matte({ map: tiled(tex.kraftBox(), 1 / 20, 1 / 10), roughness: 0.92 })),
  kraft: () => once('kraft', () => matte({ map: tiled(tex.kraft(), 1 / 6, 1 / 6), roughness: 0.94 })),
  kraftMM: () => once('kraftMM', () => matte({ map: tiled(tex.kraft(), 1 / 260, 1 / 260), roughness: 0.94 })),
  kraftEdge: () => once('kraftEdge', () => matte({ map: tiled(tex.kraftEdge(), 1 / 0.3, 1 / 0.17), roughness: 0.95 })),
  kraftEdgeMM: () => once('kraftEdgeMM', () => matte({ map: tiled(tex.kraftEdge(), 1 / 14, 1 / 6), roughness: 0.95 })),

  // ---- night: gunmetal letters, black card --------------------------------
  gun: () => once('gun', () => std({ color: 0x3a424e, roughness: 0.46, metalness: 0.62 })),
  gunEdge: () => once('gunEdge', () => std({ color: 0x161a21, roughness: 0.6, metalness: 0.4 })),
  kraftNight: () => once('kraftNight', () => matte({ map: tiled(tex.kraft(), 1 / 6, 1 / 6), color: 0x4a433d, roughness: 0.94 })),
  kraftNightEdge: () => once('kraftNightEdge', () => matte({ map: tiled(tex.kraftEdge(), 1 / 0.3, 1 / 0.17), color: 0x7a6a58, roughness: 0.95 })),

  // ---- carbon ----------------------------------------------------------
  carbon: (scale = 1) =>
    once('carbon' + scale, () =>
      std({
        map: tiled(tex.carbonMap(), scale, scale),
        normalMap: tiled(tex.carbonNormal(), scale, scale),
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughness: 0.4,
        metalness: 0.15,
      }),
    ),
  carbonEdge: () => once('carbonEdge', () => std({ color: 0x1b1d22, roughness: 0.6, metalness: 0.1 })),

  // ---- woods and plastics ------------------------------------------------
  wood: () => once('wood', () => matte({ map: tiled(tex.wood(), 1 / 130, 1 / 60), roughness: 0.8 })),
  woodU: () => once('woodU', () => matte({ map: tiled(tex.wood(), 1 / 3, 1 / 1.4), roughness: 0.8 })),
  tt: () => once('tt', () => std({ color: 0xffc21a, roughness: 0.46 })), // yellow gear motors, XT60
  ttDark: () => once('ttDark', () => std({ color: 0xd99a00, roughness: 0.5 })),
  rubber: () =>
    once('rubber', () => {
      // a little glow of its own, so tyres keep their shape in the dark
      const m = matte({ color: 0x17181b, emissive: 0x1c222b });
      onTheme((light) => {
        m.color.setHex(light ? 0x17181b : 0x2a2e35);
        m.emissiveIntensity = light ? 0 : 1;
      });
      return m;
    }),
  black: () => once('black', () => std({ color: 0x121317, roughness: 0.55 })),
  blackGloss: () => once('blackGloss', () => std({ color: 0x0e0f12, roughness: 0.22 })),
  grey: () => once('grey', () => std({ color: 0x59606c, roughness: 0.6 })),
  white: () => once('white', () => std({ color: 0xf2f4f8, roughness: 0.55 })),
  red: () => once('red', () => std({ color: 0xd42a24, roughness: 0.48 })),
  blue: () => once('blue', () => std({ color: 0x1747c9, roughness: 0.45 })),
  green: () => once('green', () => std({ color: 0x1f9d58, roughness: 0.5 })),
  orange: () => once('orange', () => std({ color: 0xff6a1a, roughness: 0.5 })),
  cream: () => once('cream', () => matte({ color: 0xf1e7cf, roughness: 0.7 })),
  solid: (hex: number, roughness = 0.5, metalness = 0) =>
    once(`solid${hex}-${roughness}-${metalness}`, () => (roughness >= 0.7 && !metalness ? matte({ color: hex }) : std({ color: hex, roughness, metalness }))),

  // ---- boards -------------------------------------------------------------
  pcbBlue: () => once('pcbBlue', () => matte({ map: tiled(tex.pcb('b', '#0f5f86', '#2c88ae', 5), 1 / 90, 1 / 90), roughness: 0.38 })),
  pcbRed: () => once('pcbRed', () => matte({ map: tiled(tex.pcb('r', '#a3161b', '#cf3a3a', 9), 1 / 90, 1 / 90), roughness: 0.4 })),
  pcbBlack: () => once('pcbBlack', () => matte({ map: tiled(tex.pcb('k', '#14161c', '#333a47', 13), 1 / 70, 1 / 70), roughness: 0.36 })),
  pcbGreen: () => once('pcbGreen', () => matte({ map: tiled(tex.pcb('g', '#0f5a3a', '#23835a', 17), 1 / 90, 1 / 90), roughness: 0.4 })),

  // ---- metals ---------------------------------------------------------------
  alu: () => once('alu', () => std({ color: 0xcdd3dc, roughness: 0.34, metalness: 1 })),
  steel: () => once('steel', () => std({ color: 0x8b93a0, roughness: 0.3, metalness: 1 })),
  darkMetal: () => once('darkMetal', () => std({ color: 0x2a2e36, roughness: 0.4, metalness: 0.9 })),
  gold: () => once('gold', () => std({ color: 0xffc44d, roughness: 0.3, metalness: 0.92, emissive: 0x3a2400, emissiveIntensity: 0.7 })),
  silver: () => once('silver', () => std({ color: 0xdfe5ee, roughness: 0.26, metalness: 1 })),
  bronze: () => once('bronze', () => std({ color: 0xc27a45, roughness: 0.32, metalness: 1 })),
  anodBlue: () => once('anodBlue', () => std({ color: 0x1f56ff, roughness: 0.3, metalness: 0.75 })),
  anodRed: () => once('anodRed', () => std({ color: 0xe2232a, roughness: 0.3, metalness: 0.7 })),
  copper: () => once('copper', () => std({ color: 0xd98448, roughness: 0.4, metalness: 0.9 })),

  tape: () =>
    once('tape', () => matte({ color: 0xf1dfae, roughness: 0.55, emissive: 0x5c5030, transparent: true, opacity: 0.9 })),

  lens: () =>
    once('lens', () => std({ color: 0x0a0d1d, roughness: 0.06, metalness: 0.4 })),

  prop: (hex = 0xffc21a) =>
    once(
      'prop' + hex,
      () => matte({ color: hex, transparent: true, opacity: 0.94, side: THREE.DoubleSide }),
    ),

  led: (hex: number) => once('led' + hex, () => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false })),
};
