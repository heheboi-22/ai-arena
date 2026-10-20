import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  Vector3,
} from 'three';
import { Rng } from '../lib/noise';
import type { EnvironmentFrame } from './environment';

interface RainOptions {
  count: number;
  isOnIsland: (x: number, z: number) => boolean;
  terrainHeight: (x: number, z: number) => number;
  pondContains: (x: number, z: number) => boolean;
  pondY: number;
  onPondDrop?: (x: number, z: number) => void;
}

interface Drop {
  x: number;
  y: number;
  z: number;
  speed: number;
  length: number;
  drift: number;
}

export class RainLayer {
  readonly group = new Group();
  private readonly geometry: BufferGeometry;
  private readonly material: LineBasicMaterial;
  private readonly positions: Float32Array;
  private readonly drops: Drop[] = [];
  private readonly random = new Rng(9917);
  private readonly options: RainOptions;
  private opacity = 0;
  private raining = false;
  private readonly dayColor = new Color('#c6d4dd');
  private readonly nightColor = new Color('#829aad');
  private readonly currentColor = new Color();
  private readonly windVector = new Vector3();
  private readonly stepVector = new Vector3();

  constructor(options: RainOptions) {
    this.options = options;
    this.positions = new Float32Array(options.count * 2 * 3);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.material = new LineBasicMaterial({
      color: this.dayColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
      fog: true,
    });
    const lines = new LineSegments(this.geometry, this.material);
    lines.frustumCulled = false;
    lines.renderOrder = 4;
    this.group.add(lines);

    for (let i = 0; i < options.count; i += 1) {
      this.drops.push({
        x: this.random.range(-11.5, 11.5),
        y: this.random.range(2, 14),
        z: this.random.range(-11.5, 11.5),
        speed: this.random.range(8.5, 13),
        length: this.random.range(0.22, 0.46),
        drift: this.random.range(0.8, 1.2),
      });
    }
    this.writeBuffers(0, 0);
  }

  clear(): void {
    this.opacity = 0;
    this.material.opacity = 0;
    this.group.visible = false;
    this.raining = false;
  }

  reset(): void {
    for (const drop of this.drops) {
      drop.x = this.random.range(-11.5, 11.5);
      drop.y = this.random.range(2.5, 14);
      drop.z = this.random.range(-11.5, 11.5);
      drop.speed = this.random.range(8.5, 13);
    }
    this.raining = false;
  }

  update(dt: number, frame: EnvironmentFrame): void {
    const targetOpacity = Math.min(1, frame.rain * 1.4) * 0.52;
    this.opacity += (targetOpacity - this.opacity) * Math.min(1, dt * 4.5);

    if (frame.rain > 0.015 && !this.raining) {
      this.reset();
      this.raining = true;
    } else if (frame.rain < 0.005) {
      this.raining = false;
    }

    this.material.opacity = this.opacity;
    this.currentColor.copy(this.dayColor).lerp(this.nightColor, 1 - frame.daylight);
    this.material.color.copy(this.currentColor);
    this.group.visible = this.opacity > 0.008;
    if (!this.group.visible) return;

    const driftX = frame.wind * 4.8;
    const driftZ = frame.wind * 1.1;
    this.windVector.set(driftX, 0, driftZ);

    for (let i = 0; i < this.drops.length; i += 1) {
      const drop = this.drops[i];
      drop.x += driftX * drop.drift * dt;
      drop.z += driftZ * drop.drift * dt;
      drop.y -= drop.speed * dt;

      let groundY = -5.4;
      if (drop.y < 2.2) {
        if (this.options.pondContains(drop.x, drop.z)) {
          groundY = this.options.pondY;
        } else if (this.options.isOnIsland(drop.x, drop.z)) {
          groundY = this.options.terrainHeight(drop.x, drop.z) + 0.02;
        }
      }

      if (drop.y <= groundY) {
        if (groundY === this.options.pondY && this.options.onPondDrop && frame.rain > 0.18) {
          this.options.onPondDrop(drop.x, drop.z);
        }
        this.respawn(drop, groundY > 0 ? 5 + this.random.next() * 8 : 4 + this.random.next() * 9);
      } else if (Math.abs(drop.x) > 13 || Math.abs(drop.z) > 13) {
        this.respawn(drop, 8 + this.random.next() * 6);
      }

      this.writeDrop(i, drop, driftX, driftZ);
    }

    this.geometry.getAttribute('position').needsUpdate = true;
  }

  private respawn(drop: Drop, minY: number): void {
    drop.x = this.random.range(-11.5, 11.5);
    drop.z = this.random.range(-11.5, 11.5);
    drop.y = minY + this.random.range(2, 8);
    drop.speed = this.random.range(8.5, 13);
    drop.length = this.random.range(0.22, 0.46);
    drop.drift = this.random.range(0.8, 1.2);
  }

  private writeDrop(index: number, drop: Drop, driftX: number, driftZ: number): void {
    this.stepVector.set(driftX * drop.drift, -drop.speed, driftZ * drop.drift).normalize();
    const offset = index * 6;
    const topX = drop.x;
    const topY = drop.y;
    const topZ = drop.z;
    const bottomX = topX + this.stepVector.x * drop.length;
    const bottomY = topY + this.stepVector.y * drop.length;
    const bottomZ = topZ + this.stepVector.z * drop.length;

    this.positions[offset] = topX;
    this.positions[offset + 1] = topY;
    this.positions[offset + 2] = topZ;
    this.positions[offset + 3] = bottomX;
    this.positions[offset + 4] = bottomY;
    this.positions[offset + 5] = bottomZ;
  }

  private writeBuffers(driftX: number, driftZ: number): void {
    for (let i = 0; i < this.drops.length; i += 1) {
      this.writeDrop(i, this.drops[i], driftX, driftZ);
    }
    this.geometry.getAttribute('position').needsUpdate = true;
  }
}
