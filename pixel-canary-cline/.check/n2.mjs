const m = await import('./islandMesh.mjs');
let bad = 0;
for (let k = 0; k < 720; k += 1) {
  const t = (k / 720) * Math.PI * 2;
  const v = m.groundAt(Math.cos(t) * 4, Math.sin(t) * 4);
  if (!Number.isFinite(v)) { bad += 1; if (bad < 4) console.log('NaN at', t.toFixed(3), v); }
}
console.log('rim NaN samples', bad);
const { fbm2 } = await import('/home/aorus/Project/testing/pixel-canary-cline/src/noise.ts').catch(() => ({ fbm2: null }));
console.log('fbm2 direct', fbm2 && fbm2(13.3, -3.9, 3));
