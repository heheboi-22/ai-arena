import * as THREE from 'three';
import type { WorldMaterials } from './materials';
import { WINDMILL_ANCHOR, getTerrainHeight } from './terrainMath';

export interface WindmillBundle {
  group: THREE.Group;
  update: (dt: number, windStrength: number, reducedMotion: boolean) => void;
  getBladeAngle: () => number;
  dispose: () => void;
}

const MAX_BLADE_SPEED_RAD_S = 3.2;

export function createWindmill(materials: WorldMaterials): WindmillBundle {
  const group = new THREE.Group();
  group.name = 'hilltop-windmill';

  const baseY = getTerrainHeight(WINDMILL_ANCHOR.x, WINDMILL_ANCHOR.z);
  group.position.set(WINDMILL_ANCHOR.x, baseY, WINDMILL_ANCHOR.z);
  group.rotation.y = WINDMILL_ANCHOR.rotationY;

  const geometries: THREE.BufferGeometry[] = [];
  const registerGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // --- Stone plinth embedded solidly into the knoll ---
  const plinth = new THREE.Mesh(
    registerGeo(new THREE.CylinderGeometry(0.72, 0.84, 0.72, 10)),
    materials.stoneMasonry,
  );
  plinth.position.y = -0.02;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // --- Tapered cream plaster tower ---
  const towerH = 2.08;
  const tower = new THREE.Mesh(
    registerGeo(new THREE.CylinderGeometry(0.45, 0.68, towerH, 10)),
    materials.cottageWall,
  );
  tower.position.y = 0.34 + towerH * 0.5;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  // Warm timber collar bands around tower
  const lowerRing = new THREE.Mesh(
    registerGeo(new THREE.TorusGeometry(0.66, 0.045, 7, 16)),
    materials.darkWood,
  );
  lowerRing.rotation.x = Math.PI / 2;
  lowerRing.position.y = 0.36;
  group.add(lowerRing);

  const upperRing = new THREE.Mesh(
    registerGeo(new THREE.TorusGeometry(0.48, 0.048, 7, 16)),
    materials.darkWood,
  );
  upperRing.rotation.x = Math.PI / 2;
  upperRing.position.y = 2.34;
  group.add(upperRing);

  // --- Small arched wooden door + stone threshold facing front ---
  const doorFrame = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.38, 0.58, 0.14)),
    materials.darkWood,
  );
  doorFrame.position.set(0, 0.58, 0.63);
  group.add(doorFrame);

  const doorWood = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.3, 0.52, 0.16)),
    materials.warmWood,
  );
  doorWood.position.set(0, 0.56, 0.64);
  doorWood.castShadow = true;
  group.add(doorWood);

  const doorStep = new THREE.Mesh(
    registerGeo(new THREE.BoxGeometry(0.5, 0.12, 0.28)),
    materials.steppingStone,
  );
  doorStep.position.set(0, 0.25, 0.76);
  doorStep.receiveShadow = true;
  group.add(doorStep);

  // --- Two small recessed tower windows ---
  const addTowerWindow = (angleY: number, y: number, r: number) => {
    const win = new THREE.Group();
    win.position.set(Math.sin(angleY) * r, y, Math.cos(angleY) * r);
    win.rotation.y = angleY;
    const frame = new THREE.Mesh(
      registerGeo(new THREE.BoxGeometry(0.24, 0.28, 0.08)),
      materials.darkWood,
    );
    const glass = new THREE.Mesh(
      registerGeo(new THREE.BoxGeometry(0.17, 0.21, 0.095)),
      materials.windmillGlass,
    );
    win.add(frame, glass);
    group.add(win);
  };
  addTowerWindow(0.85, 1.48, 0.55);
  addTowerWindow(-0.95, 1.65, 0.53);

  // --- Shingled conical cap + wooden finial ---
  const cap = new THREE.Mesh(
    registerGeo(new THREE.ConeGeometry(0.62, 0.86, 10)),
    materials.roofTile,
  );
  cap.position.y = 2.82;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  const finial = new THREE.Mesh(
    registerGeo(new THREE.CylinderGeometry(0.025, 0.045, 0.24, 6)),
    materials.darkWood,
  );
  finial.position.y = 3.32;
  group.add(finial);

  const finialBall = new THREE.Mesh(
    registerGeo(new THREE.SphereGeometry(0.055, 8, 8)),
    materials.brassAccent,
  );
  finialBall.position.y = 3.44;
  group.add(finialBall);

  // --- Extending wooden hub axle & 4 handcrafted lattice sails ---
  const hubY = 2.38;
  const hubPivot = new THREE.Group();
  hubPivot.position.set(0, hubY, 0.54);
  group.add(hubPivot);

  // Axle housing protruding out of cap
  const axle = new THREE.Mesh(
    registerGeo(new THREE.CylinderGeometry(0.095, 0.11, 0.52, 8)),
    materials.darkWood,
  );
  axle.rotation.x = Math.PI / 2;
  axle.position.z = -0.14;
  axle.castShadow = true;
  hubPivot.add(axle);

  // Front hub cap cone
  const nose = new THREE.Mesh(
    registerGeo(new THREE.ConeGeometry(0.125, 0.18, 8)),
    materials.warmWood,
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.16;
  nose.castShadow = true;
  hubPivot.add(nose);

  // Reusable blade geometries
  const sparLen = 1.28;
  const sparGeo = registerGeo(new THREE.BoxGeometry(0.058, sparLen, 0.05));
  const sailFrameOuterGeo = registerGeo(new THREE.BoxGeometry(0.03, 0.94, 0.03));
  const rungGeo = registerGeo(new THREE.BoxGeometry(0.28, 0.026, 0.024));
  const clothGeo = registerGeo(new THREE.PlaneGeometry(0.26, 0.88));

  for (let i = 0; i < 4; i++) {
    const bladeHolder = new THREE.Group();
    bladeHolder.rotation.z = (i * Math.PI) / 2 + 0.35;

    // Slight aerodynamic pitch on each sail so light plays across the wooden lattice
    const bladePitch = new THREE.Group();
    bladePitch.rotation.y = 0.18;

    const spar = new THREE.Mesh(sparGeo, materials.darkWood);
    spar.position.y = sparLen * 0.5;
    spar.castShadow = true;
    bladePitch.add(spar);

    const outerRail = new THREE.Mesh(sailFrameOuterGeo, materials.warmWood);
    outerRail.position.set(0.27, 0.78, 0);
    outerRail.castShadow = true;
    bladePitch.add(outerRail);

    // Cross lattice rungs
    for (let r = 0; r < 5; r++) {
      const rung = new THREE.Mesh(rungGeo, materials.warmWood);
      rung.position.set(0.14, 0.34 + r * 0.215, 0);
      bladePitch.add(rung);
    }

    // Warm cream linen sail panel
    const cloth = new THREE.Mesh(clothGeo, materials.windmillLinen);
    cloth.position.set(0.14, 0.78, 0.016);
    cloth.castShadow = true;
    cloth.receiveShadow = true;
    bladePitch.add(cloth);

    bladeHolder.add(bladePitch);
    hubPivot.add(bladeHolder);
  }

  let bladeAngle = 0.35;

  const update: WindmillBundle['update'] = (dt, windStrength, reducedMotion) => {
    // At zero wind, windmill comes to a complete stop; scales smoothly with shared wind
    const motionScale = reducedMotion ? 0.35 : 1.0;
    const speed = windStrength * MAX_BLADE_SPEED_RAD_S * motionScale;
    bladeAngle = (bladeAngle - speed * dt) % (Math.PI * 2);
    hubPivot.rotation.z = bladeAngle;
  };

  return {
    group,
    update,
    getBladeAngle: () => bladeAngle,
    dispose: () => {
      for (const geo of geometries) {
        geo.dispose();
      }
    },
  };
}
