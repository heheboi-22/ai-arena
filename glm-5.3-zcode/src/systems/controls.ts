import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { easeInOutCubic } from '../lib/math';
import { CAMERA_START } from '../world/layout';

export interface CameraRig {
  controls: OrbitControls;
  /** smooth flight home; cancelled the moment the user grabs the camera */
  flyHome: (durationMs?: number) => void;
  update: (dt: number) => void;
}

export function createControls(camera: THREE.PerspectiveCamera, canvas: HTMLElement): CameraRig {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.85;
  controls.enablePan = false; // the island stays the hero of every frame
  controls.minDistance = 8.5;
  controls.maxDistance = 24;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = 1.92; // a little past horizontal to peek below
  controls.target.set(...CAMERA_START.target);

  // portrait screens pull back (kept in sync with main.ts) so reset restores
  // the same responsive framing the page loaded with
  const homePos = new THREE.Vector3(...CAMERA_START.pos);
  if (camera.aspect < 0.8) homePos.multiplyScalar(1.24);
  const homeTarget = new THREE.Vector3(...CAMERA_START.target);

  let tween: {
    fromPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    t: number;
    dur: number;
    instant: boolean;
  } | null = null;

  controls.addEventListener('start', () => {
    tween = null;
  });

  return {
    controls,
    flyHome(durationMs = 950) {
      tween = {
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
        t: 0,
        dur: durationMs / 1000,
        instant: false,
      };
    },
    update(dt) {
      if (tween) {
        tween.t += dt;
        const k = easeInOutCubic(Math.min(tween.t / tween.dur, 1));
        camera.position.lerpVectors(tween.fromPos, homePos, k);
        controls.target.lerpVectors(tween.fromTarget, homeTarget, k);
        if (tween.t >= tween.dur) tween = null;
      }
      controls.update();
    },
  };
}
