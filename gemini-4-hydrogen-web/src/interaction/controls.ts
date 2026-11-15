import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const INITIAL_CAMERA_POSITION = new THREE.Vector3(10.6, 6.8, 12.2);
export const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0.25, 0);

export interface InteractionRig {
  controls: OrbitControls;
  triggerResetCamera: (immediate?: boolean) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createInteractionRig(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  interactiveHouseMeshes: THREE.Object3D[],
  onToggleHouseLights: () => void,
  isSoftwareGl: boolean
): InteractionRig {
  camera.position.copy(INITIAL_CAMERA_POSITION);
  camera.lookAt(INITIAL_CAMERA_TARGET);

  const controls = new OrbitControls(camera, domElement);
  controls.target.copy(INITIAL_CAMERA_TARGET);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.minDistance = 8.8;
  controls.maxDistance = 26;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = Math.PI * 0.72;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.85;
  controls.update();

  let resettingCamera = false;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  let downX = 0;
  let downY = 0;
  let downTime = 0;
  let pointerIdActive: number | null = null;
  let lastHoverCheck = 0;

  const updateNdc = (clientX: number, clientY: number) => {
    const rect = domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return true;
  };

  const hitsHouse = (clientX: number, clientY: number): boolean => {
    if (!updateNdc(clientX, clientY)) return false;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(interactiveHouseMeshes, false);
    return hits.length > 0;
  };

  const onControlStart = () => {
    resettingCamera = false;
  };
  controls.addEventListener("start", onControlStart);

  const onPointerDown = (e: PointerEvent) => {
    if (!e.isPrimary) {
      pointerIdActive = null;
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointerIdActive = e.pointerId;
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (pointerIdActive !== e.pointerId) return;
    pointerIdActive = null;
    const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
    const elapsedMs = performance.now() - downTime;
    // Distinguish tap/click from camera orbit drag
    if (dist < 6 && elapsedMs < 420 && hitsHouse(e.clientX, e.clientY)) {
      onToggleHouseLights();
    }
  };

  const onPointerCancel = () => {
    pointerIdActive = null;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const now = performance.now();
    if (now - lastHoverCheck < 50) return;
    lastHoverCheck = now;
    if (pointerIdActive !== null) {
      domElement.style.cursor = "grabbing";
      return;
    }
    domElement.style.cursor = hitsHouse(e.clientX, e.clientY) ? "pointer" : "grab";
  };

  domElement.style.cursor = "grab";
  domElement.addEventListener("pointerdown", onPointerDown);
  domElement.addEventListener("pointerup", onPointerUp);
  domElement.addEventListener("pointercancel", onPointerCancel);
  domElement.addEventListener("pointermove", onPointerMove);

  const triggerResetCamera = (immediate = false) => {
    if (immediate) {
      resettingCamera = false;
      camera.position.copy(INITIAL_CAMERA_POSITION);
      controls.target.copy(INITIAL_CAMERA_TARGET);
      controls.update();
      return;
    }
    resettingCamera = true;
  };

  const update = (dt: number) => {
    if (resettingCamera) {
      const alpha = 1 - Math.exp(-6.5 * dt);
      camera.position.lerp(INITIAL_CAMERA_POSITION, alpha);
      controls.target.lerp(INITIAL_CAMERA_TARGET, alpha);
      if (
        camera.position.distanceTo(INITIAL_CAMERA_POSITION) < 0.03 &&
        controls.target.distanceTo(INITIAL_CAMERA_TARGET) < 0.02
      ) {
        camera.position.copy(INITIAL_CAMERA_POSITION);
        controls.target.copy(INITIAL_CAMERA_TARGET);
        resettingCamera = false;
      }
    }
    controls.update();
  };

  const dispose = () => {
    controls.removeEventListener("start", onControlStart);
    domElement.removeEventListener("pointerdown", onPointerDown);
    domElement.removeEventListener("pointerup", onPointerUp);
    domElement.removeEventListener("pointercancel", onPointerCancel);
    domElement.removeEventListener("pointermove", onPointerMove);
    controls.dispose();
  };

  return {
    controls,
    triggerResetCamera,
    update,
    dispose,
  };
}

