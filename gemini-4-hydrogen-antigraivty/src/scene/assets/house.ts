import * as THREE from 'three';
import { AtmosphereSample } from '../palette';
import { ProceduralTextures } from '../textures';
import { HOUSE_ANCHOR, getIslandSurfaceHeight } from '../terrain';

export interface HouseAssetHandle {
  group: THREE.Group;
  hitTargets: THREE.Object3D[];
  update(
    dt: number,
    lightFactor: number,
    atmosphere: AtmosphereSample,
    reducedMotion: boolean
  ): void;
  getWindowEmissiveIntensity(): number;
  getLightIntensity(): number;
  dispose(): void;
}

function createWindowAssembly(
  width: number,
  height: number,
  frameMat: THREE.Material,
  glassMat: THREE.Material
): THREE.Group {
  const win = new THREE.Group();
  const depth = 0.08;

  const pane = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.04), glassMat);
  pane.position.z = 0.01;
  win.add(pane);

  const barThickness = 0.036;
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, barThickness, depth), frameMat);
  topFrame.position.y = height / 2 + barThickness * 0.35;
  win.add(topFrame);

  const botFrame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.11, barThickness * 1.15, depth + 0.03), frameMat);
  botFrame.position.y = -height / 2 - barThickness * 0.35;
  botFrame.position.z = 0.012;
  win.add(botFrame);

  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(barThickness, height, depth), frameMat);
  leftFrame.position.x = -width / 2 - barThickness * 0.35;
  win.add(leftFrame);

  const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(barThickness, height, depth), frameMat);
  rightFrame.position.x = width / 2 + barThickness * 0.35;
  win.add(rightFrame);

  // Inner mullions
  const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.022, height, 0.05), frameMat);
  vBar.position.z = 0.025;
  win.add(vBar);

  const hBar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.022, 0.05), frameMat);
  hBar.position.z = 0.025;
  win.add(hBar);

  return win;
}

