import { WATER_Y, islandRho, pondMetric, terrainHeight } from './layout';

export const SurfaceKind = {
  None: 0,
  Ground: 1,
  Water: 2,
  Solid: 3,
} as const;

/**
 * A coarse top-down height map of everything rain can land on: the ground, the
 * pond, roofs, tree canopies, rocks. Props stamp simple shapes into it when they
 * are built. Looking a point up is a single array read, so thousands of drops
 * can check it every frame.
 */
export class SurfaceMap {
  private readonly half = 7;
  private readonly cells = 120;
  private readonly cell: number;
  private readonly heights: Float32Array;
  private readonly kinds: Uint8Array;

  /** Result of the last `query`. */
  height = -Infinity;
  kind: number = SurfaceKind.None;

  constructor() {
    this.cell = (this.half * 2) / this.cells;
    this.heights = new Float32Array(this.cells * this.cells).fill(-Infinity);
    this.kinds = new Uint8Array(this.cells * this.cells);
    for (let j = 0; j < this.cells; j++) {
      for (let i = 0; i < this.cells; i++) {
        const x = -this.half + (i + 0.5) * this.cell;
        const z = -this.half + (j + 0.5) * this.cell;
        if (islandRho(x, z) > 1) continue;
        const idx = j * this.cells + i;
        const ground = terrainHeight(x, z);
        if (pondMetric(x, z).d < 1 && ground < WATER_Y) {
          this.heights[idx] = WATER_Y;
          this.kinds[idx] = SurfaceKind.Water;
        } else {
          this.heights[idx] = ground;
          this.kinds[idx] = SurfaceKind.Ground;
        }
      }
    }
  }

  /** Looks up the surface under (x, z). Returns false past the island's edge. */
  query(x: number, z: number): boolean {
    const i = Math.floor((x + this.half) / this.cell);
    const j = Math.floor((z + this.half) / this.cell);
    if (i < 0 || j < 0 || i >= this.cells || j >= this.cells) {
      this.height = -Infinity;
      this.kind = SurfaceKind.None;
      return false;
    }
    const idx = j * this.cells + i;
    this.height = this.heights[idx];
    this.kind = this.kinds[idx];
    return this.kind !== SurfaceKind.None;
  }

  private raise(i: number, j: number, h: number): void {
    const idx = j * this.cells + i;
    if (h > this.heights[idx]) {
      this.heights[idx] = h;
      this.kinds[idx] = SurfaceKind.Solid;
    }
  }

  /** Stamps `height(dx, dz)` for every cell whose centre lies within `radius` of (cx, cz). */
  private stamp(cx: number, cz: number, radius: number, height: (dx: number, dz: number) => number): void {
    const i0 = Math.max(0, Math.floor((cx - radius + this.half) / this.cell));
    const i1 = Math.min(this.cells - 1, Math.ceil((cx + radius + this.half) / this.cell));
    const j0 = Math.max(0, Math.floor((cz - radius + this.half) / this.cell));
    const j1 = Math.min(this.cells - 1, Math.ceil((cz + radius + this.half) / this.cell));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = -this.half + (i + 0.5) * this.cell - cx;
        const dz = -this.half + (j + 0.5) * this.cell - cz;
        const h = height(dx, dz);
        if (h > -Infinity) this.raise(i, j, h);
      }
    }
  }

  addEllipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): void {
    this.stamp(cx, cz, Math.max(rx, rz), (dx, dz) => {
      const q = (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz);
      return q < 1 ? cy + ry * Math.sqrt(1 - q) : -Infinity;
    });
  }

  addCone(cx: number, cz: number, baseY: number, radius: number, height: number): void {
    this.stamp(cx, cz, radius, (dx, dz) => {
      const d = Math.hypot(dx, dz);
      return d < radius ? baseY + height * (1 - d / radius) : -Infinity;
    });
  }

  addCylinder(cx: number, cz: number, radius: number, topY: number): void {
    this.stamp(cx, cz, radius, (dx, dz) => (Math.hypot(dx, dz) < radius ? topY : -Infinity));
  }

  /**
   * A gabled roof with a ridge along the local x axis, rotated by `yaw`
   * (the same convention as `Object3D.rotation.y`).
   */
  addGable(cx: number, cz: number, yaw: number, halfLength: number, halfSpan: number, eaveY: number, ridgeY: number): void {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const reach = Math.hypot(halfLength, halfSpan);
    this.stamp(cx, cz, reach, (dx, dz) => {
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) > halfLength || Math.abs(lz) > halfSpan) return -Infinity;
      return eaveY + (ridgeY - eaveY) * (1 - Math.abs(lz) / halfSpan);
    });
  }

  addBox(cx: number, cz: number, yaw: number, halfX: number, halfZ: number, topY: number): void {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    this.stamp(cx, cz, Math.hypot(halfX, halfZ), (dx, dz) => {
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      return Math.abs(lx) <= halfX && Math.abs(lz) <= halfZ ? topY : -Infinity;
    });
  }
}
