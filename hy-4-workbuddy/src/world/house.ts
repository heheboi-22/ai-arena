import * as THREE from 'three';
import { clamp } from '../util/math';
import { PAL } from './palette';
import { standard, wetness } from './materials';
import { brickTexture, contactShadowTexture, plasterTexture, shingleTexture, softPuffTexture } from './textures';

const W = 2.8;         // width along X
const D = 2.2;         // depth along Z
const WALL_BOTTOM = 0.22;
const WALL_TOP = 2.42;
const RIDGE = 3.62;
const EAVE_Z = 1.32;

export interface House {
  group: THREE.Group;
  pickGroup: THREE.Group;
  /** 0..1, driven by the shared house-lights state and the hour. */
  setGlow(value: number): void;
  update(dt: number, wind: number, rain: number, reducedMotion: boolean): void;
}

function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[],
  x: number, y: number, z: number,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  // Small trim, mullions and planks would add hundreds of shadow-pass draws
  // for shadows nobody can see; only substantial volumes cast.
  m.castShadow = w * h * d > 0.06;
  m.receiveShadow = true;
  return m;
}

function makeWindow(mats: { frame: THREE.Material; glass: THREE.MeshStandardMaterial; trim: THREE.Material }): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.60, 0.66, 0.07, mats.frame, 0, 0, 0));
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.52), mats.glass);
  pane.position.z = 0.042;
  g.add(pane);
  g.add(box(0.045, 0.54, 0.035, mats.trim, 0, 0, 0.065));
  g.add(box(0.48, 0.045, 0.035, mats.trim, 0, 0, 0.065));
  g.add(box(0.70, 0.075, 0.15, mats.trim, 0, -0.37, 0.055));
  g.add(box(0.70, 0.06, 0.10, mats.trim, 0, 0.36, 0.045));
  return g;
}

function archedDoor(mats: { wood: THREE.Material; trim: THREE.Material }): THREE.Group {
  const g = new THREE.Group();
  const arch = (w: number, h: number): THREE.ShapeGeometry => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(-w / 2, h * 0.72);
    s.quadraticCurveTo(0, h * 1.16, w / 2, h * 0.72);
    s.lineTo(w / 2, 0);
    s.closePath();
    return new THREE.ShapeGeometry(s, 12);
  };
  const frame = new THREE.Mesh(arch(0.86, 1.44), mats.trim);
  frame.position.z = 0.012;
  g.add(frame);
  const door = new THREE.Mesh(arch(0.70, 1.30), mats.wood);
  door.position.z = 0.026;
  g.add(door);
  for (const y of [0.34, 0.68, 1.02]) {
    const plank = box(0.66, 0.018, 0.012, mats.trim, 0, y, 0.035);
    plank.castShadow = false;
    g.add(plank);
  }
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), standard(PAL.brass, { roughness: 0.35, metalness: 0.55 }));
  knob.position.set(0.21, 0.78, 0.055);
  g.add(knob);
  return g;
}

