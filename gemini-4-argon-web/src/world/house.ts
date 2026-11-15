import * as THREE from 'three';
import { getIslandSurfaceHeight } from '../state';
import { ProceduralTextureSet } from './textures';

interface SmokePuff {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  startX: number;
  startY: number;
  startZ: number;
  seed: number;
}

export interface HouseSystem {
  group: THREE.Group;
  hitMeshes: THREE.Object3D[];
  setHovered: (hovered: boolean) => void;
  triggerPulse: () => void;
  update: (
    elapsed: number,
    dt: number,
    houseLightsFactor: number,
    nightness: number,
    rainFactor: number,
    windFactor: number,
    reducedMotion: boolean,
  ) => void;
}

export function createHouse(textures: ProceduralTextureSet): HouseSystem {
  const group = new THREE.Group();
  group.name = 'CottageHouse';

  // Position cottage on the northwest meadow terrace facing SSE toward the pond and path
  const hx = -1.45;
  const hz = -1.35;
  const baseY = getIslandSurfaceHeight(hx, hz) ?? 0.38;
  group.position.set(hx, baseY, hz);
  group.rotation.y = 0.34;

  const hitMeshes: THREE.Object3D[] = [];
  const registerMesh = (mesh: THREE.Mesh, cast = true, receive = true) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.userData.isHouse = true;
    hitMeshes.push(mesh);
    return mesh;
  };

  // Contact shadow beneath cottage
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 3.8),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0.15, 0.02, 0.05);
  group.add(shadowPlane);

  // Materials
  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#b8afa2',
    map: textures.stoneColor,
    bumpMap: textures.stoneBump,
    bumpScale: 0.04,
    roughness: 0.86,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    color: '#f4ead8',
    bumpMap: textures.stoneBump,
    bumpScale: 0.012,
    roughness: 0.82,
    metalness: 0.02,
  });

  const timberMat = new THREE.MeshStandardMaterial({
    color: '#5a3b26',
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: 0.025,
    roughness: 0.78,
  });

  const roofMat = new THREE.MeshStandardMaterial({
    color: '#c4583c',
    map: textures.roofColor,
    bumpMap: textures.roofBump,
    bumpScale: 0.05,
    roughness: 0.74,
    metalness: 0.04,
  });

  const doorMat = new THREE.MeshStandardMaterial({
    color: '#7c482b',
    map: textures.woodColor,
    bumpMap: textures.woodBump,
    bumpScale: 0.03,
    roughness: 0.72,
  });

  const shutterMat = new THREE.MeshStandardMaterial({
    color: '#466d56',
    roughness: 0.76,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: '#e5b54f',
    roughness: 0.3,
    metalness: 0.8,
  });

  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: '#34495e',
    emissive: new THREE.Color('#ffaa38'),
    emissiveIntensity: 0.0,
    roughness: 0.18,
    metalness: 0.15,
  });

  const lanternGlassMat = new THREE.MeshStandardMaterial({
    color: '#fff2cc',
    emissive: new THREE.Color('#ffb84d'),
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });

  // 1. Stone Foundation Plinth & Front Stoop
  const plinth = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.36, 1.95), stoneMat));
  plinth.position.set(0, 0.14, 0);
  group.add(plinth);

  const sidePlinth = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.34, 1.45), stoneMat));
  sidePlinth.position.set(1.35, 0.13, -0.1);
  group.add(sidePlinth);

  const stoopStep1 = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.16, 0.46), stoneMat));
  stoopStep1.position.set(-0.15, 0.08, 1.15);
  group.add(stoopStep1);

  const stoopStep2 = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.14, 0.32), stoneMat));
  stoopStep2.position.set(-0.15, 0.21, 1.04);
  group.add(stoopStep2);

  // 2. Main Cottage Stucco Body + Gable Triangles + Side Wing
  const mainW = 2.3;
  const mainH = 1.42;
  const mainD = 1.8;
  const mainBody = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(mainW, mainH, mainD), wallMat));
  mainBody.position.set(0, 0.32 + mainH / 2, 0);
  group.add(mainBody);

  // Side Wing
  const wingW = 1.05;
  const wingH = 1.12;
  const wingD = 1.32;
  const sideWing = registerMesh(new THREE.Mesh(new THREE.BoxGeometry(wingW, wingH, wingD), wallMat));
  sideWing.position.set(1.32, 0.30 + wingH / 2, -0.1);
  group.add(sideWing);

  // Gable wall prism matching the pitched roof
  const roofPeakH = 1.02;
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-mainD / 2, 0);
  gableShape.lineTo(mainD / 2, 0);
  gableShape.lineTo(0, roofPeakH);
  gableShape.closePath();

  const gableGeo = new THREE.ExtrudeGeometry(gableShape, {
    depth: mainW - 0.04,
    bevelEnabled: false,
  });
  // Rotate so extrusion runs along X axis (-mainW/2 to +mainW/2) and triangle is in Z-Y plane
  gableGeo.rotateY(Math.PI / 2);
  gableGeo.translate(-(mainW - 0.04) / 2, 0.32 + mainH, 0);
  const gableMesh = registerMesh(new THREE.Mesh(gableGeo, wallMat));
  group.add(gableMesh);

  // 3. Half-Timber Framing Beams
  const postGeo = new THREE.BoxGeometry(0.1, mainH + 0.04, 0.1);
  const cornerCoords = [
    [-mainW / 2, -mainD / 2],
    [mainW / 2, -mainD / 2],
    [-mainW / 2, mainD / 2],
    [mainW / 2, mainD / 2],
  ];
  for (const [cx, cz] of cornerCoords) {
    const post = registerMesh(new THREE.Mesh(postGeo, timberMat));
    post.position.set(cx, 0.32 + mainH / 2, cz);
    group.add(post);
  }

  // Horizontal timber band around top & middle of walls
  const topBandFront = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(mainW + 0.08, 0.09, 0.08), timberMat),
  );
  topBandFront.position.set(0, 0.32 + mainH, mainD / 2 + 0.01);
  group.add(topBandFront);

  const topBandBack = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(mainW + 0.08, 0.09, 0.08), timberMat),
  );
  topBandBack.position.set(0, 0.32 + mainH, -mainD / 2 - 0.01);
  group.add(topBandBack);

  // 4. Overhanging Pitched Roofs (Dual Sloped Eaves + Ridge Beam)
  const roofOverhangX = 2.66;
  const slopeLen = Math.hypot(mainD / 2 + 0.28, roofPeakH + 0.14);
  const slopeAngle = Math.atan2(roofPeakH, mainD / 2);
  const roofSlopeGeo = new THREE.BoxGeometry(roofOverhangX, 0.12, slopeLen);

  const roofFront = registerMesh(new THREE.Mesh(roofSlopeGeo, roofMat));
  roofFront.position.set(
    0,
    0.32 + mainH + roofPeakH * 0.5 - 0.02,
    (mainD / 2 + 0.12) * 0.52,
  );
  roofFront.rotation.x = slopeAngle;
  group.add(roofFront);

  const roofBack = registerMesh(new THREE.Mesh(roofSlopeGeo, roofMat));
  roofBack.position.set(
    0,
    0.32 + mainH + roofPeakH * 0.5 - 0.02,
    -(mainD / 2 + 0.12) * 0.52,
  );
  roofBack.rotation.x = -slopeAngle;
  group.add(roofBack);

  // Roof ridge beam & decorative finials
  const ridgeBeam = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(roofOverhangX + 0.12, 0.14, 0.14), timberMat),
  );
  ridgeBeam.position.set(0, 0.32 + mainH + roofPeakH + 0.03, 0);
  group.add(ridgeBeam);

  // Side Wing Pitched Roof
  const wingRoofFront = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(wingW + 0.25, 0.1, 0.92), roofMat),
  );
  wingRoofFront.position.set(1.38, 0.30 + wingH + 0.22, -0.1 + 0.36);
  wingRoofFront.rotation.x = 0.54;
  group.add(wingRoofFront);

  const wingRoofBack = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(wingW + 0.25, 0.1, 0.92), roofMat),
  );
  wingRoofBack.position.set(1.38, 0.30 + wingH + 0.22, -0.1 - 0.36);
  wingRoofBack.rotation.x = -0.54;
  group.add(wingRoofBack);

  // 5. Front Door & Porch Canopy
  const doorFrame = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.98, 0.09), timberMat),
  );
  doorFrame.position.set(-0.15, 0.32 + 0.49, mainD / 2 + 0.02);
  group.add(doorFrame);

  const doorPanel = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.07), doorMat),
  );
  doorPanel.position.set(-0.15, 0.32 + 0.46, mainD / 2 + 0.04);
  group.add(doorPanel);

  const doorKnob = registerMesh(
    new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), brassMat),
  );
  doorKnob.position.set(0.01, 0.32 + 0.44, mainD / 2 + 0.09);
  group.add(doorKnob);

  // Over-door timber porch hood
  const porchHood = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.38), roofMat),
  );
  porchHood.position.set(-0.15, 0.32 + 1.08, mainD / 2 + 0.16);
  porchHood.rotation.x = 0.28;
  group.add(porchHood);

  // 6. Multi-Pane Windows with Shutters & Flower Planter Boxes
  const addWindow = (
    x: number,
    y: number,
    z: number,
    rotY: number,
    w = 0.48,
    h = 0.52,
    withShutters = true,
    withFlowerBox = true,
  ) => {
    const winGroup = new THREE.Group();
    winGroup.position.set(x, y, z);
    winGroup.rotation.y = rotY;

    const frame = registerMesh(
      new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.08), timberMat),
    );
    winGroup.add(frame);

    const pane = registerMesh(
      new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), windowGlassMat),
      false,
      false,
    );
    pane.position.z = 0.02;
    winGroup.add(pane);

    // Mullion crossbars
    const vBar = registerMesh(
      new THREE.Mesh(new THREE.BoxGeometry(0.035, h, 0.07), timberMat),
    );
    vBar.position.z = 0.025;
    winGroup.add(vBar);

    const hBar = registerMesh(
      new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, 0.07), timberMat),
    );
    hBar.position.z = 0.025;
    winGroup.add(hBar);

    // Sill
    const sill = registerMesh(
      new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.055, 0.14), stoneMat),
    );
    sill.position.set(0, -h / 2 - 0.03, 0.03);
    winGroup.add(sill);

    if (withShutters) {
      const shutterGeo = new THREE.BoxGeometry(0.15, h + 0.02, 0.045);
      const leftShutter = registerMesh(new THREE.Mesh(shutterGeo, shutterMat));
      leftShutter.position.set(-w / 2 - 0.1, 0, 0.03);
      leftShutter.rotation.y = 0.18;
      winGroup.add(leftShutter);

      const rightShutter = registerMesh(new THREE.Mesh(shutterGeo, shutterMat));
      rightShutter.position.set(w / 2 + 0.1, 0, 0.03);
      rightShutter.rotation.y = -0.18;
      winGroup.add(rightShutter);
    }

    if (withFlowerBox) {
      const box = registerMesh(
        new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.11, 0.13), timberMat),
      );
      box.position.set(0, -h / 2 - 0.09, 0.07);
      winGroup.add(box);

      const flowerColors = ['#e85d56', '#f4c44e', '#ff8da1'];
      for (let f = -1; f <= 1; f++) {
        const blossom = registerMesh(
          new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 7, 7),
            new THREE.MeshStandardMaterial({
              color: flowerColors[f + 1],
              roughness: 0.7,
            }),
          ),
        );
        blossom.position.set(f * 0.13, -h / 2 - 0.02, 0.08);
        winGroup.add(blossom);
      }
    }

    group.add(winGroup);
  };

  // Front main window (right of door)
  addWindow(0.62, 0.32 + 0.72, mainD / 2 + 0.02, 0, 0.48, 0.52, true, true);
  // Front side-wing window
  addWindow(1.42, 0.30 + 0.58, -0.1 + wingD / 2 + 0.02, 0, 0.40, 0.44, false, true);
  // Left wall window + upper gable attic window
  addWindow(-mainW / 2 - 0.02, 0.32 + 0.72, 0.0, -Math.PI / 2, 0.52, 0.50, true, true);
  addWindow(-mainW / 2 - 0.02, 0.32 + mainH + 0.36, 0.0, -Math.PI / 2, 0.34, 0.36, false, false);
  // Back wall window
  addWindow(-0.35, 0.32 + 0.72, -mainD / 2 - 0.02, Math.PI, 0.52, 0.50, true, false);

  // 7. Hanging Porch Lantern & Warm Interior/Exterior Lights
  const lanternBracket = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.22), timberMat),
  );
  lanternBracket.position.set(-0.56, 0.32 + 0.92, mainD / 2 + 0.09);
  group.add(lanternBracket);

  const lanternBulb = registerMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.14, 6), lanternGlassMat),
    false,
    false,
  );
  lanternBulb.position.set(-0.56, 0.32 + 0.82, mainD / 2 + 0.16);
  group.add(lanternBulb);

  const lanternCap = registerMesh(
    new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.07, 6), timberMat),
  );
  lanternCap.position.set(-0.56, 0.32 + 0.91, mainD / 2 + 0.16);
  group.add(lanternCap);

  // Warm PointLight for cottage illumination spill
  const housePointLight = new THREE.PointLight('#ff9f38', 0, 6.8, 1.6);
  housePointLight.position.set(-0.1, 1.25, 1.45);
  group.add(housePointLight);

  const backWarmLight = new THREE.PointLight('#ff9830', 0, 4.5, 1.8);
  backWarmLight.position.set(-1.35, 1.15, 0.0);
  group.add(backWarmLight);

  // Soft warm ground glow disc on the front stoop & lawn when lights are on
  const warmGlowMat = new THREE.MeshBasicMaterial({
    map: textures.softGlow,
    color: '#ffaa44',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const warmGroundGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), warmGlowMat);
  warmGroundGlow.rotation.x = -Math.PI / 2;
  warmGroundGlow.position.set(0.15, 0.04, 1.25);
  group.add(warmGroundGlow);

  // 8. Stone Chimney & Rising Smoke Particle Pool
  const chimney = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.95, 0.42), stoneMat),
  );
  chimney.position.set(0.75, 0.32 + 1.35, -0.58);
  group.add(chimney);

  const chimneyRim = registerMesh(
    new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.10, 0.50), stoneMat),
  );
  chimneyRim.position.set(0.75, 0.32 + 2.32, -0.58);
  group.add(chimneyRim);

  const chimneyPot = registerMesh(
    new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 8), roofMat),
  );
  chimneyPot.position.set(0.75, 0.32 + 2.45, -0.58);
  group.add(chimneyPot);

  // Smoke Puffs Pool (14 reusable spheres)
  const smokeGroup = new THREE.Group();
  smokeGroup.position.set(0.75, 0.32 + 2.58, -0.58);
  group.add(smokeGroup);

  const smokeGeo = new THREE.IcosahedronGeometry(0.12, 1);
  const smokePuffs: SmokePuff[] = [];
  for (let i = 0; i < 14; i++) {
    const sMat = new THREE.MeshStandardMaterial({
      color: '#e8e4dc',
      roughness: 1.0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(smokeGeo, sMat);
    smokeGroup.add(puff);
    smokePuffs.push({
      mesh: puff,
      age: (i / 14) * 2.8,
      life: 2.8,
      startX: 0,
      startY: 0,
      startZ: 0,
      seed: i * 1.7,
    });
  }

  let isHovered = false;
  let pulseTimer = 0;

  return {
    group,
    hitMeshes,
    setHovered: (hovered: boolean) => {
      if (isHovered !== hovered) {
        isHovered = hovered;
        wallMat.emissive.setHex(hovered ? 0x261d12 : 0x000000);
        roofMat.emissive.setHex(hovered ? 0x24100a : 0x000000);
      }
    },
    triggerPulse: () => {
      pulseTimer = 1.0;
    },
    update: (
      elapsed: number,
      dt: number,
      houseLightsFactor: number,
      nightness: number,
      rainFactor: number,
      windFactor: number,
      reducedMotion: boolean,
    ) => {
      // Subtle tactile bounce when house is clicked
      if (pulseTimer > 0) {
        pulseTimer = Math.max(0, pulseTimer - dt * 4.5);
        const s = 1 + Math.sin(pulseTimer * Math.PI) * 0.045;
        group.scale.set(s, s, s);
      } else {
        group.scale.set(1, 1, 1);
      }

      // Wet sheen during rain
      roofMat.roughness = 0.74 - rainFactor * 0.28;
      stoneMat.roughness = 0.86 - rainFactor * 0.22;

      // Emissive windows & porch lantern prominence (visible in day, extra radiant at dusk/night)
      const nightBoost = 1.0 + nightness * 1.45;
      const flicker = reducedMotion ? 1.0 : 0.96 + Math.sin(elapsed * 7.3) * 0.025 + Math.cos(elapsed * 13.1) * 0.015;
      const activeGlow = houseLightsFactor * nightBoost * flicker;

      windowGlassMat.emissiveIntensity = activeGlow * 2.2;
      windowGlassMat.color.setHex(houseLightsFactor > 0.15 ? 0xffd175 : 0x34495e);

      lanternGlassMat.emissiveIntensity = activeGlow * 2.8;
      housePointLight.intensity = houseLightsFactor * (2.2 + nightness * 3.2) * flicker;
      backWarmLight.intensity = houseLightsFactor * (1.1 + nightness * 1.8) * flicker;
      warmGlowMat.opacity = houseLightsFactor * (0.28 + nightness * 0.36);

      // Update chimney smoke (stronger when lights/hearth are on, drifts with shared windFactor)
      const smokeStep = reducedMotion ? dt * 0.35 : dt;
      for (const p of smokePuffs) {
        p.age += smokeStep;
        if (p.age >= p.life) {
          p.age %= p.life;
        }
        const t = p.age / p.life;
        // Wind pushes smoke in local space
        const driftX = t * (0.25 + windFactor * 2.4);
        const driftZ = Math.sin(elapsed * 1.8 + p.seed) * 0.15 * t;
        const riseY = t * (1.55 - windFactor * 0.35);

        p.mesh.position.set(driftX, riseY, driftZ);
        const scale = 0.55 + t * 1.65;
        p.mesh.scale.setScalar(scale);

        const baseOpacity = 0.22 + houseLightsFactor * 0.26;
        const fade = Math.sin(t * Math.PI) * (1 - t * 0.45);
        (p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, fade * baseOpacity);
      }
    },
  };
}
