import * as THREE from 'three';
import { PartBuilder, placementMatrix, type Placement } from '../core/parts';
import { DOOR_LOCAL, HOUSE } from './layout';
import { PALETTE, type Materials } from './materials';
import { houseFloorY } from './terrain';

// Local frame: origin on the ground at the centre of the footprint, door facing +z.
const W = 1.5;
const D = 1.15;
const FLOOR = 0.16;
const WALL_H = 1.0;
const EAVE = FLOOR + WALL_H;
const RISE = 0.62;
const APEX = EAVE + RISE;
const PITCH = Math.atan2(RISE, W / 2);
const DOOR_X = DOOR_LOCAL.x;
const LANTERN_X = 0.56;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

function haloTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A framed window facing +z in its own frame, placed on a wall by `frame`. */
function addWindow(
  b: PartBuilder,
  m: Materials,
  extra: { flowers: THREE.Material[] },
  frame: THREE.Matrix4,
  opts: { shutters?: boolean; flowerBox?: boolean; w?: number; h?: number } = {},
) {
  const w = opts.w ?? 0.3;
  const h = opts.h ?? 0.34;
  const local = (p: Placement) => frame.clone().multiply(placementMatrix(p));
  b.add(m.glass, box(w - 0.02, h - 0.02, 0.02), local({ z: 0.004 }));
  b.add(m.trim, box(w + 0.06, 0.045, 0.05), local({ y: h / 2, z: 0.02 }));
  b.add(m.trim, box(w + 0.1, 0.04, 0.1), local({ y: -h / 2 - 0.01, z: 0.04 }));
  b.add(m.trim, box(0.045, h, 0.05), local({ x: -w / 2, z: 0.02 }));
  b.add(m.trim, box(0.045, h, 0.05), local({ x: w / 2, z: 0.02 }));
  b.add(m.trim, box(0.024, h - 0.02, 0.03), local({ z: 0.018 }));
  b.add(m.trim, box(w - 0.02, 0.024, 0.03), local({ y: 0.02, z: 0.018 }));
  if (opts.shutters) {
    for (const side of [-1, 1]) {
      b.add(m.shutter, box(0.14, h + 0.02, 0.025), local({ x: side * (w / 2 + 0.1), z: 0.016 }));
      for (let i = 0; i < 3; i++) {
        b.add(m.shutter, box(0.1, 0.012, 0.012), local({ x: side * (w / 2 + 0.1), y: -h / 3 + (i * h) / 3 + 0.06, z: 0.032 }));
      }
    }
  }
  if (opts.flowerBox) {
    b.add(m.wood, box(w + 0.06, 0.075, 0.09), local({ y: -h / 2 - 0.07, z: 0.07 }));
    for (let i = 0; i < 6; i++) {
      const fx = -w / 2 + 0.02 + (i * (w - 0.04)) / 5;
      const mat = extra.flowers[i % extra.flowers.length];
      b.add(mat, new THREE.IcosahedronGeometry(0.034, 0), local({ x: fx, y: -h / 2 - 0.015, z: 0.07 + (i % 2) * 0.02 }));
    }
  }
}

export interface House {
  group: THREE.Group;
  hitbox: THREE.Mesh;
  chimneyTop: THREE.Vector3;
  /** Approximate roof height at a world point, or -Infinity if not over the house. */
  roofHeightAt(x: number, z: number): number;
  setLights(amount: number, night: number): void;
}

