import * as THREE from 'three';

export const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, -0.5, 0);
export const INITIAL_CAMERA_FOV = 40;
export const INITIAL_CAMERA_BASE_DISTANCE = 16.5;

// Flattering 3/4 view angle showing cottage facade, pond, windmill, and sculpted rocky underside
export const INITIAL_CAMERA_DIRECTION = new THREE.Vector3(9.4, 6.2, 12.1).normalize();

export function computeResponsiveCameraDistance(
  aspect: number,
  baseDistance = INITIAL_CAMERA_BASE_DISTANCE
): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  if (safeAspect >= 1.05) {
    return baseDistance;
  }
  const scale = Math.min(2.25, 1.16 / Math.max(0.48, safeAspect));
  return baseDistance * scale;
}
