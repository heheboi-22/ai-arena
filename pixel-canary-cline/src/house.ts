import * as THREE from 'three';
import { groundAt } from './island';

const WOOD_DARK = '#5a4130';
const WOOD_BEAM = '#6d4f38';
const CREAM = '#f1e6cd';
const CREAM_SHADE = '#e2d3b5';
const ROOF = '#a4653f';
const ROOF_DARK = '#8b5333';

export interface HouseHandle {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  setLights: (amount: number) => void;
}

/** Four slanted planes: two roof slopes plus two gable undersides. */
function roofGeometry(): THREE.BufferGeometry {
  const hw = 0.86;
  const hd = 0.74;
  const base = 1.24;
  const apex = 1.97;
  const vertices = new Float32Array([
    -hw, base, hd,
    hw, base, hd,
    hw, apex, 0,
    -hw, apex, 0,
    -hw, base, -hd,
    hw, base, -hd,
  ]);
  const idx: number[] = [];
  const emit = (a: number, b: number, c: number, d: number): void => {
    idx.push(a, b, c, a, c, d);
  };
  emit(0, 3, 2, 1);
  emit(5, 4, 3, 2);
  emit(4, 5, 1, 0);
  emit(3, 0, 1, 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  return geometry;
}

function radialTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.33)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface Pane {
  /** Which wall the window hangs on. */
  axis: 'x' | 'z';
  /** Position along that wall. */
  u: number;
  /** Height. */
  v: number;
  dir: 1 | -1;
  w: number;
}

const WALL = { x: 0.72, z: 0.57 };

const PANES: Pane[] = [
  { axis: 'z', u: -0.44, v: 0.82, dir: 1, w: 0.3 },
  { axis: 'z', u: 0.44, v: 0.82, dir: 1, w: 0.3 },
  { axis: 'z', u: 0, v: 1.6, dir: 1, w: 0.2 },
  { axis: 'x', u: -0.1, v: 0.82, dir: -1, w: 0.3 },
  { axis: 'x', u: 0.16, v: 0.82, dir: 1, w: 0.26 },
];

function placeOnWall(pane: Pane, off: number, mesh: THREE.Object3D): void {
  if (pane.axis === 'z') {
    mesh.position.set(pane.u, pane.v, pane.dir * (WALL.z + off));
    mesh.rotation.y = 0;
  } else {
    mesh.position.set(pane.dir * (WALL.x + off), pane.v, pane.u);
    mesh.rotation.y = Math.PI / 2;
  }
}

