import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  Shape,
  SphereGeometry,
  TorusGeometry,
  type MeshStandardMaterial,
} from 'three';
import { HOUSE, terrainHeight } from './terrain';
import { PALETTE, type SharedMaterials } from './materials';

export interface House {
  group: Group;
  /** Sits just in front of the door at window height: the glow and the point light follow it. */
  glowAnchor: Object3D;
  /** Every window shares this material, so the lights toggle everywhere at once. */
  glass: MeshStandardMaterial;
}

const BODY = { width: 1.5, height: 1.05, depth: 1.3 };
const ROOF = { overhang: 0.2, rise: 0.62, thickness: 0.09 };

function place(parent: Group, mesh: Mesh, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): void {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

/** Triangular infill that fills the gable under the roof slopes. */
function gableGeometry(): ExtrudeGeometry {
  const halfW = BODY.width / 2;
  const shape = new Shape();
  shape.moveTo(-halfW, 0);
  shape.lineTo(halfW, 0);
  shape.lineTo(0, ROOF.rise);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: BODY.depth, bevelEnabled: false });
  geometry.translate(0, 0, -BODY.depth / 2);
  return geometry;
}

/**
 * A window set into a wall. `ry` is the wall's outward facing: 0 is the front (+z),
 * PI/2 is the right side (+x), PI is the back. The frame and muntins sit a little
 * further out so the glass reads as recessed.
 */
function addWindow(
  parent: Group,
  mats: SharedMaterials,
  glass: MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  ry: number,
): void {
  const nx = Math.sin(ry);
  const nz = Math.cos(ry);
  const tx = Math.cos(ry);
  const tz = -Math.sin(ry);
  const out = (d: number): [number, number, number] => [x + nx * d, y, z + nz * d];

  const [fx, fy, fz] = out(0.008);
  place(parent, new Mesh(new BoxGeometry(0.3, 0.32, 0.02), mats.woodDark), fx, fy, fz, ry);
  const [gx, gy, gz] = out(0.024);
  place(parent, new Mesh(new BoxGeometry(0.22, 0.24, 0.01), glass), gx, gy, gz, ry);
  const [bx, by, bz] = out(0.032);
  place(parent, new Mesh(new BoxGeometry(0.22, 0.018, 0.012), mats.woodDark), bx, by, bz, ry);
  place(parent, new Mesh(new BoxGeometry(0.018, 0.24, 0.012), mats.woodDark), bx, by, bz, ry);

  // Green shutters on either side, in the wall plane.
  for (const s of [-1, 1]) {
    place(parent, new Mesh(new BoxGeometry(0.1, 0.32, 0.03), mats.shrub), x + tx * 0.2 * s, y, z + tz * 0.2 * s, ry);
  }
}

/** Clay boxes of flowers on the window sills. Each box is a centre point on its sill. */
function addFlowerBoxes(parent: Group, mats: SharedMaterials, sills: [number, number, number][]): void {
  const palette = [PALETTE.flowerYellow, PALETTE.flowerPink, PALETTE.flowerWhite].map((c) => new Color(c));
  const perBox = 5;
  const flowers = new InstancedMesh(new SphereGeometry(0.035, 8, 6), mats.flower, sills.length * perBox);
  flowers.name = 'house-flowers';
  const dummy = new Object3D();

  let k = 0;
  sills.forEach(([x, y, z], box) => {
    place(parent, new Mesh(new BoxGeometry(0.32, 0.08, 0.12), mats.woodDark), x, y, z);
    for (let f = 0; f < perBox; f++) {
      dummy.position.set(x + (f - (perBox - 1) / 2) * 0.055, y + 0.05 + (f % 2) * 0.02, z);
      dummy.updateMatrix();
      flowers.setMatrixAt(k, dummy.matrix);
      flowers.setColorAt(k, palette[(box + f) % palette.length]);
      k++;
    }
  });
  flowers.instanceMatrix.needsUpdate = true;
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
  parent.add(flowers);
}

