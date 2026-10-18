import * as THREE from 'three';
import { Rng } from '../util';
import { ISLAND, POND_WATER_Y, terrainHeight } from './island';
import * as M from './materials';
import type { SwayTarget } from './nature';

export interface PondBuild {
  group: THREE.Group;
  waterMat: THREE.ShaderMaterial;
  ripples: RipplePool;
  swayers: SwayTarget[];
}

const WATER_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform float uTime;
uniform float uRain;
varying vec3 vWorld;

float wave(vec2 p) {
  return sin(p.x * 2.3 + uTime * 0.85) * 0.5
       + sin(p.y * 1.9 - uTime * 0.62) * 0.5
       + sin((p.x + p.y) * 1.4 + uTime * 1.3) * 0.35;
}
float chop(vec2 p) {
  return sin(p.x * 9.5 + uTime * 3.1) * 0.5 + sin(p.y * 8.5 - uTime * 2.7) * 0.5;
}

void main() {
  vec2 p = vWorld.xz;
  float rainAmp = 0.18 + uRain * 1.15;
  float e = 0.07;
  float h0 = wave(p) + chop(p) * rainAmp;
  float hx = wave(p + vec2(e, 0.0)) + chop(p + vec2(e, 0.0)) * rainAmp;
  float hz = wave(p + vec2(0.0, e)) + chop(p + vec2(0.0, e)) * rainAmp;
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.32, 1.0, -(hz - h0) / e * 0.32));
  vec3 V = normalize(cameraPosition - vWorld);

  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 col = mix(uDeep, uShallow, 0.3 + 0.45 * ndl);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col = mix(col, uSkyColor, fres * 0.72);
  vec3 hv = normalize(uSunDir + V);
  col += uSunColor * pow(max(dot(n, hv), 0.0), 90.0) * (0.85 + uRain * 0.5);
  col += uDeep * 0.16; // floor so the pond never disappears at night

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Pooled expanding rings — rain pattering on the pond. */
export class RipplePool {
  private items: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; scale: number; strength: number }> =
    [];
  private rainTimer = 0;
  private idleTimer = 2.4;

  constructor(parent: THREE.Object3D) {
    const geo = new THREE.RingGeometry(0.16, 0.215, 22);
    for (let i = 0; i < 26; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xdbeeff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = POND_WATER_Y + 0.012 + i * 0.0004;
      mesh.visible = false;
      mesh.renderOrder = 3;
      parent.add(mesh);
      this.items.push({ mesh, mat, life: 1, scale: 1, strength: 1 });
    }
  }

  private spawn(x: number, z: number, scale: number, strength: number): void {
    let best = this.items[0];
    for (const it of this.items) {
      if (it.life >= 1) {
        best = it;
        break;
      }
      if (it.life > best.life) best = it;
    }
    best.life = 0;
    best.scale = scale;
    best.strength = strength;
    best.mesh.position.x = x;
    best.mesh.position.z = z;
    best.mesh.visible = true;
  }

  update(dt: number, raining: boolean, intensity: number, night: number, reduced: boolean): void {
    if (raining && intensity > 0.02) {
      this.rainTimer += dt * 15 * intensity;
      while (this.rainTimer >= 1) {
        this.rainTimer -= 1;
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * ISLAND.pond.r * 0.82;
        this.spawn(ISLAND.pond.x + Math.sin(a) * rr, ISLAND.pond.z + Math.cos(a) * rr, 1, 1);
      }
    } else {
      this.rainTimer = 0;
    }

    if (!reduced) {
      // the occasional fish-mouth or dragonfly touch keeps the pond alive
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.idleTimer = 2.4 + Math.random() * 1.8;
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * ISLAND.pond.r * 0.55;
        this.spawn(ISLAND.pond.x + Math.sin(a) * rr, ISLAND.pond.z + Math.cos(a) * rr, 0.55, 0.35);
      }
    }

    const dim = 1 - night * 0.5;
    for (const it of this.items) {
      if (it.life >= 1) continue;
      it.life += dt / 0.85;
      if (it.life >= 1) {
        it.mesh.visible = false;
        continue;
      }
      const eased = 1 - (1 - it.life) * (1 - it.life);
      const s = (0.4 + eased * 2.1) * it.scale;
      it.mesh.scale.set(s, s, 1);
      it.mat.opacity = it.strength * 0.5 * (1 - it.life) * dim;
    }
  }
}

