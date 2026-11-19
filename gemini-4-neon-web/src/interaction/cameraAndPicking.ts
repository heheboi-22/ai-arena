import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface CameraViewPreset {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export interface PointerGestureTracker {
  isClickGesture: (downX: number, downY: number, upX: number, upY: number, durationMs: number) => boolean;
}

export const CLICK_DRAG_THRESHOLD_PX = 6;
export const CLICK_MAX_DURATION_MS = 450;

/** Pure helper to distinguish a deliberate click/tap from an orbit drag gesture. */
export function isClickGesture(
  downX: number,
  downY: number,
  upX: number,
  upY: number,
  durationMs: number
): boolean {
  const dist = Math.hypot(upX - downX, upY - downY);
  return dist <= CLICK_DRAG_THRESHOLD_PX && durationMs <= CLICK_MAX_DURATION_MS;
}

/**
 * Computes a flattering three-quarter camera view that shows the entire island
 * including its sculpted floating underside on both desktop and narrow mobile screens.
 */
export function getInitialCameraPreset(aspect: number): CameraViewPreset {
  // Dynamically pull back on portrait mobile screens so the entire island width & underside fit with margin
  const safeAspect = Math.max(0.38, aspect);
  const portraitScale =
    safeAspect < 0.95 ? Math.min(2.25, 1.06 / safeAspect) : safeAspect < 1.25 ? 1.18 : 1.0;

  return {
    position: new THREE.Vector3(15.2 * portraitScale, 6.7 * portraitScale, 19.8 * portraitScale),
    target: new THREE.Vector3(0.0, -0.32, 0.0),
  };
}

export interface CameraAndPickingSystem {
  controls: OrbitControls;
  resetCamera: (immediate?: boolean) => void;
  updateAspectPreset: (aspect: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createCameraAndPicking(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  houseHitTargets: THREE.Object3D[],
  isSoftwareGl: boolean,
  onHouseClick: () => void,
  onHouseHoverChange: (hovered: boolean) => void
): CameraAndPickingSystem {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.065;
  controls.enablePan = false; // Prevent unrestricted panning that loses the island
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.rotateSpeed = 0.78;
  controls.zoomSpeed = 0.85;
  controls.minDistance = 9.5;
  controls.maxDistance = 58.0;
  // Allow peeking below the rim to admire the sculpted underside while preventing disorienting inversions
  controls.minPolarAngle = 0.24;
  controls.maxPolarAngle = Math.PI * 0.64;

  let currentAspect = Math.max(0.4, domElement.clientWidth / Math.max(1, domElement.clientHeight));
  const initialPreset = getInitialCameraPreset(currentAspect);
  controls.maxDistance = Math.max(38.0, initialPreset.position.length() * 1.4);
  camera.position.copy(initialPreset.position);
  controls.target.copy(initialPreset.target);
  controls.update();

  // Interruptible smooth camera reset transition
  let resetting = false;
  const resetTargetPos = new THREE.Vector3();
  const resetTargetLook = new THREE.Vector3();

  const cancelReset = () => {
    resetting = false;
  };
  controls.addEventListener("start", cancelReset);

  // Raycaster for house click & hover feedback
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pointerDownId: number | null = null;
  let downX = 0;
  let downY = 0;
  let downTime = 0;
  let lastHoverCheck = 0;
  let currentlyHovered = false;

  const updateNdc = (clientX: number, clientY: number) => {
    const rect = domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  };

  const raycastHouse = (clientX: number, clientY: number): boolean => {
    if (!updateNdc(clientX, clientY)) return false;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(houseHitTargets, true);
    return hits.length > 0;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (pointerDownId !== null) {
      // Multi-touch pinch/orbit: cancel single-tap tracking
      pointerDownId = null;
      return;
    }
    pointerDownId = e.pointerId;
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (pointerDownId === null || e.pointerId !== pointerDownId) return;
    const elapsedMs = performance.now() - downTime;
    const wasClick = isClickGesture(downX, downY, e.clientX, e.clientY, elapsedMs);
    pointerDownId = null;

    if (wasClick && raycastHouse(e.clientX, e.clientY)) {
      onHouseClick();
    }
  };

  const onPointerCancel = () => {
    pointerDownId = null;
  };

  const onPointerMove = (e: PointerEvent) => {
    // Only hover-test for mouse pointers when not dragging
    if (e.pointerType !== "mouse" || pointerDownId !== null) {
      if (currentlyHovered) {
        currentlyHovered = false;
        domElement.style.cursor = "grab";
        onHouseHoverChange(false);
      }
      return;
    }
    const now = performance.now();
    if (now - lastHoverCheck < 45) return;
    lastHoverCheck = now;

    const hit = raycastHouse(e.clientX, e.clientY);
    if (hit !== currentlyHovered) {
      currentlyHovered = hit;
      domElement.style.cursor = hit ? "pointer" : "grab";
      onHouseHoverChange(hit);
    }
  };

  domElement.style.cursor = "grab";
  domElement.addEventListener("pointerdown", onPointerDown);
  domElement.addEventListener("pointerup", onPointerUp);
  domElement.addEventListener("pointercancel", onPointerCancel);
  domElement.addEventListener("pointermove", onPointerMove);

  return {
    controls,
    updateAspectPreset: (aspect: number) => {
      currentAspect = Math.max(0.4, aspect);
    },
    resetCamera: (immediate = false) => {
      const preset = getInitialCameraPreset(currentAspect);
      if (immediate || isSoftwareGl) {
        resetting = false;
        camera.position.copy(preset.position);
        controls.target.copy(preset.target);
        controls.update();
      } else {
        resetTargetPos.copy(preset.position);
        resetTargetLook.copy(preset.target);
        resetting = true;
      }
    },
    update: (dt: number) => {
      if (resetting) {
        const k = 1 - Math.exp(-6.5 * dt);
        camera.position.lerp(resetTargetPos, k);
        controls.target.lerp(resetTargetLook, k);
        if (
          camera.position.distanceToSquared(resetTargetPos) < 0.002 &&
          controls.target.distanceToSquared(resetTargetLook) < 0.001
        ) {
          camera.position.copy(resetTargetPos);
          controls.target.copy(resetTargetLook);
          resetting = false;
        }
      }
      controls.update();
    },
    dispose: () => {
      controls.removeEventListener("start", cancelReset);
      domElement.removeEventListener("pointerdown", onPointerDown);
      domElement.removeEventListener("pointerup", onPointerUp);
      domElement.removeEventListener("pointercancel", onPointerCancel);
      domElement.removeEventListener("pointermove", onPointerMove);
      controls.dispose();
    },
  };
}
