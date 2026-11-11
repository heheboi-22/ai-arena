import * as THREE from 'three';
import { makeRng } from '../lib/math';
import { WORLD } from '../palette';
import { PATHS, FENCE, ROCKS, LAMP, BENCH } from './layout';
import { rimRadius } from './island';
import type { SharedMaterials } from './materials';

const stemMat = new THREE.MeshStandardMaterial({ color: WORLD.cream, roughness: 0.9 });

export interface Props {
  group: THREE.Group;
  /** lamp follows the house-light state */
  update: (dt: number, lights: number, night: number) => void;
}

function quadBezier(a: number, c: number, b: number, t: number): number {
  const u = 1 - t;
  return u * u * a + 2 * u * t * c + t * t * b;
}

export function createProps(
  mats: SharedMaterials,
  groundY: (x: number, z: number) => number,
): Props {
  const group = new THREE.Group();
  const rng = makeRng(31337);

  // stepping stones along the two paths
  const stoneGeo = new THREE.CylinderGeometry(1, 0.92, 0.06, 7);
  for (const path of PATHS) {
    for (let i = 0; i < path.n; i++) {
      const t = (i + 0.5) / path.n;
      const x = quadBezier(path.from[0], path.ctrl[0], path.to[0], t);
      const z = quadBezier(path.from[1], path.ctrl[1], path.to[1], t);
      const stone = new THREE.Mesh(stoneGeo, mats.stone);
      const s = 0.15 + rng() * 0.07;
      stone.scale.set(s, 1, s * (0.75 + rng() * 0.4));
      stone.rotation.y = rng() * Math.PI;
      stone.position.set(x, groundY(x, z) + 0.03, z);
      stone.castShadow = false;
      stone.receiveShadow = true;
      group.add(stone);
    }
  }

  // post-and-rail fence following the front-right rim
  const posts: THREE.Vector3[] = [];
  for (let i = 0; i < FENCE.posts; i++) {
    const t = FENCE.from + (FENCE.to - FENCE.from) * (i / (FENCE.posts - 1));
    const rim = rimRadius(t) - FENCE.inset;
    posts.push(new THREE.Vector3(Math.cos(t) * rim, 0, Math.sin(t) * rim));
  }
  const postGeo = new THREE.BoxGeometry(0.06, 0.4, 0.06);
  posts.forEach((p, i) => {
    const post = new THREE.Mesh(postGeo, mats.wood);
    post.position.set(p.x, groundY(p.x, p.z) + 0.2, p.z);
    post.rotation.z = Math.sin(i * 1.7) * 0.04;
    post.castShadow = true;
    group.add(post);
    if (i < posts.length - 1) {
      const next = posts[i + 1];
      const mid = new THREE.Vector3().addVectors(p, next).multiplyScalar(0.5);
      const len = p.distanceTo(next);
      // box long axis is X: yaw so +X points toward the next post
      const yaw = Math.atan2(-(next.z - p.z), next.x - p.x);
      for (const h of [0.14, 0.3]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.04), mats.woodDark);
        rail.position.set(mid.x, groundY(mid.x, mid.z) + h + 0.06, mid.z);
        rail.rotation.y = yaw;
        rail.castShadow = true;
        group.add(rail);
      }
    }
  });

  // scattered boulders
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  for (const r of ROCKS) {
    const rock = new THREE.Mesh(rockGeo, rng() > 0.5 ? mats.rock : mats.rockDeep);
    rock.scale.set(r.s, r.s * (0.6 + rng() * 0.25), r.s * (0.8 + rng() * 0.3));
    rock.rotation.set(rng() * 0.6, r.rot, rng() * 0.5);
    rock.position.set(r.x, groundY(r.x, r.z) + r.s * 0.28, r.z);
    rock.castShadow = rock.receiveShadow = true;
    group.add(rock);
  }

  // a tiny bench facing the pond
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.16), mats.wood);
  seat.position.y = 0.16;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.03), mats.wood);
  back.position.set(0, 0.26, -0.07);
  const legGeo = new THREE.BoxGeometry(0.04, 0.16, 0.12);
  for (const lx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(legGeo, mats.woodDark);
    leg.position.set(lx, 0.08, 0);
    bench.add(leg);
  }
  bench.add(seat, back);
  bench.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  bench.position.set(BENCH.x, groundY(BENCH.x, BENCH.z), BENCH.z);
  bench.rotation.y = BENCH.rot;
  group.add(bench);

  // two mushrooms tucked by the back tree
  const capMat = new THREE.MeshStandardMaterial({ color: 0xc65b4e, roughness: 0.8 });
  for (const [mx, mz, ms] of [[-0.2, -3.3, 1.0], [0.05, -3.15, 0.7]] as const) {
    const stemM = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 6), stemMat);
    stemM.position.set(mx, groundY(mx, mz) + 0.05, mz);
    const capM = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    capM.scale.set(ms, ms * 0.7, ms);
    capM.position.set(mx, groundY(mx, mz) + 0.1, mz);
    group.add(stemM, capM);
  }

  // the street lamp outside the house, tied to the house lights
  const lampGroup = new THREE.Group();
  lampGroup.position.set(LAMP.x, groundY(LAMP.x, LAMP.z), LAMP.z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.04, 0.9, 7), mats.woodDark);
  pole.position.y = 0.45;
  pole.castShadow = true;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.035), mats.woodDark);
  arm.position.set(0.09, 0.9, 0);
  const cage = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), mats.woodDark);
  cage.position.set(0.19, 0.8, 0);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0x776a4e,
    emissive: WORLD.lampGlow,
    emissiveIntensity: 0,
    roughness: 0.5,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bulbMat);
  bulb.position.set(0.19, 0.79, 0);
  lampGroup.add(pole, arm, cage, bulb);
  const lampLight = new THREE.PointLight(WORLD.lampGlow, 0, 5, 2);
  lampLight.position.set(0.19, 0.85, 0);
  lampGroup.add(lampLight);
  group.add(lampGroup);

  return {
    group,
    update(_dt, lights, night) {
      bulbMat.emissiveIntensity = lights * (1.5 + 1.6 * night);
      lampLight.intensity = lights * (0.35 + 0.85 * night);
    },
  };
}
