import * as THREE from 'three';
import { HOUSE } from '../config';

export interface HouseRefs {
  group: THREE.Group;
  /** Single shared material driving every window's emissive glow. */
  windowMaterial: THREE.MeshStandardMaterial;
  /** Warm point light that fades in around the house at night. */
  glowLight: THREE.PointLight;
  /** Soft additive halo sprite, opacity driven by light state. */
  glowSprite: THREE.Sprite;
  /** Expanded invisible box used for reliable click picking. */
  hitArea: THREE.Mesh;
}

const CREAM = '#f3e7cf';
const CREAM_TRIM = '#e2d2b2';
const ROOF = '#c9664a';
const ROOF_RIDGE = '#a94f38';
const WOOD = '#8a5a33';
const STONE = '#b0a693';
const BRICK = '#9a5b4f';

function radialGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    4,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, 'rgba(255, 190, 110, 0.85)');
  grad.addColorStop(0.4, 'rgba(255, 170, 90, 0.28)');
  grad.addColorStop(1, 'rgba(255, 160, 80, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The little cottage: cream walls, terracotta gable roof, chimney,
 * wooden door with frame and step, emissive windows with crossbars,
 * corner boards and a warm interior light revealed at night.
 */
export function createHouse(): HouseRefs {
  const group = new THREE.Group();
  group.name = 'house';

  const wallMat = new THREE.MeshStandardMaterial({
    color: CREAM,
    roughness: 0.9,
    metalness: 0,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: CREAM_TRIM,
    roughness: 0.9,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: ROOF,
    roughness: 0.85,
    flatShading: true,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: WOOD,
    roughness: 0.8,
  });
  const stoneMat = new THREE.MeshStandardMaterial({
    color: STONE,
    roughness: 0.95,
    flatShading: true,
  });
  const brickMat = new THREE.MeshStandardMaterial({
    color: BRICK,
    roughness: 0.9,
    flatShading: true,
  });
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: '#5d6a78',
    roughness: 0.35,
    metalness: 0.15,
    emissive: new THREE.Color('#ffb45c'),
    emissiveIntensity: 0.04,
  });

  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    ry = 0,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  // foundation + walls
  add(new THREE.BoxGeometry(2.75, 0.3, 2.35), stoneMat, 0, 0.15, 0);
  add(new THREE.BoxGeometry(2.45, 1.5, 2.05), wallMat, 0, 1.05, 0);

  // corner boards
  const cornerGeo = new THREE.BoxGeometry(0.14, 1.54, 0.14);
  const cornerX = 1.16;
  const cornerZ = 0.96;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add(cornerGeo, trimMat, sx * cornerX, 1.05, sz * cornerZ);
    }
  }

  // gable roof: 3-sided cylinder → triangular prism
  const roofGeo = new THREE.CylinderGeometry(1, 1, 1, 3, 1);
  roofGeo.rotateX(-Math.PI / 2); // extrude along z, apex +y
  const roofW = 3.05;
  const roofH = 1.15;
  const roofD = 2.75;
  roofGeo.scale(roofW / 1.732, roofH / 1.5, roofD / 1);
  roofGeo.translate(0, 0.5 * (roofH / 1.5), 0); // base sits at y=0
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 1.8;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // ridge beam
  add(new THREE.BoxGeometry(0.16, 0.12, roofD + 0.12), new THREE.MeshStandardMaterial({ color: ROOF_RIDGE, roughness: 0.85 }), 0, 1.8 + roofH + 0.02, 0);

  // chimney
  add(new THREE.BoxGeometry(0.34, 0.72, 0.34), brickMat, 0.72, 2.55, -0.42);
  add(new THREE.BoxGeometry(0.44, 0.1, 0.44), brickMat, 0.72, 2.94, -0.42);

  // door (front = +z) with frame, knob and step
  add(new THREE.BoxGeometry(0.7, 1.06, 0.07), trimMat, -0.55, 0.83, 1.0);
  add(new THREE.BoxGeometry(0.56, 0.96, 0.09), woodMat, -0.55, 0.79, 1.03);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#d9a441', roughness: 0.4, metalness: 0.6 }),
  );
  knob.position.set(-0.36, 0.78, 1.09);
  group.add(knob);
  add(new THREE.BoxGeometry(0.85, 0.12, 0.4), stoneMat, -0.55, 0.06, 1.2);

  // windows: [x, y, z, ry] — front, both sides, back
  const windowGeo = new THREE.BoxGeometry(0.46, 0.46, 0.07);
  const barV = new THREE.BoxGeometry(0.05, 0.5, 0.085);
  const barH = new THREE.BoxGeometry(0.5, 0.05, 0.085);
  const frameGeo = new THREE.BoxGeometry(0.58, 0.58, 0.06);
  const windows: Array<[number, number, number, number]> = [
    [0.55, 1.15, 1.03, 0],
    [-1.23, 1.15, 0.25, -Math.PI / 2],
    [1.23, 1.15, -0.3, Math.PI / 2],
    [-0.5, 1.2, -1.03, Math.PI],
  ];
  for (const [x, y, z, ry] of windows) {
    const w = new THREE.Group();
    const frame = new THREE.Mesh(frameGeo, trimMat);
    const pane = new THREE.Mesh(windowGeo, windowMaterial);
    const v = new THREE.Mesh(barV, trimMat);
    const h = new THREE.Mesh(barH, trimMat);
    pane.position.z = 0.012;
    v.position.z = 0.02;
    h.position.z = 0.02;
    for (const m of [frame, pane, v, h]) {
      m.castShadow = false;
      m.receiveShadow = true;
      w.add(m);
    }
    w.position.set(x, y, z);
    w.rotation.y = ry;
    group.add(w);
  }

  // warm interior light + halo (both driven by the lights state)
  const glowLight = new THREE.PointLight('#ffb45c', 0, 9, 2);
  glowLight.position.set(0, 1.7, 0.6);
  group.add(glowLight);

  const glowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: radialGlowTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glowSprite.scale.setScalar(4.2);
  glowSprite.position.set(0, 1.35, 0.4);
  group.add(glowSprite);

  // generous invisible hit area (renders nothing but raycasts)
  const hitArea = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 3.2, 3.1),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    }),
  );
  hitArea.position.y = 1.5;
  group.add(hitArea);

  group.position.copy(HOUSE.position);
  group.rotation.y = HOUSE.rotationY;

  return { group, windowMaterial, glowLight, glowSprite, hitArea };
}
