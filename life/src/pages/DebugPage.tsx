import { calculateRelevanceScore, getDayPeriod } from '../lib/contextEngine';
import { flags } from '../lib/flags';
import { hasSupabase } from '../lib/supabase';
import { useLife } from '../providers/LifeProvider';
export function DebugPage(){const {authMode,items,mood,online,syncState}=useLife();return <div className="page"><header className="page-head"><span className="eyebrow">Development only</span><h1>Debug</h1></header><pre className="debug-box">{JSON.stringify({authMode,supabaseConfigured:hasSupabase,online,syncState,period:getDayPeriod(),mood,itemCount:items.length,flags,scores:items.filter(i=>i.status!=='completed').map(i=>({title:i.title,score:calculateRelevanceScore(i,mood)}))},null,2)}</pre></div>}
