import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, damp } from '../lib/math';

export interface Controls {
  controls: OrbitControls;
  /** Advances damping and any reset animation; call once per frame. */
  update(dt: number): void;
  /** Glide the camera back to the opening composition. */
  resetView(): void;
}

/**
 * Orbit controls with damping, bounded distance/angles, a clamped pan target
 * so the island can never leave the frame, and an eased reset flight.
 */
export function makeControls(camera: THREE.PerspectiveCamera, dom: HTMLElement, target: THREE.Vector3): Controls {
  const controls = new OrbitControls(camera, dom);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.9;
  controls.minDistance = 9;
  controls.maxDistance = 24;
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = 2.12; // let users peek at the floating underside
  controls.enablePan = true;
  controls.panSpeed = 0.6;
  controls.screenSpacePanning = false;

  const homePos = camera.position.clone();
  const homeTarget = controls.target.clone();

  let flying = false;
  controls.addEventListener('start', () => {
    flying = false; // user grabbed the camera mid-flight
  });

  return {
    controls,
    update(dt: number) {
      if (flying) {
        const p = camera.position;
        p.x = damp(p.x, homePos.x, 0.002, dt);
        p.y = damp(p.y, homePos.y, 0.002, dt);
        p.z = damp(p.z, homePos.z, 0.002, dt);
        const t = controls.target;
        t.x = damp(t.x, homeTarget.x, 0.002, dt);
        t.y = damp(t.y, homeTarget.y, 0.002, dt);
        t.z = damp(t.z, homeTarget.z, 0.002, dt);
        if (p.distanceTo(homePos) < 0.05 && t.distanceTo(homeTarget) < 0.05) {
          camera.position.copy(homePos);
          controls.target.copy(homeTarget);
          flying = false;
        }
      }

      // Keep panning inside a small box around the island.
      const t = controls.target;
      t.x = clamp(t.x, -4, 4);
      t.y = clamp(t.y, -3, 2.5);
      t.z = clamp(t.z, -4, 4);

      controls.update();
    },
    resetView() {
      flying = true;
    },
  };
}
