import * as THREE from 'three';

/**
 * Click-vs-drag discrimination: a press/release pair only counts as a click
 * when it stayed put (< 7 px) and was short (< 400 ms), so orbiting across
 * the house never toggles its lights.
 */
export function makeClickPicker(
  dom: HTMLElement,
  camera: THREE.PerspectiveCamera,
  target: THREE.Object3D,
  raycaster: THREE.Raycaster,
  onPick: () => void,
): void {
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let active = false;

  dom.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    startX = e.clientX;
    startY = e.clientY;
    startT = performance.now();
    active = true;
  });

  dom.addEventListener('pointerup', (e) => {
    if (!active) return;
    active = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (dx * dx + dy * dy > 49 || performance.now() - startT > 400) return;

    const rect = dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.intersectObject(target, true).length > 0) onPick();
  });
}
