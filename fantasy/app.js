// OAuth rescue: if Supabase/Google ever returns to an old localhost Site URL,
// immediately move the auth hash back to the permanent hosted app.
(function rescueLocalhostOAuthRedirect(){
  const PROD_URL = 'https://whatmod.com/fantasy/';
  const isBadLocalhost = window.location.hostname === 'localhost' && window.location.port === '3000';
  const hasAuthHash = window.location.hash && /access_token|refresh_token|error_description/.test(window.location.hash);
  if (isBadLocalhost && hasAuthHash) {
    window.location.replace(PROD_URL + window.location.hash);
  }
})();

const CONFIG = window.FV_CONFIG || {};
const KEY = 'afterglowDatingV1';
const supa = (() => {
  try {
    if (!CONFIG.USE_SUPABASE || !window.supabase || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_PUBLISHABLE_KEY) return null;
    return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  } catch { return null; }
})();
let authUser = null;
let bootingRemote = false;

let people = [];
let directoryLoaded = false;
let directoryRefreshTimer = null;
let lastDirectoryFingerprint = '';
const DIRECTORY_REFRESH_MS = 120000;
const CHAT_REFRESH_MS = 120000;
const MESSAGE_RETENTION_HOURS = 72;
let activeChatKey = null;
let chatRefreshTimer = null;
let chatCache = {};

const DEFAULT_CATEGORY_META = {
  'Anticipation': {emoji:'⏳', theme:'theme-adventure'},
  'Communication': {emoji:'💬', theme:'theme-communication'},
  'Romance': {emoji:'🌹', theme:'theme-romance'},
  'Sensory': {emoji:'🫦', theme:'theme-sensory'},
  'Fantasy': {emoji:'🎭', theme:'theme-fantasy'},
  'Power': {emoji:'⚡', theme:'theme-power'},
  'Privacy': {emoji:'🔒', theme:'theme-privacy'},
  'Adventure': {emoji:'📍', theme:'theme-adventure'},
  'Lifestyle': {emoji:'✨', theme:'theme-lifestyle'},
  'Sex Drive': {emoji:'🔥', theme:'theme-drive'},
  'Care': {emoji:'💞', theme:'theme-care'},
  'Boundaries': {emoji:'🛑', theme:'theme-boundaries'}
};

const DEFAULT_VAULT_CARDS = [
  {id:'slow-tease',cat:'Anticipation',title:'Slow teasing and anticipation',desc:'Building desire over time through flirting, patience, and delayed gratification.'},
  {id:'praise',cat:'Communication',title:'Praise and encouragement',desc:'Enjoying affirming language, compliments, and feeling desired.'},
  {id:'dirty-talk',cat:'Communication',title:'Spicy language',desc:'Comfort with bolder flirtation and desire-focused words.'},
  {id:'direct-talk',cat:'Communication',title:'Direct desire talk',desc:'Being open about wants, limits, timing, and attraction.'},
  {id:'soft-romance',cat:'Romance',title:'Soft romantic intimacy',desc:'Candles, closeness, affection, tenderness, and emotional warmth.'},
  {id:'sensory',cat:'Sensory',title:'Sensory-focused play',desc:'Exploring touch, temperature, sound, scent, and atmosphere.'},
  {id:'blindfold',cat:'Sensory',title:'Blindfold curiosity',desc:'Interest in reduced sight and heightened trust-based sensation.'},
  {id:'roleplay',cat:'Fantasy',title:'Role-play themes',desc:'Creating fictional scenarios, characters, or playful dynamics together.'},
  {id:'fantasy-writing',cat:'Fantasy',title:'Shared fantasy writing',desc:'Writing prompts, scenarios, or private stories together.'},
  {id:'power-dynamic',cat:'Power',title:'Power exchange curiosity',desc:'Interest in negotiated leading/following dynamics with clear consent.'},
  {id:'switch-energy',cat:'Power',title:'Switch energy',desc:'Enjoying both taking initiative and letting someone else lead.'},
  {id:'light-restraint',cat:'Power',title:'Light restraint curiosity',desc:'Interest in safe, negotiated restraint with clear boundaries.'},
  {id:'private-photos',cat:'Privacy',title:'Private photo comfort',desc:'Comfort with consensual private photos under strict privacy rules.'},
  {id:'public-flirt',cat:'Adventure',title:'Subtle public flirtation',desc:'Enjoying discreet chemistry in public without crossing boundaries.'},
  {id:'spontaneous',cat:'Lifestyle',title:'Spontaneous chemistry',desc:'Liking unexpected flirtation and unplanned intimate moments.'},
  {id:'planned',cat:'Lifestyle',title:'Planned intimate dates',desc:'Enjoying anticipation through scheduled time, outfits, and preparation.'},
  {id:'high-frequency',cat:'Sex Drive',title:'High desire frequency',desc:'Feeling happiest with frequent intimacy and ongoing flirtation.'},
  {id:'quality-over',cat:'Sex Drive',title:'Quality over frequency',desc:'Preferring intentional connected intimacy over constant availability.'},
  {id:'aftercare',cat:'Care',title:'Aftercare and decompression',desc:'Comfort, reassurance, cuddling, or check-ins after intense moments.'},
  {id:'hard-boundaries',cat:'Boundaries',title:'Clear hard-limit talks',desc:'Explicit yes/no/maybe conversations before trying anything new.'},
  {id:'check-ins',cat:'Boundaries',title:'In-the-moment check-ins',desc:'Using signals and quick questions to keep everyone comfortable.'}
];

