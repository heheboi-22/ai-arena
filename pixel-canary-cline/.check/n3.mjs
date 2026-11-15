const { groundAt, silhouette, EDGE } = await import('./island.mjs');
let bad = 0;
for (let k = 0; k < 1440; k += 1) {
  const t = (k / 1440) * Math.PI * 2;
  const v = groundAt(Math.cos(t) * EDGE, Math.sin(t) * EDGE);
  if (!Number.isFinite(v)) { bad += 1; if (bad < 3) console.log('rimNaN', t.toFixed(3), v, silhouette(t)); }
}
console.log('rim NaN samples', bad, 'EDGE', EDGE, 'sil range sample', silhouette(0), silhouette(3));
let bad2 = 0;
for (let x = -4.2; x <= 4.2; x += 0.06) for (let z = -4.2; z <= 4.2; z += 0.06) { const v = groundAt(x, z); if (!Number.isFinite(v)) { bad2 += 1; if (bad2 < 4) console.log('gridNaN', x.toFixed(2), z.toFixed(2), v); } }
console.log('grid NaN samples', bad2);
