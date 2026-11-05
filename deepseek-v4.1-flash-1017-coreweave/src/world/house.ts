import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { SceneContext } from '../environment/runtime';
import { makeSmokeTexture, makeSoftTexture } from '../utils/textures';
import { HOUSE, houseGround } from './layout';
import type { WorldMaterials } from './materials';

interface SmokePuff {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  age: number;
  life: number;
  phase: number;
  drift: number;
}

const setShadows = (group: THREE.Object3D): void => {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh && object.name !== 'house-hit') {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
};

const makeArchedPanel = (width: number, height: number, depth: number): THREE.ExtrudeGeometry => {
  const half = width / 2;
  const arch = half;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(-half, height - arch);
  shape.quadraticCurveTo(-half, height, 0, height);
  shape.quadraticCurveTo(half, height, half, height - arch);
  shape.lineTo(half, 0);
  shape.lineTo(-half, 0);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    curveSegments: 10
  });
};

const buildWindow = (
  materials: WorldMaterials,
  paneMaterial: THREE.MeshStandardMaterial,
  width: number,
  height: number,
  shutters: boolean
): THREE.Group => {
  const group = new THREE.Group();
  const shutterMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b8a83,
    roughness: 0.95,
    metalness: 0
  });

  const recess = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.09, height + 0.09, 0.04),
    materials.darkWood
  );
  recess.position.z = 0.002;
  recess.castShadow = false;
  group.add(recess);

  const pane = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.025), paneMaterial);
  pane.position.z = 0.026;
  pane.castShadow = false;
  group.add(pane);

  const frameThickness = 0.057;
  const frameDepth = 0.075;
  const frameParts = [
    { size: [width + 0.15, frameThickness, frameDepth], pos: [0, height / 2 + 0.045, 0.03] },
    { size: [width + 0.15, frameThickness, frameDepth], pos: [0, -height / 2 - 0.045, 0.03] },
    { size: [frameThickness, height + 0.04, frameDepth], pos: [-width / 2 - 0.045, 0, 0.03] },
    { size: [frameThickness, height + 0.04, frameDepth], pos: [width / 2 + 0.045, 0, 0.03] }
  ] as const;
  for (const part of frameParts) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(...part.size), materials.darkWood);
    bar.position.set(part.pos[0], part.pos[1], part.pos[2]);
    bar.castShadow = false;
    group.add(bar);
  }

  const mullionV = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, height, 0.028),
    materials.darkWood
  );
  mullionV.position.z = 0.049;
  const mullionH = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.028, 0.028),
    materials.darkWood
  );
  mullionH.position.z = 0.049;
  mullionV.castShadow = false;
  mullionH.castShadow = false;
  group.add(mullionV, mullionH);

  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.22, 0.045, 0.16),
    materials.wood
  );
  sill.position.set(0, -height / 2 - 0.075, 0.06);
  group.add(sill);

  if (shutters) {
    for (const side of [-1, 1]) {
      const shutter = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.44, height + 0.04, 0.035),
        shutterMaterial
      );
      shutter.position.set(side * (width / 2 + 0.17), 0, 0.055);
      group.add(shutter);
      for (const offset of [-0.3, 0.3]) {
        const brace = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.34, 0.022, 0.02),
          materials.darkWood
        );
        brace.position.set(side * (width / 2 + 0.17), offset * height, 0.076);
        group.add(brace);
      }
    }
  }

  return group;
};

export class House {
  readonly group = new THREE.Group();
  readonly hitArea: THREE.Mesh;
  readonly doorWorld: THREE.Vector3;
  readonly smokeBase = new THREE.Vector3(-0.55, 3.1, -0.28);
  private readonly windowMaterial: THREE.MeshStandardMaterial;
  private readonly lanternMaterial: THREE.MeshStandardMaterial;
  private readonly glowMaterial: THREE.SpriteMaterial;
  private readonly pointLight: THREE.PointLight;
  private readonly smokePuffs: SmokePuff[] = [];
  private readonly smokeGroup = new THREE.Group();
  private hoverBoost = 0;

