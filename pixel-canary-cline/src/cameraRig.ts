import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { approach, clamp } from './noise';

export interface CameraRig {
  update: (dt: number) => void;
  /** Frame the whole island (including the floating underside) for this viewport. */
  reframe: (width: number, height: number) => void;
  reset: () => void;
  cancelTween: () => void;
  readonly framing: { distance: number; fov: number; targetY: number };
}

const HOME_AZIMUTH = 0.72;
const HOME_POLAR = 1.19;
const HOME_TARGET = new THREE.Vector3(0.1, 0.4, 0);

/**
 * Owns the default three-quarter view and the reset tween. Aspect ratio changes
 * re-derive the distance so the island keeps its framing on phones and wides.
 */
export function createCameraRig(camera: THREE.PerspectiveCamera, orbit: OrbitControls): CameraRig {
  const spherical = new THREE.Spherical();
  const offset = new THREE.Vector3();
  let tween = 0;
  let azimuthFrom = 0;
  let polarFrom = 0;
  const targetFrom = new THREE.Vector3();
  const framing = { distance: 11, fov: 37, targetY: HOME_TARGET.y };

  function reframe(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    framing.fov = aspect > 1.7 ? 36 : aspect > 1.15 ? 39 : aspect > 0.85 ? 43 : 50;
    framing.distance = THREE.MathUtils.lerp(8.6, 13.4, clamp((1.9 - aspect) / 1.6, 0, 1));
    // Push the island above the bottom sheet on phones.
    framing.targetY = aspect < 0.86 ? 1.15 : HOME_TARGET.y;
    camera.fov = framing.fov;
    camera.updateProjectionMatrix();

    const polar = spherical.setFromVector3(orbit.object.position.clone().sub(orbit.target)).phi;
    const distance = THREE.MathUtils.clamp(
      framing.distance + (polar > 1.6 ? 1.8 : polar < 0.8 ? 1.1 : 0),
      7.2,
      16.5,
    );
    orbit.minDistance = 6.4;
    orbit.maxDistance = 17;
    if (tween === 0) {
      offset.copy(orbit.object.position).sub(orbit.target).setLength(distance);
      orbit.object.position.copy(orbit.target).add(offset);
    }
    orbit.target.y = approach(orbit.target.y, framing.targetY, 3, 1);
    orbit.update();
  }

  function reset(): void {
    const current = spherical.setFromVector3(orbit.object.position.clone().sub(orbit.target));
    azimuthFrom = current.theta;
    polarFrom = current.phi;
    targetFrom.copy(orbit.target);
    tween = 0.0001;
  }

  function update(dt: number): void {
    if (tween === 0) return;
    tween = Math.min(1, tween + dt / 0.9);
    const t = 1 - Math.pow(1 - tween, 3);

    const sphericalNow = new THREE.Spherical(
      THREE.MathUtils.lerp(spherical.setFromVector3(orbit.object.position.clone().sub(orbit.target)).radius, framing.distance, t),
      THREE.MathUtils.lerp(polarFrom, HOME_POLAR, t),
      azimuthFrom + (HOME_AZIMUTH - azimuthFrom) * t,
    );
    offset.setFromSpherical(sphericalNow);
    orbit.object.position.copy(orbit.target).add(offset);
    orbit.target.set(
      THREE.MathUtils.lerp(targetFrom.x, HOME_TARGET.x, t),
      THREE.MathUtils.lerp(targetFrom.y, framing.targetY, t),
      THREE.MathUtils.lerp(targetFrom.z, HOME_TARGET.z, t),
    );
    if (tween >= 1) tween = 0;
  }

  return {
    update,
    reframe,
    reset,
    cancelTween: () => {
      tween = 0;
    },
    framing,
  };
}

export { HOME_AZIMUTH, HOME_POLAR, HOME_TARGET };
