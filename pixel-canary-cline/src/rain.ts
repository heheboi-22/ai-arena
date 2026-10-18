import * as THREE from 'three';
import { POND, POND_SHORE, groundAt, silhouette, WATER_LEVEL } from './island';
import { makeRandom } from './noise';

export interface RainHandle {
  group: THREE.Group;
  /** @param wind 0..1 @param amount 0..1 fade @param azimuth camera yaw, for billboarding */
  update: (dt: number, wind: number, amount: number, azimuth: number, tint: THREE.Color) => void;
}

const FALL_SPEED = 7.4;
/** Rain blows roughly towards +x/+z; wind scales how far it travels sideways. */
const WIND_DIR = new THREE.Vector2(0.9, 0.44).normalize();

interface Splash {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  life: number;
  active: boolean;
}

export function buildRain(max = 460, splashes = 26): RainHandle {
  const rand = makeRandom(8123);
  const group = new THREE.Group();
  group.name = 'rain';

  const streak = new THREE.PlaneGeometry(0.016, 0.44);
  const material = new THREE.MeshBasicMaterial({
    color: '#cfe3f2',
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const drops = new THREE.InstancedMesh(streak, material, max);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.frustumCulled = false;
  drops.visible = false;
  group.add(drops);

  const px = new Float32Array(max);
  const py = new Float32Array(max);
  const pz = new Float32Array(max);
  const length = new Float32Array(max);
  for (let i = 0; i < max; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 6.4;
    px[i] = Math.cos(a) * r;
    pz[i] = Math.sin(a) * r;
    py[i] = rand() * 7.5;
    length[i] = 0.75 + rand() * 0.7;
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  // Pooled splash rings, reused forever: no allocations while it rains.
  const splashGeo = new THREE.RingGeometry(0.05, 0.075, 14);
  splashGeo.rotateX(-Math.PI / 2);
  const pool: Splash[] = [];
  for (let i = 0; i < splashes; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: '#e6f2fa',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const mesh = new THREE.Mesh(splashGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    pool.push({ mesh, material: mat, age: 0, life: 0.6, active: false });
  }
  let cursor = 0;
  let budget = 0;

  const spawnSplash = (x: number, y: number, z: number, scale: number): void => {
    const splash = pool[cursor % pool.length];
    cursor += 1;
    splash.active = true;
    splash.age = 0;
    splash.life = 0.5 + rand() * 0.35;
    splash.mesh.position.set(x, y + 0.012, z);
    splash.mesh.scale.setScalar(scale * (0.5 + rand() * 0.5));
    splash.mesh.visible = true;
  };

  return {
    group,
    update(dt, wind, amount, azimuth, tint) {
      const visible = amount > 0.004;
      drops.visible = visible;
      if (!visible) {
        // Keep splashes alive so a switched-off storm fades instead of snapping.
        for (const splash of pool) {
          if (!splash.active) continue;
          splash.age += dt;
          const t = splash.age / splash.life;
          if (t >= 1) {
            splash.active = false;
            splash.mesh.visible = false;
            continue;
          }
          splash.material.opacity = (1 - t) * 0.3;
          splash.mesh.scale.multiplyScalar(1 + dt * 2.4);
        }
        return;
      }

      const activeDrops = Math.max(1, Math.round(max * amount));
      const driftX = WIND_DIR.x * wind * 3.6;
      const driftZ = WIND_DIR.y * wind * 3.6;
      // Streaks lean with the wind as seen from the camera, so tilt matches motion.
      const rightX = Math.cos(azimuth - Math.PI / 2);
      const rightZ = Math.sin(azimuth - Math.PI / 2);
      const tilt = Math.atan2(driftX * rightX + driftZ * rightZ, FALL_SPEED);
      q.setFromEuler(e.set(0, azimuth, tilt));

      material.color.copy(tint);
      material.opacity = 0.2 + amount * 0.26;

      for (let i = 0; i < activeDrops; i += 1) {
        py[i] -= FALL_SPEED * dt * (0.85 + length[i] * 0.25);
        px[i] += driftX * dt;
        pz[i] += driftZ * dt;

        const ground = groundAt(px[i], pz[i]);
        if (py[i] <= ground) {
          const a = rand() * Math.PI * 2;
          const r = Math.sqrt(rand()) * 6.4;
          px[i] = Math.cos(a) * r;
          pz[i] = Math.sin(a) * r;
          py[i] = 6.4 + rand() * 1.6;
          budget += 1;
        }

        pos.set(px[i], py[i], pz[i]);
        scl.set(1, length[i] * (1 + wind * 0.5), 1);
        drops.setMatrixAt(i, m.compose(pos, q, scl));
      }
      drops.count = activeDrops;
      drops.instanceMatrix.needsUpdate = true;

      budget += dt * amount * 22;
      while (budget >= 1) {
        budget -= 1;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * 4.4;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        // Rain that falls past the island has no surface to splash on.
        if (r > silhouette(Math.atan2(z, x)) * 0.97) continue;
        const onWater = Math.hypot(x - POND.x, z - POND.z) < POND_SHORE;
        spawnSplash(x, onWater ? WATER_LEVEL : groundAt(x, z), z, onWater ? 1.1 : 0.7);
      }

      for (const splash of pool) {
        if (!splash.active) continue;
        splash.age += dt;
        const t = splash.age / splash.life;
        if (t >= 1) {
          splash.active = false;
          splash.mesh.visible = false;
          splash.material.opacity = 0;
          continue;
        }
        splash.material.opacity = (1 - t) * 0.34 * (0.4 + amount);
        splash.material.color.copy(tint).lerp(new THREE.Color('#ffffff'), 0.5);
        splash.mesh.scale.multiplyScalar(1 + dt * 3.1);
      }
    },
  };
}
