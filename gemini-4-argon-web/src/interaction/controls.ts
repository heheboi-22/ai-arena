import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { damp } from '../state';

export const INITIAL_CAMERA_POS = new THREE.Vector3(13.8, 7.6, 15.6);
export const INITIAL_CAMERA_TARGET = new THREE.Vector3(0.0, -0.45, 0.0);

export interface InteractionController {
  controls: OrbitControls;
  resetCamera: (instant?: boolean) => void;
  syncViewportAspect: (width: number, height: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function computeResponsiveFov(width: number, height: number): number {
  const aspect = width / Math.max(1, height);
  if (aspect >= 1.0) return 42;
  // Widen vertical FOV on portrait mobile screens so the entire island stays framed horizontally
  return Math.min(68, 42 / Math.pow(aspect, 0.56));
}

export function createInteractionController(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  houseHitMeshes: THREE.Object3D[],
  onHouseClick: () => void,
  onHouseHover: (hovered: boolean) => void,
  isSoftwareGl: boolean,
): InteractionController {
  camera.position.copy(INITIAL_CAMERA_POS);
  camera.lookAt(INITIAL_CAMERA_TARGET);

  const controls = new OrbitControls(camera, domElement);
  controls.target.copy(INITIAL_CAMERA_TARGET);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 8.5;
  controls.maxDistance = 30.0;
  controls.minPolarAngle = 0.24;
  controls.maxPolarAngle = Math.PI * 0.68;
  controls.rotateSpeed = 0.82;
  controls.zoomSpeed = 0.9;
  controls.update();

  let isResettingCamera = false;
  const onControlsStart = () => {
    isResettingCamera = false;
  };
  controls.addEventListener('start', onControlsStart);

  // Raycaster for house click & hover
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  let downX = 0;
  let downY = 0;
  let pointerIsDown = false;
  let lastHoverCheck = 0;
  let lastTriggerTime = 0;

  const updatePointerNdc = (clientX: number, clientY: number) => {
    const rect = domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  };

  const intersectsHouse = (clientX: number, clientY: number): boolean => {
    if (!updatePointerNdc(clientX, clientY)) return false;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(houseHitMeshes, true);
    return hits.length > 0;
  };

  const handleDown = (clientX: number, clientY: number) => {
    pointerIsDown = true;
    downX = clientX;
    downY = clientY;
  };

  const handleUp = (clientX: number, clientY: number) => {
    if (!pointerIsDown) return;
    pointerIsDown = false;
    domElement.style.cursor = 'grab';

    const now = performance.now();
    if (now - lastTriggerTime < 80) return;

    const moveDist = Math.hypot(clientX - downX, clientY - downY);

    // Distinguish genuine stationary click/tap from an orbit drag gesture
    if (moveDist < 7) {
      if (intersectsHouse(clientX, clientY)) {
        lastTriggerTime = now;
        onHouseClick();
      }
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    handleDown(e.clientX, e.clientY);
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    handleDown(e.clientX, e.clientY);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (pointerIsDown) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) {
        onHouseHover(false);
        domElement.style.cursor = 'grabbing';
      }
      return;
    }

    const now = performance.now();
    if (now - lastHoverCheck < 50) return;
    lastHoverCheck = now;

    const hit = intersectsHouse(e.clientX, e.clientY);
    onHouseHover(hit);
    domElement.style.cursor = hit ? 'pointer' : 'grab';
  };

  const onPointerUp = (e: PointerEvent) => {
    handleUp(e.clientX, e.clientY);
  };

  const onMouseUp = (e: MouseEvent) => {
    handleUp(e.clientX, e.clientY);
  };

  const onPointerLeave = () => {
    pointerIsDown = false;
    onHouseHover(false);
    domElement.style.cursor = 'grab';
  };

  domElement.style.cursor = 'grab';
  domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
  domElement.addEventListener('mousedown', onMouseDown, { capture: true });
  domElement.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { capture: true });
  window.addEventListener('mouseup', onMouseUp, { capture: true });
  domElement.addEventListener('pointerleave', onPointerLeave);

  return {
    controls,
    resetCamera: (instant = false) => {
      if (instant) {
        isResettingCamera = false;
        camera.position.copy(INITIAL_CAMERA_POS);
        controls.target.copy(INITIAL_CAMERA_TARGET);
        controls.update();
      } else {
        isResettingCamera = true;
      }
    },
    syncViewportAspect: (width: number, height: number) => {
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      camera.aspect = w / h;
      camera.fov = computeResponsiveFov(w, h);
      camera.updateProjectionMatrix();
    },
    update: (dt: number) => {
      if (isResettingCamera) {
        const speed = 8.5;
        camera.position.x = damp(camera.position.x, INITIAL_CAMERA_POS.x, speed, dt);
        camera.position.y = damp(camera.position.y, INITIAL_CAMERA_POS.y, speed, dt);
        camera.position.z = damp(camera.position.z, INITIAL_CAMERA_POS.z, speed, dt);

        controls.target.x = damp(controls.target.x, INITIAL_CAMERA_TARGET.x, speed, dt);
        controls.target.y = damp(controls.target.y, INITIAL_CAMERA_TARGET.y, speed, dt);
        controls.target.z = damp(controls.target.z, INITIAL_CAMERA_TARGET.z, speed, dt);

        if (
          camera.position.distanceToSquared(INITIAL_CAMERA_POS) < 0.002 &&
          controls.target.distanceToSquared(INITIAL_CAMERA_TARGET) < 0.002
        ) {
          camera.position.copy(INITIAL_CAMERA_POS);
          controls.target.copy(INITIAL_CAMERA_TARGET);
          isResettingCamera = false;
        }
      }
      controls.update();
    },
    dispose: () => {
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      domElement.removeEventListener('pointerdown', onPointerDown, { capture: true });
      domElement.removeEventListener('mousedown', onMouseDown, { capture: true });
      domElement.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
      window.removeEventListener('mouseup', onMouseUp, { capture: true });
      domElement.removeEventListener('pointerleave', onPointerLeave);
    },
  };
}
