import * as THREE from 'three';
import { M } from './materials';
import { LAYOUT } from './layout';
import type { Frame } from '../lib/frame';
import type { Island } from './island';

export interface House {
  group: THREE.Group;
  update(f: Frame): void;
}

const SMOKE_PUFFS = 7;

/** A small storybook cottage: the clickable centerpiece of the island. */
export function makeHouse(island: Island): House {
  const group = new THREE.Group();
  group.name = 'house';
  group.position.set(LAYOUT.house.x, island.topY(LAYOUT.house.x, LAYOUT.house.z) - 0.04, LAYOUT.house.z);
  group.rotation.y = LAYOUT.house.rotation;

  const add = (mesh: THREE.Mesh, shadow = true) => {
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    group.add(mesh);
    return mesh;
  };

  // --- walls, foundation, trim -----------------------------------------------
  add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 1.9), M.wall)).position.y = 0.75;
  add(new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.28, 2.02), M.stone)).position.y = 0.14;

  for (const [x, z] of [[-1.13, 0.93], [1.13, 0.93], [-1.13, -0.93], [1.13, -0.93]]) {
    const post = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.42, 0.14), M.woodDark));
    post.position.set(x, 0.77, z);
  }

  // --- roof: two plank slopes + ridge + wall gables ----------------------------
  const slope = new THREE.BoxGeometry(2.9, 0.09, 1.82);
  for (const side of [-1, 1]) {
    const plank = add(new THREE.Mesh(slope, M.roof));
    plank.position.set(side * 0.76, 1.98, 0);
    plank.rotation.z = -side * 0.58;
  }
  add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 3.0), M.roofDark)).position.set(0, 2.42, 0);

  const gableShape = new THREE.Shape();
  gableShape.moveTo(-1.15, 1.5);
  gableShape.lineTo(1.15, 1.5);
  gableShape.lineTo(0, 2.38);
  gableShape.closePath();
  const gableGeo = new THREE.ShapeGeometry(gableShape);
  const gableMat = M.wall.clone();
  gableMat.side = THREE.DoubleSide;
  const gableFront = add(new THREE.Mesh(gableGeo, gableMat), false);
  gableFront.position.z = 0.945;
  const gableBack = add(new THREE.Mesh(gableGeo, gableMat), false);
  gableBack.position.z = -0.945;

  // --- chimney ------------------------------------------------------------------
  const chimney = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.34), M.stone));
  chimney.position.set(0.68, 2.06, -0.5);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.09, 0.44), M.stoneDark)).position.set(0.68, 2.53, -0.5);

  // --- door, step, knob ----------------------------------------------------------
  add(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.98, 0.06), M.woodDark)).position.set(-0.38, 0.5, 0.96);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.88, 0.05), M.woodMid)).position.set(-0.38, 0.5, 0.985);
  const knob = add(new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), M.gold), false);
  knob.position.set(-0.2, 0.48, 1.018);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.55), M.stoneDark)).position.set(-0.38, 0.07, 1.25);

  // --- windows (shared emissive glass material) -----------------------------------
  const windowGeo = new THREE.BoxGeometry(0.5, 0.5, 0.07);
  const glassGeo = new THREE.BoxGeometry(0.4, 0.4, 0.075);
  const mullionV = new THREE.BoxGeometry(0.06, 0.38, 0.08);
  const mullionH = new THREE.BoxGeometry(0.38, 0.06, 0.08);

  const makeWindow = (): THREE.Group => {
    const w = new THREE.Group();
    const frame = new THREE.Mesh(windowGeo, M.woodDark);
    frame.castShadow = true;
    const pane = new THREE.Mesh(glassGeo, M.glass);
    const mv = new THREE.Mesh(mullionV, M.woodDark);
    const mh = new THREE.Mesh(mullionH, M.woodDark);
    w.add(frame, pane, mv, mh);
    return w;
  };

  const front = makeWindow();
  front.position.set(0.52, 0.88, 0.96);
  group.add(front);

  const side = makeWindow();
  side.position.set(-1.15, 0.88, 0.1);
  side.rotation.y = Math.PI / 2;
  group.add(side);

  const round = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), M.glass);
  round.position.set(0, 1.95, 0.952);
  group.add(round);
  const roundFrame = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 18), M.woodDark);
  roundFrame.position.set(0, 1.95, 0.955);
  group.add(roundFrame);

  // --- porch lantern -----------------------------------------------------------
  const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 7), M.woodDark));
  post.position.set(0.28, 0.28, 1.28);
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.15), M.glass);
  lampHead.position.set(0.28, 0.62, 1.28);
  group.add(lampHead);
  const lampCap = add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 4), M.roofDark));
  lampCap.position.set(0.28, 0.74, 1.28);
  lampCap.rotation.y = Math.PI / 4;

  // --- warm light spilling from the windows --------------------------------------
  const glowLight = new THREE.PointLight(0xffb066, 0, 7.5, 2);
  glowLight.position.set(0.1, 1.15, 1.35);
  group.add(glowLight);

  // --- chimney smoke (pooled puffs) ------------------------------------------------
  const smokeGeo = new THREE.SphereGeometry(1, 8, 6);
  const puffs: Array<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; offset: number }> = [];
  for (let i = 0; i < SMOKE_PUFFS; i++) {
    const mat = M.smoke.clone();
    const mesh = new THREE.Mesh(smokeGeo, mat);
    group.add(mesh);
    puffs.push({ mesh, mat, offset: i / SMOKE_PUFFS });
  }
  // wind direction rotated into the house's local frame
  const rot = -LAYOUT.house.rotation;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  return {
    group,
    update(f: Frame) {
      M.glass.emissiveIntensity = f.glow * 2.3;
      glowLight.intensity = f.glow * 3.2;

      const drift = f.wind * 1.15;
      const dx = f.windDir.x * cos - f.windDir.z * sin;
      const dz = f.windDir.x * sin + f.windDir.z * cos;
      const smokeScale = f.reducedMotion ? 0.45 : 1;
      const visibility = (0.35 + 0.65 * f.dayFactor) * smokeScale;

      for (const p of puffs) {
        const t = (f.time * 0.22 * smokeScale + p.offset) % 1;
        const wob = Math.sin(t * 9 + p.offset * 40) * 0.07 * t;
        p.mesh.position.set(
          0.68 + dx * t * (0.55 + drift) + wob,
          2.56 + t * 1.55,
          -0.5 + dz * t * (0.55 + drift) + wob * 0.6,
        );
        const s = 0.09 + t * 0.15;
        p.mesh.scale.setScalar(s);
        p.mat.opacity = t * (1 - t) * 4 * 0.42 * visibility;
      }
    },
  };
}
