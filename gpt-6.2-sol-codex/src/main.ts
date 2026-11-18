import * as T from 'three';
import { makeEnvironment } from './environment';
import { makeTerrain } from './terrain';
import { bindControls } from './ui';
import { makeView, pickHouse } from './view';
import './style.css';

const stage = document.querySelector<HTMLElement>('.stage')!;
const viewport = document.querySelector<HTMLElement>('#viewport')!;
const fallback = document.querySelector<HTMLElement>('#fallback')!;

function showFallback(message?: string) {
  if (message) fallback.textContent = message;
  fallback.hidden = false;
  viewport.hidden = true;
  document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('#controls input, #controls button')
    .forEach(control => { control.disabled = true; });
}

function start() {
  const smallScreen = matchMedia('(max-width: 800px), (pointer: coarse)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Interactive 3D island');
  viewport.append(canvas);

  const view = makeView(canvas);
  const scene = new T.Scene();
  makeTerrain(scene);
  const environment = makeEnvironment(scene, stage, smallScreen.matches);
  const { settings, toggleLights } = bindControls(view.reset);
  pickHouse(canvas, view.camera, scene, environment.house, toggleLights);

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = viewport;
    if (width < 1 || height < 1) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, smallScreen.matches ? 1.35 : 1.65));
    renderer.setSize(width, height, false);
    view.resize(width, height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  resize();
  view.reset();
  environment.update(settings, 0, reducedMotion.matches, true);

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    observer.disconnect();
    showFallback('The 3D view stopped. Reload Pocket World to reopen it.');
  });
  let previous: number | undefined;
  renderer.setAnimationLoop(now => {
    const delta = Math.min(.05, (now - (previous ?? now)) / 1000);
    previous = now;
    view.controls.enableDamping = !reducedMotion.matches;
    if (!reducedMotion.matches) {
      view.controls.dampingFactor = T.MathUtils.clamp(1 - Math.exp(-delta * 9), .02, .4);
    }
    view.controls.update(delta);
    environment.update(settings, delta, reducedMotion.matches);
    renderer.render(scene, view.camera);
  });
}

try {
  start();
} catch (error) {
  if (error instanceof Error && !error.message.includes('WebGL context')) console.error(error);
  showFallback();
}
