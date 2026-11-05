import * as THREE from 'three';
import type { Palette } from '../environment/palette';
import type { SceneContext } from '../environment/runtime';
import { mergePainted, radialDisc } from '../utils/geometry';
import { seededRandom } from '../utils/math';
import { BOAT } from './layout';
import type { WorldMaterials } from './materials';
import { POND, WATER_LEVEL, pondRadiusAt, terrainHeight } from './terrain';

const WATER_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uRain;
  uniform float uNight;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uLightColor;
  uniform vec3 uLightDirection;
  varying vec2 vUv;
  varying vec3 vWorld;

  void main() {
    vec2 p = vWorld.xz;
    float waveA = sin(p.x * 5.4 + uTime * 0.75);
    float waveB = sin(p.y * 4.6 - uTime * 0.62);
    float waveC = sin((p.x + p.y) * 8.8 + uTime * 1.25);
    float chop = (waveA + waveB) * 0.5 + waveC * 0.25 * uRain;
    float radial = length(vUv - 0.5) * 2.0;

    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - clamp(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 2.4);
    float depthMix = smoothstep(0.25, 1.0, radial);
    vec3 color = mix(uDeep * 0.92, uShallow, 0.22 + 0.27 * depthMix + chop * 0.035);
    color = mix(color, uSky, fresnel * (0.26 - uNight * 0.14));
    color += uDeep * 0.13 * max(0.0, chop);
    color *= 0.94;

    vec3 normal = normalize(vec3(waveA * 0.035, 1.0, waveB * 0.035));
    vec3 halfDir = normalize(viewDir + normalize(uLightDirection));
    float glint = pow(max(dot(normal, halfDir), 0.0), 96.0);
    float broadGlint = pow(max(dot(normal, halfDir), 0.0), 22.0) * 0.18;
    color += uLightColor * (glint * 1.1 + broadGlint) * (0.3 + 0.7 * (1.0 - uNight)) * (1.0 - uNight * 0.35);

    color *= mix(1.0, 0.54, uNight) * (1.0 - uRain * 0.24);
    float foam = smoothstep(0.86, 1.0, radial);
    color = mix(color, vec3(0.72, 0.8, 0.78), foam * 0.22);
    float rainRing = sin(radial * 34.0 - uTime * 3.2) * 0.5 + 0.5;
    color += uShallow * rainRing * 0.018 * uRain;

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const buildReeds = (): THREE.BufferGeometry => {
  const random = seededRandom(77);
  const parts: Array<{ geometry: THREE.BufferGeometry; color: THREE.Color }> = [];
  const stemColor = new THREE.Color(0x6e864a);
  const darkStem = new THREE.Color(0x59713e);
  const headColor = new THREE.Color(0x7a5c3e);
  const angles = [0.35, 0.8, 2.5, 2.95, 4.2, 5.4];
  for (let cluster = 0; cluster < angles.length; cluster += 1) {
    const angle = angles[cluster]!;
    const radius = pondRadiusAt(angle) + 0.04 + random() * 0.22;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const count = 3 + Math.floor(random() * 2);
    for (let i = 0; i < count; i += 1) {
      const height = 0.3 + random() * 0.34;
      const stem = new THREE.CylinderGeometry(0.007, 0.013, height, 4);
      stem.translate(
        cx + (random() - 0.5) * 0.14,
        WATER_LEVEL + height * 0.5 - 0.04,
        cz + (random() - 0.5) * 0.14
      );
      parts.push({ geometry: stem, color: i % 2 === 0 ? stemColor : darkStem });
      if (i === 0 || random() > 0.55) {
        const head = new THREE.CylinderGeometry(0.024, 0.02, 0.1, 6);
        head.translate(cx, WATER_LEVEL + height - 0.02, cz);
        parts.push({ geometry: head, color: headColor });
      }
    }
  }
  return mergePainted(parts);
};

const makeBoat = (materials: WorldMaterials): THREE.Group => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.3, 0);
  shape.quadraticCurveTo(-0.33, 0.14, -0.17, 0.17);
  shape.quadraticCurveTo(0.12, 0.2, 0.38, 0);
  shape.quadraticCurveTo(0.12, -0.2, -0.17, -0.17);
  shape.quadraticCurveTo(-0.33, -0.14, -0.3, 0);
  const hullGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.13,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    curveSegments: 8
  });
  hullGeometry.rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(hullGeometry, materials.wood);
  hull.castShadow = true;

  const group = new THREE.Group();
  group.add(hull);

  const insetShape = new THREE.Shape();
  insetShape.moveTo(-0.24, 0);
  insetShape.quadraticCurveTo(-0.26, 0.1, -0.13, 0.12);
  insetShape.quadraticCurveTo(0.1, 0.14, 0.3, 0);
  insetShape.quadraticCurveTo(0.1, -0.14, -0.13, -0.12);
  insetShape.quadraticCurveTo(-0.26, -0.1, -0.24, 0);
  const inset = new THREE.Mesh(
    new THREE.ShapeGeometry(insetShape, 8),
    new THREE.MeshStandardMaterial({ color: 0x4f3a28, roughness: 1 })
  );
  inset.rotation.x = -Math.PI / 2;
  inset.position.y = 0.135;
  inset.scale.set(0.82, 0.82, 0.82);
  group.add(inset);

  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.26), materials.wood);
  bench.position.set(0.02, 0.175, 0);
  group.add(bench);

  const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 5), materials.wood);
  oar.rotation.z = Math.PI / 2;
  oar.rotation.y = 0.36;
  oar.position.set(-0.1, 0.21, 0.06);
  group.add(oar);

  group.position.set(BOAT.x - POND.x, WATER_LEVEL - 0.07, BOAT.z - POND.z);
  group.rotation.y = BOAT.rotation;
  group.scale.setScalar(0.88);
  return group;
};

