import * as THREE from 'three';
import { createRng, fbm3D, smoothstep } from '../utils/math';

export interface CloudsRig {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    wind: number,
    rainAmount: number,
    timeHours: number,
    reducedMotion: boolean
  ) => void;
}

interface CloudCluster {
  root: THREE.Group;
  meshGroup: THREE.Group;
  along: number;
  lateral: number;
  baseY: number;
  baseScale: number;
  speedMul: number;
  phase: number;
}

const DRIFT_SPAN_HALF = 9.2;

export function createClouds(): CloudsRig {
  const group = new THREE.Group();
  group.name = 'CloudsGroup';
  const rng = createRng(5209);

  // Shared cloud material adapted smoothly per-frame for sun, sunset, night, and storm rain
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xfffcf5,
    emissive: new THREE.Color(0xdce8f5),
    emissiveIntensity: 0.28,
    roughness: 0.94,
    metalness: 0.0,
    flatShading: true,
  });

  // Arranged around the upper sky perimeter so initial three-quarter view frames them cleanly above the island
  const specs = [
    { along: -3.9, lateral: -3.3, y: 3.95, scale: 1.04, puffs: 5 },
    { along: 2.5, lateral: -3.9, y: 4.22, scale: 1.16, puffs: 6 },
    { along: -0.5, lateral: -4.8, y: 4.42, scale: 0.92, puffs: 4 },
    { along: 4.9, lateral: -1.6, y: 3.82, scale: 0.94, puffs: 5 },
    { along: -5.3, lateral: 0.7, y: 3.88, scale: 0.98, puffs: 5 },
    { along: 1.6, lateral: 4.8, y: 4.25, scale: 0.85, puffs: 4 },
  ];

  const clouds: CloudCluster[] = [];

  for (const s of specs) {
    const root = new THREE.Group();
    const meshGroup = new THREE.Group();

    for (let p = 0; p < s.puffs; p++) {
      const frac = s.puffs > 1 ? p / (s.puffs - 1) - 0.5 : 0;
      const r = (0.34 + (1 - Math.abs(frac) * 1.1) * 0.24) * (0.9 + rng() * 0.2);
      const puffGeo = new THREE.IcosahedronGeometry(r, 1);
      const pos = puffGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        let vy = pos.getY(i);
        const vz = pos.getZ(i);
        const n = 0.92 + fbm3D(vx * 2.5 + p, vy * 2.5, vz * 2.5, 2) * 0.14;
        // Flatter bottom, billowy top like handcrafted miniature clouds
        if (vy < 0) vy *= 0.52;
        else vy *= 0.92;
        pos.setXYZ(i, vx * n * 1.18, vy * n, vz * n);
      }
      puffGeo.computeVertexNormals();

      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set(
        frac * 1.12 + (rng() - 0.5) * 0.14,
        (1 - Math.abs(frac) * 1.4) * 0.12 + (rng() - 0.5) * 0.06,
        (rng() - 0.5) * 0.28
      );
      puff.receiveShadow = true;
      meshGroup.add(puff);
    }

    meshGroup.rotation.y = (rng() - 0.5) * 0.7;
    root.add(meshGroup);
    group.add(root);

    clouds.push({
      root,
      meshGroup,
      along: s.along,
      lateral: s.lateral,
      baseY: s.y,
      baseScale: s.scale,
      speedMul: 0.82 + rng() * 0.36,
      phase: rng() * Math.PI * 2,
    });
  }

  // World wind direction (+0.88 X, +0.47 Z) and perpendicular lateral axis (-0.47 X, +0.88 Z)
  const dirX = 0.88;
  const dirZ = 0.47;
  const perpX = -0.47;
  const perpZ = 0.88;

  return {
    group,
    update(dt, elapsed, wind, rainAmount, timeHours, reducedMotion) {
      // Cloud color transitions across day, sunset/dawn, night, and rain storm clouds
      const sunAngle = ((timeHours - 6) / 24) * Math.PI * 2;
      const sunElev = Math.sin(sunAngle); // -1 midnight .. +1 noon

      const dayMix = smoothstep(-0.08, 0.28, sunElev);
      const twilightBand =
        (1 - Math.abs(sunElev) / 0.34) * (sunElev > -0.34 && sunElev < 0.34 ? 1 : 0);
      const sunsetMix = Math.max(0, Math.min(1, twilightBand));

      // Clear-sky cloud tint
      _tmpClearCloud.copy(_cNightCloud).lerp(_cDayCloud, dayMix);
      _tmpClearCloud.lerp(_cSunsetCloud, sunsetMix * 0.72);

      // Storm-cloud darkening when weather switches to Rain
      _tmpStormCloud.copy(_cNightStormCloud).lerp(_cDayStormCloud, dayMix);
      cloudMat.color.copy(_tmpClearCloud).lerp(_tmpStormCloud, rainAmount * 0.88);
      cloudMat.emissive.copy(cloudMat.color);
      cloudMat.emissiveIntensity = 0.26 * (1 - rainAmount * 0.35);

      // Drift speed controlled by shared wind state: stops drifting when wind === 0
      const motionFactor = reducedMotion ? 0.35 : 1.0;
      const driftVel = wind * 1.65 * motionFactor;

      for (const c of clouds) {
        c.along += driftVel * c.speedMul * dt;
        if (c.along > DRIFT_SPAN_HALF) {
          c.along -= DRIFT_SPAN_HALF * 2;
        }

        // Smooth scale taper near wrap-around boundaries so clouds never pop abruptly
        const edgeDist = DRIFT_SPAN_HALF - Math.abs(c.along);
        const edgeEnvelope = smoothstep(0.0, 1.8, edgeDist);

        // Clouds swell slightly thicker & lower during rain
        const stormSwell = 1 + rainAmount * 0.18;
        const bob = reducedMotion
          ? 0
          : Math.sin(elapsed * 0.65 + c.phase) * 0.06;

        const wx = c.along * dirX + c.lateral * perpX;
        const wz = c.along * dirZ + c.lateral * perpZ;
        const wy = c.baseY - rainAmount * 0.28 + bob;

        c.root.position.set(wx, wy, wz);
        const finalScale = Math.max(0.001, c.baseScale * stormSwell * edgeEnvelope);
        c.meshGroup.scale.set(finalScale, finalScale * (1 + rainAmount * 0.08), finalScale);
      }
    },
  };
}

const _cDayCloud = new THREE.Color(0xfffdf8);
const _cSunsetCloud = new THREE.Color(0xffb48a);
const _cNightCloud = new THREE.Color(0x3a4a68);
const _cDayStormCloud = new THREE.Color(0x637080);
const _cNightStormCloud = new THREE.Color(0x232d3e);
const _tmpClearCloud = new THREE.Color();
const _tmpStormCloud = new THREE.Color();
