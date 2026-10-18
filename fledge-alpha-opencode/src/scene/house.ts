import * as THREE from 'three';

function gableRoof(w: number, d: number, h: number, color: number): THREE.Mesh {
  const hw = w / 2;
  const hd = d / 2;
  const verts: number[] = [];
  const push = (...vs: number[]) => verts.push(...vs);
  // front triangle
  push(-hw, 0, hd, hw, 0, hd, 0, h, hd);
  // back triangle
  push(hw, 0, -hd, -hw, 0, -hd, 0, h, -hd);
  // right slope
  push(hw, 0, hd, hw, 0, -hd, 0, h, -hd);
  push(hw, 0, hd, 0, h, -hd, 0, h, hd);
  // left slope
  push(-hw, 0, -hd, -hw, 0, hd, 0, h, hd);
  push(-hw, 0, -hd, 0, h, hd, 0, h, -hd);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class House {
  readonly group = new THREE.Group();
  readonly windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x5a6a72,
    emissive: 0xffc36b,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  readonly lamp = new THREE.PointLight(0xffbe78, 0, 10, 2);

  constructor() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf3e8cf, roughness: 0.9 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.8 });

    const walls = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.15, 1.45), wallMat);
    walls.position.y = 0.575;
    walls.castShadow = true;
    walls.receiveShadow = true;
    this.group.add(walls);

    const roof = gableRoof(2.05, 1.8, 0.75, 0xb4634a);
    roof.position.y = 1.15;
    this.group.add(roof);

    // Door
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.56, 0.06), new THREE.MeshStandardMaterial({ color: 0x7a4f33, roughness: 0.8 }));
    door.position.set(-0.35, 0.28, 0.74);
    this.group.add(door);
    const doorTop = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x7a4f33, roughness: 0.8 }));
    doorTop.position.set(-0.35, 0.56, 0.775);
    this.group.add(doorTop);

    // Windows: frame box + emissive pane
    const mkWindow = (x: number, y: number, z: number, ry: number) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.05), trimMat);
      frame.position.set(x, y, z);
      frame.rotation.y = ry;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), this.windowMaterial);
      pane.position.set(x, y, z);
      pane.rotation.y = ry;
      pane.translateZ(0.03);
      this.group.add(frame, pane);
    };
    mkWindow(0.35, 0.62, 0.74, 0);
    mkWindow(0.0, 0.62, -0.74, Math.PI);
    mkWindow(0.86, 0.62, 0, Math.PI / 2);

    // Chimney
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.22), new THREE.MeshStandardMaterial({ color: 0xa8543e, roughness: 0.9 }));
    chimney.position.set(0.5, 1.55, -0.3);
    chimney.castShadow = true;
    this.group.add(chimney);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0x8a4636, roughness: 0.9 }));
    cap.position.set(0.5, 1.9, -0.3);
    this.group.add(cap);

    // Window box flowers under front window
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.9 }));
    box.position.set(0.35, 0.4, 0.78);
    this.group.add(box);

    this.lamp.position.set(0, 0.9, 0.6);
    this.group.add(this.lamp);
  }

  /** Smoothly adjusts emissive + lamp from state */
  update(lightsOn: boolean, nightness: number, dt: number, t: number) {
    const target = lightsOn ? 1.1 + nightness * 1.9 : 0;
    this.windowMaterial.emissiveIntensity = THREE.MathUtils.damp(this.windowMaterial.emissiveIntensity, target, 6, dt);
    const flicker = lightsOn ? 1 + 0.06 * Math.sin(t * 11) * Math.sin(t * 5.3) : 0;
    this.lamp.intensity = THREE.MathUtils.damp(this.lamp.intensity, lightsOn ? (0.6 + nightness * 2.2) * flicker : 0, 6, dt);
  }
}
