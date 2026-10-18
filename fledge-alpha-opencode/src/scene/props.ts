import * as THREE from 'three';
import { groundY } from './island';
import { POND_R as R, POND_X, POND_Z } from './noise';

export const POND = { x: POND_X, z: POND_Z, r: R };

export function buildPond(): { mesh: THREE.Mesh; rim: THREE.Mesh } {
  const y = groundY(POND.x, POND.z) + 0.03;
  const mat = new THREE.MeshStandardMaterial({ color: 0x6ea7c9, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.92 });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 40), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(POND.x, y, POND.z);
  mesh.receiveShadow = true;

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(POND.r * 0.98, POND.r + 0.28, 40),
    new THREE.MeshStandardMaterial({ color: 0xd8c9a3, roughness: 1 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(POND.x, y - 0.008, POND.z);
  rim.receiveShadow = true;
  return { mesh, rim };
}

export function buildPath(): THREE.Group {
  const group = new THREE.Group();
  const pts = [
    new THREE.Vector3(-2.25, 0, 0.45),
    new THREE.Vector3(-1.0, 0, 1.5),
    new THREE.Vector3(0.6, 0, 3.3),
    new THREE.Vector3(2.2, 0, 4.2),
    new THREE.Vector3(4.3, 0, 3.4),
    new THREE.Vector3(4.5, 0, 0.9),
    new THREE.Vector3(4.4, 0, -1.4),
    new THREE.Vector3(3.5, 0, -1.6),
  ];
  const curve = new THREE.CatmullRomCurve3(pts);
  const mat = new THREE.MeshStandardMaterial({ color: 0xe3d3ac, roughness: 1 });
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n);
    const r = 0.15 + 0.07 * Math.sin(i * 2.7) + 0.04 * Math.cos(i * 1.3);
    const stone = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.09, r), 10), mat);
    stone.rotation.x = -Math.PI / 2;
    stone.position.set(p.x, groundY(p.x, p.z) + 0.025, p.z);
    stone.receiveShadow = true;
    group.add(stone);
  }
  return group;
}

export function buildFence(): THREE.Group {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xa9885e, roughness: 0.9 });
  const posts: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const a = 2.3 + i * 0.24;
    const x = Math.cos(a) * 4.4;
    const z = Math.sin(a) * 4.4;
    posts.push(new THREE.Vector3(x, groundY(x, z), z));
  }
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), wood);
    post.position.set(p.x, p.y + 0.25, p.z);
    post.castShadow = true;
    group.add(post);
    if (i > 0) {
      const q = posts[i - 1];
      const mid = p.clone().add(q).multiplyScalar(0.5);
      const len = p.distanceTo(q);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.04), wood);
      rail.position.set(mid.x, mid.y + 0.38, mid.z);
      rail.rotation.y = -Math.atan2(p.z - q.z, p.x - q.x);
      rail.castShadow = true;
      group.add(rail);
      const rail2 = rail.clone();
      rail2.position.y = mid.y + 0.18;
      group.add(rail2);
    }
  }
  return group;
}

export function buildFlowers(): THREE.Group {
  const group = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4e7d4f, roughness: 0.9 });
  const colors = [0xe8a0b4, 0xf2d16b, 0xffffff, 0xe88a6b, 0xc9a0dc];
  const spots: Array<[number, number]> = [
    [-2.9, 0.6], [-1.7, 3.2], [0.2, 4.6], [-0.4, 1.2], [3.6, -0.6],
    [0.6, 1.0], [-4.4, 1.2], [4.1, 2.6], [-1.2, -2.4], [2.6, -3.8],
  ];
  for (let i = 0; i < spots.length; i++) {
    const [x, z] = spots[i];
    const y = groundY(x, z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.22, 5), stemMat);
    stem.position.set(x, y + 0.11, z);
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.055, 0),
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.7 })
    );
    head.position.set(x, y + 0.24, z);
    group.add(stem, head);
  }
  return group;
}

export function buildRocks(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d867a, roughness: 1, flatShading: true });
  const spots: Array<[number, number, number]> = [
    [0.2, 4.4, 0.28], [-4.2, 2.3, 0.34], [4.6, -0.4, 0.24], [-3.1, -3.4, 0.2],
  ];
  for (const [x, z, s] of spots) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
    rock.position.set(x, groundY(x, z) + s * 0.35, z);
    rock.rotation.set(x * 3, z * 5, x + z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }
  return group;
}