const DEFAULT_LABELS = {love:'😍 Love', enjoy:'😏 Enjoy', curious:'👀 Curious', neutral:'😌 Neutral', no:'🙅 No', limit:'🛑 Limit'};
let categoryMeta = structuredClone(DEFAULT_CATEGORY_META);
let vaultCards = structuredClone(DEFAULT_VAULT_CARDS);
let labels = structuredClone(DEFAULT_LABELS);
const ADMIN_EMAIL = 'ra1nonit1@gmail.com';
let index = 0;
let mode = 'nearby';
let state = load();
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function defaultProfileForAuth(user){
  const meta = user?.user_metadata || {};
  const emailName = (user?.email || '').split('@')[0] || '';
  const displayName = (meta.full_name || meta.name || emailName || '').trim();
  return {
    displayName,
    headline:'',
    city:'',
    sex:'',
    radius:'50 miles',
    lookingFor:'Intimate connection',
    interests:'',
    bio:'',
    avatarUrl: meta.avatar_url || meta.picture || ''
  };
}
function base(user=null){
  return {
    ageOk:false,
    userId:user?.id || getDeviceId(),
    profile:defaultProfileForAuth(user),
    ratings:{},
    liked:[],
    passed:[],
    rewards:{glowCoins:0,streak:0,lastClaimDate:'',claimedToday:false},
    inventory:{owned:[],equipped:{}},
    weeklyGoals:{},
    meta:{schemaVersion:2,clientId:getClientId(),lastSyncedAt:'',lastServerRevision:0,localRecordFound:false,serverRecordFound:false},
    updatedAt:new Date().toISOString()
  };
}
function getDeviceId(){let id=localStorage.getItem('fvDeviceId'); if(!id){id='local-'+crypto.randomUUID(); localStorage.setItem('fvDeviceId',id);} return id;}
function getClientId(){let id=localStorage.getItem('afterglowClientId'); if(!id){id='client-'+crypto.randomUUID(); localStorage.setItem('afterglowClientId',id);} return id;}
function userStorageKey(user=authUser){ return user?.id ? `${KEY}:${user.id}` : KEY; }
function backupStorageKey(user=authUser){ return `afterglowBackupsV2:${user?.id || 'guest'}`; }
const RECOVERY_DB_NAME='afterglowRecoveryV2';
const RECOVERY_DB_STORE='latestStates';
let recoveryDbPromise=null;
function openRecoveryDb(){
  if(!window.indexedDB) return Promise.resolve(null);
  if(recoveryDbPromise) return recoveryDbPromise;
  recoveryDbPromise=new Promise(resolve=>{
    try{
      const req=indexedDB.open(RECOVERY_DB_NAME,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(RECOVERY_DB_STORE)) db.createObjectStore(RECOVERY_DB_STORE,{keyPath:'key'});};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>resolve(null);
      req.onblocked=()=>resolve(null);
    }catch{resolve(null);}
  });
  return recoveryDbPromise;
}
async function mirrorStateToRecoveryDb(key,value){
  try{
    const db=await openRecoveryDb(); if(!db) return false;
    return await new Promise(resolve=>{
      const tx=db.transaction(RECOVERY_DB_STORE,'readwrite');
      tx.objectStore(RECOVERY_DB_STORE).put({key,state:deepCopy(value),updatedAt:new Date().toISOString()});
      tx.oncomplete=()=>resolve(true); tx.onerror=()=>resolve(false); tx.onabort=()=>resolve(false);
    });
  }catch{return false;}
}
async function readStateFromRecoveryDb(key){
  try{
    const db=await openRecoveryDb(); if(!db) return null;
    return await new Promise(resolve=>{
      const tx=db.transaction(RECOVERY_DB_STORE,'readonly');
      const req=tx.objectStore(RECOVERY_DB_STORE).get(key);
      req.onsuccess=()=>resolve(req.result?.state||null); req.onerror=()=>resolve(null);
    });
  }catch{return null;}
}
function deepCopy(value){ try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value));} }
function normalizeArray(value){ return Array.isArray(value) ? [...new Set(value.map(String))] : []; }
function isoWeekKey(value=new Date()){
  const d=new Date(Date.UTC(value.getFullYear(),value.getMonth(),value.getDate()));
  const day=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week=Math.ceil((((d-yearStart)/86400000)+1)/7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}
function normalizeState(input={}, user=null){
  const seed=base(user);
  const next={...seed,...(input||{})};
  next.profile={...seed.profile,...((input||{}).profile||{})};
  next.ratings=((input||{}).ratings && typeof input.ratings==='object' && !Array.isArray(input.ratings)) ? input.ratings : {};
  next.liked=normalizeArray((input||{}).liked);
  next.passed=normalizeArray((input||{}).passed);
  next.rewards={...seed.rewards,...((input||{}).rewards||{}),...(((input||{}).profile||{}).rewards||{})};
  next.rewards.glowCoins=Math.max(0,Number(next.rewards.glowCoins||0));
  next.rewards.streak=Math.max(0,Number(next.rewards.streak||0));
  next.inventory={...seed.inventory,...(((input||{}).profile||{}).inventory||{}),...((input||{}).inventory||{})};
  next.inventory.owned=normalizeArray(next.inventory.owned);
  next.inventory.equipped=(next.inventory.equipped && typeof next.inventory.equipped==='object') ? next.inventory.equipped : {};
  next.weeklyGoals={...(((input||{}).profile||{}).weeklyGoals||{}),...((input||{}).weeklyGoals||{})};
  if(next.weeklyGoals.week && next.weeklyGoals.week!==isoWeekKey()) next.weeklyGoals={week:isoWeekKey(),completed:{}};
  next.meta={...seed.meta,...((input||{}).meta||{}),schemaVersion:2,clientId:getClientId()};
  next.updatedAt=(input||{}).updatedAt || new Date().toISOString();
  next.userId=user?.id || next.userId || getDeviceId();
  next.profile.rewards=next.rewards;
  next.profile.inventory=next.inventory;
  next.profile.weeklyGoals=next.weeklyGoals;
  return next;
}
function load(user=null){
  try{
    const raw=localStorage.getItem(userStorageKey(user));
    if(!raw) return base(user);
    const loaded=normalizeState(JSON.parse(raw)||{},user);
    loaded.meta.localRecordFound=true;
    return loaded;
  }catch{return base(user);}
}
function stateMetrics(value){
  const s=normalizeState(value||{});
  return {
    ratings:Object.keys(s.ratings||{}).length,
    profile:Object.values(s.profile||{}).filter(v=>typeof v==='string'?v.trim():v).length,
    liked:(s.liked||[]).length,
    passed:(s.passed||[]).length,
    owned:(s.inventory?.owned||[]).length,
    weekly:Object.keys(s.weeklyGoals?.completed||{}).length
  };
}
function snapshotLocalState(value, reason='autosave', force=false){
  try{
    const source=normalizeState(value||state,authUser);
    const list=JSON.parse(localStorage.getItem(backupStorageKey())||'[]');
    const now=Date.now();
    const last=list[0];
    if(!force && last && now-new Date(last.createdAt).getTime()<5*60*1000) return;
    const signature=JSON.stringify([source.updatedAt,stateMetrics(source),source.rewards?.glowCoins]);
    if(last?.signature===signature) return;
    list.unshift({id:crypto.randomUUID(),createdAt:new Date().toISOString(),reason,signature,state:source});
    localStorage.setItem(backupStorageKey(),JSON.stringify(list.slice(0,25)));
  }catch(err){ console.warn('Local snapshot skipped',err); }
}
let localSaveWarningShown=false;
function persistStateLocalOnly(reason='local'){
  state=normalizeState(state,authUser);
  state.updatedAt=state.updatedAt || new Date().toISOString();
  state.meta.lastLocalReason=reason;
  state.meta.localRecordFound=true;
  const key=userStorageKey();
  const payload=JSON.stringify(state);
  let saved=false;
  try{ localStorage.setItem(key,payload); saved=true; }
  catch(err){
    // Quota pressure should never make a user action crash. Trim only old
    // snapshots, preserve the live state, then retry once.
    try{
      const backups=JSON.parse(localStorage.getItem(backupStorageKey())||'[]');
      if(Array.isArray(backups)) localStorage.setItem(backupStorageKey(),JSON.stringify(backups.slice(0,3)));
      localStorage.setItem(key,payload); saved=true;
    }catch(retryErr){
      console.error('Afterglow local save failed',retryErr);
      state.meta.localStorageErrorAt=new Date().toISOString();
      if(!localSaveWarningShown){
        localSaveWarningShown=true;
        try{showToast('Browser storage is full. Your cloud sync and recovery database are still being attempted.');}catch{}
      }
    }
  }
  // IndexedDB is an independent second browser copy. It is intentionally not
  // deleted by the normal local-cache reset, so it can act as a recovery layer.
  mirrorStateToRecoveryDb(key,state);
  return saved;
}
function save(reason='change'){
  const key=userStorageKey();
  let previous=null;
  try{previous=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  if(previous){
    const before=stateMetrics(previous), after=stateMetrics(state);
    const destructive=after.ratings<before.ratings || after.owned<before.owned || after.weekly<before.weekly;
    snapshotLocalState(previous,destructive?'before_destructive_change':'autosave',destructive);
  }
  state=normalizeState(state,authUser);
  state.updatedAt=new Date().toISOString();
  persistStateLocalOnly(reason);
  renderVaultStats(); renderMatches(); renderChats();
  debounceSync(reason);
  window.dispatchEvent(new CustomEvent('afterglow:state-saved',{detail:{reason,updatedAt:state.updatedAt}}));
}
function repairProfileForAuth(profile={}, user){
  const defaults = defaultProfileForAuth(user);
  const fixed = {...defaults, ...(profile||{})};
  if((fixed.displayName || '').trim().toLowerCase() === 'brian' && (defaults.displayName || '').trim().toLowerCase() !== 'brian'){
    fixed.displayName = defaults.displayName;
    if((fixed.city || '').trim().toLowerCase() === 'york, pa') fixed.city = '';
  }
  if(!fixed.displayName) fixed.displayName = defaults.displayName;
  if(!fixed.avatarUrl && defaults.avatarUrl) fixed.avatarUrl = defaults.avatarUrl;
  return fixed;
}
function loadStateForAuthUser(user){
  const next = load(user);
  next.ageOk = true;
  next.userId = user.id;
  next.profile = repairProfileForAuth(next.profile, user);
  return normalizeState(next,user);
}
function isoTime(value){ const n=Date.parse(value||''); return Number.isFinite(n)?n:0; }
function mergeObjectPreservingValues(older={},newer={}){
  const out={...(older||{})};
  Object.entries(newer||{}).forEach(([key,val])=>{
    if(val && typeof val==='object' && !Array.isArray(val) && out[key] && typeof out[key]==='object' && !Array.isArray(out[key])) out[key]=mergeObjectPreservingValues(out[key],val);
    else if(val!=='' && val!==null && val!==undefined) out[key]=val;
    else if(!(key in out)) out[key]=val;
  });
  return out;
}
function mergeRewards(a={},b={}){
  const ad=String(a.lastClaimDate||''), bd=String(b.lastClaimDate||'');
  const recent=bd>=ad?b:a;
  return {...a,...b,...recent,glowCoins:Math.max(Number(a.glowCoins||0),Number(b.glowCoins||0)),streak:Number(recent.streak||0)};
}
function mergeDurableStates(localValue,remoteValue,user=authUser){
  const local=normalizeState(localValue||{},user), remote=normalizeState(remoteValue||{},user);
  const localDurable=!!(local.meta?.localRecordFound||local.meta?.serverRecordFound);
  const remoteDurable=!!(remote.meta?.localRecordFound||remote.meta?.serverRecordFound);
  const localNewer=localDurable!==remoteDurable ? localDurable : isoTime(local.updatedAt)>=isoTime(remote.updatedAt);
  const newer=localNewer?local:remote, older=localNewer?remote:local;
  const merged=normalizeState({...older,...newer},user);
  merged.profile=repairProfileForAuth(mergeObjectPreservingValues(older.profile,newer.profile),user);
  merged.ratings={...(older.ratings||{}),...(newer.ratings||{})};
  merged.liked=normalizeArray([...(older.liked||[]),...(newer.liked||[])]);
  merged.passed=normalizeArray([...(older.passed||[]),...(newer.passed||[])]);
  (newer.liked||[]).forEach(id=>{merged.passed=merged.passed.filter(x=>x!==String(id));});
  (newer.passed||[]).forEach(id=>{merged.liked=merged.liked.filter(x=>x!==String(id));});
  merged.rewards=mergeRewards(older.rewards,newer.rewards);
  merged.inventory={...older.inventory,...newer.inventory};
  merged.inventory.owned=normalizeArray([...(older.inventory?.owned||[]),...(newer.inventory?.owned||[])]);
  merged.inventory.equipped={...(older.inventory?.equipped||{}),...(newer.inventory?.equipped||{})};
  merged.inventory.custom={...(older.inventory?.custom||{}),...(newer.inventory?.custom||{})};
  const olderWeek=older.weeklyGoals?.week||'', newerWeek=newer.weeklyGoals?.week||'';
  if(olderWeek && newerWeek && olderWeek===newerWeek){
    const olderCompleted=older.weeklyGoals?.completed||{}, newerCompleted=newer.weeklyGoals?.completed||{};
    merged.weeklyGoals={...older.weeklyGoals,...newer.weeklyGoals,completed:{...olderCompleted,...newerCompleted}};
  }else if(newerWeek===isoWeekKey()) merged.weeklyGoals=deepCopy(newer.weeklyGoals);
  else if(olderWeek===isoWeekKey()) merged.weeklyGoals=deepCopy(older.weeklyGoals);
  else merged.weeklyGoals=deepCopy(newer.weeklyGoals||{week:isoWeekKey(),completed:{}});
  merged.updatedAt=newer.updatedAt || new Date().toISOString();
  merged.meta={...older.meta,...newer.meta,localRecordFound:!!(older.meta?.localRecordFound||newer.meta?.localRecordFound),serverRecordFound:!!(older.meta?.serverRecordFound||newer.meta?.serverRecordFound),lastServerRevision:Math.max(Number(older.meta?.lastServerRevision||0),Number(newer.meta?.lastServerRevision||0)),lastSyncedAt:(isoTime(older.meta?.lastSyncedAt)>=isoTime(newer.meta?.lastSyncedAt)?older.meta?.lastSyncedAt:newer.meta?.lastSyncedAt)||'',schemaVersion:2,clientId:getClientId()};
  merged.profile.rewards=merged.rewards; merged.profile.inventory=merged.inventory; merged.profile.weeklyGoals=merged.weeklyGoals;
  return normalizeState(merged,user);
}
function remoteRowToState(row,user=authUser){
  if(!row) return base(user);
  return normalizeState({
    userId:row.user_id,
    profile:row.profile||{},ratings:row.ratings||{},liked:row.liked||[],passed:row.passed||[],
    inventory:row.inventory || row.profile?.inventory || {},
    weeklyGoals:row.weekly_goals || row.profile?.weeklyGoals || {},
    rewards:row.profile?.rewards || {},
    updatedAt:row.client_updated_at || row.updated_at,
    meta:{lastServerRevision:Number(row.sync_revision||0),lastSyncedAt:row.last_synced_at||row.updated_at||'',schemaVersion:Number(row.state_version||2),serverRecordFound:true}
  },user);
}
function legacyLocalCandidate(user){
  try{
    const raw=JSON.parse(localStorage.getItem(KEY)||'null');
    if(!raw) return null;
    const candidate=normalizeState(raw,user);
    candidate.meta.localRecordFound=true;
    const signedName=(defaultProfileForAuth(user).displayName||'').trim().toLowerCase();
    const candidateName=(candidate.profile?.displayName||'').trim().toLowerCase();
    if(isAdmin() || !candidateName || candidateName===signedName) return candidate;
  }catch{}
  return null;
}
function isMissingRpcError(err){ const text=`${err?.code||''} ${err?.message||''} ${err?.details||''}`.toLowerCase(); return text.includes('pgrst202')||text.includes('42883')||text.includes('could not find the function')||text.includes('does not exist'); }
function isUuidValue(value){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||'')); }
let syncTimer=null, syncRetryTimer=null, syncInFlight=false, syncQueued=false, syncFailures=0;
function debounceSync(reason='change'){
  clearTimeout(syncTimer);
  state.meta={...(state.meta||{}),pendingSyncReason:reason};
  syncTimer=setTimeout(()=>syncToSupabase(false,reason),900);
}
function scheduleSyncRetry(){
  clearTimeout(syncRetryTimer);
  const delay=Math.min(60000,Math.max(2500,2500*Math.pow(2,Math.min(syncFailures,5))));
  syncRetryTimer=setTimeout(()=>{ if(navigator.onLine!==false) syncToSupabase(false,'retry'); },delay);
}
function syncPayloadFromState(source=state){
  const s=normalizeState(source,authUser);
  const publicProfile={...s.profile}; delete publicProfile.rewards; delete publicProfile.inventory; delete publicProfile.weeklyGoals;
  // Base64 previews can be hundreds of KB or more. They belong only in the
  // browser while an image is being prepared; durable avatars live in Storage.
  // Omitting the key is safe because fv_save_my_state merges profile keys with
  // the existing server profile rather than clearing omitted values.
  if(/^data:image\//i.test(String(publicProfile.avatarUrl||''))) delete publicProfile.avatarUrl;
  return {profile:publicProfile,ratings:s.ratings,liked:(s.liked||[]).filter(isUuidValue),passed:(s.passed||[]).filter(isUuidValue),inventory:s.inventory,weeklyGoals:s.weeklyGoals};
}
async function syncToSupabase(show=true,reason='sync',retrying=false){
  if(bootingRemote) return;
  // An explicit sync supersedes any pending debounce for the same local state.
  // This prevents save()+sync call sites from producing a second write ~900ms later.
  clearTimeout(syncTimer); syncTimer=null;
  if(!supa){setSync('offline-safe local save'); if(show) showToast('Saved safely on this device.'); return;}
  if(!authUser){setSync('local only — sign in to sync'); if(show) showToast('Sign in with Google before syncing.'); return;}
  if(syncInFlight){syncQueued=true; return;}
  syncInFlight=true;
  try{
    const payload=syncPayloadFromState(state);
    const {data,error}=await supa.rpc('fv_save_my_state',{
      p_profile:payload.profile,p_ratings:payload.ratings,p_liked:payload.liked,p_passed:payload.passed,
      p_inventory:payload.inventory,p_weekly_goals:payload.weeklyGoals,p_client_updated_at:state.updatedAt,
      p_client_id:getClientId(),p_state_version:2,p_reason:String(reason||'sync').slice(0,80),p_base_revision:Number(state.meta?.lastServerRevision||0)
    });
    if(error){
      if(isMissingRpcError(error)) throw new Error('Protected cloud sync is unavailable.');
      throw error;
    }
    const result=Array.isArray(data)?data[0]:data;
    if(result?.row){
      const serverState=remoteRowToState(result.row,authUser);
      if(result.status==='conflict' && !retrying){
        snapshotLocalState(state,'before_cloud_conflict_merge',true);
        state=mergeDurableStates(state,serverState,authUser);
        state.updatedAt=new Date().toISOString(); persistStateLocalOnly('cloud_conflict_merge');
        syncQueued=true;
        return;
      }
      state.meta.lastServerRevision=Number(result.row.sync_revision||state.meta.lastServerRevision||0);
      state.meta.lastSyncedAt=result.row.last_synced_at||new Date().toISOString();
    }
    syncFailures=0; clearTimeout(syncRetryTimer); persistStateLocalOnly('synced');
    setSync('protected cloud sync'); if(show) showToast('Profile and Vault data are safely synced.');
  }catch(err){
    syncFailures++;
    setSync('saved locally — cloud retry queued');
    scheduleSyncRetry();
    if(show) showToast('Saved on this device. Cloud sync will retry automatically.');
    console.warn('Protected sync failed',err);
  }finally{
    syncInFlight=false;
    if(syncQueued){syncQueued=false; setTimeout(()=>syncToSupabase(false,'queued'),50);}
  }
}
let walletRecoveryRequestInFlight=false;
async function requestLegacyWalletRecovery(localRewards,serverBalance,metrics){
  if(walletRecoveryRequestInFlight || !supa || !authUser) return;
  const requested=Math.max(0,Math.round(Number(localRewards?.glowCoins||0)));
  if(requested<=Number(serverBalance||0)) return;
  walletRecoveryRequestInFlight=true;
  try{
    const last=/^\d{4}-\d{2}-\d{2}$/.test(String(localRewards?.lastClaimDate||''))?localRewards.lastClaimDate:null;
    const {data,error}=await supa.rpc('fv_request_wallet_recovery',{
      p_requested_balance:requested,p_last_claim_date:last,p_streak:Math.max(0,Math.round(Number(localRewards?.streak||0))),
      p_metrics:{...metrics,client_id:getClientId(),detected_at:new Date().toISOString()}
    });
    if(error){ if(isMissingRpcError(error)) return; throw error; }
    const result=Array.isArray(data)?data[0]:data;
    state.meta={...(state.meta||{}),walletRecovery:{
      status:result?.status||'pending_review',requestedBalance:requested,serverBalance:Number(serverBalance||0),
      request:result?.request||null,updatedAt:new Date().toISOString()
    }};
    persistStateLocalOnly('wallet_recovery_requested');
    window.dispatchEvent(new CustomEvent('afterglow:wallet-recovery-updated'));
  }catch(err){ console.warn('Wallet recovery request failed',err); }
  finally{ walletRecoveryRequestInFlight=false; }
}

function applyEconomyPayload(payload,{persist=true,allowRecovery=false}={}){
  const economy=payload?.economy||payload||{};
  const wallet=economy.wallet||{};
  const claimStatus=economy.claim_status||{};
  const rows=Array.isArray(economy.inventory)?economy.inventory:[];
  if(Object.keys(wallet).length){
    const localRewards=deepCopy(state.rewards||{});
    const serverBalance=Number(wallet.glow_coins||0);
    if(allowRecovery && Number(localRewards.glowCoins||0)>serverBalance){
      const metrics=stateMetrics(state);
      snapshotLocalState(state,'wallet_mismatch_before_server_authority',true);
      state.meta={...(state.meta||{}),walletRecovery:{status:'submitting',requestedBalance:Number(localRewards.glowCoins||0),serverBalance,detectedAt:new Date().toISOString()}};
      requestLegacyWalletRecovery(localRewards,serverBalance,metrics);
    }
    state.rewards={...state.rewards,glowCoins:serverBalance,streak:Number(wallet.streak||0),lastClaimDate:wallet.last_claim_date||'',claimedToday:!!claimStatus.claimed_today,serverToday:claimStatus.today||'',timezone:claimStatus.timezone||wallet.timezone||state.rewards?.timezone||'',lastClaimedAt:wallet.last_claimed_at||'',lifetimeEarned:Number(wallet.lifetime_earned||0),lifetimeSpent:Number(wallet.lifetime_spent||0)};
  }
  if(rows.length || Array.isArray(economy.inventory)){
    const priorCustom=state.inventory?.custom||{};
    const owned=rows.map(r=>String(r.item_id));
    const equipped={}; rows.filter(r=>r.equipped).forEach(r=>{if(r.item_type) equipped[r.item_type]=r.item_value;});
    state.inventory={...(state.inventory||{}),owned,equipped,custom:priorCustom};
  }
  state.profile.rewards=state.rewards; state.profile.inventory=state.inventory;
  if(persist) persistStateLocalOnly('economy_loaded');
  try{renderDailyGift(); updateGlowCoinDisplays(); renderShop(); updateAvatar();}catch{}
  return economy;
}
async function loadServerEconomy(){
  if(!supa||!authUser) return false;
  const {data,error}=await supa.rpc('fv_get_my_economy');
  if(error){ if(isMissingRpcError(error)) return false; throw error; }
  const firstAuthorityCheck=!state.meta?.walletAuthorityEstablishedAt;
  applyEconomyPayload(data,{allowRecovery:firstAuthorityCheck});
  state.meta={...(state.meta||{}),walletAuthorityEstablishedAt:state.meta?.walletAuthorityEstablishedAt||new Date().toISOString()};
  try{
    const recovery=await supa.from('fv_wallet_recovery_requests').select('id,status,requested_balance,server_balance_at_request,requested_at,updated_at,resolved_at,resolution_note').eq('user_id',authUser.id).maybeSingle();
    if(!recovery.error && recovery.data){
      state.meta.walletRecovery={...(state.meta.walletRecovery||{}),status:recovery.data.status,requestedBalance:Number(recovery.data.requested_balance||0),serverBalance:Number(recovery.data.server_balance_at_request||0),request:recovery.data,updatedAt:recovery.data.updated_at||new Date().toISOString()};
    }
  }catch{}
  persistStateLocalOnly('wallet_authority_loaded');
  return true;
}
async function loadRemoteProfile(){
  if(!supa || !authUser) return;
  bootingRemote=true;
  let shouldResync=false;
  try{
    let local=normalizeState(state,authUser);
    const indexedCandidate=await readStateFromRecoveryDb(userStorageKey(authUser));
    if(indexedCandidate){
      const recovered=normalizeState(indexedCandidate,authUser);
      const localMetrics=stateMetrics(local), recoveredMetrics=stateMetrics(recovered);
      if(recoveredMetrics.ratings>localMetrics.ratings || recoveredMetrics.owned>localMetrics.owned || isoTime(recovered.updatedAt)>isoTime(local.updatedAt)){
        snapshotLocalState(recovered,'indexeddb_recovery',true);
        local=mergeDurableStates(local,recovered,authUser);
        state=local;
        shouldResync=true;
      }
    }
    const legacy=legacyLocalCandidate(authUser);
    const {data,error}=await supa.from('fv_profiles').select('*').eq('user_id',authUser.id).maybeSingle();
    if(error) throw error;
    let merged=local;
    if(legacy && stateMetrics(legacy).ratings>stateMetrics(merged).ratings){ merged=mergeDurableStates(merged,legacy,authUser); shouldResync=true; snapshotLocalState(legacy,'legacy_browser_recovery',true); }
    if(data){
      const remote=remoteRowToState(data,authUser);
      const beforeRemote=stateMetrics(remote), beforeLocal=stateMetrics(merged);
      merged=mergeDurableStates(merged,remote,authUser);
      if(beforeLocal.ratings>beforeRemote.ratings || beforeLocal.owned>beforeRemote.owned || (local.meta?.localRecordFound && isoTime(local.updatedAt)>isoTime(remote.updatedAt))) shouldResync=true;
      setSync('cloud data loaded and checked');
    }else shouldResync=true;
    state=normalizeState(merged,authUser); state.ageOk=true; state.userId=authUser.id;
    persistStateLocalOnly('remote_merge');
    try{await loadServerEconomy();}catch(err){console.warn('Economy load failed',err);}
    hydrateProfileForm(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); renderStack(); updateAvatar();
  }catch(err){ console.warn('Protected profile load failed',err); setSync('using safe local copy — cloud retry queued'); scheduleSyncRetry(); }
  finally{ bootingRemote=false; }
  if(shouldResync) await syncToSupabase(false,'recovery_merge');
}

function isAdmin(){ return (authUser?.email || '').toLowerCase() === ADMIN_EMAIL; }

async function loadAdminConfig(){
  const cached = localStorage.getItem('fvAdminConfigCache');
  if(cached){
    try{ applyAdminConfig(JSON.parse(cached), false); }catch{}
  }
  if(!supa || !authUser) { renderAdmin(); return; }
  try{
    const {data,error}=await supa.from('fv_admin_config').select('key,value').in('key',['labels','categories','cards']);
    if(error) throw error;
    const cfg = {};
    (data||[]).forEach(row=>cfg[row.key]=row.value);
    if(Object.keys(cfg).length){
      applyAdminConfig(cfg, true);
      localStorage.setItem('fvAdminConfigCache', JSON.stringify(cfg));
      setSync('loaded Vault config');
    }
  }catch(err){ console.warn('Admin config load failed', err); }
  renderAdmin();
}

function applyAdminConfig(cfg, rerender=true){
  if(cfg.labels && typeof cfg.labels === 'object') labels = cfg.labels;
  if(cfg.categories && typeof cfg.categories === 'object') categoryMeta = cfg.categories;
  if(Array.isArray(cfg.cards)) vaultCards = cfg.cards;
  if(rerender){ populateCats(); renderVault(); renderVaultStats(); }
}

function currentAdminConfig(){ return {labels, categories:categoryMeta, cards:vaultCards}; }

function resetAdminEditorsToDefaults(){
  const cfg = {labels:DEFAULT_LABELS, categories:DEFAULT_CATEGORY_META, cards:DEFAULT_VAULT_CARDS};
  fillAdminEditors(cfg);
}

function fillAdminEditors(cfg=currentAdminConfig()){
  const l=$('#adminLabels'), c=$('#adminCategories'), v=$('#adminCards');
  if(l) l.value = JSON.stringify(cfg.labels || labels, null, 2);
  if(c) c.value = JSON.stringify(cfg.categories || categoryMeta, null, 2);
  if(v) v.value = JSON.stringify(cfg.cards || vaultCards, null, 2);
}

function parseAdminEditors(){
  return {
    labels: JSON.parse($('#adminLabels').value || '{}'),
    categories: JSON.parse($('#adminCategories').value || '{}'),
    cards: JSON.parse($('#adminCards').value || '[]')
  };
}

function renderAdmin(){
  const admin = isAdmin();
  const tab = $('#adminTab'); if(tab) tab.classList.toggle('hidden', !admin); const nav=$('.bottom-nav'); if(nav) nav.classList.toggle('admin-on', admin);
  const lock = $('#adminLock'); if(lock) lock.classList.toggle('hidden', admin);
  const panel = $('#adminPanel'); if(panel) panel.classList.toggle('hidden', !admin);
  if(admin) fillAdminEditors();
}

async function saveAdminConfig(seedDefaults=false){
  if(!isAdmin()){ showToast('Admin access is restricted.'); return; }
  if(!supa){ showToast('Cloud service is temporarily unavailable.'); return; }
  try{
    const cfg = seedDefaults ? {labels:DEFAULT_LABELS, categories:DEFAULT_CATEGORY_META, cards:DEFAULT_VAULT_CARDS} : parseAdminEditors();
    if(!Array.isArray(cfg.cards)) throw new Error('Vault cards must be a JSON array.');
    const rows = [
      {key:'labels', value:cfg.labels, updated_by:authUser.email},
      {key:'categories', value:cfg.categories, updated_by:authUser.email},
      {key:'cards', value:cfg.cards, updated_by:authUser.email}
    ];
    const {error}=await supa.from('fv_admin_config').upsert(rows,{onConflict:'key'});
    if(error) throw error;
    applyAdminConfig(cfg, true);
    localStorage.setItem('fvAdminConfigCache', JSON.stringify(cfg));
    renderAdmin();
    showToast(seedDefaults ? 'Published Vault defaults restored.' : 'Admin configuration saved.');
  }catch(err){ console.warn(err); showToast('Admin save failed. No changes were published.'); }
}

async function compactImageDataUrl(file,maxDimension=1200){
  if(!file) return '';
  if(!window.createImageBitmap || !document.createElement){
    if(file.size>1500000) throw new Error('Image is too large for an offline browser copy.');
    return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  }
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d',{alpha:false});
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();
  let quality=.84;
  let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
  while(blob && blob.size>1200000 && quality>.5){quality-=.1;blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));}
  if(!blob) throw new Error('Could not prepare image preview.');
  return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
}
async function prepareImageUpload(file,{maxDimension=1600,maxBytes=1400000,quality=.86}={}){
  if(!file || !String(file.type||'').startsWith('image/')) throw new Error('Image file required.');
  if(file.size>12*1024*1024) throw new Error('Image is too large.');
  if(!window.createImageBitmap || !document.createElement){
    if(file.size>maxBytes) throw new Error('This browser cannot safely compress that image.');
    return {blob:file,contentType:file.type||'image/jpeg',ext:(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg',originalBytes:file.size,storedBytes:file.size};
  }
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,maxDimension/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d',{alpha:false}); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close?.();
  let q=quality, blob=null;
  do{
    blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',q));
    if(!blob) break;
    if(blob.size<=maxBytes || q<=.5) break;
    q=Math.max(.5,q-.08);
  }while(true);
  if(!blob) throw new Error('Could not prepare image.');
  return {blob,contentType:'image/jpeg',ext:'jpg',originalBytes:file.size,storedBytes:blob.size};
}

function profilePhotoStoragePath(url){
  if(!url || !authUser) return '';
  try{
    const parsed=new URL(String(url),location.href);
    const marker='/storage/v1/object/public/fv-profile-photos/';
    const at=parsed.pathname.indexOf(marker);
    if(at<0) return '';
    const path=decodeURIComponent(parsed.pathname.slice(at+marker.length));
    return path.startsWith(`${authUser.id}/`)?path:'';
  }catch{return '';}
}
async function deleteStoredProfilePhoto(url){
  const path=profilePhotoStoragePath(url);
  if(!path || !supa || !authUser) return false;
  const {error}=await supa.storage.from('fv-profile-photos').remove([path]);
  if(error) throw error;
  return true;
}
async function removeAvatarPhoto(){
  const previous=state.profile?.avatarUrl||'';
  transientAvatarPreviewUrl='';
  state.profile.avatarUrl=''; updateAvatar(); save('profile_photo_removed');
  try{
    if(supa&&authUser) await syncToSupabase(false,'profile_photo_removed');
    await deleteStoredProfilePhoto(previous);
    showToast('Photo removed.');
  }catch(err){console.warn('Stored avatar cleanup failed',err);showToast('Photo removed from your profile; old storage cleanup will need retrying.');}
}
let transientAvatarPreviewUrl='';
async function handleAvatarUpload(file){
  if(!file) return;
  if(!file.type.startsWith('image/')){ showToast('Please choose an image file.'); return; }
  if(file.size>12*1024*1024){showToast('Profile photos must be 12MB or smaller before compression.');return;}
  let localDataUrl='';
  try{ localDataUrl=await compactImageDataUrl(file); }
  catch(err){console.warn(err);showToast('That photo could not be prepared safely.');return;}
  const previousCloudUrl=state.profile?.avatarUrl||'';
  transientAvatarPreviewUrl=localDataUrl;
  updateAvatar();
  if(!supa || !authUser){
    state.profile.avatarUrl=localDataUrl;
    transientAvatarPreviewUrl='';
    save('profile_photo_local_only');
    showToast('Photo saved on this device. Sign in to store it securely in the cloud.');
    return;
  }
  try{
    const prepared=await prepareImageUpload(file,{maxDimension:1400,maxBytes:750000,quality:.84});
    const path = `${authUser.id}/avatar-${Date.now()}.${prepared.ext}`;
    const {error:uploadError}=await supa.storage.from('fv-profile-photos').upload(path, prepared.blob, {cacheControl:'86400', upsert:false, contentType:prepared.contentType});
    if(uploadError) throw uploadError;
    const {data}=supa.storage.from('fv-profile-photos').getPublicUrl(path);
    state.profile.avatarUrl = data.publicUrl;
    transientAvatarPreviewUrl='';
    updateAvatar(); save('profile_photo_uploaded'); await syncToSupabase(false,'profile_photo_uploaded');
    if(previousCloudUrl && previousCloudUrl!==data.publicUrl){
      try{await deleteStoredProfilePhoto(previousCloudUrl);}catch(cleanupErr){console.warn('Previous avatar cleanup failed',cleanupErr);}
    }
    showToast('Profile photo updated.');
  }catch(err){
    transientAvatarPreviewUrl=''; updateAvatar();
    console.warn(err); showToast('The photo upload could not finish. Your previous profile photo was kept.');
  }
}

async function migrateLegacyEmbeddedAvatar(){
  const raw=String(state.profile?.avatarUrl||'');
  if(!/^data:image\//i.test(raw) || !supa || !authUser) return false;
  try{
    const response=await fetch(raw);
    const blob=await response.blob();
    if(!blob.type?.startsWith('image/')) throw new Error('Legacy avatar is not an image.');
    const file=new File([blob],'legacy-avatar.jpg',{type:blob.type||'image/jpeg'});
    const prepared=await prepareImageUpload(file,{maxDimension:1400,maxBytes:750000,quality:.84});
    const path=`${authUser.id}/avatar-migrated-${Date.now()}.${prepared.ext}`;
    const upload=await supa.storage.from('fv-profile-photos').upload(path,prepared.blob,{cacheControl:'86400',upsert:false,contentType:prepared.contentType});
    if(upload.error) throw upload.error;
    const {data}=supa.storage.from('fv-profile-photos').getPublicUrl(path);
    state.profile.avatarUrl=data.publicUrl;
    transientAvatarPreviewUrl='';
    updateAvatar(); save('legacy_avatar_migrated');
    await syncToSupabase(false,'legacy_avatar_migrated');
    try{const scrub=await supa.rpc('fv_scrub_my_legacy_avatar_revisions');if(scrub.error&&!isMissingRpcError(scrub.error))throw scrub.error;}catch(scrubErr){console.warn('Legacy avatar revision cleanup deferred',scrubErr);}
    return true;
  }catch(err){console.warn('Legacy embedded avatar migration failed',err);return false;}
}

function deterministicGradient(seed='member'){
  const palettes=[['#ff3f91','#8b5cff'],['#ff6b73','#ffd37a'],['#57c8ff','#ff3f91'],['#8b5cff','#ff6b73'],['#6cffb7','#57c8ff']];
  const n=[...String(seed)].reduce((a,ch)=>a+ch.charCodeAt(0),0);
  return palettes[n % palettes.length];
}

function compatibilityForRatings(otherRatings={}){
  const mine=state.ratings||{};
  const shared=[];
  let positive=0, conflicts=0, compared=0;
  Object.entries(otherRatings||{}).forEach(([id, val])=>{
    const my=mine[id];
    if(!my) return;
    compared++;
    const card=vaultCards.find(c=>c.id===id);
    const meta=card ? (categoryMeta[card.cat]||{}) : {};
    const label=card ? `${meta.emoji||'✨'} ${card.title}` : id;
    const myPositive=['love','enjoy','curious'].includes(my);
    const theirPositive=['love','enjoy','curious'].includes(val);
    if(myPositive && theirPositive){ positive++; shared.push(label); }
    if((my==='limit' && theirPositive) || (val==='limit' && myPositive)) conflicts++;
  });
  let score = compared ? Math.round(62 + (positive / Math.max(compared,1)) * 35 - conflicts * 10) : 70;
  score = Math.max(0, Math.min(99, score));
  return {score, shared: shared.slice(0,4), conflicts};
}

function profileRowToPerson(row){
  const profile=row.profile||{};
  const displayName=(profile.displayName||profile.name||'Member').trim();
  const initial=(displayName[0]||'M').toUpperCase();
  const comp=compatibilityForRatings(row.ratings||{});
  const city=profile.city||profile.area||'';
  return {
    id: row.user_id || row.id || displayName,
    name: displayName,
    age: profile.age || '',
    distance: Number(profile.distance || 999),
    distanceLabel: city ? `📍 ${city}` : '📍 Nearby',
    score: comp.score,
    vibe: profile.headline || profile.bio || 'Building their Afterglow profile.',
    gradient: deterministicGradient(row.user_id || displayName),
    initial,
    avatarUrl: profile.avatarUrl || '',
    tags: [profile.sex, profile.lookingFor, profile.interests, profile.radius, row.email ? 'Verified' : 'Member'].filter(Boolean).slice(0,4),
    mutual: comp.shared.length ? comp.shared : ['Vault overlap appears after both people answer more cards'],
    likesMe: (row.liked || []).map(String).includes(String(authUser?.id || ''))
  };
}

async function loadPeopleDirectory(options={}){
  const {preserveIndex=false, quiet=false} = options || {};
  if(!supa || !authUser){ renderStack(); renderMatches(); renderChats(); return; }
  const currentKey = preserveIndex ? personKey(orderedPeople()[index]) : '';
  try{
    const rpcResult=await supa.rpc('fv_get_directory',{p_limit:80});
    if(rpcResult.error) throw rpcResult.error;
    const data=rpcResult.data;
    people=(data||[]).map(profileRowToPerson);
    directoryLoaded = true;
    const fingerprint = JSON.stringify((data||[]).map(r=>[r.user_id, r.updated_at, r.liked]));
    if(!quiet && lastDirectoryFingerprint && fingerprint !== lastDirectoryFingerprint) showToast('Profiles refreshed.');
    lastDirectoryFingerprint = fingerprint;
  }catch(err){
    console.warn('Directory load failed', err);
    directoryLoaded = false;
    people=[];
    setSync('signed in — profile discovery temporarily unavailable');
  }
  if(preserveIndex && currentKey){
    const nextIndex = orderedPeople().findIndex(p=>personKey(p)===currentKey);
    index = nextIndex >= 0 ? nextIndex : 0;
  }else{
    index=0;
  }
  renderStack(); renderMatches(); renderChats();
}

function startDirectoryAutoRefresh(){
  // Legacy interval intentionally disabled. Afterglow v4 uses one filtered
  // Realtime channel plus a low-frequency safety refresh instead of polling.
  stopDirectoryAutoRefresh();
}

function stopDirectoryAutoRefresh(){
  if(directoryRefreshTimer) clearInterval(directoryRefreshTimer);
  directoryRefreshTimer = null;
}

function normalizeUrl(url){
  try {
    const u = new URL(url);
    // Keep exactly the app directory, never include query/hash/index.html.
    if (u.pathname.endsWith('/index.html')) u.pathname = u.pathname.replace(/index\.html$/, '');
    if (!u.pathname.endsWith('/')) u.pathname += '/';
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return 'https://whatmod.com/fantasy/';
  }
}

function authRedirectUrl(){
  // Prefer the configured permanent production URL. This keeps GitHub Pages,
  // Supabase Auth, and Google OAuth using one canonical redirect.
  const configured = CONFIG.AUTH_REDIRECT_URL || CONFIG.APP_URL || 'https://whatmod.com/fantasy/';
  return normalizeUrl(configured);
}

async function signInWithGoogle(){
  if(!supa){ showToast('Sign-in is temporarily unavailable. Please try again shortly.'); return; }
  const redirectTo = authRedirectUrl();
  const {error}=await supa.auth.signInWithOAuth({
    provider:'google',
    options:{
      redirectTo,
      skipBrowserRedirect:false,
      queryParams:{ prompt:'select_account' }
    }
  });
  if(error){ console.warn(error); showToast('Google login failed to start.'); }
}

async function signOut(){
  if(!supa) return;
  await supa.auth.signOut();
  stopDirectoryAutoRefresh();
  stopChatAutoRefresh();
  authUser=null;
  updateAuthUi();
  closeApp();
  setSync('local only — signed out');
  showToast('Signed out. Local data is still saved on this device.');
}

function updateAuthUi(){
  const name = authUser?.user_metadata?.full_name || authUser?.email || 'signed in';
  const authEl=$('#authStatus'); if(authEl) authEl.textContent = authUser ? name : 'not signed in';
  const gateAuth=$('#gateAuthStatus'); if(gateAuth) gateAuth.textContent = authUser ? `Signed in as ${name}` : 'Not signed in';
  const login=$('#googleLogin'); if(login) login.classList.toggle('hidden', !!authUser);
  const signout=$('#signOut'); if(signout) signout.classList.toggle('hidden', !authUser);
  updateGateUi();
  renderAdmin();
}


function updateGateUi(){
  const ageConfirm=$('#ageConfirm');
  const gateLogin=$('#googleGate');
  const gateEnter=$('#enterApp');
  const gateSignOut=$('#gateSignOut');
  const gateReset=$('#gateResetLocal');
  const confirmed = !!ageConfirm?.checked || !!state.ageOk;
  if(ageConfirm) ageConfirm.checked = confirmed;

  // Safe login gate:
  // - Signed out: require the 18+ checkbox before starting Google OAuth.
  // - Signed in: never trap the user on the gate; show Enter + Sign out.
  if(gateLogin){
    gateLogin.disabled = !confirmed || !!authUser;
    gateLogin.classList.toggle('hidden', !!authUser);
  }
  if(gateEnter){
    gateEnter.classList.toggle('hidden', !authUser);
  }
  if(gateSignOut){
    gateSignOut.classList.toggle('hidden', !authUser);
  }
  if(gateReset){
    gateReset.classList.remove('hidden');
  }
}

function canEnter(){ return !!authUser; }

async function resetLocalAppData(){
  snapshotLocalState(state,'before_local_cache_reset',true);
  localStorage.removeItem(KEY);
  if(authUser) localStorage.removeItem(userStorageKey(authUser));
  if(authUser){
    state=loadStateForAuthUser(authUser);
    await loadRemoteProfile();
    showToast('Local cache rebuilt from your protected cloud copy. A recovery snapshot was kept.');
  }else{
    localStorage.removeItem('fvDeviceId');
    state=load();
    hydrateProfileForm(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); renderStack(); updateAuthUi(); closeApp();
    showToast('Local guest cache reset. A recovery snapshot was kept.');
  }
}

async function initAuth(){
  if(!supa){ updateAuthUi(); return; }
  const {data}=await supa.auth.getSession();
  authUser=data?.session?.user || null;
  updateAuthUi();
  if(authUser){
    state = loadStateForAuthUser(authUser);
    hydrateProfileForm(); updateAvatar();
    await loadRemoteProfile();
    await loadAdminConfig();
    await loadPeopleDirectory();
    startDirectoryAutoRefresh();
    openApp();
  }
  supa.auth.onAuthStateChange(async (event, session)=>{
    authUser=session?.user || null;
    updateAuthUi();
    if(event === 'SIGNED_IN' && authUser){
      state = loadStateForAuthUser(authUser);
      hydrateProfileForm(); updateAvatar();
      await loadRemoteProfile();
      await loadAdminConfig();
      await loadPeopleDirectory();
      startDirectoryAutoRefresh();
      save();
      openApp();
      showToast('Google login connected.');
    }
    if(event === 'SIGNED_OUT'){ stopDirectoryAutoRefresh(); setSync('local only — signed out'); }
  });
}

function setSync(text){ state.meta={...(state.meta||{}),syncStatus:text}; const el=$('#syncStatus'); if(el) el.textContent=text; const live=document.querySelector('#afterglowSyncLive'); if(live) live.textContent=text; }
async function saveProfileManually(){
  save();
  await syncToSupabase(true);
  await loadPeopleDirectory();
  showToast('Profile saved.');
}


function hydrateProfileForm(){
  ['displayName','age','headline','city','sex','radius','lookingFor','interests','bio'].forEach(id=>{const el=$('#'+id); if(el) el.value=state.profile[id]||'';});
  updateAvatar();
}

async function init(){
  $('#ageConfirm').onchange=e=>{state.ageOk=!!e.target.checked; save(); updateGateUi();};
  $('#enterApp').onclick=()=>{ if(canEnter()) openApp(); else showToast('Please sign in with Google first.'); };
  $('#googleGate').onclick=async()=>{ if(!state.ageOk){showToast('Please confirm you are 18+ first.'); return;} await signInWithGoogle(); };
  $('#gateSignOut').onclick=signOut;
  const gateReset = $('#gateResetLocal'); if(gateReset) gateReset.onclick=resetLocalAppData;
  $$('.tab').forEach(b=>b.onclick=()=>showScreen(b.dataset.screen));
  $('#profileShortcut').onclick=()=>showScreen('profile');
  $('#filterOpen').onclick=()=>$('#filters').classList.remove('hidden');
  $('#closeFilters').onclick=$('#applyFilters').onclick=()=>$('#filters').classList.add('hidden');
  $$('.pill').forEach(b=>b.onclick=()=>{mode=b.dataset.mode; $$('.pill').forEach(x=>x.classList.toggle('active',x===b)); index=0; renderStack();});
  $('#passBtn')?.addEventListener('click',()=>act('pass')); $('#likeBtn')?.addEventListener('click',()=>act('like')); $('#vaultBtn')?.addEventListener('click',()=>{showToast('Mutual Vault details unlock after a match.'); showScreen('vault');});
  const exportData=$('#exportData'); if(exportData) exportData.onclick=()=>{const box=$('#exportBox'); if(box) box.textContent=JSON.stringify(state,null,2);};
  $('#googleLogin').onclick=signInWithGoogle;
  $('#signOut').onclick=signOut;
  const syncNow=$('#syncNow'); if(syncNow) syncNow.onclick=()=>syncToSupabase(true);
  const saveProfileBtn=$('#saveProfile'); if(saveProfileBtn) saveProfileBtn.onclick=saveProfileManually;
  const avatarUpload=$('#avatarUpload'); if(avatarUpload) avatarUpload.onchange=e=>handleAvatarUpload(e.target.files?.[0]);
  const removeAvatar=$('#removeAvatar'); if(removeAvatar) removeAvatar.onclick=removeAvatarPhoto;
  const adminSeed=$('#adminSeed'); if(adminSeed) adminSeed.onclick=()=>saveAdminConfig(true);
  const adminReload=$('#adminReload'); if(adminReload) adminReload.onclick=()=>loadAdminConfig();
  const adminSave=$('#adminSave'); if(adminSave) adminSave.onclick=()=>saveAdminConfig(false);
  const adminResetDefaults=$('#adminResetDefaults'); if(adminResetDefaults) adminResetDefaults.onclick=resetAdminEditorsToDefaults;
  ['displayName','age','headline','city','sex','radius','lookingFor','interests','bio'].forEach(id=>{const el=$('#'+id); el.value=state.profile[id]||''; el.oninput=e=>{state.profile[id]=e.target.value; updateAvatar(); save();};});
  $('#searchCards').oninput=renderVault; $('#categoryFilter').onchange=renderVault;
  applyAdminConfig(currentAdminConfig(), false); populateCats(); updateAvatar(); renderStack(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); await initAuth(); updateGateUi(); if(canEnter()) openApp(); syncToSupabase(false);
}
function openApp(){ $('#ageGate').classList.add('hidden'); $('#app').classList.remove('hidden'); }
function closeApp(){ $('#app').classList.add('hidden'); $('#ageGate').classList.remove('hidden'); }
function showScreen(id){ $$('.screen').forEach(s=>s.classList.toggle('active-screen',s.id===id)); $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.screen===id)); }
function updateAvatar(){
  const initial=(state.profile.displayName||'V').trim()[0]?.toUpperCase()||'V';
  const url=safeImageUrl(transientAvatarPreviewUrl || state.profile.avatarUrl);

  const profileHero=$('.profile-avatar');
  const navAvatars=[$('#topProfileAvatar'), $('#bottomProfileAvatar')].filter(Boolean);

  const applyAvatar=(el, fallbackText)=>{
    if(!el) return;
    if(url){
      el.textContent='';
      el.style.backgroundImage=`url("${url}")`;
      el.style.backgroundSize='cover';
      el.style.backgroundPosition='center';
      el.classList.add('has-photo');
    }else{
      el.style.backgroundImage='';
      el.classList.remove('has-photo');
      el.textContent=fallbackText;
    }
  };

  applyAvatar(profileHero, initial);
  navAvatars.forEach(el=>applyAvatar(el, el.id === 'bottomProfileAvatar' ? '👤' : initial));
}
function personKey(p){ return String(p?.id || p?.name || ''); }
function likedKeys(){ return (state.liked||[]).map(String); }
function passedKeys(){ return (state.passed||[]).map(String); }
function iLike(p){
  // Relationship flags returned by Supabase are authoritative. Local liked[]
  // remains as an offline/fallback source, but it must never be the only way
  // an established connection is recognized on a new device/session.
  if(p?.serverILike===true || p?.serverMutual===true) return true;
  const liked=likedKeys();
  return liked.includes(personKey(p)) || liked.includes(p?.name);
}
function isMutual(p){
  return p?.serverMutual===true || (!!p?.likesMe && iLike(p));
}
function incomingLikes(){
  const passed=passedKeys();
  return people.filter(p=>{
    const key=personKey(p);
    return (p?.serverLikesMe===true || p?.likesMe) && !isMutual(p) && !iLike(p) && !passed.includes(key) && !passed.includes(p?.name);
  });
}
function mutualMatches(){ return people.filter(p=>isMutual(p)); }
function orderedPeople(){
  let arr=[...people];
  if(mode==='nearby') arr.sort((a,b)=>(a.distance||999)-(b.distance||999));
  if(mode==='compatible') arr.sort((a,b)=>b.score-a.score);
  if(mode==='new') arr.reverse();
  const passed=passedKeys();
  // Discovery should only show fresh profiles. Anyone you liked, passed, matched,
  // or who already liked you moves out of Nearby and into Matches/Liked You.
  return arr.filter(p=>{
    const key=personKey(p);
    return !passed.includes(key) && !passed.includes(p.name) && !iLike(p) && !p.likesMe && !isMutual(p);
  });
}
function renderPersonAvatar(p, className='fake-face'){
  const avatarUrl=safeImageUrl(p?.avatarUrl);
  const safeClass=String(className||'fake-face').replace(/[^a-z0-9_-]/gi,'');
  if(avatarUrl) return `<div class="${safeClass} real-face" style="background-image:url('${avatarUrl}')"></div>`;
  return `<div class="${safeClass}">${escapeHtml(p?.initial||'M')}</div>`;
}
function renderStack(){
  const arr=orderedPeople(); if(index>=arr.length) index=0; const p=arr[index];
  if(!p){ $('#cardStack').innerHTML='<div class="empty-state"><h3>No profiles available yet</h3><p>When other signed-in members complete their profile, they will appear here automatically.</p></div>'; return; }
  const avatarUrl=safeImageUrl(p.avatarUrl);
  const age=p.age ? `, ${escapeHtml(p.age)}` : '';
  const likeBadge = p.likesMe ? '<span class="liked-you-badge">❤️ Likes you</span>' : '';
  const score=Math.max(0,Math.min(100,Number(p.score)||0));
  const tags=(Array.isArray(p.tags)?p.tags:[]).map(t=>`<span class="chip">${escapeHtml(t)}</span>`).join('');
  const mutual=(Array.isArray(p.mutual)?p.mutual:[]);
  const signals=mutual.map(x=>escapeHtml(x)).join(' • ');
  const photoBackground=avatarUrl
    ? `linear-gradient(180deg,transparent 35%,rgba(0,0,0,.86)), url('${avatarUrl}') center/cover`
    : `linear-gradient(145deg,${p.gradient[0]},${p.gradient[1]})`;
  $('#cardStack').innerHTML=`<article class="person-card">
    <div class="person-photo ${avatarUrl?'has-profile-photo':''}" style="background:${photoBackground}"><span class="distance">${escapeHtml(p.distanceLabel || '📍 Nearby')}</span><span class="verified">✓ verified</span>${likeBadge}${avatarUrl?'':renderPersonAvatar(p)}</div>
    <div class="person-info"><div class="name-row"><h2>${escapeHtml(p.name)}${age}</h2><strong>${score}%</strong></div><p class="headline">${escapeHtml(p.vibe)}</p><div class="chips">${tags}</div><div class="mutual-box"><b>${mutual.length} Vault signal${mutual.length===1?'':'s'}:</b><br>${signals}</div></div>
  </article>`;
}
function act(type){
  const arr=orderedPeople(); const p=arr[index]; if(!p)return;
  const key=personKey(p);
  if(type==='like'&&!likedKeys().includes(key)){
    state.liked.push(key);
    p.serverILike=true;
    if(p.serverLikesMe===true || p.likesMe) p.serverMutual=true;
    showToast(p.likesMe ? `It's a match with ${p.name}!` : `Liked ${p.name}.`);
  }
  if(type==='pass'&&!passedKeys().includes(key)){state.passed.push(key); showToast(`Passed on ${p.name}.`);}
  index++; save(); renderStack(); renderMatches(); renderChats(); syncToSupabase(false);
}
function acceptLike(key){
  const p=people.find(x=>personKey(x)===String(key));
  if(!p) return;
  if(!likedKeys().includes(personKey(p))) state.liked.push(personKey(p));
  p.serverILike=true;
  if(p.serverLikesMe===true || p.likesMe) p.serverMutual=true;
  save();
  renderStack();
  renderMatches();
  renderChats();
  syncToSupabase(false);
  showToast(`It's a match with ${p.name}!`);
}

function ignoreLike(key){
  const p=people.find(x=>personKey(x)===String(key));
  if(!p) return;
  if(!passedKeys().includes(personKey(p))) state.passed.push(personKey(p));
  save();
  renderStack();
  renderMatches();
  renderChats();
  syncToSupabase(false);
  showToast(`${p.name} moved out of Liked You.`);
}

async function unmatch(key){
  const p=people.find(x=>personKey(x)===String(key));
  const label=p?.name || 'this person';
  const k=String(key);
  state.liked=(state.liked||[]).map(String).filter(x=>x!==k);
  if(p){p.serverILike=false;p.serverMutual=false;}
  if(!passedKeys().includes(k)) state.passed.push(k);
  if(activeChatKey===k) closeChatModal();
  chatCache[k]=[];
  await deleteConversationMessages(k);
  save();
  renderStack();
  renderMatches();
  renderChats();
  syncToSupabase(false);
  showToast(`Unmatched ${label}.`);
}

async function resetConnections(){
  const matchedKeys = mutualMatches().map(personKey);
  state.liked=[];
  state.passed=[];
  chatCache={};
  closeChatModal();
  for(const key of matchedKeys){ await deleteConversationMessages(key); }
  save();
  renderStack();
  renderMatches();
  renderChats();
  syncToSupabase(false);
  showToast('Likes, passes, matches, and conversations were reset for this account.');
}

function showToast(msg){ const old=$('.toast'); if(old)old.remove(); const t=document.createElement('div'); t.className='toast'; t.textContent=msg; $('.phone').appendChild(t); setTimeout(()=>t.remove(),2100); }
function populateCats(){ const cats=[...new Set(vaultCards.map(c=>c.cat))].sort(); $('#categoryFilter').innerHTML='<option value="all">🌈 All</option>'+cats.map(c=>`<option value="${c}">${categoryMeta[c]?.emoji||'✨'} ${c}</option>`).join(''); }
function renderVault(){
  const q=$('#searchCards').value.toLowerCase(); const cat=$('#categoryFilter').value;
  const list=vaultCards.filter(c=>(cat==='all'||c.cat===cat)&&(!q||`${c.title} ${c.desc} ${c.cat}`.toLowerCase().includes(q)));
  $('#cards').innerHTML=list.map(card=>{const cur=state.ratings[card.id]; const meta=categoryMeta[card.cat]||{emoji:'✨', theme:'theme-fantasy'}; return `<article class="vcard ${meta.theme}"><div class="vcard-top"><span class="cat-badge">${meta.emoji} ${card.cat}</span><span class="rating-badge">${cur?labels[cur]:'❔ Unanswered'}</span></div><h3>${card.title}</h3><p>${card.desc}</p><div class="answers">${Object.entries(labels).map(([k,v])=>`<button class="answer-btn ${cur===k?'selected':''}" data-id="${card.id}" data-answer="${k}">${v}</button>`).join('')}</div></article>`}).join('') || '<div class="empty-state"><h3>No Vault cards yet</h3><p>The admin can add cards from Admin Studio.</p></div>';
  $$('.answer-btn').forEach(b=>b.onclick=()=>{state.ratings[b.dataset.id]=b.dataset.answer; save(); renderVault(); if(directoryLoaded) loadPeopleDirectory({preserveIndex:true, quiet:true});});
}
function renderVaultStats(){ const vals=Object.values(state.ratings); $('#ratedCount').textContent=vals.length; $('#limitCount').textContent=vals.filter(v=>v==='limit').length; $('#vaultPct').textContent=(vaultCards.length?Math.round(vals.length/vaultCards.length*100):0)+'%'; }
function miniAvatarMarkup(p){
  const avatarUrl=safeImageUrl(p?.avatarUrl);
  const bg = avatarUrl ? `background-image:url('${avatarUrl}');background-size:cover;background-position:center` : `background:linear-gradient(135deg,${p.gradient[0]},${p.gradient[1]})`;
  return `<div class="mini-avatar" style="${bg}">${avatarUrl?'':escapeHtml(p?.initial||'M')}</div>`;
}
function renderMatches(){
  const incoming=incomingLikes();
  const matched=mutualMatches();
  let html='';
  if(incoming.length){
    html += `<div class="match-section"><h3>Liked you</h3>${incoming.map(p=>`<article class="match-card incoming-like">${miniAvatarMarkup(p)}<div><h3>${escapeHtml(p.name)}${p.age?`, ${escapeHtml(p.age)}`:''}</h3><p>${escapeHtml(p.distanceLabel || 'Nearby')} • ${escapeHtml(p.mutual[0] || 'Vault compatibility')}</p></div><div class="match-actions"><button class="primary match-action accept-like" data-key="${personKey(p)}">Like back</button><button class="ghost match-action ignore-like" data-key="${personKey(p)}">Ignore</button></div></article>`).join('')}</div>`;
  }
  if(matched.length){
    html += `<div class="match-section"><h3>Matches</h3>${matched.map(p=>`<article class="match-card">${miniAvatarMarkup(p)}<div><h3>${escapeHtml(p.name)}${p.age?`, ${escapeHtml(p.age)}`:''}</h3><p>${escapeHtml(p.distanceLabel || 'Nearby')} • ${escapeHtml(p.mutual[0] || 'Vault compatibility')}</p></div><div class="match-actions"><span class="score-badge">${p.score}%</span><button class="ghost match-action open-chat" data-key="${personKey(p)}">Chat</button><button class="danger match-action unmatch" data-key="${personKey(p)}">Unmatch</button></div></article>`).join('')}</div>`;
  }
  if(!incoming.length && !matched.length){
    html += '<div class="empty-state"><h3>No matches yet</h3><p>When someone likes you, they will appear here. Like them back to open a chat.</p></div>';
  }
  $('#matchesList').innerHTML = html;
  $$('.accept-like').forEach(btn=>btn.onclick=()=>acceptLike(btn.dataset.key));
  $$('.ignore-like').forEach(btn=>btn.onclick=()=>ignoreLike(btn.dataset.key));
  $$('.unmatch').forEach(btn=>btn.onclick=()=>unmatch(btn.dataset.key));
  $$('.open-chat').forEach(btn=>btn.onclick=()=>openChat(btn.dataset.key));
}
function renderChats(){
  const matched=mutualMatches();
  if(supa && authUser){ matched.forEach(p=>{ const k=personKey(p); if(!chatCache[k]) loadChatMessages(k, true).then(()=>renderChats()); }); }
  $('#chatList').innerHTML= matched.length ? matched.map(p=>`<article class="chat-row" data-key="${personKey(p)}">${miniAvatarMarkup(p)}<div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(chatPreview(p))}</p></div></article>`).join('') : '<div class="empty-state"><h3>No conversations yet</h3><p>Chats appear only after both people like each other.</p></div>';
  $$('.chat-row').forEach(row=>row.onclick=()=>openChat(row.dataset.key));
}

function conversationIdFor(key){
  const ids=[String(authUser?.id || state.userId || 'local'), String(key)].sort();
  return ids.join('__');
}
function getCachedChat(key){ return chatCache[String(key)] || []; }
function setCachedChat(key, messages){ chatCache[String(key)] = (messages || []).slice(-120); }
async function cleanupExpiredMessages(){
  if(!supa || !authUser) return;
  try{ await supa.from('fv_messages').delete().lt('expires_at', new Date().toISOString()); }catch(err){ console.warn('Expired message cleanup failed', err); }
}
async function loadChatMessages(key, quiet=true){
  if(!supa || !authUser || !key){ setCachedChat(key, []); return []; }
  await cleanupExpiredMessages();
  try{
    const me=authUser.id;
    const other=String(key);
    const {data,error}=await supa
      .from('fv_messages')
      .select('id,sender_id,recipient_id,body,created_at,expires_at')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
      .gt('expires_at', new Date().toISOString())
      .order('created_at',{ascending:true})
      .limit(120);
    if(error) throw error;
    const mapped=(data||[]).map(m=>({
      id:m.id,
      from:m.sender_id===me?'me':'them',
      text:m.body,
      at:m.created_at
    }));
    const before=JSON.stringify(getCachedChat(key));
    setCachedChat(key, mapped);
    if(!quiet && before !== JSON.stringify(mapped)) renderChats();
    return mapped;
  }catch(err){ console.warn('Could not load chat messages', err); if(!quiet) showToast('Messages could not be loaded right now.'); return getCachedChat(key); }
}
async function deleteConversationMessages(key){
  if(!supa || !authUser || !key) return;
  try{
    const me=authUser.id;
    const other=String(key);
    if(isUuidValue(other)){
      const pathsResult=await supa.rpc('fv_my_conversation_media_paths',{p_other_id:other});
      if(!pathsResult.error){
        const paths=(pathsResult.data||[]).map(x=>typeof x==='string'?x:x?.path).filter(Boolean);
        if(paths.length) await supa.storage.from(CHAT_MEDIA_BUCKET).remove(paths);
      }else if(!isMissingRpcError(pathsResult.error)) throw pathsResult.error;
      const deleted=await supa.rpc('fv_delete_my_conversation',{p_other_id:other});
      if(!deleted.error) return;
      if(!isMissingRpcError(deleted.error)) throw deleted.error;
    }
    await supa.from('fv_messages')
      .delete()
      .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`);
  }catch(err){ console.warn('Could not clear conversation messages', err); }
}
async function clearChat(key){
  await deleteConversationMessages(key);
  setCachedChat(key, []);
  renderChatMessages();
  renderChats();
  showToast('Chat cleared.');
}
function chatPreview(p){
  const msgs=getCachedChat(personKey(p));
  const last=msgs[msgs.length-1];
  if(last) return last.from==='me' ? `You: ${last.text}` : last.text;
  return p.mutual[0] && !p.mutual[0].startsWith('Vault overlap') ? `You both connect on ${p.mutual[0]}. Tap to start chatting.` : 'You matched. Tap to start chatting.';
}
function bindChatModalHandlers(){
  const closeBtn = $('#closeChat');
  const clearBtn = $('#chatClear');
  const compose = $('#chatCompose');
  const input = $('#chatInput');
  const sendBtn = $('#chatSend');

  if(closeBtn && !closeBtn.dataset.bound){
    closeBtn.dataset.bound='1';
    closeBtn.addEventListener('click', closeChatModal);
  }
  if(clearBtn && !clearBtn.dataset.bound){
    clearBtn.dataset.bound='1';
    clearBtn.addEventListener('click', ()=>{
      if(activeChatKey){
        clearChat(activeChatKey);
      }
    });
  }
  if(compose && !compose.dataset.bound){
    compose.dataset.bound='1';
    compose.addEventListener('submit', e=>{
      e.preventDefault();
      sendChatMessage();
    });
  }
  if(sendBtn && !sendBtn.dataset.bound){
    sendBtn.dataset.bound='1';
    sendBtn.addEventListener('click', e=>{
      e.preventDefault();
      sendChatMessage();
    });
  }
  if(input && !input.dataset.bound){
    input.dataset.bound='1';
    input.addEventListener('keydown', e=>{
      if(e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        sendChatMessage();
      }
    });
  }
}

function ensureChatModal(){
  let modal=$('#chatModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='chatModal';
    modal.className='chat-modal hidden';
    modal.innerHTML=`<div class="chat-sheet glass"><div class="chat-head"><button class="ghost-mini round" id="closeChat" type="button" aria-label="Close chat">←</button><div class="chat-person" id="chatPerson"></div><button class="danger mini-danger" id="chatClear" type="button">Clear</button></div><div class="session-note">Messages are saved for 72 hours, then expire automatically.</div><div class="chat-messages" id="chatMessages"></div><form class="chat-compose" id="chatCompose"><input id="chatInput" maxlength="500" placeholder="Write a message…" autocomplete="off" inputmode="text"><button class="primary" id="chatSend" type="submit">Send</button></form></div>`;
    $('.phone').appendChild(modal);
  }
  bindChatModalHandlers();
  return modal;
}
async function openChat(key){
  const p=people.find(x=>personKey(x)===String(key));
  if(!p || !isMutual(p)){ showToast('Chats open after you both like each other.'); return; }
  activeChatKey=String(key);
  const modal=ensureChatModal();
  $('#chatPerson').innerHTML=`${miniAvatarMarkup(p)}<div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.distanceLabel || 'Matched')}</p></div>`;
  modal.classList.remove('hidden');
  await loadChatMessages(activeChatKey, false);
  renderChatMessages();
  startChatAutoRefresh();
  setTimeout(()=>$('#chatInput')?.focus(),80);
}
function closeChatModal(){ const modal=$('#chatModal'); if(modal) modal.classList.add('hidden'); stopChatAutoRefresh(); activeChatKey=null; }
function renderChatMessages(){
  if(!activeChatKey) return;
  const p=people.find(x=>personKey(x)===String(activeChatKey));
  const msgs=getCachedChat(activeChatKey);
  const starter=p?.mutual?.[0] && !p.mutual[0].startsWith('Vault overlap') ? `You matched with ${p.name}. Shared signal: ${p.mutual[0]}.` : `You matched with ${p?.name || 'this person'}.`;
  $('#chatMessages').innerHTML = `<div class="chat-bubble system">${escapeHtml(starter)}</div>` + msgs.map(m=>`<div class="chat-bubble ${m.from==='me'?'mine':'theirs'}">${escapeHtml(m.text)}<span>${new Date(m.at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</span></div>`).join('');
  const box=$('#chatMessages'); if(box) box.scrollTop=box.scrollHeight;
}
async function sendChatMessage(){
  if(!activeChatKey){ showToast('Open a matched chat first.'); return; }
  const input=$('#chatInput');
  if(!input){ showToast('Chat input was not ready. Reopen the chat.'); return; }
  const text=(input.value||'').trim();
  if(!text){ input.focus(); return; }
  const p=people.find(x=>personKey(x)===String(activeChatKey));
  if(!p || !isMutual(p)){ showToast('Chats open after you both like each other.'); return; }
  if(!supa || !authUser){ showToast('Sign in is required to send messages.'); return; }
  const sendBtn=$('#chatSend');
  if(sendBtn) sendBtn.disabled = true;
  try{
    const expiresAt = new Date(Date.now() + MESSAGE_RETENTION_HOURS*60*60*1000).toISOString();
    const payload={
      sender_id: authUser.id,
      recipient_id: String(activeChatKey),
      conversation_id: conversationIdFor(activeChatKey),
      body: text,
      expires_at: expiresAt
    };
    const {error}=await supa.from('fv_messages').insert(payload);
    if(error) throw error;
    input.value='';
    await loadChatMessages(activeChatKey, true);
    renderChatMessages();
    renderChats();
    input.focus();
  }catch(err){ console.warn('Message send failed', err); showToast('Message could not be sent right now. Please try again.'); }
  finally{ if(sendBtn) sendBtn.disabled = false; }
}
function startChatAutoRefresh(){
  // Incoming messages are pushed through Supabase Realtime in v4. Own sends
  // refresh immediately, so a per-chat polling timer would only waste requests.
  stopChatAutoRefresh();
}
function stopChatAutoRefresh(){
  if(chatRefreshTimer) clearInterval(chatRefreshTimer);
  chatRefreshTimer=null;
}
function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
function safeImageUrl(value,{allowData=true}={}){
  const raw=String(value||'').trim();
  if(!raw) return '';
  if(allowData && /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw;
  try{
    const u=new URL(raw,window.location.href);
    const localHttp=(u.protocol==='http:' && ['localhost','127.0.0.1','::1'].includes(u.hostname));
    if(u.protocol!=='https:' && !localHttp) return '';
    if(u.username || u.password) return '';
    const supabaseHost=(()=>{try{return new URL(CONFIG.SUPABASE_URL||'').hostname;}catch{return '';}})();
    const allowed=u.origin===window.location.origin || u.hostname===supabaseHost || u.hostname.endsWith('.googleusercontent.com') || localHttp;
    if(!allowed) return '';
    // Encode characters that could escape an inline CSS url() or HTML attribute.
    return u.href.replace(/[\s"'()\\]/g,ch=>encodeURIComponent(ch));
  }catch{return '';}
}

// Real Admin Studio overrides: form-based Vault/category/answer management.
let adminSelectedCardId = null;
let adminSelectedCategory = null;
let adminSelectedAnswerKey = null;
let adminStudioBound = false;

function adminEscape(v){ return String(v ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
function adminSlug(v){ return String(v||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64) || `card-${Date.now()}`; }
function adminConfigObject(){ return {labels, categories:categoryMeta, cards:vaultCards}; }
function currentAdminConfig(){ return adminConfigObject(); }

function fillAdminEditors(cfg=currentAdminConfig()){
  const box = $('#adminJsonBox');
  if(box) box.value = JSON.stringify(cfg, null, 2);
}

function parseAdminEditors(){
  const box = $('#adminJsonBox');
  if(box && box.value.trim()) return JSON.parse(box.value);
  return adminConfigObject();
}

function resetAdminEditorsToDefaults(){
  const cfg = {labels:structuredClone(DEFAULT_LABELS), categories:structuredClone(DEFAULT_CATEGORY_META), cards:structuredClone(DEFAULT_VAULT_CARDS)};
  applyAdminConfig(cfg, true);
  localStorage.setItem('fvAdminConfigCache', JSON.stringify(cfg));
  fillAdminEditors(cfg);
  adminSelectedCardId = null;
  adminSelectedCategory = null;
  adminSelectedAnswerKey = null;
  renderAdminWorkspace();
  showToast('Defaults loaded into editor. Click Save All to publish.');
}

function bindAdminStudio(){
  if(adminStudioBound) return;
  adminStudioBound = true;
  $$('.admin-tab').forEach(btn=>btn.onclick=()=>{
    $$('.admin-tab').forEach(b=>b.classList.toggle('active', b===btn));
    $$('.admin-pane').forEach(p=>p.classList.toggle('active', p.id === `adminPane${btn.dataset.adminPane[0].toUpperCase()+btn.dataset.adminPane.slice(1)}`));
  });
  const cardSearch=$('#adminCardSearch'); if(cardSearch) cardSearch.oninput=renderAdminCards;
  const cardNew=$('#adminCardNew'); if(cardNew) cardNew.onclick=()=>selectAdminCard(null);
  const cardDup=$('#adminCardDuplicate'); if(cardDup) cardDup.onclick=duplicateAdminCard;
  const cardDelete=$('#adminCardDelete'); if(cardDelete) cardDelete.onclick=deleteAdminCard;
  const cardForm=$('#adminCardForm'); if(cardForm) cardForm.onsubmit=e=>{e.preventDefault(); saveAdminCard();};
  const cardMode=$('#adminCardMode'); if(cardMode) cardMode.onchange=()=>renderAdminCustomAnswerRows();
  const addCustom=$('#adminAddCustomAnswer'); if(addCustom) addCustom.onclick=addAdminCustomAnswerRow;

  const catNew=$('#adminCategoryNew'); if(catNew) catNew.onclick=()=>selectAdminCategory(null);
  const catDelete=$('#adminCategoryDelete'); if(catDelete) catDelete.onclick=deleteAdminCategory;
  const catForm=$('#adminCategoryForm'); if(catForm) catForm.onsubmit=e=>{e.preventDefault(); saveAdminCategory();};

  const ansNew=$('#adminAnswerNew'); if(ansNew) ansNew.onclick=()=>selectAdminAnswer(null);
  const ansDelete=$('#adminAnswerDelete'); if(ansDelete) ansDelete.onclick=deleteAdminAnswer;
  const ansForm=$('#adminAnswerForm'); if(ansForm) ansForm.onsubmit=e=>{e.preventDefault(); saveAdminAnswer();};

  const exportBtn=$('#adminExportJson'); if(exportBtn) exportBtn.onclick=()=>{ fillAdminEditors(); showToast('Config exported to JSON box.'); };
  const importBtn=$('#adminImportJson'); if(importBtn) importBtn.onclick=()=>importAdminJson();
  const saveAll=$('#adminSaveAll'); if(saveAll) saveAll.onclick=()=>saveAdminConfig(false);
}

function renderAdmin(){
  const admin = isAdmin();
  const tab = $('#adminTab'); if(tab) tab.classList.toggle('hidden', !admin);
  const nav=$('.bottom-nav'); if(nav) nav.classList.toggle('admin-on', admin);
  const lock = $('#adminLock'); if(lock) lock.classList.toggle('hidden', admin);
  const panel = $('#adminPanel'); if(panel) panel.classList.toggle('hidden', !admin);
  if(admin){ bindAdminStudio(); renderAdminWorkspace(); }
}

function renderAdminWorkspace(){
  renderAdminStats();
  renderAdminCategories();
  renderAdminCards();
  renderAdminAnswers();
  populateAdminCardCategorySelect();
  fillAdminEditors();
}

function renderAdminStats(){
  const c1=$('#adminCardCount'), c2=$('#adminCategoryCount'), c3=$('#adminAnswerCount'), c4=$('#adminLastSaved');
  if(c1) c1.textContent = vaultCards.length;
  if(c2) c2.textContent = Object.keys(categoryMeta).length;
  if(c3) c3.textContent = Object.keys(labels).length;
  if(c4) c4.textContent = 'Ready';
}

function populateAdminCardCategorySelect(){
  const sel=$('#adminCardCat'); if(!sel) return;
  const selected = sel.value || adminSelectedCategory || '';
  sel.innerHTML = Object.entries(categoryMeta).map(([name,meta])=>`<option value="${adminEscape(name)}">${adminEscape(meta?.emoji||'✨')} ${adminEscape(name)}</option>`).join('');
  if(selected && [...sel.options].some(o=>o.value===selected)) sel.value = selected;
}

function renderAdminCards(){
  const list=$('#adminCardList'); if(!list) return;
  const q=($('#adminCardSearch')?.value||'').toLowerCase();
  const cards=vaultCards.filter(c=>!q || `${c.id} ${c.title} ${c.cat} ${c.desc}`.toLowerCase().includes(q));
  list.innerHTML = cards.map(c=>{
    const meta=categoryMeta[c.cat]||{emoji:'✨'};
    return `<button class="admin-list-item ${c.id===adminSelectedCardId?'selected':''}" type="button" data-card-id="${adminEscape(c.id)}">
      <span class="admin-list-emoji">${adminEscape(meta.emoji||'✨')}</span><span><b>${adminEscape(c.title)}</b><small>${adminEscape(c.cat)} • ${adminEscape(c.id)}</small></span>
    </button>`;
  }).join('') || '<div class="admin-empty">No cards found.</div>';
  list.querySelectorAll('[data-card-id]').forEach(b=>b.onclick=()=>selectAdminCard(b.dataset.cardId));
}

function selectAdminCard(id){
  adminSelectedCardId = id;
  const card = vaultCards.find(c=>c.id===id) || {id:'', title:'', cat:Object.keys(categoryMeta)[0]||'', desc:''};
  $('#adminCardId').value = card.id || '';
  $('#adminCardTitle').value = card.title || '';
  populateAdminCardCategorySelect();
  $('#adminCardCat').value = card.cat || Object.keys(categoryMeta)[0] || '';
  $('#adminCardDesc').value = card.desc || '';
  const title=$('#adminCardFormTitle'); if(title) title.textContent = id ? 'Edit Vault Card' : 'Add New Vault Card';
  renderAdminCards();
}

function saveAdminCard(){
  if(!isAdmin()) return showToast('Admin access is restricted.');
  const id = adminSlug($('#adminCardId').value || $('#adminCardTitle').value);
  const card = {id, title:($('#adminCardTitle').value||'Untitled card').trim(), cat:$('#adminCardCat').value, desc:($('#adminCardDesc').value||'').trim()};
  const oldIndex = vaultCards.findIndex(c=>c.id===adminSelectedCardId || c.id===id);
  if(oldIndex >= 0) vaultCards[oldIndex] = card; else vaultCards.push(card);
  adminSelectedCardId = id;
  applyAdminConfig(adminConfigObject(), true);
  renderAdminWorkspace();
  saveAdminConfig(false);
}

function duplicateAdminCard(){
  const card = vaultCards.find(c=>c.id===adminSelectedCardId);
  if(!card) return showToast('Choose a card to duplicate.');
  const copy = {...card, id:adminSlug(card.id+' copy'), title:card.title+' Copy'};
  vaultCards.push(copy); adminSelectedCardId=copy.id; selectAdminCard(copy.id); renderAdminWorkspace(); showToast('Card duplicated. Click Save Card or Save All to publish.');
}

function deleteAdminCard(){
  if(!adminSelectedCardId) return showToast('Choose a card to delete.');
  if(!confirm('Delete this Vault card? Existing user ratings for this card key may remain in their profile data.')) return;
  vaultCards = vaultCards.filter(c=>c.id!==adminSelectedCardId);
  adminSelectedCardId=null; selectAdminCard(null); applyAdminConfig(adminConfigObject(), true); renderAdminWorkspace(); saveAdminConfig(false);
}

function renderAdminCategories(){
  const list=$('#adminCategoryList'); if(!list) return;
  list.innerHTML = Object.entries(categoryMeta).map(([name,meta])=>`<button class="admin-list-item ${name===adminSelectedCategory?'selected':''}" type="button" data-cat-name="${adminEscape(name)}">
    <span class="admin-list-emoji">${adminEscape(meta?.emoji||'✨')}</span><span><b>${adminEscape(name)}</b><small>${adminEscape(meta?.theme||'theme-fantasy')} • ${vaultCards.filter(c=>c.cat===name).length} cards</small></span>
  </button>`).join('') || '<div class="admin-empty">No categories yet.</div>';
  list.querySelectorAll('[data-cat-name]').forEach(b=>b.onclick=()=>selectAdminCategory(b.dataset.catName));
}

function selectAdminCategory(name){
  adminSelectedCategory = name;
  const meta = name ? categoryMeta[name] : {emoji:'✨', theme:'theme-fantasy'};
  $('#adminCategoryName').value = name || '';
  $('#adminCategoryEmoji').value = meta?.emoji || '✨';
  $('#adminCategoryTheme').value = meta?.theme || 'theme-fantasy';
  renderAdminCategories();
}

function saveAdminCategory(){
  if(!isAdmin()) return showToast('Admin access is restricted.');
  const newName = ($('#adminCategoryName').value||'').trim();
  if(!newName) return showToast('Category name is required.');
  const oldName = adminSelectedCategory;
  if(oldName && oldName !== newName){
    vaultCards = vaultCards.map(c=>c.cat===oldName ? {...c, cat:newName} : c);
    delete categoryMeta[oldName];
  }
  categoryMeta[newName] = {emoji:($('#adminCategoryEmoji').value||'✨').trim(), theme:$('#adminCategoryTheme').value||'theme-fantasy'};
  adminSelectedCategory = newName;
  applyAdminConfig(adminConfigObject(), true); renderAdminWorkspace(); saveAdminConfig(false);
}

function deleteAdminCategory(){
  if(!adminSelectedCategory) return showToast('Choose a category to delete.');
  const used = vaultCards.filter(c=>c.cat===adminSelectedCategory).length;
  if(used) return showToast(`Move or delete ${used} cards before deleting this category.`);
  if(!confirm('Delete this category?')) return;
  delete categoryMeta[adminSelectedCategory]; adminSelectedCategory=null; selectAdminCategory(null); applyAdminConfig(adminConfigObject(), true); renderAdminWorkspace(); saveAdminConfig(false);
}

function renderAdminAnswers(){
  const list=$('#adminAnswerList'); if(!list) return;
  list.innerHTML = Object.entries(labels).map(([key,label])=>`<button class="admin-list-item ${key===adminSelectedAnswerKey?'selected':''}" type="button" data-answer-key="${adminEscape(key)}">
    <span class="admin-list-emoji">${adminEscape(label.split(' ')[0]||'✅')}</span><span><b>${adminEscape(label)}</b><small>${adminEscape(key)}</small></span>
  </button>`).join('') || '<div class="admin-empty">No answers yet.</div>';
  list.querySelectorAll('[data-answer-key]').forEach(b=>b.onclick=()=>selectAdminAnswer(b.dataset.answerKey));
}

function selectAdminAnswer(key){
  adminSelectedAnswerKey = key;
  $('#adminAnswerKey').value = key || '';
  $('#adminAnswerLabel').value = key ? labels[key] : '';
  renderAdminAnswers();
}

function saveAdminAnswer(){
  if(!isAdmin()) return showToast('Admin access is restricted.');
  const key = adminSlug($('#adminAnswerKey').value || $('#adminAnswerLabel').value).replace(/-/g,'_');
  const label = ($('#adminAnswerLabel').value||'✅ New Answer').trim();
  if(adminSelectedAnswerKey && adminSelectedAnswerKey !== key) delete labels[adminSelectedAnswerKey];
  labels[key] = label; adminSelectedAnswerKey = key;
  applyAdminConfig(adminConfigObject(), true); renderAdminWorkspace(); saveAdminConfig(false);
}

function deleteAdminAnswer(){
  if(!adminSelectedAnswerKey) return showToast('Choose an answer to delete.');
  if(Object.keys(labels).length <= 2) return showToast('Keep at least two answer choices.');
  if(!confirm('Delete this answer choice?')) return;
  delete labels[adminSelectedAnswerKey]; adminSelectedAnswerKey=null; selectAdminAnswer(null); applyAdminConfig(adminConfigObject(), true); renderAdminWorkspace(); saveAdminConfig(false);
}

function importAdminJson(){
  try{
    const cfg = JSON.parse($('#adminJsonBox').value || '{}');
    if(!cfg.labels || !cfg.categories || !Array.isArray(cfg.cards)) throw new Error('Expected labels, categories, and cards.');
    applyAdminConfig(cfg, true);
    localStorage.setItem('fvAdminConfigCache', JSON.stringify(cfg));
    renderAdminWorkspace();
    showToast('Imported into editor. Click Save All to publish.');
  }catch(err){ console.warn(err); showToast('Invalid config JSON.'); }
}

async function saveAdminConfig(seedDefaults=false){
  if(!isAdmin()){ showToast('Admin access is restricted.'); return; }
  if(!supa){ showToast('Cloud service is temporarily unavailable.'); return; }
  try{
    const cfg = seedDefaults ? {labels:structuredClone(DEFAULT_LABELS), categories:structuredClone(DEFAULT_CATEGORY_META), cards:structuredClone(DEFAULT_VAULT_CARDS)} : adminConfigObject();
    if(!cfg.labels || !cfg.categories || !Array.isArray(cfg.cards)) throw new Error('Invalid admin config.');
    const rows = [
      {key:'labels', value:cfg.labels, updated_by:authUser.email, updated_at:new Date().toISOString()},
      {key:'categories', value:cfg.categories, updated_by:authUser.email, updated_at:new Date().toISOString()},
      {key:'cards', value:cfg.cards, updated_by:authUser.email, updated_at:new Date().toISOString()}
    ];
    const {error}=await supa.from('fv_admin_config').upsert(rows,{onConflict:'key'});
    if(error) throw error;
    applyAdminConfig(cfg, true);
    localStorage.setItem('fvAdminConfigCache', JSON.stringify(cfg));
    const saved=$('#adminLastSaved'); if(saved) saved.textContent = 'Saved now';
    renderAdminWorkspace();
    showToast(seedDefaults ? 'Published Vault defaults restored.' : 'Admin changes saved.');
  }catch(err){ console.warn(err); showToast('Admin save failed. No changes were published.'); }
}



/* ============================================================
   User-focused profiles + durable 72h chat + private photo sharing
   Additive patch: keeps existing match/admin/profile features intact.
   ============================================================ */
const CHAT_MEDIA_BUCKET = 'fv-private-chat';
const MEDIA_EXPIRY_OPTIONS = { default:72, '30m':0.5, '24h':24, '48h':48 };

function profileRowToPerson(row){
  const profile=row.profile||{};
  const displayName=(profile.displayName||profile.name||'Member').trim();
  const initial=(displayName[0]||'M').toUpperCase();
  const comp=compatibilityForRatings(row.ratings||{});
  const city=profile.city||profile.area||'';
  return {
    id: row.user_id || row.id || displayName,
    name: displayName,
    age: profile.age || '',
    distance: Number(profile.distance || 999),
    distanceLabel: city ? `📍 ${city}` : '📍 Nearby',
    score: comp.score,
    vibe: profile.headline || profile.bio || 'Building their Afterglow profile.',
    gradient: deterministicGradient(row.user_id || displayName),
    initial,
    avatarUrl: profile.avatarUrl || '',
    tags: [profile.sex, profile.lookingFor, profile.interests, profile.radius, row.email ? 'Verified' : 'Member'].filter(Boolean).slice(0,4),
    mutual: comp.shared.length ? comp.shared : ['Vault overlap appears after both people answer more cards'],
    likesMe: (row.liked || []).map(String).includes(String(authUser?.id || '')),
    ratings: row.ratings || {},
    profile,
    email: row.email || '',
    updatedAt: row.updated_at || ''
  };
}

function compareVaultWithPerson(p){
  const mine=state.ratings||{};
  const theirs=p?.ratings||{};
  const shared=[], curious=[], different=[], limits=[];
  Object.entries(theirs).forEach(([id,their])=>{
    const my=mine[id];
    if(!my) return;
    const card=vaultCards.find(c=>c.id===id);
    if(!card) return;
    const meta=categoryMeta[card.cat]||{};
    const row={id,title:card.title,cat:card.cat,emoji:meta.emoji||'✨',mine:my,theirs:their,mineLabel:labels[my]||my,theirLabel:labels[their]||their};
    const myPositive=['love','enjoy'].includes(my);
    const theirPositive=['love','enjoy'].includes(their);
    const bothCurious=my==='curious' && their==='curious';
    if(myPositive && theirPositive) shared.push(row);
    else if(bothCurious || (['love','enjoy','curious'].includes(my) && ['love','enjoy','curious'].includes(their))) curious.push(row);
    else if(my==='limit' || their==='limit') limits.push(row);
    else different.push(row);
  });
  return {shared,curious,different,limits};
}

function ensureMemberProfileModal(){
  let modal=$('#memberProfileModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='memberProfileModal';
    modal.className='member-profile-modal hidden';
    modal.innerHTML=`<div class="member-profile-sheet glass"><div class="member-profile-top"><button class="ghost-mini round" id="closeMemberProfile" type="button">←</button><button class="ghost mini-profile-chat" id="memberProfileChat" type="button">Chat</button></div><div id="memberProfileBody"></div></div>`;
    $('.phone').appendChild(modal);
    $('#closeMemberProfile').onclick=()=>modal.classList.add('hidden');
    $('#memberProfileChat').onclick=()=>{ const key=modal.dataset.key; modal.classList.add('hidden'); openChat(key); };
  }
  return modal;
}

function ratingRowsHtml(rows, empty, type='shared'){
  if(!rows.length) return `<div class="profile-empty-mini">${escapeHtml(empty)}</div>`;
  return rows.slice(0,14).map(r=>`<div class="vault-compare-card ${escapeHtml(type)}">
    <div class="compare-icon">${escapeHtml(r.emoji)}</div>
    <div class="compare-copy"><b>${escapeHtml(r.title)}</b><span>${escapeHtml(r.cat || 'Vault')}</span></div>
    <div class="compare-pills"><span>You ${escapeHtml(r.mineLabel)}</span><span>Them ${escapeHtml(r.theirLabel)}</span></div>
  </div>`).join('');
}

function interestsHtml(p){
  const raw=(p?.profile?.interests || '').split(',').map(x=>x.trim()).filter(Boolean);
  const tags=[p?.profile?.sex, p?.profile?.lookingFor, ...raw].filter(Boolean).slice(0,8);
  if(!tags.length) return '<span class="desire-chip muted-chip">Exploring</span>';
  return tags.map(t=>`<span class="desire-chip">${escapeHtml(t)}</span>`).join('');
}

function topVaultHtml(p){
  const ratings=p?.ratings||{};
  const priority=['love','enjoy','curious'];
  const rows=[];
  for(const want of priority){
    Object.entries(ratings).forEach(([id,val])=>{
      if(val!==want || rows.length>=8) return;
      const card=vaultCards.find(c=>c.id===id);
      if(card){ const meta=categoryMeta[card.cat]||{}; rows.push({title:card.title, cat:card.cat, emoji:meta.emoji||'✨', label:labels[val]||val}); }
    });
  }
  if(!rows.length) return '<div class="profile-empty-mini">They have not shared many Vault answers yet.</div>';
  return rows.map(r=>`<div class="interest-tile"><span>${escapeHtml(r.emoji)}</span><b>${escapeHtml(r.title)}</b><small>${escapeHtml(r.label)}</small></div>`).join('');
}


function openMemberProfile(key){
  const p=people.find(x=>personKey(x)===String(key));
  if(!p) return showToast('Profile not available yet.');
  if(!isMutual(p) && !p.likesMe) return showToast('Detailed profiles unlock after a match.');
  const modal=ensureMemberProfileModal();
  modal.dataset.key=personKey(p);
  const cmp=compareVaultWithPerson(p);
  const totalCompared=cmp.shared.length+cmp.curious.length+cmp.different.length+cmp.limits.length;
  const avatarUrl=safeImageUrl(p.avatarUrl);
  const avatarStyle=avatarUrl ? `background-image:url('${avatarUrl}')` : `background:linear-gradient(135deg,${p.gradient[0]},${p.gradient[1]})`;
  const heroBg=avatarUrl ? `background:linear-gradient(180deg,rgba(10,6,16,.05),rgba(10,6,16,.88)), url('${avatarUrl}') center/cover` : `background:radial-gradient(circle at 25% 20%,${p.gradient[0]},transparent 38%),linear-gradient(135deg,${p.gradient[1]},#150a25 72%)`;
  $('#memberProfileBody').innerHTML=`
    <div class="member-hero modern-member-hero" style="${heroBg}">
      <div class="member-hero-shade"></div>
      <div class="member-avatar-large" style="${avatarStyle}">${avatarUrl?'':escapeHtml(p.initial)}</div>
      <div class="member-hero-text">
        <div class="member-name-row"><h2>${escapeHtml(p.name)}${p.age?`, ${escapeHtml(p.age)}`:''}</h2><span class="online-pill">Verified</span></div>
        <p>${escapeHtml(p.vibe||'Building their Afterglow profile.')}</p>
        <div class="hero-meta-row">
          ${p.profile?.sex ? `<span>${escapeHtml(p.profile.sex)}</span>` : ''}
          ${p.distanceLabel ? `<span>${escapeHtml(p.distanceLabel)}</span>` : ''}
          ${p.profile?.lookingFor ? `<span>${escapeHtml(p.profile.lookingFor)}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="profile-action-strip">
      <button class="primary profile-chat-cta" type="button" data-chat-key="${personKey(p)}">💬 Message</button>
      <button class="ghost profile-unmatch-cta" type="button" data-unmatch-key="${personKey(p)}">Unmatch</button>
    </div>

    <div class="profile-score-grid modern-score-grid">
      <div><b>${p.score}%</b><span>chemistry</span></div>
      <div><b>${cmp.shared.length}</b><span>shared likes</span></div>
      <div><b>${totalCompared}</b><span>compared</span></div>
      <div><b>${cmp.limits.length}</b><span>limits</span></div>
    </div>

    <div class="profile-section-card about-card">
      <div class="section-heading"><h3>About ${escapeHtml(p.name.split(' ')[0] || p.name)}</h3></div>
      <p>${escapeHtml(p.profile?.bio || p.profile?.headline || 'No bio added yet.')}</p>
      <div class="desire-chip-wrap">${interestsHtml(p)}</div>
    </div>

    <div class="profile-section-card">
      <div class="section-heading"><h3>🔥 Their vibe</h3><span>Top Vault signals</span></div>
      <div class="interest-grid">${topVaultHtml(p)}</div>
    </div>

    <div class="profile-section-card match-glow">
      <div class="section-heading"><h3>💞 What you match on</h3><span>${cmp.shared.length} strong overlaps</span></div>
      <div class="compare-grid">${ratingRowsHtml(cmp.shared,'No strong shared likes yet. Answer more Vault cards to build overlap.','shared')}</div>
    </div>

    <div class="profile-section-card">
      <div class="section-heading"><h3>👀 Curious together</h3><span>Potential exploration</span></div>
      <div class="compare-grid">${ratingRowsHtml(cmp.curious,'No shared curiosities yet.','curious')}</div>
    </div>

    <div class="profile-section-card boundary-card">
      <div class="section-heading"><h3>🛑 Differences & boundaries</h3><span>Talk before trying</span></div>
      <div class="compare-grid">${ratingRowsHtml(cmp.limits.concat(cmp.different).slice(0,10),'No major conflicts found in answered cards.','boundary')}</div>
    </div>
  `;
  $$('.profile-chat-cta').forEach(btn=>btn.onclick=()=>{ modal.classList.add('hidden'); openChat(btn.dataset.chatKey); });
  $$('.profile-unmatch-cta').forEach(btn=>btn.onclick=()=>{ modal.classList.add('hidden'); unmatch(btn.dataset.unmatchKey); });
  $('#memberProfileChat').classList.toggle('hidden', !isMutual(p));
  modal.classList.remove('hidden');
}


function renderMatches(){
  const incoming=incomingLikes();
  const matched=mutualMatches();
  let html='';
  if(incoming.length){
    html += `<div class="match-section"><h3>Liked you</h3>${incoming.map(p=>`<article class="match-card incoming-like">${miniAvatarMarkup(p)}<div><h3>${escapeHtml(p.name)}${p.age?`, ${escapeHtml(p.age)}`:''}</h3><p>${escapeHtml(p.distanceLabel || 'Nearby')} • wants to connect</p></div><div class="match-actions"><button class="ghost match-action view-profile" data-key="${personKey(p)}">Profile</button><button class="primary match-action accept-like" data-key="${personKey(p)}">Like back</button><button class="ghost match-action ignore-like" data-key="${personKey(p)}">Ignore</button></div></article>`).join('')}</div>`;
  }
  if(matched.length){
    html += `<div class="match-section"><h3>Matches</h3>${matched.map(p=>`<article class="match-card">${miniAvatarMarkup(p)}<div><h3>${escapeHtml(p.name)}${p.age?`, ${escapeHtml(p.age)}`:''}</h3><p>${escapeHtml(p.distanceLabel || 'Nearby')} • ${escapeHtml(p.mutual[0] || 'Vault compatibility')}</p></div><div class="match-actions"><span class="score-badge">${p.score}%</span><button class="ghost match-action view-profile" data-key="${personKey(p)}">Profile</button><button class="ghost match-action open-chat" data-key="${personKey(p)}">Chat</button><button class="danger match-action unmatch" data-key="${personKey(p)}">Unmatch</button></div></article>`).join('')}</div>`;
  }
  if(!incoming.length && !matched.length){
    html += '<div class="empty-state"><h3>No matches yet</h3><p>When someone likes you, they will appear here. Like them back to open a chat and unlock profile compatibility.</p></div>';
  }
  $('#matchesList').innerHTML = html;
  $$('.accept-like').forEach(btn=>btn.onclick=()=>acceptLike(btn.dataset.key));
  $$('.ignore-like').forEach(btn=>btn.onclick=()=>ignoreLike(btn.dataset.key));
  $$('.unmatch').forEach(btn=>btn.onclick=()=>unmatch(btn.dataset.key));
  $$('.open-chat').forEach(btn=>btn.onclick=()=>openChat(btn.dataset.key));
  $$('.view-profile').forEach(btn=>btn.onclick=()=>openMemberProfile(btn.dataset.key));
}

function renderChats(){
  const matched=mutualMatches();
  // Chat history is loaded on demand when a conversation opens, and targeted
  // Realtime events update only the conversation that changed. Avoid N queries
  // just to draw the chat list for users with many matches.
  $('#chatList').innerHTML= matched.length ? matched.map(p=>`<article class="chat-row" data-key="${personKey(p)}">${miniAvatarMarkup(p)}<div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(chatPreview(p))}</p></div><button class="ghost mini-profile-open" data-profile-key="${personKey(p)}" type="button">Profile</button></article>`).join('') : '<div class="empty-state"><h3>No conversations yet</h3><p>Chats appear only after both people like each other.</p></div>';
  $$('.chat-row').forEach(row=>row.onclick=(e)=>{ if(e.target.closest('[data-profile-key]')) return; openChat(row.dataset.key); });
  $$('[data-profile-key]').forEach(btn=>btn.onclick=(e)=>{e.stopPropagation(); openMemberProfile(btn.dataset.profileKey);});
}

async function cleanupExpiredMessages(){
  // Remove the current user's expired media bytes first, then prune expired rows.
  if(!supa || !authUser) return;
  try{
    const pathsResult=await supa.rpc('fv_my_expired_media_paths');
    if(!pathsResult.error){
      const paths=(pathsResult.data||[]).map(x=>typeof x==='string'?x:x?.path).filter(Boolean);
      if(paths.length) await supa.storage.from(CHAT_MEDIA_BUCKET).remove(paths);
      const cleanup=await supa.rpc('fv_cleanup_my_expired_messages');
      if(!cleanup.error) return;
      if(!isMissingRpcError(cleanup.error)) throw cleanup.error;
    }else if(!isMissingRpcError(pathsResult.error)) throw pathsResult.error;
    await supa.from('fv_messages').delete().lt('expires_at', new Date(Date.now()-60000).toISOString());
  }catch(err){ console.warn('Expired message cleanup failed', err); }
}


// Stable private media rendering: cache signed URLs and skip rebuilding
// unchanged chat DOM so timed photo thumbnails do not flash on refresh.
const signedMediaUrlCache = new Map();

function stableChatSignature(msgs){
  try{
    return JSON.stringify((msgs||[]).map(m=>({
      id:m.id, from:m.from, text:m.text, type:m.type, at:m.at, expiresAt:m.expiresAt,
      media:(m.media||[]).map(x=>({path:x.path, expires_at:x.expires_at, size:x.size, type:x.type}))
    })));
  }catch{
    return String(Date.now());
  }
}

// Signed chat media is batched inside loadChatMessages().
async function loadChatMessages(key, quiet=true){
  if(!supa || !authUser || !key){ setCachedChat(key, []); return []; }
  try{
    const me=authUser.id,other=String(key),now=Date.now();
    const {data,error}=await supa
      .from('fv_messages')
      .select('id,sender_id,recipient_id,body,message_type,media,created_at,expires_at')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
      .gt('expires_at', new Date().toISOString())
      .order('created_at',{ascending:true})
      .limit(120);
    if(error) throw error;
    const rows=data||[],activeMedia=[];
    rows.forEach(m=>(Array.isArray(m.media)?m.media:[]).forEach(item=>{if(item?.path&&(!item.expires_at||new Date(item.expires_at).getTime()>now))activeMedia.push(item);}));
    const missing=[];
    for(const item of activeMedia){const cacheKey=`${item.path}|${item.expires_at||''}`,cached=signedMediaUrlCache.get(cacheKey);if(!(cached?.signedUrl&&cached.validUntil>now+60000))missing.push(item);}
    if(missing.length){
      const unique=[...new Map(missing.map(item=>[item.path,item])).values()];
      const shortest=Math.min(...unique.map(item=>Math.max(300,Math.floor(((new Date(item.expires_at||Date.now()+3600000)).getTime()-now)/1000))));
      const expiresIn=Math.max(300,Math.min(3600,shortest));
      const batch=await supa.storage.from(CHAT_MEDIA_BUCKET).createSignedUrls(unique.map(x=>x.path),expiresIn);
      if(batch.error) throw batch.error;
      (batch.data||[]).forEach((entry,i)=>{const item=unique[i],path=entry?.path||item?.path,signedUrl=entry?.signedUrl||entry?.signedURL||'';if(item&&path&&signedUrl)signedMediaUrlCache.set(`${item.path}|${item.expires_at||''}`,{signedUrl,validUntil:now+expiresIn*1000});});
    }
    const mapped=rows.map(m=>({
      id:m.id,from:m.sender_id===me?'me':'them',text:m.body||'',type:m.message_type||'text',
      media:(Array.isArray(m.media)?m.media:[]).filter(item=>item?.path&&(!item.expires_at||new Date(item.expires_at).getTime()>now)).map(item=>({...item,signedUrl:signedMediaUrlCache.get(`${item.path}|${item.expires_at||''}`)?.signedUrl||''})).filter(item=>item.signedUrl),
      at:m.created_at,expiresAt:m.expires_at
    }));
    const before=JSON.stringify(getCachedChat(key));setCachedChat(key,mapped);if(!quiet&&before!==JSON.stringify(mapped))renderChats();return mapped;
  }catch(err){console.warn('Could not load chat messages',err);if(!quiet)showToast('Messages could not be loaded right now.');return getCachedChat(key);}
}

function chatPreview(p){
  const msgs=getCachedChat(personKey(p));
  const last=msgs[msgs.length-1];
  if(last){
    const label=last.type==='photo' ? '📷 Private photo' : last.text;
    return last.from==='me' ? `You: ${label}` : label;
  }
  return p.mutual[0] && !p.mutual[0].startsWith('Vault overlap') ? `You both connect on ${p.mutual[0]}. Tap to start chatting.` : 'You matched. Tap to start chatting.';
}

function ensureChatModal(){
  let modal=$('#chatModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='chatModal';
    modal.className='chat-modal hidden';
    modal.innerHTML=`<div class="chat-sheet glass"><div class="chat-head"><button class="ghost-mini round" id="closeChat" type="button" aria-label="Close chat">←</button><div class="chat-person" id="chatPerson"></div><button class="danger mini-danger" id="chatClear" type="button">Clear</button></div><div class="session-note">Messages and private photos expire automatically. Default retention is 72 hours.</div><div class="chat-messages" id="chatMessages"></div><form class="chat-compose enhanced-compose" id="chatCompose"><div class="private-photo-controls"><label class="photo-send-button">📷<input id="chatPhotoInput" type="file" accept="image/*" multiple></label><select id="chatExpiry"><option value="default">72 hours</option><option value="30m">30 minutes</option><option value="24h">24 hours</option><option value="48h">48 hours</option></select></div><input id="chatInput" maxlength="500" placeholder="Write a message…" autocomplete="off" inputmode="text"><button class="primary" id="chatSend" type="submit">Send</button></form></div>`;
    $('.phone').appendChild(modal);
  }
  bindChatModalHandlers();
  const photo=$('#chatPhotoInput');
  if(photo && !photo.dataset.bound){
    photo.dataset.bound='1';
    photo.addEventListener('change',()=>{ if(photo.files?.length) sendPrivatePhotos([...photo.files]); });
  }
  return modal;
}

function mediaHtml(m){
  const items=Array.isArray(m.media) ? m.media : [];
  if(!items.length) return '';
  return `<div class="private-media-grid ${items.length>1?'album':''}">${items.map(item=>{
    const url=safeImageUrl(item.signedUrl,{allowData:false});
    return url?`<a href="${url}" target="_blank" rel="noopener noreferrer" class="private-media-thumb"><img src="${url}" alt="Private shared photo"><span>Expires ${escapeHtml(timeUntil(item.expires_at || m.expiresAt))}</span></a>`:`<div class="private-media-thumb expired"><span>Photo unavailable</span></div>`;
  }).join('')}</div>`;
}
function timeUntil(value){
  const ms=new Date(value).getTime()-Date.now();
  if(!value || ms<=0) return 'soon';
  const h=Math.floor(ms/3600000), m=Math.round((ms%3600000)/60000);
  if(h>=24) return `${Math.ceil(h/24)}d`;
  if(h>=1) return `${h}h`;
  return `${Math.max(1,m)}m`;
}

function renderChatMessages(){
  if(!activeChatKey) return;
  const box=$('#chatMessages');
  if(!box) return;
  const p=people.find(x=>personKey(x)===String(activeChatKey));
  const msgs=getCachedChat(activeChatKey);
  const starter=p?.mutual?.[0] && !p.mutual[0].startsWith('Vault overlap') ? `You matched with ${p.name}. Shared signal: ${p.mutual[0]}.` : `You matched with ${p?.name || 'this person'}.`;
  const signature = `${activeChatKey}|${starter}|${stableChatSignature(msgs)}`;
  if(box.dataset.renderSignature === signature){
    return;
  }
  const wasNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  box.dataset.renderSignature = signature;
  box.innerHTML = `<div class="chat-bubble system">${escapeHtml(starter)}</div>` + msgs.map(m=>`<div class="chat-bubble ${m.from==='me'?'mine':'theirs'} ${m.type==='photo'?'photo-message':''}">${m.type==='photo'?mediaHtml(m):''}${m.text?`<div>${escapeHtml(m.text)}</div>`:''}<span>${new Date(m.at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})} • expires ${timeUntil(m.expiresAt)}</span></div>`).join('');
  if(wasNearBottom || !box.dataset.userScrolled) box.scrollTop=box.scrollHeight;
}

async function sendChatMessage(){
  if(!activeChatKey){ showToast('Open a matched chat first.'); return; }
  const input=$('#chatInput');
  if(!input){ showToast('Chat input was not ready. Reopen the chat.'); return; }
  const text=(input.value||'').trim();
  if(!text){ input.focus(); return; }
  const p=people.find(x=>personKey(x)===String(activeChatKey));
  if(!p || !isMutual(p)){ showToast('Chats open after you both like each other.'); return; }
  if(!supa || !authUser){ showToast('Sign in is required to send messages.'); return; }
  const sendBtn=$('#chatSend');
  if(sendBtn) sendBtn.disabled = true;
  try{
    const expiresAt = new Date(Date.now() + MESSAGE_RETENTION_HOURS*60*60*1000).toISOString();
    const payload={sender_id:authUser.id,recipient_id:String(activeChatKey),conversation_id:conversationIdFor(activeChatKey),body:text,message_type:'text',media:[],expires_at:expiresAt};
    const {error}=await supa.from('fv_messages').insert(payload);
    if(error) throw error;
    input.value='';
    await loadChatMessages(activeChatKey, true);
    renderChatMessages(); renderChats(); input.focus();
  }catch(err){ console.warn('Message send failed', err); showToast('Message could not be sent right now. Please try again.'); }
  finally{ if(sendBtn) sendBtn.disabled = false; }
}

async function sendPrivatePhotos(files){
  if(!files?.length || !activeChatKey) return;
  const p=people.find(x=>personKey(x)===String(activeChatKey));
  if(!p || !isMutual(p)){ showToast('Private photos unlock after a match.'); return; }
  if(!supa || !authUser){ showToast('Sign in is required to send private photos.'); return; }
  const expiryKey=$('#chatExpiry')?.value || 'default';
  const hours=MEDIA_EXPIRY_OPTIONS[expiryKey] || 72;
  const expiresAt=new Date(Date.now()+hours*60*60*1000).toISOString();
  const input=$('#chatPhotoInput');
  const uploaded=[];
  try{
    const conv=conversationIdFor(activeChatKey).replace(/[^a-zA-Z0-9_-]/g,'_');
    for(const file of files.slice(0,8)){
      if(!file.type.startsWith('image/')) continue;
      if(file.size > 12*1024*1024){ showToast('One photo was too large to prepare and was skipped.'); continue; }
      const prepared=await prepareImageUpload(file,{maxDimension:1600,maxBytes:950000,quality:.82});
      const path=`${authUser.id}/${conv}/${crypto.randomUUID()}.${prepared.ext}`;
      const {error}=await supa.storage.from(CHAT_MEDIA_BUCKET).upload(path, prepared.blob, {cacheControl:'3600', upsert:false, contentType:prepared.contentType});
      if(error) throw error;
      uploaded.push({path,name:file.name,type:prepared.contentType,size:prepared.storedBytes,original_size:file.size,expires_at:expiresAt});
    }
    if(!uploaded.length) return;
    const payload={sender_id:authUser.id,recipient_id:String(activeChatKey),conversation_id:conversationIdFor(activeChatKey),body:`📷 Private photo${uploaded.length>1?' album':''}`,message_type:'photo',media:uploaded,expires_at:expiresAt};
    const {error}=await supa.from('fv_messages').insert(payload);
    if(error) throw error;
    if(input) input.value='';
    await loadChatMessages(activeChatKey, true);
    renderChatMessages(); renderChats();
    showToast(`Private photo${uploaded.length>1?'s':''} sent. Expires in ${expiryKey==='default'?'72h':$('#chatExpiry')?.selectedOptions?.[0]?.textContent || '72h'}.`);
  }catch(err){
    if(uploaded.length){ try{ await supa.storage.from(CHAT_MEDIA_BUCKET).remove(uploaded.map(x=>x.path)); }catch{} }
    console.warn('Private photo send failed', err); showToast('Photo failed. Uploaded files were rolled back.');
  }
}


/* =========================================================
   Afterglow patch: Daily Glow Coins, dynamic Vault prompts,
   and desktop-only Admin Studio. Additive / non-destructive.
   ========================================================= */

const DAILY_GLOW_REWARDS = [5,10,15,15,20,20,50];
function localDateKey(offsetDays=0){ const d=new Date(); d.setDate(d.getDate()+offsetDays); const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function dateKeyInTimezone(timeZone){
  if(!timeZone) return localDateKey(0);
  try{
    const parts=Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const map=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }catch{return localDateKey(0);}
}
function shiftDateKey(key,days){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key||''));
  if(!match) return localDateKey(days);
  const d=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])+days));
  return d.toISOString().slice(0,10);
}
function todayKey(){ return dateKeyInTimezone(state?.rewards?.timezone); }
function yesterdayKey(){ return shiftDateKey(todayKey(),-1); }
function ensureRewards(){
  if(!state.rewards || typeof state.rewards !== 'object') state.rewards = {glowCoins:0, streak:0, lastClaimDate:'', claimedToday:false};
  state.rewards.glowCoins = Number(state.rewards.glowCoins || 0);
  state.rewards.streak = Number(state.rewards.streak || 0);
  state.rewards.lastClaimDate = state.rewards.lastClaimDate || '';
  const walletToday=dateKeyInTimezone(state.rewards.timezone);
  state.rewards.serverToday=walletToday;
  state.rewards.claimedToday = state.rewards.lastClaimDate === walletToday;
  return state.rewards;
}
function nextDailyReward(){
  const r=ensureRewards();
  const continuing = r.lastClaimDate === yesterdayKey() || r.lastClaimDate === todayKey();
  const nextStreak = r.claimedToday ? r.streak : (continuing ? r.streak + 1 : 1);
  return DAILY_GLOW_REWARDS[Math.min(Math.max(nextStreak,1),7)-1];
}
function renderDailyGift(){
  const r=ensureRewards();
  const bal=$('#glowCoinBalance'); if(bal) bal.textContent=r.glowCoins;
  const btn=$('#claimDailyGift'); if(btn){ btn.disabled=!!r.claimedToday; btn.textContent=r.claimedToday?'Claimed today':'Claim gift'; }
  const title=$('#dailyGiftTitle'); if(title) title.textContent = r.claimedToday ? 'Gift claimed ✨' : `Claim ${nextDailyReward()} Glow Coins`;
  const text=$('#dailyGiftText'); if(text) text.textContent = r.claimedToday ? `You are on a ${r.streak || 1}-day streak. Come back tomorrow to keep your glow.` : 'Daily logins earn Glow Coins. Keep your streak alive for a 50 coin day-seven reward.';
  const row=$('#dailyStreakRow');
  if(row){ const shownDay=Math.min(Math.max(Number(r.streak||0),1),7); row.innerHTML=DAILY_GLOW_REWARDS.map((n,i)=>`<span class="streak-dot ${(r.streak||0)>i?'done':''} ${shownDay===i+1?'current':''}"><b>${i+1}</b><small>${n}</small></span>`).join(''); }
  const gift=$('#dailyGift'); if(gift){ gift.classList.toggle('claimable', !r.claimedToday); gift.title=`Glow Coins: ${r.glowCoins}`; }
}
async function claimDailyGift(){
  const r=ensureRewards();
  if(r.claimedToday){ showToast('Daily gift already claimed.'); return; }
  if(supa && authUser){
    try{
      const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const {data,error}=await supa.rpc('fv_claim_daily_glow',{p_timezone:timezone});
      if(error) throw error;
      const result=Array.isArray(data)?data[0]:data;
      applyEconomyPayload(result);
      ensureRewards().claimedToday=ensureRewards().lastClaimDate===todayKey();
      persistStateLocalOnly('daily_reward');
      renderDailyGift(); renderShop(); updateGlowCoinDisplays();
      if(result?.status==='already_claimed') showToast('Daily gift already claimed.');
      else showToast(`You earned ${Number(result?.reward||0)} Glow Coins.`);
      return;
    }catch(err){ console.warn('Server daily reward failed',err); showToast('Daily reward is temporarily unavailable. No wallet change was made.'); return; }
  }
  showToast('Daily rewards are temporarily unavailable. Please try again later.');
}
function openDailyGift(){ renderDailyGift(); $('#dailyModal')?.classList.remove('hidden'); }
function closeDailyGift(){ $('#dailyModal')?.classList.add('hidden'); }

function ratingKey(v){ return (typeof v === 'object' && v) ? (v.key ?? v.value ?? '') : v; }
function ratingText(v){ return (typeof v === 'object' && v) ? (v.text ?? v.value ?? v.key ?? '') : v; }
function cardAnswerOptions(card){
  const mode=card?.answerMode || card?.mode || 'global';
  if(mode === 'yesno') return {yes:'✅ Yes', no:'🙅 No'};
  if((mode === 'custom' || mode === 'dropdown') && card?.answers && typeof card.answers === 'object') return card.answers;
  return labels;
}
function isTextPrompt(card){ const m=card?.answerMode || card?.mode; return m === 'text' || m === 'textarea'; }
function isPositiveAnswer(key){ return ['love','enjoy','curious','yes'].includes(String(key)); }
function isLimitAnswer(key){ return ['limit','no','never','hard_limit'].includes(String(key)); }
function answerLabel(card, val){
  const key=ratingKey(val);
  if(isTextPrompt(card)) return ratingText(val) ? '✍️ Written' : 'Unanswered';
  const opts=cardAnswerOptions(card);
  return opts[key] || labels[key] || key || 'Unanswered';
}
function publicTextAnswerHtml(card, val){
  if(!isTextPrompt(card) || !card.profileVisible) return '';
  const text=String(ratingText(val)||'').trim();
  if(!text) return '';
  return `<div class="written-answer-card"><span>${escapeHtml((categoryMeta[card.cat]||{}).emoji || '✨')} ${escapeHtml(card.title)}</span><p>${escapeHtml(text)}</p></div>`;
}

function compatibilityForRatings(otherRatings={}){
  const mine=state.ratings||{};
  const shared=[];
  let positive=0, conflicts=0, compared=0;
  Object.entries(otherRatings||{}).forEach(([id, val])=>{
    const my=mine[id];
    if(!my) return;
    const card=vaultCards.find(c=>c.id===id);
    if(!card || isTextPrompt(card)) return;
    const myKey=ratingKey(my), theirKey=ratingKey(val);
    if(!myKey || !theirKey) return;
    compared++;
    const meta=categoryMeta[card.cat]||{};
    const label=`${meta.emoji||'✨'} ${card.title}`;
    const myPositive=isPositiveAnswer(myKey), theirPositive=isPositiveAnswer(theirKey);
    if(myPositive && theirPositive){ positive++; shared.push(label); }
    if((isLimitAnswer(myKey) && theirPositive) || (isLimitAnswer(theirKey) && myPositive)) conflicts++;
  });
  let score = compared ? Math.round(62 + (positive / Math.max(compared,1)) * 35 - conflicts * 10) : 70;
  score = Math.max(0, Math.min(99, score));
  return {score, shared: shared.slice(0,4), conflicts};
}

function compareVaultWithPerson(p){
  const mine=state.ratings||{};
  const theirs=p?.ratings||{};
  const shared=[], curious=[], different=[], limits=[], written=[];
  Object.entries(theirs).forEach(([id,their])=>{
    const my=mine[id];
    const card=vaultCards.find(c=>c.id===id);
    if(!card) return;
    if(isTextPrompt(card)){
      const html=publicTextAnswerHtml(card, their);
      if(html) written.push({html});
      return;
    }
    if(!my) return;
    const meta=categoryMeta[card.cat]||{};
    const myKey=ratingKey(my), theirKey=ratingKey(their);
    const row={id,title:card.title,cat:card.cat,emoji:meta.emoji||'✨',mine:myKey,theirs:theirKey,mineLabel:answerLabel(card,my),theirLabel:answerLabel(card,their)};
    const myPositive=isPositiveAnswer(myKey), theirPositive=isPositiveAnswer(theirKey);
    const bothCurious=myKey==='curious' && theirKey==='curious';
    if(myPositive && theirPositive) shared.push(row);
    else if(bothCurious || (myPositive && theirPositive)) curious.push(row);
    else if(isLimitAnswer(myKey) || isLimitAnswer(theirKey)) limits.push(row);
    else different.push(row);
  });
  return {shared,curious,different,limits,written};
}

function topVaultHtml(p){
  const ratings=p?.ratings||{};
  const priority=['love','enjoy','curious','yes'];
  const rows=[];
  for(const want of priority){
    Object.entries(ratings).forEach(([id,val])=>{
      const card=vaultCards.find(c=>c.id===id);
      if(!card || isTextPrompt(card) || rows.length>=8) return;
      if(ratingKey(val)!==want) return;
      const meta=categoryMeta[card.cat]||{};
      rows.push({title:card.title, cat:card.cat, emoji:meta.emoji||'✨', label:answerLabel(card,val)});
    });
  }
  if(!rows.length) return '<div class="profile-empty-mini">They have not shared many Vault answers yet.</div>';
  return rows.map(r=>`<div class="interest-tile"><span>${escapeHtml(r.emoji)}</span><b>${escapeHtml(r.title)}</b><small>${escapeHtml(r.label)}</small></div>`).join('');
}

function renderVault(){
  const searchEl=$('#searchCards'), catEl=$('#categoryFilter');
  const q=(searchEl?.value||'').toLowerCase(); const cat=catEl?.value||'all';
  const list=vaultCards.filter(c=>(cat==='all'||c.cat===cat)&&(!q||`${c.title} ${c.desc} ${c.cat}`.toLowerCase().includes(q)));
  const cardsEl=$('#cards'); if(!cardsEl) return;
  cardsEl.innerHTML=list.map(card=>{
    const cur=state.ratings[card.id]; const meta=categoryMeta[card.cat]||{emoji:'✨', theme:'theme-fantasy'};
    let control='';
    if(isTextPrompt(card)){
      const multiline=(card.answerMode||card.mode)==='textarea';
      const val=escapeHtml(String(ratingText(cur)||''));
      control = multiline ? `<textarea class="vault-written-answer" data-id="${adminEscape(card.id)}" placeholder="Write your answer...">${val}</textarea>` : `<input class="vault-written-answer" data-id="${adminEscape(card.id)}" value="${val}" placeholder="Write your answer..." />`;
    }else{
      const opts=cardAnswerOptions(card);
      const key=ratingKey(cur);
      control = `<div class="answers">${Object.entries(opts).map(([k,v])=>`<button class="answer-btn ${key===k?'selected':''}" data-id="${adminEscape(card.id)}" data-answer="${adminEscape(k)}">${adminEscape(v)}</button>`).join('')}</div>`;
    }
    return `<article class="vcard ${meta.theme}"><div class="vcard-top"><span class="cat-badge">${meta.emoji||'✨'} ${adminEscape(card.cat)}</span><span class="rating-badge">${cur?adminEscape(answerLabel(card,cur)):'❔ Unanswered'}</span></div><h3>${adminEscape(card.title)}</h3><p>${adminEscape(card.desc||'')}</p>${control}</article>`;
  }).join('') || '<div class="empty-state"><h3>No Vault prompts yet</h3><p>The admin can add prompts from Admin Studio.</p></div>';
  $$('.answer-btn').forEach(b=>b.onclick=()=>{state.ratings[b.dataset.id]=b.dataset.answer; save(); renderVault(); if(directoryLoaded) loadPeopleDirectory({preserveIndex:true, quiet:true});});
  $$('.vault-written-answer').forEach(el=>el.onchange=()=>{state.ratings[el.dataset.id]={type:'text', value:el.value.trim()}; save(); renderVaultStats(); if(directoryLoaded) loadPeopleDirectory({preserveIndex:true, quiet:true});});
}
function renderVaultStats(){ const vals=Object.values(state.ratings||{}).filter(v=>String(ratingText(v)||ratingKey(v)||'').trim()); $('#ratedCount').textContent=vals.length; $('#limitCount').textContent=vals.filter(v=>isLimitAnswer(ratingKey(v))).length; $('#vaultPct').textContent=(vaultCards.length?Math.round(vals.length/vaultCards.length*100):0)+'%'; }

function isDesktopAdminViewport(){ return window.matchMedia('(min-width: 900px) and (pointer: fine)').matches; }
function renderAdmin(){
  const admin = isAdmin();
  const desktop = isDesktopAdminViewport();
  const allowed = admin && desktop;
  const tab = $('#adminTab'); if(tab) tab.classList.toggle('hidden', !allowed);
  const nav=$('.bottom-nav'); if(nav) nav.classList.toggle('admin-on', allowed);
  const lock = $('#adminLock'); if(lock) lock.classList.toggle('hidden', allowed || !admin);
  const panel = $('#adminPanel'); if(panel) panel.classList.toggle('hidden', !allowed);
  if(admin && !desktop && $('#admin')?.classList.contains('active-screen')) showScreen('profile');
  if(allowed){ bindAdminStudio(); renderAdminWorkspace(); }
}
window.addEventListener('resize', ()=>renderAdmin());


function normalizeAdminCustomAnswerKey(value){
  return adminSlug(value || '').replace(/-/g,'_');
}
function defaultCustomAnswerRows(){
  return [{key:'yes', label:'✅ Yes'}, {key:'no', label:'🙅 No'}];
}
function adminAnswersToRows(answers){
  if(answers && typeof answers === 'object' && !Array.isArray(answers)){
    return Object.entries(answers).map(([key,label])=>({key:String(key), label:String(label)}));
  }
  return defaultCustomAnswerRows();
}
function renderAdminCustomAnswerRows(answers){
  const wrap=$('#adminCustomAnswerRows');
  if(!wrap) return;
  const mode=$('#adminCardMode')?.value || 'global';
  const rows=adminAnswersToRows(answers).filter(r=>r.key || r.label);
  const active = mode === 'custom';
  const builder=$('#adminCustomAnswerBuilder');
  if(builder) builder.classList.toggle('custom-disabled', !active);
  if(!active){
    wrap.innerHTML='<div class="custom-answer-empty">Custom answer fields are available when Prompt type is set to <b>Custom choices for this prompt</b>. Global, Yes/No, and written prompts do not need custom choices.</div>';
    syncAdminCustomAnswersHidden();
    return;
  }
  wrap.innerHTML = (rows.length ? rows : defaultCustomAnswerRows()).map((row,i)=>`<div class="custom-answer-row" data-row="${i}">
    <input class="custom-answer-key" placeholder="answer_key" value="${adminEscape(row.key)}" />
    <input class="custom-answer-label" placeholder="Emoji + label, e.g. 😏 Intrigued" value="${adminEscape(row.label)}" />
    <button type="button" class="danger remove-custom-answer" title="Remove answer">×</button>
  </div>`).join('');
  wrap.querySelectorAll('input').forEach(inp=>inp.oninput=syncAdminCustomAnswersHidden);
  wrap.querySelectorAll('.remove-custom-answer').forEach(btn=>btn.onclick=()=>{ btn.closest('.custom-answer-row')?.remove(); syncAdminCustomAnswersHidden(); if(!wrap.querySelector('.custom-answer-row')) renderAdminCustomAnswerRows({}); });
  syncAdminCustomAnswersHidden();
}
function getAdminCustomAnswersFromRows(){
  const rows=[...document.querySelectorAll('#adminCustomAnswerRows .custom-answer-row')];
  const out={};
  for(const row of rows){
    const rawKey=row.querySelector('.custom-answer-key')?.value || '';
    const label=(row.querySelector('.custom-answer-label')?.value || '').trim();
    const key=normalizeAdminCustomAnswerKey(rawKey || label);
    if(key && label) out[key]=label;
  }
  return out;
}
function syncAdminCustomAnswersHidden(){
  const hidden=$('#adminCardAnswers');
  if(!hidden) return;
  const mode=$('#adminCardMode')?.value || 'global';
  hidden.value = mode === 'custom' ? JSON.stringify(getAdminCustomAnswersFromRows(), null, 2) : '';
}
function addAdminCustomAnswerRow(){
  const wrap=$('#adminCustomAnswerRows');
  if(!wrap) return;
  if(($('#adminCardMode')?.value || 'global') !== 'custom'){
    const mode=$('#adminCardMode'); if(mode){ mode.value='custom'; renderAdminCustomAnswerRows({}); }
  }
  const row=document.createElement('div');
  row.className='custom-answer-row';
  row.innerHTML=`<input class="custom-answer-key" placeholder="answer_key" />
    <input class="custom-answer-label" placeholder="Emoji + label, e.g. 🔥 Very interested" />
    <button type="button" class="danger remove-custom-answer" title="Remove answer">×</button>`;
  wrap.appendChild(row);
  row.querySelectorAll('input').forEach(inp=>inp.oninput=syncAdminCustomAnswersHidden);
  row.querySelector('.remove-custom-answer').onclick=()=>{ row.remove(); syncAdminCustomAnswersHidden(); };
  row.querySelector('.custom-answer-label')?.focus();
  syncAdminCustomAnswersHidden();
}

function selectAdminCard(id){
  adminSelectedCardId = id;
  const card = vaultCards.find(c=>c.id===id) || {id:'', title:'', cat:Object.keys(categoryMeta)[0]||'', desc:'', answerMode:'global', answers:null, profileVisible:false};
  $('#adminCardId').value = card.id || '';
  $('#adminCardTitle').value = card.title || '';
  populateAdminCardCategorySelect();
  $('#adminCardCat').value = card.cat || Object.keys(categoryMeta)[0] || '';
  $('#adminCardDesc').value = card.desc || '';
  const mode=$('#adminCardMode'); if(mode) mode.value=card.answerMode || card.mode || 'global';
  const answers=$('#adminCardAnswers'); if(answers) answers.value=card.answers ? JSON.stringify(card.answers, null, 2) : '';
  renderAdminCustomAnswerRows(card.answers || null);
  const visible=$('#adminCardProfileVisible'); if(visible) visible.checked=!!card.profileVisible;
  const title=$('#adminCardFormTitle'); if(title) title.textContent = id ? 'Edit Vault Prompt' : 'Add New Vault Prompt';
  renderAdminCards();
}
function saveAdminCard(){
  if(!isAdmin()) return showToast('Admin access is restricted.');
  const id = adminSlug($('#adminCardId').value || $('#adminCardTitle').value);
  const mode = $('#adminCardMode')?.value || 'global';
  let answers = null;
  if(mode === 'custom'){
    answers = getAdminCustomAnswersFromRows();
    if(!Object.keys(answers).length) return showToast('Add at least one custom answer.');
  }
  const card = {id, title:($('#adminCardTitle').value||'Untitled prompt').trim(), cat:$('#adminCardCat').value, desc:($('#adminCardDesc').value||'').trim(), answerMode:mode, profileVisible:!!$('#adminCardProfileVisible')?.checked};
  if(mode === 'custom' && answers && typeof answers === 'object') card.answers = answers;
  const oldIndex = vaultCards.findIndex(c=>c.id===adminSelectedCardId || c.id===id);
  if(oldIndex >= 0) vaultCards[oldIndex] = card; else vaultCards.push(card);
  adminSelectedCardId = id;
  applyAdminConfig(adminConfigObject(), true);
  renderAdminWorkspace();
  saveAdminConfig(false);
}
function duplicateAdminCard(){
  const card = vaultCards.find(c=>c.id===adminSelectedCardId);
  if(!card) return showToast('Choose a prompt to duplicate.');
  const copy = {...card, id:adminSlug(card.id+' copy'), title:card.title+' Copy'};
  vaultCards.push(copy); adminSelectedCardId=copy.id; selectAdminCard(copy.id); renderAdminWorkspace(); showToast('Prompt duplicated. Click Save Prompt or Save All to publish.');
}

function renderAdminCards(){
  const list=$('#adminCardList'); if(!list) return;
  const q=($('#adminCardSearch')?.value||'').toLowerCase();
  const cards=vaultCards.filter(c=>!q || `${c.id} ${c.title} ${c.cat} ${c.desc}`.toLowerCase().includes(q));
  list.innerHTML = cards.map(c=>{
    const meta=categoryMeta[c.cat]||{emoji:'✨'};
    const mode=c.answerMode||c.mode||'global';
    return `<button class="admin-list-item ${c.id===adminSelectedCardId?'selected':''}" type="button" data-card-id="${adminEscape(c.id)}">
      <span class="admin-list-emoji">${adminEscape(meta.emoji||'✨')}</span><span><b>${adminEscape(c.title)}</b><small>${adminEscape(c.cat)} • ${adminEscape(mode)} • ${adminEscape(c.id)}</small></span>
    </button>`;
  }).join('') || '<div class="admin-empty">No prompts found.</div>';
  list.querySelectorAll('[data-card-id]').forEach(b=>b.onclick=()=>selectAdminCard(b.dataset.cardId));
}

function profileWrittenAnswersHtml(p){
  const ratings=p?.ratings||{};
  const rows=[];
  Object.entries(ratings).forEach(([id,val])=>{
    const card=vaultCards.find(c=>c.id===id);
    const html=card ? publicTextAnswerHtml(card,val) : '';
    if(html) rows.push(html);
  });
  return rows.length ? rows.slice(0,6).join('') : '<div class="profile-empty-mini">No written profile prompts shared yet.</div>';
}

function init(){
  $('#ageConfirm').onchange=e=>{state.ageOk=!!e.target.checked; save(); updateGateUi();};
  $('#enterApp').onclick=()=>{ if(canEnter()) openApp(); else showToast('Please sign in with Google first.'); };
  $('#googleGate').onclick=async()=>{ if(!state.ageOk){showToast('Please confirm you are 18+ first.'); return;} await signInWithGoogle(); };
  $('#gateSignOut').onclick=signOut;
  const gateReset = $('#gateResetLocal'); if(gateReset) gateReset.onclick=resetLocalAppData;
  $$('.tab').forEach(b=>b.onclick=()=>showScreen(b.dataset.screen));
  $('#profileShortcut').onclick=()=>showScreen('profile');
  $('#filterOpen').onclick=()=>$('#filters').classList.remove('hidden');
  $('#closeFilters').onclick=$('#applyFilters').onclick=()=>$('#filters').classList.add('hidden');
  $('#dailyGift')?.addEventListener('click', openDailyGift);
  $('#closeDailyGift')?.addEventListener('click', closeDailyGift);
  $('#claimDailyGift')?.addEventListener('click', claimDailyGift);
  $$('.pill').forEach(b=>b.onclick=()=>{mode=b.dataset.mode; $$('.pill').forEach(x=>x.classList.toggle('active',x===b)); index=0; renderStack();});
  $('#passBtn')?.addEventListener('click',()=>act('pass')); $('#likeBtn')?.addEventListener('click',()=>act('like')); $('#vaultBtn')?.addEventListener('click',()=>{showToast('Mutual Vault details unlock after a match.'); showScreen('vault');});
  const exportData=$('#exportData'); if(exportData) exportData.onclick=()=>{const box=$('#exportBox'); if(box) box.textContent=JSON.stringify(state,null,2);};
  $('#googleLogin').onclick=signInWithGoogle;
  $('#signOut').onclick=signOut;
  const syncNow=$('#syncNow'); if(syncNow) syncNow.onclick=()=>syncToSupabase(true);
  const saveProfileBtn=$('#saveProfile'); if(saveProfileBtn) saveProfileBtn.onclick=saveProfileManually;
  const avatarUpload=$('#avatarUpload'); if(avatarUpload) avatarUpload.onchange=e=>handleAvatarUpload(e.target.files?.[0]);
  const removeAvatar=$('#removeAvatar'); if(removeAvatar) removeAvatar.onclick=removeAvatarPhoto;
  const adminSeed=$('#adminSeed'); if(adminSeed) adminSeed.onclick=()=>saveAdminConfig(true);
  const adminReload=$('#adminReload'); if(adminReload) adminReload.onclick=()=>loadAdminConfig();
  const adminSave=$('#adminSave'); if(adminSave) adminSave.onclick=()=>saveAdminConfig(false);
  const adminResetDefaults=$('#adminResetDefaults'); if(adminResetDefaults) adminResetDefaults.onclick=resetAdminEditorsToDefaults;
  ['displayName','age','headline','city','sex','radius','lookingFor','interests','bio'].forEach(id=>{const el=$('#'+id); if(el){ el.value=state.profile[id]||''; el.oninput=e=>{state.profile[id]=e.target.value; updateAvatar(); save();}; }});
  $('#searchCards').oninput=renderVault; $('#categoryFilter').onchange=renderVault;
  ensureRewards(); renderDailyGift(); applyAdminConfig(currentAdminConfig(), false); populateCats(); updateAvatar(); renderStack(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); initAuth().then(()=>{ ensureRewards(); renderDailyGift(); updateGateUi(); if(canEnter()) openApp(); syncToSupabase(false); });
}

init();

/* =========================================================
   Afterglow Glow Shop, wallet header, and cosmetic inventory
   ========================================================= */
const SHOP_ITEMS = [
  {id:'frame-neon',cat:'Profile',icon:'💖',title:'Neon Profile Ring',desc:'Adds a hot pink glow around your profile photo.',price:35,type:'avatarFrame',value:'frame-neon',featured:true},
  {id:'frame-gold',cat:'Profile',icon:'🌟',title:'Gold Profile Ring',desc:'A warm golden ring for a premium-looking profile.',price:45,type:'avatarFrame',value:'frame-gold'},
  {id:'frame-rainbow',cat:'Profile',icon:'🌈',title:'Rainbow Profile Ring',desc:'A colorful ring for playful, expressive profiles.',price:65,type:'avatarFrame',value:'frame-rainbow'},
  {id:'theme-midnight',cat:'Themes',icon:'🌙',title:'Midnight Banner',desc:'Unlocks a deep midnight profile banner.',price:25,type:'profileTheme',value:'theme-midnight'},
  {id:'theme-rose-gold',cat:'Themes',icon:'🌹',title:'Rose Gold Banner',desc:'A soft rose-gold gradient for your profile.',price:30,type:'profileTheme',value:'theme-rose-gold',featured:true},
  {id:'theme-cyber',cat:'Themes',icon:'⚡',title:'Cyber Glow Banner',desc:'Electric blue and violet banner energy.',price:40,type:'profileTheme',value:'theme-cyber'},
  {id:'theme-velvet',cat:'Themes',icon:'🖤',title:'Dark Velvet Banner',desc:'A moody, intimate velvet profile vibe.',price:40,type:'profileTheme',value:'theme-velvet'},
  {id:'badge-early',cat:'Badges',icon:'🏆',title:'Early Glower Badge',desc:'A collectible badge for members who joined Afterglow early.',price:50,type:'badge',value:'early-glower'},
  {id:'badge-streak',cat:'Badges',icon:'🔥',title:'Streak Keeper Badge',desc:'Show off that you keep coming back.',price:75,type:'badge',value:'streak-keeper'},
  {id:'chat-hearts',cat:'Chat',icon:'💕',title:'Heart Reaction Pack',desc:'Adds heart reactions to matched conversations.',price:20,type:'chatPack',value:'chat-hearts'},
  {id:'chat-fire',cat:'Chat',icon:'🔥',title:'Fire Reaction Pack',desc:'Adds fire reactions to matched conversations.',price:20,type:'chatPack',value:'chat-fire'},
  {id:'vault-spark',cat:'Vault',icon:'✨',title:'Spark Vault Cards',desc:'Adds a luminous spark accent to your Vault cards.',price:30,type:'vaultStyle',value:'vault-spark'},
  {id:'vault-gold',cat:'Vault',icon:'🔐',title:'Gold Vault Accent',desc:'Adds a polished gold accent to Vault compatibility cards.',price:45,type:'vaultStyle',value:'vault-gold'},
  {id:'sticker-flirt',cat:'Stickers',icon:'😏',title:'Flirty Sticker Pack',desc:'A playful sticker pack for matched chats.',price:25,type:'stickerPack',value:'flirty'},
  {id:'sticker-soft',cat:'Stickers',icon:'🥰',title:'Soft Romance Stickers',desc:'A warm sticker pack for affectionate conversations.',price:25,type:'stickerPack',value:'soft-romance'}
];
let activeShopCategory = 'Featured';
function ensureEconomy(){
  const r=ensureRewards();
  if(!state.inventory || typeof state.inventory !== 'object') state.inventory = {owned:[], equipped:{}};
  if(!Array.isArray(state.inventory.owned)) state.inventory.owned=[];
  if(!state.inventory.equipped || typeof state.inventory.equipped !== 'object') state.inventory.equipped={};
  if(!state.profile) state.profile={};
  state.profile.rewards = r;
  state.profile.inventory = state.inventory;
  return {rewards:r, inventory:state.inventory};
}
function ownedItemIds(){ return new Set((ensureEconomy().inventory.owned||[])); }
function isShopOwned(id){ return ownedItemIds().has(id); }
function isShopEquipped(item){ const inv=ensureEconomy().inventory; return inv.equipped?.[item.type] === item.value; }
function shopCategories(){ return ['Featured', ...Array.from(new Set(SHOP_ITEMS.map(i=>i.cat)))]; }
function syncEconomyFromProfile(){
  if(state.profile?.rewards && typeof state.profile.rewards === 'object') state.rewards = {...(state.rewards||{}), ...state.profile.rewards};
  if(state.profile?.inventory && typeof state.profile.inventory === 'object') state.inventory = {...(state.inventory||{}), ...state.profile.inventory};
  ensureEconomy();
}
function updateGlowCoinDisplays(){
  const {rewards, inventory}=ensureEconomy();
  ['headerGlowCoins','shopGlowCoins','glowCoinBalance'].forEach(id=>{ const el=$('#'+id); if(el) el.textContent=Number(rewards.glowCoins||0); });
  const count=$('#shopInventoryCount'); if(count) count.textContent=`${(inventory.owned||[]).length} owned unlock${(inventory.owned||[]).length===1?'':'s'}`;
}

function renderShop(){
  ensureEconomy(); updateGlowCoinDisplays();
  const cats=$('#shopCategoryTabs');
  if(cats){ cats.innerHTML=shopCategories().map(c=>`<button class="shop-cat ${activeShopCategory===c?'active':''}" data-shop-cat="${escapeHtml(c)}">${c==='Featured'?'⭐':categoryEmojiForShop(c)} ${escapeHtml(c)}</button>`).join(''); cats.querySelectorAll('[data-shop-cat]').forEach(btn=>btn.onclick=()=>{activeShopCategory=btn.dataset.shopCat; renderShop();}); }
  const featured=SHOP_ITEMS.find(i=>i.featured && !isShopOwned(i.id)) || SHOP_ITEMS.find(i=>i.featured) || SHOP_ITEMS[0];
  const hero=$('#shopFeatured');
  if(hero && featured){
    hero.innerHTML=`<article class="shop-hero-item"><div class="shop-icon">${featured.icon}</div><h3>${escapeHtml(featured.title)}</h3><p>${escapeHtml(featured.desc)}</p><div class="shop-meta"><span class="price-badge">🪙 ${featured.price}</span>${shopButtonHtml(featured)}</div></article>`;
    hero.querySelector('[data-buy-item]')?.addEventListener('click', e=>buyShopItem(e.currentTarget.dataset.buyItem));
    hero.querySelector('[data-equip-item]')?.addEventListener('click', e=>equipShopItem(e.currentTarget.dataset.equipItem));
  }
  const items=SHOP_ITEMS.filter(i=>activeShopCategory==='Featured'? i.featured || !isShopOwned(i.id) : i.cat===activeShopCategory);
  const grid=$('#shopGrid');
  if(grid){
    grid.innerHTML=items.map(item=>`<article class="shop-card ${isShopOwned(item.id)?'owned':''} ${isShopEquipped(item)?'equipped':''}"><div class="shop-icon">${item.icon}</div><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.desc)}</p><div class="shop-meta"><span class="price-badge">🪙 ${item.price}</span>${isShopOwned(item.id)?'<span class="owned-badge">Owned</span>':''}${isShopEquipped(item)?'<span class="equipped-badge">Equipped</span>':''}${shopButtonHtml(item)}</div></div></article>`).join('') || '<div class="empty-state"><h3>No items in this view</h3><p>Choose another shop category.</p></div>';
    grid.querySelectorAll('[data-buy-item]').forEach(btn=>btn.onclick=e=>buyShopItem(e.currentTarget.dataset.buyItem));
    grid.querySelectorAll('[data-equip-item]').forEach(btn=>btn.onclick=e=>equipShopItem(e.currentTarget.dataset.equipItem));
  }
}
function categoryEmojiForShop(cat){ return ({Profile:'🎨',Themes:'🌈',Badges:'🏆',Chat:'💬',Vault:'🔐',Stickers:'😏'})[cat] || '✨'; }
function shopButtonHtml(item){
  if(isShopOwned(item.id)){
    if(['avatarFrame','profileTheme'].includes(item.type)) return `<button class="shop-action equip" data-equip-item="${escapeHtml(item.id)}">${isShopEquipped(item)?'Equipped':'Equip'}</button>`;
    return '<button class="shop-action" disabled>Unlocked</button>';
  }
  const bal=ensureRewards().glowCoins||0;
  return `<button class="shop-action" data-buy-item="${escapeHtml(item.id)}" ${bal<item.price?'disabled':''}>Unlock</button>`;
}
async function buyShopItem(id){
  const item=SHOP_ITEMS.find(i=>i.id===id); if(!item) return;
  if(isShopOwned(id)) return equipShopItem(id);
  if(!supa || !authUser) return showToast('Purchases are temporarily unavailable. No Glow Coins were removed.');
  try{
    const {data,error}=await supa.rpc('fv_purchase_shop_item',{p_item_id:id});
    if(error) throw error;
    let result=Array.isArray(data)?data[0]:data;
    applyEconomyPayload(result);
    if(result?.status==='insufficient') return showToast(`Not enough Glow Coins yet. You need ${Number(result.needed||0)} more.`);
    if(['avatarFrame','profileTheme','avatarEffect','profileEffect','colorway'].includes(item.type)){
      const equipResult=await supa.rpc('fv_equip_shop_item',{p_item_id:id});
      if(equipResult.error) throw equipResult.error;
      result=Array.isArray(equipResult.data)?equipResult.data[0]:equipResult.data; applyEconomyPayload(result);
    }
    state.profile.inventory=state.inventory; persistStateLocalOnly('shop_purchase'); updateAvatar(); renderShop();
    await syncToSupabase(false,'shop_purchase');
    showToast(result?.status==='owned' ? `${item.title} is already unlocked.` : `Unlocked ${item.title}.`);
  }catch(err){ console.warn('Secure shop purchase failed',err); showToast('Purchase is temporarily unavailable. No Glow Coins were removed.'); }
}
async function equipShopItem(id){
  const item=SHOP_ITEMS.find(i=>i.id===id); if(!item) return;
  if(!isShopOwned(id)) return buyShopItem(id);
  if(!supa || !authUser) return showToast('Could not equip this item right now.');
  try{
    const {data,error}=await supa.rpc('fv_equip_shop_item',{p_item_id:id});
    if(error) throw error;
    applyEconomyPayload(data); state.profile.inventory=state.inventory; persistStateLocalOnly('shop_equip');
    updateAvatar(); renderShop(); await syncToSupabase(false,'shop_equip'); showToast(`${item.title} equipped.`);
  }catch(err){ console.warn('Secure equip failed',err); showToast('Could not equip this item right now.'); }
}
function applyCosmetics(){
  const inv=ensureEconomy().inventory;
  document.body.classList.remove('theme-midnight','theme-rose-gold','theme-cyber','theme-velvet');
  if(inv.equipped?.profileTheme) document.body.classList.add(inv.equipped.profileTheme);
  const frame=inv.equipped?.avatarFrame || '';
  ['.profile-avatar','#topProfileAvatar','#bottomProfileAvatar'].forEach(sel=>{
    document.querySelectorAll(sel).forEach(el=>{
      el.classList.remove('frame-neon','frame-gold','frame-rainbow');
      if(frame) el.classList.add(frame);
    });
  });
}
// wrap existing functions without removing them
const _agOriginalUpdateAvatar = updateAvatar;
updateAvatar = function(){ _agOriginalUpdateAvatar(); syncEconomyFromProfile(); applyCosmetics(); updateGlowCoinDisplays(); };
const _agOriginalRenderDailyGift = renderDailyGift;
renderDailyGift = function(){ _agOriginalRenderDailyGift(); updateGlowCoinDisplays(); };
const _agOriginalClaimDailyGift = claimDailyGift;
claimDailyGift = async function(){ await _agOriginalClaimDailyGift(); ensureEconomy(); renderShop(); updateGlowCoinDisplays(); };
const _agOriginalShowScreen = showScreen;
showScreen = function(id){ _agOriginalShowScreen(id); if(id==='shop') renderShop(); };
// late-bind shop controls after the original init has run
setTimeout(()=>{
  ensureEconomy(); updateGlowCoinDisplays(); renderShop(); applyCosmetics();
  $('#coinShortcut')?.addEventListener('click', openDailyGift);
  $('#shopDailyShortcut')?.addEventListener('click', openDailyGift);
}, 0);


/* =========================================================
   Afterglow admin wallet patch
   - Centers daily gift icon via CSS above
   - Adds owner-only Glow Coin adjustment controls for users
   - Additive only; existing wallet/shop functions remain intact
   ========================================================= */
let adminUsers = [];
let adminSelectedUserId = null;

function adminUserName(row){
  const p=row?.profile||{};
  return p.displayName || p.name || row?.email || 'Member';
}
function adminUserCoins(row){
  if(row && row.glow_coins !== undefined && row.glow_coins !== null) return Number(row.glow_coins||0);
  const rewards=(row?.profile||{}).rewards || {};
  return Number(rewards.glowCoins || 0);
}
function renderAdminUsers(){
  const list=$('#adminUserList');
  if(!list) return;
  const q=($('#adminUserSearch')?.value||'').toLowerCase().trim();
  const rows=(adminUsers||[]).filter(row=>{
    const text=`${adminUserName(row)} ${row.email||''} ${row.user_id||''}`.toLowerCase();
    return !q || text.includes(q);
  });
  list.innerHTML=rows.map(row=>{
    const name=adminEscape(adminUserName(row));
    const email=adminEscape(row.email||'No email');
    const coins=adminUserCoins(row);
    const recovery=row?.profile?._walletRecovery;
    const pending=recovery?.status==='pending';
    return `<button class="admin-list-item ${row.user_id===adminSelectedUserId?'selected':''} ${pending?'has-recovery':''}" type="button" data-admin-user-id="${adminEscape(row.user_id)}">
      <span class="admin-list-emoji">${pending?'⚠️':'🪙'}</span>
      <span><b>${name}</b><small>${pending?`Wallet review: ${Number(recovery.requested_balance||0)} requested`:email}</small></span>
      <span class="admin-coin-badge">${coins}</span>
    </button>`;
  }).join('') || '<div class="admin-empty">No users found yet.</div>';
  list.querySelectorAll('[data-admin-user-id]').forEach(btn=>btn.onclick=()=>selectAdminUser(btn.dataset.adminUserId));
  renderAdminSelectedUser();
}
function renderAdminSelectedUser(){
  const box=$('#adminSelectedUserCard');
  if(!box) return;
  const row=(adminUsers||[]).find(r=>r.user_id===adminSelectedUserId);
  if(!row){ box.className='admin-selected-user empty'; box.textContent='Select a user to edit their Glow Coin balance.'; return; }
  box.className='admin-selected-user';
  const recovery=row?.profile?._walletRecovery;
  const recoveryHtml=recovery?.status==='pending' ? `<div class="admin-wallet-recovery"><b>Legacy wallet recovery requested</b><p>Browser backup: ${Number(recovery.requested_balance||0)} coins • Server at detection: ${Number(recovery.server_balance_at_request||0)} coins</p><div><button type="button" class="primary" id="approveWalletRecovery">Approve preserved balance</button><button type="button" class="ghost" id="rejectWalletRecovery">Reject</button></div></div>` : '';
  box.innerHTML=`<b>${adminEscape(adminUserName(row))}</b><span>${adminEscape(row.email||'No email')}</span><div class="admin-user-meta"><small>User ID: ${adminEscape(String(row.user_id||'').slice(0,8))}…</small></div><strong>${adminUserCoins(row)} Glow Coins</strong>${recoveryHtml}`;
  $('#approveWalletRecovery')?.addEventListener('click',()=>resolveAdminWalletRecovery(true));
  $('#rejectWalletRecovery')?.addEventListener('click',()=>resolveAdminWalletRecovery(false));
}
function selectAdminUser(userId){
  adminSelectedUserId=userId;
  renderAdminUsers();
}
async function loadAdminUsers(){
  if(!isAdmin()) return;
  if(!supa || !authUser){ showToast('Cloud service is temporarily unavailable.'); return; }
  try{
    const rpc=await supa.rpc('fv_admin_list_users',{p_limit:250});
    if(rpc.error) throw rpc.error;
    adminUsers=rpc.data||[];
    if(adminSelectedUserId && !adminUsers.some(r=>r.user_id===adminSelectedUserId)) adminSelectedUserId=null;
    renderAdminUsers();
  }catch(err){ console.warn('Admin users load failed',err); showToast('Could not load users right now.'); }
}
async function adjustAdminUserCoins({setExact=false}={}){
  if(!isAdmin()) return showToast('Admin access is restricted.');
  const row=(adminUsers||[]).find(r=>r.user_id===adminSelectedUserId);
  if(!row) return showToast('Select a user first.');
  const amount=Number($('#adminCoinAmount')?.value || 0);
  if(!Number.isFinite(amount)) return showToast('Enter a valid coin amount.');
  const reason=($('#adminCoinReason')?.value||'').trim();
  try{
    const rpc=await supa.rpc('fv_admin_adjust_glow_coins',{p_user_id:row.user_id,p_amount:Math.round(amount),p_set_exact:!!setExact,p_reason:reason});
    if(!rpc.error){
      const result=Array.isArray(rpc.data)?rpc.data[0]:rpc.data;
      const wallet=result?.economy?.wallet||{};
      row.glow_coins=Number(wallet.glow_coins||0); row.streak=Number(wallet.streak||0); row.last_claim_date=wallet.last_claim_date||null;
      if(row.user_id===authUser.id) applyEconomyPayload(result);
      $('#adminCoinAmount').value=''; renderAdminUsers();
      showToast(`${adminUserName(row)} now has ${row.glow_coins} Glow Coins.`); return;
    }
    throw rpc.error;
  }catch(err){ console.warn('Admin coin update failed',err); showToast('Coin update failed. No wallet change was applied.'); }
}
async function resolveAdminWalletRecovery(approve){
  if(!isAdmin()) return showToast('Admin access is restricted.');
  const row=(adminUsers||[]).find(r=>r.user_id===adminSelectedUserId);
  const recovery=row?.profile?._walletRecovery;
  if(!row || recovery?.status!=='pending') return showToast('No pending wallet recovery is selected.');
  const action=approve?'approve':'reject';
  if(!window.confirm(`${action[0].toUpperCase()+action.slice(1)} this wallet recovery request?`)) return;
  try{
    const note=($('#adminCoinReason')?.value||'').trim();
    const {data,error}=await supa.rpc('fv_admin_resolve_wallet_recovery',{p_user_id:row.user_id,p_approve:!!approve,p_note:note});
    if(error) throw error;
    const result=Array.isArray(data)?data[0]:data;
    row.profile={...(row.profile||{}),_walletRecovery:result?.request||{...recovery,status:approve?'approved':'rejected'}};
    const wallet=result?.economy?.wallet||{}; row.glow_coins=Number(wallet.glow_coins||row.glow_coins||0);
    if(row.user_id===authUser.id){ applyEconomyPayload(result); state.meta.walletRecovery={...(state.meta.walletRecovery||{}),status:approve?'approved':'rejected',request:result?.request||null,updatedAt:new Date().toISOString()}; persistStateLocalOnly('wallet_recovery_resolved'); }
    renderAdminUsers(); showToast(approve?`Recovered wallet approved at ${row.glow_coins} Glow Coins.`:'Wallet recovery request rejected.');
  }catch(err){console.warn('Wallet recovery resolution failed',err);showToast('Wallet recovery could not be resolved.');}
}

function bindAdminWalletTools(){
  const reload=$('#adminUsersReload'); if(reload && !reload.dataset.bound){ reload.dataset.bound='1'; reload.onclick=loadAdminUsers; }
  const search=$('#adminUserSearch'); if(search && !search.dataset.bound){ search.dataset.bound='1'; search.oninput=renderAdminUsers; }
  const form=$('#adminCoinForm'); if(form && !form.dataset.bound){ form.dataset.bound='1'; form.onsubmit=e=>{e.preventDefault(); adjustAdminUserCoins({setExact:false});}; }
  const setBtn=$('#adminSetCoins'); if(setBtn && !setBtn.dataset.bound){ setBtn.dataset.bound='1'; setBtn.onclick=()=>adjustAdminUserCoins({setExact:true}); }
}

const _walletPatchBindAdminStudio = bindAdminStudio;
bindAdminStudio = function(){
  _walletPatchBindAdminStudio();
  bindAdminWalletTools();
};
const _walletPatchRenderAdminWorkspace = renderAdminWorkspace;
renderAdminWorkspace = function(){
  _walletPatchRenderAdminWorkspace();
  bindAdminWalletTools();
  if(isAdmin()) loadAdminUsers();
};


/* =========================================================
   Afterglow patch: Unlock audit, My Unlocks, customization,
   and functional chat reactions/stickers
   Additive only: existing shop/wallet/chat systems remain intact.
   ========================================================= */
(function(){
  const ITEM_COPY = {
    'chat-hearts':'Unlocks heart-themed quick reactions inside matched chats.',
    'chat-fire':'Unlocks fire/spicy quick reactions inside matched chats.',
    'sticker-flirt':'Unlocks flirty quick sticker-style messages inside matched chats.',
    'sticker-soft':'Unlocks soft romance sticker-style messages inside matched chats.',
    'badge-early':'Adds the Early Supporter badge to your owned unlocks.',
    'vault-spark':'Unlocks a cosmetic Spark Vault style for your Vault experience.'
  };
  function refreshShopItemCopy(){
    if(!Array.isArray(window.SHOP_ITEMS) && typeof SHOP_ITEMS === 'undefined') return;
    const items = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : window.SHOP_ITEMS;
    items.forEach(item=>{ if(ITEM_COPY[item.id]) item.desc = ITEM_COPY[item.id]; });
  }
  function itemById(id){ const items = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : []; return items.find(i=>i.id===id); }
  function ownedUnlockItems(){
    ensureEconomy();
    const owned = new Set((state.inventory?.owned)||[]);
    const items = typeof SHOP_ITEMS !== 'undefined' ? SHOP_ITEMS : [];
    return items.filter(i=>owned.has(i.id));
  }
  function unlockTypeTitle(type){ return ({avatarFrame:'Profile Frames',profileTheme:'Banner Themes',chatPack:'Chat Reactions',stickerPack:'Chat Stickers',badge:'Badges',vaultPack:'Vault Cosmetics'})[type] || 'Unlocks'; }
  function unlockTypeEmoji(type){ return ({avatarFrame:'🖼️',profileTheme:'🌈',chatPack:'💬',stickerPack:'😏',badge:'🏆',vaultPack:'🔐'})[type] || '✨'; }
  function defaultCustomColors(){ return {a:'#ff3f91', b:'#8b5cff'}; }
  function ensureCustomization(){
    ensureEconomy();
    if(!state.inventory.custom || typeof state.inventory.custom !== 'object') state.inventory.custom = defaultCustomColors();
    state.inventory.custom = {...defaultCustomColors(), ...state.inventory.custom};
    state.profile.inventory = state.inventory;
    return state.inventory.custom;
  }
  function setCustomization(part,value){
    const c=ensureCustomization();
    c[part]=value;
    state.inventory.custom=c; state.profile.inventory=state.inventory;
    applyCosmetics(); save(); syncToSupabase(false); renderMyUnlocks();
  }
  function equipOrToggleUnlock(id){
    const item=itemById(id); if(!item) return;
    if(['avatarFrame','profileTheme'].includes(item.type)) return equipShopItem(id);
    if(['chatPack','stickerPack'].includes(item.type)) return showToast(`${item.title} is available in matched chats.`);
    if(item.type==='badge') return showToast(`${item.title} is now in your unlock collection.`);
    return showToast(`${item.title} is unlocked.`);
  }
  function unlockButtonLabel(item){
    if(['avatarFrame','profileTheme'].includes(item.type)) return isShopEquipped(item) ? 'Equipped' : 'Equip';
    if(item.type==='chatPack') return 'Use in Chat';
    if(item.type==='stickerPack') return 'Use Stickers';
    if(item.type==='badge') return 'Owned Badge';
    return 'Unlocked';
  }
  window.renderMyUnlocks = function renderMyUnlocks(){
    const panel=$('#myUnlocksPanel'); if(!panel) return;
    const owned=ownedUnlockItems();
    ensureCustomization();
    if(!owned.length){
      panel.innerHTML=`<div class="my-unlocks-head"><div><h3>My Unlocks</h3><p>Your redeemed Glow Coin items appear here. Unlock frames, themes, reactions, stickers, and badges from the shop.</p></div></div><div class="unlock-empty">No unlocks yet. Claim your daily gift, earn Glow Coins, then redeem your first cosmetic.</div>`;
      return;
    }
    const byType=owned.reduce((acc,item)=>{(acc[item.type]||(acc[item.type]=[])).push(item); return acc;},{});
    const custom=ensureCustomization();
    const sections=Object.entries(byType).map(([type,items])=>`<section class="unlock-section"><div class="unlock-section-title"><span>${unlockTypeEmoji(type)} ${unlockTypeTitle(type)}</span><span>${items.length}</span></div><div class="unlock-grid">${items.map(item=>`<article class="unlock-card ${isShopEquipped(item)?'equipped':''}"><h4><span>${item.icon}</span>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.desc)}</p><button class="${isShopEquipped(item)?'ghost':'primary'}" type="button" data-unlock-use="${escapeHtml(item.id)}">${unlockButtonLabel(item)}</button></article>`).join('')}</div></section>`).join('');
    const canCustomize = owned.some(i=>['avatarFrame','profileTheme'].includes(i.type));
    panel.innerHTML=`<div class="my-unlocks-head"><div><h3>My Unlocks</h3><p>View, equip, and personalize the cosmetics you earned with Glow Coins.</p></div><button class="gift-small" id="myUnlocksGift" type="button">🎁 Gift</button></div>${sections}${canCustomize?`<div class="customizer-card"><h4>🎨 Color Customizer</h4><div class="customizer-grid"><label>Glow color A<input id="unlockColorA" type="color" value="${escapeHtml(custom.a)}"></label><label>Glow color B<input id="unlockColorB" type="color" value="${escapeHtml(custom.b)}"></label></div><div class="custom-preview"></div><p class="tiny-note">Applies to compatible owned frames and the custom banner glow.</p></div>`:''}`;
    panel.querySelectorAll('[data-unlock-use]').forEach(btn=>btn.onclick=()=>equipOrToggleUnlock(btn.dataset.unlockUse));
    $('#myUnlocksGift')?.addEventListener('click', openDailyGift);
    $('#unlockColorA')?.addEventListener('input', e=>setCustomization('a',e.target.value));
    $('#unlockColorB')?.addEventListener('input', e=>setCustomization('b',e.target.value));
  };
  const _unlockPatchShopButtonHtml = typeof shopButtonHtml === 'function' ? shopButtonHtml : null;
  if(_unlockPatchShopButtonHtml){
    shopButtonHtml = function(item){
      if(isShopOwned(item.id)){
        if(['avatarFrame','profileTheme'].includes(item.type)) return `<button class="shop-action equip" data-equip-item="${escapeHtml(item.id)}">${isShopEquipped(item)?'Equipped':'Equip'}</button>`;
        if(['chatPack','stickerPack'].includes(item.type)) return `<button class="shop-action equip" data-use-chat-unlock="${escapeHtml(item.id)}">Available</button>`;
        return '<button class="shop-action" disabled>Unlocked</button>';
      }
      const bal=ensureRewards().glowCoins||0;
      return `<button class="shop-action" data-buy-item="${escapeHtml(item.id)}" ${bal<item.price?'disabled':''}>Unlock</button>`;
    };
  }
  const _unlockPatchRenderShop = typeof renderShop === 'function' ? renderShop : null;
  if(_unlockPatchRenderShop){
    renderShop = function(){
      refreshShopItemCopy();
      _unlockPatchRenderShop();
      renderMyUnlocks();
      document.querySelectorAll('[data-use-chat-unlock]').forEach(btn=>btn.onclick=()=>showToast('Open a matched chat to use this unlock.'));
    };
  }
  const _unlockPatchBuy = typeof buyShopItem === 'function' ? buyShopItem : null;
  if(_unlockPatchBuy){ buyShopItem = async function(id){ await _unlockPatchBuy(id); renderMyUnlocks(); }; }
  const _unlockPatchEquip = typeof equipShopItem === 'function' ? equipShopItem : null;
  if(_unlockPatchEquip){ equipShopItem = async function(id){ await _unlockPatchEquip(id); applyCosmetics(); renderMyUnlocks(); }; }
  const _unlockPatchApplyCosmetics = typeof applyCosmetics === 'function' ? applyCosmetics : null;
  if(_unlockPatchApplyCosmetics){
    applyCosmetics = function(){
      _unlockPatchApplyCosmetics();
      const custom=ensureCustomization();
      document.body.style.setProperty('--ag-custom-a',custom.a);
      document.body.style.setProperty('--ag-custom-b',custom.b);
      const owned=ownedUnlockItems();
      const hasCustom=owned.some(i=>['avatarFrame','profileTheme'].includes(i.type));
      document.body.classList.toggle('customized-unlocks', hasCustom);
      document.querySelectorAll('.profile-banner').forEach(el=>el.classList.toggle('custom-banner', hasCustom && !!state.inventory?.equipped?.profileTheme));
    };
  }
  function ownedIds(){ ensureEconomy(); return new Set(state.inventory?.owned||[]); }
  function chatQuickButtons(){
    const owned=ownedIds();
    const rows=[];
    if(owned.has('chat-hearts')) rows.push({label:'Heart reactions',buttons:['💕','😍','🥰','💖','💘'].map(x=>({text:x}))});
    if(owned.has('chat-fire')) rows.push({label:'Fire reactions',buttons:['🔥','😈','✨','⚡','🌶️'].map(x=>({text:x}))});
    if(owned.has('sticker-flirt')) rows.push({label:'Flirty stickers',buttons:[{text:'😏 Flirty wink'},{text:'😘 Kiss'},{text:'👀 Curious'},{text:'💋 Tease'}]});
    if(owned.has('sticker-soft')) rows.push({label:'Soft stickers',buttons:[{text:'🥰 Warm hug'},{text:'🌹 Romantic'},{text:'💞 Thinking of you'},{text:'🫶 Sweet'}]});
    return rows;
  }
  function ensureUnlockChatTools(){
    const sheet=document.querySelector('#chatModal .chat-sheet');
    if(!sheet) return;
    let tools=$('#unlockChatTools');
    if(!tools){
      tools=document.createElement('div'); tools.id='unlockChatTools'; tools.className='unlock-chat-tools';
      const compose=$('#chatCompose');
      if(compose) sheet.insertBefore(tools, compose);
      else sheet.appendChild(tools);
    }
    const rows=chatQuickButtons();
    if(!rows.length){ tools.innerHTML=''; tools.classList.add('hidden'); return; }
    tools.classList.remove('hidden');
    tools.innerHTML=rows.map(row=>`<div><div class="unlock-chat-label">${escapeHtml(row.label)}</div><div class="unlock-chat-row">${row.buttons.map(b=>`<button class="unlock-chat-btn" type="button" data-chat-quick="${escapeHtml(b.text)}">${escapeHtml(b.text)}</button>`).join('')}</div></div>`).join('');
    tools.querySelectorAll('[data-chat-quick]').forEach(btn=>btn.onclick=()=>sendUnlockQuickChat(btn.dataset.chatQuick));
  }
  async function sendUnlockQuickChat(text){
    const input=$('#chatInput');
    if(!input) return showToast('Open a matched chat first.');
    input.value=text;
    await sendChatMessage();
  }
  const _unlockPatchEnsureChatModal = typeof ensureChatModal === 'function' ? ensureChatModal : null;
  if(_unlockPatchEnsureChatModal){ ensureChatModal = function(){ const modal=_unlockPatchEnsureChatModal(); ensureUnlockChatTools(); return modal; }; }
  const _unlockPatchOpenChat = typeof openChat === 'function' ? openChat : null;
  if(_unlockPatchOpenChat){ openChat = async function(key){ await _unlockPatchOpenChat(key); ensureUnlockChatTools(); }; }
  const _unlockPatchRenderChatMessages = typeof renderChatMessages === 'function' ? renderChatMessages : null;
  if(_unlockPatchRenderChatMessages){ renderChatMessages = function(){ _unlockPatchRenderChatMessages(); ensureUnlockChatTools(); }; }
  const _unlockPatchUpdateAvatar = typeof updateAvatar === 'function' ? updateAvatar : null;
  if(_unlockPatchUpdateAvatar){ updateAvatar = function(){ _unlockPatchUpdateAvatar(); applyCosmetics(); updateGlowCoinDisplays(); renderMyUnlocks(); }; }
  refreshShopItemCopy();
  setTimeout(()=>{ try{ ensureEconomy(); applyCosmetics(); renderShop(); renderMyUnlocks(); }catch(e){ console.warn('Unlock patch init skipped', e); } }, 800);
})();

/* Incoming-message notifications are handled by the v4 Realtime service below. */

/* =========================================================
   Afterglow v4: efficient realtime notification service
   Replaces aggressive 5-second directory/chat polling with one
   Supabase Realtime subscription plus a low-frequency safety poll.
   ========================================================= */
(function(){
  const FALLBACK_REFRESH_MS = 120000;
  let realtimeChannel = null;
  let fallbackTimer = null;
  let startedFor = '';
  let lastLikeKeys = new Set();
  let unreadByChat = {};
  let safetyRefreshInFlight=false;
  let lastSafetyRefreshAt=0;
  const seenKey = () => `afterglowGlobalIncomingSeen:${authUser?.id || 'guest'}`;
  const unreadKey = () => `afterglowUnreadByChat:${authUser?.id || 'guest'}`;
  function readSet(){ try{return new Set(JSON.parse(localStorage.getItem(seenKey())||'[]'));}catch{return new Set();} }
  function writeSet(set){ try{localStorage.setItem(seenKey(), JSON.stringify([...set].slice(-800)));}catch{} }
  function readUnread(){ try{return JSON.parse(localStorage.getItem(unreadKey())||'{}')||{};}catch{return {};} }
  function writeUnread(){ try{localStorage.setItem(unreadKey(), JSON.stringify(unreadByChat));}catch{} }
  function msgId(m){ return String(m?.id || `${m?.from||''}|${m?.at||''}|${m?.type||''}|${m?.text||''}`); }
  function ensureBadgeStyles(){
    if(document.getElementById('afterglowGlobalBadgeStyles')) return;
    const st=document.createElement('style'); st.id='afterglowGlobalBadgeStyles';
    st.textContent=`.tab{position:relative}.nav-badge{position:absolute;top:6px;right:10px;min-width:17px;height:17px;padding:0 5px;border-radius:99px;background:linear-gradient(135deg,#ff3f91,#ffd37a);color:#160d18;font-size:10px;font-weight:900;line-height:17px;box-shadow:0 8px 18px rgba(255,63,145,.34);display:none}.tab.has-badge .nav-badge{display:block}.global-notice-pop{position:fixed;left:50%;top:86px;transform:translateX(-50%) translateY(-12px);z-index:10000;width:min(92vw,400px);display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:22px;background:rgba(26,22,35,.95);border:1px solid rgba(255,255,255,.14);box-shadow:0 22px 60px rgba(0,0,0,.38);backdrop-filter:blur(18px);opacity:0;cursor:pointer;transition:opacity .18s ease,transform .18s ease}.global-notice-pop.show{opacity:1;transform:translateX(-50%) translateY(0)}.global-notice-pop .mini-avatar{width:42px;height:42px;min-width:42px;border-radius:16px}.global-notice-copy{min-width:0;flex:1;text-align:left}.global-notice-copy b{display:block;font-size:14px;color:#fff}.global-notice-copy span{display:block;margin-top:3px;font-size:12px;color:rgba(255,255,255,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.global-notice-open{font-size:12px;color:#ffd37a;font-weight:900;white-space:nowrap}@media(min-width:760px){.global-notice-pop{top:24px;right:24px;left:auto;transform:translateY(-12px)}.global-notice-pop.show{transform:translateY(0)}}`;
    document.head.appendChild(st);
  }
  function badgeFor(screen){
    const tab=document.querySelector(`.tab[data-screen="${screen}"]`); if(!tab) return null;
    let badge=tab.querySelector('.nav-badge'); if(!badge){badge=document.createElement('span');badge.className='nav-badge';tab.appendChild(badge);} return badge;
  }
  function totalUnread(){ return Object.values(unreadByChat||{}).reduce((a,b)=>a+Number(b||0),0); }
  function updateBadges(){
    ensureBadgeStyles();
    const chatCount=totalUnread(), chat=badgeFor('chat');
    if(chat){chat.textContent=chatCount>9?'9+':String(chatCount);chat.closest('.tab')?.classList.toggle('has-badge',chatCount>0);}
    let likeCount=0; try{likeCount=(typeof incomingLikes==='function'?incomingLikes():[]).length;}catch{}
    const match=badgeFor('matches'); if(match){match.textContent=likeCount>9?'9+':String(likeCount);match.closest('.tab')?.classList.toggle('has-badge',likeCount>0);}
  }
  function showGlobalNotice({kind='💬',title='Afterglow',body='New update',key='',action='Open',onClick=null}){
    if(document.hidden) return; ensureBadgeStyles(); document.querySelectorAll('.global-notice-pop').forEach(n=>n.remove());
    let person=null; try{person=(people||[]).find(p=>String(personKey(p))===String(key));}catch{}
    const pop=document.createElement('button'); pop.type='button'; pop.className='global-notice-pop';
    pop.innerHTML=`${person?miniAvatarMarkup(person):`<div class="mini-avatar">${kind}</div>`}<div class="global-notice-copy"><b>${escapeHtml(title)}</b><span>${escapeHtml(body)}</span></div><div class="global-notice-open">${escapeHtml(action)}</div>`;
    pop.onclick=()=>{pop.remove();if(onClick)onClick();else if(key&&typeof openChat==='function')openChat(key);}; document.body.appendChild(pop); requestAnimationFrame(()=>pop.classList.add('show')); setTimeout(()=>pop.remove(),5000);
  }
  if(typeof loadChatMessages==='function' && !loadChatMessages.__afterglowRealtimeWrapped){
    const baseLoad=loadChatMessages;
    loadChatMessages=async function(key,quiet=true){
      const keyStr=String(key||''), seen=readSet(), result=await baseLoad(key,quiet);
      const msgs=(typeof getCachedChat==='function'?getCachedChat(keyStr):(result||[]))||[];
      const incoming=msgs.filter(m=>m&&m.from==='them'), fresh=incoming.filter(m=>!seen.has(msgId(m)));
      incoming.forEach(m=>seen.add(msgId(m))); writeSet(seen);
      if(fresh.length && keyStr!==String(activeChatKey||'')){unreadByChat[keyStr]=Number(unreadByChat[keyStr]||0)+fresh.length;writeUnread();}
      updateBadges(); return result;
    };
    loadChatMessages.__afterglowRealtimeWrapped=true;
  }
  if(typeof openChat==='function' && !openChat.__afterglowRealtimeWrapped){
    const baseOpen=openChat; openChat=async function(key){const k=String(key||'');unreadByChat[k]=0;writeUnread();updateBadges();return baseOpen.apply(this,arguments);}; openChat.__afterglowRealtimeWrapped=true;
  }
  async function refreshLikes(){
    const before=new Set(lastLikeKeys);
    let current=[]; try{current=(typeof incomingLikes==='function'?incomingLikes():[]).map(p=>String(personKey(p))).filter(Boolean);}catch{}
    lastLikeKeys=new Set(current); const added=current.filter(k=>!before.has(k)); updateBadges();
    if(added.length && before.size){const key=added.at(-1),p=(people||[]).find(x=>String(personKey(x))===key);showGlobalNotice({kind:'💞',title:'Someone liked you',body:p?`${p.name} wants to connect.`:'You have a new incoming like.',key,action:'View',onClick:()=>showScreen('matches')});}
  }
  async function safetyRefresh(){
    if(!authUser||!supa||document.hidden||safetyRefreshInFlight)return;
    const now=Date.now();
    // visibilitychange + focus often fire together; coalesce them into one read.
    if(now-lastSafetyRefreshAt<10000)return;
    safetyRefreshInFlight=true;lastSafetyRefreshAt=now;
    try{
      if(typeof loadPeopleDirectory==='function') await loadPeopleDirectory({preserveIndex:true,quiet:true});
      await refreshLikes();
      if(activeChatKey && typeof loadChatMessages==='function'){await loadChatMessages(activeChatKey,true);renderChatMessages();renderChats();}
    }catch(err){console.warn('Realtime safety refresh failed',err);}
    finally{safetyRefreshInFlight=false;}
  }
  async function handleIncomingMessage(payload){
    const row=payload?.new||{}; if(!row.sender_id)return; const key=String(row.sender_id);
    try{
      if(typeof loadChatMessages==='function') await loadChatMessages(key,true);
      if(key===String(activeChatKey||'')){renderChatMessages();renderChats();return;}
      const person=(people||[]).find(p=>String(personKey(p))===key);
      const body=row.message_type==='photo'?'sent you a private photo':(row.message_type==='album_request'?'sent a private album update':String(row.body||'New message'));
      showGlobalNotice({kind:row.message_type==='photo'?'📷':'💬',title:person?.name||'New message',body,key,action:'Open'});
      renderChats();
    }catch(err){console.warn('Incoming realtime message refresh failed',err);}
  }
  function stopRealtimeNotifications(){
    if(fallbackTimer)clearInterval(fallbackTimer); fallbackTimer=null;
    if(realtimeChannel&&supa){try{supa.removeChannel(realtimeChannel);}catch{}} realtimeChannel=null; startedFor='';
  }
  async function runDailyMediaMaintenance(){
    if(!authUser||!supa||typeof cleanupExpiredMessages!=='function')return;
    const key=`afterglowMediaMaintenance:${authUser.id}`;
    let last=0;try{last=Date.parse(localStorage.getItem(key)||'')||0;}catch{}
    if(Date.now()-last<24*60*60*1000)return;
    try{await cleanupExpiredMessages();try{localStorage.setItem(key,new Date().toISOString());}catch{}}catch(err){console.warn('Daily media maintenance failed',err);}
  }
  function startRealtimeNotifications(){
    if(!authUser||!supa)return; const id=String(authUser.id); if(startedFor===id&&realtimeChannel)return; stopRealtimeNotifications(); startedFor=id; unreadByChat=readUnread(); ensureBadgeStyles(); updateBadges();
    try{
      realtimeChannel=supa.channel(`afterglow-inbox-${id}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'fv_messages',filter:`recipient_id=eq.${id}`},handleIncomingMessage)
        .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Afterglow realtime degraded; safety refresh remains active.');});
    }catch(err){console.warn('Realtime subscription unavailable',err);}
    safetyRefresh(); runDailyMediaMaintenance(); migrateLegacyEmbeddedAvatar(); fallbackTimer=setInterval(safetyRefresh,FALLBACK_REFRESH_MS);
  }
  if(typeof openApp==='function'&&!openApp.__afterglowRealtimeLifecycle){const base=openApp;openApp=function(){const r=base.apply(this,arguments);setTimeout(startRealtimeNotifications,250);return r;};openApp.__afterglowRealtimeLifecycle=true;}
  if(typeof signOut==='function'&&!signOut.__afterglowRealtimeLifecycle){const base=signOut;signOut=async function(){stopRealtimeNotifications();return base.apply(this,arguments);};signOut.__afterglowRealtimeLifecycle=true;}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)safetyRefresh();});
  window.addEventListener('focus',safetyRefresh);
  document.addEventListener('click',e=>{if(e.target.closest?.('.tab[data-screen="chat"]')){unreadByChat={};writeUnread();updateBadges();}});
  setTimeout(startRealtimeNotifications,1200);
})();


/* =========================================================
   Afterglow intimacy layer: moods, private albums, album
   access requests, and weekly Glow Coin goals.
   Additive only. Existing matching/chat/shop systems remain.
   ========================================================= */
(function(){
  const PRIVATE_ALBUM_BUCKET = 'fv-private-albums';
  const PRIVATE_ALBUM_TABLE = 'fv_private_album_photos';
  const ALBUM_REQUEST_TYPE = 'album_request';
  const WEEKLY_GOALS = [
    {id:'mood', icon:'💫', title:'Set your mood', desc:'Choose how you are feeling this week.', coins:10},
    {id:'private_photo', icon:'🔒', title:'Upload a private album photo', desc:'Add something only approved matches can unlock.', coins:25},
    {id:'vault3', icon:'🔐', title:'Answer 3 Vault prompts', desc:'Build better compatibility signals.', coins:15},
    {id:'message', icon:'💬', title:'Send a message', desc:'Keep a matched conversation warm.', coins:10}
  ];
  const MOODS = [
    {id:'flirty', label:'Flirty', emoji:'🔥'},
    {id:'romantic', label:'Romantic', emoji:'🌹'},
    {id:'curious', label:'Curious', emoji:'👀'},
    {id:'playful', label:'Playful', emoji:'😈'},
    {id:'cozy', label:'Cozy', emoji:'🫶'},
    {id:'private', label:'Private', emoji:'🔒'}
  ];
  let albumCache = {};
  let albumAccessCache = {};

  function $one(sel){ return document.querySelector(sel); }
  function $all(sel){ return [...document.querySelectorAll(sel)]; }
  function safe(v){ return (typeof escapeHtml==='function') ? escapeHtml(v) : String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function nowIso(){ return new Date().toISOString(); }
  function weekKey(){ return isoWeekKey(); }
  function rewardsObj(){ if(typeof ensureRewards==='function') return ensureRewards(); state.rewards=state.rewards||{glowCoins:0}; return state.rewards; }
  function ensureWeekly(){
    if(!state.weeklyGoals || state.weeklyGoals.week !== weekKey()) state.weeklyGoals={week:weekKey(), completed:{}};
    return state.weeklyGoals;
  }
  const weeklyGoalPending=new Set();
  async function awardWeeklyGoal(id){
    const wg=ensureWeekly();
    if(wg.completed[id] || weeklyGoalPending.has(id)) return false;
    const goal=WEEKLY_GOALS.find(g=>g.id===id);
    if(!goal) return false;
    weeklyGoalPending.add(id);
    try{
      if(supa && authUser){
        // Persist the action evidence before the server evaluates the claim.
        if(typeof syncToSupabase==='function') await syncToSupabase(false,`weekly_evidence_${id}`);
        const {data,error}=await supa.rpc('fv_claim_weekly_goal',{p_goal_id:id});
        if(error && !isMissingRpcError(error)) throw error;
        if(!error){
          const result=Array.isArray(data)?data[0]:data;
          applyEconomyPayload(result);
          wg.week=result?.week_key||wg.week;
          wg.completed[id]=nowIso();
          state.weeklyGoals=wg; state.profile.weeklyGoals=wg; state.profile.rewards=state.rewards;
          persistStateLocalOnly('weekly_goal');
          renderWeeklyGoals();
          if(result?.status==='claimed') showToast(`+${Number(result.coins||goal.coins)} Glow Coins: ${goal.title}`);
          return true;
        }
      }
      return false;
    }catch(err){ console.warn('Weekly goal claim failed',err); return false; }
    finally{ weeklyGoalPending.delete(id); }
  }

  function injectIntimacyUi(){
    const profile=$one('#profile');
    if(!profile || $one('#moodPanel')) return;
    const saveBtn=$one('#saveProfile');
    const block=document.createElement('div');
    block.className='intimacy-profile-panels';
    block.innerHTML=`
      <div class="profile-panel mood-panel" id="moodPanel">
        <div class="panel-heading"><div><b>Current mood</b><p>Let matches know the vibe you are open to right now.</p></div><span id="moodCurrentBadge">Unset</span></div>
        <div class="mood-grid" id="moodGrid"></div>
      </div>
      <div class="profile-panel private-album-manager" id="privateAlbumManager">
        <div class="panel-heading"><div><b>Private album</b><p>Upload photos that matched users can request access to. Photos stay blurred until you approve them.</p></div><span id="privateAlbumCount">0 photos</span></div>
        <label class="private-album-upload">🔒 Add private photos<input id="privateAlbumUpload" type="file" accept="image/*" multiple></label>
        <div id="privateAlbumOwnerGrid" class="private-album-owner-grid"></div>
      </div>
      <div class="profile-panel weekly-goals-panel" id="weeklyGoalsPanel">
        <div class="panel-heading"><div><b>Weekly Glow Goals</b><p>Earn Glow Coins by keeping your profile active and intimate.</p></div><span id="weeklyGoalsProgress">0/${WEEKLY_GOALS.length}</span></div>
        <div id="weeklyGoalsList" class="weekly-goals-list"></div>
      </div>`;
    if(saveBtn) profile.insertBefore(block, saveBtn); else profile.appendChild(block);
    renderMoodPicker();
    renderWeeklyGoals();
    bindPrivateAlbumUpload();
    refreshMyPrivateAlbum();
  }

  function renderMoodPicker(){
    const grid=$one('#moodGrid'); if(!grid) return;
    const current=state.profile?.mood || '';
    const mood=MOODS.find(m=>m.id===current);
    const badge=$one('#moodCurrentBadge'); if(badge) badge.textContent=mood?`${mood.emoji} ${mood.label}`:'Unset';
    grid.innerHTML=MOODS.map(m=>`<button type="button" class="mood-chip ${current===m.id?'selected':''}" data-mood="${m.id}"><span>${m.emoji}</span><b>${m.label}</b></button>`).join('');
    $all('.mood-chip').forEach(btn=>btn.onclick=()=>setMood(btn.dataset.mood));
  }
  function setMood(id){
    const mood=MOODS.find(m=>m.id===id); if(!mood) return;
    state.profile=state.profile||{};
    state.profile.mood=id;
    state.profile.moodLabel=`${mood.emoji} ${mood.label}`;
    renderMoodPicker();
    awardWeeklyGoal('mood');
    if(typeof save==='function') save();
    if(typeof syncToSupabase==='function') syncToSupabase(false);
  }
  function renderWeeklyGoals(){
    const list=$one('#weeklyGoalsList'); if(!list) return;
    const wg=ensureWeekly();
    const doneCount=WEEKLY_GOALS.filter(g=>wg.completed[g.id]).length;
    const progress=$one('#weeklyGoalsProgress'); if(progress) progress.textContent=`${doneCount}/${WEEKLY_GOALS.length}`;
    list.innerHTML=WEEKLY_GOALS.map(g=>{
      const done=!!wg.completed[g.id];
      return `<div class="weekly-goal ${done?'done':''}"><div class="goal-icon">${g.icon}</div><div><b>${safe(g.title)}</b><p>${safe(g.desc)}</p></div><span>${done?'✓':`+${g.coins} 🪙`}</span></div>`;
    }).join('');
  }

  async function bindPrivateAlbumUpload(){
    const input=$one('#privateAlbumUpload');
    if(!input || input.dataset.bound) return;
    input.dataset.bound='1';
    input.addEventListener('change',async()=>{
      if(input.files?.length) await uploadPrivateAlbumPhotos([...input.files]);
      input.value='';
    });
  }
  async function uploadPrivateAlbumPhotos(files){
    if(!authUser || !supa){ showToast('Sign in is required to upload private album photos.'); return; }
    let existingCount=0;
    try{
      const countResult=await supa.from(PRIVATE_ALBUM_TABLE).select('id',{count:'exact',head:true}).eq('owner_id',authUser.id);
      if(countResult.error) throw countResult.error;
      existingCount=Number(countResult.count||0);
    }catch(err){console.warn('Private album count failed',err);showToast('Could not verify private album capacity. Try again.');return;}
    const remaining=Math.max(0,24-existingCount);
    if(!remaining){showToast('Your private album is full. Remove a photo before adding another.');return;}
    const valid=files.filter(f=>f.type?.startsWith('image/')).slice(0,Math.min(12,remaining));
    if(!valid.length) return;
    if(files.length>valid.length) showToast(`Private albums hold up to 24 photos. Adding ${valid.length} now.`);
    const rows=[];
    let metadataSaved=false;
    try{
      for(const file of valid){
        if(file.size > 12*1024*1024){ showToast('One private photo was too large to prepare and was skipped.'); continue; }
        const prepared=await prepareImageUpload(file,{maxDimension:1600,maxBytes:950000,quality:.82});
        const path=`${authUser.id}/album/${crypto.randomUUID()}.${prepared.ext}`;
        const {error:upErr}=await supa.storage.from(PRIVATE_ALBUM_BUCKET).upload(path,prepared.blob,{cacheControl:'3600',upsert:false,contentType:prepared.contentType});
        if(upErr) throw upErr;
        rows.push({owner_id:authUser.id,path,caption:'',created_at:nowIso()});
      }
      if(rows.length){
        const {error}=await supa.from(PRIVATE_ALBUM_TABLE).insert(rows);
        if(error) throw error;
        metadataSaved=true;
        awardWeeklyGoal('private_photo');
        await refreshMyPrivateAlbum();
        if(typeof syncToSupabase==='function') syncToSupabase(false);
        showToast(`${rows.length} private album photo${rows.length>1?'s':''} added.`);
      }
    }catch(err){
      if(rows.length && !metadataSaved){ try{ await supa.storage.from(PRIVATE_ALBUM_BUCKET).remove(rows.map(x=>x.path)); }catch{} }
      console.warn('Private album upload failed',err); showToast('Private album upload failed. Uploaded files were rolled back.');
    }
  }
  async function refreshMyPrivateAlbum(){
    if(!authUser || !supa) return;
    try{
      const {data,error}=await supa.from(PRIVATE_ALBUM_TABLE).select('id,path,caption,created_at').eq('owner_id',authUser.id).order('created_at',{ascending:false}).limit(24);
      if(error) throw error;
      const rows=data||[];
      const paths=rows.map(row=>row.path).filter(Boolean);
      let signedMap={};
      if(paths.length){
        const batch=await supa.storage.from(PRIVATE_ALBUM_BUCKET).createSignedUrls(paths,3600);
        if(batch.error) throw batch.error;
        (batch.data||[]).forEach((entry,i)=>{ const path=entry?.path||paths[i]; if(path) signedMap[path]=entry?.signedUrl||entry?.signedURL||''; });
      }
      const signed=rows.map(row=>({...row,signedUrl:signedMap[row.path]||''}));
      albumCache[authUser.id]=signed;
      state.profile=state.profile||{};
      state.profile.privateAlbumCount=signed.length;
      renderOwnerPrivateAlbum(signed);
      if(typeof save==='function') save();
    }catch(err){ console.warn('Could not load private album',err); }
  }
  function renderOwnerPrivateAlbum(items){
    const count=$one('#privateAlbumCount'); if(count) count.textContent=`${items.length} photo${items.length===1?'':'s'}`;
    const grid=$one('#privateAlbumOwnerGrid'); if(!grid) return;
    grid.innerHTML=items.length ? items.map(x=>{const url=safeImageUrl(x.signedUrl,{allowData:false});return url?`<div class="owner-private-photo"><img src="${url}" alt="Private album photo"><button type="button" class="danger delete-private-photo" data-id="${safe(x.id)}" data-path="${safe(x.path)}">Remove</button></div>`:'';}).join('') : '<div class="profile-empty-mini">No private photos yet. Add a few to give matches something to request.</div>';
    $all('.delete-private-photo').forEach(btn=>btn.onclick=()=>deletePrivateAlbumPhoto(btn.dataset.id,btn.dataset.path));
  }
  async function deletePrivateAlbumPhoto(id,path){
    if(!authUser || !supa || !id) return;
    try{
      // Remove the object first. If metadata deletion later fails, the row is
      // recoverable/repairable; deleting metadata first could orphan paid bytes.
      if(path){const storageDelete=await supa.storage.from(PRIVATE_ALBUM_BUCKET).remove([path]);if(storageDelete.error)throw storageDelete.error;}
      const metadataDelete=await supa.from(PRIVATE_ALBUM_TABLE).delete().eq('id',id).eq('owner_id',authUser.id);
      if(metadataDelete.error) throw metadataDelete.error;
      await refreshMyPrivateAlbum();
      showToast('Private photo removed.');
    }catch(err){ console.warn(err); showToast('Could not remove private photo.'); }
  }
  // Album signed URLs are batched inside fetchAlbumItems().
  async function fetchAlbumItems(ownerId, allowSigned=false){
    if(!supa || !authUser || !ownerId) return [];
    try{
      if(!allowSigned && ownerId!==authUser.id){
        const preview=await supa.rpc('fv_private_album_preview_count',{p_owner_id:ownerId});
        if(!preview.error){ return Array.from({length:Number(preview.data||0)},(_,i)=>({id:`locked-${i}`,locked:true})); }
        if(!isMissingRpcError(preview.error)) throw preview.error;
      }
      const {data,error}=await supa.from(PRIVATE_ALBUM_TABLE).select('id,path,caption,created_at').eq('owner_id',ownerId).order('created_at',{ascending:false}).limit(24);
      if(error) throw error;
      if(!allowSigned) return data||[];
      const rows=data||[], paths=rows.map(r=>r.path).filter(Boolean);
      if(!paths.length) return rows;
      const batch=await supa.storage.from(PRIVATE_ALBUM_BUCKET).createSignedUrls(paths,3600);
      if(batch.error) throw batch.error;
      const signedMap={};
      (batch.data||[]).forEach((entry,i)=>{ const path=entry?.path||paths[i]; if(path) signedMap[path]=entry?.signedUrl||entry?.signedURL||''; });
      return rows.map(r=>({...r,signedUrl:signedMap[r.path]||''}));
    }catch(err){ console.warn('album fetch failed',err); return []; }
  }
  async function hasAlbumAccess(ownerId){
    if(!supa || !authUser || !ownerId) return false;
    if(ownerId===authUser.id) return true;
    const cacheKey=`${ownerId}|${authUser.id}`;
    if(albumAccessCache[cacheKey] !== undefined) return albumAccessCache[cacheKey];
    try{
      const access=await supa.from('fv_album_access').select('status').eq('owner_id',ownerId).eq('requester_id',authUser.id).maybeSingle();
      if(!access.error){ const ok=access.data?.status==='accepted'; albumAccessCache[cacheKey]=ok; return ok; }
      throw access.error;
    }catch(err){ console.warn('album access check failed',err); return false; }
  }
  async function requestAlbumAccess(ownerId){
    if(!authUser || !supa || !ownerId) return;
    if(ownerId===authUser.id) return showToast('This is your private album.');
    const p=people.find(x=>String(personKey(x))===String(ownerId));
    if(p && !isMutual(p)) return showToast('Private album requests unlock after a match.');
    try{
      const grant=await supa.rpc('fv_request_album_access',{p_owner_id:ownerId});
      if(grant.error) throw grant.error;
      albumAccessCache[`${ownerId}|${authUser.id}`]=false;
      if(typeof loadChatMessages==='function') await loadChatMessages(ownerId,true);
      if(typeof renderChats==='function') renderChats();
      showToast('Private album request sent.');
    }catch(err){ console.warn('request failed',err); showToast('Could not send the private album request right now.'); }
  }
  async function respondAlbumRequest(messageId, ownerId, requesterId, status){
    if(!authUser || !supa || authUser.id!==ownerId) return showToast('Only the album owner can respond.');
    try{
      const grant=await supa.rpc('fv_respond_album_access',{p_requester_id:requesterId,p_status:status});
      if(grant.error) throw grant.error;
      albumAccessCache[`${ownerId}|${requesterId}`]=status==='accepted';
      if(activeChatKey===String(requesterId)){ await loadChatMessages(activeChatKey,true); renderChatMessages(); }
      if(typeof renderChats==='function') renderChats();
      showToast(status==='accepted'?'Album access approved.':'Album access denied.');
    }catch(err){ console.warn('album response failed',err); showToast('Could not update the album request right now.'); }
  }
  function albumRequestHtml(m){
    const req=(m.media||[]).find(x=>x.kind==='album_request') || {};
    const status=['accepted','denied'].includes(req.status)?req.status:'pending';
    const iAmOwner=authUser?.id && req.owner_id===authUser.id;
    const iAmRequester=authUser?.id && req.requester_id===authUser.id;
    let actions='';
    if(iAmOwner && status==='pending'){
      actions=`<div class="album-request-actions"><button class="primary album-accept" data-mid="${m.id}" data-owner="${safe(req.owner_id)}" data-requester="${safe(req.requester_id)}">Accept</button><button class="ghost album-deny" data-mid="${m.id}" data-owner="${safe(req.owner_id)}" data-requester="${safe(req.requester_id)}">Deny</button></div>`;
    } else if(iAmRequester && status==='accepted'){
      actions=`<button class="primary album-open-from-chat" data-owner="${safe(req.owner_id)}">View album</button>`;
    }
    const label=status==='accepted'?'Approved':status==='denied'?'Denied':'Pending';
    return `<div class="album-request-card"><div><b>🔒 Private album request</b><p>${iAmOwner?'They requested access to your private album.':'You requested access to their private album.'}</p><span class="request-status ${status}">${label}</span></div>${actions}</div>`;
  }

  function renderMediaOrSpecial(m){
    if(m.type===ALBUM_REQUEST_TYPE) return albumRequestHtml(m);
    if(m.type==='photo' && typeof mediaHtml==='function') return mediaHtml(m);
    return '';
  }

  // Override chat renderer so album-request messages can render accept/deny buttons.
  const oldRenderChatMessages = window.renderChatMessages || (typeof renderChatMessages==='function' ? renderChatMessages : null);
  renderChatMessages = function(){
    if(!activeChatKey) return;
    const box=$one('#chatMessages'); if(!box) return;
    const p=people.find(x=>String(personKey(x))===String(activeChatKey));
    const msgs=getCachedChat(activeChatKey);
    const starter=p?.mutual?.[0] && !p.mutual[0].startsWith('Vault overlap') ? `You matched with ${p.name}. Shared signal: ${p.mutual[0]}.` : `You matched with ${p?.name || 'this person'}.`;
    const signature=`${activeChatKey}|${starter}|${typeof stableChatSignature==='function'?stableChatSignature(msgs):JSON.stringify(msgs)}`;
    if(box.dataset.renderSignature===signature) return;
    const wasNearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<90;
    box.dataset.renderSignature=signature;
    box.innerHTML=`<div class="chat-bubble system">${safe(starter)}</div>`+msgs.map(m=>`<div class="chat-bubble ${m.from==='me'?'mine':'theirs'} ${['photo',ALBUM_REQUEST_TYPE].includes(m.type)?'photo-message':''}">${renderMediaOrSpecial(m)}${m.text && m.type!==ALBUM_REQUEST_TYPE?`<div>${safe(m.text)}</div>`:''}<span>${new Date(m.at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})} • expires ${typeof timeUntil==='function'?timeUntil(m.expiresAt):'soon'}</span></div>`).join('');
    $all('.album-accept').forEach(btn=>btn.onclick=()=>respondAlbumRequest(btn.dataset.mid,btn.dataset.owner,btn.dataset.requester,'accepted'));
    $all('.album-deny').forEach(btn=>btn.onclick=()=>respondAlbumRequest(btn.dataset.mid,btn.dataset.owner,btn.dataset.requester,'denied'));
    $all('.album-open-from-chat').forEach(btn=>btn.onclick=()=>openAlbumViewer(btn.dataset.owner));
    if(wasNearBottom || !box.dataset.userScrolled) box.scrollTop=box.scrollHeight;
  };

  // Award weekly goals from existing interactions without changing behavior.
  if(typeof sendChatMessage==='function' && !sendChatMessage.__weeklyWrapped){
    const baseSend=sendChatMessage;
    sendChatMessage=async function(){ const before=JSON.stringify(getCachedChat(activeChatKey||'')); const r=await baseSend.apply(this,arguments); const after=JSON.stringify(getCachedChat(activeChatKey||'')); if(before!==after) awardWeeklyGoal('message'); return r; };
    sendChatMessage.__weeklyWrapped=true;
  }
  if(typeof renderVault==='function' && !renderVault.__weeklyWrapped){
    const baseRenderVault=renderVault;
    renderVault=function(){ const r=baseRenderVault.apply(this,arguments); const count=Object.values(state.ratings||{}).filter(Boolean).length; if(count>=3) awardWeeklyGoal('vault3'); return r; };
    renderVault.__weeklyWrapped=true;
  }
  // Later Vault renderers can preserve weekly-goal behavior without reaching
  // into this closure directly.
  window.afterglowAwardWeeklyGoal=awardWeeklyGoal;

  // Enhance member profile with mood and private album panel.
  const baseOpenMemberProfile = (typeof openMemberProfile==='function') ? openMemberProfile : null;
  if(baseOpenMemberProfile && !openMemberProfile.__albumWrapped){
    openMemberProfile=function(key){
      const r=baseOpenMemberProfile.apply(this,arguments);
      setTimeout(()=>enhanceMemberProfileAlbum(key),80);
      return r;
    };
    openMemberProfile.__albumWrapped=true;
  }
  async function enhanceMemberProfileAlbum(key){
    const body=$one('#memberProfileBody');
    const p=people.find(x=>String(personKey(x))===String(key));
    if(!body || !p || $one('#memberPrivateAlbumSection')) return;
    const mood=p.profile?.moodLabel || moodLabelFromId(p.profile?.mood);
    if(mood){
      const hero=body.querySelector('.hero-meta-row');
      if(hero && !hero.querySelector('.mood-meta')) hero.insertAdjacentHTML('afterbegin',`<span class="mood-meta">${safe(mood)}</span>`);
    }
    const ownerId=personKey(p);
    const hasAccess=await hasAlbumAccess(ownerId);
    const items=await fetchAlbumItems(ownerId, hasAccess);
    const section=document.createElement('div');
    section.id='memberPrivateAlbumSection';
    section.className='profile-section-card private-member-album';
    if(!items.length){
      section.innerHTML=`<div class="section-heading"><h3>🔒 Private album</h3><span>Matched access</span></div><div class="profile-empty-mini">No private album photos have been added yet.</div>`;
    }else if(hasAccess){
      section.innerHTML=`<div class="section-heading"><h3>🔓 Private album</h3><span>${items.length} unlocked</span></div><div class="member-private-grid unlocked">${items.map(i=>{const url=safeImageUrl(i.signedUrl,{allowData:false});return url?`<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="Private album photo"></a>`:'';}).join('')}</div>`;
    }else{
      section.innerHTML=`<div class="section-heading"><h3>🔒 Private album</h3><span>${items.length} blurred preview${items.length===1?'':'s'}</span></div><div class="member-private-grid blurred">${items.slice(0,6).map(()=>`<div class="blurred-private-tile"><span>🔒</span></div>`).join('')}</div><button class="primary full request-private-album" data-owner="${safe(ownerId)}">Request access</button><p class="tiny-note">Requests are sent in your message thread. They can accept or deny.</p>`;
    }
    body.appendChild(section);
    $one('.request-private-album')?.addEventListener('click',e=>requestAlbumAccess(e.currentTarget.dataset.owner));
  }
  function moodLabelFromId(id){ const m=MOODS.find(x=>x.id===id); return m?`${m.emoji} ${m.label}`:''; }
  async function openAlbumViewer(ownerId){
    const p=people.find(x=>String(personKey(x))===String(ownerId));
    if(!await hasAlbumAccess(ownerId)) return showToast('Album access is not approved yet.');
    const items=await fetchAlbumItems(ownerId,true);
    let modal=$one('#albumViewer');
    if(!modal){ modal=document.createElement('div'); modal.id='albumViewer'; modal.className='member-profile-modal hidden'; modal.innerHTML=`<div class="album-viewer-sheet glass"><div class="member-profile-top"><button class="ghost-mini round" id="closeAlbumViewer">←</button><b>Private Album</b><span></span></div><div id="albumViewerGrid" class="album-viewer-grid"></div></div>`; $one('.phone')?.appendChild(modal); $one('#closeAlbumViewer').onclick=()=>modal.classList.add('hidden'); }
    $one('#albumViewerGrid').innerHTML=items.length?items.map(i=>{const url=safeImageUrl(i.signedUrl,{allowData:false});return url?`<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="Private album photo"></a>`:'';}).join(''):'<div class="empty-state"><h3>No photos available</h3></div>';
    modal.classList.remove('hidden');
  }

  // Keep UI current when app loads/profile refreshes.
  if(typeof hydrateProfileForm==='function' && !hydrateProfileForm.__intimacyWrapped){
    const baseHydrate=hydrateProfileForm;
    hydrateProfileForm=function(){ const r=baseHydrate.apply(this,arguments); setTimeout(()=>{injectIntimacyUi(); renderMoodPicker(); renderWeeklyGoals(); refreshMyPrivateAlbum();},50); return r; };
    hydrateProfileForm.__intimacyWrapped=true;
  }
  if(typeof openApp==='function' && !openApp.__intimacyWrapped){
    const baseOpen=openApp;
    openApp=function(){ const r=baseOpen.apply(this,arguments); setTimeout(()=>{injectIntimacyUi(); renderMoodPicker(); renderWeeklyGoals(); refreshMyPrivateAlbum();},250); return r; };
    openApp.__intimacyWrapped=true;
  }
  document.addEventListener('click',e=>{
    const tab=e.target.closest?.('.tab[data-screen="profile"]');
    if(tab) setTimeout(()=>{injectIntimacyUi(); renderMoodPicker(); renderWeeklyGoals(); refreshMyPrivateAlbum();},80);
  });
  setTimeout(()=>{injectIntimacyUi(); renderMoodPicker(); renderWeeklyGoals(); if(authUser) refreshMyPrivateAlbum();},1200);
})();

/* =========================================================
   Afterglow patch: profile effects + richer profile showcase
   Additive only. Existing shop, chat, albums, moods and admin remain intact.
   ========================================================= */
(function afterglowProfileEffectsPatch(){
  const EFFECT_ITEMS = [
    {id:'fx-avatar-sparkle',cat:'Effects',icon:'✨',title:'Sparkle Aura',desc:'Adds soft drifting sparkles around your profile avatar.',price:45,type:'avatarEffect',value:'fx-sparkle',featured:true},
    {id:'fx-avatar-pulse',cat:'Effects',icon:'💓',title:'Heartbeat Glow',desc:'A subtle pulsing glow for your avatar and profile photo.',price:50,type:'avatarEffect',value:'fx-heartbeat'},
    {id:'fx-avatar-embers',cat:'Effects',icon:'🔥',title:'Afterglow Embers',desc:'Warm ember flecks and a sensual glow around your profile.',price:65,type:'avatarEffect',value:'fx-embers'},
    {id:'fx-profile-stars',cat:'Effects',icon:'🌌',title:'Midnight Stars Profile',desc:'Adds a soft animated star field to your profile banner area.',price:70,type:'profileEffect',value:'fx-stars'},
    {id:'fx-profile-hearts',cat:'Effects',icon:'💞',title:'Floating Hearts Profile',desc:'A playful romantic profile effect for matched profile views.',price:70,type:'profileEffect',value:'fx-hearts'}
  ];
  const EQUIPPABLE_TYPES = ['avatarFrame','profileTheme','avatarEffect','profileEffect'];
  const esc = (v)=> (typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])));

  function seedEffectItems(){
    if(!Array.isArray(SHOP_ITEMS)) return;
    EFFECT_ITEMS.forEach(item=>{ if(!SHOP_ITEMS.some(x=>x.id===item.id)) SHOP_ITEMS.push(item); });
  }
  seedEffectItems();

  function inv(){
    if(typeof ensureEconomy === 'function') return ensureEconomy().inventory;
    state.inventory = state.inventory || {owned:[], equipped:{}};
    state.inventory.owned = Array.isArray(state.inventory.owned) ? state.inventory.owned : [];
    state.inventory.equipped = state.inventory.equipped || {};
    state.profile = state.profile || {};
    state.profile.inventory = state.inventory;
    return state.inventory;
  }
  function itemBy(id){ return Array.isArray(SHOP_ITEMS) ? SHOP_ITEMS.find(i=>i.id===id) : null; }
  function ownedItems(){ const owned = new Set(inv().owned || []); return (SHOP_ITEMS||[]).filter(i=>owned.has(i.id)); }
  function effectItemForValue(type, value){ return (SHOP_ITEMS||[]).find(i=>i.type===type && i.value===value); }
  function isEquippable(item){ return item && EQUIPPABLE_TYPES.includes(item.type); }

  if(typeof categoryEmojiForShop === 'function' && !categoryEmojiForShop.__effectsWrapped){
    const baseCategoryEmojiForShop = categoryEmojiForShop;
    categoryEmojiForShop = function(cat){ return cat === 'Effects' ? '✨' : baseCategoryEmojiForShop(cat); };
    categoryEmojiForShop.__effectsWrapped = true;
  }

  if(typeof shopButtonHtml === 'function' && !shopButtonHtml.__effectsWrapped){
    shopButtonHtml = function(item){
      if(typeof isShopOwned === 'function' && isShopOwned(item.id)){
        if(isEquippable(item)) return `<button class="shop-action equip" data-equip-item="${esc(item.id)}">${typeof isShopEquipped === 'function' && isShopEquipped(item) ? 'Equipped' : 'Equip'}</button>`;
        if(['chatPack','stickerPack'].includes(item.type)) return `<button class="shop-action equip" data-use-chat-unlock="${esc(item.id)}">Available</button>`;
        return '<button class="shop-action" disabled>Unlocked</button>';
      }
      const bal = (typeof ensureRewards === 'function' ? ensureRewards().glowCoins : state?.rewards?.glowCoins) || 0;
      return `<button class="shop-action" data-buy-item="${esc(item.id)}" ${bal < item.price ? 'disabled' : ''}>Unlock</button>`;
    };
    shopButtonHtml.__effectsWrapped = true;
  }

  if(typeof isShopEquipped === 'function' && !isShopEquipped.__effectsWrapped){
    const baseIsShopEquipped = isShopEquipped;
    isShopEquipped = function(item){
      if(isEquippable(item)) return inv().equipped?.[item.type] === item.value;
      return baseIsShopEquipped(item);
    };
    isShopEquipped.__effectsWrapped = true;
  }

  if(typeof equipShopItem === 'function' && !equipShopItem.__effectsWrapped){
    const baseEquipShopItem = equipShopItem;
    equipShopItem = async function(id){
      const item = itemBy(id);
      if(item && isEquippable(item)){
        return baseEquipShopItem(id);
      }
      return baseEquipShopItem(id);
    };
    equipShopItem.__effectsWrapped = true;
  }

  if(typeof unlockTypeTitle === 'function' && !unlockTypeTitle.__effectsWrapped){
    const baseUnlockTypeTitle = unlockTypeTitle;
    unlockTypeTitle = function(type){
      if(type==='avatarEffect') return 'Avatar Effects';
      if(type==='profileEffect') return 'Profile Effects';
      return baseUnlockTypeTitle(type);
    };
    unlockTypeTitle.__effectsWrapped = true;
  }
  if(typeof unlockTypeEmoji === 'function' && !unlockTypeEmoji.__effectsWrapped){
    const baseUnlockTypeEmoji = unlockTypeEmoji;
    unlockTypeEmoji = function(type){
      if(type==='avatarEffect') return '✨';
      if(type==='profileEffect') return '🌌';
      return baseUnlockTypeEmoji(type);
    };
    unlockTypeEmoji.__effectsWrapped = true;
  }
  if(typeof unlockButtonLabel === 'function' && !unlockButtonLabel.__effectsWrapped){
    const baseUnlockButtonLabel = unlockButtonLabel;
    unlockButtonLabel = function(item){
      if(isEquippable(item)) return (typeof isShopEquipped === 'function' && isShopEquipped(item)) ? 'Equipped' : 'Equip';
      return baseUnlockButtonLabel(item);
    };
    unlockButtonLabel.__effectsWrapped = true;
  }

  function cleanEffectClasses(el){
    if(!el) return;
    el.classList.remove('fx-sparkle','fx-heartbeat','fx-embers','fx-stars','fx-hearts');
  }
  function applyProfileEffectsToNodes(){
    const inventory = inv();
    const avatarFx = inventory.equipped?.avatarEffect || '';
    const profileFx = inventory.equipped?.profileEffect || '';
    document.body.classList.remove('fx-profile-stars-active','fx-profile-hearts-active');
    if(profileFx === 'fx-stars') document.body.classList.add('fx-profile-stars-active');
    if(profileFx === 'fx-hearts') document.body.classList.add('fx-profile-hearts-active');
    document.querySelectorAll('.profile-avatar,#topProfileAvatar,#bottomProfileAvatar,.member-avatar-large').forEach(el=>{ cleanEffectClasses(el); if(avatarFx) el.classList.add(avatarFx); });
    document.querySelectorAll('.profile-hero,.member-hero').forEach(el=>{ el.classList.remove('fx-stars','fx-hearts'); if(profileFx) el.classList.add(profileFx); });
  }

  if(typeof applyCosmetics === 'function' && !applyCosmetics.__effectsWrapped){
    const baseApplyCosmetics = applyCosmetics;
    applyCosmetics = function(){
      const r = baseApplyCosmetics.apply(this, arguments);
      applyProfileEffectsToNodes();
      return r;
    };
    applyCosmetics.__effectsWrapped = true;
  }

  if(typeof renderShop === 'function' && !renderShop.__effectsWrapped){
    const baseRenderShop = renderShop;
    renderShop = function(){
      seedEffectItems();
      const r = baseRenderShop.apply(this, arguments);
      renderProfileStylePanel();
      return r;
    };
    renderShop.__effectsWrapped = true;
  }

  function styleSummaryHtml(){
    const inventory = inv();
    const equipped = inventory.equipped || {};
    const rows = [
      ['Profile frame', effectItemForValue('avatarFrame', equipped.avatarFrame)],
      ['Banner theme', effectItemForValue('profileTheme', equipped.profileTheme)],
      ['Avatar effect', effectItemForValue('avatarEffect', equipped.avatarEffect)],
      ['Profile effect', effectItemForValue('profileEffect', equipped.profileEffect)]
    ];
    return rows.map(([label,item])=>`<div class="style-summary-row"><span>${esc(label)}</span><b>${item ? `${item.icon} ${esc(item.title)}` : 'Default'}</b></div>`).join('');
  }

  function renderProfileStylePanel(){
    const profileScreen = document.querySelector('#profile');
    if(!profileScreen) return;
    let panel = document.querySelector('#profileStyleShowcase');
    if(!panel){
      panel = document.createElement('div');
      panel.id = 'profileStyleShowcase';
      panel.className = 'profile-style-showcase profile-panel';
      const livePreview = profileScreen.querySelector('#viewLiveProfile');
      const hero = profileScreen.querySelector('.profile-hero');
      if(livePreview) livePreview.insertAdjacentElement('afterend', panel);
      else if(hero) hero.insertAdjacentElement('afterend', panel);
      else profileScreen.prepend(panel);
    }
    const owned = ownedItems();
    const badges = owned.filter(i=>i.type==='badge').slice(0,4);
    panel.innerHTML = `<div class="style-showcase-head"><div><b>✨ Profile Style</b><p>Customize how your profile appears to other members.</p></div><button class="ghost-mini" type="button" data-go-shop-effects>Shop</button></div><div class="style-summary-grid">${styleSummaryHtml()}</div>${badges.length?`<div class="profile-badge-row">${badges.map(b=>`<span>${b.icon} ${esc(b.title)}</span>`).join('')}</div>`:'<div class="profile-badge-row muted"><span>Unlock badges in the Glow Shop</span></div>'}`;
    panel.querySelector('[data-go-shop-effects]')?.addEventListener('click',()=>{ if(typeof showScreen==='function') showScreen('shop'); activeShopCategory='Effects'; if(typeof renderShop==='function') renderShop(); });
  }

  function memberStyleShowcaseHtml(p){
    const profileInv = p?.profile?.inventory || {};
    const equipped = profileInv.equipped || {};
    const owned = Array.isArray(profileInv.owned) ? profileInv.owned : [];
    const badges = (SHOP_ITEMS||[]).filter(i=>i.type==='badge' && owned.includes(i.id)).slice(0,4);
    const avatarFx = effectItemForValue('avatarEffect', equipped.avatarEffect);
    const profileFx = effectItemForValue('profileEffect', equipped.profileEffect);
    const theme = effectItemForValue('profileTheme', equipped.profileTheme);
    const items = [avatarFx, profileFx, theme].filter(Boolean);
    if(!items.length && !badges.length) return '';
    return `<div class="profile-section-card member-style-card"><div class="section-heading"><h3>✨ Profile showcase</h3><span>Unlocked style</span></div><div class="member-style-pills">${items.map(i=>`<span>${i.icon} ${esc(i.title)}</span>`).join('')}${badges.map(b=>`<span>${b.icon} ${esc(b.title)}</span>`).join('')}</div></div>`;
  }

  function moveAlbumAndAddShowcase(key){
    const body = document.querySelector('#memberProfileBody');
    if(!body) return;
    const p = (typeof people !== 'undefined' ? people : []).find(x=>String(personKey(x))===String(key));
    const about = body.querySelector('.about-card');
    const album = body.querySelector('#memberPrivateAlbumSection');
    if(album && about && album.previousElementSibling !== about){
      about.insertAdjacentElement('afterend', album);
    }
    if(p && !body.querySelector('#memberStyleShowcase')){
      const html = memberStyleShowcaseHtml(p);
      if(html){
        const target = album || about || body.querySelector('.profile-score-grid');
        if(target) target.insertAdjacentHTML('afterend', html.replace('member-style-card','member-style-card" id="memberStyleShowcase'));
      }
    }
    applyMemberProfileEffects(p);
  }

  function applyMemberProfileEffects(p){
    if(!p) return;
    const equipped = p?.profile?.inventory?.equipped || {};
    const avatar = document.querySelector('#memberProfileBody .member-avatar-large');
    const hero = document.querySelector('#memberProfileBody .member-hero');
    if(avatar){ cleanEffectClasses(avatar); if(equipped.avatarEffect) avatar.classList.add(equipped.avatarEffect); }
    if(hero){ hero.classList.remove('fx-stars','fx-hearts'); if(equipped.profileEffect) hero.classList.add(equipped.profileEffect); }
  }

  if(typeof openMemberProfile === 'function' && !openMemberProfile.__effectsWrapped){
    const baseOpenMemberProfile = openMemberProfile;
    openMemberProfile = function(key){
      const r = baseOpenMemberProfile.apply(this, arguments);
      [90,250,700].forEach(ms=>setTimeout(()=>moveAlbumAndAddShowcase(key), ms));
      return r;
    };
    openMemberProfile.__effectsWrapped = true;
  }

  // Keep album section directly under the about/interests card even when the private album loader finishes later.
  const observer = new MutationObserver(()=>{
    const modal = document.querySelector('#memberProfileModal:not(.hidden)');
    if(modal?.dataset?.key) moveAlbumAndAddShowcase(modal.dataset.key);
  });
  setTimeout(()=>{ const body=document.querySelector('#memberProfileBody'); if(body) observer.observe(body,{childList:true,subtree:true}); }, 500);

  // Hydrate on load/open without disrupting existing behavior.
  setTimeout(()=>{ seedEffectItems(); if(typeof renderShop==='function') renderShop(); renderProfileStylePanel(); if(typeof applyCosmetics==='function') applyCosmetics(); }, 900);
})();


/* =========================================================
   Afterglow patch: stronger visual effects + gated color system
   Additive only. Keeps all existing unlocks/features intact.
   ========================================================= */
(function afterglowIntenseEffectsAndColorGate(){
  const esc = (v)=> (typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])));
  const COLOR_ITEMS = [
    {id:'tool-color-picker',cat:'Colors',icon:'🎨',title:'Full Color Picker',desc:'Unlock full custom color control for compatible avatar rings and banner glows.',price:1000,type:'colorTool',value:'color-picker',featured:true},
    {id:'color-afterglow-pink',cat:'Colors',icon:'💗',title:'Afterglow Pink',desc:'Unlocks a hot pink and violet glow colorway for compatible profile effects.',price:80,type:'colorway',value:'afterglow-pink',colors:{a:'#ff3f91',b:'#8b5cff'}},
    {id:'color-golden-hour',cat:'Colors',icon:'🌅',title:'Golden Hour',desc:'Unlocks a warm gold and rose glow colorway.',price:90,type:'colorway',value:'golden-hour',colors:{a:'#ffd37a',b:'#ff6b73'}},
    {id:'color-midnight-blue',cat:'Colors',icon:'🌌',title:'Midnight Blue',desc:'Unlocks a cool blue and violet glow colorway.',price:90,type:'colorway',value:'midnight-blue',colors:{a:'#57c8ff',b:'#7c5cff'}},
    {id:'color-emerald-lust',cat:'Colors',icon:'💚',title:'Emerald Glow',desc:'Unlocks an emerald and aqua glow colorway.',price:90,type:'colorway',value:'emerald-glow',colors:{a:'#65ffb8',b:'#57c8ff'}},
    {id:'color-red-velvet',cat:'Colors',icon:'❤️‍🔥',title:'Red Velvet',desc:'Unlocks a deep red and magenta glow colorway.',price:110,type:'colorway',value:'red-velvet',colors:{a:'#ff3b4f',b:'#b1125b'}}
  ];
  function seedColorItems(){
    if(!Array.isArray(SHOP_ITEMS)) return;
    COLOR_ITEMS.forEach(item=>{ if(!SHOP_ITEMS.some(x=>x.id===item.id)) SHOP_ITEMS.push(item); });
  }
  function inventory(){
    if(typeof ensureEconomy === 'function') return ensureEconomy().inventory;
    state.inventory = state.inventory || {owned:[], equipped:{}};
    state.inventory.owned = Array.isArray(state.inventory.owned) ? state.inventory.owned : [];
    state.inventory.equipped = state.inventory.equipped || {};
    state.profile = state.profile || {};
    state.profile.inventory = state.inventory;
    return state.inventory;
  }
  function ownedSet(){ return new Set(inventory().owned || []); }
  function itemById(id){ return (Array.isArray(SHOP_ITEMS) ? SHOP_ITEMS : []).find(i=>i.id===id); }
  function colorItemByValue(value){ return (Array.isArray(SHOP_ITEMS) ? SHOP_ITEMS : []).find(i=>i.type==='colorway' && i.value===value); }
  function ownsColorPicker(){ return ownedSet().has('tool-color-picker'); }
  function equippedColorway(){ return colorItemByValue(inventory().equipped?.colorway); }
  function chosenColors(){
    const inv=inventory();
    const colorway=equippedColorway();
    if(colorway?.colors) return colorway.colors;
    if(ownsColorPicker() && inv.custom) return {a:inv.custom.a || '#ff3f91', b:inv.custom.b || '#8b5cff'};
    return {a:'#ff3f91', b:'#8b5cff'};
  }
  function hasActiveColorControl(){ return ownsColorPicker() || !!equippedColorway(); }
  seedColorItems();

  if(typeof categoryEmojiForShop === 'function' && !categoryEmojiForShop.__colorGateWrapped){
    const base = categoryEmojiForShop;
    categoryEmojiForShop = function(cat){ return cat === 'Colors' ? '🎨' : base(cat); };
    categoryEmojiForShop.__colorGateWrapped = true;
  }
  if(typeof isShopEquipped === 'function' && !isShopEquipped.__colorGateWrapped){
    const base = isShopEquipped;
    isShopEquipped = function(item){
      if(item?.type === 'colorway') return inventory().equipped?.colorway === item.value;
      return base(item);
    };
    isShopEquipped.__colorGateWrapped = true;
  }
  if(typeof shopButtonHtml === 'function' && !shopButtonHtml.__colorGateWrapped){
    const base = shopButtonHtml;
    shopButtonHtml = function(item){
      if(item?.type === 'colorway' && typeof isShopOwned === 'function' && isShopOwned(item.id)){
        return `<button class="shop-action equip" data-equip-item="${esc(item.id)}">${isShopEquipped(item)?'Equipped':'Equip'}</button>`;
      }
      if(item?.type === 'colorTool' && typeof isShopOwned === 'function' && isShopOwned(item.id)){
        return '<button class="shop-action" disabled>Unlocked</button>';
      }
      return base(item);
    };
    shopButtonHtml.__colorGateWrapped = true;
  }
  if(typeof equipShopItem === 'function' && !equipShopItem.__colorGateWrapped){
    const base = equipShopItem;
    equipShopItem = async function(id){
      const item=itemById(id);
      if(item?.type === 'colorway'){
        await base(id);
        if(ownedSet().has(item.id)){
          const inv=inventory();
          inv.custom = {...(inv.custom||{}), ...(item.colors||{})};
          state.profile.inventory = inv;
          if(typeof save === 'function') save('colorway_customization');
          if(typeof applyCosmetics === 'function') applyCosmetics();
          if(typeof renderShop === 'function') renderShop();
        }
        return;
      }
      return base(id);
    };
    equipShopItem.__colorGateWrapped = true;
  }
  if(typeof buyShopItem === 'function' && !buyShopItem.__colorGateWrapped){
    const base = buyShopItem;
    buyShopItem = async function(id){
      await base(id);
      const item=itemById(id);
      if(item?.type === 'colorway' && ownedSet().has(item.id)) await equipShopItem(id);
      if(item?.type === 'colorTool'){
        const inv=inventory();
        inv.custom = inv.custom || chosenColors();
        state.profile.inventory = inv;
        if(typeof save === 'function') save();
        if(typeof showToast === 'function') showToast('Full Color Picker unlocked. Open My Unlocks to customize.');
      }
      if(typeof renderMyUnlocks === 'function') renderMyUnlocks();
    };
    buyShopItem.__colorGateWrapped = true;
  }
  if(typeof unlockTypeTitle === 'function' && !unlockTypeTitle.__colorGateWrapped){
    const base = unlockTypeTitle;
    unlockTypeTitle = function(type){
      if(type==='colorway') return 'Glow Colors';
      if(type==='colorTool') return 'Color Tools';
      return base(type);
    };
    unlockTypeTitle.__colorGateWrapped = true;
  }
  if(typeof unlockTypeEmoji === 'function' && !unlockTypeEmoji.__colorGateWrapped){
    const base = unlockTypeEmoji;
    unlockTypeEmoji = function(type){
      if(type==='colorway') return '🎨';
      if(type==='colorTool') return '🖌️';
      return base(type);
    };
    unlockTypeEmoji.__colorGateWrapped = true;
  }
  if(typeof unlockButtonLabel === 'function' && !unlockButtonLabel.__colorGateWrapped){
    const base = unlockButtonLabel;
    unlockButtonLabel = function(item){
      if(item?.type==='colorway') return isShopEquipped(item) ? 'Equipped' : 'Equip';
      if(item?.type==='colorTool') return 'Unlocked';
      return base(item);
    };
    unlockButtonLabel.__colorGateWrapped = true;
  }
  if(typeof applyCosmetics === 'function' && !applyCosmetics.__colorGateWrapped){
    const base = applyCosmetics;
    applyCosmetics = function(){
      const r=base.apply(this, arguments);
      const colors=chosenColors();
      document.body.style.setProperty('--ag-custom-a', colors.a);
      document.body.style.setProperty('--ag-custom-b', colors.b);
      document.body.classList.toggle('customized-unlocks', hasActiveColorControl());
      document.body.classList.toggle('ag-color-picker-unlocked', ownsColorPicker());
      document.body.classList.toggle('ag-colorway-active', !!equippedColorway());
      document.querySelectorAll('.profile-banner').forEach(el=>el.classList.toggle('custom-banner', hasActiveColorControl() && !!inventory().equipped?.profileTheme));
      return r;
    };
    applyCosmetics.__colorGateWrapped = true;
  }
  function bindColorPickerInputs(panel){
    const a=panel.querySelector('#unlockColorA');
    const b=panel.querySelector('#unlockColorB');
    if(!a || !b) return;
    const saveColor = ()=>{
      const inv=inventory();
      inv.custom = {a:a.value, b:b.value};
      delete inv.equipped.colorway;
      state.profile.inventory = inv;
      if(typeof applyCosmetics === 'function') applyCosmetics();
      if(typeof save === 'function') save();
      if(typeof syncToSupabase === 'function') syncToSupabase(false);
    };
    a.oninput=saveColor;
    b.oninput=saveColor;
  }
  if(typeof renderMyUnlocks === 'function' && !renderMyUnlocks.__colorGateWrapped){
    const base=renderMyUnlocks;
    renderMyUnlocks = function(){
      base();
      const panel=document.querySelector('#myUnlocksPanel');
      if(!panel) return;
      const owned=ownedSet();
      const pickerOwned=ownsColorPicker();
      const customizer=panel.querySelector('.customizer-card');
      if(customizer && !pickerOwned){
        const availableColors=(SHOP_ITEMS||[]).filter(i=>i.type==='colorway' && owned.has(i.id));
        customizer.outerHTML = `<div class="customizer-card locked-customizer"><h4>🔒 Full Color Picker</h4><p class="tiny-note">Unlock the Full Color Picker in the shop for 1000 Glow Coins to choose any custom colors. Until then, equip colorways you redeem from the Colors shop.</p>${availableColors.length?`<div class="colorway-grid">${availableColors.map(c=>`<button type="button" class="colorway-chip ${isShopEquipped(c)?'equipped':''}" data-equip-colorway="${esc(c.id)}"><span style="background:linear-gradient(135deg,${esc(c.colors.a)},${esc(c.colors.b)})"></span>${esc(c.title)}</button>`).join('')}</div>`:`<button type="button" class="shop-action" data-go-color-shop>Open Colors Shop</button>`}</div>`;
      } else if(customizer && pickerOwned){
        customizer.classList.add('unlocked-customizer');
        customizer.querySelector('h4').textContent='🎨 Full Color Picker';
        const note=customizer.querySelector('.tiny-note');
        if(note) note.textContent='Unlocked. Choose any glow colors for compatible avatar rings, profile effects, and banner glows.';
        bindColorPickerInputs(panel);
      }
      panel.querySelectorAll('[data-equip-colorway]').forEach(btn=>btn.onclick=()=>equipShopItem(btn.dataset.equipColorway));
      panel.querySelector('[data-go-color-shop]')?.addEventListener('click',()=>{ if(typeof showScreen==='function') showScreen('shop'); activeShopCategory='Colors'; if(typeof renderShop==='function') renderShop(); });
    };
    renderMyUnlocks.__colorGateWrapped = true;
  }
  if(typeof renderShop === 'function' && !renderShop.__colorGateWrapped){
    const base=renderShop;
    renderShop = function(){ seedColorItems(); const r=base.apply(this, arguments); if(typeof renderMyUnlocks==='function') renderMyUnlocks(); return r; };
    renderShop.__colorGateWrapped = true;
  }
  if(typeof styleSummaryHtml === 'function'){
    // local in prior patch when present; kept intentionally untouched.
  }
  setTimeout(()=>{ try{ seedColorItems(); if(typeof applyCosmetics==='function') applyCosmetics(); if(typeof renderShop==='function') renderShop(); if(typeof renderMyUnlocks==='function') renderMyUnlocks(); }catch(e){ console.warn('Color gate init skipped', e); } }, 1000);
})();

/* =========================================================
   Afterglow production data-safety console
   Local recovery snapshots, export/import, cloud revisions,
   offline retry, and owner health checks.
   ========================================================= */
(function afterglowProductionSafetyConsole(){
  const escSafe=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function backups(){ try{return JSON.parse(localStorage.getItem(backupStorageKey())||'[]');}catch{return [];} }
  function safetySummary(){
    const m=stateMetrics(state); const last=state.meta?.lastSyncedAt ? new Date(state.meta.lastSyncedAt).toLocaleString() : 'Not synced yet';
    const walletReview=state.meta?.walletRecovery?.status;
    const recoveryText=walletReview && !['not_needed','approved'].includes(walletReview) ? ` • Wallet recovery: ${walletReview.replaceAll('_',' ')}` : '';
    return `${m.ratings} Vault answers • ${state.inventory?.owned?.length||0} unlocks • ${backups().length} local recovery copies • Last cloud sync: ${last}${recoveryText}`;
  }
  function renderSafetyStatus(){ const el=document.querySelector('#afterglowSafetyStatus'); if(el) el.textContent=safetySummary(); }
  function downloadJson(name,value){
    const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  function exportProtectedBackup(){
    snapshotLocalState(state,'manual_export',true);
    downloadJson(`afterglow-backup-${todayKey()}.json`,{format:'afterglow-backup-v2',exportedAt:new Date().toISOString(),userId:authUser?.id||state.userId,state:normalizeState(state,authUser),localSnapshots:backups()});
    showToast('Afterglow backup downloaded.'); renderSafetyStatus();
  }
  async function importProtectedBackup(file){
    if(!file) return;
    try{
      const parsed=JSON.parse(await file.text()); const incoming=parsed?.state||parsed;
      if(!incoming || typeof incoming!=='object') throw new Error('Invalid backup');
      snapshotLocalState(state,'before_manual_import',true);
      state=mergeDurableStates(state,incoming,authUser); state.updatedAt=new Date().toISOString();
      persistStateLocalOnly('manual_import');
      hydrateProfileForm(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); renderStack(); updateAvatar();
      await syncToSupabase(true,'manual_import'); renderSafetyStatus();
    }catch(err){console.warn(err);showToast('That file is not a valid Afterglow backup.');}
  }
  async function restoreLatestLocal(){
    const latest=backups()[0]; if(!latest?.state) return showToast('No local recovery snapshot is available yet.');
    snapshotLocalState(state,'before_local_restore',true);
    state=mergeDurableStates(state,latest.state,authUser); state.updatedAt=new Date().toISOString();
    persistStateLocalOnly('local_restore'); hydrateProfileForm(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); renderStack(); updateAvatar();
    await syncToSupabase(true,'local_restore'); renderSafetyStatus();
    showToast(`Recovered data from ${new Date(latest.createdAt).toLocaleString()}.`);
  }
  async function renderCloudRevisions(){
    const box=document.querySelector('#afterglowCloudRevisions'); if(!box) return;
    if(!supa||!authUser){box.innerHTML='<p class="tiny-note">Sign in to view cloud recovery points.</p>';return;}
    box.innerHTML='<p class="tiny-note">Loading protected cloud revisions…</p>';
    try{
      const {data,error}=await supa.from('fv_profile_revisions').select('id,revision,reason,created_at,ratings,inventory').order('created_at',{ascending:false}).limit(12);
      if(error){ if(isMissingRpcError(error)||error.code==='42P01'){box.innerHTML='<p class="tiny-note">Cloud recovery is temporarily unavailable.</p>';return;} throw error; }
      box.innerHTML=(data||[]).map(r=>`<div class="safety-revision"><div><b>${new Date(r.created_at).toLocaleString()}</b><span>Revision ${Number(r.revision||0)} • ${Object.keys(r.ratings||{}).length} answers • ${(r.inventory?.owned||[]).length} unlocks</span><small>${escSafe(r.reason||'sync')}</small></div><button type="button" class="ghost-mini" data-restore-revision="${escSafe(r.id)}">Restore</button></div>`).join('')||'<p class="tiny-note">No cloud recovery points are available yet.</p>';
      box.querySelectorAll('[data-restore-revision]').forEach(btn=>btn.onclick=()=>restoreCloudRevision(btn.dataset.restoreRevision));
    }catch(err){console.warn(err);box.innerHTML='<p class="tiny-note">Cloud revisions could not be loaded.</p>';}
  }
  async function restoreCloudRevision(id){
    if(!supa||!authUser||!id) return;
    try{
      snapshotLocalState(state,'before_cloud_revision_restore',true);
      const {data,error}=await supa.rpc('fv_restore_my_revision',{p_revision_id:id}); if(error) throw error;
      const result=Array.isArray(data)?data[0]:data;
      if(result?.row){
        const restored=remoteRowToState(result.row,authUser); restored.rewards=state.rewards;
        state=normalizeState(restored,authUser); await loadServerEconomy(); persistStateLocalOnly('cloud_revision_restore');
        hydrateProfileForm(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); renderStack(); updateAvatar();
        showToast('Cloud revision restored. Your wallet was left unchanged.'); renderSafetyStatus(); renderCloudRevisions();
      }
    }catch(err){console.warn(err);showToast('Cloud restore failed. No local recovery copy was removed.');}
  }
  async function loadOwnerHealth(){
    const out=document.querySelector('#afterglowHealthOutput'); if(!out||!isAdmin()||!supa) return;
    out.textContent='Checking…';
    try{const {data,error}=await supa.rpc('fv_admin_health_summary');if(error)throw error;out.textContent=`${data.profiles||0} profiles • ${data.profiles_with_answers||0} with answers • ${data.wallets||0} wallets • ${data.pending_wallet_recoveries||0} wallet reviews • ${data.revision_backups||0} cloud backups • ${data.private_album_photos||0} private photos`;}
    catch(err){console.warn(err);out.textContent='Data health summary is temporarily unavailable.';}
  }
  async function downloadOwnerServerBackup(){
    if(!isAdmin()||!supa) return showToast('Admin access is required.');
    const out=document.querySelector('#afterglowHealthOutput'); if(out) out.textContent='Preparing server backup…';
    try{
      const {data,error}=await supa.rpc('fv_admin_export_backup'); if(error) throw error;
      downloadJson(`afterglow-server-backup-${todayKey()}.json`,data);
      if(out) out.textContent='Server backup downloaded. Storage photo bytes require a separate provider backup.';
      showToast('Protected server backup downloaded.');
    }catch(err){console.warn(err);if(out)out.textContent='Server backup is temporarily unavailable.';}
  }
  function injectSafetyPanel(){
    const profile=document.querySelector('#profile'); if(!profile||document.querySelector('#afterglowDataSafety')) return;
    const panel=document.createElement('div'); panel.id='afterglowDataSafety'; panel.className='profile-panel afterglow-data-safety';
    panel.innerHTML=`<div class="panel-heading"><div><b>🛡️ Data Safety</b><p>Your answers save locally first, merge safely after downtime, and keep recovery copies.</p></div><span class="safety-live-dot">Protected</span></div><p id="afterglowSafetyStatus" class="tiny-note"></p><p class="tiny-note">Sync status: <b id="afterglowSyncLive">${escSafe(state.meta?.syncStatus||'checking…')}</b></p><div class="safety-actions"><button type="button" class="primary" id="afterglowExportBackup">Download Backup</button><label class="ghost safety-import">Import Backup<input type="file" id="afterglowImportBackup" accept="application/json,.json"></label><button type="button" class="ghost" id="afterglowRestoreLocal">Restore Latest Local Copy</button><button type="button" class="ghost" id="afterglowSyncNow">Sync Now</button><button type="button" class="ghost" id="afterglowRefreshRevisions">Recovery History</button></div><div id="afterglowCloudRevisions" class="safety-revisions hidden"></div>`;
    const saveBtn=document.querySelector('#saveProfile'); if(saveBtn) profile.insertBefore(panel,saveBtn); else profile.appendChild(panel);
    document.querySelector('#afterglowExportBackup').onclick=exportProtectedBackup;
    document.querySelector('#afterglowImportBackup').onchange=e=>{importProtectedBackup(e.target.files?.[0]);e.target.value='';};
    document.querySelector('#afterglowRestoreLocal').onclick=restoreLatestLocal;
    document.querySelector('#afterglowSyncNow').onclick=()=>syncToSupabase(true,'manual_sync');
    document.querySelector('#afterglowRefreshRevisions').onclick=()=>{const box=document.querySelector('#afterglowCloudRevisions');box.classList.toggle('hidden');if(!box.classList.contains('hidden'))renderCloudRevisions();};
    renderSafetyStatus();
  }
  window.AfterglowDataSafety={exportBackup:exportProtectedBackup,restoreLatestLocal,renderCloudRevisions,snapshot:()=>snapshotLocalState(state,'manual_snapshot',true)};
  window.addEventListener('online',()=>{setSync('connection restored — syncing');syncToSupabase(false,'online_reconnect');});
  window.addEventListener('offline',()=>setSync('offline-safe local save'));
  window.addEventListener('pagehide',()=>snapshotLocalState(state,'page_exit',false));
  window.addEventListener('afterglow:state-saved',renderSafetyStatus);
  window.addEventListener('afterglow:wallet-recovery-updated',renderSafetyStatus);
  const baseOpen=typeof openApp==='function'?openApp:null;
  if(baseOpen){openApp=function(){const r=baseOpen.apply(this,arguments);setTimeout(injectSafetyPanel,80);return r;};}
  const baseHydrate=typeof hydrateProfileForm==='function'?hydrateProfileForm:null;
  if(baseHydrate){hydrateProfileForm=function(){const r=baseHydrate.apply(this,arguments);setTimeout(injectSafetyPanel,50);return r;};}
  setTimeout(injectSafetyPanel,1300);
})();

/* ============================================================
   Afterglow distribution UI v3
   Production-facing discovery, live profile preview, device
   location, Afterglow+ entitlement, daily reward clarity, and
   owner-only data operations. This patch intentionally layers on
   top of the hardened persistence/economy code above.
   ============================================================ */
(()=>{
  'use strict';

  const DIST_FILTER_KEY='afterglowDiscoveryFiltersV1';
  const PREMIUM_COST=2300;
  const PREMIUM_DAYS=30;
  const FREE_DISTANCE_MILES=50;
  const DEFAULT_FILTERS={showMe:'Everyone',distance:50,chemistry:70};
  let distFilters=loadDistributionFilters();

  function numberOrNull(value){
    const n=Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function clamp(value,min,max){ return Math.max(min,Math.min(max,Number(value)||0)); }
  function parseDistanceOption(value){
    const match=String(value||'').match(/\d+/);
    return match ? Number(match[0]) : DEFAULT_FILTERS.distance;
  }
  function parseChemistryOption(value){
    const match=String(value||'').match(/\d+/);
    return match ? Number(match[0]) : 0;
  }
  function loadDistributionFilters(){
    try{
      const raw=JSON.parse(localStorage.getItem(DIST_FILTER_KEY)||'null');
      return {...DEFAULT_FILTERS,...(raw&&typeof raw==='object'?raw:{})};
    }catch{return {...DEFAULT_FILTERS};}
  }
  function saveDistributionFilters(){
    try{localStorage.setItem(DIST_FILTER_KEY,JSON.stringify(distFilters));}catch{}
  }
  function premiumIsActive(){
    const p=state?.meta?.premium||{};
    if(!p.active) return false;
    const until=Date.parse(p.premium_until||p.premiumUntil||'');
    return !Number.isFinite(until) || until>Date.now();
  }
  function premiumUntilText(){
    const raw=state?.meta?.premium?.premium_until||state?.meta?.premium?.premiumUntil||'';
    const d=new Date(raw);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  }

  // Preserve premium information returned by the server-authoritative economy RPC.
  const distBaseApplyEconomyPayload=typeof applyEconomyPayload==='function'?applyEconomyPayload:null;
  if(distBaseApplyEconomyPayload){
    applyEconomyPayload=function(payload,options){
      const result=distBaseApplyEconomyPayload.apply(this,arguments);
      const economy=payload?.economy||payload||{};
      if(economy?.premium && typeof economy.premium==='object'){
        state.meta={...(state.meta||{}),premium:{...economy.premium}};
        if(options?.persist!==false) persistStateLocalOnly('premium_status');
      }
      setTimeout(()=>{renderPremiumPassCard();renderStack();},0);
      return result;
    };
  }

  function renderPremiumPassCard(){
    const mount=document.querySelector('#premiumPassMount');
    if(!mount) return;
    const active=premiumIsActive();
    const until=premiumUntilText();
    mount.innerHTML=`<article class="premium-pass-card ${active?'premium-active':''}">
      <div class="premium-pass-icon">✦</div>
      <div class="premium-pass-copy">
        <span class="premium-kicker">Afterglow+</span>
        <h3>${active?'Your Plus pass is active':'30-Day Afterglow+ Pass'}</h3>
        <p>${active
          ? `Explore beyond ${FREE_DISTANCE_MILES} miles, display your Plus badge, and keep premium discovery active${until?` through ${escapeHtml(until)}`:''}.`
          : `Unlock profiles beyond ${FREE_DISTANCE_MILES} miles for 30 days and add an Afterglow+ badge to your profile.`}</p>
        <div class="premium-meta"><span>30 days</span><span>${active?'Active':'🪙 2,300 Glow Coins'}</span></div>
      </div>
      <button id="buyPremiumPass" class="${active?'ghost':'primary'} premium-pass-action" type="button" ${active?'disabled':''}>${active?'Active':'Unlock for 2,300'}</button>
    </article>`;
    const btn=mount.querySelector('#buyPremiumPass');
    if(btn&&!active) btn.onclick=purchasePremiumPass;
  }

  async function purchasePremiumPass(){
    if(!supa||!authUser) return showToast('Sign in to unlock Afterglow+.');
    const current=Number(ensureRewards()?.glowCoins||0);
    if(current<PREMIUM_COST) return showToast(`You need ${PREMIUM_COST-current} more Glow Coins for Afterglow+.`);
    const btn=document.querySelector('#buyPremiumPass');
    if(btn){btn.disabled=true;btn.textContent='Unlocking…';}
    try{
      const pendingKeyName=`afterglowPremiumPurchaseKey:${authUser.id}`;
      let purchaseKey='';
      try{purchaseKey=localStorage.getItem(pendingKeyName)||'';}catch{}
      if(!purchaseKey){purchaseKey=crypto.randomUUID();try{localStorage.setItem(pendingKeyName,purchaseKey);}catch{}}
      const {data,error}=await supa.rpc('fv_purchase_premium_30d',{p_purchase_key:purchaseKey});
      if(error) throw error;
      const result=Array.isArray(data)?data[0]:data;
      if(result?.economy) applyEconomyPayload(result.economy);
      else applyEconomyPayload(result);
      if(result?.status==='insufficient'){
        showToast(`You need ${Number(result.needed||0)} more Glow Coins.`);
      }else{
        try{localStorage.removeItem(pendingKeyName);}catch{}
        showToast(`Afterglow+ unlocked for ${PREMIUM_DAYS} days.`);
        await loadServerEconomy().catch(()=>{});
        await loadPeopleDirectory({preserveIndex:true,quiet:true}).catch(()=>{});
        renderPremiumPassCard();
        renderStack();
      }
    }catch(err){
      console.warn('Afterglow+ purchase failed',err);
      showToast('Afterglow+ is temporarily unavailable. No Glow Coins were removed.');
    }finally{
      const next=document.querySelector('#buyPremiumPass');
      if(next&&!premiumIsActive()){next.disabled=false;next.textContent='Unlock for 2,300';}
    }
  }

  const distBaseRenderShop=typeof renderShop==='function'?renderShop:null;
  if(distBaseRenderShop){
    renderShop=function(){
      const result=distBaseRenderShop.apply(this,arguments);
      renderPremiumPassCard();
      return result;
    };
  }

  // Server directory rows contain only approximate whole-mile distance. Exact
  // coordinates never reach another member's browser.
  const distBaseProfileRowToPerson=typeof profileRowToPerson==='function'?profileRowToPerson:null;
  if(distBaseProfileRowToPerson){
    profileRowToPerson=function(row){
      const p=distBaseProfileRowToPerson.apply(this,arguments);
      const profile=row?.profile||{};
      const miles=numberOrNull(profile.distanceMiles);
      const city=String(profile.city||profile.area||'').trim();
      p.distance=miles===null?999999:miles;
      p.distanceMiles=miles;
      p.distanceLabel=miles===null
        ? (city?`📍 ${city}`:'Distance unavailable')
        : `${miles<1?'<1':Math.round(miles)} mi away${city?` • ${city}`:''}`;
      p.premium=!!profile.premiumActive;
      const relationship=(profile.relationship&&typeof profile.relationship==='object')?profile.relationship:{};
      p.serverILike=relationship.iLike===true;
      p.serverLikesMe=relationship.likesMe===true;
      p.serverMutual=relationship.mutual===true;
      if(p.serverLikesMe) p.likesMe=true;
      return p;
    };
  }

  function genderPassesFilter(person){
    const wanted=String(distFilters.showMe||'Everyone');
    if(wanted==='Everyone') return true;
    const sex=String(person?.profile?.sex||'').toLowerCase();
    if(!sex) return false;
    if(wanted==='Women') return sex.includes('woman') || sex==='female';
    if(wanted==='Men') return (sex==='man'||sex.includes('trans man')||sex==='male') && !sex.includes('woman');
    if(wanted==='Non-binary people') return sex.includes('non-binary')||sex.includes('nonbinary')||sex.includes('gender fluid');
    return true;
  }
  function distancePassesFilter(person){
    const miles=numberOrNull(person?.distanceMiles);
    if(miles===null) return true;
    const requested=Number(distFilters.distance||FREE_DISTANCE_MILES);
    // Free members receive the nearby experience up to 50 miles. Plus members
    // can deliberately expand discovery to the 100-mile filter.
    const allowed=premiumIsActive()?requested:Math.min(requested,FREE_DISTANCE_MILES);
    return miles<=allowed;
  }
  function chemistryPassesFilter(person){
    const min=Number(distFilters.chemistry||0);
    return min<=0 || Number(person?.score||0)>=min;
  }
  function personIsPremiumDistanceLocked(person){
    // Established connections and incoming likes are relationship-scoped, not
    // discovery-scoped. Distance can never make an existing connection vanish.
    if(isMutual(person) || person?.serverLikesMe===true || person?.likesMe) return false;
    if(premiumIsActive()) return false;
    if(person?.profile?.premiumLocked===true) return true;
    const miles=numberOrNull(person?.distanceMiles);
    return miles!==null && miles>FREE_DISTANCE_MILES;
  }

  const distBaseOrderedPeople=typeof orderedPeople==='function'?orderedPeople:null;
  if(distBaseOrderedPeople){
    orderedPeople=function(){
      const fresh=distBaseOrderedPeople.apply(this,arguments);
      // Discovery normally hides profiles once they have been liked/matched.
      // For Afterglow's Explorer grid we deliberately keep established matches
      // visible at the front, regardless of distance or current filter radius.
      // This makes the Explorer a durable people view rather than a disposable
      // swipe queue and prevents long-distance matches from disappearing.
      const matches=(people||[]).filter(p=>isMutual(p));
      const seen=new Set();
      const merged=[...matches,...fresh].filter(p=>{
        const key=String(personKey(p));
        if(!key||seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return merged.filter(p=>{
        if(isMutual(p)) return true;
        if(!genderPassesFilter(p)||!chemistryPassesFilter(p)) return false;
        const miles=numberOrNull(p?.distanceMiles);
        if(miles===null) return true;
        const requested=Number(distFilters.distance||FREE_DISTANCE_MILES);
        return miles<=requested;
      });
    };
  }

  function syncFilterControls(){
    const show=document.querySelector('#filterShowMe');
    const dist=document.querySelector('#filterDistance');
    const chem=document.querySelector('#filterChemistry');
    if(show) show.value=distFilters.showMe||'Everyone';
    if(dist){
      const desired=`${Number(distFilters.distance||FREE_DISTANCE_MILES)} miles`;
      if([...dist.options].some(o=>o.value===desired||o.textContent===desired)) dist.value=desired;
    }
    if(chem){
      const desired=Number(distFilters.chemistry||0)===0?'Any':`${Number(distFilters.chemistry)}%+`;
      if([...chem.options].some(o=>o.value===desired||o.textContent===desired)) chem.value=desired;
    }
  }
  function applyDistributionFilters(){
    const show=document.querySelector('#filterShowMe');
    const dist=document.querySelector('#filterDistance');
    const chem=document.querySelector('#filterChemistry');
    distFilters={
      showMe:show?.value||'Everyone',
      distance:parseDistanceOption(dist?.value),
      chemistry:parseChemistryOption(chem?.value)
    };
    saveDistributionFilters();
    index=0;
    renderStack();
    document.querySelector('#filters')?.classList.add('hidden');
  }

  function discoveryTileHtml(p){
    const key=personKey(p);
    const avatar=safeImageUrl(p?.avatarUrl);
    const fallback=Array.isArray(p?.gradient)?p.gradient:['#8a3ffc','#ff4fa3'];
    const bg=avatar
      ? `background-image:linear-gradient(180deg,transparent 42%,rgba(6,4,11,.90) 100%),url(&quot;${escapeHtml(avatar)}&quot;)`
      : `background-image:linear-gradient(145deg,${fallback[0]},${fallback[1]})`;
    const age=p?.age?`, ${escapeHtml(p.age)}`:'';
    const score=clamp(p?.score,0,100);
    const matched=isMutual(p);
    const locked=personIsPremiumDistanceLocked(p);
    const distance=escapeHtml(p?.distanceLabel||'Distance unavailable');
    return `<button class="discovery-tile ${locked?'distance-locked':''} ${matched?'is-match':''}" type="button" data-profile-key="${escapeHtml(key)}" aria-label="View ${escapeHtml(p?.name||'profile')}">
      <span class="discovery-photo" style="${bg};background-size:cover;background-position:center">
        ${avatar?'':`<span class="discovery-initial">${escapeHtml(p?.initial||'M')}</span>`}
        <span class="discovery-top-badges">${matched?'<em class="match-mini">♥ MATCHED</em>':''}${p?.premium?'<em class="plus-mini">PLUS</em>':''}${p?.email?'<em class="verified-mini">✓</em>':''}</span>
        ${locked?'<span class="distance-lock"><b>🔒</b><small>Afterglow+</small></span>':''}
        <span class="discovery-bottom">
          <strong>${escapeHtml(p?.name||'Member')}${age}</strong>
          <small>${distance}</small>
          <em>${matched?'Matched • ':''}${score}% chemistry</em>
        </span>
      </span>
    </button>`;
  }

  renderStack=function(){
    const mount=document.querySelector('#cardStack');
    if(!mount) return;
    const arr=orderedPeople();
    if(!arr.length){
      mount.innerHTML=`<div class="empty-state discovery-empty"><h3>No profiles match these filters</h3><p>Try a wider distance or a lower chemistry minimum.</p><button id="emptyAdjustFilters" class="primary" type="button">Adjust filters</button></div>`;
      mount.querySelector('#emptyAdjustFilters')?.addEventListener('click',()=>{syncFilterControls();document.querySelector('#filters')?.classList.remove('hidden');});
      return;
    }
    mount.innerHTML=arr.map(discoveryTileHtml).join('');
    mount.querySelectorAll('[data-profile-key]').forEach(tile=>tile.onclick=()=>{
      const p=people.find(x=>personKey(x)===String(tile.dataset.profileKey));
      if(p&&personIsPremiumDistanceLocked(p)){
        showToast(`Afterglow+ unlocks profiles beyond ${FREE_DISTANCE_MILES} miles.`);
        showScreen('shop');
        setTimeout(()=>document.querySelector('#premiumPassMount')?.scrollIntoView({behavior:'smooth',block:'center'}),100);
        return;
      }
      openBrowseProfile(tile.dataset.profileKey,false);
    });
  };

  function ensureBrowseProfileModal(){
    let modal=document.querySelector('#browseProfileModal');
    if(modal) return modal;
    modal=document.createElement('section');
    modal.id='browseProfileModal';
    modal.className='browse-profile-modal hidden';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML=`<div class="browse-profile-shell">
      <div class="browse-profile-nav"><button id="browseProfileBack" class="browse-back" type="button">← Back</button><span class="browse-wordmark">Afterglow</span></div>
      <div id="browseProfileBody" class="browse-profile-body"></div>
    </div>`;
    document.querySelector('.phone')?.appendChild(modal);
    modal.querySelector('#browseProfileBack').onclick=closeBrowseProfile;
    return modal;
  }
  function closeBrowseProfile(){
    const modal=document.querySelector('#browseProfileModal');
    if(!modal) return;
    modal.classList.add('hidden');
    modal.removeAttribute('data-key');
    modal.removeAttribute('data-self');
  }
  function selfAsPerson(){
    const profile=state.profile||{};
    const name=(profile.displayName||authUser?.user_metadata?.full_name||authUser?.email?.split('@')[0]||'Your profile').trim();
    const initial=(name[0]||'Y').toUpperCase();
    return {
      id:authUser?.id||state.userId||'self',name,initial,age:profile.age||'',avatarUrl:profile.avatarUrl||'',
      gradient:deterministicGradient(authUser?.id||name),score:100,vibe:profile.headline||profile.bio||'',
      profile,ratings:state.ratings||{},email:authUser?.email||'',distanceLabel:profile.city?`📍 ${profile.city}`:'',premium:premiumIsActive(),self:true
    };
  }
  function profileInterestChips(profile){
    const raw=String(profile?.interests||'').split(',').map(x=>x.trim()).filter(Boolean);
    const items=[profile?.sex,profile?.lookingFor,...raw].filter(Boolean).slice(0,10);
    return items.length?items.map(x=>`<span>${escapeHtml(x)}</span>`).join(''):'<span>Still building this profile</span>';
  }
  function selfVaultHtml(person){
    const count=Object.keys(person?.ratings||{}).length;
    if(!count) return '';
    return topVaultHtml(person);
  }
  function browseStyleSummaryHtml(p){
    const equipped=p?.profile?.inventory?.equipped||{};
    const types=[['avatarFrame','Profile frame'],['profileTheme','Banner theme'],['avatarEffect','Avatar effect'],['profileEffect','Profile effect']];
    const rows=types.map(([type,label])=>{
      const value=equipped[type];
      if(!value) return null;
      const item=(typeof SHOP_ITEMS!=='undefined'?SHOP_ITEMS:[]).find(x=>x.type===type&&x.value===value);
      return item?`<span>${item.icon} ${escapeHtml(item.title)}</span>`:`<span>${escapeHtml(label)}</span>`;
    }).filter(Boolean);
    return rows.length?`<article class="browse-card browse-style-card"><h3>✨ Profile style</h3><div class="browse-chips">${rows.join('')}</div></article>`:'';
  }
  function renderBrowseActions(p,isSelf){
    if(isSelf) return '';
    const key=personKey(p);
    const liked=iLike(p);
    const mutual=isMutual(p);
    if(mutual){
      return `<div class="browse-actions browse-actions-matched">
        <div class="browse-match-status" aria-label="You are matched">♥<span>Matched</span></div>
        <button class="browse-message" type="button" data-browse-message="${escapeHtml(key)}">💬<span>Message</span></button>
      </div>`;
    }
    return `<div class="browse-actions">
      <button class="browse-pass" type="button" data-browse-pass="${escapeHtml(key)}">✕<span>Pass</span></button>
      <button class="browse-like ${liked?'selected':''}" type="button" data-browse-like="${escapeHtml(key)}">♥<span>${liked?'Liked':'Like'}</span></button>
    </div>`;
  }
  function renderBrowseProfileBody(p,isSelf=false){
    const body=document.querySelector('#browseProfileBody');
    if(!body) return;
    const avatar=safeImageUrl(p?.avatarUrl);
    const fallback=Array.isArray(p?.gradient)?p.gradient:['#7c5cff','#ff4fa3'];
    const hero=avatar
      ? `background-image:linear-gradient(180deg,rgba(4,3,8,.06),rgba(4,3,8,.90)),url(&quot;${escapeHtml(avatar)}&quot;)`
      : `background-image:radial-gradient(circle at 25% 20%,${fallback[0]},transparent 38%),linear-gradient(135deg,${fallback[1]},#100817 72%)`;
    const profile=p?.profile||{};
    const vault=isSelf?selfVaultHtml(p):topVaultHtml(p);
    const equipped=profile?.inventory?.equipped||{};
    const heroClasses=['browse-hero','member-hero',equipped.profileEffect||'',equipped.profileTheme||''].filter(Boolean).join(' ');
    const avatarClasses=['browse-profile-avatar','member-avatar-large',equipped.avatarFrame||'',equipped.avatarEffect||''].filter(Boolean).join(' ');
    const avatarChipStyle=avatar?`background-image:url(&quot;${escapeHtml(avatar)}&quot;);background-size:cover;background-position:center`:`background:linear-gradient(135deg,${fallback[0]},${fallback[1]})`;
    body.innerHTML=`
      <div class="${escapeHtml(heroClasses)}" style="${hero};background-size:cover;background-position:center">
        ${avatar?'':`<div class="browse-hero-initial">${escapeHtml(p?.initial||'M')}</div>`}
        <div class="${escapeHtml(avatarClasses)}" style="${avatarChipStyle}">${avatar?'':escapeHtml(p?.initial||'M')}</div>
        <div class="browse-hero-copy">
          <div class="browse-name-line"><h2>${escapeHtml(p?.name||'Member')}${p?.age?`, ${escapeHtml(p.age)}`:''}</h2>${p?.email?'<span class="browse-verified">✓ Verified</span>':''}${p?.premium?'<span class="browse-plus">Afterglow+</span>':''}</div>
          ${p?.distanceLabel?`<p>${escapeHtml(p.distanceLabel)}</p>`:''}
          ${p?.vibe?`<strong>${escapeHtml(p.vibe)}</strong>`:''}
        </div>
      </div>
      ${renderBrowseActions(p,isSelf)}
      <article class="browse-card"><h3>About</h3><p>${escapeHtml(profile.bio||profile.headline||(isSelf?'Add a bio from Edit Profile.':'No bio added yet.'))}</p><div class="browse-chips">${profileInterestChips(profile)}</div></article>
      ${browseStyleSummaryHtml(p)}
      ${vault?`<article class="browse-card"><div class="browse-card-title"><h3>Vault highlights</h3>${!isSelf?`<span>${clamp(p?.score,0,100)}% chemistry</span>`:''}</div><div class="interest-grid browse-vault-grid">${vault}</div></article>`:''}
      ${isSelf?'<p class="browse-preview-note">This is how your public profile appears to other members. Exact device coordinates, wallet details, and private account data are never shown here.</p>':''}
    `;
    body.querySelector('[data-browse-pass]')?.addEventListener('click',e=>browsePass(e.currentTarget.dataset.browsePass));
    body.querySelector('[data-browse-like]')?.addEventListener('click',e=>browseLike(e.currentTarget.dataset.browseLike));
    body.querySelector('[data-browse-message]')?.addEventListener('click',e=>{const key=e.currentTarget.dataset.browseMessage;closeBrowseProfile();openChat(key);});
  }
  function openBrowseProfile(key,isSelf=false){
    const modal=ensureBrowseProfileModal();
    const p=isSelf?selfAsPerson():people.find(x=>personKey(x)===String(key));
    if(!p) return showToast('Profile is not available right now.');
    if(!isSelf&&personIsPremiumDistanceLocked(p)) return showToast(`Afterglow+ unlocks profiles beyond ${FREE_DISTANCE_MILES} miles.`);
    modal.dataset.key=personKey(p);
    modal.dataset.self=isSelf?'1':'0';
    const back=modal.querySelector('#browseProfileBack');
    if(back) back.textContent=isSelf?'← Back to Edit':'← Back';
    renderBrowseProfileBody(p,isSelf);
    modal.classList.remove('hidden');
    modal.querySelector('.browse-profile-shell')?.scrollTo({top:0,behavior:'instant'});
  }
  function browsePass(key){
    const p=people.find(x=>personKey(x)===String(key));
    if(!p) return;
    const id=personKey(p);
    if(!passedKeys().includes(id)) state.passed.push(id);
    state.liked=(state.liked||[]).filter(x=>String(x)!==id);
    save('discovery_pass');
    syncToSupabase(false,'discovery_pass');
    closeBrowseProfile();
    renderStack();renderMatches();renderChats();
    showToast(`Passed on ${p.name}.`);
  }
  function browseLike(key){
    const p=people.find(x=>personKey(x)===String(key));
    if(!p) return;
    const id=personKey(p);
    if(!likedKeys().includes(id)) state.liked.push(id);
    state.passed=(state.passed||[]).filter(x=>String(x)!==id);
    p.serverILike=true;
    if(p.serverLikesMe===true || p.likesMe) p.serverMutual=true;
    save('discovery_like');
    syncToSupabase(false,'discovery_like');
    renderMatches();renderChats();
    if(p.likesMe){
      showToast(`It's a match with ${p.name}!`);
      renderBrowseProfileBody(p,false);
    }else{
      showToast(`Liked ${p.name}.`);
      closeBrowseProfile();renderStack();
    }
  }
  window.AfterglowProfilePreview={open:(key)=>openBrowseProfile(key,false),openMine:()=>openBrowseProfile(null,true),close:closeBrowseProfile};

  function hasSavedLocation(){
    const loc=state?.profile?.location||{};
    const lat=numberOrNull(loc.lat),lng=numberOrNull(loc.lng);
    return lat!==null&&lng!==null&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
  }
  function renderLocationStatus(){
    const status=document.querySelector('#locationStatus');
    const btn=document.querySelector('#useCurrentLocation');
    if(!status) return;
    if(hasSavedLocation()){
      const captured=state.profile?.location?.capturedAt?new Date(state.profile.location.capturedAt):null;
      const when=captured&&!Number.isNaN(captured.getTime())?` • updated ${captured.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:'';
      status.textContent=`Device location is on${when}. Other members only receive an approximate distance, never your coordinates.`;
      if(btn) btn.textContent='📍 Update Location';
      return;
    }
    if(state?.profile?.locationConsentState==='denied'){
      status.textContent='Location access is blocked in this browser. Allow location for this site, then choose Use Current Location.';
      if(btn) btn.textContent='📍 Try Location Again';
      return;
    }
    status.textContent='Use your device location to sort nearby profiles and calculate approximate distance.';
    if(btn) btn.textContent='📍 Use Current Location';
  }
  async function requestDeviceLocation({force=false}={}){
    if(!authUser) return showToast('Sign in before setting your location.');
    if(!navigator.geolocation){
      state.profile.locationConsentState='unsupported';save('location_unsupported');renderLocationStatus();
      return showToast('Location is not supported by this browser.');
    }
    const button=document.querySelector('#useCurrentLocation');
    if(button){button.disabled=true;button.textContent='📍 Locating…';}
    state.profile.locationPromptedAt=new Date().toISOString();
    try{
      const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:12000,maximumAge:300000}));
      const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)) throw new Error('Invalid location');
      state.profile.location={lat:Number(lat.toFixed(5)),lng:Number(lng.toFixed(5)),accuracy:Math.round(Number(pos.coords.accuracy||0)),capturedAt:new Date().toISOString()};
      state.profile.locationConsentState='granted';
      save('device_location');
      await syncToSupabase(false,'device_location');
      await loadPeopleDirectory({preserveIndex:true,quiet:true}).catch(()=>{});
      renderLocationStatus();renderStack();
      showToast('Location updated. Only approximate distance is shared.');
    }catch(err){
      const denied=Number(err?.code)===1;
      state.profile.locationConsentState=denied?'denied':'unavailable';
      save('location_permission');
      renderLocationStatus();
      showToast(denied?'Location permission is blocked. You can enable it in your browser and try again.':'Could not get your location. Please try again.');
    }finally{
      if(button) button.disabled=false;
      renderLocationStatus();
    }
  }
  function maybeRequestSignupLocation(){
    if(!authUser||hasSavedLocation()||state?.profile?.locationConsentState==='denied') return;
    const key=`afterglowLocationPrompted:${authUser.id}`;
    if(localStorage.getItem(key)) return;
    try{localStorage.setItem(key,new Date().toISOString());}catch{}
    setTimeout(()=>requestDeviceLocation({force:false}),800);
  }

  function weekdayForDateKey(key){
    const d=new Date(`${key}T12:00:00`);
    return Number.isNaN(d.getTime())?'Day':new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(d);
  }
  function renderDistributionDailyGift(){
    const r=ensureRewards();
    const claimed=!!r.claimedToday;
    const continuing=r.lastClaimDate===yesterdayKey()||r.lastClaimDate===todayKey();
    const claimDay=claimed?Math.max(1,Number(r.streak||1)):(continuing?Number(r.streak||0)+1:1);
    const rewardIndex=Math.min(Math.max(claimDay,1),7)-1;
    const reward=DAILY_GLOW_REWARDS[rewardIndex];
    const balance=document.querySelector('#glowCoinBalance');if(balance) balance.textContent=Number(r.glowCoins||0).toLocaleString();
    const stateEl=document.querySelector('#dailyRewardState');if(stateEl) stateEl.textContent=claimed?'Claimed':'Today';
    const amount=document.querySelector('#dailyRewardAmount');if(amount) amount.textContent=Number(reward||0).toLocaleString();
    const btn=document.querySelector('#claimDailyGift');
    if(btn){btn.disabled=claimed;btn.textContent=claimed?'Claimed today':`Claim ${reward} Glow Coins`;}
    const title=document.querySelector('#dailyGiftTitle');if(title) title.textContent=claimed?'Gift claimed ✨':`Today’s Glow Gift`;
    const text=document.querySelector('#dailyGiftText');
    if(text) text.textContent=claimed?`You are on a ${Math.max(1,Number(r.streak||1))}-day streak. Come back tomorrow to keep it going.`:'Claim today’s reward and keep your streak alive for the 50-coin day-seven gift.';
    const row=document.querySelector('#dailyStreakRow');
    if(row){
      const anchorIndex=rewardIndex;
      row.innerHTML=DAILY_GLOW_REWARDS.map((coins,i)=>{
        const date=shiftDateKey(todayKey(),i-anchorIndex);
        const completed=claimed ? i<=anchorIndex : i<anchorIndex;
        const current=i===anchorIndex;
        return `<span class="streak-dot ${completed?'done':''} ${current?'current':''}"><b>${escapeHtml(weekdayForDateKey(date))}</b><small>${coins}</small></span>`;
      }).join('');
    }
    const gift=document.querySelector('#dailyGift');if(gift) gift.title=`Total Glow Coins: ${Number(r.glowCoins||0).toLocaleString()}`;
  }
  const distBaseRenderDailyGift=typeof renderDailyGift==='function'?renderDailyGift:null;
  if(distBaseRenderDailyGift){
    renderDailyGift=function(){
      distBaseRenderDailyGift.apply(this,arguments);
      renderDistributionDailyGift();
    };
  }

  function injectAdminDataOperations(){
    if(!isAdmin()) return;
    const pane=document.querySelector('#adminPaneTools .admin-two-col');
    if(!pane||document.querySelector('#adminDataOperations')) return;
    const card=document.createElement('div');
    card.id='adminDataOperations';
    card.className='edit-card admin-form admin-data-operations';
    card.innerHTML=`<h3>Data Operations</h3><p class="tiny-note">Owner-only integrity, usage, and backup controls.</p><button id="adminCheckDataHealth" class="ghost full" type="button">Check Data Health</button><button id="adminCheckUsage" class="ghost full" type="button">View Usage Breakdown</button><button id="adminDownloadServerBackup" class="ghost full" type="button">Download Server Backup</button><div id="afterglowHealthOutput" class="admin-data-output">Ready.</div>`;
    pane.appendChild(card);
    card.querySelector('#adminCheckDataHealth').onclick=async()=>{
      const out=card.querySelector('#afterglowHealthOutput');out.textContent='Checking…';
      if(!supa) return out.textContent='Cloud service is unavailable.';
      try{
        const {data,error}=await supa.rpc('fv_admin_health_summary');if(error)throw error;
        out.textContent=`${Number(data?.profiles||0)} profiles • ${Number(data?.profiles_with_answers||0)} with answers • ${Number(data?.wallets||0)} wallets • ${Number(data?.active_premium||0)} active Plus passes • ${Number(data?.revision_backups||0)} recovery points`;
      }catch(err){console.warn(err);out.textContent='Data health summary is temporarily unavailable.';}
    };
    card.querySelector('#adminCheckUsage').onclick=async()=>{
      const out=card.querySelector('#afterglowHealthOutput');out.textContent='Measuring usage…';
      if(!supa) return out.textContent='Cloud service is unavailable.';
      try{
        const {data,error}=await supa.rpc('fv_admin_usage_summary');if(error)throw error;
        const mb=n=>`${(Number(n||0)/1048576).toFixed(1)} MB`;
        const buckets=data?.storage_buckets||{};
        const bucketText=Object.entries(buckets).map(([name,v])=>`${name}: ${mb(v?.bytes)} / ${Number(v?.objects||0)} objects`).join(' • ');
        const orphans=data?.orphan_candidates||{},orphanBytes=Object.values(orphans).reduce((n,v)=>n+Number(v?.bytes||0),0),orphanObjects=Object.values(orphans).reduce((n,v)=>n+Number(v?.objects||0),0);
        const legacy=data?.legacy_embedded_images||{},legacyBytes=Number(legacy.profile_bytes||0)+Number(legacy.revision_bytes||0),legacyRows=Number(legacy.profile_rows||0)+Number(legacy.revision_rows||0);
        out.textContent=`Database ${mb(data?.database_bytes)} • Profiles ${mb(data?.table_bytes?.profiles)} • Revisions ${mb(data?.table_bytes?.revisions)} • Messages ${mb(data?.table_bytes?.messages)} • Activity ${mb(data?.table_bytes?.activity)}${bucketText?` • Storage: ${bucketText}`:''}${orphanObjects?` • Potential unreferenced Storage: ${mb(orphanBytes)} / ${orphanObjects} objects`:''}${legacyRows?` • Legacy embedded images: ${mb(legacyBytes)} / ${legacyRows} copies (migrate automatically as those users sign in)`:''}`;
      }catch(err){console.warn(err);out.textContent='Usage summary is unavailable until the v4 Supabase migration is installed.';}
    };
    card.querySelector('#adminDownloadServerBackup').onclick=async()=>{
      const out=card.querySelector('#afterglowHealthOutput');out.textContent='Preparing backup…';
      if(!supa) return out.textContent='Cloud service is unavailable.';
      try{
        const {data,error}=await supa.rpc('fv_admin_export_backup');if(error)throw error;
        downloadJson(`afterglow-server-backup-${todayKey()}.json`,data);
        out.textContent='Server backup downloaded.';
        showToast('Server backup downloaded.');
      }catch(err){console.warn(err);out.textContent='Server backup is temporarily unavailable.';}
    };
  }

  function bindDistributionUi(){
    const live=document.querySelector('#viewLiveProfile');
    if(live&&!live.dataset.boundDistribution){live.dataset.boundDistribution='1';live.onclick=()=>openBrowseProfile(null,true);}
    const location=document.querySelector('#useCurrentLocation');
    if(location&&!location.dataset.boundDistribution){location.dataset.boundDistribution='1';location.onclick=()=>requestDeviceLocation({force:true});}
    const apply=document.querySelector('#applyFilters');
    if(apply&&!apply.dataset.boundDistribution){apply.dataset.boundDistribution='1';apply.onclick=applyDistributionFilters;}
    const filterOpen=document.querySelector('#filterOpen');
    if(filterOpen&&!filterOpen.dataset.boundDistribution){filterOpen.dataset.boundDistribution='1';filterOpen.onclick=()=>{syncFilterControls();document.querySelector('#filters')?.classList.remove('hidden');};}
    const close=document.querySelector('#closeFilters');
    if(close&&!close.dataset.boundDistribution){close.dataset.boundDistribution='1';close.onclick=()=>document.querySelector('#filters')?.classList.add('hidden');}
    syncFilterControls();renderLocationStatus();renderPremiumPassCard();injectAdminDataOperations();
  }

  const distBaseOpenApp=typeof openApp==='function'?openApp:null;
  if(distBaseOpenApp){
    openApp=function(){
      const result=distBaseOpenApp.apply(this,arguments);
      setTimeout(()=>{bindDistributionUi();maybeRequestSignupLocation();renderStack();},80);
      return result;
    };
  }
  const distBaseShowScreen=typeof showScreen==='function'?showScreen:null;
  if(distBaseShowScreen){
    showScreen=function(id){
      const result=distBaseShowScreen.apply(this,arguments);
      if(id==='discover') setTimeout(renderStack,0);
      if(id==='profile') setTimeout(()=>{renderLocationStatus();bindDistributionUi();},0);
      if(id==='shop') setTimeout(renderPremiumPassCard,0);
      if(id==='admin') setTimeout(injectAdminDataOperations,0);
      return result;
    };
  }
  const distBaseHydrateProfileForm=typeof hydrateProfileForm==='function'?hydrateProfileForm:null;
  if(distBaseHydrateProfileForm){
    hydrateProfileForm=function(){
      const result=distBaseHydrateProfileForm.apply(this,arguments);
      setTimeout(()=>{renderLocationStatus();bindDistributionUi();},0);
      return result;
    };
  }
  const distBaseRenderAdmin=typeof renderAdmin==='function'?renderAdmin:null;
  if(distBaseRenderAdmin){
    renderAdmin=function(){const result=distBaseRenderAdmin.apply(this,arguments);setTimeout(injectAdminDataOperations,0);return result;};
  }
  const distBaseRenderAdminWorkspace=typeof renderAdminWorkspace==='function'?renderAdminWorkspace:null;
  if(distBaseRenderAdminWorkspace){
    renderAdminWorkspace=function(){const result=distBaseRenderAdminWorkspace.apply(this,arguments);setTimeout(injectAdminDataOperations,0);return result;};
  }

  bindDistributionUi();
  renderDistributionDailyGift();
  setTimeout(()=>{bindDistributionUi();renderStack();renderPremiumPassCard();renderDistributionDailyGift();},1200);
})();

/* =========================================================
   Afterglow v4: robust Vault response engine + Builder
   Adds dropdown, numeric, and configurable slider prompt types.
   Existing Vault data remains backwards compatible.
   ========================================================= */
(function(){
  const V4_SLIDER_DEFAULT={min:1,max:10,step:1,showValue:true,anchors:{left:{emoji:'🤢',label:'Yuck'},mid:{emoji:'😐',label:'Meh'},right:{emoji:'😍',label:'Love'}}};
  const V4_NUMBER_DEFAULT={min:null,max:null,step:1,unit:'',placeholder:'Enter a number'};
  function numOrNull(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
  function promptMode(card){return card?.answerMode||card?.mode||'global';}
  function isDropdownPrompt(card){return promptMode(card)==='dropdown';}
  function isNumberPrompt(card){return promptMode(card)==='number';}
  function isSliderPrompt(card){return promptMode(card)==='slider';}
  function sliderConfig(card){
    const raw=card?.sliderConfig||{}; const a=raw.anchors||{};
    let min=numOrNull(raw.min); if(min===null)min=1;
    let max=numOrNull(raw.max); if(max===null||max<=min)max=Math.max(min+1,10);
    let step=numOrNull(raw.step); if(step===null||step<=0)step=1;
    return {min,max,step,showValue:raw.showValue!==false,anchors:{
      left:{emoji:String(a.left?.emoji||V4_SLIDER_DEFAULT.anchors.left.emoji),label:String(a.left?.label||V4_SLIDER_DEFAULT.anchors.left.label)},
      mid:{emoji:String(a.mid?.emoji||V4_SLIDER_DEFAULT.anchors.mid.emoji),label:String(a.mid?.label||V4_SLIDER_DEFAULT.anchors.mid.label)},
      right:{emoji:String(a.right?.emoji||V4_SLIDER_DEFAULT.anchors.right.emoji),label:String(a.right?.label||V4_SLIDER_DEFAULT.anchors.right.label)}
    }};
  }
  function numberConfig(card){
    const raw=card?.numberConfig||{};
    let step=numOrNull(raw.step); if(step===null||step<=0)step=1;
    return {min:numOrNull(raw.min),max:numOrNull(raw.max),step,unit:String(raw.unit||''),placeholder:String(raw.placeholder||'Enter a number')};
  }
  function selectedNumericValue(v){
    if(v&&typeof v==='object'&&!Array.isArray(v)) return numOrNull(v.value??v.key);
    return numOrNull(v);
  }
  function sliderAnchorFor(card,value){
    const cfg=sliderConfig(card), n=selectedNumericValue(value); if(n===null)return cfg.anchors.mid;
    const t=(n-cfg.min)/Math.max(.000001,cfg.max-cfg.min);
    return t<.34?cfg.anchors.left:(t>.66?cfg.anchors.right:cfg.anchors.mid);
  }
  function hasRatingValue(v){
    if(v===null||v===undefined||v==='')return false;
    if(typeof v==='object'&&!Array.isArray(v))return v.value!==''&&v.value!==null&&v.value!==undefined || !!v.key;
    return String(v).trim()!=='';
  }
  function optionEntries(card){return Object.entries(cardAnswerOptions(card)||{});}
  function normalizeChoiceLabel(card,v){
    const key=ratingKey(v); const opts=cardAnswerOptions(card); return String(opts?.[key]||v?.text||v?.label||key||'');
  }
  function numericSimilarity(card,a,b){
    const av=selectedNumericValue(a),bv=selectedNumericValue(b); if(av===null||bv===null)return null;
    let range=1;
    if(isSliderPrompt(card)){const c=sliderConfig(card);range=Math.max(c.step,c.max-c.min);}
    else{const c=numberConfig(card);if(c.min!==null&&c.max!==null&&c.max>c.min)range=c.max-c.min;else range=Math.max(Math.abs(av),Math.abs(bv),1);}
    return Math.max(0,Math.min(1,1-Math.abs(av-bv)/Math.max(range,.000001)));
  }

  answerLabel=function(card,val){
    const mode=promptMode(card);
    if(isTextPrompt(card)) return ratingText(val)?'✍️ Written':'Unanswered';
    if(mode==='number'){
      const n=selectedNumericValue(val); if(n===null)return 'Unanswered'; const cfg=numberConfig(card); return `${n}${cfg.unit?` ${cfg.unit}`:''}`;
    }
    if(mode==='slider'){
      const n=selectedNumericValue(val); if(n===null)return 'Unanswered'; const cfg=sliderConfig(card),anchor=sliderAnchorFor(card,n); return `${anchor.emoji} ${anchor.label}${cfg.showValue?` • ${n}`:''}`;
    }
    if(mode==='dropdown'){
      const text=normalizeChoiceLabel(card,val); return text||'Unanswered';
    }
    const key=ratingKey(val), opts=cardAnswerOptions(card); return opts[key]||labels[key]||key||'Unanswered';
  };

  compatibilityForRatings=function(otherRatings={}){
    const mine=state.ratings||{},shared=[]; let positive=0,conflicts=0,compared=0;
    Object.entries(otherRatings||{}).forEach(([id,their])=>{
      const my=mine[id],card=vaultCards.find(c=>c.id===id); if(!card||!hasRatingValue(my)||!hasRatingValue(their)||isTextPrompt(card))return;
      const meta=categoryMeta[card.cat]||{},label=`${meta.emoji||'✨'} ${card.title}`;
      if(isSliderPrompt(card)||isNumberPrompt(card)){
        const sim=numericSimilarity(card,my,their); if(sim===null)return; compared++; positive+=sim; if(sim>=.8)shared.push(label); return;
      }
      const myKey=String(ratingKey(my)||''),theirKey=String(ratingKey(their)||''); if(!myKey||!theirKey)return; compared++;
      const myPositive=isPositiveAnswer(myKey),theirPositive=isPositiveAnswer(theirKey);
      if(myKey===theirKey){positive+=1;shared.push(label);}
      else if(myPositive&&theirPositive){positive+=.8;shared.push(label);}
      if((isLimitAnswer(myKey)&&theirPositive)||(isLimitAnswer(theirKey)&&myPositive))conflicts++;
    });
    let score=compared?Math.round(62+(positive/Math.max(compared,1))*35-conflicts*10):70;
    score=Math.max(0,Math.min(99,score)); return {score,shared:[...new Set(shared)].slice(0,4),conflicts};
  };

  function refreshPeopleCompatibilityFromLocalVault(){
    people=(people||[]).map(p=>{if(!p?.ratings)return p;const c=compatibilityForRatings(p.ratings);return {...p,score:c.score,mutual:c.shared.length?c.shared:['Vault overlap appears after both people answer more cards']};});
    try{renderStack();renderMatches();renderChats();}catch{}
  }

  compareVaultWithPerson=function(p){
    const mine=state.ratings||{},theirs=p?.ratings||{},shared=[],curious=[],different=[],limits=[],written=[];
    Object.entries(theirs).forEach(([id,their])=>{
      const my=mine[id],card=vaultCards.find(c=>c.id===id); if(!card)return;
      if(isTextPrompt(card)){const html=publicTextAnswerHtml(card,their);if(html)written.push({html});return;}
      if(!hasRatingValue(my)||!hasRatingValue(their))return;
      const meta=categoryMeta[card.cat]||{},row={id,title:card.title,cat:card.cat,emoji:meta.emoji||'✨',mine:ratingKey(my),theirs:ratingKey(their),mineLabel:answerLabel(card,my),theirLabel:answerLabel(card,their)};
      if(isSliderPrompt(card)||isNumberPrompt(card)){const sim=numericSimilarity(card,my,their);(sim!==null&&sim>=.8?shared:different).push(row);return;}
      const myKey=String(ratingKey(my)||''),theirKey=String(ratingKey(their)||''),myPositive=isPositiveAnswer(myKey),theirPositive=isPositiveAnswer(theirKey);
      if(isLimitAnswer(myKey)||isLimitAnswer(theirKey))limits.push(row);
      else if(myKey===theirKey||(myPositive&&theirPositive))shared.push(row);
      else if(myKey==='curious'||theirKey==='curious')curious.push(row);
      else different.push(row);
    });
    return {shared,curious,different,limits,written};
  };

  topVaultHtml=function(p){
    const ratings=p?.ratings||{},rows=[];
    Object.entries(ratings).forEach(([id,val])=>{
      if(rows.length>=8||!hasRatingValue(val))return; const card=vaultCards.find(c=>c.id===id); if(!card||isTextPrompt(card))return;
      const key=String(ratingKey(val)||''),mode=promptMode(card),shouldShow=!!card.profileVisible||isPositiveAnswer(key)||['slider','number','dropdown'].includes(mode)&&!!card.profileVisible;
      if(!shouldShow)return; const meta=categoryMeta[card.cat]||{}; rows.push({title:card.title,cat:card.cat,emoji:meta.emoji||'✨',label:answerLabel(card,val)});
    });
    if(!rows.length)return '<div class="profile-empty-mini">They have not shared many Vault answers yet.</div>';
    return rows.map(r=>`<div class="interest-tile"><span>${escapeHtml(r.emoji)}</span><b>${escapeHtml(r.title)}</b><small>${escapeHtml(r.label)}</small></div>`).join('');
  };

  renderVault=function(){
    const searchEl=$('#searchCards'),catEl=$('#categoryFilter'),q=(searchEl?.value||'').toLowerCase(),cat=catEl?.value||'all',cardsEl=$('#cards'); if(!cardsEl)return;
    const list=vaultCards.filter(c=>(cat==='all'||c.cat===cat)&&(!q||`${c.title} ${c.desc} ${c.cat}`.toLowerCase().includes(q)));
    cardsEl.innerHTML=list.map(card=>{
      const cur=state.ratings?.[card.id],meta=categoryMeta[card.cat]||{emoji:'✨',theme:'theme-fantasy'},mode=promptMode(card); let control='';
      if(isTextPrompt(card)){
        const val=escapeHtml(String(ratingText(cur)||'')),multiline=mode==='textarea';
        control=multiline?`<textarea class="vault-written-answer" data-id="${adminEscape(card.id)}" placeholder="Write your answer...">${val}</textarea>`:`<input class="vault-written-answer" data-id="${adminEscape(card.id)}" value="${val}" placeholder="Write your answer..." />`;
      }else if(mode==='dropdown'){
        const key=String(ratingKey(cur)||''); control=`<select class="vault-dropdown-answer" data-id="${adminEscape(card.id)}"><option value="">Choose an answer…</option>${optionEntries(card).map(([k,v])=>`<option value="${adminEscape(k)}" ${key===String(k)?'selected':''}>${adminEscape(v)}</option>`).join('')}</select>`;
      }else if(mode==='number'){
        const cfg=numberConfig(card),n=selectedNumericValue(cur); control=`<div class="vault-number-shell"><input class="vault-number-answer" type="number" data-id="${adminEscape(card.id)}" ${cfg.min!==null?`min="${cfg.min}"`:''} ${cfg.max!==null?`max="${cfg.max}"`:''} step="${cfg.step}" value="${n===null?'':n}" placeholder="${adminEscape(cfg.placeholder)}" />${cfg.unit?`<span class="vault-number-unit">${adminEscape(cfg.unit)}</span>`:''}</div>`;
      }else if(mode==='slider'){
        const cfg=sliderConfig(card),saved=selectedNumericValue(cur),visual=saved===null?(cfg.min+cfg.max)/2:saved,anchor=saved===null?null:sliderAnchorFor(card,saved);
        control=`<div class="vault-slider-control"><div class="vault-slider-anchors"><span><b>${adminEscape(cfg.anchors.left.emoji)}</b>${adminEscape(cfg.anchors.left.label)}</span><span><b>${adminEscape(cfg.anchors.mid.emoji)}</b>${adminEscape(cfg.anchors.mid.label)}</span><span><b>${adminEscape(cfg.anchors.right.emoji)}</b>${adminEscape(cfg.anchors.right.label)}</span></div><input class="vault-slider-answer" type="range" data-id="${adminEscape(card.id)}" min="${cfg.min}" max="${cfg.max}" step="${cfg.step}" value="${visual}"/><div class="vault-slider-readout ${saved===null?'unanswered':''}" data-slider-readout="${adminEscape(card.id)}">${saved===null?'Move the slider to answer':`${adminEscape(anchor.emoji)} ${adminEscape(anchor.label)}${cfg.showValue?` <strong>${saved}</strong>`:''}`}</div></div>`;
      }else{
        const opts=cardAnswerOptions(card),key=String(ratingKey(cur)||''); control=`<div class="answers">${Object.entries(opts).map(([k,v])=>`<button class="answer-btn ${key===String(k)?'selected':''}" data-id="${adminEscape(card.id)}" data-answer="${adminEscape(k)}">${adminEscape(v)}</button>`).join('')}</div>`;
      }
      return `<article class="vcard ${meta.theme}"><div class="vcard-top"><span class="cat-badge">${meta.emoji||'✨'} ${adminEscape(card.cat)}</span><span class="rating-badge">${hasRatingValue(cur)?adminEscape(answerLabel(card,cur)):'❔ Unanswered'}</span></div><h3>${adminEscape(card.title)}</h3><p>${adminEscape(card.desc||'')}</p>${control}</article>`;
    }).join('')||'<div class="empty-state"><h3>No Vault prompts yet</h3><p>New prompts will appear here when they are published.</p></div>';
    $$('.answer-btn').forEach(b=>b.onclick=()=>{state.ratings[b.dataset.id]=b.dataset.answer;save('vault_answer');renderVault();refreshPeopleCompatibilityFromLocalVault();});
    $$('.vault-written-answer').forEach(el=>el.onchange=()=>{const value=el.value.trim();if(value)state.ratings[el.dataset.id]={type:'text',value};else delete state.ratings[el.dataset.id];save('vault_written_answer');renderVaultStats();refreshPeopleCompatibilityFromLocalVault();});
    $$('.vault-dropdown-answer').forEach(el=>el.onchange=()=>{const card=vaultCards.find(c=>c.id===el.dataset.id),value=el.value;if(value)state.ratings[el.dataset.id]={type:'dropdown',key:value,text:cardAnswerOptions(card)?.[value]||value};else delete state.ratings[el.dataset.id];save('vault_dropdown_answer');renderVault();refreshPeopleCompatibilityFromLocalVault();});
    $$('.vault-number-answer').forEach(el=>el.onchange=()=>{const card=vaultCards.find(c=>c.id===el.dataset.id),cfg=numberConfig(card);let n=numOrNull(el.value);if(n===null){delete state.ratings[el.dataset.id];}else{const base=cfg.min??0;n=base+Math.round((n-base)/cfg.step)*cfg.step;const decimals=Math.max(0,(String(cfg.step).split('.')[1]||'').length);n=Number(n.toFixed(Math.min(decimals,10)));if(cfg.min!==null)n=Math.max(cfg.min,n);if(cfg.max!==null)n=Math.min(cfg.max,n);state.ratings[el.dataset.id]={type:'number',value:n};}save('vault_number_answer');renderVault();refreshPeopleCompatibilityFromLocalVault();});
    $$('.vault-slider-answer').forEach(el=>{el.oninput=()=>{const card=vaultCards.find(c=>c.id===el.dataset.id),cfg=sliderConfig(card),n=Number(el.value),a=sliderAnchorFor(card,n),read=document.querySelector(`[data-slider-readout="${CSS.escape(el.dataset.id)}"]`);if(read){read.classList.remove('unanswered');read.innerHTML=`${adminEscape(a.emoji)} ${adminEscape(a.label)}${cfg.showValue?` <strong>${n}</strong>`:''}`;}};el.onchange=()=>{state.ratings[el.dataset.id]={type:'slider',value:Number(el.value)};save('vault_slider_answer');renderVault();refreshPeopleCompatibilityFromLocalVault();};});
    const answeredCount=Object.values(state.ratings||{}).filter(hasRatingValue).length;
    if(answeredCount>=3 && typeof window.afterglowAwardWeeklyGoal==='function') window.afterglowAwardWeeklyGoal('vault3');
  };

  renderVaultStats=function(){const vals=Object.values(state.ratings||{}).filter(hasRatingValue);const rated=$('#ratedCount'),limits=$('#limitCount'),pct=$('#vaultPct');if(rated)rated.textContent=vals.length;if(limits)limits.textContent=vals.filter(v=>isLimitAnswer(ratingKey(v))).length;if(pct)pct.textContent=(vaultCards.length?Math.round(vals.length/vaultCards.length*100):0)+'%';};

  function defaultCustomAnswerRowsV4(){return [{key:'option_1',label:'✨ Option one'},{key:'option_2',label:'💫 Option two'}];}
  adminAnswersToRows=function(answers){if(answers&&typeof answers==='object'&&!Array.isArray(answers))return Object.entries(answers).map(([key,label])=>({key:String(key),label:String(label)}));return defaultCustomAnswerRowsV4();};
  function adminChoiceMode(){const m=$('#adminCardMode')?.value||'global';return m==='custom'||m==='dropdown';}
  getAdminCustomAnswersFromRows=function(){const out={};document.querySelectorAll('#adminCustomAnswerRows .custom-answer-row').forEach(row=>{const raw=row.querySelector('.custom-answer-key')?.value||'',label=(row.querySelector('.custom-answer-label')?.value||'').trim(),key=normalizeAdminCustomAnswerKey(raw||label);if(key&&label&&!out[key])out[key]=label;});return out;};
  syncAdminCustomAnswersHidden=function(){const hidden=$('#adminCardAnswers');if(hidden)hidden.value=adminChoiceMode()?JSON.stringify(getAdminCustomAnswersFromRows(),null,2):'';renderAdminPromptPreviewV4();};
  function moveChoiceRow(row,dir){const parent=row?.parentElement;if(!parent)return;const sibling=dir<0?row.previousElementSibling:row.nextElementSibling;if(!sibling)return;if(dir<0)parent.insertBefore(row,sibling);else parent.insertBefore(sibling,row);syncAdminCustomAnswersHidden();}
  renderAdminCustomAnswerRows=function(answers){
    const wrap=$('#adminCustomAnswerRows'),builder=$('#adminCustomAnswerBuilder'),mode=$('#adminCardMode')?.value||'global';if(!wrap||!builder)return;
    const active=mode==='custom'||mode==='dropdown';builder.classList.toggle('hidden',!active);
    const title=$('#adminChoiceBuilderTitle'),help=$('#adminChoiceBuilderHelp');if(title)title.textContent=mode==='dropdown'?'Dropdown choices':'Custom button choices';if(help)help.textContent=mode==='dropdown'?'Build the dropdown exactly as members will see it.':'Add the buttons members can choose from.';
    if(active){const rows=adminAnswersToRows(answers).filter(r=>r.key||r.label);wrap.innerHTML=(rows.length?rows:defaultCustomAnswerRowsV4()).map(row=>`<div class="custom-answer-row"><input class="custom-answer-key" placeholder="answer_key" value="${adminEscape(row.key)}"/><input class="custom-answer-label" placeholder="Emoji + label" value="${adminEscape(row.label)}"/><div class="choice-order"><button type="button" class="choice-up" title="Move up">↑</button><button type="button" class="choice-down" title="Move down">↓</button></div><button type="button" class="danger remove-custom-answer" title="Remove choice">×</button></div>`).join('');
      wrap.querySelectorAll('input').forEach(i=>i.oninput=syncAdminCustomAnswersHidden);wrap.querySelectorAll('.remove-custom-answer').forEach(b=>b.onclick=()=>{b.closest('.custom-answer-row')?.remove();syncAdminCustomAnswersHidden();});wrap.querySelectorAll('.choice-up').forEach(b=>b.onclick=()=>moveChoiceRow(b.closest('.custom-answer-row'),-1));wrap.querySelectorAll('.choice-down').forEach(b=>b.onclick=()=>moveChoiceRow(b.closest('.custom-answer-row'),1));
    }else wrap.innerHTML='';
    const num=$('#adminNumberConfig'),slider=$('#adminSliderConfig');if(num)num.classList.toggle('hidden',mode!=='number');if(slider)slider.classList.toggle('hidden',mode!=='slider');syncAdminCustomAnswersHidden();renderAdminPromptPreviewV4();
  };
  addAdminCustomAnswerRow=function(){const mode=$('#adminCardMode');if(mode&&!['custom','dropdown'].includes(mode.value))mode.value='custom';const wrap=$('#adminCustomAnswerRows');if(!wrap)return;if(!adminChoiceMode())renderAdminCustomAnswerRows({});const row=document.createElement('div');row.className='custom-answer-row';row.innerHTML='<input class="custom-answer-key" placeholder="answer_key"/><input class="custom-answer-label" placeholder="Emoji + label"/><div class="choice-order"><button type="button" class="choice-up">↑</button><button type="button" class="choice-down">↓</button></div><button type="button" class="danger remove-custom-answer">×</button>';wrap.appendChild(row);row.querySelectorAll('input').forEach(i=>i.oninput=syncAdminCustomAnswersHidden);row.querySelector('.remove-custom-answer').onclick=()=>{row.remove();syncAdminCustomAnswersHidden();};row.querySelector('.choice-up').onclick=()=>moveChoiceRow(row,-1);row.querySelector('.choice-down').onclick=()=>moveChoiceRow(row,1);row.querySelector('.custom-answer-label')?.focus();syncAdminCustomAnswersHidden();};

  function fillNumberAdmin(card){const c=numberConfig(card);[['adminNumberMin',c.min],['adminNumberMax',c.max],['adminNumberStep',c.step],['adminNumberUnit',c.unit],['adminNumberPlaceholder',c.placeholder]].forEach(([id,v])=>{const el=$('#'+id);if(el)el.value=v??'';});}
  function fillSliderAdmin(card){const c=sliderConfig(card),map={adminSliderMin:c.min,adminSliderMax:c.max,adminSliderStep:c.step,adminSliderLeftEmoji:c.anchors.left.emoji,adminSliderLeftLabel:c.anchors.left.label,adminSliderMidEmoji:c.anchors.mid.emoji,adminSliderMidLabel:c.anchors.mid.label,adminSliderRightEmoji:c.anchors.right.emoji,adminSliderRightLabel:c.anchors.right.label};Object.entries(map).forEach(([id,v])=>{const el=$('#'+id);if(el)el.value=v;});const show=$('#adminSliderShowValue');if(show)show.checked=c.showValue;}
  function readNumberAdmin(){return {min:numOrNull($('#adminNumberMin')?.value),max:numOrNull($('#adminNumberMax')?.value),step:numOrNull($('#adminNumberStep')?.value)||1,unit:($('#adminNumberUnit')?.value||'').trim().slice(0,40),placeholder:($('#adminNumberPlaceholder')?.value||'Enter a number').trim().slice(0,80)};}
  function readSliderAdmin(){let min=numOrNull($('#adminSliderMin')?.value),max=numOrNull($('#adminSliderMax')?.value),step=numOrNull($('#adminSliderStep')?.value);if(min===null)min=1;if(max===null)max=10;if(step===null||step<=0)step=1;return {min,max,step,showValue:!!$('#adminSliderShowValue')?.checked,anchors:{left:{emoji:($('#adminSliderLeftEmoji')?.value||'🤢').trim().slice(0,12),label:($('#adminSliderLeftLabel')?.value||'Yuck').trim().slice(0,40)},mid:{emoji:($('#adminSliderMidEmoji')?.value||'😐').trim().slice(0,12),label:($('#adminSliderMidLabel')?.value||'Meh').trim().slice(0,40)},right:{emoji:($('#adminSliderRightEmoji')?.value||'😍').trim().slice(0,12),label:($('#adminSliderRightLabel')?.value||'Love').trim().slice(0,40)}}};}

  function previewControl(mode,card){
    if(mode==='dropdown')return `<select disabled><option>Choose an answer…</option>${optionEntries(card).map(([,v])=>`<option>${adminEscape(v)}</option>`).join('')}</select>`;
    if(mode==='number'){const c=numberConfig(card);return `<div class="vault-number-shell"><input type="number" disabled placeholder="${adminEscape(c.placeholder)}"/><span class="vault-number-unit">${adminEscape(c.unit)}</span></div>`;}
    if(mode==='slider'){const c=sliderConfig(card),mid=(c.min+c.max)/2;return `<div class="vault-slider-control"><div class="vault-slider-anchors"><span><b>${adminEscape(c.anchors.left.emoji)}</b>${adminEscape(c.anchors.left.label)}</span><span><b>${adminEscape(c.anchors.mid.emoji)}</b>${adminEscape(c.anchors.mid.label)}</span><span><b>${adminEscape(c.anchors.right.emoji)}</b>${adminEscape(c.anchors.right.label)}</span></div><input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${mid}" disabled/><div class="vault-slider-readout">${adminEscape(c.anchors.mid.emoji)} ${adminEscape(c.anchors.mid.label)}${c.showValue?` <strong>${mid}</strong>`:''}</div></div>`;}
    if(mode==='text')return '<input disabled placeholder="Write your answer..."/>'; if(mode==='textarea')return '<textarea disabled placeholder="Write your answer..."></textarea>';
    return `<div class="answers">${optionEntries(card).map(([,v])=>`<button type="button" class="answer-btn" disabled>${adminEscape(v)}</button>`).join('')}</div>`;
  }
  function renderAdminPromptPreviewV4(){const body=$('#adminPromptPreviewBody');if(!body)return;const mode=$('#adminCardMode')?.value||'global',cat=$('#adminCardCat')?.value||Object.keys(categoryMeta)[0]||'Vault',card={id:'preview',title:($('#adminCardTitle')?.value||'Your prompt title').trim(),desc:($('#adminCardDesc')?.value||'Prompt description appears here.').trim(),cat,answerMode:mode,profileVisible:!!$('#adminCardProfileVisible')?.checked};if(mode==='custom'||mode==='dropdown')card.answers=getAdminCustomAnswersFromRows();if(mode==='number')card.numberConfig=readNumberAdmin();if(mode==='slider')card.sliderConfig=readSliderAdmin();const meta=categoryMeta[cat]||{emoji:'✨',theme:'theme-fantasy'};body.innerHTML=`<article class="vcard ${meta.theme}"><div class="vcard-top"><span class="cat-badge">${adminEscape(meta.emoji||'✨')} ${adminEscape(cat)}</span><span class="rating-badge">❔ Unanswered</span></div><h3>${adminEscape(card.title)}</h3><p>${adminEscape(card.desc)}</p>${previewControl(mode,card)}</article>`;}

  selectAdminCard=function(id){adminSelectedCardId=id;const card=vaultCards.find(c=>c.id===id)||{id:'',title:'',cat:Object.keys(categoryMeta)[0]||'',desc:'',answerMode:'global',answers:null,profileVisible:false};$('#adminCardId').value=card.id||'';$('#adminCardTitle').value=card.title||'';populateAdminCardCategorySelect();$('#adminCardCat').value=card.cat||Object.keys(categoryMeta)[0]||'';$('#adminCardDesc').value=card.desc||'';const mode=$('#adminCardMode');if(mode)mode.value=promptMode(card);const answers=$('#adminCardAnswers');if(answers)answers.value=card.answers?JSON.stringify(card.answers,null,2):'';fillNumberAdmin(card);fillSliderAdmin(card);renderAdminCustomAnswerRows(card.answers||null);const visible=$('#adminCardProfileVisible');if(visible)visible.checked=!!card.profileVisible;const title=$('#adminCardFormTitle');if(title)title.textContent=id?'Edit Vault Prompt':'Add New Vault Prompt';renderAdminCards();renderAdminPromptPreviewV4();};

  saveAdminCard=function(){
    if(!isAdmin())return showToast('Admin access is restricted.'); const id=adminSlug($('#adminCardId').value||$('#adminCardTitle').value),mode=$('#adminCardMode')?.value||'global',title=($('#adminCardTitle').value||'').trim(),cat=$('#adminCardCat').value,desc=($('#adminCardDesc').value||'').trim();
    if(!id||!title)return showToast('Add a prompt title and ID.'); if(!cat)return showToast('Choose a category.');
    const card={id,title,cat,desc,answerMode:mode,profileVisible:!!$('#adminCardProfileVisible')?.checked,configVersion:2};
    if(mode==='custom'||mode==='dropdown'){const answers=getAdminCustomAnswersFromRows();if(Object.keys(answers).length<2)return showToast('Add at least two unique choices.');card.answers=answers;}
    if(mode==='number'){const cfg=readNumberAdmin();if(cfg.step<=0)return showToast('Number step must be greater than zero.');if(cfg.min!==null&&cfg.max!==null&&cfg.max<cfg.min)return showToast('Number maximum must be greater than or equal to minimum.');card.numberConfig=cfg;}
    if(mode==='slider'){const cfg=readSliderAdmin();if(!(cfg.max>cfg.min))return showToast('Slider maximum must be greater than minimum.');if(!(cfg.step>0) || cfg.step>(cfg.max-cfg.min))return showToast('Slider step must be greater than zero and no larger than the slider range.');if(!cfg.anchors.left.label||!cfg.anchors.mid.label||!cfg.anchors.right.label)return showToast('Add labels for all three slider anchors.');card.sliderConfig=cfg;}
    const oldIndex=vaultCards.findIndex(c=>c.id===adminSelectedCardId||c.id===id);if(oldIndex>=0)vaultCards[oldIndex]=card;else vaultCards.push(card);adminSelectedCardId=id;applyAdminConfig(adminConfigObject(),true);renderAdminWorkspace();saveAdminConfig(false);
  };

  const baseBindAdmin=bindAdminStudio;
  bindAdminStudio=function(){
    baseBindAdmin();
    const watchIds=['adminCardTitle','adminCardDesc','adminCardCat','adminCardProfileVisible','adminNumberMin','adminNumberMax','adminNumberStep','adminNumberUnit','adminNumberPlaceholder','adminSliderMin','adminSliderMax','adminSliderStep','adminSliderLeftEmoji','adminSliderLeftLabel','adminSliderMidEmoji','adminSliderMidLabel','adminSliderRightEmoji','adminSliderRightLabel','adminSliderShowValue'];
    watchIds.forEach(id=>{const el=$('#'+id);if(el&&!el.dataset.v4preview){el.dataset.v4preview='1';el.addEventListener(el.type==='checkbox'||el.tagName==='SELECT'?'change':'input',renderAdminPromptPreviewV4);}});
    const mode=$('#adminCardMode');if(mode){mode.onchange=()=>{renderAdminCustomAnswerRows();renderAdminPromptPreviewV4();};}
  };

  profileWrittenAnswersHtml=function(p){const ratings=p?.ratings||{},rows=[];Object.entries(ratings).forEach(([id,val])=>{const card=vaultCards.find(c=>c.id===id),html=card?publicTextAnswerHtml(card,val):'';if(html)rows.push(html);});return rows.length?rows.slice(0,6).join(''):'<div class="profile-empty-mini">No written profile prompts shared yet.</div>';};

  // Re-render once after all v4 overrides are installed.
  try{renderVault();renderVaultStats();refreshPeopleCompatibilityFromLocalVault();}catch(err){console.warn('Vault v4 initial render skipped',err);}
})();
