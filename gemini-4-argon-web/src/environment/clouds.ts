import * as THREE from 'three';

interface CloudCluster {
  group: THREE.Group;
  baseY: number;
  baseZ: number;
  baseScale: number;
  speedMult: number;
  phase: number;
}

export interface CloudSystem {
  group: THREE.Group;
  update: (
    elapsed: number,
    dt: number,
    windFactor: number,
    rainFactor: number,
    daylight: number,
    twilight: number,
    nightness: number,
    reducedMotion: boolean,
  ) => void;
}

export function createClouds(): CloudSystem {
  const group = new THREE.Group();
  group.name = 'CloudsSystem';

  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.92,
    metalness: 0.0,
    flatShading: true,
  });

  const puffGeo = new THREE.IcosahedronGeometry(1, 1);

  const cloudSpecs = [
    { x: -7.5, y: 6.4, z: -4.8, scale: 1.05, speed: 1.0 },
    { x: -1.8, y: 7.2, z: -6.5, scale: 1.22, speed: 0.85 },
    { x: 5.5, y: 6.6, z: -3.8, scale: 1.10, speed: 1.12 },
    { x: 8.2, y: 5.9, z: 2.4, scale: 0.92, speed: 0.95 },
    { x: -6.2, y: 6.1, z: 4.2, scale: 0.98, speed: 1.08 },
    { x: 1.5, y: 7.5, z: 5.8, scale: 1.15, speed: 0.88 },
    { x: -10.5, y: 6.8, z: -0.5, scale: 0.88, speed: 1.18 },
    { x: 10.8, y: 6.7, z: -1.6, scale: 1.02, speed: 0.92 },
  ];

  const puffsLayout = [
    { ox: 0.0, oy: 0.12, oz: 0.0, sx: 1.15, sy: 0.72, sz: 0.88 },
    { ox: -0.82, oy: -0.04, oz: 0.12, sx: 0.82, sy: 0.56, sz: 0.72 },
    { ox: 0.86, oy: 0.0, oz: -0.08, sx: 0.86, sy: 0.60, sz: 0.74 },
    { ox: -0.28, oy: 0.28, oz: -0.24, sx: 0.76, sy: 0.58, sz: 0.68 },
    { ox: 0.35, oy: 0.24, oz: 0.26, sx: 0.72, sy: 0.54, sz: 0.66 },
  ];

  const clusters: CloudCluster[] = [];

  cloudSpecs.forEach((spec, idx) => {
    const cGroup = new THREE.Group();
    cGroup.position.set(spec.x, spec.y, spec.z);
    cGroup.scale.setScalar(spec.scale);

    puffsLayout.forEach((pf, pIdx) => {
      const mesh = new THREE.Mesh(puffGeo, cloudMat);
      mesh.position.set(pf.ox, pf.oy, pf.oz);
      mesh.scale.set(pf.sx, pf.sy, pf.sz);
      mesh.rotation.set(pIdx * 0.4, idx * 0.8 + pIdx, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      cGroup.add(mesh);
    });

    group.add(cGroup);
    clusters.push({
      group: cGroup,
      baseY: spec.y,
      baseZ: spec.z,
      baseScale: spec.scale,
      speedMult: spec.speed,
      phase: idx * 1.45,
    });
  });

  const dayCol = new THREE.Color('#ffffff');
  const sunsetCol = new THREE.Color('#ffb58a');
  const nightCol = new THREE.Color('#5a7299');
  const rainCol = new THREE.Color('#576574');
  const targetCol = new THREE.Color();

  const wrapBound = 15.5;

  return {
    group,
    update: (
      elapsed: number,
      dt: number,
      windFactor: number,
      rainFactor: number,
      daylight: number,
      twilight: number,
      _nightness: number,
      reducedMotion: boolean,
    ) => {
      // Tint clouds by time of day and darken smoothly in rain
      targetCol
        .copy(nightCol)
        .lerp(dayCol, daylight)
        .lerp(sunsetCol, twilight * 0.85)
        .lerp(rainCol, rainFactor * 0.78);
      cloudMat.color.copy(targetCol);

      const driftSpeed = windFactor > 0.002 ? windFactor * 2.6 : 0;
      const bobScale = reducedMotion ? 0.2 : 1.0;

      for (const cl of clusters) {
        if (driftSpeed > 0) {
          cl.group.position.x -= driftSpeed * cl.speedMult * dt;
          if (cl.group.position.x < -wrapBound) {
            cl.group.position.x += wrapBound * 2;
          }
        }
        // In rain, clouds swell slightly and sit slightly lower over the island
        const rainScaleBoost = 1 + rainFactor * 0.22;
        cl.group.scale.setScalar(cl.baseScale * rainScaleBoost);
        cl.group.position.y =
          cl.baseY -
          rainFactor * 0.45 +
          Math.sin(elapsed * 0.9 + cl.phase) * 0.1 * bobScale;
      }
    },
  };
}
