import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
} from 'three';
import { Rng } from '../lib/noise';
import type { Pond } from '../scene/pond';
import type { EnvironmentFrame } from './environment';

interface Ripple {
  mesh: Mesh;
  material: MeshBasicMaterial;
  age: number;
  duration: number;
  active: boolean;
}

export class RippleLayer {
  readonly group = new Group();
  private readonly ripples: Ripple[] = [];
  private readonly random = new Rng(4421);
  private readonly pond: Pond;
  private readonly geometry: RingGeometry;
  private readonly color = new Color('#d8e8e9');
  private lastSplash = 0;
  private spawnClock = 0;

  constructor(pond: Pond) {
    this.pond = pond;
    this.group.name = 'rain-ripples';
    this.geometry = new RingGeometry(0.82, 1, 32);
    this.geometry.rotateX(-Math.PI / 2);

    for (let i = 0; i < 24; i += 1) {
      const material = new MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
        side: 2,
      });
      const mesh = new Mesh(this.geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.group.add(mesh);
      this.ripples.push({ mesh, material, age: 0, duration: 1.5, active: false });
    }
  }

  /** Called by the rain layer when a drop lands inside the pond. */
  splash(x: number, z: number, rain: number): void {
    if (rain < 0.2 || this.random.next() > 0.28) return;
    const now = performance.now() / 1000;
    if (now - this.lastSplash < 0.045) return;
    this.lastSplash = now;
    this.spawnAt(x, z);
  }

  private spawnAt(x: number, z: number): void {
    const ripple = this.ripples.find((candidate) => !candidate.active);
    if (!ripple) return;

    ripple.active = true;
    ripple.age = 0;
    ripple.duration = this.random.range(1.25, 1.9);
    ripple.mesh.position.set(
      x + this.random.range(-0.04, 0.04),
      this.pond.waterY + 0.014,
      z + this.random.range(-0.04, 0.04),
    );
    ripple.mesh.scale.setScalar(0.08);
    ripple.material.opacity = 0.4;
    ripple.mesh.visible = true;
  }

  update(dt: number, frame: EnvironmentFrame): void {
    this.spawnClock += dt * Math.max(0, frame.rain - 0.12) * 7.5;
    while (this.spawnClock >= 1) {
      this.spawnClock -= 1;
      const point = this.pond.randomPoint(this.random);
      this.spawnAt(point.x, point.z);
    }
    if (frame.rain < 0.15) this.spawnClock = 0;

    for (const ripple of this.ripples) {
      if (!ripple.active) continue;
      ripple.age += dt;
      const t = ripple.age / ripple.duration;
      if (t >= 1) {
        ripple.active = false;
        ripple.mesh.visible = false;
        ripple.material.opacity = 0;
        continue;
      }
      const eased = 1 - Math.pow(1 - t, 2.2);
      ripple.mesh.scale.setScalar(0.1 + eased * 0.5);
      ripple.material.opacity = Math.pow(1 - t, 1.6) * 0.34;
    }
  }

  clear(): void {
    for (const ripple of this.ripples) {
      ripple.active = false;
      ripple.mesh.visible = false;
      ripple.material.opacity = 0;
    }
  }
}
