import * as THREE from 'three';
import type { SceneContext } from '../environment/runtime';
import { makeFlowerHead, makeGrassTuft } from '../utils/geometry';
import { seededRandom } from '../utils/math';
import {
  FENCE,
  FLOWER_CLUSTERS,
  HOUSE,
  PATH_POINTS,
  ROCK_SPOTS
} from './layout';
import type { WorldMaterials } from './materials';
import { distanceToPondEdge, isInsideIsland, terrainHeight } from './terrain';

const insideHouseFootprint = (x: number, z: number, padding = 0.18): boolean => {
  const dx = x - HOUSE.x;
  const dz = z - HOUSE.z;
  const cos = Math.cos(-HOUSE.rotation);
  const sin = Math.sin(-HOUSE.rotation);
  const localX = dx * cos + dz * sin;
  const localZ = -dx * sin + dz * cos;
  return Math.abs(localX) < 1.3 + padding && Math.abs(localZ) < 1.15 + padding;
};

const pathPoints3D = (): THREE.Vector3[] =>
  PATH_POINTS.map((point) => new THREE.Vector3(point.x, terrainHeight(point.x, point.z), point.z));

export class Props {
  readonly group = new THREE.Group();
  private readonly grass: THREE.InstancedMesh;
  private flowers!: THREE.InstancedMesh;
  private stems!: THREE.InstancedMesh;
  private flowerCenters!: THREE.InstancedMesh;
  private readonly bushTops: THREE.Group[] = [];

