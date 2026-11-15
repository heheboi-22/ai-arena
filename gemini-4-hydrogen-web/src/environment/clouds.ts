import * as THREE from "three";
import { createRng, lerp } from "../util/math";

export interface CloudsRig {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    windStrength: number,
    rainMix: number,
    daylight: number,
    twilight: number,
    nightness: number,
    reducedMotion: boolean
  ) => void;
  dispose: () => void;
}

interface CloudInstance {
  group: THREE.Group;
  baseY: number;
  baseZ: number;
  speedMul: number;
  phase: number;
}

const _dayCloud = new THREE.Color("#f7f4ec");
const _sunsetCloud = new THREE.Color("#f0b592");
const _nightCloud = new THREE.Color("#3b4a69");
const _rainDayCloud = new THREE.Color("#7c8794");
const _rainNightCloud = new THREE.Color("#252f42");
const _targetColor = new THREE.Color();
const _rainColor = new THREE.Color();

export function createClouds(): CloudsRig {
  const group = new THREE.Group();
  group.name = "Clouds";

  const disposables: { dispose: () => void }[] = [];
  const rng = createRng(5252);

  const puffGeo = new THREE.IcosahedronGeometry(1, 2);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: "#f7f4ec",
    roughness: 0.95,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92,
  });
  disposables.push(puffGeo, cloudMat);

  const cloudConfigs = [
    { x: -7.5, y: 6.1, z: -4.2, scale: 1.05, spd: 0.95 },
    { x: 1.8, y: 6.7, z: -5.6, scale: 1.25, spd: 0.8 },
    { x: 8.4, y: 5.7, z: -1.8, scale: 0.88, spd: 1.1 },
    { x: -4.2, y: 6.9, z: 4.5, scale: 0.92, spd: 0.9 },
    { x: 5.5, y: 6.3, z: 5.1, scale: 1.12, spd: 1.02 },
    { x: -11.0, y: 5.9, z: 1.2, scale: 0.84, spd: 1.15 },
  ];

  const clouds: CloudInstance[] = [];
  cloudConfigs.forEach((cfg, idx) => {
    const cg = new THREE.Group();
    cg.position.set(cfg.x, cfg.y, cfg.z);
    cg.scale.setScalar(cfg.scale);

    const puffSpecs: [number, number, number, number, number, number][] = [
      [0, 0.08, 0, 1.05, 0.62, 0.78],
      [-0.75, -0.05, 0.08, 0.78, 0.5, 0.65],
      [0.78, -0.04, -0.06, 0.82, 0.52, 0.68],
      [-0.32, 0.25, -0.15, 0.66, 0.48, 0.56],
      [0.35, 0.22, 0.14, 0.62, 0.45, 0.58],
    ];

    for (const [px, py, pz, sx, sy, sz] of puffSpecs) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set(px, py, pz);
      puff.scale.set(sx, sy, sz);
      puff.castShadow = false;
      puff.receiveShadow = true;
      cg.add(puff);
    }

    group.add(cg);
    clouds.push({
      group: cg,
      baseY: cfg.y,
      baseZ: cfg.z,
      speedMul: cfg.spd,
      phase: idx * 1.4 + rng(),
    });
  });

  const BOUND = 14.5;

  const update = (
    dt: number,
    elapsed: number,
    windStrength: number,
    rainMix: number,
    daylight: number,
    twilight: number,
    nightness: number,
    reducedMotion: boolean
  ) => {
    // Cloud color responds to time of day and storm rain
    _targetColor
      .copy(_nightCloud)
      .lerp(_dayCloud, daylight)
      .lerp(_sunsetCloud, twilight * 0.62);
    _rainColor.copy(_rainNightCloud).lerp(_rainDayCloud, daylight);
    _targetColor.lerp(_rainColor, rainMix * 0.88);
    cloudMat.color.copy(_targetColor);
    cloudMat.opacity = lerp(0.88, 0.96, rainMix) - nightness * 0.06;

    // Speed driven cleanly by windStrength (0 at zero wind)
    const speedBase = windStrength < 0.01 ? 0 : (0.18 + windStrength * 2.15) * (reducedMotion ? 0.4 : 1);

    for (const c of clouds) {
      c.group.position.x += speedBase * c.speedMul * dt;
      if (c.group.position.x > BOUND) {
        c.group.position.x = -BOUND;
      }
      const bob = reducedMotion ? 0 : Math.sin(elapsed * 0.45 + c.phase) * 0.08;
      // Slightly lower clouds during rain
      c.group.position.y = c.baseY - rainMix * 0.55 + bob;
      c.group.position.z = c.baseZ;
    }
  };

  const dispose = () => {
    for (const d of disposables) d.dispose();
  };

  return {
    group,
    update,
    dispose,
  };
}
