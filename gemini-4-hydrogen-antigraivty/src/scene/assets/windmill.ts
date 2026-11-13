import * as THREE from 'three';
import { ProceduralTextures } from '../textures';
import { WINDMILL_ANCHOR, getIslandSurfaceHeight } from '../terrain';

export interface WindmillAssetHandle {
  group: THREE.Group;
  update(dt: number, windFactor: number): void;
  getRotorAngle(): number;
  dispose(): void;
}

export function createWindmill(textures: ProceduralTextures): WindmillAssetHandle {
  const group = new THREE.Group();
  group.name = 'island-windmill';

  const baseY = getIslandSurfaceHeight(WINDMILL_ANCHOR.x, WINDMILL_ANCHOR.z);
  group.position.set(WINDMILL_ANCHOR.x, baseY, WINDMILL_ANCHOR.z);
  group.rotation.y = WINDMILL_ANCHOR.rotationY;

  const disposables: Array<{ dispose(): void }> = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  const stoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#8a7f78',
      map: textures.stoneMap,
      roughness: 0.92,
      flatShading: true,
    })
  );
  const plasterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f0e6d2',
      map: textures.plasterMap,
      roughness: 0.88,
    })
  );
  const woodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#7f502f',
      map: textures.woodMap,
      roughness: 0.85,
    })
  );
  const roofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#6b4733',
      map: textures.roofMap,
      roughness: 0.86,
    })
  );
  const sailClothMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f5efe1',
      roughness: 0.82,
      side: THREE.DoubleSide,
    })
  );
  const windowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#5b6f80',
      roughness: 0.35,
    })
  );

  // Stone base plinth sunk firmly into the knoll
  const basePlinth = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.62, 0.72, 0.65, 8)), stoneMat);
  basePlinth.position.y = 0.1;
  basePlinth.castShadow = true;
  basePlinth.receiveShadow = true;
  group.add(basePlinth);

  // Tapered cream plaster tower
  const tower = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.58, 1.72, 8)), plasterMat);
  tower.position.y = 1.24;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  // Wooden collar ring
  const collar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.46, 0.46, 0.1, 8)), woodMat);
  collar.position.y = 2.08;
  collar.castShadow = true;
  group.add(collar);

  // Conical shingle cap
  const cap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.56, 0.68, 8)), roofMat);
  cap.position.y = 2.45;
  cap.castShadow = true;
  group.add(cap);

  // Miniature arched wooden door & round window
  const door = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.42, 0.08)), woodMat);
  door.position.set(0, 0.48, 0.54);
  door.castShadow = true;
  group.add(door);

  const windowRing = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10)), woodMat);
  windowRing.rotation.x = Math.PI / 2;
  windowRing.position.set(0, 1.38, 0.47);
  group.add(windowRing);

  const windowPane = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.08, 0.07, 10)), windowMat);
  windowPane.rotation.x = Math.PI / 2;
  windowPane.position.set(0, 1.38, 0.47);
  group.add(windowPane);

  // Rotor hub & axle housing
  const hubHousing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.22, 0.35)), woodMat);
  hubHousing.position.set(0, 2.06, 0.42);
  hubHousing.castShadow = true;
  group.add(hubHousing);

  const rotorGroup = new THREE.Group();
  rotorGroup.name = 'windmill-rotor';
  rotorGroup.position.set(0, 2.06, 0.63);
  rotorGroup.rotation.z = 0.32;
  group.add(rotorGroup);

  const noseCone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.11, 0.22, 8)), woodMat);
  noseCone.rotation.x = Math.PI / 2;
  noseCone.position.z = 0.06;
  noseCone.castShadow = true;
  rotorGroup.add(noseCone);

  // 4 detailed wooden sail blades
  const sparGeo = trackGeo(new THREE.BoxGeometry(0.045, 1.32, 0.045));
  const railGeo = trackGeo(new THREE.BoxGeometry(0.025, 1.04, 0.025));
  const rungGeo = trackGeo(new THREE.BoxGeometry(0.27, 0.024, 0.022));
  const sailGeo = trackGeo(new THREE.PlaneGeometry(0.24, 0.98));

  for (let i = 0; i < 4; i++) {
    const bladeArm = new THREE.Group();
    bladeArm.rotation.z = (i * Math.PI) / 2;

    const bladePitch = new THREE.Group();
    // Slight realistic aerodynamic twist
    bladePitch.rotation.y = 0.16;

    const spar = new THREE.Mesh(sparGeo, woodMat);
    spar.position.y = 0.68;
    spar.castShadow = true;
    bladePitch.add(spar);

    const outerRail = new THREE.Mesh(railGeo, woodMat);
    outerRail.position.set(0.26, 0.78, 0);
    outerRail.castShadow = true;
    bladePitch.add(outerRail);

    for (let r = 0; r < 5; r++) {
      const rung = new THREE.Mesh(rungGeo, woodMat);
      rung.position.set(0.13, 0.3 + r * 0.24, 0);
      bladePitch.add(rung);
    }

    const sail = new THREE.Mesh(sailGeo, sailClothMat);
    sail.position.set(0.135, 0.78, 0.014);
    sail.castShadow = true;
    sail.receiveShadow = true;
    bladePitch.add(sail);

    bladeArm.add(bladePitch);
    rotorGroup.add(bladeArm);
  }

  return {
    group,
    update(dt, windFactor) {
      const w = Math.max(0, Math.min(1, windFactor));
      if (w > 0 && dt > 0) {
        rotorGroup.rotation.z -= dt * w * 2.8;
      }
    },
    getRotorAngle() {
      return rotorGroup.rotation.z;
    },
    dispose() {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
