import {
  Group,
  Mesh,
  SphereGeometry,
} from 'three';
import { Rng } from '../lib/noise';
import type { EnvironmentFrame } from '../environment/environment';
import type { SceneMaterials } from './palette';

interface Cloud {
  group: Group;
  speed: number;
  baseY: number;
  phase: number;
  startX: number;
}

export interface CloudLayer {
  group: Group;
  update(dt: number, elapsed: number, wind: number, frame: EnvironmentFrame, reducedMotion: boolean): void;
  reset(): void;
}

export function createClouds(materials: SceneMaterials): CloudLayer {
  const group = new Group();
  group.name = 'clouds';
  const random = new Rng(1203);
  const geometry = new SphereGeometry(1, 14, 10);
  const clouds: Cloud[] = [];

  const placements = [
    { x: -11.0, y: 3.35, z: 0.5, size: 1.25 },
    { x: -10.6, y: 3.6, z: -7.5, size: 1.15 },
    { x: -3.5, y: 3.95, z: -10.0, size: 1.3 },
    { x: 4.6, y: 3.7, z: -5.6, size: 1.0 },
  ];

  for (const placement of placements) {
    const cloud = new Group();
    cloud.position.set(placement.x, placement.y, placement.z);
    const puffCount = random.int(5, 7);

    for (let i = 0; i < puffCount; i += 1) {
      const puff = new Mesh(geometry, materials.cloud);
      const angle = random.range(0, Math.PI * 2);
      const radius = i === 0 ? 0 : random.range(0.35, 1.05) * placement.size;
      puff.position.set(
        Math.cos(angle) * radius,
        random.range(-0.16, 0.28) * placement.size,
        Math.sin(angle) * radius * 0.55,
      );
      const scale = placement.size * random.range(0.5, 0.9);
      puff.scale.set(scale, scale * random.range(0.48, 0.72), scale * random.range(0.65, 0.9));
      cloud.add(puff);
    }

    cloud.scale.setScalar(random.range(0.9, 1.15));
    group.add(cloud);
    clouds.push({
      group: cloud,
      speed: random.range(0.75, 1.3),
      baseY: placement.y,
      phase: random.range(0, Math.PI * 2),
      startX: placement.x,
    });
  }

  return {
    group,
    reset: () => {
      for (const cloud of clouds) cloud.group.position.x = cloud.startX;
    },
    update: (dt, elapsed, wind, frame, reducedMotion) => {
      materials.cloud.color.copy(frame.cloudColor);
      materials.cloud.emissive.copy(frame.cloudColor);
      materials.cloud.emissiveIntensity = 0.12 + frame.night * 0.26;
      const motionScale = reducedMotion ? 0.25 : 1;
      const drift = wind * 0.55 * motionScale;
      for (const cloud of clouds) {
        cloud.group.position.x += drift * cloud.speed * dt;
        if (cloud.group.position.x > 20) cloud.group.position.x = -20;
        cloud.group.position.y =
          cloud.baseY -
          frame.rain * 0.7 +
          Math.sin(elapsed * 0.28 + cloud.phase) * 0.14 * motionScale * wind;
      }
    },
  };
}
