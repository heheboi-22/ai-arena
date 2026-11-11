import * as THREE from 'three';
import { GROUND_Y, ISLAND_TOP_RADIUS } from '../config';
import { angleNoise } from '../util/math';

/** Returns a position attribute to an irregular radius defined by `radiusFn`. */
function shapeRadius(
  geo: THREE.BufferGeometry,
  radiusFn: (angle: number, y: number) => number
): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Skip cap-center vertices (x≈z≈0) so we don't collapse them.
    if (Math.abs(v.x) < 1e-4 && Math.abs(v.z) < 1e-4) continue;
    const ang = Math.atan2(v.z, v.x);
    const r = radiusFn(ang, v.y);
    const len = Math.hypot(v.x, v.z) || 1e-4;
    v.x = (v.x / len) * r;
    v.z = (v.z / len) * r;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/** Paint subtle per-vertex variation so flat materials read as hand-made. */
function paintVertexColors(
  geo: THREE.BufferGeometry,
  a: THREE.Color,
  b: THREE.Color,
  variance: number
): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const f = 0.5 + 0.5 * Math.sin(x * 1.7 + z * 1.1 + y * 0.6);
    c.copy(a).lerp(b, variance * f);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export interface Island {
  group: THREE.Group;
  topRadius: number;
}

/**
 * A floating island: a grassy disc with an irregular silhouette and a
 * sculpted, rocky underside that tapers to a point.
 */
export function createIsland(): Island {
  const group = new THREE.Group();
  const baseR = ISLAND_TOP_RADIUS;

  // --- Grassy top (a short cylinder) ---
  const grassGeo = new THREE.CylinderGeometry(baseR, baseR * 0.97, 0.6, 80, 1, false);
  shapeRadius(grassGeo, (ang) => baseR * angleNoise(ang));
  paintVertexColors(grassGeo, new THREE.Color('#79b85a'), new THREE.Color('#5d9a44'), 0.16);
  const grassMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
  });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.position.y = 0; // top surface ends at +0.3 = GROUND_Y
  grass.castShadow = true;
  grass.receiveShadow = true;
  group.add(grass);

  // A thin darker "soil" band just under the grass for depth.
  const soilGeo = new THREE.CylinderGeometry(baseR * 0.97, baseR * 0.9, 0.5, 80, 1, false);
  shapeRadius(soilGeo, (ang) => baseR * 0.9 * angleNoise(ang));
  paintVertexColors(soilGeo, new THREE.Color('#7a5b3e'), new THREE.Color('#5e4329'), 0.2);
  const soilMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
  });
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.y = -0.55;
  soil.castShadow = true;
  soil.receiveShadow = true;
  group.add(soil);

  // --- Rocky underside (a tall cone tapering downward) ---
  const rockH = 5.0;
  const rockGeo = new THREE.ConeGeometry(baseR * 0.9, rockH, 72, 14, false);
  shapeRadius(rockGeo, (ang, y) => {
    const f = (y + rockH / 2) / rockH; // 0 at tip, 1 at top
    const jag = 1 + 0.07 * Math.sin(ang * 9.0 + f * 6.0) + 0.04 * Math.sin(ang * 17.0);
    return baseR * 0.9 * angleNoise(ang) * f * jag;
  });
  // Push some vertices around vertically for a jagged, carved look.
  const rpos = rockGeo.attributes.position as THREE.BufferAttribute;
  const rv = new THREE.Vector3();
  for (let i = 0; i < rpos.count; i++) {
    rv.fromBufferAttribute(rpos, i);
    if (Math.abs(rv.x) < 1e-3 && Math.abs(rv.z) < 1e-3) continue;
    const ang = Math.atan2(rv.z, rv.x);
    const f = (rv.y + rockH / 2) / rockH;
    rv.y += 0.18 * f * Math.sin(ang * 6.0 + 1.0) * (0.5 + 0.5 * Math.sin(rv.y * 2.0));
    rpos.setXYZ(i, rv.x, rv.y, rv.z);
  }
  rpos.needsUpdate = true;
  rockGeo.computeVertexNormals();
  paintVertexColors(rockGeo, new THREE.Color('#b08a63'), new THREE.Color('#6d5238'), 0.28);
  const rockMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
    flatShading: true,
  });
  const rock = new THREE.Mesh(rockGeo, rockMat);
  rock.position.y = -0.55 - rockH / 2; // top meets soil bottom
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);

  return { group, topRadius: baseR };
}
