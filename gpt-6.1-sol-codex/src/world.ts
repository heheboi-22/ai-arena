import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildIsland } from './island';
import { buildObjects } from './objects';
import { Environment } from './environment';
import { WorldStore } from './state';
import { showError } from './ui';

export class PocketWorld {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private island = new THREE.Group();
  private objects;
  private terrain;
  private environment: Environment;
  private elapsed = 0;
  private lastTime = 0;
  private frame = 0;
  private resizeFrame = 0;
  private stopped = false;
  private resetPending = false;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerStart: { x: number; y: number; id: number } | null = null;
  private pointerMoved = false;
  private pointerIds = new Set<number>();
  private homeTarget = new THREE.Vector3(0, -0.55, 0);
  private homePosition = new THREE.Vector3(11.5, 8.7, 14.5);

  constructor(private viewport: HTMLElement, private store: WorldStore) {
    const smallDevice = matchMedia('(max-width: 700px)').matches || navigator.hardwareConcurrency <= 4;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, smallDevice ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.setAttribute('aria-label', 'Floating island. Use arrow keys to orbit, plus and minus to zoom. Cottage lights also have a switch in the controls.');
    this.renderer.domElement.tabIndex = 0;
    this.viewport.append(this.renderer.domElement);
    this.scene.add(this.island);
    this.terrain = buildIsland(this.island);
    this.objects = buildObjects(this.island);
    this.environment = new Environment(this.scene, this.island, smallDevice);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.7;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 31;
    this.controls.minPolarAngle = Math.PI * 0.16;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    this.resize();
    this.camera.position.copy(this.homePosition);
    this.controls.target.copy(this.homeTarget);
    this.controls.update();
    this.controls.saveState();
    new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.resize());
    }).observe(this.viewport);
    this.bindInteraction();
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.stopped = true;
      cancelAnimationFrame(this.frame);
      showError('The graphics connection was interrupted. Reload to bring the island back.');
    });
    this.animate(performance.now(), true);
    document.querySelector('.loading')?.classList.add('loaded');
  }

  private resize() {
    const { width, height } = this.viewport.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.fov = this.camera.aspect < 1 ? THREE.MathUtils.clamp(35 / this.camera.aspect, 35, 58) : 35;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    const distance = this.camera.aspect < 0.9 ? 1.14 : 1;
    this.homePosition.set(11.5 * distance, 8.7 * distance, 14.5 * distance);
  }

  reset() {
    this.controls.reset();
    this.camera.position.copy(this.homePosition);
    this.controls.target.copy(this.homeTarget);
    this.controls.update();
    this.environment.resetMotion();
    this.objects.rotor.rotation.z = Math.PI / 8;
    this.elapsed = 0;
    this.resetPending = true;
  }

  private hitHouse(x: number, y: number) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((x - bounds.left) / bounds.width * 2 - 1, -(y - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.island, true)[0];
    if (!hit) return false;
    let item: THREE.Object3D | null = hit.object;
    while (item) {
      if (item === this.objects.house) return true;
      item = item.parent;
    }
    return false;
  }

  private bindInteraction() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', event => {
      this.pointerIds.add(event.pointerId);
      if (this.pointerIds.size > 1) this.pointerMoved = true;
      else { this.pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId }; this.pointerMoved = false; }
    });
    canvas.addEventListener('pointermove', event => {
      if (this.pointerStart && Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 6) this.pointerMoved = true;
      if (event.pointerType === 'mouse' && !this.pointerStart) canvas.style.cursor = this.hitHouse(event.clientX, event.clientY) ? 'pointer' : 'grab';
    });
    canvas.addEventListener('pointerup', event => {
      this.pointerIds.delete(event.pointerId);
      if (this.pointerStart?.id === event.pointerId && !this.pointerMoved && event.button === 0 &&
        this.hitHouse(event.clientX, event.clientY) && this.hitHouse(this.pointerStart.x, this.pointerStart.y)) this.store.toggleLights();
      this.pointerStart = null;
      canvas.style.cursor = 'grab';
    });
    canvas.addEventListener('pointercancel', event => { this.pointerIds.delete(event.pointerId); this.pointerStart = null; this.pointerMoved = true; });
    canvas.addEventListener('keydown', event => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const offset = this.camera.position.clone().sub(this.controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
      if (event.key === 'ArrowRight') spherical.theta += 0.12;
      if (event.key === 'ArrowUp') spherical.phi -= 0.08;
      if (event.key === 'ArrowDown') spherical.phi += 0.08;
      if (event.key === '+' || event.key === '=') spherical.radius *= 0.94;
      if (event.key === '-' || event.key === '_') spherical.radius *= 1.06;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi, this.controls.minPolarAngle, this.controls.maxPolarAngle);
      spherical.radius = THREE.MathUtils.clamp(spherical.radius, this.controls.minDistance, this.controls.maxDistance);
      this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(spherical));
      this.controls.update();
    });
    document.addEventListener('visibilitychange', () => { this.lastTime = performance.now(); });
  }

  private animate = (now: number, immediate = false) => {
    if (this.stopped) return;
    const dt = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = now;
    this.elapsed += dt;
    const instant = immediate || this.resetPending;
    this.resetPending = false;
    const environment = this.environment.update(dt, this.elapsed, this.store.state, this.reducedMotion.matches, instant);
    const motion = this.reducedMotion.matches ? 0.2 : 1;
    this.objects.rotor.rotation.z -= dt * environment.wind * 2.3 * motion;
    for (const tree of this.objects.trees) {
      tree.pivot.rotation.z = (Math.sin(this.elapsed * 1.6 + tree.phase) * 0.025 + 0.018) * environment.wind * motion;
      tree.pivot.rotation.x = Math.cos(this.elapsed * 1.2 + tree.phase) * 0.013 * environment.wind * motion;
    }
    this.objects.windowMaterial.emissiveIntensity = environment.lights * (0.8 + (1 - environment.day) * 1.35);
    this.objects.windowMaterial.color.set(environment.lights > 0.01 ? 0xc6a873 : 0x6e8582);
    this.objects.houseLight.intensity = environment.lights * (1.8 + (1 - environment.day) * 4.5);
    this.terrain.glintMaterial.opacity = 0.09 + environment.day * 0.26;
    this.terrain.glints.position.x = this.reducedMotion.matches ? 0 : Math.sin(this.elapsed * 0.8) * 0.04;
    this.terrain.waterMaterial.roughness = 0.26 + environment.rain * 0.2;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(time => this.animate(time));
  };

  snapshot() {
    const point = new THREE.Vector3(-1.45, 1.3, 0.18).project(this.camera);
    const bounds = this.renderer.domElement.getBoundingClientRect();
    return {
      state: { ...this.store.state }, environment: this.environment.snapshot(),
      camera: this.camera.position.toArray(), target: this.controls.target.toArray(),
      rotor: this.objects.rotor.rotation.z, treeSway: this.objects.trees[0].pivot.rotation.z,
      windowEmissive: this.objects.windowMaterial.emissiveIntensity,
      houseScreen: { x: bounds.left + (point.x + 1) / 2 * bounds.width, y: bounds.top + (1 - point.y) / 2 * bounds.height },
      render: { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles },
    };
  }
}