export function createHouse(textures: ProceduralTextures): HouseAssetHandle {
  const group = new THREE.Group();
  group.name = 'cottage-house';

  const baseY = getIslandSurfaceHeight(HOUSE_ANCHOR.x, HOUSE_ANCHOR.z);
  group.position.set(HOUSE_ANCHOR.x, baseY, HOUSE_ANCHOR.z);
  group.rotation.y = HOUSE_ANCHOR.rotationY;

  const disposables: Array<{ dispose(): void }> = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  // Materials
  const stoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#8f847c',
      map: textures.stoneMap,
      roughness: 0.92,
      flatShading: true,
    })
  );
  const plasterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#f2e8d4',
      map: textures.plasterMap,
      roughness: 0.88,
    })
  );
  const darkTimberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#6b442a',
      map: textures.woodMap,
      roughness: 0.86,
    })
  );
  const warmWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#9c663d',
      map: textures.woodMap,
      roughness: 0.84,
    })
  );
  const roofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#c76246',
      map: textures.roofMap,
      roughness: 0.82,
    })
  );
  const ridgeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#9a4631',
      roughness: 0.85,
    })
  );
  const chimneyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#b87660',
      map: textures.stoneMap,
      roughness: 0.9,
    })
  );
  const brassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#ddb15b',
      roughness: 0.35,
      metalness: 0.7,
    })
  );
  const glassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#607587',
      emissive: new THREE.Color('#ffad3b'),
      emissiveIntensity: 0,
      roughness: 0.25,
      metalness: 0.1,
    })
  );
  const lanternBulbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#dcd4c0',
      emissive: new THREE.Color('#ffc458'),
      emissiveIntensity: 0,
      roughness: 0.3,
    })
  );

  // 1. Stone foundation plinth embedded safely into terrain
  const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.62, 0.42, 1.32)), stoneMat);
  plinth.position.set(0, 0.0, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Front stone step slab
  const stepSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.14, 0.34)), stoneMat);
  stepSlab.position.set(-0.26, 0.1, 0.77);
  stepSlab.castShadow = true;
  stepSlab.receiveShadow = true;
  group.add(stepSlab);

  // 2. Main cream plaster body
  const wallW = 1.46;
  const wallH = 0.92;
  const wallD = 1.16;
  const body = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(wallW, wallH, wallD)), plasterMat);
  body.position.set(0, 0.21 + wallH / 2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Corner timber beams & horizontal sill trim
  const postGeo = trackGeo(new THREE.BoxGeometry(0.085, wallH + 0.02, 0.085));
  const corners: Array<[number, number]> = [
    [-wallW / 2 + 0.02, -wallD / 2 + 0.02],
    [wallW / 2 - 0.02, -wallD / 2 + 0.02],
    [-wallW / 2 + 0.02, wallD / 2 - 0.02],
    [wallW / 2 - 0.02, wallD / 2 - 0.02],
  ];
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(postGeo, darkTimberMat);
    post.position.set(cx, 0.21 + wallH / 2, cz);
    post.castShadow = true;
    group.add(post);
  }

  const sillBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(wallW + 0.04, 0.07, wallD + 0.04)), darkTimberMat);
  sillBeam.position.set(0, 0.22, 0);
  sillBeam.castShadow = true;
  group.add(sillBeam);

  // 3. Pitched gable walls (extruded triangle matching exact roof slope)
  const roofPeakH = 0.72;
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-wallD / 2, 0);
  gableShape.lineTo(wallD / 2, 0);
  gableShape.lineTo(0, roofPeakH);
  gableShape.closePath();

  const gableGeo = trackGeo(
    new THREE.ExtrudeGeometry(gableShape, {
      depth: wallW,
      bevelEnabled: false,
    })
  );
  gableGeo.rotateY(Math.PI / 2);
  gableGeo.translate(-wallW / 2, 0.21 + wallH, 0);
  const gableMesh = new THREE.Mesh(gableGeo, plasterMat);
  gableMesh.castShadow = true;
  gableMesh.receiveShadow = true;
  group.add(gableMesh);

  // Timber gable collar trim on left & right gable ends
  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.07, wallD * 0.72)), darkTimberMat);
    beam.position.set(side * (wallW / 2 + 0.005), 0.21 + wallH + 0.16, 0);
    group.add(beam);
  }

  // 4. Terracotta pitched roof slopes + ridge cap
  const slopeRun = wallD / 2 + 0.2;
  const slopeAngle = Math.atan2(roofPeakH, wallD / 2);
  const slopeLen = Math.hypot(wallD / 2, roofPeakH) + 0.24;
  const roofWidth = wallW + 0.34;

  const slopeGeo = trackGeo(new THREE.BoxGeometry(roofWidth, 0.08, slopeLen));
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(slopeGeo, roofMat);
    const midY = 0.21 + wallH + roofPeakH / 2 - 0.01;
    const midZ = side * (slopeRun * 0.44);
    slope.position.set(0, midY, midZ);
    slope.rotation.x = side * slopeAngle;
    slope.castShadow = true;
    slope.receiveShadow = true;
    group.add(slope);
  }

  const ridgeCap = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.058, 0.058, roofWidth + 0.04, 8)), ridgeMat);
  ridgeCap.rotation.z = Math.PI / 2;
  ridgeCap.position.set(0, 0.21 + wallH + roofPeakH + 0.02, 0);
  ridgeCap.castShadow = true;
  group.add(ridgeCap);

  // 5. Chimney + subtle smoke puffs
  const chimney = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.68, 0.24)), chimneyMat);
  chimney.position.set(-0.38, 0.21 + wallH + 0.56, -0.25);
  chimney.castShadow = true;
  chimney.receiveShadow = true;
  group.add(chimney);

  const chimneyRim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.07, 0.3)), stoneMat);
  chimneyRim.position.set(-0.38, 0.21 + wallH + 0.92, -0.25);
  chimneyRim.castShadow = true;
  group.add(chimneyRim);

  const smokePuffs: Array<{ mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; phase: number }> = [];
  const puffGeo = trackGeo(new THREE.IcosahedronGeometry(0.085, 1));
  for (let i = 0; i < 3; i++) {
    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#f2efe9',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        roughness: 1,
      })
    );
    const puff = new THREE.Mesh(puffGeo, mat);
    puff.position.set(-0.38, 0.21 + wallH + 1.05 + i * 0.18, -0.25);
    group.add(puff);
    smokePuffs.push({ mesh: puff, mat, phase: i / 3 });
  }

  // 6. Front Door & Porch Awning & Hanging Lantern
  const doorFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.56, 0.06)), darkTimberMat);
  doorFrame.position.set(-0.26, 0.21 + 0.28, wallD / 2 + 0.015);
  group.add(doorFrame);

  const doorLeaf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.29, 0.5, 0.065)), warmWoodMat);
  doorLeaf.position.set(-0.26, 0.21 + 0.26, wallD / 2 + 0.025);
  doorLeaf.castShadow = true;
  group.add(doorLeaf);

  const knob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.024, 8, 8)), brassMat);
  knob.position.set(-0.16, 0.21 + 0.25, wallD / 2 + 0.068);
  group.add(knob);

  // Small porch canopy over the front door
  const porchRoof = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.56, 0.055, 0.36)), roofMat);
  porchRoof.position.set(-0.26, 0.21 + 0.64, wallD / 2 + 0.16);
  porchRoof.rotation.x = 0.28;
  porchRoof.castShadow = true;
  group.add(porchRoof);

  const porchPostGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.028, 0.52, 6));
  for (const px of [-0.49, -0.03]) {
    const pPost = new THREE.Mesh(porchPostGeo, darkTimberMat);
    pPost.position.set(px, 0.21 + 0.27, wallD / 2 + 0.27);
    pPost.castShadow = true;
    group.add(pPost);
  }

  // Tiny porch lantern
  const lanternCap = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.055, 0.045, 6)), darkTimberMat);
  lanternCap.position.set(-0.03, 0.21 + 0.53, wallD / 2 + 0.33);
  group.add(lanternCap);
  const lanternBulb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.036, 8, 8)), lanternBulbMat);
  lanternBulb.position.set(-0.03, 0.21 + 0.49, wallD / 2 + 0.33);
  group.add(lanternBulb);

  // 7. Windows + Flower Box
  // Front right window
  const frontWindow = createWindowAssembly(0.32, 0.34, darkTimberMat, glassMat);
  frontWindow.position.set(0.34, 0.21 + 0.48, wallD / 2 + 0.01);
  group.add(frontWindow);

  // Right-side (pond-facing) large window + flower box
  const rightWindow = createWindowAssembly(0.38, 0.34, darkTimberMat, glassMat);
  rightWindow.rotation.y = Math.PI / 2;
  rightWindow.position.set(wallW / 2 + 0.01, 0.21 + 0.5, 0);
  group.add(rightWindow);

  // Attic gable window on right side
  const atticWindow = createWindowAssembly(0.22, 0.22, darkTimberMat, glassMat);
  atticWindow.rotation.y = Math.PI / 2;
  atticWindow.position.set(wallW / 2 + 0.01, 0.21 + wallH + 0.34, 0);
  group.add(atticWindow);

  // Left-side window
  const leftWindow = createWindowAssembly(0.34, 0.32, darkTimberMat, glassMat);
  leftWindow.rotation.y = -Math.PI / 2;
  leftWindow.position.set(-wallW / 2 - 0.01, 0.21 + 0.5, 0.08);
  group.add(leftWindow);

  // Flower box under right window
  const flowerBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.1, 0.46)), warmWoodMat);
  flowerBox.position.set(wallW / 2 + 0.08, 0.21 + 0.24, 0);
  flowerBox.castShadow = true;
  group.add(flowerBox);

  const foliageMat = trackMat(new THREE.MeshStandardMaterial({ color: '#5d9148', roughness: 0.9 }));
  const blossomColors = ['#e87b6b', '#f4d35e', '#f7f1e3'];
  const blossomGeo = trackGeo(new THREE.IcosahedronGeometry(0.036, 0));
  const boxLeaf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.055, 0.4)), foliageMat);
  boxLeaf.position.set(wallW / 2 + 0.08, 0.21 + 0.3, 0);
  group.add(boxLeaf);

  for (let i = 0; i < 6; i++) {
    const bMat = trackMat(new THREE.MeshStandardMaterial({ color: blossomColors[i % 3], roughness: 0.8 }));
    const blossom = new THREE.Mesh(blossomGeo, bMat);
    blossom.position.set(
      wallW / 2 + 0.09 + ((i % 2) - 0.5) * 0.03,
      0.21 + 0.34,
      -0.15 + i * 0.06
    );
    group.add(blossom);
  }

  // Track geometry from inline window assemblies for proper disposal
  frontWindow.traverse((child) => {
    if (child instanceof THREE.Mesh) disposables.push(child.geometry);
  });
  rightWindow.traverse((child) => {
    if (child instanceof THREE.Mesh) disposables.push(child.geometry);
  });
  atticWindow.traverse((child) => {
    if (child instanceof THREE.Mesh) disposables.push(child.geometry);
  });
  leftWindow.traverse((child) => {
    if (child instanceof THREE.Mesh) disposables.push(child.geometry);
  });

  // 8. Warm Interior/Porch Spill PointLight
  const houseLight = new THREE.PointLight('#ffaa46', 0, 6.8, 1.5);
  houseLight.position.set(0.42, 0.86, 0.92);
  houseLight.castShadow = false; // Keep shadow map budget focused on sun light
  group.add(houseLight);

  // Collect all solid meshes (excluding smoke puffs) as click/tap hit targets
  const hitTargets: THREE.Object3D[] = [];
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh && !smokePuffs.some((s) => s.mesh === obj)) {
      hitTargets.push(obj);
    }
  });

  let elapsedSec = 0;

  return {
    group,
    hitTargets,
    update(dt, lightFactor, atmosphere, reducedMotion) {
      elapsedSec += dt;

      const lf = Math.max(0, Math.min(1, lightFactor));
      const windowGlow = lf * (1.35 + 1.55 * atmosphere.windowGlowStrength);
      glassMat.emissiveIntensity = windowGlow;
      lanternBulbMat.emissiveIntensity = lf * (1.6 + 1.6 * atmosphere.windowGlowStrength);
      houseLight.intensity = lf * (0.85 + 2.1 * atmosphere.houseLightMultiplier);

      // Gentle rising chimney smoke puffs
      for (const puff of smokePuffs) {
        if (reducedMotion) {
          puff.mesh.visible = false;
          continue;
        }
        puff.mesh.visible = true;
        const cycle = (elapsedSec * 0.24 + puff.phase) % 1;
        puff.mesh.position.set(
          -0.38 + Math.sin(cycle * Math.PI * 2) * 0.04 + cycle * 0.14,
          0.21 + wallH + 0.98 + cycle * 0.72,
          -0.25 + cycle * 0.07
        );
        const s = 0.65 + cycle * 0.95;
        puff.mesh.scale.set(s, s, s);
        puff.mat.opacity = 0.34 * Math.sin(cycle * Math.PI);
      }
    },
    getWindowEmissiveIntensity() {
      return glassMat.emissiveIntensity;
    },
    getLightIntensity() {
      return houseLight.intensity;
    },
    dispose() {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
