import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight } from './island';
import * as M from './materials';

export interface WindmillBuild {
  group: THREE.Group;
  rotor: THREE.Group;
}

export function buildWindmill(): WindmillBuild {
  const group = new THREE.Group();

  // tapered tower with two trim bands
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46, 2.3, 14), M.cream);
  tower.position.y = 1.15;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const band1 = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.45, 0.09, 14), M.woodDark);
  band1.position.y = 0.62;
  group.add(band1);

  const band2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.37, 0.08, 14), M.woodDark);
  band2.position.y = 1.38;
  group.add(band2);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.62, 14), M.roof);
  cap.position.y = 2.58;
  cap.castShadow = true;
  group.add(cap);

  // little door facing the island
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.05), M.trim);
  doorFrame.position.set(0, 0.34, 0.42);
  group.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.5, 0.05), M.woodDark);
  door.position.set(0, 0.31, 0.445);
  group.add(door);

  // axle + hub
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.6, 8), M.woodDark);
  axle.rotation.x = Math.PI / 2;
  axle.position.set(0, 2.02, 0.38);
  group.add(axle);

  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), M.woodDark);
  hub.position.set(0, 2.02, 0.6);
  hub.castShadow = true;
  group.add(hub);

  // rotor: four canvas sails, wider at the tips, with wooden tip caps
  const rotor = new THREE.Group();
  rotor.position.set(0, 2.02, 0.68);

  const sailShape = new THREE.Shape();
  sailShape.moveTo(-0.07, 0);
  sailShape.lineTo(0.07, 0);
  sailShape.lineTo(0.15, 1.48);
  sailShape.lineTo(-0.15, 1.48);
  sailShape.closePath();

  const sailGeos: THREE.BufferGeometry[] = [];
  const tipGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const sail = new THREE.ExtrudeGeometry(sailShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 1,
    });
    sail.translate(0, 0.16, 0);
    sail.rotateZ((i * Math.PI) / 2);
    sailGeos.push(sail);

    const tip = new THREE.BoxGeometry(0.32, 0.13, 0.07);
    tip.translate(0, 1.44, 0);
    tip.rotateZ((i * Math.PI) / 2);
    tipGeos.push(tip);
  }

  const sails = new THREE.Mesh(mergeGeometries(sailGeos)!, M.sail);
  sails.castShadow = true;
  rotor.add(sails);

  const tips = new THREE.Mesh(mergeGeometries(tipGeos)!, M.woodDark);
  rotor.add(tips);

  group.add(rotor);

  // position on the island, sails facing the initial camera
  group.position.set(2.5, terrainHeight(2.5, -2.0) - 0.06, -2.0);
  group.rotation.y = 0.44;

  return { group, rotor };
}
