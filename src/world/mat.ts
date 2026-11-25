// The cutting mat: the ground the whole page sits on.
import * as THREE from 'three';
import { onTheme } from '../lib/theme';
import * as tex from './textures';

export interface MatUniforms {
  [k: string]: { value: any };
}

export function makeMat() {
  const u: MatUniforms = {
    uScroll: { value: 0 },
    uRes: { value: new THREE.Vector2(1440, 900) },
    uTime: { value: 0 },
    uLamp: { value: new THREE.Vector2() },
    uLampOn: { value: 0 },
    uRoom: { value: 0 },
    uSpark: { value: 0 },
    uSchem: { value: tex.schematic() },
    uNoise: { value: tex.matNoise() },
    uMat: { value: new THREE.Color('#252d38') },
    uMatDeep: { value: new THREE.Color('#1a2029') },
    uLine: { value: new THREE.Color('#a9bdd4') },
    uGlow: { value: new THREE.Color('#6fb4f2') },
    uHot: { value: new THREE.Color('#ffd257') },
    uDay: { value: 0 },
  };
  onTheme((light) => {
    u.uDay.value = light ? 1 : 0;
    u.uMat.value.set(light ? '#0f4fc9' : '#252d38');
    u.uMatDeep.value.set(light ? '#0b3ba2' : '#1a2029');
    u.uLine.value.set(light ? '#cfe0ff' : '#a9bdd4');
    u.uGlow.value.set(light ? '#8fd0ff' : '#6fb4f2');
  });

  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPx;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPx = (modelMatrix * vec4(position, 1.0)).xy * 100.0;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        varying vec2 vPx;
        uniform float uScroll, uTime, uLampOn, uRoom, uSpark, uDay;
        uniform vec2 uRes, uLamp;
        uniform sampler2D uSchem, uNoise;
        uniform vec3 uMat, uMatDeep, uLine, uGlow, uHot;
        float lineAt(float v, float cell, float w) {
          float d = abs(fract(v / cell - 0.5) - 0.5) * cell;
          float aa = fwidth(v) * 0.75;
          return 1.0 - smoothstep(w - aa, w + aa, d);
        }`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        // page space in px: x from the centre line, y down the page
        vec2 P = vec2(vPx.x, -vPx.y + uRes.y * 0.5 + uScroll);
        vec4 nz = texture2D(uNoise, P / 512.0);
        vec4 nzb = texture2D(uNoise, P / 2048.0 + 0.37);
        float cell = 40.0;
        float minorX = lineAt(P.x, cell, 0.5), minorY = lineAt(P.y, cell, 0.5);
        // minor lines are printed as dashes, like on a real mat
        float dashX = step(0.5, fract(P.y / 10.0)), dashY = step(0.5, fract(P.x / 10.0));
        float minor = max(minorX * dashX, minorY * dashY);
        float major = max(lineAt(P.x, cell * 5.0, 0.8), lineAt(P.y, cell * 5.0, 0.8));
        float diag = max(lineAt((P.x + P.y) * 0.7071, 1131.37, 0.7), lineAt((P.x - P.y) * 0.7071, 1131.37, 0.7));
        // ruler ticks down both edges
        float edge = uRes.x * 0.5 - abs(P.x);
        float tick = lineAt(P.y, 8.0, 0.5) * step(edge, 9.0) + lineAt(P.y, cell, 0.6) * step(edge, 18.0);
        float ink = minor * mix(0.07, 0.12, uDay) + major * mix(0.15, 0.24, uDay) + diag * mix(0.06, 0.10, uDay) + tick * mix(0.34, 0.45, uDay);
        vec3 ground = mix(uMatDeep, uMat, 0.55 + 0.45 * nzb.r * nz.r);
        ground *= 0.95 + 0.10 * nz.r;
        ground += nz.g * mix(vec3(0.012, 0.014, 0.018), vec3(0.05, 0.08, 0.16), uDay);
        diffuseColor.rgb = mix(ground, uLine, clamp(ink, 0.0, 1.0));
        `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `
        float dl = distance(vPx, uLamp);
        float reveal = exp(-dl * dl / (2.0 * 250.0 * 250.0)) * uLampOn;
        vec4 sc = texture2D(uSchem, vec2(P.x + uRes.x * 0.5, -P.y) / 2048.0);
        float trace = sc.r * (1.0 - sc.b * 0.4);
        // pulses run along every trace, brighter under the lamp
        float ph = fract(sc.g - uTime * 0.22);
        float pulse = smoothstep(0.86, 0.99, ph) * step(0.004, sc.g) * sc.r;
        float faint = mix(trace * 0.02 + (major * 0.016 + minor * 0.005 + tick * 0.05), trace * 0.014, uDay);
        vec3 glow = uGlow * trace * reveal * mix(0.2, 0.34, uDay) + mix(uGlow, uHot, 0.75) * pulse * (reveal * 1.9 + 0.015 + uSpark * 0.8);
        totalEmissiveRadiance += (glow + uGlow * faint) * mix(1.0, 0.55, uRoom);
        `,
      );
  };
  m.customProgramCacheKey = () => 'mat-v4';

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
  plane.receiveShadow = true;
  plane.frustumCulled = false;
  return { plane, u, material: m };
}

/** Dust in the lamp beam. */
export function makeDust(count: number) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3);
  const s = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = (Math.random() - 0.5) * 22;
    p[i * 3 + 1] = (Math.random() - 0.5) * 14;
    p[i * 3 + 2] = 0.3 + Math.random() * 4.6;
    s[i] = Math.random();
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
  const u = {
    uTime: { value: 0 },
    uLamp: { value: new THREE.Vector3() },
    uOn: { value: 0 },
    uDpr: { value: 1 },
    uScroll: { value: 0 },
    uTex: { value: tex.glow() },
  };
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float seed; uniform float uTime, uDpr, uScroll; uniform vec3 uLamp; varying float vA;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * (0.12 + seed * 0.2) + seed * 40.0) * 0.6;
        p.y += uTime * (0.03 + seed * 0.07) + uScroll * (0.35 + p.z * 0.05);
        p.y = mod(p.y + 7.0, 14.0) - 7.0;
        p.z += sin(uTime * 0.3 + seed * 20.0) * 0.3;
        float d = distance(p.xy, uLamp.xy);
        vA = exp(-d * d / 9.0) * (0.25 + 0.75 * seed);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + seed * 4.5) * uDpr * (14.0 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex; uniform float uOn; varying float vA;
      void main() { float a = texture2D(uTex, gl_PointCoord).a; gl_FragColor = vec4(vec3(1.0, 0.9, 0.72), a * vA * 0.5 * uOn); }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return { pts, u };
}
