import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA } from '../config';

export interface CameraRig {
  controls: OrbitControls;
  reset: () => void;
  update: () => void;
}

/**
 * Orbit camera with damping and strict limits: the island can be
 * orbited and zoomed, but never panned away or viewed from below.
 */
export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLElement,
): CameraRig {
  camera.fov = CAMERA.fov;
  camera.near = CAMERA.near;
  camera.far = CAMERA.far;
  camera.position.copy(CAMERA.position);
  camera.updateProjectionMatrix();

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(CAMERA.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 0.85;
  controls.enablePan = false;
  controls.minDistance = CAMERA.minDistance;
  controls.maxDistance = CAMERA.maxDistance;
  controls.minPolarAngle = CAMERA.minPolarAngle;
  controls.maxPolarAngle = CAMERA.maxPolarAngle;
  controls.update();

  const initialPosition = CAMERA.position.clone();
  const initialTarget = CAMERA.target.clone();

  return {
    controls,
    reset() {
      camera.position.copy(initialPosition);
      controls.target.copy(initialTarget);
      controls.update();
    },
    update() {
      controls.update();
    },
  };
}
