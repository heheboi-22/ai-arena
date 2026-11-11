import * as THREE from 'three';
import { WORLD } from '../palette';
import { HOUSE } from './layout';
import type { SharedMaterials } from './materials';

export interface House {
  group: THREE.Group;
  /** invisible box that makes taps on the house reliable */
  hitTarget: THREE.Mesh;
  chimneyTip: THREE.Object3D;
  pulse: () => void;
  update: (dt: number, lights: number, night: number, reduced: boolean) => void;
}

function makeWindow(mats: SharedMaterials, paneMat: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group();
  const w = 0.3, h = 0.34, t = 0.045, d = 0.06;
  const frameGeoH = new THREE.BoxGeometry(w + t * 2, t, d);
  const frameGeoV = new THREE.BoxGeometry(t, h, d);
  const top = new THREE.Mesh(frameGeoH, mats.woodDark);
  top.position.y = h / 2 + t / 2;
  const bottom = top.clone();
  bottom.position.y = -h / 2 - t / 2;
  const left = new THREE.Mesh(frameGeoV, mats.woodDark);
  left.position.x = -w / 2 - t / 2;
  const right = left.clone();
  right.position.x = w / 2 + t / 2;
  const muntinV = new THREE.Mesh(new THREE.BoxGeometry(0.028, h, d * 0.7), mats.woodDark);
  const muntinH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.028, d * 0.7), mats.woodDark);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paneMat);
  pane.position.z = 0.004;
  const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.04, 0.1), mats.woodDark);
  sill.position.set(0, -h / 2 - t - 0.015, 0.03);
  for (const m of [top, bottom, left, right, muntinV, muntinH, sill, pane]) {
    m.castShadow = m !== pane;
    g.add(m);
  }
  return g;
}

export function createHouse(mats: SharedMaterials, groundY: (x: number, z: number) => number): House {
  const group = new THREE.Group();
  group.position.set(HOUSE.x, groundY(HOUSE.x, HOUSE.z) - 0.02, HOUSE.z);
  group.rotation.y = HOUSE.rot;

  const creamMat = new THREE.MeshStandardMaterial({ color: WORLD.cream, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: WORLD.roof, roughness: 0.82, flatShading: true });
  const paneMat = new THREE.MeshStandardMaterial({
    color: WORLD.windowGlass,
    emissive: WORLD.windowGlow,
    emissiveIntensity: 0,
    roughness: 0.35,
  });

  // plinth + walls
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.16, 1.36), mats.stone);
  plinth.position.y = 0.08;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.2), creamMat);
  walls.position.y = 0.66;
  plinth.castShadow = walls.castShadow = true;
  plinth.receiveShadow = walls.receiveShadow = true;
  group.add(plinth, walls);

  // gable roof: caps (gable ends) cream, slopes terracotta
  const shape = new THREE.Shape();
  shape.moveTo(-0.95, 0);
  shape.lineTo(0.95, 0);
  shape.lineTo(0, 0.8);
  shape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.68, bevelEnabled: false });
  roofGeo.translate(0, 0, -0.84);
  const roof = new THREE.Mesh(roofGeo, [creamMat, roofMat]);
  roof.position.y = 1.16;
  roof.castShadow = true;
  group.add(roof);
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 1.74), mats.woodDark);
  ridge.position.y = 1.97;
  ridge.castShadow = true;
  group.add(ridge);

  // chimney
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.26), mats.stone);
  chimney.position.set(0.48, 1.62, -0.28);
  chimney.castShadow = true;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.36), mats.rockDeep);
  cap.position.set(0.48, 1.96, -0.28);
  group.add(chimney, cap);
  const chimneyTip = new THREE.Object3D();
  chimneyTip.position.set(0.48, 2.05, -0.28);
  group.add(chimneyTip);

  // door with rounded top
  const doorMat = new THREE.MeshStandardMaterial({
    color: WORLD.wood, roughness: 0.8, side: THREE.DoubleSide,
  });
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.56, 0.06), doorMat);
  door.position.set(0, 0.44, 0.615);
  const arch = new THREE.Mesh(new THREE.CircleGeometry(0.19, 14, 0, Math.PI), doorMat);
  arch.position.set(0, 0.72, 0.615);
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xd9b36a, roughness: 0.4, metalness: 0.4 }),
  );
  knob.position.set(0.12, 0.42, 0.655);
  const step = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.07, 0.3), mats.stone);
  step.position.set(0, 0.035, 0.76);
  door.castShadow = arch.castShadow = true;
  group.add(door, arch, knob, step);

  // windows: two flanking the door, one per side, one around the back
  const frontL = makeWindow(mats, paneMat);
  frontL.position.set(-0.44, 0.74, 0.6);
  const frontR = makeWindow(mats, paneMat);
  frontR.position.set(0.44, 0.74, 0.6);
  const sideL = makeWindow(mats, paneMat);
  sideL.position.set(-0.76, 0.74, 0.05);
  sideL.rotation.y = -Math.PI / 2;
  const sideR = makeWindow(mats, paneMat);
  sideR.position.set(0.76, 0.74, 0.05);
  sideR.rotation.y = Math.PI / 2;
  const back = makeWindow(mats, paneMat);
  back.position.set(0.1, 0.78, -0.6);
  back.rotation.y = Math.PI;
  group.add(frontL, frontR, sideL, sideR, back);

  // flower box under the right window
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.13), mats.woodDark);
  box.position.set(0.44, 0.5, 0.66);
  group.add(box);
  const petalMat = new THREE.MeshStandardMaterial({ color: WORLD.flowerPink, roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), petalMat);
    petal.position.set(0.36 + i * 0.08, 0.57, 0.66);
    group.add(petal);
  }

  // generous invisible tap target
  const hitTarget = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 2.4, 2.1),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hitTarget.position.y = 1.05;
  group.add(hitTarget);

  const glow = new THREE.PointLight(WORLD.windowGlow, 0, 7.5, 1.8);
  glow.position.set(0, 1.15, 1.5);
  group.add(glow);

  let pulseT = 0;

  return {
    group,
    hitTarget,
    chimneyTip,
    pulse: () => {
      pulseT = 1;
    },
    update(dt, lights, night, reduced) {
      paneMat.emissiveIntensity = lights * (1.7 + 1.9 * night);
      glow.intensity = lights * (0.55 + 1.5 * night);
      if (pulseT > 0) {
        pulseT = Math.max(0, pulseT - dt * 2.2);
        const bump = reduced ? 0.02 : 0.05;
        group.scale.setScalar(1 + bump * Math.sin(Math.min(pulseT, 1) * Math.PI));
      } else {
        group.scale.setScalar(1);
      }
    },
  };
}
