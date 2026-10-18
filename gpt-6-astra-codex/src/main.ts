import './style.css';
import { createStore } from './state';
import { createUI } from './ui';
import { createWorld } from './scene';

const app = document.querySelector<HTMLDivElement>('#app')!;
const store = createStore();
let world: ReturnType<typeof createWorld> | undefined;
const ui = createUI(app, store, () => world?.resetCamera());
function showError(message: string) {
  document.querySelector('#loading')?.remove();
  const error = document.querySelector<HTMLDivElement>('#world-error')!;
  error.hidden = false;
  error.innerHTML = `<strong>A small pause.</strong><span>${message}</span><button type="button">Try again</button>`;
  error.querySelector('button')!.addEventListener('click', () => location.reload());
  app.querySelectorAll<HTMLInputElement | HTMLButtonElement>('.controls input, .controls button:not(#panel-toggle), .scene-tools button').forEach(input => { input.disabled = true; });
}

try {
  world = createWorld(ui.host, store);
  ui.zoomIn.addEventListener('click', () => world?.controls.dollyIn(1 / 1.15));
  ui.zoomOut.addEventListener('click', () => world?.controls.dollyOut(1 / 1.15));
  world.renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    world?.renderer.setAnimationLoop(null);
    showError('The connection to your graphics device was interrupted. Reload to bring your island back.');
  });
  document.querySelector('#loading')?.remove();
  if (import.meta.env.DEV) {
    Object.assign(window, { __pocketWorld: { world, store } });
  }
} catch (error) {
  console.error('Pocket World could not start:', error);
  showError('Your browser could not start the 3D world. Try a browser with WebGL 2 and hardware acceleration enabled.');
}

if (import.meta.hot) import.meta.hot.dispose(() => { world?.dispose(); ui.unsubscribe(); });
