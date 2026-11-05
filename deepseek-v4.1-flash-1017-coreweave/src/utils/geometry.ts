import * as THREE from 'three';

export const mergePainted = (
  parts: Array<{ geometry: THREE.BufferGeometry; color: THREE.Color }>
): THREE.BufferGeometry => {
  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let offset = 0;

  for (const part of parts) {
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    const pos = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      colors.push(part.color.r, part.color.g, part.color.b);
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
      else uvs.push(0, 0);
      indices.push(offset + i);
    }
    offset += pos.count;
    if (geometry !== part.geometry) geometry.dispose();
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
};

export const radialDisc = (
  radius: number,
  rings: number,
  segments: number,
  edgeRadius: (angle: number) => number,
  heightAt: (x: number, z: number) => number
): THREE.BufferGeometry => {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  positions.push(0, heightAt(0, 0), 0);
  uvs.push(0.5, 0.5);

  for (let ring = 1; ring <= rings; ring += 1) {
    const f = Math.pow(ring / rings, 0.94);
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const r = radius * f * edgeRadius(angle);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      positions.push(x, heightAt(x, z), z);
      uvs.push(0.5 + Math.cos(angle) * f * 0.5, 0.5 + Math.sin(angle) * f * 0.5);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(0, 1 + next, 1 + segment);
  }

  for (let ring = 1; ring < rings; ring += 1) {
    const row = 1 + (ring - 1) * segments;
    const nextRow = 1 + ring * segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      indices.push(row + segment, row + next, nextRow + next);
      indices.push(row + segment, nextRow + next, nextRow + segment);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

export const makeWaterDisc = (
  radius: number,
  segments: number,
  edgeRadius: (angle: number) => number
): THREE.BufferGeometry => {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  positions.push(0, 0, 0);
  uvs.push(0.5, 0.5);
  for (let i = 0; i < segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const r = radius * edgeRadius(angle);
    positions.push(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    uvs.push(0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5);
  }
  for (let i = 0; i < segments; i += 1) {
    indices.push(0, 1 + ((i + 1) % segments), 1 + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

export const makeGrassTuft = (): THREE.BufferGeometry => {
  const positions: number[] = [];
  const indices: number[] = [];
  const colors: number[] = [];
  const blades = 5;
  for (let b = 0; b < blades; b += 1) {
    const angle = (b / blades) * Math.PI * 2 + 0.4;
    const width = 0.028;
    const height = 0.14 + (b % 3) * 0.035;
    const lean = 0.05 + (b % 2) * 0.025;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const base = positions.length / 3;
    const sideX = cos * width;
    const sideZ = sin * width;
    const tipX = cos * lean;
    const tipZ = sin * lean;
    positions.push(-sideX, 0, -sideZ, sideX, 0, sideZ, tipX, height, tipZ);
    indices.push(base, base + 1, base + 2);
    const shade = 0.8 + b * 0.035;
    colors.push(shade, shade, shade, shade, shade, shade, shade * 1.1, shade * 1.1, shade * 1.1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

export const makeFlowerHead = (): THREE.BufferGeometry => {
  const petals = 5;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < petals; i += 1) {
    const angle = (i / petals) * Math.PI * 2;
    const petal = new THREE.SphereGeometry(0.045, 6, 4);
    petal.scale(1.15, 0.38, 0.7);
    petal.translate(Math.cos(angle) * 0.05, 0, Math.sin(angle) * 0.05);
    parts.push(petal);
  }
  const merged = mergeNonIndexed(parts);
  merged.computeVertexNormals();
  return merged;
};

const mergeNonIndexed = (geometries: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (const geometry of geometries) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i += 1) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
    if (g !== geometry) g.dispose();
    geometry.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return merged;
};
