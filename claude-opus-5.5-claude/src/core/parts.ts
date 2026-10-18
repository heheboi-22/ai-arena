import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export interface Placement {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

export function placementMatrix(p: Placement): THREE.Matrix4 {
  tmpPos.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  tmpQuat.setFromEuler(tmpEuler.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0, 'YXZ'));
  tmpScale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1);
  return tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
}

/**
 * Collects many small primitives and merges them into one mesh per material,
 * so a house built from forty boxes costs a handful of draw calls.
 */
export class PartBuilder {
  private readonly parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(material: THREE.Material, geometry: THREE.BufferGeometry, at: Placement | THREE.Matrix4 = {}): this {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'color') g.deleteAttribute(name);
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.applyMatrix4(at instanceof THREE.Matrix4 ? at : placementMatrix(at));
    const list = this.parts.get(material);
    if (list) list.push(g);
    else this.parts.set(material, [g]);
    return this;
  }

  build(opts: { castShadow?: boolean; receiveShadow?: boolean } = {}): THREE.Group {
    const group = new THREE.Group();
    for (const [material, list] of this.parts) {
      const hasColor = list.some((g) => g.getAttribute('color'));
      if (hasColor) for (const g of list) if (!g.getAttribute('color')) paintSolid(g, 0xffffff);
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

/** Fills a `color` attribute with one colour (sRGB hex in, linear stored). */
export function paintSolid(g: THREE.BufferGeometry, hex: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const count = g.getAttribute('position').count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** Nudges vertices with a seeded offset; shared positions move together so the mesh stays closed. */
export function jitter(g: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const keyed = new Map<string, [number, number, number]>();
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s / 2147483647) * 2 - 1;
  };
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)}|${pos.getY(i).toFixed(3)}|${pos.getZ(i).toFixed(3)}`;
    let off = keyed.get(key);
    if (!off) {
      off = [rnd() * amount, rnd() * amount, rnd() * amount];
      keyed.set(key, off);
    }
    pos.setXYZ(i, pos.getX(i) + off[0], pos.getY(i) + off[1], pos.getZ(i) + off[2]);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Vertical colour ramp, used to fake ambient occlusion on foliage and rock. */
export function paintGradient(
  g: THREE.BufferGeometry,
  bottom: THREE.ColorRepresentation,
  top: THREE.ColorRepresentation,
  y0: number,
  y1: number,
): THREE.BufferGeometry {
  const a = new THREE.Color(bottom);
  const b = new THREE.Color(top);
  const c = new THREE.Color();
  const pos = g.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0)));
    c.copy(a).lerp(b, t);
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