  constructor(materials: WorldMaterials) {
    this.group.name = 'house';
    this.group.position.set(HOUSE.x, houseGround - 0.025, HOUSE.z);
    this.group.rotation.y = HOUSE.rotation;

    this.windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x40514e,
      emissive: 0xffb15f,
      emissiveIntensity: 0,
      roughness: 0.26,
      metalness: 0.08
    });
    this.lanternMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a6c45,
      emissive: 0xffc06c,
      emissiveIntensity: 0,
      roughness: 0.4,
      metalness: 0
    });

    const foundation = new THREE.Mesh(
      new RoundedBoxGeometry(2.3, 0.4, 1.78, 3, 0.06),
      materials.stone
    );
    foundation.position.y = 0.15;
    this.group.add(foundation);

    const walls = new THREE.Mesh(
      new RoundedBoxGeometry(2.02, 1.46, 1.5, 3, 0.07),
      materials.plaster
    );
    walls.position.y = 1.01;
    this.group.add(walls);

    const postGeometry = new THREE.BoxGeometry(0.085, 1.47, 0.085);
    for (const x of [-0.97, 0.97]) {
      for (const z of [-0.72, 0.72]) {
        const post = new THREE.Mesh(postGeometry, materials.darkWood);
        post.position.set(x, 1.02, z);
        this.group.add(post);
      }
    }

    const sillBeamFront = new THREE.Mesh(
      new THREE.BoxGeometry(2.06, 0.08, 0.07),
      materials.darkWood
    );
    sillBeamFront.position.set(0, 0.36, 0.725);
    this.group.add(sillBeamFront);
    const sillBeamBack = sillBeamFront.clone();
    sillBeamBack.position.z = -0.725;
    this.group.add(sillBeamBack);
    const topBeam = new THREE.Mesh(
      new THREE.BoxGeometry(2.08, 0.08, 0.07),
      materials.darkWood
    );
    topBeam.position.set(0, 1.68, 0.725);
    this.group.add(topBeam);
    const topBeamBack = topBeam.clone();
    topBeamBack.position.z = -0.725;
    this.group.add(topBeamBack);

    const doorFrame = new THREE.Mesh(makeArchedPanel(0.56, 0.94, 0.035), materials.darkWood);
    doorFrame.position.set(0.31, 0.3, 0.734);
    this.group.add(doorFrame);

    const door = new THREE.Mesh(makeArchedPanel(0.44, 0.86, 0.045), materials.wood);
    door.position.set(0.31, 0.3, 0.762);
    this.group.add(door);

    const doorInset = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, 0.02),
      materials.darkWood
    );
    doorInset.position.set(0.31, 0.55, 0.81);
    this.group.add(doorInset);
    const doorInset2 = doorInset.clone();
    doorInset2.position.y = 0.88;
    this.group.add(doorInset2);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.033, 8, 6), materials.metal);
    knob.position.set(0.47, 0.78, 0.818);
    this.group.add(knob);

    const doorStep = new THREE.Mesh(
      new RoundedBoxGeometry(0.75, 0.1, 0.34, 2, 0.03),
      materials.stone
    );
    doorStep.position.set(0.31, 0.08, 1.02);
    this.group.add(doorStep);

    const frontWindow = buildWindow(materials, this.windowMaterial, 0.38, 0.44, true);
    frontWindow.position.set(-0.46, 1.1, 0.748);
    this.group.add(frontWindow);

    const sideWindow = buildWindow(materials, this.windowMaterial, 0.34, 0.46, false);
    sideWindow.rotation.y = Math.PI / 2;
    sideWindow.position.set(1.006, 1.09, 0.06);
    this.group.add(sideWindow);

    const roofAngle = 0.67;
    const roofGeometry = new THREE.BoxGeometry(2.52, 0.09, 1.44);
    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(roofGeometry, materials.roof);
      slope.rotation.x = side * roofAngle;
      slope.position.set(0, 2.13, side * 0.5);
      this.group.add(slope);
    }
    const ridge = new THREE.Mesh(
      new RoundedBoxGeometry(2.58, 0.1, 0.16, 2, 0.03),
      materials.darkWood
    );
    ridge.position.set(0, 2.555, 0);
    this.group.add(ridge);

    for (const side of [-1, 1]) {
      const fascia = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.08, 0.07),
        materials.darkWood
      );
      fascia.position.set(0, 1.68, side * 1.045);
      this.group.add(fascia);
      const barge = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.09, 1.36),
        materials.darkWood
      );
      barge.rotation.x = side * roofAngle;
      barge.position.set(side * 1.2, 2.11, side * 0.48);
      this.group.add(barge);
    }

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-0.74, 1.68);
    gableShape.lineTo(0.74, 1.68);
    gableShape.lineTo(0, 2.5);
    gableShape.closePath();
    const gableGeometry = new THREE.ExtrudeGeometry(gableShape, {
      depth: 0.075,
      bevelEnabled: false
    });
    for (const side of [-1, 1]) {
      const gable = new THREE.Mesh(gableGeometry, materials.plaster);
      gable.rotation.y = side * (Math.PI / 2);
      gable.position.x = side * 0.985;
      this.group.add(gable);
    }

    const gableTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.08, 1.36),
      materials.darkWood
    );
    gableTrim.rotation.x = -0.67;
    gableTrim.position.set(1.055, 2.1, -0.48);
    this.group.add(gableTrim);
    const gableTrim2 = gableTrim.clone();
    gableTrim2.rotation.x = 0.67;
    gableTrim2.position.z = 0.48;
    this.group.add(gableTrim2);

    const roundWindow = new THREE.Mesh(
      new THREE.CircleGeometry(0.145, 22),
      this.windowMaterial
    );
    roundWindow.rotation.y = Math.PI / 2;
    roundWindow.position.set(1.012, 2.03, 0.02);
    roundWindow.castShadow = false;
    this.group.add(roundWindow);
    const roundFrame = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.022, 6, 24),
      materials.darkWood
    );
    roundFrame.rotation.y = Math.PI / 2;
    roundFrame.position.set(1.026, 2.03, 0.02);
    this.group.add(roundFrame);
    const roundMullion = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.27, 0.02),
      materials.darkWood
    );
    roundMullion.position.set(1.04, 2.03, 0.02);
    this.group.add(roundMullion);
    const roundMullion2 = roundMullion.clone();
    roundMullion2.rotation.x = Math.PI / 2;
    roundMullion2.position.set(1.04, 2.03, 0.02);
    this.group.add(roundMullion2);

    const chimney = new THREE.Mesh(
      new RoundedBoxGeometry(0.35, 1.06, 0.35, 2, 0.035),
      materials.stone
    );
    chimney.position.set(-0.55, 2.45, -0.28);
    this.group.add(chimney);
    const chimneyCap = new THREE.Mesh(
      new RoundedBoxGeometry(0.46, 0.09, 0.46, 2, 0.025),
      materials.stone
    );
    chimneyCap.position.set(-0.55, 3.02, -0.28);
    this.group.add(chimneyCap);
    const chimneyPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 0.2, 10),
      materials.darkWood
    );
    chimneyPot.position.set(-0.55, 3.15, -0.28);
    this.group.add(chimneyPot);

    const lanternBracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.035, 0.035),
      materials.metal
    );
    lanternBracket.position.set(0.32, 1.72, 0.79);
    this.group.add(lanternBracket);
    const lanternBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.15, 0.1),
      this.lanternMaterial
    );
    lanternBody.position.set(0.32, 1.6, 0.85);
    lanternBody.castShadow = false;
    this.group.add(lanternBody);
    const lanternTop = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.07, 4),
      materials.metal
    );
    lanternTop.position.set(0.32, 1.71, 0.85);
    this.group.add(lanternTop);

    const flowerBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.12, 0.17),
      materials.wood
    );
    flowerBox.position.set(-0.46, 0.8, 0.82);
    this.group.add(flowerBox);
    const plantMaterial = new THREE.MeshStandardMaterial({ color: 0x698a4f, roughness: 1 });
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), plantMaterial);
      leaf.position.set(-0.46 + (i - 2) * 0.09, 0.9 + (i % 2) * 0.035, 0.84);
      leaf.scale.set(1.2, 0.8, 1);
      this.group.add(leaf);
    }
    const flowerColors = [0xf1dfb7, 0xd9a49d, 0xe7c56f];
    for (let i = 0; i < 4; i += 1) {
      const flower = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.03, 0),
        new THREE.MeshStandardMaterial({
          color: flowerColors[i % flowerColors.length],
          roughness: 0.9
        })
      );
      flower.position.set(-0.62 + i * 0.11, 0.965 + (i % 2) * 0.02, 0.85);
      this.group.add(flower);
    }

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.13, 0.34, 10),
      materials.wood
    );
    barrel.position.set(1.18, 0.13, 0.46);
    this.group.add(barrel);
    for (const y of [0.04, 0.22]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 4, 14), materials.metal);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(1.18, y, 0.46);
      this.group.add(hoop);
    }

    this.glowMaterial = new THREE.SpriteMaterial({
      map: makeSoftTexture(64, 0.14),
      color: 0xffb862,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    const glowPositions = [
      new THREE.Vector3(-0.46, 1.1, 0.86),
      new THREE.Vector3(1.09, 1.09, 0.06),
      new THREE.Vector3(1.08, 2.03, 0.02),
      new THREE.Vector3(0.32, 1.6, 0.93)
    ];
    for (const position of glowPositions) {
      const glow = new THREE.Sprite(this.glowMaterial);
      glow.position.copy(position);
      glow.scale.setScalar(position.y > 1.8 ? 0.26 : 0.52);
      this.group.add(glow);
    }

    this.pointLight = new THREE.PointLight(0xffb264, 0, 9, 2);
    this.pointLight.position.set(0.2, 1.25, 0.6);
    this.pointLight.castShadow = false;
    this.group.add(this.pointLight);

    this.smokeGroup.position.set(0, 0, 0);
    this.group.add(this.smokeGroup);
    const smokeTexture = makeSmokeTexture();
    for (let i = 0; i < 9; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: smokeTexture,
        color: 0xd8d3c7,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: true
      });
      const sprite = new THREE.Sprite(material);
      sprite.castShadow = false;
      this.smokeGroup.add(sprite);
      const life = 5.5 + (i % 4) * 0.9;
      this.smokePuffs.push({
        sprite,
        material,
        age: (i / 9) * life,
        life,
        phase: i * 1.37,
        drift: 0.7 + (i % 3) * 0.2
      });
    }
    this.smokeGroup.position.set(this.smokeBase.x, this.smokeBase.y, this.smokeBase.z);
    for (const puff of this.smokePuffs) puff.sprite.position.set(0, 0, 0);

    const hitMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false
    });
    this.hitArea = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.5, 2.5), hitMaterial);
    this.hitArea.position.y = 1.55;
    this.hitArea.name = 'house-hit';
    this.group.add(this.hitArea);

    setShadows(this.group);
    this.hitArea.castShadow = false;
    this.hitArea.receiveShadow = false;

    this.doorWorld = new THREE.Vector3(
      HOUSE.doorLocalX,
      0,
      HOUSE.doorLocalZ
    ).applyAxisAngle(new THREE.Vector3(0, 1, 0), HOUSE.rotation);
    this.doorWorld.x += HOUSE.x;
    this.doorWorld.z += HOUSE.z;

    this.group.traverse((object) => {
      if (object instanceof THREE.Sprite) {
        object.material.depthWrite = false;
      }
    });
  }

  setHover(active: boolean): void {
    this.hoverBoost = active ? 1 : 0;
  }

  update(ctx: SceneContext): void {
    const lit = ctx.houseLights;
    const night = ctx.night;
    const boost = this.hoverBoost * 0.08;
    const emissive = lit * (0.3 + night * 2.2) + boost;
    this.windowMaterial.emissiveIntensity = emissive;
    this.lanternMaterial.emissiveIntensity = lit * (0.4 + night * 2.5);
    this.glowMaterial.opacity = lit * (0.09 + night * 0.48) * (1 - ctx.rain * 0.15);
    this.pointLight.intensity = lit * (1.1 + night * 8.4) * (1 - ctx.rain * 0.2);

    const motion = ctx.reducedMotion ? 0.35 : 1;
    for (const puff of this.smokePuffs) {
      puff.age += ctx.delta * (0.5 + ctx.wind * 0.6) * motion;
      if (puff.age > puff.life) puff.age = 0;
      const t = puff.age / puff.life;
      const sway = Math.sin(ctx.time * 0.8 + puff.phase + t * 4) * 0.04;
      const drift = ctx.wind * puff.drift * t * 0.85;
      puff.sprite.position.set(
        drift + sway * t,
        t * 1.1,
        drift * 0.25 + sway * 0.4
      );
      const scale = 0.1 + t * 0.5;
      puff.sprite.scale.set(scale, scale, 1);
      puff.material.opacity =
        Math.sin(Math.min(1, t * 1.05) * Math.PI) * 0.2 * (1 - ctx.rain * 0.65) * (0.4 + night * 0.3);
    }
  }
}
