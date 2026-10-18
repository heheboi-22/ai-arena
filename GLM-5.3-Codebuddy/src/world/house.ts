import * as THREE from 'three';
import { paintGeometry, mergePainted, Rng } from '../util';
import * as M from './materials';

export interface HouseBuild {
  group: THREE.Group;
  glassMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  /** Chimney mouth in house-local space (converted to world after placement). */
  chimneyLocal: THREE.Vector3;
  hitMeshes: THREE.Object3D[];
}

const soot = new THREE.MeshStandardMaterial({ color: 0x2a2226, roughness: 1 });
const brass = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.35, metalness: 0.7 });
const petals = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });

/** One window: frame + glowing glass + mullions + sill, merged by material. */
function addWindow(
  x: number,
  y: number,
  z: number,
  rotY: number,
  w: number,
  h: number,
  frames: THREE.BufferGeometry[],
  glasses: THREE.BufferGeometry[],
): void {
  const frame = new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.06);
  const sill = new THREE.BoxGeometry(w + 0.2, 0.06, 0.11);
  sill.translate(0, -(h / 2 + 0.06), 0.03);
  const mullionV = new THREE.BoxGeometry(0.04, h, 0.045);
  const mullionH = new THREE.BoxGeometry(w, 0.04, 0.045);
  mullionV.translate(0, 0, 0.024);
  mullionH.translate(0, 0, 0.024);
  const glass = new THREE.BoxGeometry(w, h, 0.035);
  glass.translate(0, 0, 0.012);

  for (const g of [frame, sill, mullionV, mullionH]) {
    g.rotateY(rotY);
    g.translate(x, y, z);
    frames.push(g);
  }
  glass.rotateY(rotY);
  glass.translate(x, y, z);
  glasses.push(glass);
}

/** Little window box with three blooms, merged with vertex colors. */
function addFlowerBox(
  x: number,
  y: number,
  z: number,
  rotY: number,
  woodGeos: THREE.BufferGeometry[],
  bloomGeos: THREE.BufferGeometry[],
  rng: Rng,
): void {
  const box = new THREE.BoxGeometry(0.6, 0.13, 0.2);
  box.rotateY(rotY);
  box.translate(x, y, z);
  woodGeos.push(box);

  const colors = [0xff8f6b, 0xffd97a, 0xf5f2ea, 0xf4a6c0];
  const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  for (let i = 0; i < 4; i++) {
    const r = 0.038 + rng.next() * 0.018;
    const bloom = new THREE.SphereGeometry(r, 8, 6);
    const p = new THREE.Vector3(x, y, z)
      .addScaledVector(right, (i - 1.5) * 0.14)
      .addScaledVector(forward, 0.05)
      .add(new THREE.Vector3(0, 0.09, 0));
    bloom.translate(p.x, p.y, p.z);
    paintGeometry(bloom, colors[Math.floor(rng.next() * colors.length)], 0.1);
    bloomGeos.push(bloom);
  }
  // a couple of leaves peeking out
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.SphereGeometry(0.03, 6, 5);
    const p = new THREE.Vector3(x, y, z)
      .addScaledVector(right, (rng.next() - 0.5) * 0.5)
      .addScaledVector(forward, 0.12)
      .add(new THREE.Vector3(0, 0.05, 0));
    leaf.scale(1, 0.55, 1);
    leaf.translate(p.x, p.y, p.z);
    paintGeometry(leaf, 0x5a8f4c, 0.12);
    bloomGeos.push(leaf);
  }
}

