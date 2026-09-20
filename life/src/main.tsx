import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AppDataProvider } from './contexts/AppDataContext'
import App from './App'
import './styles/global.css'

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[JustGlance render]', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="fatal-error">
        <div className="fatal-error-card">
          <div className="brand-orb">J</div>
          <h1>JustGlance hit a startup problem.</h1>
          <p>The application loaded, but a component failed while rendering.</p>
          <pre>{this.state.error.message}</pre>
          <button className="primary-button" onClick={() => location.reload()}>Reload JustGlance</button>
        </div>
      </div>
    )
  }
}

function cleanupLegacyPwaState() {
  // Never block application startup on service-worker/cache cleanup.
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(
        registrations
          .filter(registration => registration.scope.includes('/life/'))
          .map(registration => registration.unregister()),
      ))
      .catch(error => console.warn('[JustGlance] Legacy worker cleanup skipped', error))
  }

  if ('caches' in window) {
    void caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('justglance-')).map(key => caches.delete(key)),
      ))
      .catch(error => console.warn('[JustGlance] Legacy cache cleanup skipped', error))
  }
}

const root = document.getElementById('root')
if (!root) throw new Error('JG-BOOT-001: #root was not found in index.html')

;(window as Window & { __JUSTGLANCE_MOUNTED__?: boolean }).__JUSTGLANCE_MOUNTED__ = true
cleanupLegacyPwaState()

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <HashRouter>
        <AuthProvider>
          <AppDataProvider>
            <App />
          </AppDataProvider>
        </AuthProvider>
      </HashRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
)
