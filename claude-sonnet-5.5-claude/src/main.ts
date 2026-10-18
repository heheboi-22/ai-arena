import './style.css';
import { App } from './app';
import { hasWebGL, showFatal } from './ui/fatal';

const stage = document.getElementById('stage');

if (!stage) {
  showFatal(new Error('The page is missing its #stage element.'));
} else if (!hasWebGL()) {
  showFatal(new Error('WebGL is not available in this browser.'), 'webgl');
} else {
  const fail = (err: unknown): void => {
    console.error(err);
    showFatal(err, /webgl/i.test(String(err)) ? 'webgl' : 'other');
  };
  try {
    new App(stage).start().catch(fail);
  } catch (err) {
    fail(err);
  }
}
