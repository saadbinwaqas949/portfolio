// A tiny FPV simulator. Steer with the pointer, thread the gates. Drawn as
// plain lines on a 2D canvas with an OSD on top, like the goggles feed.
import { useEffect, useRef } from 'react';
import { gsap, isTouch, reduced } from '../lib/motion';

interface Gate {
  x: number;
  y: number;
  z: number;
  hit: boolean;
  passed: boolean;
  hue: number;
}

export function SimRun({ label }: { label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    let W = 0;
    let H = 0;
    let dpr = 1;
    const size = () => {
      const r = cv.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      W = r.width;
      H = r.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cv);

    let px = 0;
    let py = 0;
    let aimX = 0;
    let aimY = 0;
    let vx = 0;
    let vy = 0;
    let roll = 0;
    let dist = 0;
    let score = 0;
    let best = 0;
    let streak = 0;
    let noise = 0.9;
    let flash = 0;
    let engaged = 0;
    let speed = 15;
    const gates: Gate[] = [];
    let nextZ = 26;
    let lastX = 0;
    let lastY = 1.2;
    const COLORS = ['#ffc21a', '#46ff8a', '#ff5a4d', '#58b4ff'];
    const spawn = () => {
      while (nextZ < dist + 130) {
        lastX = Math.max(-5.5, Math.min(5.5, lastX + (Math.random() - 0.5) * 7));
        lastY = Math.max(0.9, Math.min(3.6, lastY + (Math.random() - 0.5) * 2.4));
        gates.push({ x: lastX, y: lastY, z: nextZ, hit: false, passed: false, hue: Math.floor(Math.random() * 4) });
        nextZ += 15 + Math.random() * 7;
      }
    };
    const posts = Array.from({ length: 46 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (9 + Math.random() * 26), z: i * 5 + Math.random() * 4, h: 1 + Math.random() * 5 }));

    const move = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      aimX = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      aimY = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      engaged = 2.2;
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerdown', move);

    const F = 0.82; // focal length
    const project = (x: number, y: number, z: number) => {
      const dz = z - dist;
      if (dz < 0.25) return null;
      const k = (F * H) / dz;
      const X = (x - px) * k;
      const Y = -(y - py) * k;
      const c = Math.cos(roll);
      const s = Math.sin(roll);
      return { x: W / 2 + X * c - Y * s, y: H * 0.52 + X * s + Y * c, k, dz };
    };

    const line = (a: ReturnType<typeof project>, b: ReturnType<typeof project>) => {
      if (!a || !b) return;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    };

    let on = false;
    let t = 0;
    const calm = reduced();

    const frame = (_: number, delta: number) => {
      const dt = Math.min(0.04, delta / 1000);
      t += dt;
      engaged = Math.max(0, engaged - dt);
      spawn();

      // autopilot flies a lazy line until somebody takes the sticks
      const next = gates.find((k) => k.z > dist + 1);
      let wantX: number;
      let wantY: number;
      if (engaged > 0) {
        wantX = px + aimX * 5.2;
        wantY = py - aimY * 3.2;
      } else {
        wantX = next ? next.x + Math.sin(t * 0.9) * 0.4 : 0;
        wantY = next ? next.y : 1.5;
      }
      vx += ((wantX - px) * 5.5 - vx * 2.6) * dt;
      vy += ((wantY - py) * 5.5 - vy * 2.6) * dt;
      px += vx * dt;
      py = Math.max(0.35, py + vy * dt);
      px = Math.max(-9, Math.min(9, px));
      roll += (-vx * 0.085 - roll) * (1 - Math.exp(-dt * 6));
      speed += ((engaged > 0 ? 17 : 13) - speed) * dt;
      dist += speed * dt * (calm ? 0.25 : 1);

      for (const k of gates) {
        if (!k.passed && k.z <= dist + 0.5) {
          k.passed = true;
          const inX = Math.abs(k.x - px) < 1.55;
          const inY = Math.abs(k.y - py) < 1.55;
          if (inX && inY) {
            k.hit = true;
            if (engaged > 0) {
              score++;
              streak++;
              best = Math.max(best, streak);
            }
            flash = 1;
          } else if (engaged > 0) {
            streak = 0;
            if (Math.abs(k.x - px) < 2.5 && Math.abs(k.y - py) < 2.5) noise = 1;
            else noise = Math.max(noise, 0.35);
          }
        }
      }
      while (gates.length && gates[0].z < dist - 2) gates.shift();
      noise = Math.max(0.05, noise - dt * 0.9);
      flash = Math.max(0, flash - dt * 3);

      // ---- draw -----------------------------------------------------------
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#6d7b98');
      sky.addColorStop(0.46, '#c8a9a0');
      sky.addColorStop(0.53, '#e6bf9a');
      sky.addColorStop(0.531, '#2f3b36');
      sky.addColorStop(1, '#151d1c');
      g.save();
      g.translate(W / 2, H * 0.52 + (py - 1.5) * 8);
      g.rotate(roll);
      g.fillStyle = sky;
      g.translate(0, -H * 0.53);
      g.fillRect(-W, -H * 0.4, W * 2, H * 1.9);
      // tree line
      g.fillStyle = '#232c2a';
      g.beginPath();
      g.moveTo(-W, H * 0.535);
      for (let i = 0; i <= 60; i++) {
        const x = -W + (i / 60) * W * 2;
        const n = Math.sin(i * 1.7 + px * 0.02) * 4 + Math.sin(i * 4.1) * 6;
        g.lineTo(x - px * 3, H * 0.524 - Math.abs(n) - 3);
      }
      g.lineTo(W, H * 0.535);
      g.fill();
      g.restore();

      // ground grid
      g.lineWidth = 1;
      const gz = Math.floor(dist / 4) * 4;
      for (let i = 0; i < 24; i++) {
        const z = gz + i * 4;
        const fade = Math.max(0, 1 - i / 24);
        g.strokeStyle = `rgba(190,214,196,${0.26 * fade})`;
        line(project(-40, 0, z), project(40, 0, z));
      }
      for (let i = -8; i <= 8; i++) {
        g.strokeStyle = 'rgba(190,214,196,.16)';
        line(project(i * 5, 0, dist + 0.5), project(i * 5, 0, dist + 95));
      }
      // posts
      for (const q of posts) {
        while (q.z < dist + 1) q.z += 46 * 5;
        const a = project(q.x, 0, q.z);
        const b = project(q.x, q.h, q.z);
        if (!a || !b || a.dz > 110) continue;
        g.strokeStyle = `rgba(24,32,32,${Math.max(0, 1 - a.dz / 110)})`;
        g.lineWidth = Math.max(1, a.k * 0.07);
        line(a, b);
      }
      // gates, far to near
      g.lineJoin = 'round';
      for (let i = gates.length - 1; i >= 0; i--) {
        const k = gates[i];
        const R = 1.5;
        const c = [
          [-R, -R],
          [R, -R],
          [R, R],
          [-R, R],
        ].map(([x, y]) => project(k.x + x, Math.max(0, k.y + y), k.z));
        if (c.some((v) => !v)) continue;
        const near = c[0]!.dz;
        const fade = Math.max(0, Math.min(1, 1.25 - near / 100));
        g.globalAlpha = fade;
        g.strokeStyle = k.hit ? '#46ff8a' : COLORS[k.hue];
        g.lineWidth = Math.max(2, c[0]!.k * 0.26);
        g.beginPath();
        c.forEach((v, n) => (n ? g.lineTo(v!.x, v!.y) : g.moveTo(v!.x, v!.y)));
        g.closePath();
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.85)';
        g.lineWidth = Math.max(1, c[0]!.k * 0.05);
        g.stroke();
        // legs
        const l1 = project(k.x - R, 0, k.z);
        const l2 = project(k.x + R, 0, k.z);
        g.strokeStyle = 'rgba(16,20,24,.8)';
        g.lineWidth = Math.max(1, c[0]!.k * 0.06);
        line(c[0], l1);
        line(c[1], l2);
        g.globalAlpha = 1;
      }

      // analogue video
      g.fillStyle = 'rgba(0,0,0,.14)';
      for (let y = (t * 50) % 4; y < H; y += 4) g.fillRect(0, y, W, 1);
      if (noise > 0.03 && !calm) {
        const n = Math.floor(noise * 120);
        for (let i = 0; i < n; i++) {
          g.fillStyle = `rgba(255,255,255,${Math.random() * 0.5 * noise})`;
          g.fillRect(Math.random() * W, Math.random() * H, 10 + Math.random() * 90 * noise, 1 + Math.random() * 2.4);
        }
        if (noise > 0.5) {
          const y = Math.random() * H;
          g.drawImage(cv, 0, y * dpr, cv.width, 26 * dpr, (Math.random() - 0.5) * 60, y, W, 26);
        }
      }
      if (flash > 0) {
        g.strokeStyle = `rgba(70,255,138,${flash})`;
        g.lineWidth = 10 * flash;
        g.strokeRect(5, 5, W - 10, H - 10);
      }
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.68);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,.6)');
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);

      // OSD
      const fs = Math.max(17, Math.min(30, W * 0.034));
      g.font = `${fs}px "Jersey 10", monospace`;
      g.textBaseline = 'alphabetic';
      const osd = (s: string, x: number, y: number, al: CanvasTextAlign = 'left', col = '#fff') => {
        g.textAlign = al;
        g.lineWidth = 4;
        g.strokeStyle = 'rgba(0,0,0,.85)';
        g.strokeText(s, x, y);
        g.fillStyle = col;
        g.fillText(s, x, y);
      };
      const m = Math.max(16, W * 0.035);
      const volt = Math.max(14.2, 16.8 - (t * 0.012) % 2.6);
      osd(`${volt.toFixed(1)}V`, m, H - m, 'left', volt < 14.8 ? '#ff5a4d' : '#fff');
      const mins = Math.floor(t / 60);
      osd(`${String(mins).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`, W - m, H - m, 'right');
      osd(engaged > 0 ? 'ACRO' : 'AUTO', W / 2, H - m, 'center');
      osd(`GATES ${score}`, m, m + fs * 0.7);
      osd(`BEST ${best}`, W - m, m + fs * 0.7, 'right');
      osd('R5 5806', W / 2, m + fs * 0.7, 'center');
      // horizon + crosshair
      g.save();
      g.translate(W / 2, H / 2);
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-16, 0);
      g.lineTo(-5, 0);
      g.moveTo(5, 0);
      g.lineTo(16, 0);
      g.moveTo(0, -4);
      g.lineTo(0, 4);
      g.stroke();
      g.rotate(roll);
      g.globalAlpha = 0.8;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * W * 0.13, 0);
        g.lineTo(s * W * 0.2, 0);
        g.lineTo(s * W * 0.2, 7);
        g.stroke();
      }
      g.restore();
      if (engaged <= 0 && Math.floor(t * 1.6) % 2 === 0) osd(isTouch() ? 'DRAG TO STEER' : 'MOVE TO STEER', W / 2, H * 0.72, 'center', '#ffc21a');
    };

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !on) {
        on = true;
        noise = 1;
        gsap.ticker.add(frame);
      } else if (!e.isIntersecting && on) {
        on = false;
        gsap.ticker.remove(frame);
      }
    });
    io.observe(cv);
    return () => {
      io.disconnect();
      ro.disconnect();
      gsap.ticker.remove(frame);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerdown', move);
    };
  }, []);

  return <canvas ref={ref} className="sim-cv" role="img" aria-label={label} data-cursor="Fly" style={{ touchAction: 'pan-y' }} />;
}
