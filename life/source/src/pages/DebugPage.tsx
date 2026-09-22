import { useAppData } from '../contexts/AppDataContext'
import { useAuth } from '../contexts/AuthContext'
import { APP_VERSION, HAS_SUPABASE, featureFlags } from '../lib/config'
import { getTimePeriod } from '../lib/time'
import { queueSize } from '../lib/offlineQueue'
export default function DebugPage(){const {userId,demo}=useAuth();const {items,spaces,syncState}=useAppData();if(!Boolean((import.meta as any).env?.DEV)&&location.search!=='?debug=1')return <div className="page"><h1>Not found</h1></div>;return <div className="page"><header className="page-header compact"><div><span className="eyebrow">DEVELOPMENT</span><h1>Debug panel</h1></div></header><pre className="debug-pre">{JSON.stringify({version:APP_VERSION,userId,demo,supabaseConfigured:HAS_SUPABASE,syncState,loadedItems:items.length,spaces:spaces.length,contextPeriod:getTimePeriod(),online:navigator.onLine,offlineQueue:queueSize(userId),serviceWorker:'serviceWorker' in navigator,featureFlags},null,2)}</pre></div>}
