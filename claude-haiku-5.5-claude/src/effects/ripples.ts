import { Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three';
import { POND, WATER_LEVEL } from '../scene/terrain';
import { createRng } from '../util/math';

export interface Ripples {
  group: Group;
  /** `amount` is rain strength 0..1. Ripples only spawn while it is above zero. */
  update(dt: number, amount: number): void;
}

interface Slot {
  mesh: Mesh;
  material: MeshBasicMaterial;
  active: boolean;
  age: number;
  life: number;
  size: number;
}

const RATE = 9;

/** A fixed pool of expanding rings on the pond surface. Slots are reused, never created per frame. */
export function createRipples(poolSize: number): Ripples {
  const rng = createRng(77);
  const group = new Group();
  group.name = 'ripples';
  const geometry = new RingGeometry(0.84, 1, 36);
  geometry.rotateX(-Math.PI / 2);

  const slots: Slot[] = [];
  for (let i = 0; i < poolSize; i++) {
    const material = new MeshBasicMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new Mesh(geometry, material);
    mesh.visible = false;
    mesh.renderOrder = 2;
    group.add(mesh);
    slots.push({ mesh, material, active: false, age: 0, life: 1, size: 0.3 });
  }

  let accumulator = 0;

  const spawn = (slot: Slot): void => {
    // Land anywhere inside the pond, leaving a margin so rings don't spill over the shore.
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * POND.radius * 0.82;
    slot.mesh.position.set(POND.x + Math.cos(a) * r, WATER_LEVEL + 0.02, POND.z + Math.sin(a) * r);
    slot.active = true;
    slot.age = 0;
    slot.life = 0.9 + rng() * 0.6;
    slot.size = 0.22 + rng() * 0.18;
    slot.mesh.visible = true;
  };

  return {
    group,
    update(dt, amount) {
      if (amount > 0.001) {
        accumulator += dt * RATE * amount;
        while (accumulator >= 1) {
          accumulator -= 1;
          const free = slots.find((s) => !s.active);
          if (!free) break;
          spawn(free);
        }
      } else {
        accumulator = 0;
      }

      for (const slot of slots) {
        if (!slot.active) continue;
        slot.age += dt;
        const p = slot.age / slot.life;
        if (p >= 1) {
          slot.active = false;
          slot.mesh.visible = false;
          continue;
        }
        // Ease out: rings expand quickly, then slow as they fade.
        const eased = 1 - (1 - p) * (1 - p) * (1 - p);
        slot.mesh.scale.setScalar(slot.size * (0.2 + 0.8 * eased));
        slot.material.opacity = (1 - p) * 0.6;
      }
    },
  };
}
