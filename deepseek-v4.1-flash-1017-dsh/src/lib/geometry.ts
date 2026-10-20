import {
  BufferGeometry,
  Float32BufferAttribute,
  CatmullRomCurve3,
  Shape,
  Vector3,
} from 'three';

export type RadiusAt = (angle: number) => number;

/** A flat irregular Shape in the XZ plane. ShapeGeometry + rotateX(-PI/2) faces up. */
export function createGroundShape(
  centerX: number,
  centerZ: number,
  radiusAt: RadiusAt,
  segments = 64,
): Shape {
  const shape = new Shape();
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const radius = radiusAt(angle);
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    // Shape Y is inverted into world Z by rotateX(-PI/2).
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  }
  shape.closePath();
  return shape;
}

/**
 * A radial surface with real interior vertices, useful when the surface needs
 * gentle height variation or shader displacement.
 */
export function createRadialSurface(
  centerX: number,
  centerZ: number,
  radiusAt: RadiusAt,
  segments: number,
  rings: number,
  heightAt: (x: number, z: number, edgeT: number) => number,
  uvScale = 1,
): BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    const radiusScale = t;
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const boundary = radiusAt(angle);
      const x = centerX + Math.cos(angle) * boundary * radiusScale;
      const z = centerZ + Math.sin(angle) * boundary * radiusScale;
      const y = heightAt(x, z, t);
      positions.push(x, y, z);
      uvs.push(0.5 + (x * uvScale) / 20, 0.5 + (z * uvScale) / 20);
    }
  }

  const stride = segments + 1;
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * stride + segment;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      // Winding gives an upward (+Y) normal.
      indices.push(a, d, b, d, c, b);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface RibbonResult {
  geometry: BufferGeometry;
  curve: CatmullRomCurve3;
}

/** A soft-edged strip of ground that follows a curve and sits just above it. */
export function createGroundRibbon(
  points: Vector3[],
  width: number,
  materialHeight: (x: number, z: number) => number,
  segments = 72,
): RibbonResult {
  const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.35);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const up = new Vector3(0, 1, 0);
  const tangent = new Vector3();
  const side = new Vector3();

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point = curve.getPoint(t);
    curve.getTangent(t, tangent);
    tangent.y = 0;
    tangent.normalize();
    side.crossVectors(up, tangent).normalize();
    const w = width * (0.78 + 0.22 * Math.sin(t * Math.PI)) * (1 - 0.28 * Math.max(0, t - 0.78) * 4);
    const left = point.clone().addScaledVector(side, w * 0.5);
    const right = point.clone().addScaledVector(side, -w * 0.5);
    left.y = materialHeight(left.x, left.z) + 0.022;
    right.y = materialHeight(right.x, right.z) + 0.022;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    uvs.push(0, t * 3, 1, t * 3);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, curve };
}

export function setVertexColorAttribute(
  geometry: BufferGeometry,
  colors: number[],
): BufferGeometry {
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}
