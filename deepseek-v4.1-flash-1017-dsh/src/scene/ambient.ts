import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Texture,
} from 'three';
import { Rng } from '../lib/noise';
import type { EnvironmentFrame } from '../environment/environment';
import { PALETTE } from './palette';

interface SmokePuff {
  sprite: Sprite;
  age: number;
  life: number;
  rise: number;
  drift: number;
  offset: Vector3;
}

export interface AmbientLayer {
  group: Group;
  update(dt: number, elapsed: number, wind: number, frame: EnvironmentFrame, reducedMotion: boolean): void;
}

export function createAmbient(softDot: Texture, chimney: Vector3): AmbientLayer {
  const group = new Group();
  group.name = 'ambient';

  const smokeGroup = new Group();
  const smokeBase = new Color(PALETTE.smoke);
  const smokeNight = new Color('#46505a');
  const smokeColor = new Color();
  const random = new Rng(311);
  const puffs: SmokePuff[] = [];

  for (let i = 0; i < 9; i += 1) {
    const material = new SpriteMaterial({
      map: softDot,
      color: smokeBase,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new Sprite(material);
    sprite.position.copy(chimney);
    sprite.scale.setScalar(0.001);
    smokeGroup.add(sprite);
    puffs.push({
      sprite,
      age: random.range(0, 5.5),
      life: random.range(4.5, 7.5),
      rise: random.range(0.24, 0.42),
      drift: random.range(0.5, 1.1),
      offset: new Vector3(random.range(-0.05, 0.05), 0, random.range(-0.05, 0.05)),
    });
  }
  group.add(smokeGroup);

  const fireflyCount = 26;
  const fireflyPositions = new Float32Array(fireflyCount * 3);
  const fireflySeeds: Array<{ base: Vector3; radius: number; speed: number; phase: number; height: number }> = [];
  const fireflyRandom = new Rng(733);
  for (let i = 0; i < fireflyCount; i += 1) {
    const angle = fireflyRandom.range(0, Math.PI * 2);
    const radius = fireflyRandom.range(1.0, 4.6);
    const base = new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    fireflySeeds.push({
      base,
      radius: fireflyRandom.range(0.15, 0.55),
      speed: fireflyRandom.range(0.12, 0.4),
      phase: fireflyRandom.range(0, Math.PI * 2),
      height: fireflyRandom.range(0.35, 1.55),
    });
  }
  const fireflyGeometry = new BufferGeometry();
  fireflyGeometry.setAttribute('position', new Float32BufferAttribute(fireflyPositions, 3));
  const fireflyMaterial = new PointsMaterial({
    map: softDot,
    color: new Color('#ffc471'),
    size: 0.16,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  const fireflies = new Points(fireflyGeometry, fireflyMaterial);
  fireflies.frustumCulled = false;
  group.add(fireflies);

  return {
    group,
    update: (dt, elapsed, wind, frame, reducedMotion) => {
      // Chimney smoke is decorative, so it rests when motion is reduced.
      smokeGroup.visible = !reducedMotion;
      if (!reducedMotion) {
        smokeColor.copy(smokeBase).lerp(smokeNight, 1 - frame.daylight);
        for (const puff of puffs) {
          puff.age += dt;
          if (puff.age >= puff.life) {
            puff.age = 0;
            puff.life = random.range(4.5, 7.5);
            puff.rise = random.range(0.24, 0.42);
            puff.sprite.position.copy(chimney).add(puff.offset);
          } else {
            puff.sprite.position.y += puff.rise * dt;
            puff.sprite.position.x += (0.04 + wind * 0.42) * puff.drift * dt;
            puff.sprite.position.z += wind * 0.13 * puff.drift * dt;
          }

          const t = puff.age / puff.life;
          const material = puff.sprite.material as SpriteMaterial;
          material.opacity = Math.sin(t * Math.PI) * 0.25 * (1 - frame.rain * 0.5);
          material.color.copy(smokeColor);
          const scale = 0.2 + t * 0.72;
          puff.sprite.scale.set(scale, scale * 0.85, 1);
        }
      }

      const fireflyOpacity = Math.pow(frame.night, 2.2) * 1.05 * (1 - frame.rain * 0.55);
      fireflyMaterial.opacity = fireflyOpacity;
      fireflies.visible = fireflyOpacity > 0.01;
      if (fireflies.visible) {
        const positions = fireflyGeometry.getAttribute('position') as Float32BufferAttribute;
        const motion = reducedMotion ? 0.15 : 1;
        for (let i = 0; i < fireflySeeds.length; i += 1) {
          const seed = fireflySeeds[i];
          const angle = seed.phase + elapsed * seed.speed * motion;
          positions.setXYZ(
            i,
            seed.base.x + Math.cos(angle) * seed.radius,
            seed.height + Math.sin(angle * 1.7) * 0.16,
            seed.base.z + Math.sin(angle) * seed.radius,
          );
        }
        positions.needsUpdate = true;
      }
    },
  };
}
