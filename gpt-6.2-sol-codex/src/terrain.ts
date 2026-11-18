import * as T from 'three';
import { bake, box, clay, pebbleGeometry, place, random, tau } from './craft';

export const pond = { x: 2.15, z: 1.25, rx: 2.14, rz: 1.43, y: 0.048 };
const boundary = { x: 6.05, z: 4.3 };
const rays = 104;
const path = [
  [-2.53, 0.06], [-2.43, 0.86], [-1.75, 1.48], [-1.04, 1.82], [-0.25, 2.03],
  [0.28, 2.72], [1.2, 3.23], [2.45, 3.17], [3.48, 2.84], [4.37, 1.88],
  [4.6, 0.79], [4.09, -0.18], [3.25, -0.76], [2.57, -1.31],
];
const grass = new T.Color('#8caa58');
const lightGrass = new T.Color('#adbe65');
const footpath = new T.Color('#cfb58a');
const sand = new T.Color('#bcad79');
const moss = new T.Color('#71864a');

function coast(angle: number) {
  return 1 + 0.081 * Math.sin(angle * 3 + 0.25) + 0.065 * Math.cos(angle * 5 - 0.65)
    + 0.031 * Math.sin(angle * 8 + 0.65) + 0.022 * Math.cos(angle * 13);
}

export function landRatio(x: number, z: number) {
  const nx = x / boundary.x;
  const nz = z / boundary.z;
  return Math.hypot(nx, nz) / coast(Math.atan2(nz, nx));
}

export function pondRatio(x: number, z: number) {
  const nx = (x - pond.x) / pond.rx;
  const nz = (z - pond.z) / pond.rz;
  const angle = Math.atan2(nz, nx);
  return Math.hypot(nx, nz) / (1 + 0.09 * Math.sin(angle * 3 + 0.5) + 0.05 * Math.cos(angle * 5));
}

export function groundHeight(x: number, z: number) {
  const elevation = 0.33 + 0.12 * Math.sin(x * 0.77 + z * 0.65) +
    0.11 * Math.cos(z * 1.4 - x * 0.48) + 0.14 * Math.exp(-((x + 3.15) ** 2 + (z + 1.8) ** 2) / 6);
  const basin = T.MathUtils.smoothstep(pondRatio(x, z), 0.67, 1.12);
  const lip = 0.23 * T.MathUtils.smoothstep(landRatio(x, z), 0.87, 1.02);
  return T.MathUtils.lerp(-0.35, elevation, basin) - lip;
}

function pathDistance(x: number, z: number) {
  let distance = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const fraction = T.MathUtils.clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) /
      ((bx - ax) ** 2 + (bz - az) ** 2), 0, 1);
    distance = Math.min(distance, Math.hypot(x - T.MathUtils.lerp(ax, bx, fraction), z - T.MathUtils.lerp(az, bz, fraction)));
  }
  return distance;
}

