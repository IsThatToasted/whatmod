import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/app.css';

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Aurelium Field render failure', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="boot-failure" role="alert">
          <div className="boot-failure-card">
            <div className="brand-mark">A</div>
            <h1>Aurelium Field couldn’t finish loading.</h1>
            <p>The app shell loaded, but the interface encountered an unexpected browser error.</p>
            <button type="button" onClick={() => window.location.reload()}>Reload app</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Aurelium Field root element is missing.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

// v0.2 rollback reliability safeguard:
// Retire any older Aurelium service worker/cache state so a stale Vite shell
// cannot point at chunks from a previous deployment and leave a white screen.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const appRegistrations = registrations.filter((registration) => {
        try {
          return new URL(registration.scope).pathname.startsWith('/app/');
        } catch {
          return false;
        }
      });

      const hadController = Boolean(navigator.serviceWorker.controller);
      await Promise.all(appRegistrations.map((registration) => registration.unregister()));

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith('aurelium-field')).map((key) => caches.delete(key)));
      }

      // An already-active worker keeps control until the document reloads.
      // Reload once after unregistering it so subsequent loads are network-only.
      if (hadController && sessionStorage.getItem('aurelium-sw-retired') !== '1') {
        sessionStorage.setItem('aurelium-sw-retired', '1');
        window.location.reload();
      }
    } catch (error) {
      console.warn('Aurelium Field cache cleanup skipped', error);
    }
  });
}
