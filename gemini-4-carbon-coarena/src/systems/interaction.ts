import * as THREE from 'three';

export interface InteractionOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.Camera;
  hitTargets: THREE.Object3D[];
  onHouseClick: () => void;
}

/**
 * Distinguishes an intentional click/tap on the 3D cottage from an OrbitControls camera drag.
 * Updates hover cursor feedback on desktop pointers.
 */
export function setupHouseInteraction(options: InteractionOptions): () => void {
  const { canvas, camera, hitTargets, onHouseClick } = options;

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

  let activePointerId: number | null = null;
  let downX = 0;
  let downY = 0;
  let downTime = 0;
  let maxTravelPx = 0;
  let isDragging = false;

  const DRAG_THRESHOLD_PX = 6;
  const MAX_CLICK_DURATION_MS = 550;

  function updateNDC(clientX: number, clientY: number): void {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  }

  function hitsHouse(clientX: number, clientY: number): boolean {
    updateNDC(clientX, clientY);
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(hitTargets, true);
    return hits.length > 0;
  }

  function onPointerDown(e: PointerEvent): void {
    // Only primary button for mouse; allow touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    activePointerId = e.pointerId;
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
    maxTravelPx = 0;
    isDragging = false;
  }

  function onPointerMove(e: PointerEvent): void {
    if (activePointerId !== null && e.pointerId === activePointerId) {
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > maxTravelPx) {
        maxTravelPx = dist;
      }
      if (maxTravelPx > DRAG_THRESHOLD_PX) {
        isDragging = true;
        canvas.style.cursor = 'grabbing';
      }
      return;
    }

    // Hover cursor feedback when not dragging on mouse pointers
    if (e.pointerType === 'mouse' && activePointerId === null) {
      canvas.style.cursor = hitsHouse(e.clientX, e.clientY) ? 'pointer' : 'grab';
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (activePointerId === null || e.pointerId !== activePointerId) return;

    const elapsedMs = performance.now() - downTime;
    const finalDist = Math.max(maxTravelPx, Math.hypot(e.clientX - downX, e.clientY - downY));
    activePointerId = null;

    if (!isDragging && finalDist <= DRAG_THRESHOLD_PX && elapsedMs <= MAX_CLICK_DURATION_MS) {
      if (hitsHouse(e.clientX, e.clientY)) {
        onHouseClick();
      }
    }

    if (e.pointerType === 'mouse') {
      canvas.style.cursor = hitsHouse(e.clientX, e.clientY) ? 'pointer' : 'grab';
    } else {
      canvas.style.cursor = '';
    }
  }

  function onPointerCancel(e: PointerEvent): void {
    if (activePointerId === e.pointerId) {
      activePointerId = null;
      isDragging = false;
      canvas.style.cursor = 'grab';
    }
  }

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
  };
}
