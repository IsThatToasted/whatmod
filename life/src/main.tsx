import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AppDataProvider } from './contexts/AppDataContext'
import App from './App'
import './styles/global.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/life/service-worker.js').catch(()=>{}))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider><AppDataProvider><App /></AppDataProvider></AuthProvider>
    </HashRouter>
  </React.StrictMode>
)
