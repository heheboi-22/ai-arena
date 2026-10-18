import * as THREE from 'three';
import { ISLAND_RADIUS } from '../config';
import { angleNoise, edgeFactor, lerp, smoothstep } from '../utils';

const RADIAL = 96;
const TOP_RINGS = 6;
const SIDE_RINGS = 16;
const UNDERSIDE_DEPTH = 4.75;

/**
 * Procedural floating island: a flat grassy top with an irregular,
 * noise-sculpted outline and a tapered rocky underside that pinches
 * into a point. Vertex colours do the material work (grass → dirt →
 * rock) so a single draw call renders the whole landmass.
 */
export function createIsland(): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const grass = new THREE.Color('#7cc46f');
  const grassLight = new THREE.Color('#8fd07f');
  const grassEdge = new THREE.Color('#62ab55');
  const dirt = new THREE.Color('#8a6742');
  const rock = new THREE.Color('#847b6e');
  const rockDark = new THREE.Color('#565049');

  const push = (x: number, y: number, z: number, c: THREE.Color): number => {
    positions.push(x, y, z);
    colors.push(c.r, c.g, c.b);
    return positions.length / 3 - 1;
  };

  const ringStart: number[] = [];
  let centerIndex = -1;

  // --- top centre vertex (single) ---
  centerIndex = push(0, 0, 0, grassLight);

  // --- grassy top rings ---
  for (let i = 1; i <= TOP_RINGS; i++) {
    ringStart.push(positions.length / 3);
    const f = i / TOP_RINGS;
    for (let s = 0; s < RADIAL; s++) {
      const a = (s / RADIAL) * Math.PI * 2;
      // Edge noise fades in quadratically so the centre stays flat.
      const ef = lerp(1, edgeFactor(a), f * f);
      const r = ISLAND_RADIUS * f * ef;
      // Gentle mottling so the lawn is not one flat colour.
      const mottle = 0.5 + 0.5 * angleNoise(a + 3.1);
      const c = grass.clone().lerp(grassEdge, f * 0.75 + 0.2 * mottle * f);
      c.lerp(grassLight, 0.25 * mottle * (1 - f));
      push(Math.cos(a) * r, 0, Math.sin(a) * r, c);
    }
  }

  // --- rocky underside rings ---
  for (let k = 1; k < SIDE_RINGS; k++) {
    ringStart.push(positions.length / 3);
    const p = k / SIDE_RINGS;
    for (let s = 0; s < RADIAL; s++) {
      const a = (s / RADIAL) * Math.PI * 2;
      const n = angleNoise(a);
      const n2 = angleNoise(a + 1.9);
      const belly = 1 + 0.06 * Math.sin(p * Math.PI);
      let r =
        ISLAND_RADIUS *
        edgeFactor(a) *
        Math.pow(Math.cos((p * Math.PI) / 2), 1.25) *
        belly;
      r *= 1 + lerp(0.02, 0.14, p) * n;
      const y =
        -UNDERSIDE_DEPTH * Math.pow(Math.sin((p * Math.PI) / 2), 1.15) +
        0.2 * p * n2;
      const c = dirt
        .clone()
        .lerp(rock, smoothstep(0.05, 0.24, p));
      c.lerp(rockDark, p * 0.7 + 0.22 * n);
      push(Math.cos(a) * r, y, Math.sin(a) * r, c);
    }
  }

  const bottomIndex = push(0, -UNDERSIDE_DEPTH - 0.35, 0, rockDark);

  // --- indices ---
  const topEdgeStart = ringStart[0];

  // centre fan
  for (let s = 0; s < RADIAL; s++) {
    const s1 = (s + 1) % RADIAL;
    indices.push(centerIndex, topEdgeStart + s1, topEdgeStart + s);
  }

  // quads between consecutive rings (top rings and underside rings)
  const totalRings = ringStart.length;
  for (let ring = 0; ring < totalRings - 1; ring++) {
    const a0 = ringStart[ring];
    const b0 = ringStart[ring + 1];
    for (let s = 0; s < RADIAL; s++) {
      const s1 = (s + 1) % RADIAL;
      indices.push(a0 + s, a0 + s1, b0 + s);
      indices.push(a0 + s1, b0 + s1, b0 + s);
    }
  }

  // bottom cap
  const lastRing = ringStart[totalRings - 1];
  for (let s = 0; s < RADIAL; s++) {
    const s1 = (s + 1) % RADIAL;
    indices.push(bottomIndex, lastRing + s, lastRing + s1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'island';
  return mesh;
}
