import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildScene } from './Builder';
import type { SceneObjects } from './Builder';
import { Environment } from './Environment';
import { state } from './State';

export function initWorld(canvas: HTMLCanvasElement) {
  let isPointerDown = false;
  let pointerDownPos = new THREE.Vector2();
  
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 25;
  controls.maxPolarAngle = Math.PI / 2 + 0.1; 

  const ctx: SceneObjects = buildScene();
  scene.add(ctx.root);

  const environment = new Environment(scene, ctx);

  const resetCamera = () => {
    camera.position.set(12, 8, 12);
    controls.target.set(0, 1, 0);
    controls.update();
  };
  resetCamera();

  (window as any).resetWorldCamera = resetCamera;

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onPointerDown(event: PointerEvent) {
    if ((event.target as HTMLElement).tagName !== 'CANVAS') return;
    isPointerDown = true;
    pointerDownPos.set(event.clientX, event.clientY);
  }

  function onPointerUp(event: PointerEvent) {
    if (!isPointerDown) return;
    isPointerDown = false;
    
    const dist = pointerDownPos.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
    if (dist > 5) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(ctx.root.children, true);
    for (let i = 0; i < intersects.length; i++) {
       if (intersects[i].object.userData.isHouse) {
           const current = state.get('houseLights');
           state.set('houseLights', !current);
           break;
       }
    }
  }

  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    
    let dt = clock.getDelta();
    if (dt > 0.1) dt = 0.1;
    
    const timeElapsed = clock.elapsedTime;

    controls.update();
    
    environment.update(state.getAll(), dt, timeElapsed);

    renderer.render(scene, camera);
  }

  animate();
}
