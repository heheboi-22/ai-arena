import * as THREE from 'three';
import { jitter, PartBuilder } from '../core/parts';
import { Random } from '../core/random';
import { POND, toWorld } from './layout';
import { makeSwaying, PALETTE, type Materials } from './materials';
import { groundHeight } from './terrain';

/** Point at normalised pond radius `q` along local angle `a`, matching `pondQ`'s wobble. */
function pondPoint(a: number, q: number): { x: number; z: number } {
  const wobble = 1 + 0.07 * Math.sin(3 * a + 1.0) + 0.04 * Math.sin(5 * a + 2.7);
  const rho = q / wobble;
  return toWorld(Math.cos(a) * rho * POND.rx, Math.sin(a) * rho * POND.rz, POND, POND.rot);
}

function buildWater(): { mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; reflect: { value: THREE.Color } } {
  const SEG = 72;
  const positions = [POND.x, POND.waterY, POND.z];
  for (let i = 0; i < SEG; i++) {
    const p = pondPoint((i / SEG) * Math.PI * 2, 1.08);
    positions.push(p.x, POND.waterY, p.z);
  }
  const index: number[] = [];
  for (let i = 0; i < SEG; i++) index.push(0, 1 + ((i + 1) % SEG), 1 + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();

  const reflect = { value: new THREE.Color('#cfe3ee') };
  const material = new THREE.MeshStandardMaterial({
    color: PALETTE.water,
    roughness: 0.14,
    metalness: 0,
    transparent: true,
    opacity: 0.84,
  });
  // A view-angle fresnel term blends in the sky colour, which reads as a reflection.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uReflect = reflect;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uReflect;')
      .replace(
        '#include <opaque_fragment>',
        `float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
        outgoingLight = mix(outgoingLight, uReflect, 0.18 + fres * 0.55);
        #include <opaque_fragment>`,
      );
  };
  const mesh = new THREE.Mesh(g, material);
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  mesh.name = 'pond-water';
  return { mesh, material, reflect };
}

export function buildPond(m: Materials) {
  const group = new THREE.Group();
  group.name = 'pond';
  const water = buildWater();
  group.add(water.mesh);

  const rnd = new Random(404);
  const b = new PartBuilder();

  // Lily pads with a notch, and one flower.
  const pad = new THREE.MeshStandardMaterial({ color: '#6c9a58', roughness: 0.7, side: THREE.DoubleSide });
  const petal = new THREE.MeshStandardMaterial({ color: '#f2b8c2', roughness: 0.7, flatShading: true });
  const pads: [number, number, number][] = [
    [0.4, 0.45, 0.13],
    [0.9, 0.62, 0.1],
    [2.6, 0.5, 0.12],
    [3.3, 0.66, 0.09],
    [4.4, 0.4, 0.11],
  ];
  pads.forEach(([a, q, r], i) => {
    const p = pondPoint(a, q);
    b.add(pad, new THREE.CircleGeometry(r, 14, 0.3, Math.PI * 2 - 0.55), {
      x: p.x,
      y: POND.waterY + 0.006 + i * 0.0005,
      z: p.z,
      rx: -Math.PI / 2,
      rz: rnd.range(0, Math.PI * 2),
    });
    if (i === 2) {
      b.add(petal, new THREE.ConeGeometry(0.045, 0.05, 6), { x: p.x, y: POND.waterY + 0.03, z: p.z });
      b.add(m.trim, new THREE.SphereGeometry(0.018, 6, 4), { x: p.x, y: POND.waterY + 0.05, z: p.z });
    }
  });

  // Shore stones in a few clusters rather than an even ring.
  for (const [center, count] of [
    [0.2, 4],
    [2.2, 3],
    [3.9, 5],
    [5.3, 2],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const a = center + (i - count / 2) * 0.13 + rnd.range(-0.04, 0.04);
      const p = pondPoint(a, rnd.range(1.0, 1.1));
      const s = rnd.range(0.06, 0.12);
      b.add(m.stone, jitter(new THREE.DodecahedronGeometry(s, 0), s * 0.2, 50 + i + center * 10), {
        x: p.x,
        y: groundHeight(p.x, p.z) + s * 0.2,
        z: p.z,
        sy: 0.55,
        ry: rnd.range(0, 3),
      });
    }
  }
  group.add(b.build({ castShadow: true }));

  // Reeds and cattails on the far shore; they sway with the same wind as the trees.
  const reedMat = makeSwaying(new THREE.MeshStandardMaterial({ color: '#7f9a54', roughness: 0.9 }), 3.5);
  const tailMat = makeSwaying(new THREE.MeshStandardMaterial({ color: '#7a5537', roughness: 0.9 }), 3.5);
  const rb = new PartBuilder();
  const reedOrigin = pondPoint(1.55, 1.0);
  for (let i = 0; i < 13; i++) {
    const a = 1.2 + rnd.range(0, 0.75);
    const p = pondPoint(a, rnd.range(0.9, 1.06));
    const h = rnd.range(0.28, 0.55);
    const lean = rnd.range(-0.12, 0.12);
    const x = p.x - reedOrigin.x;
    const z = p.z - reedOrigin.z;
    const y = groundHeight(p.x, p.z) - POND.waterY;
    rb.add(reedMat, new THREE.CylinderGeometry(0.006, 0.012, h, 4), { x, y: y + h / 2, z, rz: lean, rx: lean * 0.5 });
    if (i % 3 === 0) {
      rb.add(tailMat, new THREE.CylinderGeometry(0.022, 0.022, 0.09, 6), {
        x: x - Math.sin(lean) * h * 0.32,
        y: y + h * 0.82,
        z,
        rz: lean,
      });
    }
  }
  const reeds = rb.build({ castShadow: true });
  reeds.position.set(reedOrigin.x, POND.waterY, reedOrigin.z);
  group.add(reeds);

  return {
    group,
    water: water.mesh,
    setEnvironment(waterColor: THREE.Color, reflectColor: THREE.Color, rain: number) {
      water.material.color.copy(waterColor);
      water.reflect.value.copy(reflectColor);
      water.material.roughness = 0.14 + rain * 0.25;
    },
  };
}
