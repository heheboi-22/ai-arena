import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Vec3 = [number, number, number];

export interface Xf {
  p?: Vec3;
  r?: Vec3;
  s?: number | Vec3;
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function xfMatrix(xf: Xf, out = new THREE.Matrix4()): THREE.Matrix4 {
  const p = xf.p ?? [0, 0, 0];
  const r = xf.r ?? [0, 0, 0];
  const s = xf.s ?? 1;
  _p.set(p[0], p[1], p[2]);
  _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  if (typeof s === 'number') _s.setScalar(s);
  else _s.set(s[0], s[1], s[2]);
  return out.compose(_p, _q, _s);
}

/**
 * Collects coloured primitives and bakes them into one vertex-coloured
 * geometry, so a whole prop (a house, a tree crown) costs a single draw call
 * and a single shared material.
 */
export class Builder {
  private parts: THREE.BufferGeometry[] = [];

  constructor(private readonly rng: () => number = Math.random) {}

  /**
   * @param vary per-triangle lightness variation (0..1), gives the
   *             hand-painted, slightly uneven look.
   */
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, xf: Xf = {}, vary = 0): this {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    g.applyMatrix4(xfMatrix(xf, _m));
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    _c.set(color);
    for (let i = 0; i < count; i += 3) {
      const k = vary > 0 ? 1 + (this.rng() * 2 - 1) * vary : 1;
      for (let j = 0; j < 3; j++) {
        colors[(i + j) * 3] = _c.r * k;
        colors[(i + j) * 3 + 1] = _c.g * k;
        colors[(i + j) * 3 + 2] = _c.b * k;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push(g);
    return this;
  }

  /** Add an already coloured geometry (position + normal + color). */
  addRaw(geo: THREE.BufferGeometry, xf: Xf = {}): this {
    const g = geo.clone();
    g.applyMatrix4(xfMatrix(xf, _m));
    this.parts.push(g);
    return this;
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  geometry(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    if (!merged) throw new Error('Builder: could not merge geometry parts');
    for (const part of this.parts) part.dispose();
    this.parts = [];
    return merged;
  }

  mesh(material: THREE.Material, shadows = true): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(), material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    return mesh;
  }
}

// --- small primitive helpers -------------------------------------------------

export const box = (w: number, h: number, d: number): THREE.BufferGeometry =>
  new THREE.BoxGeometry(w, h, d);

export const cyl = (
  rTop: number,
  rBottom: number,
  h: number,
  seg = 8,
  open = false,
): THREE.BufferGeometry => new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open);

export const cone = (r: number, h: number, seg = 8): THREE.BufferGeometry =>
  new THREE.ConeGeometry(r, h, seg);

export const ico = (r: number, detail = 1): THREE.BufferGeometry =>
  new THREE.IcosahedronGeometry(r, detail);
