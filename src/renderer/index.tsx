import { createRoot } from 'react-dom/client';
import App from './App';
import { ipcRenderer } from 'electron';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

ipcRenderer.on('navigate-back', () => {
  window.history.back();
});

root.render(<App />);
