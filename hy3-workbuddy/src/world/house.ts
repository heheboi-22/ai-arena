import * as THREE from 'three';
import { GROUND_Y } from '../config';

export interface House {
  group: THREE.Group;
  /** Drive the lit/unlit appearance. `glow` is 0..1 (smoothed). */
  setLights: (glow: number) => void;
}

interface WindowSpec {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

function buildWindow(
  parent: THREE.Group,
  spec: WindowSpec,
  glassMats: THREE.MeshStandardMaterial[]
): void {
  const w = new THREE.Group();
  w.position.set(spec.x, spec.y, spec.z);
  w.rotation.y = spec.rotY;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.58, 0.1),
    new THREE.MeshStandardMaterial({ color: '#6c4a32', roughness: 0.8 })
  );
  frame.castShadow = true;
  w.add(frame);

  const glassMat = new THREE.MeshStandardMaterial({
    color: '#26303f',
    emissive: new THREE.Color('#ffb24d'),
    emissiveIntensity: 0,
    roughness: 0.25,
    metalness: 0.0,
  });
  glassMats.push(glassMat);

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), glassMat);
  glass.position.z = 0.055;
  w.add(glass);

  // A muntin cross so the lit window reads as a window, not a screen.
  const barMat = new THREE.MeshStandardMaterial({ color: '#6c4a32', roughness: 0.8 });
  const barV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.02), barMat);
  barV.position.z = 0.06;
  w.add(barV);
  const barH = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.02), barMat);
  barH.position.z = 0.06;
  w.add(barH);

  parent.add(w);
}

/**
 * A small, recognizable storybook house: plinth, walls, pyramid roof,
 * door, framed windows, and a chimney. Windows + an interior light are
 * toggled together so the click and the UI button stay in sync.
 */
export function createHouse(): House {
  const group = new THREE.Group();
  const glassMats: THREE.MeshStandardMaterial[] = [];

  // Stone plinth
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(2.85, 0.28, 2.35),
    new THREE.MeshStandardMaterial({ color: '#c9c2b0', roughness: 0.95 })
  );
  plinth.position.y = GROUND_Y + 0.14;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Walls
  const wallH = 1.7;
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, wallH, 2.1),
    new THREE.MeshStandardMaterial({ color: '#efe2c4', roughness: 0.85 })
  );
  walls.position.y = GROUND_Y + 0.28 + wallH / 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Roof (4-sided pyramid)
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(2.0, 1.15, 4, 1),
    new THREE.MeshStandardMaterial({ color: '#b9563b', roughness: 0.8 })
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = GROUND_Y + 0.28 + wallH + 1.15 / 2 - 0.02;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Chimney
  const chimney = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.95, 0.34),
    new THREE.MeshStandardMaterial({ color: '#8a4a3a', roughness: 0.9 })
  );
  chimney.position.set(0.7, GROUND_Y + 0.28 + wallH + 0.45, -0.35);
  chimney.castShadow = true;
  group.add(chimney);
  const chimneyCap = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.12, 0.42),
    new THREE.MeshStandardMaterial({ color: '#6f3a2e', roughness: 0.9 })
  );
  chimneyCap.position.set(0.7, GROUND_Y + 0.28 + wallH + 0.9, -0.35);
  group.add(chimneyCap);

  // Door
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.05, 0.1),
    new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.75 })
  );
  door.position.set(0, GROUND_Y + 0.28 + 0.52, 1.05 + 0.02);
  door.castShadow = true;
  group.add(door);
  // door knob
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 12),
    new THREE.MeshStandardMaterial({ color: '#e8c87a', roughness: 0.4, metalness: 0.4 })
  );
  knob.position.set(0.18, GROUND_Y + 0.28 + 0.52, 1.13);
  group.add(knob);

  // Windows (front two, one on the right side)
  buildWindow(group, { x: -0.78, y: GROUND_Y + 0.28 + 1.05, z: 1.06, rotY: 0 }, glassMats);
  buildWindow(group, { x: 0.78, y: GROUND_Y + 0.28 + 1.05, z: 1.06, rotY: 0 }, glassMats);
  buildWindow(group, { x: 1.32, y: GROUND_Y + 0.28 + 1.05, z: 0, rotY: Math.PI / 2 }, glassMats);

  // Interior light (off until toggled)
  const light = new THREE.PointLight('#ffb24d', 0, 8, 2);
  light.position.set(0, GROUND_Y + 1.1, 0);
  group.add(light);

  const setLights = (glow: number): void => {
    for (const m of glassMats) {
      m.emissiveIntensity = glow * 1.7;
      m.color.setRGB(
        0.15 + glow * 0.55,
        0.19 + glow * 0.4,
        0.25 + glow * 0.05
      );
    }
    light.intensity = glow * 2.4;
  };

  return { group, setLights };
}
