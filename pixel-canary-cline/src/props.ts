import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { groundAt, groundNormalAt, isOnGrass, groundSlope, silhouette } from './island';
import { makeRandom } from './noise';

const STONE = new THREE.MeshStandardMaterial({ color: '#b3ab9c', roughness: 0.95, flatShading: true });
const FENCE_WOOD = new THREE.MeshStandardMaterial({ color: '#8a6a49', roughness: 0.9 });
const ROCK = new THREE.MeshStandardMaterial({ color: '#8d8577', roughness: 0.98, flatShading: true });

const up = new THREE.Vector3(0, 1, 0);
const tmpNormal = new THREE.Vector3();

function alignToGround(pos: THREE.Vector3, quat: THREE.Quaternion, x: number, z: number, lift = 0): void {
  pos.set(x, groundAt(x, z) + lift, z);
  quat.setFromUnitVectors(up, groundNormalAt(x, z, tmpNormal));
}

/** Flat stepping stones following a bezier from the cottage door to the cliff path. */
export function buildPath(): THREE.InstancedMesh {
  const stones = 15;
  const p0 = new THREE.Vector2(-1.48, 1.0);
  const p1 = new THREE.Vector2(-2.05, 2.05);
  const p2 = new THREE.Vector2(-1.2, 3.1);
  const geo = new THREE.CircleGeometry(0.14, 7);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, STONE, stones);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rand = makeRandom(4412);
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(p0.x, 0, p0.y),
    new THREE.Vector3(p1.x, 0, p1.y),
    new THREE.Vector3(p2.x, 0, p2.y),
  );

  for (let i = 0; i < stones; i += 1) {
    const t = i / (stones - 1);
    const point = curve.getPoint(t);
    const jitter = (rand() - 0.5) * 0.1;
    const tangent = curve.getTangent(t);
    const px = point.x - tangent.z * jitter;
    const pz = point.z + tangent.x * jitter;
    alignToGround(pos, q, px, pz, 0.022);
    const s = 0.72 + rand() * 0.55;
    scale.set(s, 1, s * (0.8 + rand() * 0.4));
    mesh.setMatrixAt(i, m.compose(pos, q, scale));
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

/** A short rail fence guarding the pond shore. */
export function buildFence(): THREE.Group {
  const group = new THREE.Group();
  const center = new THREE.Vector2(1.5, 1.55);
  const radius = 1.32;
  const from = THREE.MathUtils.degToRad(146);
  const to = THREE.MathUtils.degToRad(232);
  const posts = 8;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < posts; i += 1) {
    const a = from + ((to - from) * i) / (posts - 1);
    points.push(new THREE.Vector2(center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius));
  }

  for (const p of points) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.36, 0.055), FENCE_WOOD);
    post.position.set(p.x, groundAt(p.x, p.y) + 0.16, p.y);
    post.rotation.y = p.x * 2;
    post.castShadow = true;
    group.add(post);
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const length = Math.hypot(dx, dz);
    for (const [height, thin] of [[0.27, 0.045], [0.14, 0.035]] as const) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, thin, 0.028), FENCE_WOOD);
      const midX = (a.x + b.x) / 2;
      const midZ = (a.y + b.y) / 2;
      const y0 = groundAt(a.x, a.y) + height;
      const y1 = groundAt(b.x, b.y) + height;
      rail.position.set(midX, (y0 + y1) / 2, midZ);
      // Rails are modelled along +X, so aiming +X at the next post follows the slope.
      rail.quaternion.setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(b.x - a.x, y1 - y0, b.y - a.y).normalize(),
      );
      rail.castShadow = true;
      group.add(rail);
    }
  }
  return group;
}