/** One clump of cattail reeds (sways in the wind). */
function reedClump(rng: Rng): THREE.Group {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4c7a44, roughness: 0.9 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.85 });
  const count = 2 + Math.floor(rng.next() * 2);
  for (let i = 0; i < count; i++) {
    const h = rng.range(0.42, 0.62);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.018, h, 5), stemMat);
    stem.position.set(rng.range(-0.07, 0.07), h / 2, rng.range(-0.07, 0.07));
    stem.rotation.z = rng.range(-0.12, 0.12);
    stem.castShadow = true;
    g.add(stem);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.1, 6), tipMat);
    tip.position.set(stem.position.x + Math.sin(stem.rotation.z) * h * -0.5, h + 0.03, stem.position.z);
    g.add(tip);
  }
  return g;
}

export function buildPond(): PondBuild {
  const rng = new Rng(99);
  const group = new THREE.Group();
  const swayers: SwayTarget[] = [];
  const pond = ISLAND.pond;

  // sandy shore ring, darker where it's wet
  const shore = new THREE.RingGeometry(pond.r - 0.04, pond.r + pond.shore, 48, 10);
  const sp = shore.attributes.position as THREE.BufferAttribute;
  const shoreCol = new Float32Array(sp.count * 3);
  const cWet = new THREE.Color(0xb3986d);
  const cDry = new THREE.Color(0xd6bd8c);
  const tmp = new THREE.Color();
  for (let i = 0; i < sp.count; i++) {
    const rr = Math.hypot(sp.getX(i), sp.getY(i));
    const t = (rr - (pond.r - 0.04)) / (pond.shore + 0.04);
    tmp.copy(cWet).lerp(cDry, Math.min(1, t * 1.35));
    shoreCol[i * 3] = tmp.r;
    shoreCol[i * 3 + 1] = tmp.g;
    shoreCol[i * 3 + 2] = tmp.b;
  }
  shore.setAttribute('color', new THREE.BufferAttribute(shoreCol, 3));
  shore.rotateX(-Math.PI / 2);
  const shoreMesh = new THREE.Mesh(shore, M.sand);
  shoreMesh.position.set(pond.x, 0.068, pond.z);
  shoreMesh.receiveShadow = true;
  group.add(shoreMesh);

  // the water itself
  const waterMat = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(0xffe6b0) },
      uSkyColor: { value: new THREE.Color(0xffe2b2) },
      uDeep: { value: new THREE.Color(0x2c7cab) },
      uShallow: { value: new THREE.Color(0xe8c890) },
      uTime: { value: 0 },
      uRain: { value: 0 },
    },
  });
  const waterGeo = new THREE.CircleGeometry(pond.r, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(pond.x, POND_WATER_Y, pond.z);
  water.renderOrder = 2;
  group.add(water);

  const ripples = new RipplePool(group);

  // reeds around the bank
  const reedSpots: Array<[number, number]> = [
    [3.24, 2.5],
    [3.46, 1.1],
    [1.18, 2.74],
  ];
  for (const [x, z] of reedSpots) {
    const clump = reedClump(rng);
    clump.position.set(x, terrainHeight(x, z), z);
    group.add(clump);
    swayers.push({ obj: clump, phase: rng.range(0, Math.PI * 2), speed: rng.range(1.6, 2.1) });
  }

  return { group, waterMat, ripples, swayers };
}

