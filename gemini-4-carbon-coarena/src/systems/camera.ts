import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, damp, lerp } from '../utils/math';

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  reset: (immediate?: boolean) => void;
  resize: (width: number, height: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

// Unit view direction for initial flattering three-quarter miniature composition
const HOME_DIR = new THREE.Vector3(0.37, 0.285, 0.884).normalize();

export function createCameraRig(canvas: HTMLCanvasElement): CameraRig {
  const initW = Math.max(1, window.innerWidth);
  const initH = Math.max(1, window.innerHeight);

  const camera = new THREE.PerspectiveCamera(40, initW / initH, 0.1, 175);
  const controls = new OrbitControls(camera, canvas);

  controls.enableDamping = true;
  controls.dampingFactor = 0.068;
  controls.rotateSpeed = 0.78;
  controls.zoomSpeed = 0.88;
  controls.enablePan = true;
  controls.panSpeed = 0.5;
  controls.screenSpacePanning = true;

  // Sensible polar & distance limits so users can admire both meadow top and rocky underside without losing the island
  controls.minPolarAngle = 0.26; // ~15 deg from top
  controls.maxPolarAngle = Math.PI * 0.635; // ~114 deg (allows peeking upward under floating rock spire)
  controls.minDistance = 6.5;
  controls.maxDistance = 28;

  const homeTarget = new THREE.Vector3(0, 0.06, 0);
  const homePosition = new THREE.Vector3();
  let homeDistance = 16.9;

  let isResetting = false;

  function computeResponsiveFraming(width: number, height: number): void {
    const aspect = width / Math.max(1, height);

    // Widen vertical FOV slightly on portrait viewports and scale distance so the entire ~11.4u island fits cleanly
    if (aspect < 1.05) {
      const portraitT = clamp((1.05 - aspect) / 0.62, 0, 1);
      camera.fov = lerp(40, 46, portraitT);
      // Horizontal visible half-width = dist * tan(fov/2) * aspect >= 6.55
      const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      const minDistForWidth = 6.55 / Math.max(0.14, tanHalfV * aspect);
      homeDistance = Math.max(16.9, minDistForWidth);
      // Shift target slightly downward on mobile so the island floats comfortably above the compact bottom panel
      homeTarget.set(0, lerp(0.06, -1.15, portraitT), 0);
    } else {
      camera.fov = 40;
      homeDistance = 16.9;
      homeTarget.set(0, 0.06, 0);
    }

    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    controls.maxDistance = Math.max(26, homeDistance * 1.35);
    homePosition.copy(homeTarget).addScaledVector(HOME_DIR, homeDistance);
  }

  // Cancel smooth reset glide immediately if user starts orbiting/zooming (interruptible transitions)
  const onUserControlStart = (): void => {
    isResetting = false;
  };
  controls.addEventListener('start', onUserControlStart);

  function reset(immediate = false): void {
    if (immediate) {
      isResetting = false;
      controls.target.copy(homeTarget);
      camera.position.copy(homePosition);
      controls.update();
    } else {
      isResetting = true;
    }
  }

  function resize(width: number, height: number): void {
    const prevHomeDist = homeDistance;
    const prevTargetY = homeTarget.y;
    const currentOffset = camera.position.clone().sub(controls.target);
    const currentDist = currentOffset.length();

    computeResponsiveFraming(width, height);

    // Preserve user's relative zoom & orientation across desktop <-> mobile resizes without cropping
    if (prevHomeDist > 0.01 && currentDist > 0.01) {
      const distRatio = currentDist / prevHomeDist;
      const newDist = clamp(homeDistance * distRatio, controls.minDistance, controls.maxDistance);
      controls.target.y += homeTarget.y - prevTargetY;
      currentOffset.normalize().multiplyScalar(newDist);
      camera.position.copy(controls.target).add(currentOffset);
    }
    controls.update();
  }

  // Initialize framing & home pose immediately
  computeResponsiveFraming(initW, initH);
  reset(true);

  const panOffset = new THREE.Vector3();

  return {
    camera,
    controls,
    reset,
    resize,
    update(dt: number) {
      if (isResetting) {
        const speed = 7.5;
        controls.target.x = damp(controls.target.x, homeTarget.x, speed, dt);
        controls.target.y = damp(controls.target.y, homeTarget.y, speed, dt);
        controls.target.z = damp(controls.target.z, homeTarget.z, speed, dt);

        camera.position.x = damp(camera.position.x, homePosition.x, speed, dt);
        camera.position.y = damp(camera.position.y, homePosition.y, speed, dt);
        camera.position.z = damp(camera.position.z, homePosition.z, speed, dt);

        if (
          camera.position.distanceToSquared(homePosition) < 0.0008 &&
          controls.target.distanceToSquared(homeTarget) < 0.0008
        ) {
          controls.target.copy(homeTarget);
          camera.position.copy(homePosition);
          isResetting = false;
        }
      }

      controls.update();

      // Softly bound panning so the floating island can never be panned off-screen
      panOffset.copy(controls.target).sub(homeTarget);
      const maxPanRadius = 1.75;
      if (panOffset.lengthSq() > maxPanRadius * maxPanRadius) {
        const clampedTarget = homeTarget
          .clone()
          .add(panOffset.normalize().multiplyScalar(maxPanRadius));
        const delta = clampedTarget.sub(controls.target);
        controls.target.add(delta);
        camera.position.add(delta);
      }
    },
    dispose() {
      controls.removeEventListener('start', onUserControlStart);
      controls.dispose();
    },
  };
}
