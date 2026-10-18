import * as THREE from 'three';
import { ground, palette, material, mesh, pebble, random, islandRadius, pondPoint, horizontalShape } from './geometry';

export function buildIsland(parent: THREE.Group) {
  const rand = random(84);
  const count = 40;
  const outline = Array.from({ length: count }, (_, i) => {
    const angle = i / count * Math.PI * 2;
    return new THREE.Vector2(Math.cos(angle) * 5.3 * islandRadius(angle), Math.sin(angle) * 4.35 * islandRadius(angle));
  });
  const pondOutline = Array.from({ length: 48 }, (_, i) => pondPoint(i / 48 * Math.PI * 2));
  const grassShape = horizontalShape(outline);
  grassShape.holes.push(horizontalShape(pondOutline));
  const turf = new THREE.ExtrudeGeometry(grassShape, { depth: 0.22, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.09, bevelThickness: 0.055, curveSegments: 1 });
  turf.rotateX(-Math.PI / 2);
  mesh(turf, material(palette.grass), parent, [0, -0.025, 0]);

  const rings = [
    { y: -0.04, radius: 1 }, { y: -0.6, radius: 1.015 },
    { y: -1.45, radius: 0.88 }, { y: -2.8, radius: 0.57 }, { y: -4.1, radius: 0.17 },
  ];
  const ringPoints = rings.map((ring, layer) => outline.map(p => {
    const rough = layer === 0 ? 1 : 0.91 + rand() * 0.16;
    return new THREE.Vector3(p.x * ring.radius * rough + layer * 0.035,
      ring.y + (layer === 0 ? 0 : (rand() - 0.5) * 0.25), p.y * ring.radius * rough);
  }));
  const positions: number[] = [], colors: number[] = [];
  const rockColor = new THREE.Color();
  for (let layer = 0; layer < rings.length - 1; layer++) {
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const corners = [ringPoints[layer][i], ringPoints[layer + 1][i], ringPoints[layer][next],
        ringPoints[layer][next], ringPoints[layer + 1][i], ringPoints[layer + 1][next]];
      for (let triangle = 0; triangle < 2; triangle++) {
        rockColor.set(layer === 0 ? 0xa39b7c : palette.rock);
        rockColor.multiplyScalar(0.82 + rand() * 0.32 - layer * 0.045);
        for (let k = 0; k < 3; k++) {
          const point = corners[triangle * 3 + k];
          positions.push(point.x, point.y, point.z);
          colors.push(rockColor.r, rockColor.g, rockColor.b);
        }
      }
    }
  }
  const rockGeometry = new THREE.BufferGeometry();
  rockGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  rockGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  rockGeometry.computeVertexNormals();
  mesh(rockGeometry, material(0xffffff, { vertexColors: true, flatShading: true, side: THREE.DoubleSide }), parent);
  const bottom = new THREE.ConeGeometry(0.9, 0.65, 6);
  bottom.rotateZ(Math.PI);
  mesh(bottom, material(0x737b6d), parent, [0.22, -4.25, 0.02]);

  const shore = horizontalShape(pondOutline.map((_, i) => pondPoint(i / 48 * Math.PI * 2, 1.14)));
  shore.holes.push(horizontalShape(pondOutline));
  const shoreGeometry = new THREE.ShapeGeometry(shore);
  shoreGeometry.rotateX(-Math.PI / 2);
  mesh(shoreGeometry, material(palette.sand), parent, [0, ground + 0.023, 0]);
  const waterGeometry = new THREE.ShapeGeometry(horizontalShape(pondOutline));
  waterGeometry.rotateX(-Math.PI / 2);
  const waterMaterial = material(palette.water, { roughness: 0.26, metalness: 0.12 });
  const water = mesh(waterGeometry, waterMaterial, parent, [0, ground - 0.07, 0]);
  water.castShadow = false;

  const stone = material(0xb7b4a0);
  for (const angle of [0.25, 0.6, 2.05, 2.5, 3.7, 5.2]) {
    const p = pondPoint(angle, 1.16);
    const size = 0.14 + rand() * 0.18;
    const rock = pebble(parent, stone, [p.x, ground + size * 0.25, p.y], [size * 1.4, size * 0.65, size]);
    rock.rotation.y = rand() * 5;
  }

  const glints = new THREE.Group();
  const glintMaterial = new THREE.MeshBasicMaterial({ color: 0xe8eee0, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 9; i++) {
    const length = 0.16 + rand() * 0.4;
    const line = mesh(new THREE.PlaneGeometry(length, 0.025), glintMaterial, glints,
      [0.9 + rand() * 1.5, ground - 0.06, 1.3 + rand() * 0.8]);
    line.rotation.x = -Math.PI / 2;
    line.castShadow = false;
  }
  parent.add(glints);
  return { waterMaterial, glints, glintMaterial };
}