/** A few boulders, hand placed so they read as set down rather than scattered. */
export function buildRocks(): THREE.Group {
  const group = new THREE.Group();
  const spots: [number, number, number, number][] = [
    [-0.15, 2.55, 0.3, 0.5],
    [-2.75, -1.35, 0.42, 1.1],
    [2.35, -0.55, 0.26, 2.4],
    [-0.55, -2.5, 0.34, 3.6],
    [2.95, 0.35, 0.22, 5.1],
    [-3.0, 0.75, 0.28, 4.2],
  ];
  const rand = makeRandom(7781);
  spots.forEach(([x, z, size, spin], i) => {
    const geo = new THREE.IcosahedronGeometry(size, 0);
    const positions = geo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < positions.count; v += 1) {
      positions.setXYZ(
        v,
        positions.getX(v) * (0.82 + rand() * 0.4),
        positions.getY(v) * (0.6 + rand() * 0.4),
        positions.getZ(v) * (0.82 + rand() * 0.4),
      );
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, ROCK);
    rock.position.set(x, groundAt(x, z) - size * 0.24, z);
    rock.rotation.set(rand() * 0.5, spin + i, rand() * 0.4);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  });
  return group;
}

/** Grass tufts and flowers: instanced, scattered only onto walkable grass. */
export function buildGroundCover(count = 240): THREE.Group {
  const group = new THREE.Group();
  const rand = makeRandom(20260929);

  const tuftGeo = (() => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i += 1) {
      const blade = new THREE.ConeGeometry(0.017, 0.105, 4);
      blade.translate(0, 0.052, 0);
      blade.rotateZ((i - 1) * 0.34);
      blade.rotateY(i * 1.9);
      parts.push(blade);
    }
    return mergeGeometries(parts, false);
  })();

  const tufts = new THREE.InstancedMesh(
    tuftGeo,
    new THREE.MeshStandardMaterial({ color: '#79a457', roughness: 0.95, flatShading: true }),
    count,
  );
  tufts.receiveShadow = true;

  const flowerCount = Math.round(count * 0.26);
  const headGeo = new THREE.IcosahedronGeometry(0.028, 0);
  headGeo.translate(0, 0.115, 0);
  const stems = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.006, 0.008, 0.11, 4).translate(0, 0.055, 0),
    new THREE.MeshStandardMaterial({ color: '#5f8a49', roughness: 0.95 }),
    flowerCount,
  );
  const heads = new THREE.InstancedMesh(
    headGeo,
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }),
    flowerCount,
  );

  const palette = ['#f3f0e2', '#e8b64b', '#ded7ea', '#f0dfae', '#e9a1a8'];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const axis = new THREE.Vector3(0, 1, 0);

  let placed = 0;
  let flowers = 0;
  let guard = 0;
  while ((placed < count || flowers < flowerCount) && guard < count * 60) {
    guard += 1;
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * silhouette(theta) * 0.9;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    if (!isOnGrass(x, z, 0.3)) continue;
    if (groundAt(x, z) < -0.1 || groundSlope(x, z) > 0.85) continue;

    q.setFromAxisAngle(axis, rand() * Math.PI * 2);
    pos.set(x, groundAt(x, z) - 0.012, z);

    if (placed < count) {
      const s = 0.7 + rand() * 0.9;
      scale.set(s, 0.75 + rand() * 0.8, s);
      tufts.setMatrixAt(placed, m.compose(pos, q, scale));
      placed += 1;
    }

    if (flowers < flowerCount && rand() < 0.34) {
      const s = 0.8 + rand() * 0.7;
      scale.set(s, s, s);
      heads.setMatrixAt(flowers, m.compose(pos, q, scale));
      stems.setMatrixAt(flowers, m.compose(pos, q, scale));
      heads.setColorAt(flowers, color.set(palette[flowers % palette.length]).offsetHSL(0, 0, -0.06));
      flowers += 1;
    }
  }

  tufts.count = placed;
  heads.count = flowers;
  stems.count = flowers;
  tufts.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  stems.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;

  group.add(tufts, stems, heads);
  return group;
}
