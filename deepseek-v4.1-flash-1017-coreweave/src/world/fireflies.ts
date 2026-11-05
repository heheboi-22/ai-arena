import * as THREE from 'three';
import type { SceneContext } from '../environment/runtime';
import { seededRandom } from '../utils/math';
import { makeSoftTexture } from '../utils/textures';
import { terrainHeight } from './terrain';

interface Mote {
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  speed: number;
  radius: number;
}

const CENTERS = [
  { x: -1.7, z: 0.6, count: 10 },
  { x: 1.4, z: 1.2, count: 9 },
  { x: -3.5, z: -1.4, count: 7 },
  { x: 2.9, z: 0.9, count: 6 }
];

export class Fireflies {
  readonly points: THREE.Points;
  private readonly material: THREE.PointsMaterial;
  private readonly motes: Mote[] = [];
  private readonly positions: Float32Array;

  constructor() {
    const random = seededRandom(612);
    const total = CENTERS.reduce((sum, center) => sum + center.count, 0);
    this.positions = new Float32Array(total * 3);
    for (const center of CENTERS) {
      for (let i = 0; i < center.count; i += 1) {
        const angle = random() * Math.PI * 2;
        const spread = random() * 1.15;
        const x = center.x + Math.cos(angle) * spread;
        const z = center.z + Math.sin(angle) * spread;
        const baseY = terrainHeight(x, z) + 0.35 + random() * 1.15;
        this.motes.push({
          baseX: x,
          baseY,
          baseZ: z,
          phase: random() * Math.PI * 2,
          speed: 0.3 + random() * 0.6,
          radius: 0.12 + random() * 0.32
        });
      }
    }
    this.positions.set(
      this.motes.flatMap((mote) => [mote.baseX, mote.baseY, mote.baseZ])
    );
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.095,
      map: makeSoftTexture(64, 0.15),
      color: 0xffd58e,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  update(ctx: SceneContext): void {
    const visibility = Math.max(0, ctx.night - 0.22) * (1 - ctx.rain * 0.85);
    this.material.opacity = Math.min(0.9, visibility * 0.9);
    this.points.visible = this.material.opacity > 0.01;
    if (!this.points.visible) return;
    const motion = ctx.reducedMotion ? 0.3 : 1;
    const time = ctx.time * motion;
    for (let i = 0; i < this.motes.length; i += 1) {
      const mote = this.motes[i]!;
      this.positions[i * 3] =
        mote.baseX + Math.sin(time * mote.speed + mote.phase) * mote.radius;
      this.positions[i * 3 + 1] =
        mote.baseY + Math.sin(time * mote.speed * 1.4 + mote.phase * 2) * 0.16;
      this.positions[i * 3 + 2] =
        mote.baseZ + Math.cos(time * mote.speed * 0.8 + mote.phase) * mote.radius;
    }
    this.points.geometry.getAttribute('position').needsUpdate = true;
  }
}
