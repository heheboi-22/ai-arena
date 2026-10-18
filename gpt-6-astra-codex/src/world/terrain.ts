import * as THREE from 'three';
import { flatShape, material, mesh, palette, random, shapeFrom } from './primitives';

export const POND = { x: 1.9, z: 1.6, rx: 1.67, rz: 1.13, y: 0.205 };
export function pondPoint(angle: number, scale = 1) {
  const ripple = 1 + 0.09 * Math.sin(angle * 3 + 1.1) + 0.045 * Math.cos(angle * 5);
  return new THREE.Vector2(POND.x + Math.cos(angle) * POND.rx * ripple * scale,
    POND.z + Math.sin(angle) * POND.rz * ripple * scale);
}
export function inPond(x: number, z: number, margin = 1) {
  const angle = Math.atan2((z - POND.z) / POND.rz, (x - POND.x) / POND.rx);
  const edge = pondPoint(angle, margin);
  return Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz)
    < Math.hypot((edge.x - POND.x) / POND.rx, (edge.y - POND.z) / POND.rz);
}
export function islandPoint(angle: number) {
  const r = 1 + 0.06 * Math.sin(3 * angle + 0.3) + 0.035 * Math.cos(7 * angle) + 0.025 * Math.sin(11 * angle);
  return new THREE.Vector2(5.2 * Math.cos(angle) * r, 3.9 * Math.sin(angle) * r);
}
export function onIsland(x: number, z: number) {
  const a = Math.atan2(z / 3.9, x / 5.2);
  const p = islandPoint(a);
  return Math.hypot(x / 5.2, z / 3.9) < Math.hypot(p.x / 5.2, p.y / 3.9);
}

export function createTerrain(parent: THREE.Group) {
  const rand = random(491);
  const outline = Array.from({ length: 64 }, (_, i) => islandPoint(i / 64 * Math.PI * 2));
  const lakeOutline = Array.from({ length: 64 }, (_, i) => pondPoint(i / 64 * Math.PI * 2));
  const shoreOutline = Array.from({ length: 64 }, (_, i) => pondPoint(i / 64 * Math.PI * 2, 1.16));
  const top = shapeFrom(outline);
  top.holes.push(new THREE.Path(shoreOutline.map(p => new THREE.Vector2(p.x, -p.y))));
  const grassGeometry = new THREE.ShapeGeometry(top);
  grassGeometry.rotateX(-Math.PI / 2);
  mesh(grassGeometry, material(palette.grass), parent, 0, 0.28, 0);

  const shore = shapeFrom(shoreOutline);
  shore.holes.push(new THREE.Path(lakeOutline.map(p => new THREE.Vector2(p.x, -p.y))));
  const shoreGeo = new THREE.ShapeGeometry(shore);
  shoreGeo.rotateX(-Math.PI / 2);
  mesh(shoreGeo, material('#d3caa1'), parent, 0, 0.255, 0);
  flatShape(lakeOutline, material('#4d8991', { roughness: 0.3, metalness: 0.15 }), parent, POND.y);

  const positions: number[] = [], colors: number[] = [];
  const ringCount = 64;
  const rings: THREE.Vector3[][] = [];
  const ringSpecs = [ [1, 0.26], [1.015, -0.04], [0.98, -0.43], [0.85, -1.35], [0.62, -2.2], [0.22, -2.8], [0, -3.05] ];
  for (let j = 0; j < ringSpecs.length; j++) {
    const [scale, y] = ringSpecs[j];
    rings.push(outline.map((p) => new THREE.Vector3(p.x * scale, y + (j > 1 ? (rand() - 0.5) * 0.6 : 0), p.y * scale)));
  }
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < ringCount; i++) {
      const next = (i + 1) % ringCount;
      const vertices = [rings[j][i], rings[j][next], rings[j + 1][i], rings[j][next], rings[j + 1][next], rings[j + 1][i]];
      const color = new THREE.Color(j === 0 ? '#819760' : j === 1 ? '#948363' : '#a08c77');
      color.offsetHSL((rand() - 0.5) * 0.045, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.13);
      for (const p of vertices) { positions.push(p.x, p.y, p.z); colors.push(color.r, color.g, color.b); }
    }
  }
  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  rockGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  rockGeo.computeVertexNormals();
  mesh(rockGeo, material('#ffffff', { vertexColors: true, flatShading: true }), parent);

  const waterLines = new THREE.Group(); parent.add(waterLines);
  const lineMat = new THREE.MeshBasicMaterial({ color: '#b1d6ca', transparent: true, opacity: 0.24, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const x = POND.x - 0.8 + rand() * 1.6, z = POND.z - 0.6 + rand() * 1.2;
    const line = mesh(new THREE.PlaneGeometry(0.25 + rand() * 0.6, 0.017), lineMat, waterLines, x, POND.y + 0.008, z);
    line.rotation.x = -Math.PI / 2;
    line.castShadow = false;
  }
  return { waterLines };
}
