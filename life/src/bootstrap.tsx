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
          <p>Reload once. If the problem remains, the diagnostic below identifies the failing code path.</p>
          <pre>{this.state.error.message}</pre>
          <button className="primary-button" onClick={() => location.reload()}>Reload JustGlance</button>
        </div>
      </div>
    )
  }
}

export function mountJustGlance() {
  const root = document.getElementById('root')
  if (!root) throw new Error('JG-BOOT-001: #root was not found in the deployed index.html')
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
}
