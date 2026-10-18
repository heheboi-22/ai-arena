import * as THREE from 'three';

/**
 * A tiny geometry baker. Props are assembled from primitives that are
 * transformed, tinted and appended to one buffer, so a whole house or tree
 * ends up as a handful of draw calls instead of a few dozen.
 */

type V3 = [number, number, number];

/**
 * How texture coordinates are produced for a part:
 *  - `none`: zeros (the part is vertex-coloured only);
 *  - `{ keep: [su, sv] }`: the primitive's own UVs, scaled;
 *  - `{ box: k }`: projected along the dominant axis of each triangle at
 *    `k` texture repeats per world unit, so texel density stays uniform.
 */
export type UvMode = 'none' | { keep: [number, number] } | { box: number };

export interface PartOptions {
  at?: V3;
  /** Euler angles in radians, applied in YXZ order. */
  rot?: V3;
  scale?: number | V3;
  color?: THREE.ColorRepresentation;
  uv?: UvMode;
  /** Per-vertex random brightness variation, 0 to 1. */
  noise?: number;
}

const tmpEuler = new THREE.Euler();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();
const tmpNormalMatrix = new THREE.Matrix3();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();
const vc = new THREE.Vector3();
const faceNormal = new THREE.Vector3();

export function composeMatrix(opts: PartOptions = {}): THREE.Matrix4 {
  const [x, y, z] = opts.at ?? [0, 0, 0];
  const [rx, ry, rz] = opts.rot ?? [0, 0, 0];
  tmpEuler.set(rx, ry, rz, 'YXZ');
  tmpQuat.setFromEuler(tmpEuler);
  tmpPos.set(x, y, z);
  if (typeof opts.scale === 'number') tmpScale.setScalar(opts.scale);
  else if (opts.scale) tmpScale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
  else tmpScale.setScalar(1);
  return new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale);
}

export class GeoBuilder {
  /** Transform applied to every part added while inside `within`. */
  private base = new THREE.Matrix4();
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];
  private readonly colors: number[] = [];
  private readonly indices: number[] = [];
  private vertexCount = 0;
  private seed = 1234567;

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /**
   * Runs `build` with every part placed relative to `frame`, so a window or a
   * fence section can be modelled once in its own space and dropped anywhere.
   */
  within(frame: PartOptions, build: () => void): this {
    const previous = this.base;
    this.base = previous.clone().multiply(composeMatrix(frame));
    build();
    this.base = previous;
    return this;
  }

  /** Appends a transformed copy of `source`. */
  add(source: THREE.BufferGeometry, opts: PartOptions = {}): this {
    const mode: UvMode = opts.uv ?? 'none';
    const geo = mode !== 'none' && 'box' in mode && source.index ? source.toNonIndexed() : source;
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();

    const matrix = this.base.clone().multiply(composeMatrix(opts));
    tmpNormalMatrix.getNormalMatrix(matrix);
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    const srcColor = geo.getAttribute('color');
    tmpColor.set(opts.color ?? 0xffffff);
    const noise = opts.noise ?? 0;
    const base = this.vertexCount;
    const worldPos: THREE.Vector3[] = [];

    for (let i = 0; i < pos.count; i++) {
      const p = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(matrix);
      worldPos.push(p);
      this.positions.push(p.x, p.y, p.z);

      const n = new THREE.Vector3(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(tmpNormalMatrix).normalize();
      this.normals.push(n.x, n.y, n.z);

      const jitter = noise > 0 ? 1 - noise * 0.5 + noise * this.random() : 1;
      let r = tmpColor.r * jitter;
      let g = tmpColor.g * jitter;
      let b = tmpColor.b * jitter;
      if (srcColor) {
        r *= srcColor.getX(i);
        g *= srcColor.getY(i);
        b *= srcColor.getZ(i);
      }
      this.colors.push(r, g, b);

      if (mode !== 'none' && 'keep' in mode) {
        this.uvs.push(uv ? uv.getX(i) * mode.keep[0] : 0, uv ? uv.getY(i) * mode.keep[1] : 0);
      } else {
        this.uvs.push(0, 0);
      }
    }

    if (mode !== 'none' && 'box' in mode) {
      // Box mapping needs one projection per triangle, so it runs on the
      // non-indexed copy made above.
      const k = mode.box;
      for (let t = 0; t + 2 < worldPos.length; t += 3) {
        va.copy(worldPos[t]);
        vb.copy(worldPos[t + 1]);
        vc.copy(worldPos[t + 2]);
        faceNormal.crossVectors(vb.clone().sub(va), vc.clone().sub(va));
        const ax = Math.abs(faceNormal.x);
        const ay = Math.abs(faceNormal.y);
        const az = Math.abs(faceNormal.z);
        for (let c = 0; c < 3; c++) {
          const p = worldPos[t + c];
          let u: number;
          let v: number;
          if (ay >= ax && ay >= az) {
            u = p.x;
            v = p.z;
          } else if (ax >= az) {
            u = p.z;
            v = p.y;
          } else {
            u = p.x;
            v = p.y;
          }
          const o = (base + t + c) * 2;
          this.uvs[o] = u * k;
          this.uvs[o + 1] = v * k;
        }
      }
    }

    const index = geo.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i++) this.indices.push(base + index.getX(i));
    } else {
      for (let i = 0; i < pos.count; i++) this.indices.push(base + i);
    }
    this.vertexCount += pos.count;

    if (geo !== source) geo.dispose();
    return this;
  }

  box(w: number, h: number, d: number, opts: PartOptions = {}): this {
    return this.addTemp(new THREE.BoxGeometry(w, h, d), opts);
  }

  cylinder(rTop: number, rBottom: number, h: number, segments: number, opts: PartOptions = {}): this {
    return this.addTemp(new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1), opts);
  }

  cone(r: number, h: number, segments: number, opts: PartOptions = {}): this {
    return this.addTemp(new THREE.ConeGeometry(r, h, segments, 1), opts);
  }

  sphere(r: number, wSeg: number, hSeg: number, opts: PartOptions = {}): this {
    return this.addTemp(new THREE.SphereGeometry(r, wSeg, hSeg), opts);
  }

  private addTemp(geo: THREE.BufferGeometry, opts: PartOptions): this {
    this.add(geo, opts);
    geo.dispose();
    return this;
  }

  get isEmpty(): boolean {
    return this.vertexCount === 0;
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geo.setIndex(this.indices);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}

/** Weighted-normal-free flat shading helper: gives every triangle its own vertices. */
export function toFlat(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  flat.computeVertexNormals();
  return flat;
}