export function createHouse(mats: SharedMaterials): House {
  const group = new Group();
  group.name = 'house';
  group.position.set(HOUSE.x, terrainHeight(HOUSE.x, HOUSE.z), HOUSE.z);
  group.rotation.y = -0.12;

  const front = BODY.depth / 2;
  const side = BODY.width / 2;

  // Walls, gable and a stone plinth.
  place(group, new Mesh(new BoxGeometry(BODY.width, BODY.height, BODY.depth), mats.plaster), 0, BODY.height / 2, 0);
  place(group, new Mesh(gableGeometry(), mats.plaster), 0, BODY.height, 0);
  place(group, new Mesh(new BoxGeometry(BODY.width + 0.06, 0.1, BODY.depth + 0.06), mats.stone), 0, 0.02, 0);

  // Roof: two slabs meeting at a ridge. Each slab sits on its slope, pushed out by half its thickness.
  const halfW = side + ROOF.overhang;
  const slope = Math.hypot(halfW, ROOF.rise);
  const angle = Math.atan2(ROOF.rise, halfW);
  const normalX = ROOF.rise / slope;
  const normalY = halfW / slope;
  const centreX = halfW / 2 + (normalX * ROOF.thickness) / 2;
  const centreY = BODY.height + ROOF.rise / 2 + (normalY * ROOF.thickness) / 2;
  const slabGeometry = new BoxGeometry(slope + 0.04, ROOF.thickness, BODY.depth + 0.4);
  place(group, new Mesh(slabGeometry, mats.roof), centreX, centreY, 0, 0, 0, -angle);
  place(group, new Mesh(slabGeometry, mats.roof), -centreX, centreY, 0, 0, 0, angle);
  place(group, new Mesh(new BoxGeometry(0.1, 0.09, BODY.depth + 0.44), mats.woodDark), 0, BODY.height + ROOF.rise + 0.05, 0);

  // Chimney on the right slope, its base sunk into the roof.
  place(group, new Mesh(new BoxGeometry(0.24, 0.7, 0.24), mats.stone), 0.42, 1.62, -0.25);
  place(group, new Mesh(new BoxGeometry(0.3, 0.07, 0.3), mats.stone), 0.42, 1.98, -0.25);

  // Door with frame, canopy, step and knob.
  place(group, new Mesh(new BoxGeometry(0.36, 0.58, 0.02), mats.woodDark), 0, 0.29, front + 0.005);
  place(group, new Mesh(new BoxGeometry(0.3, 0.52, 0.04), mats.door), 0, 0.27, front + 0.02);
  place(group, new Mesh(new SphereGeometry(0.024, 10, 8), mats.woodDark), 0.09, 0.27, front + 0.05);
  place(group, new Mesh(new BoxGeometry(0.46, 0.05, 0.3), mats.roof), 0, 0.64, front + 0.12, 0, -0.18, 0);
  place(group, new Mesh(new BoxGeometry(0.46, 0.06, 0.2), mats.stone), 0, 0.03, front + 0.11);

  // Windows: front pair, back pair and one on the right side.
  const glass = mats.glass;
  addWindow(group, mats, glass, -0.42, 0.62, front, 0);
  addWindow(group, mats, glass, 0.42, 0.62, front, 0);
  addWindow(group, mats, glass, -0.42, 0.62, -front, Math.PI);
  addWindow(group, mats, glass, 0.42, 0.62, -front, Math.PI);
  addWindow(group, mats, glass, side, 0.62, 0, Math.PI / 2);

  // Round attic window in the gable.
  const atticY = BODY.height + 0.28;
  place(group, new Mesh(new CircleGeometry(0.11, 20), glass), 0, atticY, front + 0.012);
  place(group, new Mesh(new TorusGeometry(0.11, 0.02, 6, 20), mats.woodDark), 0, atticY, front + 0.02);

  addFlowerBoxes(group, mats, [
    [-0.42, 0.44, front + 0.07],
    [0.42, 0.44, front + 0.07],
  ]);

  const glowAnchor = new Object3D();
  glowAnchor.name = 'house-glow-anchor';
  glowAnchor.position.set(0, 0.7, front + 0.6);
  group.add(glowAnchor);

  return { group, glowAnchor, glass };
}
