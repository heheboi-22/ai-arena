import * as THREE from 'three';

export interface PickerOptions {
  dom: HTMLElement;
  camera: THREE.Camera;
  target: THREE.Object3D; // house group
  onToggle: () => void;
}

const MOVE_THRESHOLD = 6; // px
const TAP_MAX_MS = 400;

/**
 * Fires `onToggle` only on a genuine tap/click on the house — never when the
 * pointer is dragging the camera. Works for mouse and touch.
 */
export function createPicker(opts: PickerOptions): void {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downX = 0;
  let downY = 0;
  let downT = 0;
  let moved = false;

  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    downX = e.clientX;
    downY = e.clientY;
    downT = performance.now();
    moved = false;
  };

  const onMove = (e: PointerEvent): void => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > MOVE_THRESHOLD) {
      moved = true;
    }
  };

  const onUp = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const isTap = !moved && performance.now() - downT < TAP_MAX_MS;
    if (!isTap) return;

    const rect = opts.dom.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, opts.camera);
    const hits = raycaster.intersectObject(opts.target, true);
    if (hits.length > 0) opts.onToggle();
  };

  opts.dom.addEventListener('pointerdown', onDown);
  opts.dom.addEventListener('pointermove', onMove);
  opts.dom.addEventListener('pointerup', onUp);
  opts.dom.addEventListener('pointercancel', () => {
    moved = true;
  });
}