  constructor(materials: WorldMaterials, reducedQuality: boolean) {
    this.group.name = 'props';
    this.buildPath(materials);
    this.buildFence(materials);
    this.buildRocks(materials);
    this.buildBench(materials);
    this.buildGarden(materials);

    const random = seededRandom(508);
    const grassCount = reducedQuality ? 190 : 320;
    const grassMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide
    });
    this.grass = new THREE.InstancedMesh(makeGrassTuft(), grassMaterial, grassCount);
    this.grass.receiveShadow = true;
    this.grass.castShadow = false;
    this.grass.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const dummy = new THREE.Object3D();
    const grassColors = [new THREE.Color(0x6d8d51), new THREE.Color(0x7c9b5e), new THREE.Color(0x8ba969)];
    let grassIndex = 0;
    let attempts = 0;
    while (grassIndex < grassCount && attempts < grassCount * 8) {
      attempts += 1;
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 4.85;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (!isInsideIsland(x, z, 0.2)) continue;
      if (distanceToPondEdge(x, z) < 0.02) continue;
      if (insideHouseFootprint(x, z)) continue;
      const scale = 0.65 + random() * 0.9;
      dummy.position.set(x, terrainHeight(x, z) + 0.012, z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.scale.set(scale, scale * (0.8 + random() * 0.6), scale);
      dummy.updateMatrix();
      this.grass.setMatrixAt(grassIndex, dummy.matrix);
      this.grass.setColorAt(grassIndex, grassColors[Math.floor(random() * grassColors.length)]!);
      grassIndex += 1;
    }
    this.grass.count = grassIndex;
    this.group.add(this.grass);

    this.buildFlowers(random);
    this.buildBushes();
  }

  private buildPath(materials: WorldMaterials): void {
    const curve = new THREE.CatmullRomCurve3(
      pathPoints3D(),
      false,
      'catmullrom',
      0.45
    );
    const stoneCount = 44;
    const geometry = new THREE.CylinderGeometry(1, 1, 0.045, 7);
    const stones = new THREE.InstancedMesh(geometry, materials.pathStone, stoneCount);
    stones.receiveShadow = true;
    stones.castShadow = false;
    const dummy = new THREE.Object3D();
    const random = seededRandom(120);
    const color = new THREE.Color();
    for (let i = 0; i < stoneCount; i += 1) {
      const t = i / (stoneCount - 1);
      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const offset = (random() - 0.5) * 0.18;
      const x = point.x + side.x * offset;
      const z = point.z + side.z * offset;
      dummy.position.set(x, terrainHeight(x, z) + 0.02, z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      const scale = 0.135 + random() * 0.085;
      dummy.scale.set(scale, 1, scale * (0.7 + random() * 0.35));
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);
      color.setHex(0xa79c88).offsetHSL(0, 0, (random() - 0.5) * 0.075);
      stones.setColorAt(i, color);
    }
    this.group.add(stones);
  }

  private buildFence(materials: WorldMaterials): void {
    const postGeometry = new THREE.BoxGeometry(0.08, 0.68, 0.08);
    const capGeometry = new THREE.ConeGeometry(0.075, 0.12, 4);
    const postPositions: THREE.Vector3[] = [];
    for (let i = 0; i < FENCE.posts; i += 1) {
      const t = i / (FENCE.posts - 1);
      const angle = THREE.MathUtils.lerp(FENCE.fromAngle, FENCE.toAngle, t);
      const x = Math.cos(angle) * FENCE.radius;
      const z = Math.sin(angle) * FENCE.radius;
      const y = terrainHeight(x, z);
      const post = new THREE.Mesh(postGeometry, materials.darkWood);
      post.position.set(x, y + 0.3, z);
      post.rotation.y = -angle;
      post.castShadow = true;
      post.receiveShadow = true;
      this.group.add(post);
      const cap = new THREE.Mesh(capGeometry, materials.wood);
      cap.position.set(x, y + 0.69, z);
      cap.rotation.y = Math.PI / 4;
      cap.castShadow = true;
      this.group.add(cap);
      postPositions.push(new THREE.Vector3(x, y, z));
    }

    const railDirections = [0.22, 0.46];
    for (const height of railDirections) {
      for (let i = 0; i < postPositions.length - 1; i += 1) {
        const a = postPositions[i]!;
        const b = postPositions[i + 1]!;
        const start = new THREE.Vector3(a.x, a.y + height, a.z);
        const end = new THREE.Vector3(b.x, b.y + height, b.z);
        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.055, 0.045), materials.wood);
        rail.position.copy(start).add(end).multiplyScalar(0.5);
        rail.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
        rail.castShadow = true;
        rail.receiveShadow = true;
        this.group.add(rail);
      }
    }
  }

  private buildBench(materials: WorldMaterials): void {
    const x = 3.3;
    const z = 2.55;
    const ground = terrainHeight(x, z);
    const bench = new THREE.Group();
    bench.position.set(x, ground, z);
    bench.rotation.y = Math.atan2(x, z);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.035, 9), materials.pathStone);
    pad.position.y = 0.006;
    pad.receiveShadow = true;
    bench.add(pad);

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.28, 0.2), materials.darkWood);
      leg.position.set(side * 0.23, 0.15, 0.02);
      leg.castShadow = true;
      leg.receiveShadow = true;
      bench.add(leg);
      const backPost = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.34, 0.048), materials.darkWood);
      backPost.position.set(side * 0.24, 0.44, -0.13);
      backPost.rotation.x = -0.08;
      backPost.castShadow = true;
      bench.add(backPost);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.27), materials.wood);
      arm.position.set(side * 0.255, 0.42, 0.01);
      arm.castShadow = true;
      bench.add(arm);
    }
    for (let i = 0; i < 3; i += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.026, 0.075), materials.wood);
      slat.position.set(0, 0.3, -0.07 + i * 0.08);
      slat.castShadow = true;
      slat.receiveShadow = true;
      bench.add(slat);
    }
    for (let i = 0; i < 2; i += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.045, 0.022), materials.wood);
      slat.position.set(0, 0.44 + i * 0.075, -0.145);
      slat.rotation.x = -0.08;
      slat.castShadow = true;
      bench.add(slat);
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.09, 7), materials.wood);
    pot.position.set(0.4, 0.07, 0.02);
    pot.castShadow = true;
    bench.add(pot);
    const potPlant = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.075, 0),
      new THREE.MeshStandardMaterial({ color: 0x6f8e50, roughness: 1, flatShading: true })
    );
    potPlant.position.set(0.4, 0.14, 0.02);
    potPlant.castShadow = true;
    bench.add(potPlant);
    this.group.add(bench);
  }

  private buildGarden(materials: WorldMaterials): void {
    const x = 0.82;
    const z = -1.32;
    const ground = terrainHeight(x, z);
    const garden = new THREE.Group();
    garden.position.set(x, ground, z);
    garden.rotation.y = -0.18;

    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.07, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x58442f, roughness: 1, flatShading: true })
    );
    soil.position.y = 0.04;
    soil.receiveShadow = true;
    garden.add(soil);

    for (const side of [-1, 1]) {
      const longBeam = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.09, 0.05), materials.wood);
      longBeam.position.set(0, 0.06, side * 0.315);
      longBeam.castShadow = true;
      garden.add(longBeam);
      const shortBeam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.66), materials.wood);
      shortBeam.position.set(side * 0.62, 0.06, 0);
      shortBeam.castShadow = true;
      garden.add(shortBeam);
    }

    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0x6c8f4d,
      roughness: 0.95,
      flatShading: true
    });
    const random = seededRandom(313);
    for (let row = 0; row < 3; row += 1) {
      for (let i = 0; i < 4; i += 1) {
        const plant = new THREE.Group();
        const size = 0.075 + random() * 0.035;
        for (let leaf = 0; leaf < 3; leaf += 1) {
          const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), leafMaterial);
          blob.position.set(
            (random() - 0.5) * 0.08,
            size * 0.4 + random() * 0.035,
            (random() - 0.5) * 0.08
          );
          blob.scale.set(1.2, 0.6, 1.1);
          blob.castShadow = true;
          plant.add(blob);
        }
        plant.position.set(-0.43 + i * 0.28, 0.07, -0.18 + row * 0.18);
        garden.add(plant);
      }
    }
    this.group.add(garden);
  }

  private buildRocks(materials: WorldMaterials): void {
    const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    const random = seededRandom(909);
    for (let i = 0; i < ROCK_SPOTS.length; i += 1) {
      const spot = ROCK_SPOTS[i]!;
      const rock = new THREE.Mesh(rockGeometry, materials.rock);
      const scale = spot.scale;
      rock.position.set(
        spot.x,
        terrainHeight(spot.x, spot.z) + scale * 0.28,
        spot.z
      );
      rock.scale.set(scale * (0.99 + random() * 0.2), scale * 0.72, scale * (0.9 + random() * 0.2));
      rock.rotation.set(random() * 2, random() * Math.PI * 2, random() * 2);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
      if (i % 3 === 0) {
        const companion = new THREE.Mesh(rockGeometry, materials.rock);
        companion.position.set(
          spot.x + 0.28,
          terrainHeight(spot.x + 0.28, spot.z + 0.16) + scale * 0.14,
          spot.z + 0.16
        );
        companion.scale.setScalar(scale * 0.42);
        companion.rotation.set(random(), random() * 3, random());
        companion.castShadow = true;
        companion.receiveShadow = true;
        this.group.add(companion);
      }
    }
  }

  private buildFlowers(random: () => number): void {
    const positions: Array<{ x: number; z: number; height: number; scale: number; color: THREE.Color }> = [];
    const palette = [0xf2e6c8, 0xd7a5a0, 0xe7c56f, 0xaebfc0, 0xe4d2a2];
    for (const cluster of FLOWER_CLUSTERS) {
      for (let i = 0; i < cluster.count; i += 1) {
        const angle = random() * Math.PI * 2;
        const radius = Math.sqrt(random()) * cluster.radius;
        const x = cluster.x + Math.cos(angle) * radius;
        const z = cluster.z + Math.sin(angle) * radius;
        if (!isInsideIsland(x, z, 0.35)) continue;
        if (distanceToPondEdge(x, z) < 0.08) continue;
        if (insideHouseFootprint(x, z, 0.15)) continue;
        const height = 0.12 + random() * 0.18;
        const scale = 0.7 + random() * 0.7;
        const color = new THREE.Color(palette[Math.floor(random() * palette.length)]!);
        positions.push({ x, z, height, scale, color });
      }
    }

    const stemGeometry = new THREE.CylinderGeometry(0.007, 0.012, 1, 4);
    stemGeometry.translate(0, 0.5, 0);
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x5d7745, roughness: 1 });
    this.stems = new THREE.InstancedMesh(stemGeometry, stemMaterial, positions.length);
    this.flowers = new THREE.InstancedMesh(
      makeFlowerHead(),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
      positions.length
    );
    this.flowerCenters = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.028, 5, 4),
      new THREE.MeshStandardMaterial({ color: 0xd9a94f, roughness: 0.9 }),
      positions.length
    );
    this.stems.castShadow = false;
    this.flowers.castShadow = false;
    this.flowerCenters.castShadow = false;
    this.stems.receiveShadow = true;
    this.flowers.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < positions.length; i += 1) {
      const flower = positions[i]!;
      const ground = terrainHeight(flower.x, flower.z);
      dummy.position.set(flower.x, ground, flower.z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.scale.set(1, flower.height, 1);
      dummy.updateMatrix();
      this.stems.setMatrixAt(i, dummy.matrix);

      dummy.position.set(flower.x, ground + flower.height, flower.z);
      dummy.scale.setScalar(flower.scale);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.updateMatrix();
      this.flowers.setMatrixAt(i, dummy.matrix);
      this.flowers.setColorAt(i, flower.color);

      dummy.position.set(flower.x, ground + flower.height + 0.014, flower.z);
      dummy.scale.setScalar(flower.scale);
      dummy.updateMatrix();
      this.flowerCenters.setMatrixAt(i, dummy.matrix);
    }
    this.flowers.count = positions.length;
    this.flowerCenters.count = positions.length;
    this.group.add(this.stems, this.flowers, this.flowerCenters);
  }

  private buildBushes(): void {
    const bushMaterial = new THREE.MeshStandardMaterial({
      color: 0x648547,
      roughness: 1,
      flatShading: true
    });
    const spots = [
      { x: -2.42, z: 2.58, scale: 0.24 },
      { x: 3.18, z: 1.55, scale: 0.2 },
      { x: 1.02, z: -2.78, scale: 0.18 }
    ];
    const random = seededRandom(211);
    for (const spot of spots) {
      if (!isInsideIsland(spot.x, spot.z, 0.45)) continue;
      if (distanceToPondEdge(spot.x, spot.z) < 0.2) continue;
      const bush = new THREE.Group();
      const y = terrainHeight(spot.x, spot.z);
      bush.position.set(spot.x, y, spot.z);
      for (let i = 0; i < 4; i += 1) {
        const blob = new THREE.Mesh(
          new THREE.IcosahedronGeometry(spot.scale * (0.7 + random() * 0.5), 1),
          bushMaterial
        );
        blob.position.set(
          (random() - 0.5) * spot.scale * 1.3,
          spot.scale * 0.5 + random() * spot.scale * 0.55,
          (random() - 0.5) * spot.scale * 1.3
        );
        blob.scale.y = 0.8;
        blob.castShadow = true;
        blob.receiveShadow = true;
        bush.add(blob);
      }
      this.bushTops.push(bush);
      this.group.add(bush);
    }
  }

  update(ctx: SceneContext): void {
    const motion = ctx.reducedMotion ? 0.3 : 1;
    for (let i = 0; i < this.bushTops.length; i += 1) {
      const bush = this.bushTops[i]!;
      bush.rotation.z = Math.sin(ctx.time * 0.7 + i * 1.8) * ctx.wind * 0.02 * motion;
    }
  }
}
