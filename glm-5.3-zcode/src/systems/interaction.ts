import * as THREE from 'three';

export interface Picker {
  dispose: () => void;
}

/**
 * Distinguishes a deliberate tap from an orbit gesture: a pointerup counts
 * only if it landed within a few pixels (and under a second) of its
 * pointerdown. Also shows a pointer cursor while hovering the target.
 */
export function createPicker(
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  targets: THREE.Object3D[],
  onHouseTap: () => void,
): Picker {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  let downX = 0;
  let downY = 0;
  let downTime = 0;
  let downId = -1;

  const hitTest = (clientX: number, clientY: number): boolean => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(targets, true).length > 0;
  };

  const onPointerDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
    downId = e.pointerId;
  };

  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== downId) return;
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    const elapsed = performance.now() - downTime;
    if (moved < 8 && elapsed < 600 && hitTest(e.clientX, e.clientY)) {
      onHouseTap();
    }
  };

  let hoverClock = 0;
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const now = performance.now();
    if (now - hoverClock < 120) return;
    hoverClock = now;
    canvas.style.cursor = hitTest(e.clientX, e.clientY) ? 'pointer' : 'grab';
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointermove', onPointerMove);
    },
  };
}
