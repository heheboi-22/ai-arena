import * as THREE from 'three';
import type { SceneContext } from '../environment/runtime';
import { seededRandom } from '../utils/math';
import { POND, WATER_LEVEL, pondRadiusAt } from '../world/terrain';

interface Ripple {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  active: boolean;
}

export class Ripples {
  private readonly pool: Ripple[] = [];
  private accumulator = 0;
  private readonly random = seededRandom(4401);
  private readonly baseGeometry = new THREE.RingGeometry(0.82, 1, 24);

  constructor(scene: THREE.Scene, count = 28) {
    for (let i = 0; i < count; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xd8e6e1,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      });
      const mesh = new THREE.Mesh(this.baseGeometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 3;
      scene.add(mesh);
      this.pool.push({ mesh, material, age: 0, life: 1, active: false });
    }
  }

  private spawn(rain: number): void {
    const ripple = this.pool.find((entry) => !entry.active);
    if (!ripple) return;
    const angle = this.random() * Math.PI * 2;
    const radius = Math.sqrt(this.random()) * pondRadiusAt(angle) * 0.82;
    ripple.mesh.position.set(
      POND.x + Math.cos(angle) * radius,
      WATER_LEVEL + 0.012,
      POND.z + Math.sin(angle) * radius
    );
    ripple.age = 0;
    ripple.life = 0.9 + this.random() * 0.6;
    ripple.active = true;
    ripple.mesh.visible = true;
    ripple.material.opacity = 0.4 * rain;
  }

  update(ctx: SceneContext): void {
    if (ctx.rain > 0.12) {
      this.accumulator += ctx.delta * (3 + ctx.rain * 19);
      while (this.accumulator >= 1) {
        this.accumulator -= 1;
        this.spawn(ctx.rain);
      }
    } else {
      this.accumulator = Math.min(this.accumulator, 0.9);
    }

    for (const ripple of this.pool) {
      if (!ripple.active) continue;
      ripple.age += ctx.delta;
      const t = ripple.age / ripple.life;
      if (t >= 1) {
        ripple.active = false;
        ripple.mesh.visible = false;
        ripple.material.opacity = 0;
        continue;
      }
      const scale = 0.06 + t * 0.34;
      ripple.mesh.scale.setScalar(scale);
      ripple.material.opacity = Math.pow(1 - t, 2) * 0.42 * ctx.rain;
    }
  }
}
