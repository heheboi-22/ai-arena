import * as THREE from '/home/aorus/Project/testing/pixel-canary-cline/node_modules/three/build/three.module.js';
const bad = (label, geo) => {
  const p = geo?.attributes?.position;
  if (!p) return console.log('MISSING position', label);
  let nan = 0;
  for (let i = 0; i < p.array.length; i += 1) if (!Number.isFinite(p.array[i])) nan += 1;
  if (nan) console.log('NAN', label, nan, 'of', p.array.length);
};
const walk = (label, root) => {
  root.traverse?.((o) => {
    if (o.geometry) bad(label + '/' + (o.type + ':' + (o.name || '')), o.geometry);
    if (o.instanceMatrix) {
      let nan = 0;
      for (const v of o.instanceMatrix.array) if (!Number.isFinite(v)) nan += 1;
      if (nan) console.log('NAN-INSTANCE', label + '/' + o.type, nan, 'of', o.instanceMatrix.array.length);
    }
  });
};
const im = await import('./islandMesh.mjs');
walk('island', im.buildIsland());
const pond = await import('./pond.mjs');
walk('pond', pond.buildPond().group);
const props = await import('./props.mjs');
walk('path', props.buildPath());
walk('fence', props.buildFence());
walk('rocks', props.buildRocks());
walk('cover', props.buildGroundCover(60));
const veg = await import('./vegetation.mjs');
walk('veg', veg.buildVegetation().group);
const clouds = await import('./clouds.mjs');
walk('clouds', clouds.buildClouds().group);
const mill = await import('./windmill.mjs');
walk('mill', mill.buildWindmill().group);
console.log('check done');
