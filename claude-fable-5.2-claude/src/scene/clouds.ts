import * as THREE from 'three';
import { Builder } from '../core/builder';
import { mulberry32, smoothstep } from '../core/math';
import type { Wind } from '../env/wind';
import { lumpy } from './shapes';

interface Cloud {
  mesh: THREE.Mesh;
  /** Start position along the wind axis. */
  start: number;
  /** Sideways offset from the wind axis. */
  lane: number;
  y: number;
  scale: number;
  speed: number;
  /** Half-length of the track before the cloud wraps around. */
  span: number;
  storm: boolean;
  bob: number;
}

const FAIR = new THREE.Color('#ffffff');
const STORM = new THREE.Color('#7f8998');

function cloudGeometry(seed: number, puffs: number): THREE.BufferGeometry {
  const rng = mulberry32(seed);
  const b = new Builder(rng);
  const base = -0.34;
  for (let i = 0; i < puffs; i++) {
    const t = puffs === 1 ? 0.5 : i / (puffs - 1);
    const mid = 1 - Math.abs(t - 0.5) * 2;
    const r = 0.5 + mid * 0.42 + rng() * 0.14;
    b.add(
      lumpy(r, 2, 0.07, seed + i, [1.12, 0.86, 0.95]),
      '#ffffff',
      { p: [(t - 0.5) * puffs * 0.62, r * 0.42 + rng() * 0.1, (rng() - 0.5) * 0.5] },
      0.012,
    );
  }
  const g = b.geometry();
  // Flatten the underside like a real cumulus (and a paper cut-out).
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < base) pos.setY(i, base - (base - pos.getY(i)) * 0.12);
  }
  g.computeVertexNormals();
  return g;
}

/** Fair-weather clouds plus a storm deck that gathers when it rains. */
export class Clouds {
  readonly group = new THREE.Group();
  readonly material = new THREE.MeshStandardMaterial({
    color: FAIR.clone(),
    flatShading: true,
    roughness: 1,
    metalness: 0,
    emissive: new THREE.Color('#dfe8f5'),
    emissiveIntensity: 0.1,
  });
  private readonly clouds: Cloud[] = [];
  private readonly perp = new THREE.Vector2();

  constructor(private readonly windDir: THREE.Vector2) {
    this.group.name = 'clouds';
    this.perp.set(-windDir.y, windDir.x);
    const shapes = [cloudGeometry(101, 4), cloudGeometry(202, 5), cloudGeometry(303, 3), cloudGeometry(404, 6)];
    const add = (c: Omit<Cloud, 'mesh' | 'bob'>, shape: number): void => {
      const mesh = new THREE.Mesh(shapes[shape], this.material);
      mesh.raycast = () => {};
      this.group.add(mesh);
      this.clouds.push({ ...c, mesh, bob: this.clouds.length * 1.7 });
    };
    const fair = { span: 19, storm: false };
    // High and behind.
    add({ ...fair, start: -8.5, lane: -6.5, y: 7.4, scale: 1.45, speed: 1.0 }, 1);
    add({ ...fair, start: 6.5, lane: -3.0, y: 9.3, scale: 1.05, speed: 1.25 }, 0);
    add({ ...fair, start: -1.0, lane: 4.5, y: 9.9, scale: 0.85, speed: 1.4 }, 2);
    add({ ...fair, start: 13, lane: -10.5, y: 4.6, scale: 1.25, speed: 0.85 }, 3);
    // Low and far: these sell the altitude.
    add({ ...fair, start: -12, lane: -11, y: -3.4, scale: 1.7, speed: 0.7 }, 3);
    add({ ...fair, start: 9.5, lane: -7.5, y: -6.6, scale: 1.2, speed: 0.9 }, 0);
    add({ ...fair, start: 2, lane: 9.5, y: -7.2, scale: 1.0, speed: 1.1 }, 2);

    const storm = { span: 11.5, storm: true };
    add({ ...storm, start: -6.2, lane: -2.6, y: 9.0, scale: 2.1, speed: 0.55 }, 3);
    add({ ...storm, start: -0.8, lane: 1.6, y: 9.6, scale: 2.3, speed: 0.5 }, 1);
    add({ ...storm, start: 4.8, lane: -1.2, y: 9.2, scale: 2.0, speed: 0.6 }, 3);
    add({ ...storm, start: 9.5, lane: 2.8, y: 9.9, scale: 1.8, speed: 0.52 }, 1);
    add({ ...storm, start: -10.5, lane: 2.2, y: 9.8, scale: 1.9, speed: 0.58 }, 0);
  }

  /**
   * @param rain  0..1 eased rain amount
   * @param night 0..1 so the clouds do not glow in the dark
   */
  update(time: number, wind: Wind, rain: number, night: number, motion: number): void {
    this.material.color.copy(FAIR).lerp(STORM, rain * 0.85);
    this.material.emissiveIntensity = 0.1 * (1 - night) * (1 - rain * 0.7);
    for (const c of this.clouds) {
      const len = c.span * 2;
      const raw = c.start + wind.travel * 1.5 * c.speed + c.span;
      const along = (((raw % len) + len) % len) - c.span;
      const edge = smoothstep(c.span, c.span - 4, Math.abs(along));
      const grow = c.storm ? smoothstep(0, 1, rain) : 1;
      const s = c.scale * edge * grow;
      c.mesh.visible = s > 0.01;
      if (!c.mesh.visible) continue;
      c.mesh.scale.setScalar(s);
      c.mesh.position.set(
        this.windDir.x * along + this.perp.x * c.lane,
        c.y + Math.sin(time * 0.25 + c.bob) * 0.12 * motion,
        this.windDir.y * along + this.perp.y * c.lane,
      );
    }
  }
}