export function buildHouse(): HouseBuild {
  const rng = new Rng(42);
  const group = new THREE.Group();

  const frames: THREE.BufferGeometry[] = [];
  const glasses: THREE.BufferGeometry[] = [];
  const woodGeos: THREE.BufferGeometry[] = [];
  const bloomGeos: THREE.BufferGeometry[] = [];
  const hitMeshes: THREE.Object3D[] = [];

  const add = (mesh: THREE.Mesh, cast = true, receive = true) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    group.add(mesh);
    return mesh;
  };

  // plinth + walls
  const plinthGeo = new THREE.BoxGeometry(2.3, 0.16, 1.9);
  paintGeometry(plinthGeo, 0x8d857a, 0.08);
  hitMeshes.push(add(new THREE.Mesh(plinthGeo, M.stone)));

  const walls = add(new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.36, 1.7), M.cream));
  walls.position.set(0, 0.82, 0);
  hitMeshes.push(walls);

  // gable roof: triangular prism, ridge along X, beveled edges
  const shape = new THREE.Shape();
  shape.moveTo(-1.15, 0);
  shape.lineTo(1.15, 0);
  shape.lineTo(0, 1.0);
  shape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 2.42,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.045,
    bevelSegments: 2,
  });
  roofGeo.rotateY(Math.PI / 2);
  roofGeo.translate(-1.21, 1.52, 0);
  const roofMesh = add(new THREE.Mesh(roofGeo, M.roof));
  hitMeshes.push(roofMesh);

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.09, 0.15), M.woodDark);
  ridge.position.set(0, 2.57, 0);
  add(ridge);

  // chimney on the back slope
  const chimney = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.85, 0.34), M.brick));
  chimney.position.set(-0.62, 2.5, -0.35);
  hitMeshes.push(chimney);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.46), M.stone);
  paintGeometry(cap.geometry, 0x8d857a, 0.06);
  cap.position.set(-0.62, 2.97, -0.35);
  add(cap);
  const flue = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.2), soot);
  flue.position.set(-0.62, 3.02, -0.35);
  add(flue, false, false);

  // front door with frame, knob and a stone step
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.14, 0.06), M.trim);
  doorFrame.position.set(-0.45, 0.71, 0.865);
  hitMeshes.push(add(doorFrame));

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.98, 0.05), M.woodDark);
  door.position.set(-0.45, 0.63, 0.875);
  hitMeshes.push(add(door));

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), brass);
  knob.position.set(-0.27, 0.62, 0.91);
  add(knob, false, false);

  const stepGeo = new THREE.BoxGeometry(0.8, 0.09, 0.42);
  paintGeometry(stepGeo, 0x9a9288, 0.07);
  const step = new THREE.Mesh(stepGeo, M.stone);
  step.position.set(-0.45, 0.05, 1.1);
  add(step);

  // windows (glass shares one emissive material so the whole house glows together)
  addWindow(0.55, 0.98, 0.86, 0, 0.52, 0.6, frames, glasses);
  addWindow(1.06, 0.98, 0, Math.PI / 2, 0.52, 0.6, frames, glasses);
  addWindow(-1.06, 0.98, 0, -Math.PI / 2, 0.4, 0.5, frames, glasses);
  addWindow(0.35, 1.05, -0.86, Math.PI, 0.4, 0.5, frames, glasses);

  addFlowerBox(0.55, 0.56, 0.99, 0, woodGeos, bloomGeos, rng);
  addFlowerBox(1.19, 0.56, 0, Math.PI / 2, woodGeos, bloomGeos, rng);

  const frameMesh = new THREE.Mesh(mergePainted(frames), M.trim);
  group.add(frameMesh);
  hitMeshes.push(frameMesh);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2c3a46,
    roughness: 0.16,
    metalness: 0.3,
    emissive: 0xffb45e,
    emissiveIntensity: 0,
  });
  const glassMesh = new THREE.Mesh(mergePainted(glasses), glassMat);
  group.add(glassMesh);

  const woodMesh = new THREE.Mesh(mergePainted(woodGeos), M.wood);
  group.add(woodMesh);

  const bloomMesh = new THREE.Mesh(mergePainted(bloomGeos), petals);
  group.add(bloomMesh);

  // warm porch light, intensity driven by the environment system
  const light = new THREE.PointLight(0xffc37e, 0, 7.5, 2);
  light.position.set(0, 1.25, 1.5);
  group.add(light);

  return {
    group,
    glassMat,
    light,
    chimneyLocal: new THREE.Vector3(-0.62, 3.06, -0.35),
    hitMeshes,
  };
}
