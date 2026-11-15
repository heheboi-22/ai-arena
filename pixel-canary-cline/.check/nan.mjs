import * as THREE from 'three';
const im = await import('./islandMesh.mjs');
const root = im.buildIsland();
root.traverse((o) => {
  if (!o.geometry?.attributes?.position) return;
  const a = o.geometry.attributes.position.array;
  const bad = [];
  for (let i = 0; i < a.length; i += 3) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(a[i + 1]) || !Number.isFinite(a[i + 2])) bad.push([i / 3, a[i], a[i + 1], a[i + 2]]);
  }
  console.log(o.type, o.name, 'count', a.length / 3, 'bad', bad.length, bad.slice(0, 4));
});
