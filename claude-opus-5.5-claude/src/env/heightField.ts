export const SurfaceKind = { None: 0, Ground: 1, Water: 2, Structure: 3 } as const;
export type SurfaceKind = (typeof SurfaceKind)[keyof typeof SurfaceKind];

export interface SurfaceHit {
  height: number;
  kind: SurfaceKind;
}

/**
 * A baked grid of "what would a falling drop hit here": ground, pond surface, roof or the
 * windmill cap. Built once at start-up so per-drop collision is a cheap lookup.
 */
export class HeightField {
  private readonly heights: Float32Array;
  private readonly kinds: Uint8Array;
  private readonly cell: number;
  private readonly hit: SurfaceHit = { height: 0, kind: SurfaceKind.None };

  constructor(
    private readonly half: number,
    private readonly res: number,
    probe: (x: number, z: number) => SurfaceHit,
  ) {
    this.heights = new Float32Array(res * res);
    this.kinds = new Uint8Array(res * res);
    this.cell = (half * 2) / (res - 1);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const s = probe(-half + i * this.cell, -half + j * this.cell);
        this.heights[j * res + i] = s.height;
        this.kinds[j * res + i] = s.kind;
      }
    }
  }

  sample(x: number, z: number): SurfaceHit {
    const fx = (x + this.half) / this.cell;
    const fz = (z + this.half) / this.cell;
    const i = Math.round(fx);
    const j = Math.round(fz);
    if (i < 0 || j < 0 || i >= this.res || j >= this.res) {
      this.hit.kind = SurfaceKind.None;
      return this.hit;
    }
    const k = j * this.res + i;
    this.hit.kind = this.kinds[k] as SurfaceKind;
    this.hit.height = this.heights[k];
    return this.hit;
  }
}
