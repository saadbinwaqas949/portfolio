// A drawing for entries without a photo: a plotted curve that is different for
// every name, in the same line as everything else on the page.
export function Stamp({ seed }: { seed: string }) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const r = (n: number) => ((h >>> (n * 5)) & 31) / 31;
  const k = 3 + Math.floor(r(0) * 6);
  const m = 2 + Math.floor(r(1) * 5);
  const a = 22 + r(2) * 10;
  let d = '';
  for (let i = 0; i <= 260; i++) {
    const t = (i / 260) * Math.PI * 2;
    const q = a + Math.sin(t * k) * 11 + Math.cos(t * m * 2) * 5 * r(3);
    d += `${i ? 'L' : 'M'}${(50 + Math.cos(t) * q * 1.25).toFixed(1)} ${(38 + Math.sin(t) * q * 0.92).toFixed(1)}`;
  }
  return (
    <svg className="stamp" viewBox="0 0 100 76" aria-hidden>
      <path className="t" d="M50 2v72M4 38h92" />
      <circle className="t" cx="50" cy="38" r="31" />
      <path d={d} />
      <circle className="a" cx="50" cy="38" r="3.4" />
    </svg>
  );
}