export function createHouse(): House {
  const group = new THREE.Group();
  group.name = 'cottage';
  const pickGroup = new THREE.Group();
  group.add(pickGroup);

  const wallMat = wetness.track(standard('#ffffff', { map: plasterTexture(), roughness: 0.95 }), 0.9);
  const wallShade = wetness.track(standard(PAL.wallShade, { roughness: 0.95 }), 0.9);
  const timber = wetness.track(standard(PAL.timber, { roughness: 0.92 }), 0.8);
  const timberDark = wetness.track(standard(PAL.timberDark, { roughness: 0.92 }), 0.8);
  const roofSide = wetness.track(standard(PAL.roofDark, { roughness: 0.92 }), 0.9);
  const roofTop = wetness.track(standard('#ffffff', { map: shingleTexture(), roughness: 0.94 }), 0.9);
  const stone = wetness.track(standard(PAL.stone, { flatShading: true, roughness: 1 }), 0.8);
  const doorWood = wetness.track(standard(PAL.door, { roughness: 0.85 }), 0.8);
  const brass = standard(PAL.brass, { roughness: 0.4, metalness: 0.5 });
  const glass = standard(PAL.glassDark, {
    roughness: 0.28,
    metalness: 0.08,
    emissive: PAL.windowLight,
    emissiveIntensity: 0,
  });
  const brick = wetness.track(standard('#ffffff', { map: brickTexture(), roughness: 0.95 }), 0.9);

  // --- foundation + shell ---
  pickGroup.add(box(W + 0.14, 0.22, D + 0.14, stone, 0, 0.11, 0));
  pickGroup.add(box(W, WALL_TOP - WALL_BOTTOM, D, wallMat, 0, (WALL_BOTTOM + WALL_TOP) / 2, 0));

  // --- half-timber frame ---
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) {
    for (const z of [-D / 2 - 0.015, D / 2 + 0.015]) {
      pickGroup.add(box(0.13, WALL_TOP - WALL_BOTTOM, 0.13, timber, x, (WALL_BOTTOM + WALL_TOP) / 2, z));
    }
  }
  for (const y of [WALL_BOTTOM + 0.06, 1.30, WALL_TOP - 0.07]) {
    // The middle beam skips the front face so it does not cut through the door
    // and the two windows.
    const fronts = y === 1.30 ? [-D / 2 - 0.02] : [-D / 2 - 0.02, D / 2 + 0.02];
    for (const z of fronts) {
      pickGroup.add(box(W + 0.06, 0.10, 0.09, timber, 0, y, z));
    }
    for (const x of [-W / 2 - 0.02, W / 2 + 0.02]) {
      pickGroup.add(box(0.09, 0.10, D + 0.06, timber, x, y, 0));
    }
  }
  // diagonal braces on the front face, kept clear of the windows
  for (const s of [-1, 1]) {
    const brace = box(0.085, 0.92, 0.08, timberDark, s * 1.18, 0.82, D / 2 + 0.035);
    brace.rotation.z = s * 0.62;
    pickGroup.add(brace);
  }
  // short vertical studs between door and windows
  for (const x of [-0.55, 0.55]) {
    pickGroup.add(box(0.09, 1.0, 0.09, timber, x, 0.78, D / 2 + 0.03));
  }

  // --- gable ends ---
  for (const s of [-1, 1]) {
    const tri = new THREE.Shape();
    tri.moveTo(-D / 2, WALL_TOP);
    tri.lineTo(D / 2, WALL_TOP);
    tri.lineTo(0, RIDGE);
    tri.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(tri), wallShade);
    mesh.rotation.y = s * Math.PI / 2;
    mesh.position.x = s * (W / 2 + 0.005);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pickGroup.add(mesh);
  }

  // --- roof ---
  const slope = Math.atan2(RIDGE - WALL_TOP, EAVE_Z);
  const slabLen = Math.hypot(EAVE_Z, RIDGE - WALL_TOP);
  const roofMats: THREE.Material[] = [roofSide, roofSide, roofTop, roofSide, roofSide, roofSide];
  for (const s of [-1, 1]) {
    const slab = box(W + 0.28, 0.13, slabLen + 0.06, roofMats, 0, 0, 0);
    slab.rotation.x = s * slope;
    slab.position.set(0, (WALL_TOP + RIDGE) / 2, s * EAVE_Z / 2);
    pickGroup.add(slab);
    pickGroup.add(box(W + 0.30, 0.11, 0.10, timberDark, 0, WALL_TOP - 0.02, s * EAVE_Z));
  }
  pickGroup.add(box(W + 0.34, 0.10, 0.12, timberDark, 0, RIDGE + 0.01, 0));
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), brass);
  finial.position.set(0, RIDGE + 0.10, 0);
  pickGroup.add(finial);

  // --- chimney ---
  const chimney = box(0.36, 1.25, 0.36, brick, -0.92, 3.25, -0.42);
  pickGroup.add(chimney);
  pickGroup.add(box(0.46, 0.11, 0.46, stone, -0.92, 3.91, -0.42));
  const chimneyTop = new THREE.Vector3(-0.92, 3.97, -0.42);

  // --- front door ---
  const door = archedDoor({ wood: doorWood, trim: timberDark });
  door.position.set(0, WALL_BOTTOM, D / 2 + 0.026);
  pickGroup.add(door);
  pickGroup.add(box(0.98, 0.12, 0.46, stone, 0, 0.07, D / 2 + 0.30));
  // small lantern beside the door
  const lanternMat = standard('#4a3a2b', { roughness: 0.7 });
  pickGroup.add(box(0.13, 0.22, 0.12, lanternMat, 0.66, 1.62, D / 2 + 0.09));
  const bulbMat = standard(PAL.glassDark, { emissive: PAL.windowLight, emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), bulbMat);
  bulb.position.set(0.66, 1.62, D / 2 + 0.16);
  pickGroup.add(bulb);

  // --- windows ---
  const winMats = { frame: timberDark, glass, trim: timber };
  for (const x of [-0.88, 0.88]) {
    const w = makeWindow(winMats);
    w.position.set(x, 1.47, D / 2 + 0.035);
    pickGroup.add(w);
    // flower box
    pickGroup.add(box(0.68, 0.15, 0.20, timber, x, 1.06, D / 2 + 0.12));
    for (let i = 0; i < 5; i++) {
      const petals = [PAL.flowerRed, PAL.flowerYellow, PAL.flowerWhite, PAL.flowerViolet][i % 4];
      const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), standard(petals, { flatShading: true }));
      flower.position.set(x - 0.22 + i * 0.11, 1.18 + (i % 2) * 0.04, D / 2 + 0.13);
      pickGroup.add(flower);
    }
  }
  for (const s of [-1, 1]) {
    const w = makeWindow(winMats);
    w.rotation.y = s * Math.PI / 2;
    w.position.set(s * (W / 2 + 0.035), 1.47, -0.15);
    pickGroup.add(w);
  }

  // --- contact shadow + warm interior light ---
  const shadowTex = contactShadowTexture();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 1.8, D + 1.6),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.75 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  group.add(shadow);

  const lamp = new THREE.PointLight(PAL.windowLight, 0, 6.5, 2);
  lamp.position.set(0, 1.5, D / 2 + 0.55);
  group.add(lamp);

  // --- chimney smoke: soft pooled sprites, drifting with the shared wind ---
  const smoke: { mesh: THREE.Sprite; age: number; life: number; seed: number }[] = [];
  const puffTex = softPuffTexture();
  for (let i = 0; i < 8; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: puffTex, color: '#eee8da', transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    sprite.visible = false;
    group.add(sprite);
    smoke.push({ mesh: sprite, age: (i / 8) * 3.3, life: 3.3, seed: i });
  }

  function update(dt: number, wind: number, rain: number, reducedMotion: boolean): void {
    if (reducedMotion) {
      for (const p of smoke) p.mesh.visible = false;
      return;
    }
    for (const p of smoke) {
      p.age += dt;
      if (p.age >= p.life) { p.age = 0; p.seed += 7; }
      const t = p.age / p.life;
      const drift = 0.55 + wind * 2.6;
      p.mesh.visible = true;
      p.mesh.position.set(
        chimneyTop.x + drift * t * t + Math.sin(p.seed * 2.3 + t * 5) * 0.09,
        chimneyTop.y + t * 1.25,
        chimneyTop.z + drift * 0.35 * t + Math.cos(p.seed * 1.7 + t * 4) * 0.07,
      );
      p.mesh.scale.setScalar(0.34 + t * 1.05);
      (p.mesh.material as THREE.SpriteMaterial).opacity = 0.11 * Math.sin(Math.PI * t) * (1 - rain * 0.85);
    }
  }

  function setGlow(value: number): void {
    const v = clamp(value, 0, 1);
    glass.emissiveIntensity = v * 2.1;
    bulbMat.emissiveIntensity = v * 2.4;
    lamp.intensity = v * 2.9;
  }

  return { group, pickGroup, setGlow, update };
}
