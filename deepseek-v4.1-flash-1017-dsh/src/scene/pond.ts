import {
  CircleGeometry,
  Color,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { createRadialSurface } from '../lib/geometry';
import { Rng } from '../lib/noise';
import { PALETTE, type SceneMaterials } from './palette';
import { POND_CENTER, terrainHeight } from './island';
import type { EnvironmentFrame } from '../environment/environment';

export const POND_WATER_Y = 0.145;

function pondRadius(angle: number): number {
  return (
    1.4 *
    (1 +
      0.11 * Math.sin(2 * angle + 1.1) +
      0.06 * Math.sin(5 * angle + 2.4) +
      0.035 * Math.sin(9 * angle + 0.2))
  );
}

export function isInPond(x: number, z: number, inset = 0.92): boolean {
  const angle = Math.atan2(z - POND_CENTER.z, x - POND_CENTER.x);
  const distance = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z);
  return distance <= pondRadius(angle) * inset;
}

interface WaterUniforms {
  uTime: { value: number };
  uRain: { value: number };
  uSunDir: { value: Vector3 };
  uSunColor: { value: Color };
  uSkyColor: { value: Color };
  uDeep: { value: Color };
  uShallow: { value: Color };
  uBrightness: { value: number };
  [key: string]: { value: unknown };
}

export class PondWater {
  readonly mesh: Mesh;
  private readonly uniforms: WaterUniforms;
  private readonly deep = new Color(PALETTE.waterDeep);
  private readonly shallow = new Color(PALETTE.waterShallow);

