import * as THREE from 'three';
import { buildIsland, buildPond, buildRock } from './island';
import { buildHouse, buildWindmill, type HouseRefs, type WindmillRefs } from './structures';
import { buildNature, type NatureRefs, type Swayable } from './nature';
import { Environment, RipplePool, SmokePool } from './environment';
import type { AppState } from './state';
import type { EnvSample } from './palette';

export interface WorldOptions {
  reducedMotion: boolean;
  isSmallDevice: boolean;
}

/**
 * Assembles the whole diorama and advances every animated system from the
 * shared application state each frame.
 */
export class World {
  /** Everything that sits on the island and bobs with it. */
  readonly group = new THREE.Group();
  /** Meshes of the house, used for click-to-toggle picking. */
  readonly houseHitMeshes: THREE.Object3D[] = [];

  private island: THREE.Group;
  private house: HouseRefs;
  private windmill: WindmillRefs;
  private nature: NatureRefs;
  private environment: Environment;
  private ripples: RipplePool;
  private smoke: SmokePool;
  private floatingRocks: Array<{ rock: THREE.Group; baseY: number; phase: number; spin: number }> = [];
  private swayables: Swayable[] = [];
  private reducedMotion: boolean;
  private chimneyWorld = new THREE.Vector3();
  private pondWater: THREE.Mesh;
  private pondDeep: THREE.Mesh;

  constructor(scene: THREE.Scene, opts: WorldOptions) {
    this.reducedMotion = opts.reducedMotion;

    // Island body + pond (ripples bob with the island, so they live inside it).
    this.island = buildIsland();
    const pond = buildPond(new THREE.Vector3(2.4, 0, -0.9), 1.55);
    this.pondWater = pond.water;
    this.pondDeep = pond.deep;
    this.ripples = new RipplePool(pond.radius);
    pond.group.add(this.ripples.group);
    this.island.add(pond.group);

    // On-grass rocks, chosen to balance the pond/windmill side.
    const rockA = buildRock(0.32, 3);
    rockA.position.set(0.35, 0.06, 4.05);
    rockA.rotation.set(0.4, 1.2, 0.2);
    const rockB = buildRock(0.22, 7);
    rockB.position.set(-4.15, 0.04, -0.55);
    rockB.rotation.set(0.2, 2.4, 0.5);
    this.island.add(rockA, rockB);

    // House + windmill
    this.house = buildHouse();
    this.island.add(this.house.group);
    this.windmill = buildWindmill();
    this.island.add(this.windmill.group);

    // Trees, path, fence, flowers
    this.nature = buildNature(this.swayables);
    this.island.add(this.nature.group);
    scene.add(this.nature.clouds.group);

    // Floating rocks near the underside — independent of the island bob.
    const floaters: Array<[number, number, number, number]> = [
      [4.6, -2.1, 1.4, 0.34],
      [-4.9, -1.3, -2.1, 0.26],
      [1.1, -3.1, -4.3, 0.2],
    ];
    floaters.forEach(([x, y, z, size], i) => {
      const rock = buildRock(size, 11 + i * 5);
      rock.position.set(x, y, z);
      scene.add(rock);
      this.floatingRocks.push({ rock, baseY: y, phase: i * 2.2, spin: 0.04 + i * 0.02 });
    });

    // Smoke follows the chimney tip in world space.
    this.smoke = new SmokePool();
    scene.add(this.smoke.group);

    this.environment = new Environment(opts.isSmallDevice, scene);

    this.group.add(this.island);
    scene.add(this.group);

    this.house.group.traverse((o) => {
      if (o instanceof THREE.Mesh) this.houseHitMeshes.push(o);
    });
  }

  update(dt: number, elapsed: number, state: AppState, env: EnvSample): void {
    const motionScale = this.reducedMotion ? 0.15 : 1;

    // The island gently floats: slow bob + barely-there tilt.
    const bob = 0.09 * motionScale;
    this.group.position.y = Math.sin(elapsed * 0.45) * bob;
    this.group.rotation.z = Math.sin(elapsed * 0.3) * 0.004 * motionScale;
    this.group.rotation.x = Math.cos(elapsed * 0.27) * 0.004 * motionScale;

    // Windmill: speed is driven purely by the shared wind state.
    this.windmill.blades.rotation.z -= (state.wind * 4.2 + 0.02) * dt * (this.reducedMotion ? 0.7 : 1);

    // Trees and flowers sway around their base, scaled by wind.
    const swayZ = (0.008 + state.wind * 0.05) * motionScale;
    const swayX = (0.006 + state.wind * 0.038) * motionScale;
    for (const s of this.swayables) {
      s.obj.rotation.z = Math.sin(elapsed * 1.3 + s.phase) * swayZ * s.amp;
      s.obj.rotation.x = Math.cos(elapsed * 1.05 + s.phase * 1.3) * swayX * s.amp;
    }

    // Floating rocks drift on their own slow orbits.
    for (const r of this.floatingRocks) {
      r.rock.position.y = r.baseY + Math.sin(elapsed * 0.5 + r.phase) * 0.16 * motionScale;
      r.rock.rotation.y += dt * r.spin;
    }

    // House lights: emissive windows + lantern + a warm point light,
    // glowing more prominently once the sun goes down.
    const glow = state.lightsBlend * (0.35 + 2.1 * env.nightFactor);
    this.house.windowMat.emissiveIntensity = 0.05 + glow;
    this.house.lanternMat.emissiveIntensity = 0.05 + glow * 1.2;
    this.house.houseLight.intensity = state.lightsBlend * (1.0 + 2.5 * env.nightFactor);

    // Environment: sky, lights, rain.
    this.environment.update(dt, state, env);

    // Pond ripples (pond group is inside the bobbing island group).
    this.ripples.update(dt, state.weatherBlend);

    // Chimney smoke, blown along the shared wind.
    this.house.chimney.getWorldPosition(this.chimneyWorld);
    this.smoke.update(dt, state, env, (out) => out.copy(this.chimneyWorld), motionScale);

    // Clouds ride the same wind.
    this.nature.clouds.update(dt, state.wind, state.weatherBlend, motionScale, elapsed);

    // Pond water and depths darken at night, brighten with day.
    const waterTint = 1 - env.nightFactor * 0.55;
    (this.pondWater.material as THREE.MeshStandardMaterial).color.set('#7fb8c9').multiplyScalar(waterTint);
    (this.pondDeep.material as THREE.MeshStandardMaterial).color.set('#3f6f7d').multiplyScalar(waterTint * 0.9 + 0.1);
  }
}
