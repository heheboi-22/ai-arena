import './style.css';
import { WorldStore } from './state';
import { mountUI, showError } from './ui';
import { PocketWorld } from './world';

const store = new WorldStore();
let world: PocketWorld | undefined;
const viewport = mountUI(document.getElementById('app')!, store, () => world?.reset());

try {
  world = new PocketWorld(viewport, store);
  if (import.meta.env.DEV) {
    Object.defineProperty(window, '__pocketWorld', { value: { snapshot: () => world?.snapshot() }, configurable: true });
  }
} catch (error) {
  console.error('Pocket World could not start:', error);
  showError('Your browser could not start the 3D scene. Enable hardware acceleration or try a browser with WebGL 2 support, then reload.');
}
