import * as THREE from 'three';
import { groundAt, MILL_MOUND } from './island';

export interface WindmillHandle {
  group: THREE.Group;
  update: (dt: number, elapsed: number, wind: number, reduced: boolean) => void;
}

/**
 * A tapered stone tower with a balcony, a capped roof and four lattice sails.
 * Blade speed comes from the shared wind value, with a small idle drift so the
 * mill never looks frozen at zero wind.
 */
export function buildWindmill(): WindmillHandle {
  const group = new THREE.Group();
  group.name = 'windmill';

  const add = (mesh: THREE.Mesh): THREE.Mesh => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const stone = new THREE.MeshStandardMaterial({ color: '#a89a86', roughness: 0.95, flatShading: true });
  const wood = new THREE.MeshStandardMaterial({ color: '#6d4f38', roughness: 0.85 });
  const woodPale = new THREE.MeshStandardMaterial({ color: '#c9b08b', roughness: 0.9 });

  const base = add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.46, 1.5, 14, 3), stone));
  base.position.y = 0.75;
  // Two subtle bands break up the cylinder so it does not read as a primitive.
  for (const [y, r] of [[0.42, 0.42], [1.02, 0.36]] as const) {
    const band = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.015, 0.07, 14), wood));
    band.position.y = y;
  }

  const balcony = add(new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 16), wood));
  balcony.position.y = 1.16;
  const railGeo = new THREE.BoxGeometry(0.03, 0.16, 0.03);
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const post = add(new THREE.Mesh(railGeo, wood));
    post.position.set(Math.cos(a) * 0.43, 1.27, Math.sin(a) * 0.43);
  }
  const rail = add(new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.017, 6, 20), wood));
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 1.35;

  const cap = add(new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.4, 14), wood));
  cap.position.y = 1.68;
  const door = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 0.05), new THREE.MeshStandardMaterial({ color: '#4c3726', roughness: 0.8 })));
  door.position.set(0, 0.3, 0.42);

  // Sails live on a hub that tips slightly towards the viewer, like a real mill.
  const hub = new THREE.Group();
  hub.position.set(0, 1.5, 0.42);
  hub.rotation.x = -0.12;
  group.add(hub);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 8), wood);
  shaft.rotation.x = Math.PI / 2;
  shaft.castShadow = true;
  hub.add(shaft);

  const blades = new THREE.Group();
  hub.add(blades);

  const sailLen = 0.86;
  for (let i = 0; i < 4; i += 1) {
    const sail = new THREE.Group();
    sail.rotation.z = (i / 4) * Math.PI * 2;
    blades.add(sail);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.045, sailLen + 0.16, 0.045), wood);
    arm.position.y = sailLen / 2 + 0.06;
    arm.castShadow = true;
    sail.add(arm);

    const lattice = new THREE.MeshStandardMaterial({ color: '#ded1b6', roughness: 0.95, side: THREE.DoubleSide });
    for (let s = 0; s < 5; s += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.045, 0.012), lattice);
      slat.position.set(0.12, 0.22 + s * 0.15, 0.01);
      slat.rotation.z = 0.09;
      slat.castShadow = true;
      sail.add(slat);
    }
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), woodPale);
    brace.position.set(0.12, 0.15, 0.012);
    brace.rotation.z = 0.5;
    sail.add(brace);
  }

  const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), wood);
  hubCap.position.z = 0.19;
  hubCap.castShadow = true;
  hub.add(hubCap);

  group.position.set(MILL_MOUND.x, groundAt(MILL_MOUND.x, MILL_MOUND.z) - 0.02, MILL_MOUND.z);
  group.rotation.y = 2.55;

  let angle = 0.4;
  const update = (dt: number, elapsed: number, wind: number, reduced: boolean): void => {
    // Wind sets rotation speed; gusts ride on top so it never looks metronomic.
    const gust = 1 + 0.14 * Math.sin(elapsed * 0.7) + 0.07 * Math.sin(elapsed * 1.9 + 1.2);
    const speed = (reduced ? 0.35 : 1) * (wind * 3.4 * gust + 0.05);
    angle += speed * dt;
    blades.rotation.z = angle;
  };

  return { group, update };
}