export function buildHouse(m: Materials): House {
  const b = new PartBuilder();
  const flowers = [PALETTE.flowerB, PALETTE.flowerA, PALETTE.flowerD].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true }),
  );
  const leafy = new THREE.MeshStandardMaterial({ color: PALETTE.leaf, roughness: 0.9, flatShading: true });
  const extra = { flowers };

  // Plinth, walls and timber accents.
  b.add(m.stone, box(W + 0.14, 0.42, D + 0.14), { y: FLOOR - 0.21 });
  b.add(m.wall, box(W, WALL_H, D), { y: FLOOR + WALL_H / 2 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.add(m.wood, box(0.075, WALL_H, 0.075), { x: (sx * W) / 2, y: FLOOR + WALL_H / 2, z: (sz * D) / 2 });
    }
  }
  b.add(m.wood, box(W + 0.08, 0.07, 0.07), { y: EAVE - 0.02, z: D / 2 });
  b.add(m.wood, box(W + 0.08, 0.07, 0.07), { y: EAVE - 0.02, z: -D / 2 });
  b.add(m.wood, box(0.07, 0.07, D + 0.08), { x: W / 2, y: EAVE - 0.02 });
  b.add(m.wood, box(0.07, 0.07, D + 0.08), { x: -W / 2, y: EAVE - 0.02 });

  // Gables.
  const gable = new THREE.Shape();
  gable.moveTo(-W / 2, 0);
  gable.lineTo(W / 2, 0);
  gable.lineTo(0, RISE);
  gable.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gable, { depth: D, bevelEnabled: false });
  b.add(m.wall, gableGeo, { y: EAVE, z: -D / 2 });

  // Roof: overlapping shingle courses on each side, so the gable edge reads as tiles.
  const overhang = 0.2;
  const slope = Math.hypot(W / 2, RISE) + overhang;
  const roofDepth = D + 0.34;
  const courses = 5;
  for (const side of [-1, 1]) {
    for (let i = 0; i < courses; i++) {
      const len = slope / courses + 0.05;
      const u = ((i + 0.5) * slope) / courses;
      const tilt = PITCH + THREE.MathUtils.degToRad(5);
      const lift = 0.035 + i * 0.002;
      b.add(m.roof, box(len, 0.05, roofDepth), {
        x: side * (Math.cos(PITCH) * u + Math.sin(PITCH) * lift),
        y: APEX - Math.sin(PITCH) * u + Math.cos(PITCH) * lift,
        rz: -side * tilt,
      });
    }
  }
  b.add(m.roof, box(0.13, 0.13, roofDepth + 0.04), { y: APEX + 0.06, rz: Math.PI / 4 });

  // Chimney on the back-left slope.
  const chimney = { x: -0.42, z: -0.24 };
  b.add(m.stone, box(0.28, 0.95, 0.28), { x: chimney.x, y: 1.66, z: chimney.z });
  b.add(m.stoneDark, box(0.36, 0.07, 0.36), { x: chimney.x, y: 2.15, z: chimney.z });
  b.add(m.stoneDark, box(0.2, 0.05, 0.2), { x: chimney.x, y: 2.2, z: chimney.z });

  // Arched door with a trim surround, knob, step and a little awning.
  const arch = (w: number, h: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h - w / 2);
    s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
    s.closePath();
    return s;
  };
  const dx = DOOR_X;
  b.add(m.trim, new THREE.ExtrudeGeometry(arch(0.48, 0.72), { depth: 0.03, bevelEnabled: false, curveSegments: 10 }), {
    x: dx,
    y: FLOOR,
    z: D / 2 - 0.005,
  });
  b.add(m.woodDark, new THREE.ExtrudeGeometry(arch(0.36, 0.64), { depth: 0.05, bevelEnabled: false, curveSegments: 10 }), {
    x: dx,
    y: FLOOR,
    z: D / 2,
  });
  for (const x of [-0.06, 0.06]) b.add(m.wood, box(0.012, 0.5, 0.012), { x: dx + x, y: FLOOR + 0.27, z: D / 2 + 0.05 });
  b.add(m.brass, new THREE.SphereGeometry(0.022, 8, 6), { x: dx - 0.11, y: FLOOR + 0.3, z: D / 2 + 0.065 });
  b.add(m.stone, box(0.6, 0.08, 0.26), { x: dx, y: 0.04, z: D / 2 + 0.2 });
  b.add(m.roof, box(0.66, 0.035, 0.34), { x: dx, y: FLOOR + 0.84, z: D / 2 + 0.15, rx: 0.32 });
  for (const x of [-0.27, 0.27]) {
    b.add(m.wood, box(0.035, 0.035, 0.2), { x: dx + x, y: FLOOR + 0.74, z: D / 2 + 0.09, rx: -0.7 });
  }

  // Lantern beside the door. Its glass shares the window material, so it lights with them.
  const lx = LANTERN_X;
  b.add(m.woodDark, box(0.03, 0.03, 0.09), { x: lx, y: FLOOR + 0.62, z: D / 2 + 0.04 });
  b.add(m.glass, box(0.075, 0.11, 0.075), { x: lx, y: FLOOR + 0.55, z: D / 2 + 0.09 });
  b.add(m.woodDark, new THREE.ConeGeometry(0.07, 0.07, 4), { x: lx, y: FLOOR + 0.64, z: D / 2 + 0.09, ry: Math.PI / 4 });
  b.add(m.woodDark, box(0.09, 0.02, 0.09), { x: lx, y: FLOOR + 0.49, z: D / 2 + 0.09 });

  // Windows.
  const winY = FLOOR + 0.56;
  const at = (x: number, y: number, z: number, ry: number) => placementMatrix({ x, y, z, ry }).clone();
  addWindow(b, m, extra, at(-0.36, winY, D / 2, 0), { shutters: true, flowerBox: true, w: 0.34 });
  addWindow(b, m, extra, at(W / 2, winY, 0, Math.PI / 2), { shutters: true, flowerBox: true, w: 0.34 });
  addWindow(b, m, extra, at(-W / 2, winY, 0.05, -Math.PI / 2), { shutters: true });
  addWindow(b, m, extra, at(0.3, winY, -D / 2, Math.PI), {});
  // Round attic window in the front gable.
  b.add(m.glass, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 18), { y: EAVE + 0.26, z: D / 2 + 0.004, rx: Math.PI / 2 });
  b.add(m.trim, new THREE.TorusGeometry(0.105, 0.022, 6, 18), { y: EAVE + 0.26, z: D / 2 + 0.015 });

  // Woodpile against the right wall, below the window.
  const logs: [number, number][] = [
    [0.12, 0], [0.22, 0], [0.32, 0],
    [0.17, 1], [0.27, 1],
    [0.22, 2],
  ];
  for (const [ox, row] of logs) {
    b.add(m.wood, new THREE.CylinderGeometry(0.05, 0.05, 0.36, 7), {
      x: W / 2 + ox,
      y: 0.05 + row * 0.086,
      z: -0.3,
      rx: Math.PI / 2,
    });
  }
  // A shrub tucked by the front corner softens the plinth line.
  b.add(leafy, new THREE.IcosahedronGeometry(0.17, 0), { x: -0.86, y: 0.1, z: D / 2 + 0.12, sy: 0.8 });

  const group = b.build();
  group.position.set(HOUSE.x, houseFloorY(), HOUSE.z);
  group.rotation.y = HOUSE.yaw;
  group.name = 'house';

  const hitbox = new THREE.Mesh(box(W + 0.4, 2.3, D + 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  hitbox.position.set(0, 1.05, 0.1);
  hitbox.name = 'house-hitbox';
  group.add(hitbox);

  // Warm spill light in front of the door, and soft halos around the windows.
  const light = new THREE.PointLight(PALETTE.windowGlow, 0, 5.5, 1.8);
  light.position.set(DOOR_X, 0.8, D / 2 + 0.6);
  group.add(light);

  const haloMat = new THREE.SpriteMaterial({
    map: haloTexture(),
    color: PALETTE.windowGlow,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });
  const haloSpots: [number, number, number, number][] = [
    [-0.36, winY, D / 2 + 0.08, 0.62],
    [W / 2 + 0.08, winY, 0, 0.62],
    [-W / 2 - 0.08, winY, 0.05, 0.55],
    [0.3, winY, -D / 2 - 0.08, 0.5],
    [0, EAVE + 0.26, D / 2 + 0.06, 0.35],
    [LANTERN_X, FLOOR + 0.55, D / 2 + 0.14, 0.38],
  ];
  for (const [x, y, z, s] of haloSpots) {
    const sprite = new THREE.Sprite(haloMat);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(s);
    sprite.raycast = () => {};
    group.add(sprite);
  }

  group.updateMatrixWorld(true);
  const chimneyTop = new THREE.Vector3(chimney.x, 2.25, chimney.z).applyMatrix4(group.matrixWorld);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const tmp = new THREE.Vector3();
  const glassOff = new THREE.Color(PALETTE.glass);
  const glassOn = new THREE.Color('#e8b77a');

  return {
    group,
    hitbox,
    chimneyTop,
    roofHeightAt(x, z) {
      tmp.set(x, 0, z).applyMatrix4(inv);
      const halfX = W / 2 + overhang * Math.cos(PITCH);
      if (Math.abs(tmp.x) > halfX || Math.abs(tmp.z) > roofDepth / 2) return -Infinity;
      const y = APEX + 0.06 - Math.abs(tmp.x) * Math.tan(PITCH);
      return group.position.y + y;
    },
    setLights(amount, night) {
      m.glass.emissiveIntensity = amount * (0.9 + 1.9 * night);
      m.glass.color.copy(glassOff).lerp(glassOn, amount * 0.55);
      light.intensity = amount * (0.5 + 3.5 * night);
      haloMat.opacity = amount * (0.12 + 0.5 * night);
    },
  };
}