export function buildHouse(): HouseHandle {
  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];

  const standard = (color: string, roughness = 0.88): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

  const add = (mesh: THREE.Mesh, pick = true): THREE.Mesh => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (pick) pickables.push(mesh);
    group.add(mesh);
    return mesh;
  };

  // Stone footing keeps the walls clear of damp grass.
  const plinth = add(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 1.3), standard('#9c9488', 0.96)));
  plinth.position.y = 0.1;

  const wall = add(new THREE.Mesh(new THREE.BoxGeometry(1.44, 1.06, 1.14), standard(CREAM, 0.93)));
  wall.position.y = 0.73;

  const cornerPost = new THREE.BoxGeometry(0.08, 1.08, 0.08);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = add(new THREE.Mesh(cornerPost, standard(WOOD_BEAM)));
      post.position.set(sx * 0.71, 0.74, sz * 0.56);
    }
  }

  const beam = add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 1.2), standard(WOOD_BEAM)));
  beam.position.y = 1.26;

  const gableShape = new THREE.Shape();
  gableShape.moveTo(-0.71, 0);
  gableShape.lineTo(0.71, 0);
  gableShape.lineTo(0, 0.68);
  gableShape.lineTo(-0.71, 0);
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 1.15, bevelEnabled: false });
  gableGeo.translate(0, 0, -0.575);
  const gable = add(new THREE.Mesh(gableGeo, standard(CREAM_SHADE, 0.93)));
  gable.position.y = 1.29;

  add(
    new THREE.Mesh(
      roofGeometry(),
      new THREE.MeshStandardMaterial({
        color: ROOF,
        roughness: 0.82,
        side: THREE.DoubleSide,
        flatShading: true,
      }),
    ),
  );

  const ridge = add(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 1.9), standard(ROOF_DARK)));
  ridge.position.y = 2.0;

  const chimney = add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.88, 0.24), standard('#a3907e', 0.96)));
  chimney.position.set(-0.42, 1.84, -0.28);
  chimney.rotation.z = 0.02;
  const chimneyCap = add(new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.07, 0.33), standard('#87766a', 0.96)));
  chimneyCap.position.set(-0.44, 2.3, -0.28);

  const step = add(new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.07, 0.28), standard('#a39b8d', 0.96)));
  step.position.set(0, 0.13, 0.83);
  step.rotation.x = -0.07;

  const doorFrame = add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.76, 0.05), standard(WOOD_BEAM)));
  doorFrame.position.set(0, 0.59, 0.565);
  const door = add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.66, 0.06), standard(WOOD_DARK, 0.76)));
  door.position.set(0, 0.54, 0.59);
  const knob = add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), standard('#d8b26a', 0.4)));
  knob.position.set(0.12, 0.53, 0.63);


  const glass = new THREE.MeshStandardMaterial({
    color: '#2c2419',
    emissive: new THREE.Color('#ffbd6a'),
    emissiveIntensity: 0.08,
    roughness: 0.35,
  });
  const frameMat = standard(WOOD_DARK, 0.8);
  const mullionMat = standard('#43331f', 0.8);

  for (const pane of PANES) {
    const frame = add(new THREE.Mesh(new THREE.BoxGeometry(pane.w + 0.11, 0.37, 0.05), frameMat));
    placeOnWall(pane, 0.0, frame);

    const glassMesh = add(new THREE.Mesh(new THREE.BoxGeometry(pane.w, pane.w * 0.86, 0.05), glass));
    placeOnWall(pane, 0.025, glassMesh);
    glassMesh.castShadow = false;

    const vertical = add(new THREE.Mesh(new THREE.BoxGeometry(0.022, pane.w * 0.86, 0.02), mullionMat), false);
    placeOnWall(pane, 0.055, vertical);
    const horizontal = add(new THREE.Mesh(new THREE.BoxGeometry(pane.w, 0.022, 0.02), mullionMat), false);
    placeOnWall(pane, 0.055, horizontal);
  }

  // Lantern beside the door: a small emissive block that reads after dark.
  const lanternMat = new THREE.MeshStandardMaterial({
    color: '#3a2a18',
    emissive: new THREE.Color('#ffcf8f'),
    emissiveIntensity: 0.15,
    roughness: 0.5,
  });
  const bracket = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), standard(WOOD_DARK)));
  bracket.position.set(0.34, 0.92, 0.6);
  const lantern = add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), lanternMat));
  lantern.position.set(0.34, 0.8, 0.62);
  lantern.castShadow = false;

  // Warm pool of light spilling on the grass, only visible once the lamps are on.
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 40),
    new THREE.MeshBasicMaterial({
      map: radialTexture(),
      color: '#ffbc6a',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0.1, 0.07, 0.2);
  group.add(pool);

  const lamp = new THREE.PointLight('#ffb469', 0, 5.4, 2);
  lamp.position.set(0.1, 0.95, 0.3);
  group.add(lamp);

  group.position.set(-1.3, groundAt(-1.3, 0.35), 0.35);
  group.rotation.y = -0.34;

  const setLights = (amount: number): void => {
    glass.emissiveIntensity = 0.06 + amount * 1.9;
    lanternMat.emissiveIntensity = 0.12 + amount * 1.5;
    lamp.intensity = amount * 5.6;
    (pool.material as THREE.MeshBasicMaterial).opacity = amount * 0.4;
  };
  setLights(0);

  return { group, pickables, setLights };
}
