import * as THREE from 'three';
import { getIslandSurfaceHeight, isPointInPond } from '../state';
import { ProceduralTextureSet } from './textures';

interface GrassTuft {
  group: THREE.Group;
  phase: number;
}

interface Firefly {
  mesh: THREE.Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  phase: number;
  speed: number;
}

export interface DetailsSystem {
  group: THREE.Group;
  update: (
    elapsed: number,
    windFactor: number,
    nightness: number,
    rainFactor: number,
    reducedMotion: boolean,
  ) => void;
}

export function createDetails(textures: ProceduralTextureSet): DetailsSystem {
  const group = new THREE.Group();
  group.name = 'EnvironmentDetails';

  const woodMat = new THREE.MeshStandardMaterial({
    color: '#7a5236',
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: 0.025,
    roughness: 0.82,
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#9c9589',
    map: textures.stoneColor,
    bumpMap: textures.stoneBump,
    bumpScale: 0.035,
    roughness: 0.86,
    flatShading: true,
  });

  const mossStoneMat = new THREE.MeshStandardMaterial({
    color: '#7c8c74',
    roughness: 0.88,
    flatShading: true,
  });

  // 1. Split-Rail Wooden Fences
  const addFenceSegment = (x1: number, z1: number, x2: number, z2: number) => {
    const y1 = getIslandSurfaceHeight(x1, z1) ?? 0.2;
    const y2 = getIslandSurfaceHeight(x2, z2) ?? 0.2;

    const postGeo = new THREE.CylinderGeometry(0.042, 0.05, 0.44, 6);
    const p1 = new THREE.Mesh(postGeo, woodMat);
    p1.position.set(x1, y1 + 0.2, z1);
    p1.castShadow = true;
    group.add(p1);

    const p2 = new THREE.Mesh(postGeo, woodMat);
    p2.position.set(x2, y2 + 0.2, z2);
    p2.castShadow = true;
    group.add(p2);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const midZ = (z1 + z2) / 2;
    const yaw = Math.atan2(dx, dz);
    const pitch = -Math.atan2(dy, Math.hypot(dx, dz));

    for (const hOffset of [0.16, 0.31]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, len + 0.04), woodMat);
      rail.position.set(midX, midY + hOffset, midZ);
      rail.rotation.order = 'YXZ';
      rail.rotation.y = yaw;
      rail.rotation.x = pitch;
      rail.castShadow = true;
      group.add(rail);
    }
  };

  // Fence along the cottage garden & northern bluff trail
  addFenceSegment(-2.85, -0.35, -2.05, 0.25);
  addFenceSegment(0.85, -2.15, 1.65, -2.55);
  addFenceSegment(1.65, -2.55, 2.45, -2.95);
  // Fence along the southern meadow overlook
  addFenceSegment(0.65, 3.25, 1.55, 2.95);
  addFenceSegment(1.55, 2.95, 2.35, 2.35);

  // 2. Cozy Wooden Garden Bench overlooking the Pond
  const benchGroup = new THREE.Group();
  const bx = 0.82;
  const bz = 1.65;
  const by = getIslandSurfaceHeight(bx, bz) ?? 0.22;
  benchGroup.position.set(bx, by, bz);
  benchGroup.rotation.y = -2.35; // Facing the pond

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.28), woodMat);
  seat.position.y = 0.22;
  seat.castShadow = true;
  benchGroup.add(seat);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.04), woodMat);
  backrest.position.set(0, 0.36, -0.12);
  backrest.rotation.x = -0.18;
  backrest.castShadow = true;
  benchGroup.add(backrest);

  for (const lx of [-0.3, 0.3]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.24), woodMat);
    leg.position.set(lx, 0.11, 0);
    leg.castShadow = true;
    benchGroup.add(leg);
  }
  group.add(benchGroup);

  // 3. Stone Wishing Well / Garden Well near the Path Junction
  const wellGroup = new THREE.Group();
  const wx = 1.05;
  const wz = 0.25;
  const wy = getIslandSurfaceHeight(wx, wz) ?? 0.28;
  wellGroup.position.set(wx, wy, wz);

  const wellWall = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.36, 10), stoneMat);
  wellWall.position.y = 0.18;
  wellWall.castShadow = true;
  wellWall.receiveShadow = true;
  wellGroup.add(wellWall);

  const wellWater = new THREE.Mesh(
    new THREE.CircleGeometry(0.31, 10),
    new THREE.MeshStandardMaterial({ color: '#1d6982', roughness: 0.2 }),
  );
  wellWater.rotation.x = -Math.PI / 2;
  wellWater.position.y = 0.34;
  wellGroup.add(wellWater);

  for (const px of [-0.32, 0.32]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.65, 6), woodMat);
    post.position.set(px, 0.58, 0);
    post.castShadow = true;
    wellGroup.add(post);
  }
  const wellRoof = new THREE.Mesh(
    new THREE.ConeGeometry(0.52, 0.36, 4),
    new THREE.MeshStandardMaterial({
      color: '#b8533a',
      map: textures.roofColor,
      roughness: 0.76,
    }),
  );
  wellRoof.position.y = 1.02;
  wellRoof.rotation.y = Math.PI / 4;
  wellRoof.castShadow = true;
  wellGroup.add(wellRoof);
  group.add(wellGroup);

  // 4. Mossy Rock Outcrops & Boulder Clusters
  const rockClusters = [
    { x: -3.25, z: -0.95, s: 0.38, moss: true },
    { x: -2.95, z: -0.72, s: 0.24, moss: false },
    { x: 3.95, z: -1.65, s: 0.42, moss: true },
    { x: 3.65, z: -1.35, s: 0.26, moss: false },
    { x: 2.35, z: 1.55, s: 0.35, moss: true },
    { x: -0.65, z: -3.35, s: 0.36, moss: false },
    { x: 4.55, z: 0.45, s: 0.32, moss: true },
  ];

  const boulderGeo = new THREE.DodecahedronGeometry(1, 0);
  rockClusters.forEach((rc, idx) => {
    const ry = getIslandSurfaceHeight(rc.x, rc.z) ?? 0.2;
    const rock = new THREE.Mesh(boulderGeo, rc.moss ? mossStoneMat : stoneMat);
    rock.scale.set(rc.s * 1.15, rc.s * 0.78, rc.s * 0.95);
    rock.position.set(rc.x, ry + rc.s * 0.32, rc.z);
    rock.rotation.set(idx * 0.5, idx * 1.1, 0.2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  });

  // 5. Wildflower Clusters & Swaying Grass Tufts
  const grassBladeMat = new THREE.MeshStandardMaterial({
    color: '#4f9940',
    roughness: 0.78,
  });
  const flowerMats = [
    new THREE.MeshStandardMaterial({ color: '#f5c84c', roughness: 0.65 }),
    new THREE.MeshStandardMaterial({ color: '#f07167', roughness: 0.65 }),
    new THREE.MeshStandardMaterial({ color: '#a882dd', roughness: 0.65 }),
    new THREE.MeshStandardMaterial({ color: '#fff3d6', roughness: 0.65 }),
  ];

  const grassTufts: GrassTuft[] = [];
  const tuftCoords = [
    [-0.25, -1.65],
    [0.55, -1.35],
    [1.65, -0.55],
    [2.15, 0.35],
    [1.45, 1.95],
    [-0.15, 2.85],
    [-2.45, -2.15],
    [-3.15, 0.25],
    [3.25, -0.45],
    [2.85, 1.15],
    [0.15, 0.55],
    [-1.45, 0.15],
    [1.15, -2.85],
    [-1.65, -2.95],
  ];

  const bladeGeo = new THREE.ConeGeometry(0.045, 0.26, 4);
  bladeGeo.translate(0, 0.13, 0);
  const blossomGeo = new THREE.SphereGeometry(0.055, 6, 6);

  tuftCoords.forEach(([tx, tz], idx) => {
    if (isPointInPond(tx, tz)) return;
    const ty = getIslandSurfaceHeight(tx, tz);
    if (ty === null) return;

    const tuftGroup = new THREE.Group();
    tuftGroup.position.set(tx, ty, tz);

    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(bladeGeo, grassBladeMat);
      const angle = (b / 4) * Math.PI * 2 + idx * 0.4;
      blade.position.set(Math.cos(angle) * 0.06, 0, Math.sin(angle) * 0.06);
      blade.rotation.z = (b % 2 === 0 ? 1 : -1) * 0.18;
      blade.rotation.y = angle;
      tuftGroup.add(blade);
    }

    if (idx % 2 === 0) {
      const fMat = flowerMats[idx % flowerMats.length];
      const flower = new THREE.Mesh(blossomGeo, fMat);
      flower.position.set(0, 0.26, 0);
      tuftGroup.add(flower);
    }

    group.add(tuftGroup);
    grassTufts.push({
      group: tuftGroup,
      phase: idx * 0.85,
    });
  });

  // 6. Nighttime Bioluminescent Fireflies (22 hovering warm motes)
  const fireflies: Firefly[] = [];
  const fireflyMat = new THREE.MeshBasicMaterial({
    color: '#ffe47a',
    transparent: true,
    opacity: 0,
  });
  const fireflyGeo = new THREE.SphereGeometry(0.038, 6, 6);

  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2;
    const rad = 1.4 + ((i * 1.73) % 3.8);
    const fx = Math.cos(angle) * rad;
    const fz = Math.sin(angle) * rad;
    const fy = (getIslandSurfaceHeight(fx, fz) ?? 0.2) + 0.35 + (i % 4) * 0.28;

    const mesh = new THREE.Mesh(fireflyGeo, fireflyMat);
    mesh.position.set(fx, fy, fz);
    mesh.visible = false;
    group.add(mesh);

    fireflies.push({
      mesh,
      baseX: fx,
      baseY: fy,
      baseZ: fz,
      phase: i * 1.3,
      speed: 1.2 + (i % 4) * 0.35,
    });
  }

  return {
    group,
    update: (
      elapsed: number,
      windFactor: number,
      nightness: number,
      rainFactor: number,
      reducedMotion: boolean,
    ) => {
      const oscScale = reducedMotion ? 0.25 : 1.0;

      // Sway meadow grass tufts with shared windFactor
      for (const gt of grassTufts) {
        if (windFactor <= 0.002) {
          gt.group.rotation.z = 0;
          continue;
        }
        const sway =
          windFactor * 0.24 +
          Math.sin(elapsed * (2.5 + windFactor * 3.0) + gt.phase) * (0.12 * windFactor) * oscScale;
        gt.group.rotation.z = -sway;
      }

      // Nighttime fireflies (visible at dusk/night, hide in heavy rain)
      const fireflyAlpha = Math.max(0, (nightness - 0.22) / 0.78) * (1 - rainFactor * 0.85);
      const showFireflies = fireflyAlpha > 0.02;
      fireflyMat.opacity = fireflyAlpha * (0.65 + Math.sin(elapsed * 3.4) * 0.25);

      for (const ff of fireflies) {
        ff.mesh.visible = showFireflies;
        if (!showFireflies) continue;
        ff.mesh.position.x = ff.baseX + Math.sin(elapsed * ff.speed + ff.phase) * 0.22 * oscScale;
        ff.mesh.position.y = ff.baseY + Math.cos(elapsed * ff.speed * 1.3 + ff.phase) * 0.14 * oscScale;
        ff.mesh.position.z = ff.baseZ + Math.sin(elapsed * ff.speed * 0.8 - ff.phase) * 0.22 * oscScale;
      }
    },
  };
}
