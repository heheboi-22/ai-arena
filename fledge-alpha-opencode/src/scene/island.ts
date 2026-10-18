import * as THREE from 'three';
import { bump, rimNoise } from './noise';

export const ISLAND_TOP = 2.8;
export const ISLAND_RADIUS = 6;

export function groundY(x: number, z: number): number {
  return ISLAND_TOP + bump(x, z) * 1.0;
}

export function insideIsland(x: number, z: number, margin = 1): boolean {
  const a = Math.atan2(z, x);
  const r = Math.hypot(x, z);
  const max = ISLAND_RADIUS * (1 + rimNoise(a)) - margin;
  return r < max;
}

export function buildIsland(): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(ISLAND_RADIUS, 1.4, 5.6, 80, 6, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const angle = Math.atan2(z, x);
    const r = Math.hypot(x, z);

    if (r > 0.001) {
      const edge = rimNoise(angle, y * 0.23) * (y > 2.0 ? 1.0 : 0.55);
      const scale = 1 + edge;
      x *= scale;
      z *= scale;

      // Sculpt the rocky underside with extra noise
      if (y < 2.0) {
        const rock = 1 + 0.16 * Math.sin(angle * 6 + y * 2.1) * Math.cos(y * 1.7 + angle);
        x *= rock;
        z *= rock;
        y += 0.25 * Math.sin(angle * 4 + y * 3.1) * (y < -1 ? 1 : 0.4);
      }
      // Gentle bumps on the top surface
      if (y > 2.4) {
        y += bump(x, z);
      }
    }
    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();

  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grass = new THREE.Color(0x6fa35c);
  const grassDry = new THREE.Color(0x88b46a);
  const dirt = new THREE.Color(0x8a6a4e);
  const rock = new THREE.Color(0x7d7468);
  const rockDark = new THREE.Color(0x5d564d);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const ny = normals.getY(i);
    const y = pos.getY(i);
    const j = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const fract = j - Math.floor(j);
    const jitter = 0.05 * (fract - 0.5);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const patch = 0.5 + 0.5 * Math.sin(x * 1.1 + z * 0.7 + Math.sin(z * 1.9) * 0.8);
    if (ny > 0.55) {
      c.copy(grass).lerp(grassDry, patch);
    } else if (y > 1.6) {
      c.copy(dirt);
    } else {
      c.copy(rock).lerp(rockDark, THREE.MathUtils.clamp((-y) / 3, 0, 1));
    }
    c.offsetHSL(0, 0, jitter);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  const topMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: false, roughness: 0.95 });
  const mesh = new THREE.Mesh(geo, [bodyMat, topMat, bodyMat]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}
