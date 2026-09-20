import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { CaptureSheet } from './components/CaptureSheet';
import { DesktopSidebar } from './components/DesktopSidebar';
import { OfflineBanner } from './components/OfflineBanner';
import { AuthPage } from './pages/AuthPage';
import { DebugPage } from './pages/DebugPage';
import { LaterPage } from './pages/LaterPage';
import { NowPage } from './pages/NowPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { SpacesPage } from './pages/SpacesPage';
import { YouPage } from './pages/YouPage';
import { useLife } from './providers/LifeProvider';

export default function App(){
  const {authMode,profile}=useLife();
  const [capture,setCapture]=useState(false);
  useEffect(()=>{
    const theme=profile?.theme??'system'; document.documentElement.dataset.theme=theme;
  },[profile?.theme]);
  if(authMode==='loading') return <div className="splash"><div className="loader"/><b>JustGlance</b><span>Getting your day ready…</span></div>;
  if(authMode==='signed-out') return <AuthPage/>;
  if(authMode==='signed-in' && profile && !profile.onboarding_complete) return <OnboardingPage/>;
  return <div className="app-shell"><OfflineBanner/><DesktopSidebar onCapture={()=>setCapture(true)}/><main className="main-pane"><Routes><Route path="/" element={<Navigate to="/now" replace/>}/><Route path="/now" element={<NowPage/>}/><Route path="/later" element={<LaterPage/>}/><Route path="/spaces" element={<SpacesPage/>}/><Route path="/search" element={<SearchPage/>}/><Route path="/you" element={<YouPage/>}/><Route path="/settings" element={<SettingsPage/>}/><Route path="/debug" element={<DebugPage/>}/><Route path="*" element={<Navigate to="/now" replace/>}/></Routes></main><aside className="context-pane"><div className="context-card"><span className="section-kicker">Quick thought</span><h3>Capture first.<br/>Organize later.</h3><p>JustGlance will infer what it can and quietly surface it when useful.</p><button className="primary wide" onClick={()=>setCapture(true)}>+ Add something</button></div><div className="context-card subtle"><span className="section-kicker">Tip</span><p>Try: “Buy toothpaste next time I’m at Walmart.”</p></div></aside><BottomNav onCapture={()=>setCapture(true)}/><CaptureSheet open={capture} onClose={()=>setCapture(false)}/></div>
}
