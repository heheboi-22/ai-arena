import * as THREE from 'three';
import { POND_CENTER, isInsidePond } from '../terrain';

export interface RippleState {
  active: boolean;
  x: number;
  z: number;
  age: number;
  duration: number;
  maxRadius: number;
  delay: number;
}

export class RippleSystem {
  readonly group = new THREE.Group();
  private readonly poolSize: number;
  private readonly geometry: THREE.RingGeometry;
  private readonly ripples: Array<{ state: RippleState; mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }> = [];
  private seed = 3137;

  constructor(poolSize = 14) {
    this.poolSize = poolSize;
    this.group.name = 'pond-ripples';
    this.geometry = new THREE.RingGeometry(0.76, 1.0, 28);

    for (let i = 0; i < poolSize; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: '#dff0f6',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(POND_CENTER.x, POND_CENTER.waterY + 0.014, POND_CENTER.z);
      mesh.visible = false;
      this.group.add(mesh);

      this.ripples.push({
        mesh,
        material,
        state: {
          active: false,
          x: POND_CENTER.x,
          z: POND_CENTER.z,
          age: 0,
          duration: 1.0,
          maxRadius: 0.3,
          delay: (i / poolSize) * 1.1,
        },
      });
    }
  }

  getPoolSize(): number {
    return this.poolSize;
  }

  getVisibleCount(): number {
    let count = 0;
    for (const item of this.ripples) {
      if (item.mesh.visible && item.state.active) count++;
    }
    return count;
  }

  getRipplesSnapshot(): ReadonlyArray<Readonly<RippleState>> {
    return this.ripples.map((r) => r.state);
  }

  update(dt: number, rainFactor: number, reducedMotion: boolean): void {
    const clampedRain = Math.max(0, Math.min(1, rainFactor));

    for (const item of this.ripples) {
      const { state, mesh, material } = item;

      if (!state.active) {
        if (clampedRain > 0.06) {
          state.delay -= dt;
          if (state.delay <= 0) {
            this.spawnRipple(state, reducedMotion);
          }
        }
        mesh.visible = false;
        material.opacity = 0;
        continue;
      }

      state.age += dt;
      if (state.age >= state.duration) {
        if (clampedRain > 0.06) {
          this.spawnRipple(state, reducedMotion);
        } else {
          state.active = false;
          state.delay = this.nextRand() * 0.4;
          mesh.visible = false;
          material.opacity = 0;
          continue;
        }
      }

      const progress = Math.max(0, Math.min(1, state.age / state.duration));
      const radius = 0.04 + (state.maxRadius - 0.04) * (1 - Math.pow(1 - progress, 1.8));
      const fadeIn = Math.min(1, progress / 0.16);
      const fadeOut = Math.pow(1 - progress, 1.4);
      const opacity = 0.52 * clampedRain * fadeIn * fadeOut;

      if (opacity <= 0.005) {
        mesh.visible = false;
        material.opacity = 0;
      } else {
        mesh.visible = true;
        mesh.position.set(state.x, POND_CENTER.waterY + 0.014, state.z);
        mesh.scale.set(radius, radius, 1);
        material.opacity = opacity;
      }
    }
  }

  private spawnRipple(state: RippleState, reducedMotion: boolean): void {
    let x: number = POND_CENTER.x;
    let z: number = POND_CENTER.z;
    // Rejection sample cleanly inside the pond with shoreline margin
    for (let attempt = 0; attempt < 16; attempt++) {
      const candidateX = POND_CENTER.x + (this.nextRand() * 2 - 1) * (POND_CENTER.rx * 0.78);
      const candidateZ = POND_CENTER.z + (this.nextRand() * 2 - 1) * (POND_CENTER.rz * 0.78);
      if (isInsidePond(candidateX, candidateZ, -0.22)) {
        x = candidateX;
        z = candidateZ;
        break;
      }
    }

    state.x = x;
    state.z = z;
    state.age = 0;
    state.duration = (reducedMotion ? 1.5 : 0.85) + this.nextRand() * 0.55;
    state.maxRadius = 0.24 + this.nextRand() * 0.16;
    state.active = true;
  }

  private nextRand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  dispose(): void {
    this.geometry.dispose();
    for (const item of this.ripples) {
      item.material.dispose();
    }
  }
}
