import { CloudOff, RefreshCw } from 'lucide-react'
import { useAppData } from '../contexts/AppDataContext'
export function OfflineBanner(){const {syncState,refresh}=useAppData(); if(syncState==='synced')return null; return <div className={`sync-banner ${syncState}`}><CloudOff size={16}/><span>{syncState==='offline'?"You’re offline. Changes will sync when you’re back.":syncState==='syncing'?'Syncing changes…':'Sync needs attention. Your local changes are safe.'}</span>{syncState==='error'&&<button onClick={refresh} aria-label="Retry sync"><RefreshCw size={15}/></button>}</div>}
