import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HOME_AZIMUTH, HOME_POLAR, HOME_TARGET } from './cameraRig';

export interface SceneControls {
  orbit: OrbitControls;
  dispose: () => void;
}

const CLICK_MOVE_LIMIT = 7;
const CLICK_TIME_LIMIT = 480;
const DOUBLE_TAP_LIMIT = 340;

/**
 * OrbitControls plus a click/tap gesture that cannot be confused with a drag:
 * a toggle only fires when the pointer barely moved, stayed down briefly, and
 * was released over the house.
 */
export function setupControls(
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  distance: number,
  pickables: THREE.Object3D[],
  onHouseClick: () => void,
  onInteract: () => void,
): SceneControls {
  const orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.055;
  orbit.enablePan = false;
  orbit.minDistance = 6.4;
  orbit.maxDistance = 17;
  orbit.minPolarAngle = 0.3;
  // Slightly past the horizon: the floating underside stays visible, the sky does not.
  orbit.maxPolarAngle = 1.76;
  orbit.zoomSpeed = 0.85;
  orbit.rotateSpeed = 0.85;
  orbit.target.copy(HOME_TARGET);

  const spherical = new THREE.Spherical(distance, HOME_POLAR, HOME_AZIMUTH);
  camera.position.setFromSpherical(spherical).add(HOME_TARGET);
  camera.lookAt(HOME_TARGET);
  orbit.update();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downX = 0;
  let downY = 0;
  let downTime = 0;
  let downId = -1;
  let lastUpTime = -1;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    downId = event.pointerId;
    downX = event.clientX;
    downY = event.clientY;
    downTime = performance.now();
    onInteract();
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== downId) return;
    downId = -1;
    const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
    const held = performance.now() - downTime;
    if (moved > CLICK_MOVE_LIMIT || held > CLICK_TIME_LIMIT) return;

    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObjects(pickables, false).length === 0) return;

    const now = performance.now();
    // Two quick taps fire both the browser click and a second pointerup; swallow it.
    const swallow = now - lastUpTime < DOUBLE_TAP_LIMIT;
    lastUpTime = now;
    if (!swallow) onHouseClick();
  };

  const onWheel = (): void => onInteract();

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });

  return {
    orbit,
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      orbit.dispose();
    },
  };
}
