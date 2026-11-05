import './styles.css';
import { PocketWorldApp } from './app';
import { PocketStore } from './state';
import { Panel } from './ui/panel';

const boot = document.querySelector<HTMLElement>('#boot');
const fatal = document.querySelector<HTMLElement>('#fatal');
const fatalDetail = document.querySelector<HTMLElement>('#fatal-detail');
const retry = document.querySelector<HTMLButtonElement>('#fatal-retry');

const showFatal = (message: string): void => {
  if (!fatal || !fatalDetail) return;
  const shell = document.querySelector<HTMLElement>('.shell');
  if (shell) shell.hidden = true;
  if (boot) {
    boot.classList.add('is-hidden');
    window.setTimeout(() => {
      if (boot) boot.hidden = true;
    }, 700);
  }
  fatalDetail.textContent = message;
  fatal.hidden = false;
};

const hideBoot = (): void => {
  if (!boot) return;
  boot.classList.add('is-hidden');
  window.setTimeout(() => {
    if (boot) boot.hidden = true;
  }, 700);
};

const supportsWebGL = (): boolean => {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
};

retry?.addEventListener('click', () => window.location.reload());

const bootstrap = (): void => {
  if (!supportsWebGL()) {
    showFatal(
      'This browser or device could not start the 3D view. Try enabling hardware acceleration, or open the page in a current version of Chrome, Firefox, Safari, or Edge.'
    );
    return;
  }

  const stage = document.querySelector<HTMLElement>('#stage');
  if (!stage) {
    showFatal('The page is missing the space for the island. Reload to try again.');
    return;
  }

  const store = new PocketStore();
  let app: PocketWorldApp;

  try {
    app = new PocketWorldApp(stage, store, {
      onContextLost: () => {
        showFatal(
          'The browser released the 3D graphics context. Reload the page to return to the island.'
        );
      }
    });
  } catch (error) {
    console.error('Pocket World failed to start', error);
    showFatal(
      'The 3D view stopped while it was being built. Reload the page to try again.'
    );
    return;
  }

  const panel = new Panel(store, {
    onReset: () => {
      store.reset();
      app.resetView();
    },
    onLayoutChange: () => app.updateLayout()
  });

  app.start(panel.element);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(hideBoot);
  });
};

try {
  bootstrap();
} catch (error) {
  console.error('Pocket World failed to start', error);
  showFatal('The island could not be built. Reload the page to try again.');
}
