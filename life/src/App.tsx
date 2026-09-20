import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useAppData } from './contexts/AppDataContext'
import { Shell } from './components/Shell'
import AuthPage from './pages/AuthPage'
import NowPage from './pages/NowPage'
import LaterPage from './pages/LaterPage'
import SpacesPage from './pages/SpacesPage'
import SpacePage from './pages/SpacePage'
import YouPage from './pages/YouPage'
import SettingsPage from './pages/SettingsPage'
import OnboardingPage from './pages/OnboardingPage'
import SearchPage from './pages/SearchPage'
import DebugPage from './pages/DebugPage'
import InvitePage from './pages/InvitePage'
import PasswordRecoveryPage from './pages/PasswordRecoveryPage'

export default function App(){
  const {userId,loading:authLoading,demo,recoveryMode}=useAuth(); const {profile,loading:dataLoading}=useAppData()
  useEffect(()=>{const root=document.documentElement;const theme=profile?.theme||'system';if(theme==='system')delete root.dataset.theme;else root.dataset.theme=theme},[profile?.theme])
  if(authLoading || (userId && dataLoading)) return <div className="splash"><div className="brand-orb">J</div><strong>JustGlance</strong><span>Getting your day ready…</span></div>
  if(!userId && !demo) return <AuthPage />
  if(userId && recoveryMode && !demo) return <PasswordRecoveryPage />
  if(userId && (!profile || !profile.onboarding_complete) && !demo) return <OnboardingPage />
  return <Routes>
    <Route element={<Shell/>}>
      <Route index element={<Navigate to="/now" replace/>}/>
      <Route path="/now" element={<NowPage/>}/>
      <Route path="/later" element={<LaterPage/>}/>
      <Route path="/spaces" element={<SpacesPage/>}/>
      <Route path="/spaces/:id" element={<SpacePage/>}/>
      <Route path="/you" element={<YouPage/>}/>
      <Route path="/settings" element={<SettingsPage/>}/>
      <Route path="/search" element={<SearchPage/>}/>
      <Route path="/debug" element={<DebugPage/>}/>
      <Route path="/invite/:token" element={<InvitePage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/now" replace/>}/>
  </Routes>
}
