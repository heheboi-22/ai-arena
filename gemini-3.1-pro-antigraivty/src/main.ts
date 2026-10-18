import { initUI } from './UI';
import { initWorld } from './World';

function bootstrap() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const errorScreen = document.getElementById('error-screen') as HTMLElement;

  try {
    initUI();
    initWorld(canvas);
  } catch (e) {
    console.error('Initialization failed:', e);
    if (errorScreen) {
      errorScreen.classList.remove('hidden');
    }
  }
}

// Ensure DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
