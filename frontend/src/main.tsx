import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './shared/styles.css';
import './shared/page-transition.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('缺少 #root 挂载节点');
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const splashMinMs = reducedMotion ? 600 : 1800;
const splashMaxMs = 4000;
const splashFadeMs = 300;
const splashStartedAt = performance.now();
let splashLeaving = false;

function removeSplash(): void {
  const splash = document.getElementById('app-splash');
  if (!splash || splashLeaving) return;
  splashLeaving = true;
  splash.classList.add('app-splash--leaving');
  window.setTimeout(() => splash.remove(), splashFadeMs);
}

function scheduleSplashHide(): void {
  const elapsed = performance.now() - splashStartedAt;
  window.setTimeout(removeSplash, Math.max(0, splashMinMs - elapsed));
}

window.setTimeout(removeSplash, splashMaxMs);
window.setTimeout(scheduleSplashHide, 0);

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);