function raisedSurface() {
  const positions = [0, groundHeight(0, 0), 0];
  const colors: number[] = [];
  const indices: number[] = [];
  const rng = random(8);
  const color = new T.Color();
  function shade(x: number, z: number) {
    const trail = 1 - T.MathUtils.smoothstep(pathDistance(x, z) + 0.035 * Math.cos(x * 13 + z * 9), 0.18, 0.36);
    const shore = 1 - T.MathUtils.smoothstep(pondRatio(x, z), 0.94, 1.06);
    color.copy(grass).lerp(lightGrass, 0.36 + 0.2 * Math.cos(x * 2 + z) + rng() * 0.24)
      .lerp(moss, T.MathUtils.smoothstep(landRatio(x, z), 0.88, 1) * 0.45)
      .lerp(footpath, trail * 0.9).lerp(sand, shore).multiplyScalar(0.94 + rng() * 0.12);
    colors.push(color.r, color.g, color.b);
  }

  shade(0, 0);
  const rings = 33;
  for (let ring = 1; ring <= rings; ring++) {
    for (let i = 0; i < rays; i++) {
      const angle = i * tau / rays;
      const radius = ring / rings * coast(angle);
      const x = Math.cos(angle) * boundary.x * radius;
      const z = Math.sin(angle) * boundary.z * radius;
      positions.push(x, groundHeight(x, z), z);
      shade(x, z);
      const curr = 1 + (ring - 1) * rays + i;
      const next = 1 + (ring - 1) * rays + (i + 1) % rays;
      if (ring === 1) indices.push(0, next, curr);
      else indices.push(curr - rays, next, curr, curr - rays, next - rays, next);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function rockBowl() {
  const segments = 52;
  const bands = [
    { radius: 1, y: 0, x: 0, z: 0, color: '#7b8f4a' },
    { radius: 1.016, y: -0.26, x: 0, z: 0, color: '#696a40' },
    { radius: 0.91, y: -0.70, x: -0.12, z: 0.02, color: '#a48968' },
    { radius: 0.83, y: -1.24, x: 0.03, z: 0.14, color: '#816957' },
    { radius: 0.67, y: -1.87, x: -0.32, z: 0.19, color: '#9f8166' },
    { radius: 0.56, y: -2.32, x: -0.45, z: 0.02, color: '#776153' },
    { radius: 0.36, y: -2.96, x: -0.67, z: -0.15, color: '#8e7564' },
    { radius: 0.23, y: -3.48, x: -0.82, z: -0.03, color: '#6d5a4f' },
    { radius: 0.002, y: -3.82, x: -0.98, z: 0.1, color: '#655347' },
  ];
  const rng = random(105);
  const layers = bands.map((band, layer) => Array.from({ length: layer === 0 ? rays : segments }, (_, i) => {
    const angle = i * tau / (layer === 0 ? rays : segments);
    const jitter = layer > 1 ? 1 + 0.061 * Math.sin(7 * angle + layer * 0.61) + (rng() - 0.5) * 0.08 : 1;
    const radius = coast(angle) * band.radius * jitter;
    const x = Math.cos(angle) * boundary.x * radius + band.x;
    const z = Math.sin(angle) * boundary.z * radius + band.z;
    const y = layer === 0 ? groundHeight(x, z) : band.y +
      0.15 * Math.sin(4 * angle + layer * 0.52) + 0.1 * Math.cos(7 * angle - layer);
    return [x, y, z];
  }));

  const positions: number[] = [];
  const colors: number[] = [];
  const color = new T.Color();
  function face(a: number[], b: number[], c: number[], band: string) {
    positions.push(...a, ...b, ...c);
    color.set(band).multiplyScalar(0.86 + rng() * 0.27);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  }

  for (let layer = 1; layer < layers.length; layer++) {
    const upper = layers[layer - 1];
    const lower = layers[layer];
    const bandColor = bands[layer].color;
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      if (layer === 1) {
        face(upper[2 * i], upper[2 * i + 1], lower[i], bandColor);
        face(upper[2 * i + 1], upper[2 * next], lower[next], bandColor);
        face(upper[2 * i + 1], lower[next], lower[i], bandColor);
      } else {
        face(upper[i], upper[next], lower[i], bandColor);
        face(upper[next], lower[next], lower[i], bandColor);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function makeTerrain(parent: T.Scene) {
  const surface = place(parent, raisedSurface(), clay('#ffffff', { vertexColors: true }));
  surface.castShadow = false;
  place(parent, rockBowl(), clay('#ffffff', { vertexColors: true }));

  const details = new T.Group();
  const rng = random(141);
  const rock = pebbleGeometry(27, 1);
  const leaf = pebbleGeometry(10);
  const rocks = ['#a8a08c', '#817c69', '#c1b59a'].map(color => clay(color));
  const petals = [clay('#e7ce6a'), clay('#f4ebc5'), clay('#d97661')];
  const blades = clay('#587942');
  for (let i = 0; i < 44; i++) {
    const angle = i * tau / 44 + rng() * 0.11;
    const x = Math.cos(angle) * boundary.x * coast(angle) * (0.9 + rng() * 0.08);
    const z = Math.sin(angle) * boundary.z * coast(angle) * (0.9 + rng() * 0.08);
    const size = 0.07 + rng() ** 2 * 0.32;
    place(details, rock, rocks[i % 3], x, groundHeight(x, z) - size * 0.05, z,
      size, size * 0.64, size * (0.65 + rng() * 0.38)).rotation.y = angle;
  }

  for (let i = 0; i < 190; i++) {
    const x = (rng() - 0.5) * 11.2;
    const z = (rng() - 0.5) * 7.8;
    if (landRatio(x, z) > 0.97 || pondRatio(x, z) < 1.1 || pathDistance(x, z) < 0.4 ||
        (Math.abs(x + 2.46) < 1.4 && Math.abs(z + 0.95) < 0.97) ||
        (Math.abs(x - 2.45) < 0.85 && Math.abs(z + 2.03) < 0.9)) continue;
    const y = groundHeight(x, z);
    for (let blade = -1; blade <= 1; blade++) {
      const grass = place(details, leaf, blades, x + blade * 0.04, y + 0.068, z, 0.025, 0.11 + rng() * 0.04, 0.018);
      grass.rotation.z = blade * 0.36 + rng() * 0.16;
    }
    if (i % 3 === 0) {
      place(details, leaf, blades, x, y + 0.115, z, 0.014, 0.12, 0.014);
      place(details, leaf, petals[i % 9 / 3], x, y + 0.235, z, 0.067, 0.041, 0.063);
    }
  }

  const wood = [clay('#9e7149'), clay('#b68959')];
  for (let i = 0; i < 8; i++) {
    box(details, wood[i % 2], 0.24 + i * 0.14, 0.155 - i * 0.003, 1.3, 0.132, 0.07, 0.51);
  }
  for (const x of [0.34, 1.18]) {
    for (const z of [1.085, 1.515]) box(details, wood[0], x, 0.085, z, 0.084, 0.42, 0.084);
  }
  for (const [x, z, size] of [[3.65, 1.1, .28], [3.88, .96, .15], [3.55, 1.31, .13], [2.1, 2.64, .24], [2.34, 2.64, .11], [0.56, 0.56, .23]]) {
    place(details, rock, rocks[0], x, Math.max(pond.y, groundHeight(x, z)), z, size, size * 0.72, size * 0.8);
  }
  const pads = clay('#6c9d59');
  const bloom = clay('#fff1d6');
  const pad = new T.CylinderGeometry(1, 1, 0.12, 11, 1, false, 0, tau - 0.35);
  for (const [x, z, size] of [[2.92, 1.81, .15], [3.15, 1.96, .11], [3.26, 1.72, .18], [1.68, 0.54, .12], [1.76, .76, .16]]) {
    place(details, pad, pads, x, pond.y + 0.011, z, size, 0.065, size * .8).rotation.y = rng() * tau;
    if (size > 0.14) place(details, leaf, bloom, x, pond.y + 0.037, z, .041, .035, .041);
  }

  bake(details);
  parent.add(details);
}
