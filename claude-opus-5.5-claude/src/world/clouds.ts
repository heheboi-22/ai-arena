import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { smoothstep } from '../core/math';
import { jitter, placementMatrix } from '../core/parts';
import { Random } from '../core/random';
import { WIND_DIR } from './layout';

const SPAN = 13;

function cloudGeometry(seed: number, flat = 1): THREE.BufferGeometry {
  const rnd = new Random(seed);
  const puffs: THREE.BufferGeometry[] = [];
  const count = 5 + Math.floor(rnd.next() * 3);
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const r = (i === Math.floor(count / 2) ? 0.62 : rnd.range(0.32, 0.48)) * (1 - Math.abs(t) * 0.5);
    const g = jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.1, seed * 10 + i);
    g.applyMatrix4(placementMatrix({ x: t * 1.7, y: rnd.range(0, 0.18) + (0.5 - Math.abs(t)) * 0.2, z: rnd.range(-0.25, 0.25) }));
    puffs.push(g);
  }
  const merged = mergeGeometries(puffs, false)!;
  for (const p of puffs) p.dispose();
  // Flatten the underside so clouds sit on an invisible shelf, like a painted backdrop.
  const pos = merged.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setY(i, (y < -0.08 ? -0.08 + (y + 0.08) * 0.25 : y) * 0.78 * flat);
  }
  merged.computeVertexNormals();
  return merged;
}

interface Cloud {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  u: number;
  v: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
}

interface StormCloud {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  base: THREE.Vector3;
  size: number;
  phase: number;
}

const side = new THREE.Vector3(-WIND_DIR.z, 0, WIND_DIR.x);
const tmp = new THREE.Vector3();

export interface CloudLook {
  color: THREE.Color;
  emissive: THREE.Color;
  storm: THREE.Color;
}

export function buildClouds() {
  const group = new THREE.Group();
  group.name = 'clouds';
  const makeMaterial = () =>
    new THREE.MeshStandardMaterial({ color: '#fbf8f2', roughness: 1, flatShading: true, transparent: true });

  // v > 0 is the viewer's side of the island, so those clouds sit low or high to keep the view clear.
  const layout: [number, number, number, number][] = [
    [-7.0, 2.6, 1.35, -6],
    [-9.0, 0.4, 1.7, 3],
    [-5.8, -2.4, 1.1, 9],
    [-8.0, -4.6, 1.5, -1],
    [6.8, -5.4, 1.3, 1],
    [7.5, 5.2, 1.0, -10],
    [-6.5, 4.6, 1.15, 10.5],
  ];
  const clouds: Cloud[] = layout.map(([v, y, size, u], i) => {
    const material = makeMaterial();
    const mesh = new THREE.Mesh(cloudGeometry(70 + i), material);
    mesh.scale.setScalar(size);
    mesh.rotation.y = Math.atan2(-WIND_DIR.z, WIND_DIR.x);
    mesh.raycast = () => {};
    group.add(mesh);
    return { mesh, material, u, v, y, size, speed: 0.85 + (i % 3) * 0.15, phase: i * 1.3 };
  });

  // Rain clouds gather over the island only while it rains.
  const stormSpots: [number, number, number, number][] = [
    [-1.5, 4.35, 0.3, 1.9],
    [1.0, 4.6, 1.7, 1.7],
    [-2.3, 4.5, -1.8, 1.5],
    [1.9, 4.75, -0.3, 1.4],
  ];
  const storms: StormCloud[] = stormSpots.map(([x, y, z, size], i) => {
    const material = makeMaterial();
    const mesh = new THREE.Mesh(cloudGeometry(120 + i, 0.85), material);
    mesh.visible = false;
    mesh.rotation.y = Math.atan2(-WIND_DIR.z, WIND_DIR.x) + i * 0.4;
    mesh.raycast = () => {};
    group.add(mesh);
    return { mesh, material, base: new THREE.Vector3(x, y, z), size, phase: i * 2.1 };
  });

  return {
    group,
    update(
      dt: number,
      elapsed: number,
      wind: number,
      rain: number,
      camera: THREE.Camera,
      look: CloudLook,
      motion: number,
    ) {
      const drift = wind * 1.35 * (0.35 + 0.65 * motion);
      for (const c of clouds) {
        c.u += dt * drift * c.speed;
        if (c.u > SPAN) c.u -= SPAN * 2;
        const edge = smoothstep(SPAN, SPAN - 3, Math.abs(c.u));
        const bob = Math.sin(elapsed * 0.3 + c.phase) * 0.12 * motion;
        c.mesh.position.copy(WIND_DIR).multiplyScalar(c.u).addScaledVector(side, c.v);
        c.mesh.position.y = c.y + bob - rain * 0.4;
        c.mesh.scale.setScalar(c.size * (0.25 + 0.75 * edge) * (1 + rain * 0.12));
        const near = camera.position.distanceTo(c.mesh.position) - c.size * 1.2;
        c.material.opacity = edge * smoothstep(1.0, 4.0, near);
        c.mesh.visible = c.material.opacity > 0.01;
        c.material.color.copy(look.color);
        c.material.emissive.copy(look.emissive);
      }
      for (const s of storms) {
        const k = smoothstep(0, 1, rain);
        s.mesh.visible = k > 0.01;
        if (!s.mesh.visible) continue;
        tmp.copy(WIND_DIR).multiplyScalar(Math.sin(elapsed * 0.12 + s.phase) * 0.5 * motion);
        s.mesh.position.copy(s.base).add(tmp);
        s.mesh.position.y += (1 - k) * 0.8;
        s.mesh.scale.setScalar(s.size * (0.45 + 0.55 * k));
        const near = camera.position.distanceTo(s.mesh.position) - s.size * 1.2;
        s.material.opacity = k * smoothstep(1.0, 4.0, near);
        s.material.color.copy(look.storm);
        s.material.emissive.copy(look.emissive).multiplyScalar(0.6);
      }
    },
  };
}
