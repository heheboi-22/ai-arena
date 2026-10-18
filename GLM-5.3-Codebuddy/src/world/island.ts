import * as THREE from 'three';
import { Rng, clamp, lerp, smoothstep, jitterFacets, paintGeometry, mergePainted, TAU } from '../util';

export const ISLAND = {
  R: 5.6,
  dome: 0.55,
  depth: 3.35,
  pond: { x: 2.1, z: 1.6, r: 1.35, shore: 0.62 },
};

export const POND_WATER_Y = 0.10;

/** Wobble multiplier for the rim radius by angle (measured atan2(x, z)). */
export function rimWobble(angle: number): number {
  return (
    1 +
    0.055 * Math.sin(3 * angle + 1.7) +
    0.032 * Math.sin(7 * angle + 0.4) +
    0.02 * Math.sin(11 * angle + 3.1)
  );
}

export function rimRadius(angle: number): number {
  return ISLAND.R * rimWobble(angle);
}

/**
 * Height of the grass surface at any point: a gentle dome toward the center,
 * flattened to near-rim level around the pond so the water can sit flush.
 * Every prop is placed with this same function, so nothing floats or sinks.
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const dome = ISLAND.dome * Math.max(0, 1 - Math.pow(r / ISLAND.R, 2.3));
  const pr = Math.hypot(x - ISLAND.pond.x, z - ISLAND.pond.z);
  const flat = 1 - smoothstep(ISLAND.pond.r + 0.1, ISLAND.pond.r + ISLAND.pond.shore + 0.3, pr);
  return lerp(dome, 0.05, flat);
}

export function buildIsland(): THREE.Group {
  const rng = new Rng(1234);
  const group = new THREE.Group();

  // ------------------------------------------------ grass cap (polar grid)
  const SEG = 112;
  const RINGS = 15;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];

  const cGrass = new THREE.Color(0x77b258);
  const cDry = new THREE.Color(0xa9c466);
  const cDirt = new THREE.Color(0x9a8560);
  const cSand = new THREE.Color(0xd8c290);
  const c = new THREE.Color();

  pos.push(0, terrainHeight(0, 0), 0);
  c.copy(cGrass).multiplyScalar(0.97 + rng.next() * 0.1);
  col.push(c.r, c.g, c.b);

  for (let ring = 1; ring <= RINGS; ring++) {
    const rr = ring / RINGS;
    for (let seg = 0; seg < SEG; seg++) {
      const a = (seg / SEG) * TAU;
      const rad = rr * rimRadius(a);
      const x = Math.sin(a) * rad;
      const z = Math.cos(a) * rad;
      pos.push(x, terrainHeight(x, z), z);

      c.copy(cGrass).multiplyScalar(0.93 + rng.next() * 0.14);
      const patch = Math.sin(x * 1.35 + 2.0) * Math.cos(z * 1.6 + 0.7);
      if (patch > 0.3) c.lerp(cDry, Math.min(1, (patch - 0.3) * 0.6));
      if (rr > 0.86) c.lerp(cDirt, smoothstep(0.86, 1.0, rr) * 0.55);
      const pr = Math.hypot(x - ISLAND.pond.x, z - ISLAND.pond.z);
      c.lerp(cSand, (1 - smoothstep(ISLAND.pond.r + 0.05, ISLAND.pond.r + ISLAND.pond.shore + 0.35, pr)) * 0.85);
      col.push(c.r, c.g, c.b);
    }
  }

  const ringIndex = (ring: number, seg: number) => 1 + (ring - 1) * SEG + (((seg % SEG) + SEG) % SEG);
  for (let seg = 0; seg < SEG; seg++) {
    idx.push(0, ringIndex(1, seg), ringIndex(1, seg + 1));
  }
  for (let ring = 1; ring < RINGS; ring++) {
    for (let seg = 0; seg < SEG; seg++) {
      const i0 = ringIndex(ring, seg);
      const i1 = ringIndex(ring, seg + 1);
      const i2 = ringIndex(ring + 1, seg + 1);
      const i3 = ringIndex(ring + 1, seg);
      idx.push(i0, i3, i2, i0, i2, i1);
    }
  }

  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  grassGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  grassGeo.setIndex(idx);
  grassGeo.computeVertexNormals();

  const grass = new THREE.Mesh(
    grassGeo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }),
  );
  grass.receiveShadow = true;
  group.add(grass);

  // ---------------------------------------------- sculpted rocky underside
  const profile: THREE.Vector2[] = [];
  const STEPS = 14;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const r = lerp(5.45, 0.32, Math.pow(t, 1.35)) + Math.sin(t * Math.PI) * 0.22;
    profile.push(new THREE.Vector2(r, -t * ISLAND.depth));
  }
  profile.push(new THREE.Vector2(0.02, -ISLAND.depth - 0.18)); // taper to a tip

  const rockGeo = new THREE.LatheGeometry(profile, SEG);
  const rp = rockGeo.attributes.position as THREE.BufferAttribute;
  const rcol = new Float32Array(rp.count * 3);
  const cDirtDeep = new THREE.Color(0x86654a);
  const cRockGray = new THREE.Color(0x77746c);
  const cMoss = new THREE.Color(0x6f8f5a);

  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i);
    const y = rp.getY(i);
    const z = rp.getZ(i);
    const r = Math.hypot(x, z);
    const a = Math.atan2(x, z);
    const t = clamp(-y / ISLAND.depth, 0, 1);
    if (r > 0.05) {
      // match the grass silhouette (slightly inset for a lip of overhang),
      // then swell the middle with angular noise so the cone feels sculpted
      const w = rimWobble(a) * 0.97;
      const amp = smoothstep(0.02, 0.2, t) * (1 - smoothstep(0.72, 0.96, t));
      const bulge =
        (Math.sin(a * 4 + 0.8) * 0.5 +
          Math.sin(a * 9 + 2.2) * 0.3 +
          Math.sin(a * 6 - 1.1 + y * 2.6) * 0.4) *
        0.5 *
        amp;
      const scale = (r * w + bulge) / r;
      rp.setXYZ(i, x * scale, y, z * scale);
    }
    // strata colors: warm dirt near the grass fading to cool rock, banded
    c.copy(cDirtDeep).lerp(cRockGray, Math.min(1, t * 1.15));
    c.multiplyScalar(0.94 + 0.08 * (0.5 + 0.5 * Math.sin(y * 6.2 + a * 1.5)));
    if (t < 0.09) c.lerp(cMoss, 0.3 * (1 - t / 0.09));
    rcol[i * 3] = c.r;
    rcol[i * 3 + 1] = c.g;
    rcol[i * 3 + 2] = c.b;
  }
  rockGeo.setAttribute('color', new THREE.BufferAttribute(rcol, 3));
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.receiveShadow = true;
  group.add(rock);

  // chunky lumps breaking up the underside silhouette
  const lumps: THREE.BufferGeometry[] = [];
  const lumpSpecs = [
    { a: 0.9, t: 0.42, s: 0.62 },
    { a: 2.9, t: 0.6, s: 0.5 },
    { a: 4.6, t: 0.33, s: 0.55 },
  ];
  for (const spec of lumpSpecs) {
    const g = new THREE.IcosahedronGeometry(spec.s, 1).toNonIndexed();
    jitterFacets(g, 0.16, rng);
    const rr = lerp(5.45, 0.32, Math.pow(spec.t, 1.35)) * 0.8;
    g.translate(Math.sin(spec.a) * rr, -spec.t * ISLAND.depth + 0.12, Math.cos(spec.a) * rr);
    paintGeometry(g, 0x746f66, 0.12);
    lumps.push(g);
  }
  group.add(new THREE.Mesh(mergePainted(lumps), rockMat));

  return group;
}
