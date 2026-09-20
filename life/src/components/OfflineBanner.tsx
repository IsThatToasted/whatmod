import { CloudOff, RefreshCw } from 'lucide-react';
import { useLife } from '../providers/LifeProvider';
export function OfflineBanner(){const {online,syncState}=useLife();if(online&&syncState==='synced')return null;return <div className="offline-banner"><CloudOff size={16}/>{!online?"You're offline. Changes stay safe on this device.":<><RefreshCw size={15} className="spin"/>Syncing changes…</>}</div>}
