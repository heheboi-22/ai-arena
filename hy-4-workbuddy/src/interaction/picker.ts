import * as THREE from 'three';
import type { House } from '../world/house';

/**
 * A tap on the cottage toggles its lights. An orbit drag that happens to start
 * or pass over the cottage must not: only a short, near-stationary press counts.
 */
export function attachHousePicker(
  dom: HTMLElement,
  camera: THREE.Camera,
  house: House,
  onToggle: () => void,
): void {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down: { x: number; y: number; t: number; id: number } | null = null;
  let dragged = false;
  let hoverCheck = 0;

  const hitsHouse = (clientX: number, clientY: number): boolean => {
    const r = dom.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(house.pickGroup.children, true).length > 0;
  };

  dom.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    dragged = false;
  });

  dom.addEventListener('pointermove', (e) => {
    if (down) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) dragged = true;
      return;
    }
    const now = performance.now();
    if (now - hoverCheck < 90) return;
    hoverCheck = now;
    dom.style.cursor = hitsHouse(e.clientX, e.clientY) ? 'pointer' : 'grab';
  });

  dom.addEventListener('pointerup', (e) => {
    if (!down || e.pointerId !== down.id) return;
    const quick = performance.now() - down.t < 650;
    const still = !dragged && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8;
    const isTap = quick && still;
    if (isTap && hitsHouse(e.clientX, e.clientY)) onToggle();
    down = null;
    dragged = false;
  });

  dom.addEventListener('pointercancel', () => { down = null; dragged = false; });
  dom.addEventListener('pointerleave', () => { dom.style.cursor = 'grab'; });
}
