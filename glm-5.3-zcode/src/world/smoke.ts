import * as THREE from 'three';
import { makeSoftDotTexture } from './materials';

export interface Smoke {
  group: THREE.Group;
  update: (dt: number, wind: number, reduced: boolean) => void;
}

/** Cozy chimney puffs; a small fixed pool, never allocated at runtime. */
export function createSmoke(anchor: THREE.Object3D): Smoke {
  const group = new THREE.Group();
  const tex = makeSoftDotTexture();
  const COUNT = 8;
  const puffs: { sprite: THREE.Sprite; life: number; active: boolean; seed: number }[] = [];
  for (let i = 0; i < COUNT; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0xe9e4da,
      }),
    );
    sprite.scale.setScalar(0.12);
    group.add(sprite);
    puffs.push({ sprite, life: 0, active: false, seed: i / COUNT });
  }

  let spawnClock = 0;
  const anchorPos = new THREE.Vector3();

  return {
    group,
    update(dt, wind, reduced) {
      if (reduced) {
        for (const p of puffs) p.sprite.material.opacity = 0;
        return;
      }
      // read every frame: the anchor only has a world matrix once the house
      // group is in the scene, which happens after this system is built
      anchor.getWorldPosition(anchorPos);
      spawnClock += dt;
      const interval = 0.55;
      while (spawnClock > interval) {
        spawnClock -= interval;
        const free = puffs.find((p) => !p.active);
        if (free) {
          free.active = true;
          free.life = 0;
          free.seed = Math.random();
          free.sprite.position.copy(anchorPos).add(
            new THREE.Vector3((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.05),
          );
        }
      }
      for (const p of puffs) {
        if (!p.active) continue;
        p.life += dt / 3.2;
        if (p.life >= 1) {
          p.active = false;
          p.sprite.material.opacity = 0;
          continue;
        }
        p.sprite.position.y += dt * 0.5;
        p.sprite.position.x += dt * (0.12 + wind * 1.1);
        p.sprite.position.z += dt * 0.05;
        const s = 0.12 + p.life * 0.42;
        p.sprite.scale.setScalar(s);
        p.sprite.material.opacity = 0.34 * Math.sin(Math.PI * Math.min(p.life, 1));
      }
    },
  };
}
