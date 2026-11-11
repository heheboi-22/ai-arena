import * as THREE from 'three';
import { PAL } from './palette';
import { standard, wetness } from './materials';
import { contactShadowTexture, sailTexture } from './textures';

export interface Windmill {
  group: THREE.Group;
  angle: number;
  update(dt: number, wind: number, reducedMotion: boolean): void;
}

export function createWindmill(): Windmill {
  const group = new THREE.Group();
  group.name = 'windmill';

  const plaster = wetness.track(standard(PAL.wallShade, { roughness: 0.95 }), 0.9);
  const stone = wetness.track(standard(PAL.stone, { flatShading: true, roughness: 1 }), 0.8);
  const timber = wetness.track(standard(PAL.woodDark, { roughness: 0.9 }), 0.8);
  const roofMat = wetness.track(standard(PAL.roof, { flatShading: true, roughness: 0.92 }), 0.9);
  const dark = standard('#4b3b2c', { roughness: 0.9 });
  const cloth = wetness.track(standard('#ffffff', { map: sailTexture(), roughness: 0.95, side: THREE.DoubleSide }), 0.7);

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  add(new THREE.CylinderGeometry(0.74, 0.80, 0.30, 8), stone, 0, 0.15, 0);
  add(new THREE.CylinderGeometry(0.44, 0.66, 2.55, 8), plaster, 0, 1.52, 0);
  // vertical timber ribs give the tower a built, rather than primitive, look
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rib = add(new THREE.BoxGeometry(0.075, 2.45, 0.075), timber,
      Math.cos(a) * 0.55, 1.52, Math.sin(a) * 0.55);
    rib.rotation.y = -a;
  }
  add(new THREE.CylinderGeometry(0.60, 0.60, 0.10, 12), timber, 0, 1.72, 0);
  add(new THREE.ConeGeometry(0.66, 0.78, 8), roofMat, 0, 3.14, 0);
  add(new THREE.SphereGeometry(0.075, 10, 8), standard(PAL.brass, { metalness: 0.5, roughness: 0.4 }), 0, 3.57, 0);

  // door and two small windows on the front of the tower
  const door = add(new THREE.BoxGeometry(0.32, 0.62, 0.06), dark, 0, 0.58, 0.60);
  door.castShadow = false;
  for (const y of [1.20, 2.10]) {
    const w = add(new THREE.BoxGeometry(0.20, 0.24, 0.06), dark, 0, y, 0.53);
    w.castShadow = false;
    add(new THREE.BoxGeometry(0.26, 0.045, 0.08), timber, 0, y - 0.14, 0.56);
  }

  // --- rotating sails ---
  const hubZ = 0.66;
  const hubY = 2.62;
  const hub = add(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 12), timber, 0, hubY, hubZ + 0.12);
  hub.rotation.x = Math.PI / 2;

  const blades = new THREE.Group();
  blades.position.set(0, hubY, hubZ + 0.26);
  group.add(blades);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i / 4) * Math.PI * 2;
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.085, 1.85, 0.085), timber);
    spar.position.y = 0.92;
    spar.castShadow = true;
    arm.add(spar);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 1.38), cloth);
    sail.position.set(0.25, 0.98, 0.01);
    sail.castShadow = true;
    arm.add(sail);
    for (const y of [0.42, 0.85, 1.28, 1.66]) {
      const batten = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.035, 0.035), timber);
      batten.position.set(0.25, y, 0.03);
      arm.add(batten);
    }
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.42, 0.035), timber);
    edge.position.set(0.47, 0.98, 0.03);
    arm.add(edge);
    blades.add(arm);
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.7 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  group.add(shadow);

  const api: Windmill = {
    group,
    angle: 0,
    update(dt, wind, reducedMotion) {
      // Zero wind really does stop the sails; no idle spin is added.
      const speed = reducedMotion ? wind * 1.0 : wind * 2.35;
      api.angle += dt * speed;
      blades.rotation.z = api.angle;
    },
  };
  return api;
}