  constructor() {
    const geometry = createRadialSurface(
      POND_CENTER.x,
      POND_CENTER.z,
      pondRadius,
      72,
      10,
      (_x, _z, edgeT) => {
        const edgeDip = edgeT * edgeT * 0.012;
        return POND_WATER_Y - edgeDip;
      },
    );

    this.uniforms = {
      uTime: { value: 0 },
      uRain: { value: 0 },
      uSunDir: { value: new Vector3(0.3, 1, 0.2) },
      uSunColor: { value: new Color('#ffe4bb') },
      uSkyColor: { value: new Color('#bcd6d4') },
      uDeep: { value: this.deep.clone() },
      uShallow: { value: this.shallow.clone() },
      uBrightness: { value: 1 },
    };

    const material = new ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorldPosition;

        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          world.y += sin(world.x * 2.7 + uTime * 1.15) * 0.006
                   + sin(world.z * 3.3 - uTime * 0.8) * 0.005;
          vWorldPosition = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uRain;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyColor;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform float uBrightness;
        varying vec3 vWorldPosition;

        void main() {
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          vec2 p = vWorldPosition.xz;

          float slopeX = cos(p.x * 3.1 + uTime * 1.0) * 0.075
                       + cos((p.x + p.y) * 4.7 - uTime * 1.4) * 0.03
                       + sin(p.y * 6.0 + uTime * 0.8) * 0.018;
          float slopeZ = cos(p.y * 2.9 - uTime * 0.9) * 0.065
                       + cos((p.x - p.y) * 5.1 + uTime * 1.2) * 0.03
                       + sin(p.x * 6.3 - uTime * 1.1) * 0.018;

          float rainTexture = sin(length(p - vec2(${POND_CENTER.x.toFixed(3)}, ${POND_CENTER.z.toFixed(3)})) * 21.0 - uTime * 7.0);
          slopeX += rainTexture * uRain * 0.018;
          slopeZ += cos(length(p - vec2(${POND_CENTER.x.toFixed(3)}, ${POND_CENTER.z.toFixed(3)})) * 19.0 - uTime * 6.2) * uRain * 0.018;

          vec3 normal = normalize(vec3(slopeX, 1.0, slopeZ));
          float fresnel = pow(1.0 - clamp(dot(normal, viewDirection), 0.0, 1.0), 2.3);

          vec3 base = mix(uDeep, uShallow, 0.34 + 0.12 * sin(p.x * 1.8 + p.y * 1.4));
          base = mix(base, uSkyColor, fresnel * 0.38);

          vec3 halfVector = normalize(normalize(uSunDir) + viewDirection);
          float specular = pow(max(dot(normal, halfVector), 0.0), 90.0) * (0.45 + 0.55 * fresnel);
          float sparkle = pow(max(dot(normal, halfVector), 0.0), 260.0);
          vec3 color = base + uSunColor * (specular * 0.9 + sparkle * 0.7);
          color *= uBrightness;
          color = mix(color, color * vec3(0.82, 0.88, 0.92), uRain * 0.55);

          gl_FragColor = vec4(color, 0.88 + fresnel * 0.08);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.mesh = new Mesh(geometry, material);
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 2;
    this.mesh.name = 'pond-water';
  }

  update(elapsed: number, frame: EnvironmentFrame): void {
    this.uniforms.uTime.value = elapsed;
    this.uniforms.uRain.value = frame.rain;
    this.uniforms.uSunDir.value.copy(frame.lightDirection);
    this.uniforms.uSunColor.value.copy(frame.lightColor);
    this.uniforms.uSkyColor.value.copy(frame.skyHorizon).lerp(frame.skyTop, 0.35);
    this.uniforms.uBrightness.value = 0.25 + frame.daylight * 0.85;
    this.uniforms.uDeep.value.copy(this.deep).lerp(frame.skyTop, 0.12);
    this.uniforms.uShallow.value.copy(this.shallow).lerp(frame.skyHorizon, 0.14);
  }
}

export interface Pond {
  group: Group;
  waterY: number;
  contains(x: number, z: number): boolean;
  randomPoint(random: Rng, inset?: number): Vector3;
  update(elapsed: number, wind: number, frame: EnvironmentFrame, reducedMotion: boolean): void;
}

export function createPond(materials: SceneMaterials): Pond {
  const group = new Group();
  group.name = 'pond';
  group.position.y = 0;

  const bankShape = createRadialSurface(
    POND_CENTER.x,
    POND_CENTER.z,
    (a) => pondRadius(a) * 1.22,
    72,
    7,
    () => 0.118,
  );
  const bank = new Mesh(bankShape, materials.sand);
  bank.receiveShadow = true;
  group.add(bank);

  const floorShape = createRadialSurface(
    POND_CENTER.x,
    POND_CENTER.z,
    (a) => pondRadius(a) * 1.02,
    64,
    6,
    () => 0.052,
  );
  const floorMaterial = new MeshStandardMaterial({
    color: new Color('#53533d'),
    roughness: 1,
    metalness: 0,
  });
  const floor = new Mesh(floorShape, floorMaterial);
  floor.receiveShadow = true;
  group.add(floor);

  const water = new PondWater();
  group.add(water.mesh);

  group.add(createShoreStones(materials));
  group.add(createLilyPads(materials));

  const reeds = createReeds();
  group.add(reeds.group);

  return {
    group,
    waterY: POND_WATER_Y,
    contains: (x, z) => isInPond(x, z),
    randomPoint: (randomSource, inset = 0.82) => {
      const angle = randomSource.range(0, Math.PI * 2);
      const radius = Math.sqrt(randomSource.next()) * pondRadius(angle) * inset;
      const x = POND_CENTER.x + Math.cos(angle) * radius;
      const z = POND_CENTER.z + Math.sin(angle) * radius;
      return new Vector3(x, POND_WATER_Y, z);
    },
    update: (elapsed, wind, frame, reducedMotion) => {
      water.update(elapsed, frame);
      const swayScale = reducedMotion ? 0.18 : 1;
      for (const clump of reeds.clumps) {
        const sway = Math.sin(elapsed * 1.15 + clump.phase) * wind * 0.085 * swayScale;
        clump.pivot.rotation.z = sway + clump.baseTilt;
        clump.pivot.rotation.x = Math.cos(elapsed * 0.9 + clump.phase) * wind * 0.045 * swayScale;
      }
    },
  };
}

function createShoreStones(materials: SceneMaterials): Group {
  const group = new Group();
  const random = new Rng(550);
  const geometry = new DodecahedronGeometry(1, 0);

  for (let i = 0; i < 22; i += 1) {
    const angle = (i / 22) * Math.PI * 2 + random.range(-0.1, 0.1);
    const radius = pondRadius(angle) * random.range(1.01, 1.17);
    const scale = random.range(0.07, 0.19);
    const stone = new Mesh(geometry, materials.rock);
    stone.position.set(
      POND_CENTER.x + Math.cos(angle) * radius,
      0.11 + scale * 0.45,
      POND_CENTER.z + Math.sin(angle) * radius,
    );
    stone.scale.set(scale * random.range(0.8, 1.5), scale * random.range(0.55, 1), scale * random.range(0.8, 1.4));
    stone.rotation.set(random.range(0, Math.PI), random.range(0, Math.PI), random.range(0, Math.PI));
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  return group;
}

function createLilyPads(materials: SceneMaterials): Group {
  const group = new Group();
  const random = new Rng(313);
  const geometry = new CircleGeometry(0.13, 14);
  geometry.rotateX(-Math.PI / 2);

  for (let i = 0; i < 5; i += 1) {
    const pad = new Mesh(geometry, materials.leafB);
    const angle = random.range(0, Math.PI * 2);
    const radius = random.range(0.2, 0.75);
    pad.position.set(
      POND_CENTER.x + Math.cos(angle) * radius,
      POND_WATER_Y + 0.012,
      POND_CENTER.z + Math.sin(angle) * radius,
    );
    pad.scale.setScalar(random.range(0.75, 1.3));
    pad.rotation.y = random.range(0, Math.PI * 2);
    group.add(pad);
  }

  const flower = new Mesh(
    new SphereGeometry(0.05, 8, 6),
    materials.flowerRose,
  );
  flower.position.set(POND_CENTER.x + 0.48, POND_WATER_Y + 0.06, POND_CENTER.z + 0.32);
  flower.scale.set(1, 0.6, 1);
  group.add(flower);

  return group;
}

interface ReedClump {
  pivot: Group;
  phase: number;
  baseTilt: number;
}

function createReeds(): { group: Group; clumps: ReedClump[] } {
  const group = new Group();
  const clumps: ReedClump[] = [];
  const random = new Rng(812);
  const stemMaterial = new MeshStandardMaterial({
    color: new Color('#7f9256'),
    roughness: 0.95,
    metalness: 0,
  });
  const headMaterial = new MeshStandardMaterial({
    color: new Color('#6d4a30'),
    roughness: 1,
    metalness: 0,
  });

  const angles = [0.45, 2.2, 3.4, 5.0, 5.9];
  for (const angle of angles) {
    const radius = pondRadius(angle) * random.range(0.92, 1.03);
    const baseX = POND_CENTER.x + Math.cos(angle) * radius;
    const baseZ = POND_CENTER.z + Math.sin(angle) * radius;
    const pivot = new Group();
    pivot.position.set(baseX, 0.11, baseZ);
    const baseTilt = random.range(-0.16, 0.16);

    for (let i = 0; i < 4; i += 1) {
      const height = random.range(0.38, 0.72);
      const stem = new Mesh(new CylinderGeometry(0.008, 0.013, height, 4), stemMaterial);
      stem.position.set(random.range(-0.05, 0.05), height / 2, random.range(-0.05, 0.05));
      stem.rotation.z = random.range(-0.12, 0.12);
      stem.rotation.x = random.range(-0.12, 0.12);
      stem.castShadow = true;
      pivot.add(stem);

      if (i < 2) {
        const head = new Mesh(new CylinderGeometry(0.022, 0.026, height * 0.2, 5), headMaterial);
        head.position.copy(stem.position).setY(height * 0.94);
        head.rotation.copy(stem.rotation);
        head.castShadow = true;
        pivot.add(head);
      }
    }

    group.add(pivot);
    clumps.push({ pivot, phase: random.range(0, Math.PI * 2), baseTilt });
  }

  return { group, clumps };
}

export function pondGroundHeight(x: number, z: number): number {
  return isInPond(x, z) ? POND_WATER_Y : terrainHeight(x, z);
}
