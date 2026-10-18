import * as THREE from 'three';

const DRAG_THRESHOLD_PX = 7;
const CLICK_MAX_MS = 500;

/**
 * Distinguishes a genuine click/tap on the house from an orbit drag:
 * only a short press with barely any movement counts as a click.
 * Also flips the canvas cursor to a pointer while hovering the house.
 */
export function createHousePicking(
  canvas: HTMLElement,
  camera: THREE.Camera,
  house: THREE.Object3D,
  onToggle: () => void,
): void {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const down = new THREE.Vector2();
  let downTime = 0;
  let hovered = false;

  const setRayFromEvent = (e: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
  };

  canvas.addEventListener('pointerdown', (e) => {
    down.set(e.clientX, e.clientY);
    downTime = performance.now();
  });

  canvas.addEventListener('pointerup', (e) => {
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const elapsed = performance.now() - downTime;
    if (moved > DRAG_THRESHOLD_PX || elapsed > CLICK_MAX_MS) return;
    setRayFromEvent(e);
    if (raycaster.intersectObject(house, true).length > 0) onToggle();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    setRayFromEvent(e);
    const hit = raycaster.intersectObject(house, true).length > 0;
    if (hit !== hovered) {
      hovered = hit;
      canvas.classList.toggle('is-hovering-house', hit);
    }
  });

  canvas.addEventListener('pointerleave', () => {
    hovered = false;
    canvas.classList.remove('is-hovering-house');
  });
}
