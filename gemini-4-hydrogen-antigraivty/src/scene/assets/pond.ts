import * as THREE from 'three';
import { AtmosphereSample } from '../palette';
import { POND_CENTER, getIslandSurfaceHeight } from '../terrain';

export interface PondAssetHandle {
  group: THREE.Group;
  update(timeSec: number, rainFactor: number, atmosphere: AtmosphereSample, reducedMotion: boolean): void;
  dispose(): void;
}

function createPondShape(scale = 1): THREE.Shape {
  const shape = new THREE.Shape();
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const warp = 1 + 0.08 * Math.sin(3 * a + 0.6) + 0.05 * Math.cos(2 * a - 0.4);
    const x = Math.cos(a) * POND_CENTER.rx * warp * scale;
    const y = Math.sin(a) * POND_CENTER.rz * warp * scale;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

export function createPond(): PondAssetHandle {
  const group = new THREE.Group();
  group.name = 'island-pond';
  const disposables: Array<{ dispose(): void }> = [];

  // Deep muted basin floor beneath water
  const bedShape = createPondShape(0.95);
  const bedGeo = new THREE.ShapeGeometry(bedShape);
  bedGeo.rotateX(Math.PI / 2);
  const bedMat = new THREE.MeshStandardMaterial({
    color: '#325260',
    roughness: 0.95,
  });
  disposables.push(bedGeo, bedMat);

  const bedMesh = new THREE.Mesh(bedGeo, bedMat);
  bedMesh.position.set(POND_CENTER.x, POND_CENTER.waterY - 0.17, POND_CENTER.z);
  bedMesh.receiveShadow = true;
  group.add(bedMesh);

  // Translucent calm water surface
  const waterShape = createPondShape(1.03);
  const waterGeo = new THREE.ShapeGeometry(waterShape);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#528799',
    roughness: 0.16,
    metalness: 0.14,
    transparent: true,
    opacity: 0.85,
  });
  disposables.push(waterGeo, waterMat);

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.name = 'pond-water';
  waterMesh.position.set(POND_CENTER.x, POND_CENTER.waterY, POND_CENTER.z);
  waterMesh.receiveShadow = true;
  group.add(waterMesh);

  // Shoreline pebbles & river rocks placed precisely along the shore contour
  const pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
  const pebbleMatA = new THREE.MeshStandardMaterial({ color: '#8e847b', roughness: 0.9, flatShading: true });
  const pebbleMatB = new THREE.MeshStandardMaterial({ color: '#787169', roughness: 0.92, flatShading: true });
  disposables.push(pebbleGeo, pebbleMatA, pebbleMatB);

  const rockAngles = [0.15, 0.48, 0.9, 1.38, 1.85, 2.35, 2.75, 3.3, 3.85, 4.4, 4.95, 5.45, 5.95];
  rockAngles.forEach((angle, idx) => {
    const warp = 1 + 0.08 * Math.sin(3 * angle + 0.6) + 0.05 * Math.cos(2 * angle - 0.4);
    const rx = (POND_CENTER.rx * warp + 0.06 + (idx % 3) * 0.04) * Math.cos(angle);
    const rz = (POND_CENTER.rz * warp + 0.06 + (idx % 3) * 0.04) * Math.sin(angle);
    const x = POND_CENTER.x + rx;
    const z = POND_CENTER.z + rz;
    const y = getIslandSurfaceHeight(x, z);

    const rock = new THREE.Mesh(pebbleGeo, idx % 2 === 0 ? pebbleMatA : pebbleMatB);
    const sx = 0.12 + (idx % 4) * 0.045;
    const sy = 0.075 + (idx % 3) * 0.025;
    const sz = 0.11 + ((idx + 1) % 4) * 0.04;
    rock.scale.set(sx, sy, sz);
    rock.position.set(x, y + sy * 0.28, z);
    rock.rotation.set(0.1 * idx, angle * 1.4, 0.08);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  });

  // Cattails & reeds along the back-right edge of the pond
  const reedMat = new THREE.MeshStandardMaterial({ color: '#588647', roughness: 0.88 });
  const cattailMat = new THREE.MeshStandardMaterial({ color: '#6b4229', roughness: 0.9 });
  const reedGeo = new THREE.CylinderGeometry(0.011, 0.018, 0.46, 5);
  const headGeo = new THREE.CapsuleGeometry(0.024, 0.09, 4, 6);
  disposables.push(reedMat, cattailMat, reedGeo, headGeo);

  const reedClusters = [
    { angle: 5.55, offset: -0.05, hasHead: true, tilt: 0.12 },
    { angle: 5.66, offset: 0.02, hasHead: false, tilt: -0.09 },
    { angle: 5.78, offset: -0.02, hasHead: true, tilt: 0.08 },
    { angle: 2.18, offset: 0.03, hasHead: true, tilt: -0.1 },
    { angle: 2.28, offset: -0.03, hasHead: false, tilt: 0.14 },
  ];

  for (const rc of reedClusters) {
    const warp = 1 + 0.08 * Math.sin(3 * rc.angle + 0.6) + 0.05 * Math.cos(2 * rc.angle - 0.4);
    const x = POND_CENTER.x + Math.cos(rc.angle) * (POND_CENTER.rx * warp + rc.offset);
    const z = POND_CENTER.z + Math.sin(rc.angle) * (POND_CENTER.rz * warp + rc.offset);
    const y = Math.max(POND_CENTER.waterY - 0.08, getIslandSurfaceHeight(x, z));

    const stalk = new THREE.Mesh(reedGeo, reedMat);
    stalk.position.set(x, y + 0.21, z);
    stalk.rotation.z = rc.tilt;
    stalk.castShadow = true;
    group.add(stalk);

    if (rc.hasHead) {
      const head = new THREE.Mesh(headGeo, cattailMat);
      head.position.set(x - Math.sin(rc.tilt) * 0.17, y + 0.37, z);
      head.rotation.z = rc.tilt;
      head.castShadow = true;
      group.add(head);
    }
  }

  // Tiny wooden plank landing on the cottage-facing shoreline
  const dockGroup = new THREE.Group();
  const dockAngle = 3.35;
  const dockWarp = 1 + 0.08 * Math.sin(3 * dockAngle + 0.6) + 0.05 * Math.cos(2 * dockAngle - 0.4);
  const dockX = POND_CENTER.x + Math.cos(dockAngle) * (POND_CENTER.rx * dockWarp);
  const dockZ = POND_CENTER.z + Math.sin(dockAngle) * (POND_CENTER.rz * dockWarp);
  dockGroup.position.set(dockX, POND_CENTER.waterY + 0.06, dockZ);
  dockGroup.rotation.y = -dockAngle + Math.PI / 2;

  const plankMat = new THREE.MeshStandardMaterial({ color: '#9c6c45', roughness: 0.86 });
  const postMat = new THREE.MeshStandardMaterial({ color: '#6b472b', roughness: 0.9 });
  const plankGeo = new THREE.BoxGeometry(0.46, 0.04, 0.13);
  const postGeo = new THREE.CylinderGeometry(0.028, 0.032, 0.24, 6);
  disposables.push(plankMat, postMat, plankGeo, postGeo);

  for (let p = 0; p < 3; p++) {
    const plank = new THREE.Mesh(plankGeo, plankMat);
    plank.position.set(0, 0.02, -0.14 + p * 0.15);
    plank.castShadow = true;
    plank.receiveShadow = true;
    dockGroup.add(plank);
  }
  for (const px of [-0.19, 0.19]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(px, -0.05, 0.17);
    post.castShadow = true;
    dockGroup.add(post);
  }
  group.add(dockGroup);

  const clearWaterColor = new THREE.Color('#528799');
  const rainWaterColor = new THREE.Color('#3f6170');
  const nightWaterColor = new THREE.Color('#274359');
  const tmpColor = new THREE.Color();

  return {
    group,
    update(timeSec, rainFactor, atmosphere, reducedMotion) {
      const daylight = Math.max(0, Math.min(1, (atmosphere.sunIntensity - 0.55) / 1.5));
      tmpColor.copy(nightWaterColor).lerp(clearWaterColor, daylight);
      tmpColor.lerp(rainWaterColor, rainFactor * 0.65);
      waterMat.color.copy(tmpColor);
      waterMat.roughness = 0.14 + rainFactor * 0.12;

      if (!reducedMotion) {
        waterMesh.position.y = POND_CENTER.waterY + Math.sin(timeSec * 1.4) * 0.005;
      } else {
        waterMesh.position.y = POND_CENTER.waterY;
      }
    },
    dispose() {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
