import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Shape,
  SphereGeometry,
  Vector3,
} from 'three';
import { PALETTE, type SceneMaterials } from './palette';

export interface House {
  group: Group;
  hitTarget: Object3D;
  smokeOrigin: Object3D;
  lightAnchor: Vector3;
  setLightLevel(level: number, night: number): void;
}

const AMBER = new Color(PALETTE.amber);
const AMBER_DEEP = new Color(PALETTE.amberDeep);
const WINDOW_DARK = new Color(PALETTE.windowDark);

const WIDTH = 2.3;
const DEPTH = 1.8;
const FOUNDATION = 0.22;
const WALL_HEIGHT = 1.45;
const WALL_TOP = FOUNDATION + WALL_HEIGHT;
const GABLE_HEIGHT = 1.02;

export function createHouse(materials: SceneMaterials): House {
  const group = new Group();
  group.name = 'house';

  const body = new Group();
  body.name = 'house-body';
  group.add(body);

  addFoundation(body, materials);
  addWalls(body, materials);
  addRoof(body, materials);
  addChimney(body, materials);
  addDoor(body, materials);
  addFrontWindow(body, materials, -0.79, 1.06);
  addFrontWindow(body, materials, 0.79, 1.06);
  addSideWindow(body, materials);
  addTimber(body, materials);
  addLantern(body, materials);

  const smokeOrigin = new Object3D();
  smokeOrigin.position.set(-0.62, 3.0, -0.42);
  group.add(smokeOrigin);

  const lightAnchor = new Vector3(0.15, 1.2, 2.0);
  const porchLight = new PointLight(new Color(PALETTE.amber), 0, 7.5, 2);
  porchLight.position.copy(lightAnchor);
  porchLight.castShadow = false;
  group.add(porchLight);

  const hitTarget = new Mesh(
    new BoxGeometry(2.75, 2.95, 2.45),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hitTarget.name = 'house-hit-target';
  hitTarget.position.set(0, 1.45, 0.08);
  group.add(hitTarget);

  let level = 0;
  let nightFactor = 0;
  const setLightLevel = (nextLevel: number, nextNight: number): void => {
    level = nextLevel;
    nightFactor = nextNight;
    const glow = level * (0.65 + 2.35 * nightFactor);
    materials.window.emissiveIntensity = 0.02 + glow;
    materials.window.color.copy(level > 0.02 ? AMBER_DEEP : WINDOW_DARK);
    materials.window.color.lerp(AMBER, level * 0.45);
    porchLight.intensity = level * (0.8 + 4.6 * nightFactor);
    porchLight.color.set(level > 0.02 ? PALETTE.amber : '#3d332a');
  };

  return {
    group,
    hitTarget,
    smokeOrigin,
    lightAnchor,
    setLightLevel,
  };
}

function box(
  parent: Group,
  material: MeshStandardMaterial | MeshBasicMaterial,
  size: [number, number, number],
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addFoundation(parent: Group, materials: SceneMaterials): void {
  box(
    parent,
    materials.stone,
    [WIDTH + 0.16, FOUNDATION, DEPTH + 0.16],
    [0, FOUNDATION / 2, 0],
  );
  box(parent, materials.stone, [WIDTH + 0.3, 0.07, DEPTH + 0.3], [0, 0.035, 0]);

  // A doorstep of worn stone.
  const step = new Mesh(new BoxGeometry(0.72, 0.16, 0.34), materials.stone);
  step.position.set(0, 0.09, DEPTH / 2 + 0.25);
  step.rotation.y = 0.02;
  step.castShadow = true;
  step.receiveShadow = true;
  parent.add(step);
}

function addWalls(parent: Group, materials: SceneMaterials): void {
  const wall = new Mesh(new BoxGeometry(WIDTH, WALL_HEIGHT, DEPTH), materials.plaster);
  wall.position.y = FOUNDATION + WALL_HEIGHT / 2;
  wall.castShadow = true;
  wall.receiveShadow = true;
  parent.add(wall);

  const gable = new Shape();
  gable.moveTo(-WIDTH / 2, 0);
  gable.lineTo(WIDTH / 2, 0);
  gable.lineTo(0, GABLE_HEIGHT);
  gable.closePath();
  const gableGeometry = new ExtrudeGeometry(gable, { depth: DEPTH, bevelEnabled: false });
  gableGeometry.translate(0, 0, -DEPTH / 2);
  const gableMesh = new Mesh(gableGeometry, materials.plaster);
  gableMesh.position.y = WALL_TOP;
  gableMesh.castShadow = true;
  gableMesh.receiveShadow = true;
  parent.add(gableMesh);

  // A slim stone plinth line between foundation and plaster.
  box(parent, materials.woodDark, [WIDTH + 0.04, 0.055, DEPTH + 0.04], [0, FOUNDATION + 0.027, 0]);
}

function addRoof(parent: Group, materials: SceneMaterials): void {
  const halfSpan = WIDTH / 2 + 0.26;
  const rise = GABLE_HEIGHT;
  const slopeLength = Math.hypot(halfSpan, rise);
  const angle = Math.atan2(rise, halfSpan);
  const thickness = 0.1;

  for (const side of [-1, 1] as const) {
    const slab = new Mesh(new BoxGeometry(slopeLength, thickness, DEPTH + 0.46), materials.roof);
    slab.rotation.z = side * angle;
    slab.position.set((-side * halfSpan) / 2, WALL_TOP + rise / 2 + 0.035, 0);
    slab.castShadow = true;
    slab.receiveShadow = true;
    parent.add(slab);

    const fascia = new Mesh(
      new BoxGeometry(0.055, 0.14, DEPTH + 0.5),
      materials.roofDark,
    );
    fascia.position.set(-side * halfSpan, WALL_TOP - 0.005, 0);
    fascia.castShadow = true;
    parent.add(fascia);
  }

  const ridge = new Mesh(
    new CylinderGeometry(0.075, 0.075, DEPTH + 0.48, 6),
    materials.roofDark,
  );
  ridge.rotation.x = Math.PI / 2;
  ridge.position.set(0, WALL_TOP + rise + 0.02, 0);
  ridge.castShadow = true;
  parent.add(ridge);

  // Little round finial at the gable peak.
  const finial = new Mesh(new SphereGeometry(0.075, 10, 8), materials.woodDark);
  finial.position.set(0, WALL_TOP + rise + 0.11, DEPTH / 2 + 0.18);
  finial.castShadow = true;
  parent.add(finial);
}

function addChimney(parent: Group, materials: SceneMaterials): void {
  const chimney = new Mesh(new BoxGeometry(0.34, 0.98, 0.34), materials.stone);
  chimney.position.set(-0.62, 2.35, -0.42);
  chimney.rotation.y = 0.04;
  chimney.castShadow = true;
  chimney.receiveShadow = true;
  parent.add(chimney);

  box(parent, materials.stone, [0.47, 0.09, 0.47], [-0.62, 2.86, -0.42]);
  box(parent, materials.woodDark, [0.24, 0.15, 0.24], [-0.62, 2.97, -0.42]);
  const pot = new Mesh(new CylinderGeometry(0.07, 0.085, 0.16, 8), materials.terracottaMat);
  pot.position.set(-0.62, 3.09, -0.42);
  pot.castShadow = true;
  parent.add(pot);
}

function addDoor(parent: Group, materials: SceneMaterials): void {
  const doorZ = DEPTH / 2 + 0.022;
  const door = new Mesh(new BoxGeometry(0.54, 0.98, 0.055), materials.wood);
  door.position.set(0, FOUNDATION + 0.49, doorZ);
  door.castShadow = true;
  parent.add(door);

  // Plank grooves.
  for (const x of [-0.16, 0, 0.16]) {
    box(parent, materials.woodDark, [0.012, 0.96, 0.012], [x, FOUNDATION + 0.49, doorZ + 0.034]);
  }

  // Frame and lintel.
  box(parent, materials.woodDark, [0.07, 1.08, 0.06], [-0.305, FOUNDATION + 0.54, doorZ]);
  box(parent, materials.woodDark, [0.07, 1.08, 0.06], [0.305, FOUNDATION + 0.54, doorZ]);
  box(parent, materials.woodDark, [0.68, 0.075, 0.07], [0, FOUNDATION + 1.065, doorZ]);

  const knob = new Mesh(new SphereGeometry(0.035, 8, 8), materials.brass);
  knob.position.set(0.17, FOUNDATION + 0.52, doorZ + 0.05);
  parent.add(knob);

  // Small house number plate, painted on a wooden tag.
  box(parent, materials.woodLight, [0.14, 0.07, 0.016], [-0.01, FOUNDATION + 1.15, doorZ + 0.025]);
}

function addFrontWindow(
  parent: Group,
  materials: SceneMaterials,
  x: number,
  y: number,
): void {
  const windowGroup = createWindow(materials, 0.43, 0.43, true);
  windowGroup.position.set(x, y, DEPTH / 2 + 0.03);
  parent.add(windowGroup);

  // Timber shutters, folded open against the plaster.
  for (const side of [-1, 1] as const) {
    const shutter = box(
      parent,
      materials.woodDark,
      [0.17, 0.5, 0.035],
      [x + side * 0.36, y, DEPTH / 2 + 0.038],
    );
    shutter.rotation.y = side * 0.04;
    for (let slat = 0; slat < 4; slat += 1) {
      box(
        parent,
        materials.woodLight,
        [0.13, 0.018, 0.012],
        [x + side * 0.36, y - 0.17 + slat * 0.11, DEPTH / 2 + 0.06],
      );
    }
  }
}

function addSideWindow(parent: Group, materials: SceneMaterials): void {
  const windowGroup = createWindow(materials, 0.4, 0.42, false);
  windowGroup.position.set(WIDTH / 2 + 0.03, 1.08, 0.16);
  windowGroup.rotation.y = Math.PI / 2;
  parent.add(windowGroup);
}

function createWindow(
  materials: SceneMaterials,
  width: number,
  height: number,
  withFlowerBox: boolean,
): Group {
  const group = new Group();

  const frame = box(group, materials.woodDark, [width + 0.13, height + 0.13, 0.06], [0, 0, 0]);
  frame.castShadow = false;

  const pane = new Mesh(new BoxGeometry(width, height, 0.045), materials.window);
  pane.position.z = 0.033;
  group.add(pane);

  box(group, materials.woodDark, [0.034, height, 0.025], [0, 0, 0.062]);
  box(group, materials.woodDark, [width, 0.034, 0.025], [0, 0, 0.062]);
  box(group, materials.woodDark, [width + 0.23, 0.06, 0.12], [0, -height / 2 - 0.085, 0.035]);

  if (withFlowerBox) {
    box(group, materials.wood, [width + 0.08, 0.14, 0.16], [0, -height / 2 - 0.19, 0.07]);
    const stemMaterial = materials.leafC;
    const colors = [materials.flowerCream, materials.flowerRose, materials.flowerGold];
    for (let i = 0; i < 5; i += 1) {
      const stem = new Mesh(new CylinderGeometry(0.008, 0.011, 0.15, 4), stemMaterial);
      stem.position.set(-0.2 + i * 0.1, -height / 2 - 0.08, 0.09);
      stem.rotation.z = (i - 2) * 0.08;
      group.add(stem);
      const flower = new Mesh(new SphereGeometry(0.045, 7, 6), colors[i % colors.length]);
      flower.position.set(-0.2 + i * 0.1, -height / 2 + 0.01, 0.09);
      flower.scale.set(1, 0.75, 1);
      group.add(flower);
    }
  }

  return group;
}

function addTimber(parent: Group, materials: SceneMaterials): void {
  const post = 0.085;
  for (const x of [-WIDTH / 2 + 0.03, WIDTH / 2 - 0.03]) {
    for (const z of [-DEPTH / 2 + 0.03, DEPTH / 2 - 0.03]) {
      box(parent, materials.woodDark, [post, WALL_HEIGHT, post], [x, FOUNDATION + WALL_HEIGHT / 2, z]);
    }
  }

  box(
    parent,
    materials.woodDark,
    [WIDTH + 0.02, 0.075, 0.055],
    [0, WALL_TOP - 0.075, DEPTH / 2 + 0.012],
  );

  // Gable cross-brace and king post.
  box(parent, materials.woodDark, [0.075, 0.93, 0.05], [0, WALL_TOP + 0.44, DEPTH / 2 + 0.02]);
  for (const side of [-1, 1] as const) {
    const brace = box(
      parent,
      materials.woodDark,
      [0.07, 0.88, 0.045],
      [side * 0.42, WALL_TOP + 0.39, DEPTH / 2 + 0.02],
      [0, 0, side * 0.5],
    );
    brace.castShadow = false;
  }
}

function addLantern(parent: Group, materials: SceneMaterials): void {
  const arm = box(parent, materials.woodDark, [0.24, 0.045, 0.045], [0.44, 1.38, DEPTH / 2 + 0.1]);
  arm.castShadow = false;
  box(parent, materials.woodDark, [0.035, 0.15, 0.035], [0.55, 1.31, DEPTH / 2 + 0.1]);
  const lamp = new Mesh(new BoxGeometry(0.13, 0.17, 0.13), materials.window);
  lamp.position.set(0.55, 1.21, DEPTH / 2 + 0.1);
  parent.add(lamp);
  box(parent, materials.woodDark, [0.16, 0.035, 0.16], [0.55, 1.31, DEPTH / 2 + 0.1]);
  box(parent, materials.woodDark, [0.16, 0.035, 0.16], [0.55, 1.11, DEPTH / 2 + 0.1]);
}
