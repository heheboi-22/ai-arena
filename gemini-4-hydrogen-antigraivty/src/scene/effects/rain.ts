import * as THREE from 'three';
import { WindVector } from '../../state/worldState';
import {
  HOUSE_ANCHOR,
  POND_CENTER,
  WINDMILL_ANCHOR,
  getIslandSurfaceHeight,
  isInsideIsland,
  isInsidePond,
} from '../terrain';

export interface RainDropState {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  speed: number;
  scaleLength: number;
}

const UP_VECTOR = new THREE.Vector3(0, 1, 0);

export class RainSystem {
  readonly group = new THREE.Group();
  private readonly poolSize: number;
  private readonly geometry: THREE.CylinderGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly mesh: THREE.InstancedMesh;
  private readonly drops: RainDropState[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly velDir = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private seed = 7919;

  constructor(poolSize = 360) {
    this.poolSize = poolSize;
    this.group.name = 'rain-system';

    this.geometry = new THREE.CylinderGeometry(0.008, 0.013, 0.42, 4, 1);
    this.material = new THREE.MeshBasicMaterial({
      color: '#dce9f7',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, poolSize);
    this.mesh.name = 'rain-streaks';
    this.mesh.frustumCulled = false;

    for (let i = 0; i < poolSize; i++) {
      this.drops.push({
        active: false,
        x: 0,
        y: 8,
        z: 0,
        vx: 0,
        vy: -13,
        vz: 0,
        speed: 12 + this.nextRand() * 3.5,
        scaleLength: 0.8 + this.nextRand() * 0.45,
      });

      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.mesh);
  }

  getPoolSize(): number {
    return this.poolSize;
  }

  getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.drops.length; i++) {
      if (this.drops[i].active) count++;
    }
    return count;
  }

  getDropsSnapshot(): ReadonlyArray<Readonly<RainDropState>> {
    return this.drops;
  }

  update(
    dt: number,
    rainFactor: number,
    windFactor: number,
    windDir: WindVector,
    reducedMotion: boolean
  ): void {
    const clampedRain = Math.max(0, Math.min(1, rainFactor));
    const clampedWind = Math.max(0, Math.min(1, windFactor));
    const desiredActive = clampedRain > 0.03 ? Math.round(this.poolSize * clampedRain) : 0;

    // Horizontal wind velocity is strictly 0 when windFactor === 0
    const horizVx = clampedWind === 0 ? 0 : windDir.x * clampedWind * 7.4;
    const horizVz = clampedWind === 0 ? 0 : windDir.z * clampedWind * 7.4;
    const speedScale = reducedMotion ? 0.65 : 1.0;

    this.material.opacity = 0.46 * Math.min(1, clampedRain * 1.15);

    let activeCount = this.getActiveCount();
    let spawnBudget = Math.max(0, Math.ceil((desiredActive - activeCount) * Math.min(1, dt * 8 + 0.15)));

    for (let i = 0; i < this.poolSize; i++) {
      const drop = this.drops[i];

      if (!drop.active) {
        if (spawnBudget > 0 && clampedRain > 0.04) {
          this.spawnDrop(drop, horizVx, horizVz, speedScale);
          spawnBudget--;
          activeCount++;
        } else {
          this.hideInstance(i);
          continue;
        }
      }

      drop.vx = horizVx;
      drop.vz = horizVz;
      drop.vy = -drop.speed * speedScale;

      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.z += drop.vz * dt;

      const insideIsland = isInsideIsland(drop.x, drop.z, -0.05);
      let floorY = -3.8;

      if (insideIsland) {
        floorY = getIslandSurfaceHeight(drop.x, drop.z);
        if (isInsidePond(drop.x, drop.z)) {
          floorY = Math.max(floorY, POND_CENTER.waterY);
        }
        // Prevent rain from clipping visibly through cottage roof or windmill cap
        const distHouse = Math.hypot(drop.x - HOUSE_ANCHOR.x, drop.z - HOUSE_ANCHOR.z);
        if (distHouse < 1.15) {
          floorY = Math.max(floorY, 1.35);
        }
        const distWindmill = Math.hypot(drop.x - WINDMILL_ANCHOR.x, drop.z - WINDMILL_ANCHOR.z);
        if (distWindmill < 0.72) {
          floorY = Math.max(floorY, 2.35);
        }
      }

      if (drop.y <= floorY) {
        if (clampedRain > 0.04 && activeCount <= desiredActive) {
          this.spawnDrop(drop, horizVx, horizVz, speedScale);
        } else {
          drop.active = false;
          activeCount--;
          this.hideInstance(i);
          continue;
        }
      }

      // Compute streak orientation along velocity
      this.velDir.set(drop.vx, drop.vy, drop.vz).normalize();
      this.quat.setFromUnitVectors(UP_VECTOR, this.velDir);

      // Fade streak gently near cloud spawn or below outer cliff edge
      let scaleFactor = 1;
      if (drop.y > 4.2) {
        scaleFactor *= Math.max(0, 1 - (drop.y - 4.2) / 1.7);
      }
      if (!insideIsland && drop.y < -1.8) {
        scaleFactor *= Math.max(0, 1 - (-1.8 - drop.y) / 2.0);
      }

      this.dummy.position.set(drop.x, drop.y, drop.z);
      this.dummy.quaternion.copy(this.quat);
      this.dummy.scale.set(
        scaleFactor,
        drop.scaleLength * scaleFactor * (reducedMotion ? 0.75 : 1),
        scaleFactor
      );
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private spawnDrop(drop: RainDropState, vx: number, vz: number, speedScale: number): void {
    const angle = this.nextRand() * Math.PI * 2;
    const radius = Math.sqrt(this.nextRand()) * 6.5;
    // Bias spawn slightly upwind so angled rain blankets the entire island
    drop.x = Math.cos(angle) * radius - vx * 0.32;
    drop.z = Math.sin(angle) * radius - vz * 0.32;
    drop.y = 3.8 + this.nextRand() * 2.0;
    drop.vx = vx;
    drop.vz = vz;
    drop.vy = -drop.speed * speedScale;
    drop.active = true;
  }

  private hideInstance(index: number): void {
    this.dummy.position.set(0, -100, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, this.dummy.matrix);
  }

  private nextRand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
