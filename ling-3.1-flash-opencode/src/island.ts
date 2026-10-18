import * as THREE from 'three';
import { fbm } from './noise';

export const ISLAND_RADIUS = 5;

export interface PondRefs {
  group: THREE.Group;
  center: THREE.Vector3;
  radius: number;
  water: THREE.Mesh;
  shore: THREE.Mesh;
  deep: THREE.Mesh;
}

export interface FloatingRock {
  group: THREE.Group;
  baseY: number;
  phase: number;
  spin: number;
}

const GRASS = new THREE.Color('#6fae4e');
const GRASS_LIGHT = new THREE.Color('#8ccf63');
const GRASS_DARK = new THREE.Color('#5c9a42');
const DIRT = new THREE.Color('#8a6b4f');
const ROCK_WARM = new THREE.Color('#7d7468');
const ROCK_COOL = new THREE.Color('#5f5a52');

/**
 * The island body: a single lathe profile (grass top → cliff → tapered rock
 * underside), displaced with noise and painted with vertex colors, so the
 * silhouette and the underside read as one sculpted piece.
 */
export function buildIsland(): THREE.Group {
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.1),
    new THREE.Vector2(1.4, 0.16),
    new THREE.Vector2(2.8, 0.13),
    new THREE.Vector2(4.0, 0.08),
    new THREE.Vector2(4.85, 0.0),
    new THREE.Vector2(5.0, -0.12),
    new THREE.Vector2(4.72, -0.55),
    new THREE.Vector2(4.15, -1.15),
    new THREE.Vector2(3.35, -1.95),
    new THREE.Vector2(2.45, -2.75),
    new THREE.Vector2(1.55, -3.45),
    new THREE.Vector2(0.8, -4.0),
    new THREE.Vector2(0.25, -4.3),
    new THREE.Vector2(0.0, -4.42),
  ];

  const geo = new THREE.LatheGeometry(profile, 84);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const angle = Math.atan2(z, x);

    let nx = x;
    let ny = y;
    let nz = z;

    if (y > -0.05) {
      // Gentle bumps on the grassy top, fading out toward the rim so the
      // grass meets the cliff cleanly.
      const interior = 1 - Math.min(1, Math.max(0, (r - 4.1) / 0.85));
      ny += (fbm(angle * 1.4 + 10, r * 0.85) - 0.5) * 0.24 * interior;
      // Slight radial wobble of the rim.
      const wobble = 1 + (fbm(angle * 2.3, 3.7) - 0.5) * 0.05 * interior;
      nx *= wobble;
      nz *= wobble;
    } else {
      // Rocky underside: faceted radial displacement, suppressed near the tip.
      const depth = Math.min(1, Math.max(0, -y / 3.6));
      const n = fbm(angle * 2.6 + 4.2, y * 0.95 + 7.3, 4);
      const amp = 0.3 * Math.min(1, depth * 2.2);
      const wobble = 1 + (n - 0.5) * amp;
      nx *= wobble;
      nz *= wobble;
      ny += (fbm(angle * 3.1, y * 1.4 + 1.1) - 0.5) * 0.16 * depth;
    }

    pos.setXYZ(i, nx, ny, nz);

    // Vertex paint: grass on top, dirt cliff, grey rock below.
    if (y > -0.05) {
      const patch = fbm(angle * 2.0 + 21, r * 1.1);
      color.copy(GRASS).lerp(patch > 0.55 ? GRASS_LIGHT : GRASS_DARK, Math.min(1, Math.abs(patch - 0.55) * 2.4));
      if (r > 4.55) color.lerp(GRASS_DARK, 0.35); // slightly dry rim
    } else if (y > -0.7) {
      color.copy(DIRT).lerp(ROCK_WARM, Math.min(1, -y / 0.7) * 0.6);
    } else {
      const t = Math.min(1, (-y - 0.7) / 3.4);
      color.copy(ROCK_WARM).lerp(ROCK_COOL, t);
      const n = fbm(angle * 3.4, y * 1.8 + 9.9);
      color.offsetHSL(0, 0, (n - 0.5) * 0.08);
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

/** Small pond: sandy shoreline, darker depth ring, translucent water disc. */
export function buildPond(center: THREE.Vector3, radius: number): PondRefs {
  const group = new THREE.Group();
  group.position.copy(center);

  // Shore: wobbled sand disc, slightly larger than the water.
  const shoreGeo = new THREE.CircleGeometry(radius * 1.16, 44);
  const shorePos = shoreGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < shorePos.count; i++) {
    const x = shorePos.getX(i);
    const y = shorePos.getY(i);
    const r = Math.hypot(x, y);
    if (r > radius * 1.05) {
      const a = Math.atan2(y, x);
      const w = 1 + (fbm(a * 2.1, 5.5) - 0.5) * 0.22;
      shorePos.setX(i, x * w);
      shorePos.setY(i, y * w);
    }
  }
  shoreGeo.computeVertexNormals();
  const shoreMat = new THREE.MeshStandardMaterial({ color: '#d8c49c', roughness: 1 });
  const shore = new THREE.Mesh(shoreGeo, shoreMat);
  shore.rotation.x = -Math.PI / 2;
  shore.position.y = 0.02;
  shore.receiveShadow = true;

  const deepMat = new THREE.MeshStandardMaterial({ color: '#3f6f7d', roughness: 0.9 });
  const deep = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), deepMat);
  deep.rotation.x = -Math.PI / 2;
  deep.position.y = 0.045;

  const waterMat = new THREE.MeshStandardMaterial({
    color: '#7fb8c9',
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.07;
  water.receiveShadow = true;

  // A few stones hugging the shoreline.
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#8d877b', roughness: 1, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + fbm(i * 3.1, 0.7) * 0.8;
    const rr = radius * (1.02 + fbm(i * 1.7, 4.4) * 0.14);
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09 + fbm(i, 9.1) * 0.07, 0), stoneMat);
    stone.position.set(Math.cos(a) * rr, 0.05, Math.sin(a) * rr);
    stone.scale.y = 0.7;
    stone.rotation.set(fbm(i, 1) * 3, fbm(i, 2) * 3, 0);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  group.add(deep, water, shore);
  return { group, center, radius, water, shore, deep };
}

/** Small displaced rock, used both on the grass and floating near the underside. */
export function buildRock(size: number, seed: number): THREE.Group {
  const geo = new THREE.IcosahedronGeometry(size, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n = fbm(x * 0.9 + seed * 7.7, (y + z) * 0.9 + seed * 3.3, 3);
    const s = 1 + (n - 0.5) * 0.55;
    pos.setXYZ(i, x * s, y * s * 0.82, z * s);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#8b8578', roughness: 1, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}
