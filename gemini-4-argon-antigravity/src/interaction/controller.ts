import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { StateStore } from '../state';

export const INITIAL_CAMERA_POS = new THREE.Vector3(9.4, 4.4, 12.2);
export const INITIAL_CAMERA_TARGET = new THREE.Vector3(0.0, -0.35, 0.0);

export interface InteractionController {
  controls: OrbitControls;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createInteractionController(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  houseGroup: THREE.Group,
  store: StateStore
): InteractionController {
  camera.position.copy(INITIAL_CAMERA_POS);

  const controls = new OrbitControls(camera, domElement);
  controls.target.copy(INITIAL_CAMERA_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false; // Prevent unrestricted panning that loses the island
  controls.minDistance = 8.2;
  controls.maxDistance = 24.5;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.maxPolarAngle = Math.PI * 0.63; // Allows admiring the floating rocky underside
  controls.rotateSpeed = 0.85;
  controls.zoomSpeed = 0.95;
  controls.update();

  // Interruptible camera reset state
  let isResettingCamera = false;

  const unsubscribeReset = store.onReset(() => {
    if (store.smoothed.reducedMotion) {
      camera.position.copy(INITIAL_CAMERA_POS);
      controls.target.copy(INITIAL_CAMERA_TARGET);
      controls.update();
      isResettingCamera = false;
    } else {
      isResettingCamera = true;
    }
  });

  // Cancel camera reset animation immediately if user interacts with OrbitControls
  const onControlStart = () => {
    isResettingCamera = false;
  };
  controls.addEventListener('start', onControlStart);

  // Pointer & Raycaster setup for House Click vs. Orbit Drag disambiguation
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

  let isPointerDown = false;
  let downX = 0;
  let downY = 0;
  let downTime = 0;
  let maxMoveDistance = 0;

  const updatePointerNDC = (clientX: number, clientY: number) => {
    const rect = domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  };

  const checkHouseIntersection = (clientX: number, clientY: number): boolean => {
    updatePointerNDC(clientX, clientY);
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObject(houseGroup, true);
    return hits.length > 0;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isPointerDown = true;
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
    maxMoveDistance = 0;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (isPointerDown) {
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > maxMoveDistance) {
        maxMoveDistance = dist;
      }
      if (maxMoveDistance > 6) {
        domElement.style.cursor = 'grabbing';
      }
    } else if (e.pointerType === 'mouse') {
      const overHouse = checkHouseIntersection(e.clientX, e.clientY);
      domElement.style.cursor = overHouse ? 'pointer' : 'grab';
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isPointerDown) return;
    isPointerDown = false;

    const finalDist = Math.max(
      maxMoveDistance,
      Math.hypot(e.clientX - downX, e.clientY - downY)
    );
    const elapsed = performance.now() - downTime;

    // Distinguish genuine click/tap from an orbit drag gesture
    if (finalDist < 6 && elapsed < 550) {
      if (checkHouseIntersection(e.clientX, e.clientY)) {
        store.toggleHouseLights();
      }
    }

    if (e.pointerType === 'mouse') {
      const overHouse = checkHouseIntersection(e.clientX, e.clientY);
      domElement.style.cursor = overHouse ? 'pointer' : 'grab';
    } else {
      domElement.style.cursor = '';
    }
  };

  const onPointerCancel = () => {
    isPointerDown = false;
    domElement.style.cursor = 'grab';
  };

  domElement.style.cursor = 'grab';
  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointercancel', onPointerCancel);

  const update = (dt: number) => {
    if (isResettingCamera) {
      const speed = 7.5;
      const alpha = 1 - Math.exp(-speed * dt);
      camera.position.lerp(INITIAL_CAMERA_POS, alpha);
      controls.target.lerp(INITIAL_CAMERA_TARGET, alpha);

      if (
        camera.position.distanceToSquared(INITIAL_CAMERA_POS) < 0.0008 &&
        controls.target.distanceToSquared(INITIAL_CAMERA_TARGET) < 0.0008
      ) {
        camera.position.copy(INITIAL_CAMERA_POS);
        controls.target.copy(INITIAL_CAMERA_TARGET);
        isResettingCamera = false;
      }
    }

    controls.update();
  };

  const dispose = () => {
    unsubscribeReset();
    controls.removeEventListener('start', onControlStart);
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUp);
    domElement.removeEventListener('pointercancel', onPointerCancel);
    controls.dispose();
  };

  return {
    controls,
    update,
    dispose,
  };
}
