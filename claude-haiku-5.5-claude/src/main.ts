import './styles.css';
import { startApp } from './app';
import { showNotice } from './ui/notice';

try {
  startApp();
} catch (error) {
  console.error(error);
  showNotice('Pocket World could not start. Open the browser console for details.');
}
