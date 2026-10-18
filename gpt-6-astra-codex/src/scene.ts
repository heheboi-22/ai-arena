import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTerrain } from './world/terrain';
import { createHouse, createWindmill } from './world/buildings';
import { createNature } from './world/nature';
import { createEnvironment } from './environment';
import { damp } from './world/primitives';
import type { Store } from './state';

export function createWorld(host: HTMLElement, store: Store) {
  const compact = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.5 : 1.8));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Interactive floating island. Arrow keys orbit, plus and minus zoom. Tap the cottage to toggle its lights.');
  renderer.domElement.setAttribute('role', 'img');
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.075; controls.enablePan = false;
  controls.rotateSpeed = 0.5; controls.zoomSpeed = 0.65;
  controls.minPolarAngle = Math.PI * 0.16; controls.maxPolarAngle = Math.PI * 0.47;
  controls.cursorStyle = 'grab';
  const island = new THREE.Group(); scene.add(island);
  const terrain = createTerrain(island);
  const house = createHouse(island);
  const rotor = createWindmill(island);
  const trees = createNature(island);
  const environment = createEnvironment(scene, compact);

  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(41,55,40,0.19)'); gradient.addColorStop(0.5, 'rgba(41,55,40,0.09)'); gradient.addColorStop(1, 'rgba(41,55,40,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(11, 8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -3.85; scene.add(shadow);
  }
  const unlitGlass = new THREE.Color('#344d48'), litGlass = new THREE.Color('#ffd483');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = media.matches, disposed = false, elapsed = 0, lightLevel = 0, previousTime = 0;
  let fitDistance = 21;
  function setReduced() { reduced = media.matches; }
  media.addEventListener('change', setReduced);
  function setCamera() {
    controls.target.set(0, 0.5, 0);
    camera.position.set(9.5, 7.4, 12).normalize().multiplyScalar(fitDistance).add(controls.target);
    controls.update(); controls.saveState();
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const oldFit = fitDistance;
    camera.aspect = width / height;
    fitDistance = Math.max(21, 14.5 / camera.aspect);
    controls.minDistance = fitDistance * 0.65; controls.maxDistance = fitDistance * 1.55;
    if (previousTime === 0) setCamera();
    else {
      camera.position.sub(controls.target).multiplyScalar(fitDistance / oldFit).add(controls.target);
      controls.position0.copy(new THREE.Vector3(9.5, 7.4, 12).normalize().multiplyScalar(fitDistance).add(controls.target0));
    }
    camera.updateProjectionMatrix(); renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(devicePixelRatio, width < 650 ? 1.5 : 1.8));
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host); resize();
  function resetCamera() {
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    controls.reset(); setCamera(); controls.enableDamping = damping;
  }

  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let start: { x: number; y: number; id: number; time: number } | null = null;
  let dragged = false;
  const touches = new Set<number>();
  function hitHouse(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(island, true)[0];
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object) { if (object === house.house) return true; object = object.parent; }
    return false;
  }
  const onDown = (event: PointerEvent) => {
    touches.add(event.pointerId);
    if (touches.size > 1) { dragged = true; return; }
    if (event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId, time: performance.now() }; dragged = false;
  };
  const onMove = (event: PointerEvent) => {
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) dragged = true;
    if (!start && event.pointerType === 'mouse') renderer.domElement.style.cursor = hitHouse(event) ? 'pointer' : 'grab';
  };
  const onUp = (event: PointerEvent) => {
    touches.delete(event.pointerId);
    if (start?.id === event.pointerId && !dragged && performance.now() - start.time < 650 && hitHouse(event)) store.set({ lights: !store.get().lights });
    if (!touches.size) start = null;
  };
  const onCancel = (event: PointerEvent) => { touches.delete(event.pointerId); start = null; dragged = true; };
  const onKey = (event: KeyboardEvent) => {
    const step = 0.13;
    switch (event.key) {
      case 'ArrowLeft': controls.rotateLeft(step); break;
      case 'ArrowRight': controls.rotateLeft(-step); break;
      case 'ArrowUp': controls.rotateUp(step); break;
      case 'ArrowDown': controls.rotateUp(-step); break;
      case '+': case '=': controls.dollyIn(1 / 1.12); break;
      case '-': controls.dollyOut(1 / 1.12); break;
      default: return;
    }
    event.preventDefault(); controls.update();
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointercancel', onCancel);
  renderer.domElement.addEventListener('keydown', onKey);

  function frame(now: number) {
    if (disposed) return;
    const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 1 / 60;
    previousTime = now;
    if (document.hidden) return;
    elapsed += dt;
    const state = store.get();
    const env = environment.update(state, dt, elapsed, reduced);
    rotor.rotation.z -= dt * env.wind * 2.0 * (reduced ? 0.4 : 1);
    for (const tree of trees) {
      const strength = env.wind * (reduced ? 0.008 : 0.035);
      tree.pivot.rotation.z = Math.sin(elapsed * 1.45 + tree.phase) * strength;
      tree.pivot.rotation.x = Math.sin(elapsed * 1.1 + tree.phase) * strength * 0.45;
    }
    lightLevel = damp(lightLevel, state.lights ? 1 : 0, 8, dt);
    house.glass.color.copy(unlitGlass).lerp(litGlass, lightLevel);
    house.glass.emissiveIntensity = lightLevel * (0.55 + env.night * 2.0);
    house.porchLight.intensity = lightLevel * (1.5 + env.night * 5);
    house.sideLight.intensity = lightLevel * (0.5 + env.night * 2);
    terrain.waterLines.position.x = Math.sin(elapsed * 0.65) * (reduced ? 0 : 0.025);
    controls.update(dt); renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);
  function dispose() {
    disposed = true; renderer.setAnimationLoop(null); resizeObserver.disconnect(); controls.dispose();
    media.removeEventListener('change', setReduced);
    renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointermove', onMove);
    renderer.domElement.removeEventListener('pointerup', onUp); renderer.domElement.removeEventListener('pointercancel', onCancel);
    renderer.domElement.removeEventListener('keydown', onKey);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    scene.traverse(object => {
      const drawable = object as THREE.Mesh;
      if (drawable.geometry) geometries.add(drawable.geometry);
      if (drawable.material) (Array.isArray(drawable.material) ? drawable.material : [drawable.material]).forEach(m => materials.add(m));
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => { (m as THREE.MeshBasicMaterial).map?.dispose(); m.dispose(); });
    renderer.dispose(); renderer.domElement.remove();
  }
  return { resetCamera, dispose, renderer, scene, camera, controls, house, trees, rotor, environment };
}