export class Pond {
  readonly group = new THREE.Group();
  readonly waterMaterial: THREE.ShaderMaterial;
  readonly waterLevel = WATER_LEVEL;
  private readonly boat: THREE.Group;
  private readonly lilies: THREE.Group;
  private readonly lilyRigs: Array<{ group: THREE.Group; phase: number }> = [];
  private readonly reeds: THREE.Mesh;

  constructor(materials: WorldMaterials) {
    this.group.name = 'pond';
    this.group.position.set(POND.x, 0, POND.z);

    const sandGeometry = radialDisc(
      1.8,
      10,
      64,
      (angle) => 1 + 0.045 * Math.sin(angle * 3 + 0.4) + 0.028 * Math.sin(angle * 5 - 1.2),
      (x, z) => terrainHeight(POND.x + x, POND.z + z) + 0.02
    );
    const sandColor = new THREE.Color(0xb3a177);
    const wetSand = new THREE.Color(0x8e7c5b);
    const position = sandGeometry.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i += 1) {
      const r = Math.hypot(position.getX(i), position.getZ(i)) / 1.8;
      color.copy(sandColor).lerp(wetSand, 1 - Math.min(1, r * 1.4));
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    sandGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const sandMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      flatShading: true
    });
    const sand = new THREE.Mesh(sandGeometry, sandMaterial);
    sand.receiveShadow = true;
    sand.position.y = 0;
    this.group.add(sand);

    const waterGeometry = new THREE.BufferGeometry();
    const segments = 80;
    const positions: number[] = [0, 0, 0];
    const uvs: number[] = [0.5, 0.5];
    const indices: number[] = [];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const r = pondRadiusAt(angle);
      positions.push(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
    }
    for (let i = 0; i < segments; i += 1) {
      indices.push(0, 1 + ((i + 1) % segments), 1 + i);
    }
    waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    waterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    waterGeometry.setIndex(indices);
    waterGeometry.computeVertexNormals();

    this.waterMaterial = new THREE.ShaderMaterial({
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uRain: { value: 0 },
        uNight: { value: 0 },
        uDeep: { value: new THREE.Color(0x2e6472) },
        uShallow: { value: new THREE.Color(0x7aa7a4) },
        uSky: { value: new THREE.Color(0xdde7d8) },
        uLightColor: { value: new THREE.Color(0xffe8c0) },
        uLightDirection: { value: new THREE.Vector3(-0.7, 0.5, 0.35) }
      }
    });
    const water = new THREE.Mesh(waterGeometry, this.waterMaterial);
    water.position.y = WATER_LEVEL;
    water.receiveShadow = false;
    this.group.add(water);

    this.reeds = new THREE.Mesh(
      buildReeds(),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        metalness: 0,
        flatShading: true
      })
    );
    this.reeds.castShadow = true;
    this.group.add(this.reeds);

    this.lilies = new THREE.Group();
    const padMaterial = new THREE.MeshStandardMaterial({
      color: 0x6c8f52,
      roughness: 0.9,
      flatShading: true,
      side: THREE.DoubleSide
    });
    const lilyPositions = [
      { x: -0.46, z: 0.12, r: 1.1 },
      { x: 0.2, z: -0.58, r: 0.8 },
      { x: -0.1, z: 0.56, r: 1.35 }
    ];
    for (let i = 0; i < lilyPositions.length; i += 1) {
      const spec = lilyPositions[i]!;
      const lily = new THREE.Group();
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(0.15 * spec.r, 12, 0.45, 5.4),
        padMaterial
      );
      pad.rotation.x = -Math.PI / 2;
      lily.add(pad);
      if (i === 1) {
        const petalMaterial = new THREE.MeshStandardMaterial({ color: 0xf1e3c4, roughness: 0.9 });
        for (let p = 0; p < 5; p += 1) {
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), petalMaterial);
          petal.scale.set(1.2, 0.6, 0.7);
          const angle = (p / 5) * Math.PI * 2;
          petal.position.set(Math.cos(angle) * 0.045, 0.035, Math.sin(angle) * 0.045);
          lily.add(petal);
        }
      }
      lily.position.set(spec.x, WATER_LEVEL + 0.012, spec.z);
      lily.rotation.y = i * 1.7;
      this.lilies.add(lily);
      this.lilyRigs.push({ group: lily, phase: i * 2.1 });
    }
    this.group.add(this.lilies);

    this.boat = makeBoat(materials);
    this.group.add(this.boat);

    const pebbleMaterial = materials.rock;
    const pebbleGeometry = new THREE.DodecahedronGeometry(0.07, 0);
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * Math.PI * 2 + 0.2;
      const r = pondRadiusAt(angle) + 0.04 + (i % 3) * 0.05;
      const pebble = new THREE.Mesh(pebbleGeometry, pebbleMaterial);
      pebble.position.set(Math.cos(angle) * r, WATER_LEVEL + 0.005, Math.sin(angle) * r);
      pebble.scale.set(1 + (i % 3) * 0.4, 0.55 + (i % 2) * 0.3, 0.8 + (i % 2) * 0.4);
      pebble.rotation.set(i, i * 2.1, i * 0.8);
      pebble.castShadow = false;
      this.group.add(pebble);
    }
  }

  update(ctx: SceneContext, palette: Palette): void {
    const uniforms = this.waterMaterial.uniforms;
    uniforms.uTime!.value = ctx.time;
    uniforms.uRain!.value = ctx.rain;
    uniforms.uNight!.value = ctx.night;
    (uniforms.uDeep!.value as THREE.Color).copy(palette.waterDeep);
    (uniforms.uShallow!.value as THREE.Color).copy(palette.waterShallow);
    (uniforms.uSky!.value as THREE.Color).copy(palette.horizon);
    (uniforms.uLightColor!.value as THREE.Color).copy(ctx.lightColor);
    (uniforms.uLightDirection!.value as THREE.Vector3).copy(ctx.lightDirection);

    const motion = ctx.reducedMotion ? 0.35 : 1;
    for (const rig of this.lilyRigs) {
      rig.group.position.y =
        WATER_LEVEL + 0.012 + Math.sin(ctx.time * 0.7 + rig.phase) * 0.006 * motion;
      rig.group.rotation.y += ctx.delta * 0.04 * motion;
    }
    this.boat.rotation.z = Math.sin(ctx.time * 0.55) * 0.012 * motion + 0.01;
    this.boat.position.y = WATER_LEVEL - 0.07 + Math.sin(ctx.time * 0.5 + 1.3) * 0.005 * motion;
  }
}
