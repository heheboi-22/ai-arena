import * as THREE from 'three';
import { GROUND_Y } from '../config';

export interface Pond {
  group: THREE.Group;
  /** Animate surface waves and (when raining) spawn ripples. */
  update: (time: number, dt: number, rain: number) => void;
}

interface Ripple {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  active: boolean;
}

function createPond(cx: number, cz: number, radius: number): Pond {
  const group = new THREE.Group();
  group.position.set(cx, 0, cz);

  // A low bank that rises above the grass so the pond reads as sunken.
  const bankGeo = new THREE.CylinderGeometry(
    radius,
    radius * 0.97,
    0.22,
    56,
    1,
    true
  );
  const bank = new THREE.Mesh(
    bankGeo,
    new THREE.MeshStandardMaterial({
      color: '#cdbf9a',
      roughness: 1.0,
      side: THREE.DoubleSide,
    })
  );
  bank.position.y = GROUND_Y - 0.02;
  bank.receiveShadow = true;
  group.add(bank);

  // Blend ring where the bank meets the grass.
  const shoreGeo = new THREE.RingGeometry(radius * 0.99, radius + 0.26, 56);
  shoreGeo.rotateX(-Math.PI / 2);
  const shore = new THREE.Mesh(
    shoreGeo,
    new THREE.MeshStandardMaterial({ color: '#c4b592', roughness: 1.0 })
  );
  shore.position.y = GROUND_Y + 0.004;
  shore.receiveShadow = true;
  group.add(shore);

  // Opaque pond bed so the water doesn't show grass through it.
  const bedGeo = new THREE.CircleGeometry(radius * 0.99, 56);
  bedGeo.rotateX(-Math.PI / 2);
  const bed = new THREE.Mesh(
    bedGeo,
    new THREE.MeshStandardMaterial({ color: '#2f5f78', roughness: 1.0 })
  );
  bed.position.y = GROUND_Y + 0.006;
  group.add(bed);

  // Water disc, sitting just inside the bank rim.
  const waterGeo = new THREE.CircleGeometry(radius * 0.985, 56);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: '#5b9ec4',
    roughness: 0.16,
    metalness: 0.15,
    transparent: true,
    opacity: 0.94,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = GROUND_Y + 0.015;
  water.receiveShadow = true;
  group.add(water);

  const basePos = (waterGeo.attributes.position as THREE.BufferAttribute).clone();

  // Ripple pool (expanding rings) used when it rains.
  const rippleMat = new THREE.MeshBasicMaterial({
    color: '#dff1ff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ripples: Ripple[] = [];
  const RIPPLE_COUNT = 18;
  for (let i = 0; i < RIPPLE_COUNT; i++) {
    const g = new THREE.RingGeometry(0.12, 0.2, 18);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, rippleMat.clone());
    m.position.y = GROUND_Y + 0.065;
    m.visible = false;
    group.add(m);
    ripples.push({ mesh: m, life: 0, maxLife: 1.4, active: false });
  }

  let spawnTimer = 0;

  const spawnRipple = (): void => {
    const r = ripples.find((x) => !x.active);
    if (!r) return;
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * radius * 0.85;
    r.mesh.position.x = Math.cos(ang) * dist;
    r.mesh.position.z = Math.sin(ang) * dist;
    r.mesh.scale.setScalar(0.3);
    r.mesh.visible = true;
    r.active = true;
    r.life = 0;
  };

  const update = (time: number, dt: number, rain: number): void => {
    // Surface waves – amplitude grows with rain.
    const amp = 0.01 + rain * 0.03;
    const pos = waterGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = basePos.getX(i);
      const z = basePos.getZ(i);
      const y =
        Math.sin(x * 1.6 + time * 1.2) * amp +
        Math.sin(z * 1.3 - time * 0.9) * amp;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    // Spawn ripples proportional to rain.
    if (rain > 0.05) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnRipple();
        spawnTimer = 1 / (rain * 9 + 0.001);
      }
    }

    // Animate active ripples.
    for (const r of ripples) {
      if (!r.active) continue;
      r.life += dt;
      const t = r.life / r.maxLife;
      if (t >= 1) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      r.mesh.scale.setScalar(0.3 + t * 2.6);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.5;
    }
  };

  return { group, update };
}

export function createPonds(): Pond[] {
  // A main pond plus a small pool, both kept inside the island rim.
  return [createPond(1.35, 1.45, 1.15), createPond(-2.75, 1.95, 0.48)];
}
