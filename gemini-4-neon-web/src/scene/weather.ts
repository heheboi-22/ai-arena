import * as THREE from "three";
import { AtmosphereSnapshot, WindDerived, clamp } from "../state/worldState";
import {
  LANDMARKS,
  WATER_LEVEL,
  createRng,
  getRainStopHeightAt,
  isInsidePond,
} from "./terrainMath";

export interface WeatherSystem {
  group: THREE.Group;
  update: (
    dt: number,
    rainFactor: number,
    wind: WindDerived,
    atmosphere: AtmosphereSnapshot,
    reducedMotion: boolean
  ) => void;
  dispose: () => void;
}

interface RainDrop {
  x: number;
  y: number;
  z: number;
  speedMult: number;
  lengthMult: number;
}

interface PondRipple {
  mesh: THREE.Mesh;
  active: boolean;
  age: number;
  maxAge: number;
  maxScale: number;
}

const RAIN_COUNT = 300;
const RIPPLE_COUNT = 18;

export function createWeatherSystem(): WeatherSystem {
  const group = new THREE.Group();
  group.name = "WeatherSystem";
  const disposables: Array<{ dispose: () => void }> = [];
  const rng = createRng(4040);

  // 1. Pooled 3D rain streaks via InstancedMesh (zero allocations per frame)
  const dropGeo = new THREE.CylinderGeometry(0.011, 0.014, 0.58, 4, 1, true);
  const dropMat = new THREE.MeshBasicMaterial({
    color: 0xd4e5f5,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  disposables.push(dropGeo, dropMat);

  const rainMesh = new THREE.InstancedMesh(dropGeo, dropMat, RAIN_COUNT);
  rainMesh.frustumCulled = false;
  rainMesh.visible = false;
  group.add(rainMesh);

  const drops: RainDrop[] = [];
  const spawnDrop = (d: RainDrop, randomY: boolean) => {
    // Spawn above the island footprint plus slight upwind lead so slanted rain covers the whole island
    const angle = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * 8.6;
    d.x = Math.cos(angle) * rad - 1.2;
    d.z = Math.sin(angle) * rad - 0.8;
    d.y = randomY ? 1.5 + rng() * 11.0 : 9.5 + rng() * 3.8;
    d.speedMult = 0.88 + rng() * 0.28;
    d.lengthMult = 0.78 + rng() * 0.45;
  };

  for (let i = 0; i < RAIN_COUNT; i++) {
    const drop: RainDrop = { x: 0, y: 0, z: 0, speedMult: 1, lengthMult: 1 };
    spawnDrop(drop, true);
    drops.push(drop);
  }

  // 2. Pooled concentric pond ripple rings placed strictly inside the pond perimeter
  const rippleGeo = new THREE.RingGeometry(0.68, 1.0, 24);
  rippleGeo.rotateX(-Math.PI / 2);
  disposables.push(rippleGeo);

  const ripples: PondRipple[] = [];
  for (let i = 0; i < RIPPLE_COUNT; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xe2f1fa,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    disposables.push(mat);
    const mesh = new THREE.Mesh(rippleGeo, mat);
    mesh.position.set(LANDMARKS.pond.x, WATER_LEVEL + 0.018, LANDMARKS.pond.z);
    mesh.visible = false;
    mesh.renderOrder = 3;
    group.add(mesh);
    ripples.push({
      mesh,
      active: false,
      age: 0,
      maxAge: 0.9,
      maxScale: 0.45,
    });
  }

  const spawnRipple = (ripple: PondRipple) => {
    // Rejection-sample cleanly inside pond water so ripples never clip onto grass or stones
    for (let attempt = 0; attempt < 16; attempt++) {
      const rx = LANDMARKS.pond.x + (rng() * 2 - 1) * (LANDMARKS.pond.rx * 0.82);
      const rz = LANDMARKS.pond.z + (rng() * 2 - 1) * (LANDMARKS.pond.rz * 0.82);
      if (isInsidePond(rx, rz, 0.82)) {
        ripple.mesh.position.set(rx, WATER_LEVEL + 0.022, rz);
        ripple.active = true;
        ripple.age = 0;
        ripple.maxAge = 0.78 + rng() * 0.42;
        ripple.maxScale = 0.34 + rng() * 0.32;
        ripple.mesh.visible = true;
        return;
      }
    }
  };

  // Pre-allocated scratch helpers (zero GC inside update loop)
  const _dummy = new THREE.Object3D();
  const _velDir = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _quat = new THREE.Quaternion();
  let rippleSpawnAccum = 0;

  return {
    group,
    update: (dt, rainFactor, wind, atmosphere, reducedMotion) => {
      const activeRain = clamp(rainFactor, 0, 1);

      // Update rain particles
      if (activeRain < 0.008) {
        rainMesh.visible = false;
      } else {
        rainMesh.visible = true;
        const speedScale = reducedMotion ? 0.35 : 1.0;
        const vx = wind.rainVelocityX * speedScale;
        const vy = wind.rainVelocityY * speedScale;
        const vz = wind.rainVelocityZ * speedScale;

        // Orient rain streaks along velocity vector (vertical when wind === 0, slanted when windy)
        _velDir.set(-vx, -vy, -vz).normalize();
        _quat.setFromUnitVectors(_up, _velDir);

        // Adaptive rain brightness so streaks stay legible at both day and night
        const tint = atmosphere.daylight * 0.25 + 0.72;
        dropMat.color.setRGB(0.8 * tint, 0.88 * tint, 0.96 * tint);
        dropMat.opacity = activeRain * (0.42 + atmosphere.nightFactor * 0.14);

        const activeCount = Math.max(1, Math.floor(RAIN_COUNT * clamp(activeRain * 1.15, 0.05, 1)));
        rainMesh.count = activeCount;

        for (let i = 0; i < activeCount; i++) {
          const d = drops[i];
          d.x += vx * dt * d.speedMult;
          d.y += vy * dt * d.speedMult;
          d.z += vz * dt * d.speedMult;

          // Terminate cleanly on island top / pond surface so drops never pass through the island!
          const stopY = getRainStopHeightAt(d.x, d.z);
          if (stopY !== null) {
            if (d.y <= stopY + 0.12) {
              spawnDrop(d, false);
            }
          } else if (d.y < -6.8) {
            // Outside the island rim, recycle well below the underside
            spawnDrop(d, false);
          }

          _dummy.position.set(d.x, d.y, d.z);
          _dummy.quaternion.copy(_quat);
          _dummy.scale.set(1, d.lengthMult, 1);
          _dummy.updateMatrix();
          rainMesh.setMatrixAt(i, _dummy.matrix);
        }
        rainMesh.instanceMatrix.needsUpdate = true;
      }

      // Update pooled pond ripples
      if (activeRain > 0.05) {
        const spawnRate = (reducedMotion ? 7 : 22) * activeRain;
        rippleSpawnAccum += dt * spawnRate;
        while (rippleSpawnAccum >= 1) {
          rippleSpawnAccum -= 1;
          const freeRipple = ripples.find((r) => !r.active);
          if (freeRipple) {
            spawnRipple(freeRipple);
          }
        }
      } else {
        rippleSpawnAccum = 0;
      }

      for (const r of ripples) {
        if (!r.active) continue;
        r.age += dt * (reducedMotion ? 0.5 : 1.0);
        if (r.age >= r.maxAge) {
          r.active = false;
          r.mesh.visible = false;
          continue;
        }
        const progress = r.age / r.maxAge;
        const eased = 1 - Math.pow(1 - progress, 2);
        const sc = 0.08 + eased * r.maxScale;
        r.mesh.scale.setScalar(sc);

        const fade = Math.sin(progress * Math.PI) * (1 - progress * 0.35);
        const mat = r.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = fade * 0.82 * Math.max(activeRain, 0.35);
        mat.color.setRGB(
          0.84 + atmosphere.daylight * 0.14,
          0.91 + atmosphere.daylight * 0.08,
          0.98
        );
      }
    },
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
