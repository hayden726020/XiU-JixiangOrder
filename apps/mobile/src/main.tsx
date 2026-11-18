import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './shared/styles.css';
import './shared/page-transition.css';
import { disableNativeTextSelection } from './shared/noNativeTextSelection';

disableNativeTextSelection();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('缺少 #root 挂载节点');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}