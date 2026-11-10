import * as THREE from 'three';

export type P3 = [number, number, number];

/** Accumulates flat-coloured triangles with a consistent winding. */
export class TriSoup {
  readonly pos: number[] = [];
  readonly col: number[] = [];

  /** `facing` returns > 0 when the candidate normal points the right way. */
  tri(
    a: P3,
    b: P3,
    c: P3,
    color: THREE.Color,
    facing: (nx: number, ny: number, nz: number) => number,
  ): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-12) return;
    if (facing(nx, ny, nz) < 0) [b, c] = [c, b];
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}
