import * as THREE from 'three';
import { Builder, box, cone, cyl, ico, type Vec3 } from '../core/builder';
import { lerp, mulberry32 } from '../core/math';
import { clay } from './materials';
import { C } from './palette';

export interface House {
  group: THREE.Group;
  /** Chimney mouth in house-local coordinates. */
  chimney: THREE.Vector3;
  /**
   * @param on         0..1 eased light state
   * @param prominence 0..1 how dark the surroundings are (night, storm)
   */
  setLight(on: number, prominence: number): void;
}

type Face = 'front' | 'back' | 'left' | 'right';
const FACES: Record<Face, { ry: number; dist: number }> = {
  front: { ry: 0, dist: 1.0 },
  right: { ry: Math.PI / 2, dist: 1.3 },
  back: { ry: Math.PI, dist: 1.0 },
  left: { ry: -Math.PI / 2, dist: 1.3 },
};

/** Map a point given in "wall space" (x along wall, y up, z out of wall). */
function onWall(face: Face, x: number, y: number, out: number): { p: Vec3; r: Vec3 } {
  const { ry, dist } = FACES[face];
  const z = dist + out;
  const c = Math.cos(ry), s = Math.sin(ry);
  return { p: [x * c + z * s, y, -x * s + z * c], r: [0, ry, 0] };
}

function glowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHouse(): House {
  const rng = mulberry32(11);
  const b = new Builder(rng);
  const panes = new Builder(rng);
  const glowSpots: { p: Vec3; size: number }[] = [];

  const WALL_TOP = 1.62;
  const RISE = 1.15;
  const RUN = 1.28;
  const SLOPE = Math.atan2(RISE, RUN);
  const SLOPE_LEN = Math.hypot(RISE, RUN);

  // --- body ------------------------------------------------------------------
  b.add(box(2.86, 0.44, 2.26), C.stone, { p: [0, 0, 0] }, 0.05);
  b.add(box(2.6, 1.42, 2.0), C.cream, { p: [0, 0.91, 0] }, 0.02);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.add(box(0.13, 1.42, 0.13), C.wood, { p: [sx * 1.3, 0.91, sz * 1.0] }, 0.05);
    }
    b.add(box(0.1, 0.1, 2.1), C.wood, { p: [sx * 1.3, 1.58, 0] }, 0.05);
    b.add(box(2.72, 0.1, 0.1), C.wood, { p: [0, 1.58, sx * 1.0] }, 0.05);
    b.add(box(2.6, 0.07, 0.05), C.creamShade, { p: [0, 0.27, sx * 1.01] });
  }

  // Attic volume under the roof (gables on the short ends).
  const gable = new THREE.Shape();
  gable.moveTo(-1, 0);
  gable.lineTo(1, 0);
  gable.lineTo(1, 0.23);
  gable.lineTo(0, 1.12);
  gable.lineTo(-1, 0.23);
  gable.closePath();
  b.add(
    new THREE.ExtrudeGeometry(gable, { depth: 2.6, bevelEnabled: false }),
    C.cream,
    { p: [-1.3, WALL_TOP, 0], r: [0, Math.PI / 2, 0] },
    0.02,
  );
  // Timber truss on the visible gable.
  for (const sx of [-1, 1]) {
    b.add(box(0.05, 0.1, 2.0), C.wood, { p: [sx * 1.315, WALL_TOP + 0.05, 0] }, 0.05);
    b.add(box(0.05, 0.86, 0.09), C.wood, { p: [sx * 1.315, WALL_TOP + 0.5, 0] }, 0.05);
  }

  // --- roof ------------------------------------------------------------------
  const T = 0.13;
  for (const side of [-1, 1]) {
    const r: Vec3 = [side * SLOPE, 0, 0];
    const ny = Math.cos(SLOPE), nz = side * Math.sin(SLOPE);
    b.add(
      box(3.2, T, SLOPE_LEN + 0.1),
      C.roof,
      { p: [0, WALL_TOP + RISE / 2 + (T / 2) * ny, side * (RUN / 2) + (T / 2) * nz], r },
      0.07,
    );
    for (const f of [0.26, 0.5, 0.74, 0.97]) {
      const along = f * SLOPE_LEN;
      b.add(
        box(3.23, 0.035, 0.07),
        C.roofDark,
        {
          p: [
            0,
            WALL_TOP + RISE - along * Math.sin(SLOPE) + (T + 0.012) * ny,
            side * along * Math.cos(SLOPE) + (T + 0.012) * nz,
          ],
          r,
        },
        0.05,
      );
    }
  }
  b.add(box(3.27, 0.1, 0.22), C.roofDark, { p: [0, WALL_TOP + RISE + 0.1, 0] }, 0.05);

  // --- chimney ---------------------------------------------------------------
  const cx = 0.74, cz = -0.44;
  b.add(box(0.4, 1.15, 0.4), C.brick, { p: [cx, 2.76, cz] }, 0.09);
  b.add(box(0.5, 0.09, 0.5), C.stoneLight, { p: [cx, 3.36, cz] }, 0.04);
  b.add(cyl(0.075, 0.09, 0.17, 6), C.roofDark, { p: [cx - 0.08, 3.48, cz] }, 0.05);
  b.add(cyl(0.065, 0.08, 0.13, 6), C.roofDark, { p: [cx + 0.1, 3.46, cz + 0.04] }, 0.05);
  const chimney = new THREE.Vector3(cx, 3.6, cz);

  // --- door ------------------------------------------------------------------
  const dx = -0.5;
  b.add(box(0.52, 0.98, 0.06), C.woodDark, { p: [dx, 0.71, 1.02] }, 0.06);
  for (const o of [-0.13, 0, 0.13]) {
    b.add(box(0.012, 0.9, 0.012), C.wood, { p: [dx + o, 0.71, 1.053] });
  }
  for (const s of [-1, 1]) {
    b.add(box(0.075, 1.06, 0.11), C.woodLight, { p: [dx + s * 0.3, 0.75, 1.03] }, 0.05);
  }
  b.add(box(0.76, 0.09, 0.13), C.woodLight, { p: [dx, 1.29, 1.035] }, 0.05);
  b.add(ico(0.035, 0), C.brass, { p: [dx + 0.17, 0.68, 1.075] });
  panes.add(box(0.22, 0.2, 0.02), '#ffffff', { p: [dx, 0.98, 1.052] });
  b.add(box(0.26, 0.022, 0.03), C.wood, { p: [dx, 0.98, 1.06] });
  b.add(box(0.022, 0.24, 0.03), C.wood, { p: [dx, 0.98, 1.06] });
  glowSpots.push({ p: [dx, 0.98, 1.16], size: 0.75 });
  // Steps.
  b.add(box(0.84, 0.14, 0.34), C.stoneLight, { p: [dx, 0.15, 1.2] }, 0.04);
  b.add(box(1.0, 0.1, 0.32), C.stone, { p: [dx, 0.04, 1.45] }, 0.04);
  // Little porch roof on brackets.
  b.add(box(1.0, 0.07, 0.6), C.roof, { p: [dx, 1.5, 1.27], r: [0.4, 0, 0] }, 0.07);
  for (const s of [-1, 1]) {
    b.add(box(0.05, 0.05, 0.46), C.wood, { p: [dx + s * 0.42, 1.38, 1.2], r: [0.75, 0, 0] });
  }
  // Lantern beside the door.
  b.add(box(0.04, 0.04, 0.16), C.woodDark, { p: [0.0, 1.2, 1.07] });
  b.add(cone(0.085, 0.07, 4), C.woodDark, { p: [0.0, 1.17, 1.14], r: [0, Math.PI / 4, 0] });
  panes.add(box(0.085, 0.12, 0.085), '#ffffff', { p: [0.0, 1.075, 1.14] });
  b.add(box(0.1, 0.02, 0.1), C.woodDark, { p: [0.0, 1.005, 1.14] });
  glowSpots.push({ p: [0.0, 1.08, 1.2], size: 0.7 });

  // --- windows ---------------------------------------------------------------
  const addWindow = (
    face: Face,
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { shutters?: boolean; planter?: boolean } = {},
  ): void => {
    const at = (lx: number, ly: number, out: number) => onWall(face, x + lx, y + ly, out);
    panes.add(box(w, h, 0.03), '#ffffff', at(0, 0, 0.005));
    for (const s of [-1, 1]) {
      b.add(box(w + 0.13, 0.065, 0.08), C.woodLight, at(0, s * (h / 2 + 0.03), 0.02), 0.05);
      b.add(box(0.065, h + 0.13, 0.08), C.woodLight, at(s * (w / 2 + 0.03), 0, 0.02), 0.05);
    }
    b.add(box(0.03, h, 0.05), C.woodLight, at(0, 0, 0.02));
    b.add(box(w, 0.03, 0.05), C.woodLight, at(0, 0, 0.02));
    b.add(box(w + 0.26, 0.06, 0.17), C.stoneLight, at(0, -(h / 2 + 0.09), 0.06), 0.04);
    if (opts.shutters) {
      const sw = w * 0.44;
      for (const s of [-1, 1]) {
        const sx = s * (w / 2 + 0.085 + sw / 2);
        b.add(box(sw, h + 0.08, 0.04), C.shutter, at(sx, 0, 0.025), 0.05);
        for (const f of [-0.28, 0, 0.28]) {
          b.add(box(sw * 0.72, 0.02, 0.02), '#5b7a84', at(sx, f * h, 0.05));
        }
      }
    }
    if (opts.planter) {
      b.add(box(w + 0.14, 0.12, 0.17), C.wood, at(0, -(h / 2 + 0.2), 0.13), 0.05);
      const petals = [C.petalCoral, C.petalYellow, C.petalWhite, C.petalCoral, C.petalYellow];
      petals.forEach((color, i) => {
        const lx = lerp(-w / 2, w / 2, i / (petals.length - 1));
        b.add(ico(0.06, 0), C.leaf, at(lx + 0.03, -(h / 2 + 0.11), 0.13), 0.1);
        b.add(ico(0.045, 0), color, at(lx, -(h / 2 + 0.06), 0.15 + (i % 2) * 0.03));
      });
    }
    const spot = at(0, 0, 0.14);
    glowSpots.push({ p: spot.p, size: Math.max(w, h) * 2.6 });
  };

  addWindow('front', 0.62, 1.0, 0.56, 0.6, { shutters: true, planter: true });
  addWindow('right', 0, 1.0, 0.56, 0.6, { shutters: true });
  addWindow('right', 0, 2.02, 0.3, 0.3);
  addWindow('left', 0.1, 1.0, 0.56, 0.6, { shutters: true });
  addWindow('left', 0, 2.02, 0.3, 0.3);
  addWindow('back', -0.6, 1.0, 0.5, 0.56);
  addWindow('back', 0.6, 1.0, 0.5, 0.56);

  // --- assemble --------------------------------------------------------------
  const group = new THREE.Group();
  group.name = 'house';
  group.add(b.mesh(clay));

  const glass = new THREE.MeshStandardMaterial({
    color: '#5a7482',
    roughness: 0.3,
    metalness: 0,
    emissive: new THREE.Color(C.amber),
    emissiveIntensity: 0,
  });
  const paneMesh = panes.mesh(glass, false);
  paneMesh.receiveShadow = true;
  group.add(paneMesh);

  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: new THREE.Color('#ffb04a'),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0,
    toneMapped: false,
  });
  const glows = new THREE.Group();
  for (const spot of glowSpots) {
    const sprite = new THREE.Sprite(glowMat);
    sprite.position.set(spot.p[0], spot.p[1], spot.p[2]);
    sprite.scale.setScalar(spot.size);
    sprite.raycast = () => {};
    glows.add(sprite);
  }
  glows.visible = false;
  group.add(glows);

  // Warm spill onto the doorstep and garden.
  const lamp = new THREE.PointLight('#ffb25c', 0, 9, 1.8);
  lamp.position.set(-0.15, 1.15, 1.75);
  group.add(lamp);
  // A softer second pool for the gable side that faces the camera.
  const sideLamp = new THREE.PointLight('#ffb25c', 0, 6, 1.8);
  sideLamp.position.set(1.95, 1.1, 0);
  group.add(sideLamp);

  const glassOff = new THREE.Color('#5a7482');
  const glassOn = new THREE.Color('#ffd28a');

  return {
    group,
    chimney,
    setLight(on, prominence) {
      glass.emissiveIntensity = on * lerp(0.85, 2.4, prominence);
      glass.color.copy(glassOff).lerp(glassOn, on);
      glowMat.opacity = on * lerp(0.1, 0.5, prominence);
      glows.visible = on > 0.004;
      lamp.intensity = on * lerp(1.2, 9, prominence);
      sideLamp.intensity = on * lerp(0.5, 4, prominence);
      lamp.visible = sideLamp.visible = on > 0.004;
    },
  };
}
