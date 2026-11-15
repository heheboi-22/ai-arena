import * as THREE from 'three';
import {
  POND_CENTER,
  POND_WATER_Y,
  SmoothedWorldState,
  getIslandSurfaceStopY,
} from '../state/worldState';

const RAIN_COUNT = 280;
const RIPPLE_POOL_SIZE = 18;
const RAIN_SPAWN_MIN_Y = 7.2;
const RAIN_SPAWN_MAX_Y = 9.8;
const RAIN_OUTER_MISS_Y = -4.2;

interface RainDrop {
  x: number;
  y: number;
  z: number;
  speed: number;
  lengthScale: number;
}

interface RippleSlot {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
  maxAge: number;
  maxScale: number;
}

export interface WeatherEffectsController {
  group: THREE.Group;
  update(smoothed: SmoothedWorldState, dt: number): void;
  getActiveRippleCount(): number;
  getRainInstancedMesh(): THREE.InstancedMesh;
  getDropPosition(index: number): { x: number; y: number; z: number };
  dispose(): void;
}

export function createWeatherEffects(): WeatherEffectsController {
  const group = new THREE.Group();
  group.name = 'WeatherEffects';

  // Deterministic PRNG for clean, repeatable distribution
  let seed = 9001;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // 1. Pooled InstancedMesh for 3D rain streaks
  const dropGeo = new THREE.CylinderGeometry(0.008, 0.01, 0.38, 4);
  const rainMat = new THREE.MeshBasicMaterial({
    color: 0xb9d3ec,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const rainMesh = new THREE.InstancedMesh(dropGeo, rainMat, RAIN_COUNT);
  rainMesh.name = 'RainParticles';
  rainMesh.frustumCulled = false;
  rainMesh.visible = false;
  group.add(rainMesh);

  const drops: RainDrop[] = [];
  const spawnDrop = (drop: RainDrop, randomHeight: boolean) => {
    // Bias ~72% of drops inside the island/pond radius so rain visually interacts with the diorama
    const angle = rand() * Math.PI * 2;
    const radius = rand() < 0.72 ? Math.sqrt(rand()) * 4.75 : 4.75 + rand() * 1.9;
    drop.x = Math.cos(angle) * radius;
    drop.z = Math.sin(angle) * radius;
    drop.y = randomHeight
      ? 1.5 + rand() * (RAIN_SPAWN_MAX_Y - 1.5)
      : RAIN_SPAWN_MIN_Y + rand() * (RAIN_SPAWN_MAX_Y - RAIN_SPAWN_MIN_Y);
    drop.speed = 9.5 + rand() * 3.8;
    drop.lengthScale = 0.8 + rand() * 0.45;
  };

  for (let i = 0; i < RAIN_COUNT; i++) {
    const drop: RainDrop = { x: 0, y: 0, z: 0, speed: 10, lengthScale: 1 };
    spawnDrop(drop, true);
    drops.push(drop);
  }

  // 2. Pooled pond ripple rings
  const rippleGeo = new THREE.RingGeometry(0.075, 0.105, 24);
  rippleGeo.rotateX(-Math.PI / 2);

  const ripples: RippleSlot[] = [];
  for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xdff3ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(rippleGeo, material);
    mesh.name = 'PondRipple';
    mesh.visible = false;
    mesh.position.set(POND_CENTER.x, POND_WATER_Y + 0.015, POND_CENTER.z);
    group.add(mesh);

    ripples.push({
      mesh,
      material,
      active: false,
      age: 0,
      maxAge: 0.9,
      maxScale: 1.8,
    });
  }

  const triggerRipple = (x: number, z: number) => {
    for (const slot of ripples) {
      if (!slot.active) {
        slot.active = true;
        slot.age = 0;
        slot.maxAge = 0.75 + rand() * 0.4;
        slot.maxScale = 1.6 + rand() * 1.1;
        slot.mesh.position.set(x, POND_WATER_Y + 0.016, z);
        slot.mesh.scale.setScalar(0.35);
        slot.mesh.visible = true;
        return;
      }
    }
  };

  let rippleCooldown = 0;
  const dummy = new THREE.Object3D();

  const update = (smoothed: SmoothedWorldState, dt: number) => {
    const rain = smoothed.rainFactor;
    const wind = smoothed.windFactor;
    const isRaining = rain > 0.02;

    rainMesh.visible = isRaining;
    rainMat.opacity = rain * 0.42;

    // Wind pushes rain horizontally (+X, +Z slight diagonal) and tilts streaks naturally
    const windVelX = wind * 5.2;
    const windVelZ = wind * 1.8;
    const tiltZ = -Math.atan2(windVelX, 11.2);
    const tiltX = Math.atan2(windVelZ, 11.2);

    if (isRaining && dt > 0) {
      for (let i = 0; i < RAIN_COUNT; i++) {
        const drop = drops[i];
        drop.x += windVelX * dt;
        drop.z += windVelZ * dt;
        drop.y -= drop.speed * dt;

        const surface = getIslandSurfaceStopY(drop.x, drop.z);
        const stopY = surface.hitsIsland ? surface.stopY : RAIN_OUTER_MISS_Y;

        if (drop.y <= stopY) {
          if (surface.hitsPond && rain > 0.25 && rippleCooldown <= 0) {
            triggerRipple(drop.x, drop.z);
            rippleCooldown = 0.055;
          }
          spawnDrop(drop, false);
        }

        dummy.position.set(drop.x, drop.y, drop.z);
        dummy.rotation.set(tiltX, 0, tiltZ);
        dummy.scale.set(1, drop.lengthScale, 1);
        dummy.updateMatrix();
        rainMesh.setMatrixAt(i, dummy.matrix);
      }
      rainMesh.instanceMatrix.needsUpdate = true;

      rippleCooldown -= dt;
      // Guarantee steady pond ripples during rain even if random drop timing fluctuates
      if (rain > 0.35 && rippleCooldown <= -0.08) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * (POND_CENTER.radius * 0.78);
        triggerRipple(POND_CENTER.x + Math.cos(a) * r, POND_CENTER.z + Math.sin(a) * r);
        rippleCooldown = 0.1;
      }
    }

    // Always advance active ripples so clearing weather lets existing ripples finish fading cleanly
    if (dt > 0) {
      for (const slot of ripples) {
        if (!slot.active) {
          continue;
        }
        slot.age += dt;
        const progress = slot.age / slot.maxAge;
        if (progress >= 1) {
          slot.active = false;
          slot.mesh.visible = false;
          slot.material.opacity = 0;
        } else {
          const scale = THREE.MathUtils.lerp(0.35, slot.maxScale, progress);
          slot.mesh.scale.setScalar(scale);
          const fade = Math.sin(progress * Math.PI) * Math.max(0.15, rain);
          slot.material.opacity = fade * 0.65;
          if (rain <= 0.02 && progress > 0.75) {
            slot.material.opacity *= (1 - progress) * 4;
          }
        }
      }
    }
  };

  const getActiveRippleCount = () => ripples.filter((r) => r.active).length;

  const dispose = () => {
    dropGeo.dispose();
    rainMat.dispose();
    rippleGeo.dispose();
    for (const slot of ripples) {
      slot.material.dispose();
    }
  };

  return {
    group,
    update,
    getActiveRippleCount,
    getRainInstancedMesh: () => rainMesh,
    getDropPosition: (index: number) => ({
      x: drops[index].x,
      y: drops[index].y,
      z: drops[index].z,
    }),
    dispose,
  };
}
