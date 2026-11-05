import * as THREE from 'three';
import type { Palette } from '../environment/palette';
import type { SceneContext } from '../environment/runtime';
import { mergePainted } from '../utils/geometry';
import { seededRandom } from '../utils/math';

interface CloudSpec {
  x: number;
  y: number;
  z: number;
  scale: number;
  seed: number;
  puffs: number;
}

interface CloudRig {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
  scale: number;
}

const CLOUDS: CloudSpec[] = [
  { x: -9.8, y: 2.3, z: -2.4, scale: 1.0, seed: 2, puffs: 11 },
  { x: 8.9, y: 1.5, z: -0.6, scale: 0.85, seed: 9, puffs: 10 },
  { x: -6.6, y: -4.0, z: 3.9, scale: 0.9, seed: 17, puffs: 9 },
  { x: 7.1, y: -4.7, z: 4.1, scale: 0.7, seed: 23, puffs: 8 },
  { x: 2.2, y: 4.8, z: -10.8, scale: 0.75, seed: 31, puffs: 9 },
  { x: -0.4, y: -6.1, z: 7.2, scale: 0.55, seed: 47, puffs: 7 }
];

const makeCloudGeometry = (spec: CloudSpec): THREE.BufferGeometry => {
  const random = seededRandom(spec.seed * 7919);
  const parts: Array<{ geometry: THREE.BufferGeometry; color: THREE.Color }> = [];
  const shades = [0xffffff, 0xf8faf7, 0xeaf0ee, 0xf2f4ee, 0xe3e9e8];
  for (let i = 0; i < spec.puffs; i += 1) {
    const radius = 0.34 + random() * 0.4;
    const geometry = new THREE.SphereGeometry(radius, 10, 7);
    geometry.scale(1.25 + random() * 0.55, 0.58 + random() * 0.22, 0.82 + random() * 0.3);
    const row = i % 3;
    const spread = spec.puffs > 1 ? i / (spec.puffs - 1) - 0.5 : 0;
    geometry.translate(
      spread * 3.4 + (random() - 0.5) * 0.6,
      (row === 0 ? -0.15 : 0.14) + (random() - 0.5) * 0.3,
      (random() - 0.5) * 0.75
    );
    parts.push({
      geometry,
      color: new THREE.Color(shades[(i + row) % shades.length]!)
    });
  }
  for (let i = 0; i < 3; i += 1) {
    const radius = 0.42 + random() * 0.25;
    const geometry = new THREE.SphereGeometry(radius, 10, 7);
    geometry.scale(1.1, 0.75, 0.9);
    geometry.translate(
      (random() - 0.5) * 1.7,
      0.38 + random() * 0.12,
      (random() - 0.5) * 0.5
    );
    parts.push({ geometry, color: new THREE.Color(0xffffff) });
  }
  return mergePainted(parts);
};

export class Clouds {
  readonly group = new THREE.Group();
  readonly material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: false,
    color: 0xffffff
  });
  private readonly rigs: CloudRig[] = [];
  private rotation = 0;

  constructor() {
    this.group.name = 'clouds';
    for (const spec of CLOUDS) {
      const mesh = new THREE.Mesh(makeCloudGeometry(spec), this.material);
      mesh.position.set(spec.x, spec.y, spec.z);
      mesh.scale.setScalar(spec.scale);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const rig: CloudRig = {
        mesh,
        baseY: spec.y,
        phase: spec.seed * 0.63,
        scale: spec.scale
      };
      this.rigs.push(rig);
      this.group.add(mesh);
    }
  }

  update(ctx: SceneContext, palette: Palette): void {
    const motion = ctx.reducedMotion ? 0.3 : 1;
    this.rotation += ctx.delta * ctx.wind * 0.019 * motion;
    this.group.rotation.y = this.rotation;
    for (const rig of this.rigs) {
      const bob = Math.sin(ctx.time * 0.2 + rig.phase) * 0.07 * motion;
      rig.mesh.position.y = rig.baseY + bob - ctx.rain * 0.3;
      const breathe = 1 + Math.sin(ctx.time * 0.14 + rig.phase) * 0.01 * motion;
      rig.mesh.scale.setScalar(rig.scale * breathe);
    }
    this.material.color.copy(palette.cloud);
    this.material.emissive
      .copy(palette.horizon)
      .lerp(palette.cloud, 0.5)
      .multiplyScalar(0.035 + palette.night * 0.18 + ctx.rain * 0.03);
    this.material.emissiveIntensity = 1;
  }
}
