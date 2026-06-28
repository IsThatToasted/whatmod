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
const DIRECTORY_REFRESH_MS = 8000;
const CHAT_REFRESH_MS = 3000;
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
    radius:'25 miles',
    lookingFor:'Intimate connection',
    interests:'',
    bio:'',
    avatarUrl: meta.avatar_url || meta.picture || ''
  };
}
function base(user=null){return {ageOk:false, userId: user?.id || getDeviceId(), profile: defaultProfileForAuth(user), ratings:{}, liked:[], passed:[], rewards:{glowCoins:0, streak:0, lastClaimDate:'', claimedToday:false}, updatedAt:new Date().toISOString()};}
function getDeviceId(){let id=localStorage.getItem('fvDeviceId'); if(!id){id='local-'+crypto.randomUUID(); localStorage.setItem('fvDeviceId',id);} return id;}
function userStorageKey(user=authUser){ return user?.id ? `${KEY}:${user.id}` : KEY; }
function load(user=null){try{return {...base(user), ...(JSON.parse(localStorage.getItem(userStorageKey(user)))||{})}}catch{return base(user)}}
function save(){state.updatedAt=new Date().toISOString(); localStorage.setItem(userStorageKey(), JSON.stringify(state)); renderVaultStats(); renderMatches(); renderChats(); debounceSync();}
function repairProfileForAuth(profile={}, user){
  const defaults = defaultProfileForAuth(user);
  const fixed = {...defaults, ...(profile||{})};
  // Migration guard: earlier prototype builds could accidentally copy Brian's local profile
  // into a different Google account on the same browser. If that happened, prefer the
  // signed-in Google name and remove the copied demo area.
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
  return next;
}

let syncTimer=null; function debounceSync(){clearTimeout(syncTimer); syncTimer=setTimeout(()=>syncToSupabase(false),700);}

async function syncToSupabase(show=true){
  if(bootingRemote) return;
  if(!supa){setSync('local fallback'); if(show) showToast('Supabase unavailable; saved locally.'); return;}
  if(!authUser){setSync('local only — sign in to sync'); if(show) showToast('Sign in with Google before syncing.'); return;}
  try{
    const payload={
      user_id: authUser.id,
      email: authUser.email || null,
      profile:{...state.profile, rewards:state.rewards, inventory:state.inventory},
      ratings:state.ratings,
      liked:state.liked,
      passed:state.passed,
      updated_at:new Date().toISOString()
    };
    const {error}=await supa.from('fv_profiles').upsert(payload,{onConflict:'user_id'});
    if(error) throw error;
    setSync('synced to Supabase'); if(show) showToast('Synced to Supabase.');
  }catch(err){setSync('local fallback — check schema/RLS'); if(show) showToast('Saved locally. Check Supabase schema/Auth setup.'); console.warn(err);}
}

async function loadRemoteProfile(){
  if(!supa || !authUser) return;
  bootingRemote = true;
  try{
    const {data,error}=await supa.from('fv_profiles').select('*').eq('user_id',authUser.id).maybeSingle();
    if(error) throw error;
    if(data){
      state = {...state, profile: repairProfileForAuth({...state.profile,...(data.profile||{})}, authUser), rewards:(data.profile||{}).rewards || state.rewards || {glowCoins:0,streak:0,lastClaimDate:'',claimedToday:false}, ratings:data.ratings||{}, liked:data.liked||[], passed:data.passed||[], userId:authUser.id};
      localStorage.setItem(userStorageKey(), JSON.stringify(state));
      hydrateProfileForm(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); renderStack();
      setSync('loaded from Supabase');
    }else{
      // Brand-new account: start from the signed-in Google user, not old local data from another account.
      state = loadStateForAuthUser(authUser);
      hydrateProfileForm(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); renderStack(); updateAvatar();
      bootingRemote = false;
      await syncToSupabase(false);
      bootingRemote = true;
    }
  }catch(err){ console.warn(err); setSync('local fallback — could not load cloud profile'); }
  finally{ bootingRemote = false; }
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
  if(!supa){ showToast('Supabase unavailable.'); return; }
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
    showToast(seedDefaults ? 'Default Vault config seeded.' : 'Admin config saved.');
  }catch(err){ console.warn(err); showToast('Admin save failed. Check JSON, schema, and RLS.'); }
}

async function handleAvatarUpload(file){
  if(!file) return;
  if(!file.type.startsWith('image/')){ showToast('Please choose an image file.'); return; }
  const localDataUrl = await new Promise((resolve,reject)=>{const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file);});
  state.profile.avatarUrl = localDataUrl;
  updateAvatar(); save();
  if(!supa || !authUser){ showToast('Photo saved locally. Sign in to sync cloud photo.'); return; }
  try{
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
    const path = `${authUser.id}/avatar-${Date.now()}.${ext}`;
    const {error:uploadError}=await supa.storage.from('fv-profile-photos').upload(path, file, {cacheControl:'3600', upsert:true});
    if(uploadError) throw uploadError;
    const {data}=supa.storage.from('fv-profile-photos').getPublicUrl(path);
    state.profile.avatarUrl = data.publicUrl;
    updateAvatar(); save(); await syncToSupabase(false);
    showToast('Profile photo updated.');
  }catch(err){ console.warn(err); showToast('Photo saved locally. Create the storage bucket/policies to sync online.'); }
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
    const {data,error}=await supa.from('fv_profiles').select('id,user_id,email,profile,ratings,liked,updated_at').neq('user_id',authUser.id).order('updated_at',{ascending:false}).limit(80);
    if(error) throw error;
    people=(data||[]).map(profileRowToPerson);
    directoryLoaded = true;
    const fingerprint = JSON.stringify((data||[]).map(r=>[r.user_id, r.updated_at, r.liked]));
    if(!quiet && lastDirectoryFingerprint && fingerprint !== lastDirectoryFingerprint) showToast('Profiles refreshed.');
    lastDirectoryFingerprint = fingerprint;
  }catch(err){
    console.warn('Directory load failed', err);
    directoryLoaded = false;
    people=[];
    setSync('signed in — directory needs public profile policy');
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
  if(directoryRefreshTimer) clearInterval(directoryRefreshTimer);
  if(!supa || !authUser) return;
  directoryRefreshTimer = setInterval(()=>{
    if(document.hidden || !authUser) return;
    loadPeopleDirectory({preserveIndex:true, quiet:true});
  }, DIRECTORY_REFRESH_MS);
}

function stopDirectoryAutoRefresh(){
  if(directoryRefreshTimer) clearInterval(directoryRefreshTimer);
  directoryRefreshTimer = null;
}

window.addEventListener('focus', ()=>{
  if(authUser){ loadPeopleDirectory({preserveIndex:true, quiet:true}); if(activeChatKey){ loadChatMessages(activeChatKey, true).then(()=>{renderChatMessages(); renderChats();}); } }
});

document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden && authUser){ loadPeopleDirectory({preserveIndex:true, quiet:true}); if(activeChatKey){ loadChatMessages(activeChatKey, true).then(()=>{renderChatMessages(); renderChats();}); } }
});

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
  if(!supa){ showToast('Supabase is not available. Check config.js.'); return; }
  const redirectTo = authRedirectUrl();
  console.log('[Afterglow] OAuth redirectTo:', redirectTo);
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

function resetLocalAppData(){
  localStorage.removeItem(KEY);
  if(authUser) localStorage.removeItem(userStorageKey(authUser));
  localStorage.removeItem('fvDeviceId');
  state = authUser ? loadStateForAuthUser(authUser) : load();
  hydrateProfileForm();
  renderVault();
  renderVaultStats();
  renderMatches();
  renderChats();
  renderStack();
  updateAuthUi();
  closeApp();
  showToast('Local app data reset. Your Google login was not deleted.');
}

async function initAuth(){
  if(!supa){ updateAuthUi(); return; }
  const {data}=await supa.auth.getSession();
  authUser=data?.session?.user || null;
  updateAuthUi();
  if(authUser){
    state = loadStateForAuthUser(authUser);
    localStorage.setItem(userStorageKey(), JSON.stringify(state));
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

function setSync(text){const el=$('#syncStatus'); if(el) el.textContent=text;}
async function saveProfileManually(){
  save();
  await syncToSupabase(true);
  await loadPeopleDirectory();
  showToast('Profile saved.');
}


function hydrateProfileForm(){
  ['displayName','headline','city','sex','radius','lookingFor','interests','bio'].forEach(id=>{const el=$('#'+id); if(el) el.value=state.profile[id]||'';});
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
  $('#passBtn').onclick=()=>act('pass'); $('#likeBtn').onclick=()=>act('like'); $('#vaultBtn').onclick=()=>{showToast('Mutual Vault details unlock after a match.'); showScreen('vault');};
  const exportData=$('#exportData'); if(exportData) exportData.onclick=()=>{const box=$('#exportBox'); if(box) box.textContent=JSON.stringify(state,null,2);};
  $('#googleLogin').onclick=signInWithGoogle;
  $('#signOut').onclick=signOut;
  const syncNow=$('#syncNow'); if(syncNow) syncNow.onclick=()=>syncToSupabase(true);
  const saveProfileBtn=$('#saveProfile'); if(saveProfileBtn) saveProfileBtn.onclick=saveProfileManually;
  const avatarUpload=$('#avatarUpload'); if(avatarUpload) avatarUpload.onchange=e=>handleAvatarUpload(e.target.files?.[0]);
  const removeAvatar=$('#removeAvatar'); if(removeAvatar) removeAvatar.onclick=()=>{state.profile.avatarUrl=''; updateAvatar(); save(); showToast('Photo removed.');};
  const adminSeed=$('#adminSeed'); if(adminSeed) adminSeed.onclick=()=>saveAdminConfig(true);
  const adminReload=$('#adminReload'); if(adminReload) adminReload.onclick=()=>loadAdminConfig();
  const adminSave=$('#adminSave'); if(adminSave) adminSave.onclick=()=>saveAdminConfig(false);
  const adminResetDefaults=$('#adminResetDefaults'); if(adminResetDefaults) adminResetDefaults.onclick=resetAdminEditorsToDefaults;
  ['displayName','headline','city','sex','radius','lookingFor','interests','bio'].forEach(id=>{const el=$('#'+id); el.value=state.profile[id]||''; el.oninput=e=>{state.profile[id]=e.target.value; updateAvatar(); save();};});
  $('#searchCards').oninput=renderVault; $('#categoryFilter').onchange=renderVault;
  applyAdminConfig(currentAdminConfig(), false); populateCats(); updateAvatar(); renderStack(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); await initAuth(); updateGateUi(); if(canEnter()) openApp(); syncToSupabase(false);
}
function openApp(){ $('#ageGate').classList.add('hidden'); $('#app').classList.remove('hidden'); }
function closeApp(){ $('#app').classList.add('hidden'); $('#ageGate').classList.remove('hidden'); }
function showScreen(id){ $$('.screen').forEach(s=>s.classList.toggle('active-screen',s.id===id)); $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.screen===id)); }
function updateAvatar(){
  const initial=(state.profile.displayName||'V').trim()[0]?.toUpperCase()||'V';
  const url=state.profile.avatarUrl;

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
function iLike(p){ const liked=likedKeys(); return liked.includes(personKey(p)) || liked.includes(p?.name); }
function isMutual(p){ return !!p?.likesMe && iLike(p); }
function incomingLikes(){ return people.filter(p=>p.likesMe && !iLike(p)); }
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
  if(p.avatarUrl) return `<div class="${className} real-face" style="background-image:url('${String(p.avatarUrl).replace(/'/g,'%27')}')"></div>`;
  return `<div class="${className}">${p.initial}</div>`;
}
function renderStack(){
  const arr=orderedPeople(); if(index>=arr.length) index=0; const p=arr[index];
  if(!p){ $('#cardStack').innerHTML='<div class="empty-state"><h3>No profiles available yet</h3><p>When other signed-in members complete their profile, they will appear here automatically.</p></div>'; return; }
  const age=p.age ? `, ${p.age}` : '';
  const likeBadge = p.likesMe ? '<span class="liked-you-badge">❤️ Likes you</span>' : '';
  $('#cardStack').innerHTML=`<article class="person-card">
    <div class="person-photo ${p.avatarUrl?'has-profile-photo':''}" style="background:${p.avatarUrl ? `linear-gradient(180deg,transparent 35%,rgba(0,0,0,.86)), url('${String(p.avatarUrl).replace(/'/g,'%27')}') center/cover` : `linear-gradient(145deg,${p.gradient[0]},${p.gradient[1]})`}"><span class="distance">${p.distanceLabel || '📍 Nearby'}</span><span class="verified">✓ verified</span>${likeBadge}${p.avatarUrl?'':renderPersonAvatar(p)}</div>
    <div class="person-info"><div class="name-row"><h2>${p.name}${age}</h2><strong>${p.score}%</strong></div><p class="headline">${p.vibe}</p><div class="chips">${p.tags.map(t=>`<span class="chip">${t}</span>`).join('')}</div><div class="mutual-box"><b>${p.mutual.length} Vault signal${p.mutual.length===1?'':'s'}:</b><br>${p.mutual.join(' • ')}</div></div>
  </article>`;
}
function act(type){
  const arr=orderedPeople(); const p=arr[index]; if(!p)return;
  const key=personKey(p);
  if(type==='like'&&!likedKeys().includes(key)){state.liked.push(key); showToast(p.likesMe ? `It's a match with ${p.name}!` : `Liked ${p.name}.`);}
  if(type==='pass'&&!passedKeys().includes(key)){state.passed.push(key); showToast(`Passed on ${p.name}.`);}
  index++; save(); renderStack(); renderMatches(); renderChats(); syncToSupabase(false);
}
function acceptLike(key){
  const p=people.find(x=>personKey(x)===String(key));
  if(!p) return;
  if(!likedKeys().includes(personKey(p))) state.liked.push(personKey(p));
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
  showToast('Likes, passes, matches, and test chats reset for this account.');
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
  const bg = p.avatarUrl ? `background-image:url('${String(p.avatarUrl).replace(/'/g,'%27')}');background-size:cover;background-position:center` : `background:linear-gradient(135deg,${p.gradient[0]},${p.gradient[1]})`;
  return `<div class="mini-avatar" style="${bg}">${p.avatarUrl?'':p.initial}</div>`;
}
function renderMatches(){
  const incoming=incomingLikes();
  const matched=mutualMatches();
  let html='<div class="match-tools"><button class="ghost small-control" id="resetConnections">Reset likes & matches</button></div>';
  if(incoming.length){
    html += `<div class="match-section"><h3>Liked you</h3>${incoming.map(p=>`<article class="match-card incoming-like">${miniAvatarMarkup(p)}<div><h3>${p.name}${p.age?`, ${p.age}`:''}</h3><p>${p.distanceLabel || 'Nearby'} • ${p.mutual[0] || 'Vault compatibility'}</p></div><div class="match-actions"><button class="primary match-action accept-like" data-key="${personKey(p)}">Like back</button><button class="ghost match-action ignore-like" data-key="${personKey(p)}">Ignore</button></div></article>`).join('')}</div>`;
  }
  if(matched.length){
    html += `<div class="match-section"><h3>Matches</h3>${matched.map(p=>`<article class="match-card">${miniAvatarMarkup(p)}<div><h3>${p.name}${p.age?`, ${p.age}`:''}</h3><p>${p.distanceLabel || 'Nearby'} • ${p.mutual[0] || 'Vault compatibility'}</p></div><div class="match-actions"><span class="score-badge">${p.score}%</span><button class="ghost match-action open-chat" data-key="${personKey(p)}">Chat</button><button class="danger match-action unmatch" data-key="${personKey(p)}">Unmatch</button></div></article>`).join('')}</div>`;
  }
  if(!incoming.length && !matched.length){
    html += '<div class="empty-state"><h3>No matches yet</h3><p>When someone likes you, they will appear here. Like them back to open a chat.</p></div>';
  }
  $('#matchesList').innerHTML = html;
  $('#resetConnections')?.addEventListener('click', resetConnections);
  $$('.accept-like').forEach(btn=>btn.onclick=()=>acceptLike(btn.dataset.key));
  $$('.ignore-like').forEach(btn=>btn.onclick=()=>ignoreLike(btn.dataset.key));
  $$('.unmatch').forEach(btn=>btn.onclick=()=>unmatch(btn.dataset.key));
  $$('.open-chat').forEach(btn=>btn.onclick=()=>openChat(btn.dataset.key));
}
function renderChats(){
  const matched=mutualMatches();
  if(supa && authUser){ matched.forEach(p=>{ const k=personKey(p); if(!chatCache[k]) loadChatMessages(k, true).then(()=>renderChats()); }); }
  $('#chatList').innerHTML= matched.length ? matched.map(p=>`<article class="chat-row" data-key="${personKey(p)}">${miniAvatarMarkup(p)}<div><h3>${p.name}</h3><p>${chatPreview(p)}</p></div></article>`).join('') : '<div class="empty-state"><h3>No conversations yet</h3><p>Chats appear only after both people like each other.</p></div>';
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
  }catch(err){ console.warn('Could not load chat messages', err); if(!quiet) showToast('Could not load messages. Check message schema/RLS.'); return getCachedChat(key); }
}
async function deleteConversationMessages(key){
  if(!supa || !authUser || !key) return;
  try{
    const me=authUser.id;
    const other=String(key);
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
  $('#chatPerson').innerHTML=`${miniAvatarMarkup(p)}<div><h3>${p.name}</h3><p>${p.distanceLabel || 'Matched'}</p></div>`;
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
  $('#chatMessages').innerHTML = `<div class="chat-bubble system">${starter}</div>` + msgs.map(m=>`<div class="chat-bubble ${m.from==='me'?'mine':'theirs'}">${escapeHtml(m.text)}<span>${new Date(m.at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}</span></div>`).join('');
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
  }catch(err){ console.warn('Message send failed', err); showToast('Message failed. Run the updated message SQL schema.'); }
  finally{ if(sendBtn) sendBtn.disabled = false; }
}
function startChatAutoRefresh(){
  stopChatAutoRefresh();
  if(!supa || !authUser || !activeChatKey) return;
  chatRefreshTimer=setInterval(async()=>{
    if(document.hidden || !activeChatKey) return;
    await loadChatMessages(activeChatKey, true);
    renderChatMessages();
    renderChats();
  }, CHAT_REFRESH_MS);
}
function stopChatAutoRefresh(){
  if(chatRefreshTimer) clearInterval(chatRefreshTimer);
  chatRefreshTimer=null;
}
function escapeHtml(v){ return String(v ?? '').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }

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
  if(!supa){ showToast('Supabase unavailable.'); return; }
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
    showToast(seedDefaults ? 'Default Vault config seeded.' : 'Admin changes saved.');
  }catch(err){ console.warn(err); showToast('Admin save failed. Check schema/RLS.'); }
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
  const avatarStyle=p.avatarUrl ? `background-image:url('${String(p.avatarUrl).replace(/'/g,'%27')}')` : `background:linear-gradient(135deg,${p.gradient[0]},${p.gradient[1]})`;
  const heroBg=p.avatarUrl ? `background:linear-gradient(180deg,rgba(10,6,16,.05),rgba(10,6,16,.88)), url('${String(p.avatarUrl).replace(/'/g,'%27')}') center/cover` : `background:radial-gradient(circle at 25% 20%,${p.gradient[0]},transparent 38%),linear-gradient(135deg,${p.gradient[1]},#150a25 72%)`;
  $('#memberProfileBody').innerHTML=`
    <div class="member-hero modern-member-hero" style="${heroBg}">
      <div class="member-hero-shade"></div>
      <div class="member-avatar-large" style="${avatarStyle}">${p.avatarUrl?'':escapeHtml(p.initial)}</div>
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
  let html='<div class="match-tools"><button id="resetConnections" class="ghost small-control" type="button">Reset testing likes</button></div>';
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
  $('#resetConnections')?.addEventListener('click', resetConnections);
  $$('.accept-like').forEach(btn=>btn.onclick=()=>acceptLike(btn.dataset.key));
  $$('.ignore-like').forEach(btn=>btn.onclick=()=>ignoreLike(btn.dataset.key));
  $$('.unmatch').forEach(btn=>btn.onclick=()=>unmatch(btn.dataset.key));
  $$('.open-chat').forEach(btn=>btn.onclick=()=>openChat(btn.dataset.key));
  $$('.view-profile').forEach(btn=>btn.onclick=()=>openMemberProfile(btn.dataset.key));
}

function renderChats(){
  const matched=mutualMatches();
  if(supa && authUser){ matched.forEach(p=>{ const k=personKey(p); if(!chatCache[k]) loadChatMessages(k, true).then(()=>renderChats()); }); }
  $('#chatList').innerHTML= matched.length ? matched.map(p=>`<article class="chat-row" data-key="${personKey(p)}">${miniAvatarMarkup(p)}<div><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(chatPreview(p))}</p></div><button class="ghost mini-profile-open" data-profile-key="${personKey(p)}" type="button">Profile</button></article>`).join('') : '<div class="empty-state"><h3>No conversations yet</h3><p>Chats appear only after both people like each other.</p></div>';
  $$('.chat-row').forEach(row=>row.onclick=(e)=>{ if(e.target.closest('[data-profile-key]')) return; openChat(row.dataset.key); });
  $$('[data-profile-key]').forEach(btn=>btn.onclick=(e)=>{e.stopPropagation(); openMemberProfile(btn.dataset.profileKey);});
}

async function cleanupExpiredMessages(){
  // Do not aggressively delete during normal reads; only prune rows already past expiry.
  if(!supa || !authUser) return;
  try{ await supa.from('fv_messages').delete().lt('expires_at', new Date(Date.now()-60000).toISOString()); }catch(err){ console.warn('Expired message cleanup failed', err); }
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

async function signedMediaItems(media=[]){
  if(!supa || !Array.isArray(media)) return [];
  const now=Date.now();
  const out=[];
  for(const item of media){
    if(item?.expires_at && new Date(item.expires_at).getTime() <= now) continue;
    if(!item?.path) continue;
    const cacheKey = `${item.path}|${item.expires_at || ''}`;
    const cached = signedMediaUrlCache.get(cacheKey);
    if(cached?.signedUrl && cached.validUntil > now + 60000){
      out.push({...item, signedUrl:cached.signedUrl});
      continue;
    }
    try{
      const expiresIn=Math.max(300, Math.min(3600, Math.floor(((new Date(item.expires_at||Date.now()+3600000)).getTime()-now)/1000)));
      const {data,error}=await supa.storage.from(CHAT_MEDIA_BUCKET).createSignedUrl(item.path, expiresIn);
      if(error) throw error;
      const signedUrl=data.signedUrl;
      signedMediaUrlCache.set(cacheKey, {signedUrl, validUntil: now + expiresIn*1000});
      out.push({...item, signedUrl});
    }catch(err){ console.warn('Could not sign media URL', err); }
  }
  return out;
}

async function loadChatMessages(key, quiet=true){
  if(!supa || !authUser || !key){ setCachedChat(key, []); return []; }
  try{
    const me=authUser.id;
    const other=String(key);
    const {data,error}=await supa
      .from('fv_messages')
      .select('id,sender_id,recipient_id,body,message_type,media,created_at,expires_at')
      .or(`and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`)
      .gt('expires_at', new Date().toISOString())
      .order('created_at',{ascending:true})
      .limit(120);
    if(error) throw error;
    const mapped=[];
    for(const m of (data||[])){
      mapped.push({
        id:m.id,
        from:m.sender_id===me?'me':'them',
        text:m.body || '',
        type:m.message_type || 'text',
        media: await signedMediaItems(m.media || []),
        at:m.created_at,
        expiresAt:m.expires_at
      });
    }
    const before=JSON.stringify(getCachedChat(key));
    setCachedChat(key, mapped);
    if(!quiet && before !== JSON.stringify(mapped)) renderChats();
    return mapped;
  }catch(err){ console.warn('Could not load chat messages', err); if(!quiet) showToast('Could not load messages. Check message schema/RLS.'); return getCachedChat(key); }
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
  return `<div class="private-media-grid ${items.length>1?'album':''}">${items.map(item=>item.signedUrl?`<a href="${item.signedUrl}" target="_blank" rel="noopener" class="private-media-thumb"><img src="${item.signedUrl}" alt="Private shared photo"><span>Expires ${timeUntil(item.expires_at || m.expiresAt)}</span></a>`:`<div class="private-media-thumb expired"><span>Photo unavailable</span></div>`).join('')}</div>`;
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
  }catch(err){ console.warn('Message send failed', err); showToast('Message failed. Run the updated message SQL schema.'); }
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
  try{
    const conv=conversationIdFor(activeChatKey).replace(/[^a-zA-Z0-9_-]/g,'_');
    const uploaded=[];
    for(const file of files.slice(0,8)){
      if(!file.type.startsWith('image/')) continue;
      if(file.size > 8*1024*1024){ showToast('One photo was over 8MB and skipped.'); continue; }
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
      const path=`${authUser.id}/${conv}/${crypto.randomUUID()}.${ext}`;
      const {error}=await supa.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, {cacheControl:'3600', upsert:false, contentType:file.type});
      if(error) throw error;
      uploaded.push({path,name:file.name,type:file.type,size:file.size,expires_at:expiresAt});
    }
    if(!uploaded.length) return;
    const payload={sender_id:authUser.id,recipient_id:String(activeChatKey),conversation_id:conversationIdFor(activeChatKey),body:`📷 Private photo${uploaded.length>1?' album':''}`,message_type:'photo',media:uploaded,expires_at:expiresAt};
    const {error}=await supa.from('fv_messages').insert(payload);
    if(error) throw error;
    if(input) input.value='';
    await loadChatMessages(activeChatKey, true);
    renderChatMessages(); renderChats();
    showToast(`Private photo${uploaded.length>1?'s':''} sent. Expires in ${expiryKey==='default'?'72h':$('#chatExpiry')?.selectedOptions?.[0]?.textContent || '72h'}.`);
  }catch(err){ console.warn('Private photo send failed', err); showToast('Photo failed. Run updated SQL and create the private chat bucket.'); }
}


/* =========================================================
   Afterglow patch: Daily Glow Coins, dynamic Vault prompts,
   and desktop-only Admin Studio. Additive / non-destructive.
   ========================================================= */

const DAILY_GLOW_REWARDS = [5,10,15,15,20,20,50];
function todayKey(){ return new Date().toISOString().slice(0,10); }
function yesterdayKey(){ const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
function ensureRewards(){
  if(!state.rewards || typeof state.rewards !== 'object') state.rewards = {glowCoins:0, streak:0, lastClaimDate:'', claimedToday:false};
  state.rewards.glowCoins = Number(state.rewards.glowCoins || 0);
  state.rewards.streak = Number(state.rewards.streak || 0);
  state.rewards.lastClaimDate = state.rewards.lastClaimDate || '';
  state.rewards.claimedToday = state.rewards.lastClaimDate === todayKey();
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
  if(row){ row.innerHTML=DAILY_GLOW_REWARDS.map((n,i)=>`<span class="streak-dot ${(r.streak||0)>i?'done':''} ${(r.streak||0)===i+1?'current':''}"><b>${i+1}</b><small>${n}</small></span>`).join(''); }
  const gift=$('#dailyGift'); if(gift){ gift.classList.toggle('claimable', !r.claimedToday); gift.title=`Glow Coins: ${r.glowCoins}`; }
}
async function claimDailyGift(){
  const r=ensureRewards();
  if(r.claimedToday){ showToast('Daily gift already claimed.'); return; }
  const last=r.lastClaimDate;
  const continuing = last === yesterdayKey();
  r.streak = continuing ? Math.min((r.streak||0)+1, 7) : 1;
  const reward=DAILY_GLOW_REWARDS[Math.min(r.streak,7)-1];
  r.glowCoins += reward;
  r.lastClaimDate = todayKey();
  r.claimedToday = true;
  state.profile.rewards = r;
  save();
  renderDailyGift();
  await syncToSupabase(false);
  showToast(`You earned ${reward} Glow Coins.`);
}
function openDailyGift(){ renderDailyGift(); $('#dailyModal')?.classList.remove('hidden'); }
function closeDailyGift(){ $('#dailyModal')?.classList.add('hidden'); }

function ratingKey(v){ return (typeof v === 'object' && v) ? (v.key ?? v.value ?? '') : v; }
function ratingText(v){ return (typeof v === 'object' && v) ? (v.text ?? v.value ?? v.key ?? '') : v; }
function cardAnswerOptions(card){
  const mode=card?.answerMode || card?.mode || 'global';
  if(mode === 'yesno') return {yes:'✅ Yes', no:'🙅 No'};
  if(mode === 'custom' && card?.answers && typeof card.answers === 'object') return card.answers;
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
  $('#passBtn').onclick=()=>act('pass'); $('#likeBtn').onclick=()=>act('like'); $('#vaultBtn').onclick=()=>{showToast('Mutual Vault details unlock after a match.'); showScreen('vault');};
  const exportData=$('#exportData'); if(exportData) exportData.onclick=()=>{const box=$('#exportBox'); if(box) box.textContent=JSON.stringify(state,null,2);};
  $('#googleLogin').onclick=signInWithGoogle;
  $('#signOut').onclick=signOut;
  const syncNow=$('#syncNow'); if(syncNow) syncNow.onclick=()=>syncToSupabase(true);
  const saveProfileBtn=$('#saveProfile'); if(saveProfileBtn) saveProfileBtn.onclick=saveProfileManually;
  const avatarUpload=$('#avatarUpload'); if(avatarUpload) avatarUpload.onchange=e=>handleAvatarUpload(e.target.files?.[0]);
  const removeAvatar=$('#removeAvatar'); if(removeAvatar) removeAvatar.onclick=()=>{state.profile.avatarUrl=''; updateAvatar(); save(); showToast('Photo removed.');};
  const adminSeed=$('#adminSeed'); if(adminSeed) adminSeed.onclick=()=>saveAdminConfig(true);
  const adminReload=$('#adminReload'); if(adminReload) adminReload.onclick=()=>loadAdminConfig();
  const adminSave=$('#adminSave'); if(adminSave) adminSave.onclick=()=>saveAdminConfig(false);
  const adminResetDefaults=$('#adminResetDefaults'); if(adminResetDefaults) adminResetDefaults.onclick=resetAdminEditorsToDefaults;
  ['displayName','headline','city','sex','radius','lookingFor','interests','bio'].forEach(id=>{const el=$('#'+id); if(el){ el.value=state.profile[id]||''; el.oninput=e=>{state.profile[id]=e.target.value; updateAvatar(); save();}; }});
  $('#searchCards').oninput=renderVault; $('#categoryFilter').onchange=renderVault;
  ensureRewards(); renderDailyGift(); applyAdminConfig(currentAdminConfig(), false); populateCats(); updateAvatar(); renderStack(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); initAuth().then(()=>{ ensureRewards(); renderDailyGift(); updateGateUi(); if(canEnter()) openApp(); syncToSupabase(false); });
}

init();

/* =========================================================
   Afterglow patch: Glow Shop, wallet header, and cosmetic inventory
   Additive only. Uses profile JSON for now so no destructive schema changes.
   ========================================================= */
const SHOP_ITEMS = [
  {id:'frame-neon',cat:'Profile',icon:'💖',title:'Neon Profile Ring',desc:'Adds a hot pink glow around your profile photo.',price:35,type:'avatarFrame',value:'frame-neon',featured:true},
  {id:'frame-gold',cat:'Profile',icon:'🌟',title:'Gold Profile Ring',desc:'A warm golden ring for a premium-looking profile.',price:45,type:'avatarFrame',value:'frame-gold'},
  {id:'frame-rainbow',cat:'Profile',icon:'🌈',title:'Rainbow Profile Ring',desc:'A colorful ring for playful, expressive profiles.',price:65,type:'avatarFrame',value:'frame-rainbow'},
  {id:'theme-midnight',cat:'Themes',icon:'🌙',title:'Midnight Banner',desc:'Unlocks a deep midnight profile banner.',price:25,type:'profileTheme',value:'theme-midnight'},
  {id:'theme-rose-gold',cat:'Themes',icon:'🌹',title:'Rose Gold Banner',desc:'A soft rose-gold gradient for your profile.',price:30,type:'profileTheme',value:'theme-rose-gold',featured:true},
  {id:'theme-cyber',cat:'Themes',icon:'⚡',title:'Cyber Glow Banner',desc:'Electric blue and violet banner energy.',price:40,type:'profileTheme',value:'theme-cyber'},
  {id:'theme-velvet',cat:'Themes',icon:'🖤',title:'Dark Velvet Banner',desc:'A moody, intimate velvet profile vibe.',price:40,type:'profileTheme',value:'theme-velvet'},
  {id:'badge-early',cat:'Badges',icon:'🏆',title:'Early Glower Badge',desc:'A placeholder profile badge for early users.',price:50,type:'badge',value:'early-glower'},
  {id:'badge-streak',cat:'Badges',icon:'🔥',title:'Streak Keeper Badge',desc:'Show off that you keep coming back.',price:75,type:'badge',value:'streak-keeper'},
  {id:'chat-hearts',cat:'Chat',icon:'💕',title:'Heart Reaction Pack',desc:'Placeholder chat reaction pack for future message effects.',price:20,type:'chatPack',value:'chat-hearts'},
  {id:'chat-fire',cat:'Chat',icon:'🔥',title:'Fire Reaction Pack',desc:'Placeholder spicy reaction pack for matched chats.',price:20,type:'chatPack',value:'chat-fire'},
  {id:'vault-spark',cat:'Vault',icon:'✨',title:'Spark Vault Cards',desc:'Placeholder cosmetic style for Vault cards.',price:30,type:'vaultStyle',value:'vault-spark'},
  {id:'vault-gold',cat:'Vault',icon:'🔐',title:'Gold Vault Accent',desc:'Placeholder premium accent for Vault compatibility cards.',price:45,type:'vaultStyle',value:'vault-gold'},
  {id:'sticker-flirt',cat:'Stickers',icon:'😏',title:'Flirty Sticker Pack',desc:'Placeholder sticker pack for future chat media.',price:25,type:'stickerPack',value:'flirty'},
  {id:'sticker-soft',cat:'Stickers',icon:'🥰',title:'Soft Romance Stickers',desc:'Placeholder sticker pack for warm, sweet chats.',price:25,type:'stickerPack',value:'soft-romance'}
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
    grid.innerHTML=items.map(item=>`<article class="shop-card ${isShopOwned(item.id)?'owned':''} ${isShopEquipped(item)?'equipped':''}"><div class="shop-icon">${item.icon}</div><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.desc)}</p><div class="shop-meta"><span class="price-badge">🪙 ${item.price}</span>${isShopOwned(item.id)?'<span class="owned-badge">Owned</span>':''}${isShopEquipped(item)?'<span class="equipped-badge">Equipped</span>':''}${shopButtonHtml(item)}</div></div></article>`).join('') || '<div class="empty-state"><h3>No shop items yet</h3><p>More earned unlocks will appear here soon.</p></div>';
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
  const {rewards, inventory}=ensureEconomy();
  if(isShopOwned(id)) return equipShopItem(id);
  if((rewards.glowCoins||0) < item.price) return showToast('Not enough Glow Coins yet. Claim daily gifts to earn more.');
  rewards.glowCoins -= item.price;
  inventory.owned.push(id);
  if(['avatarFrame','profileTheme'].includes(item.type)) inventory.equipped[item.type]=item.value;
  state.profile.rewards=rewards; state.profile.inventory=inventory;
  updateAvatar(); save(); renderShop();
  await syncToSupabase(false);
  showToast(`Unlocked ${item.title}.`);
}
async function equipShopItem(id){
  const item=SHOP_ITEMS.find(i=>i.id===id); if(!item) return;
  const {inventory}=ensureEconomy();
  if(!isShopOwned(id)) return buyShopItem(id);
  if(['avatarFrame','profileTheme'].includes(item.type)) inventory.equipped[item.type]=item.value;
  state.profile.inventory=inventory;
  updateAvatar(); save(); renderShop();
  await syncToSupabase(false);
  showToast(`${item.title} equipped.`);
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
    return `<button class="admin-list-item ${row.user_id===adminSelectedUserId?'selected':''}" type="button" data-admin-user-id="${adminEscape(row.user_id)}">
      <span class="admin-list-emoji">🪙</span>
      <span><b>${name}</b><small>${email}</small></span>
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
  box.innerHTML=`<b>${adminEscape(adminUserName(row))}</b><span>${adminEscape(row.email||'No email')}</span><div class="admin-user-meta"><small>User ID: ${adminEscape(String(row.user_id||'').slice(0,8))}…</small></div><strong>${adminUserCoins(row)} Glow Coins</strong>`;
}
function selectAdminUser(userId){
  adminSelectedUserId=userId;
  renderAdminUsers();
}
async function loadAdminUsers(){
  if(!isAdmin()) return;
  if(!supa || !authUser){ showToast('Supabase unavailable.'); return; }
  try{
    const {data,error}=await supa.from('fv_profiles').select('id,user_id,email,profile,updated_at').order('updated_at',{ascending:false}).limit(250);
    if(error) throw error;
    adminUsers=data||[];
    if(adminSelectedUserId && !adminUsers.some(r=>r.user_id===adminSelectedUserId)) adminSelectedUserId=null;
    renderAdminUsers();
  }catch(err){ console.warn('Admin users load failed',err); showToast('Could not load users. Run the updated SQL admin wallet policy.'); }
}
async function adjustAdminUserCoins({setExact=false}={}){
  if(!isAdmin()) return showToast('Admin access is restricted.');
  const row=(adminUsers||[]).find(r=>r.user_id===adminSelectedUserId);
  if(!row) return showToast('Select a user first.');
  const amount=Number($('#adminCoinAmount')?.value || 0);
  if(!Number.isFinite(amount)) return showToast('Enter a valid coin amount.');
  const profile={...(row.profile||{})};
  const rewards={...(profile.rewards||{})};
  const current=Number(rewards.glowCoins||0);
  rewards.glowCoins=Math.max(0, Math.round(setExact ? amount : current + amount));
  rewards.adminLastAdjustment={
    by:authUser.email,
    amount:setExact ? rewards.glowCoins-current : amount,
    mode:setExact?'set':'adjust',
    reason:($('#adminCoinReason')?.value||'').trim(),
    at:new Date().toISOString()
  };
  profile.rewards=rewards;
  try{
    const {error}=await supa.from('fv_profiles').update({profile,updated_at:new Date().toISOString()}).eq('user_id',row.user_id);
    if(error) throw error;
    row.profile=profile;
    if(row.user_id===authUser.id){ state.rewards=rewards; state.profile.rewards=rewards; save(); updateGlowCoinDisplays(); renderDailyGift(); renderShop(); }
    $('#adminCoinAmount').value='';
    renderAdminUsers();
    showToast(`${adminUserName(row)} now has ${rewards.glowCoins} Glow Coins.`);
  }catch(err){ console.warn('Admin coin update failed',err); showToast('Coin update failed. Run updated SQL admin wallet policy.'); }
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

/* =========================================================
   Afterglow patch: incoming chat popups
   Additive only: detects new incoming messages during refresh
   and shows a small in-app notification without changing storage.
   ========================================================= */
(function(){
  if(typeof loadChatMessages !== 'function') return;
  const baseLoadChatMessages = loadChatMessages;
  const primedKeys = new Set();
  const seenStorageKey = () => `afterglowSeenIncoming:${authUser?.id || 'guest'}`;
  function readSeenIncoming(){
    try{ return new Set(JSON.parse(localStorage.getItem(seenStorageKey()) || '[]')); }
    catch{ return new Set(); }
  }
  function writeSeenIncoming(ids){
    try{ localStorage.setItem(seenStorageKey(), JSON.stringify([...ids].slice(-500))); }catch{}
  }
  function messageFingerprint(m){
    return String(m?.id || `${m?.from || ''}|${m?.at || ''}|${m?.type || ''}|${m?.text || ''}`);
  }
  function incomingPreview(m){
    if(m?.type === 'photo') return 'sent you a private photo';
    const txt = String(m?.text || 'sent you a message').trim();
    return txt.length > 86 ? txt.slice(0,83) + '…' : txt;
  }
  function ensureChatNotifyStyles(){
    if(document.getElementById('afterglowChatNotifyStyles')) return;
    const style=document.createElement('style');
    style.id='afterglowChatNotifyStyles';
    style.textContent=`
      .chat-notify-pop{position:fixed;left:50%;top:86px;transform:translateX(-50%) translateY(-12px);z-index:9999;width:min(92vw,390px);display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:22px;background:rgba(26,22,35,.94);border:1px solid rgba(255,255,255,.14);box-shadow:0 22px 60px rgba(0,0,0,.38);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);opacity:0;pointer-events:auto;cursor:pointer;transition:opacity .18s ease,transform .18s ease;}
      .chat-notify-pop.show{opacity:1;transform:translateX(-50%) translateY(0);}
      .chat-notify-pop .mini-avatar{width:42px;height:42px;min-width:42px;border-radius:16px;}
      .chat-notify-copy{min-width:0;flex:1;text-align:left;}
      .chat-notify-copy b{display:block;font-size:14px;line-height:1.15;color:#fff;}
      .chat-notify-copy span{display:block;margin-top:3px;font-size:12px;line-height:1.25;color:rgba(255,255,255,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .chat-notify-open{font-size:12px;color:#ffd37a;font-weight:800;white-space:nowrap;}
      @media (min-width:760px){.chat-notify-pop{top:24px;right:24px;left:auto;transform:translateY(-12px);}.chat-notify-pop.show{transform:translateY(0);}}
    `;
    document.head.appendChild(style);
  }
  function showIncomingChatPopup(key, msg){
    if(!msg || msg.from !== 'them' || document.hidden) return;
    const person = (typeof people !== 'undefined' ? people : []).find(p=>String(personKey(p))===String(key));
    const name = person?.name || 'New message';
    ensureChatNotifyStyles();
    document.querySelectorAll('.chat-notify-pop').forEach(n=>n.remove());
    const pop=document.createElement('button');
    pop.type='button';
    pop.className='chat-notify-pop';
    pop.innerHTML=`${person ? miniAvatarMarkup(person) : '<div class="mini-avatar">💬</div>'}<div class="chat-notify-copy"><b>${escapeHtml(name)}</b><span>${escapeHtml(incomingPreview(msg))}</span></div><div class="chat-notify-open">Open</div>`;
    pop.onclick=()=>{ pop.remove(); if(typeof openChat === 'function') openChat(key); };
    document.body.appendChild(pop);
    requestAnimationFrame(()=>pop.classList.add('show'));
    setTimeout(()=>{ pop.classList.remove('show'); setTimeout(()=>pop.remove(),220); }, 4200);
  }
  loadChatMessages = async function(key, quiet=true){
    const keyStr=String(key || '');
    const seen=readSeenIncoming();
    const wasPrimed=primedKeys.has(keyStr);
    const result=await baseLoadChatMessages(key, quiet);
    const msgs=(typeof getCachedChat === 'function' ? getCachedChat(key) : (result || [])) || [];
    const incoming=msgs.filter(m=>m && m.from === 'them');
    if(!wasPrimed){
      incoming.forEach(m=>seen.add(messageFingerprint(m)));
      primedKeys.add(keyStr);
      writeSeenIncoming(seen);
      return result;
    }
    const fresh=incoming.filter(m=>!seen.has(messageFingerprint(m)));
    incoming.forEach(m=>seen.add(messageFingerprint(m)));
    writeSeenIncoming(seen);
    if(fresh.length){
      const latest=fresh[fresh.length-1];
      showIncomingChatPopup(keyStr, latest);
      try{ if(typeof renderChats === 'function') renderChats(); }catch{}
    }
    return result;
  };
})();

/* =========================================================
   Afterglow patch: global notification service
   Additive only: keeps polling matched chats even when the
   message thread is closed, adds nav badges, and routes all
   incoming message/photo notices through the existing popup.
   ========================================================= */
(function(){
  const GLOBAL_NOTIFY_MS = 5000;
  let globalNotifyTimer = null;
  let globalNotifyStartedFor = '';
  let lastLikeKeys = new Set();
  let unreadByChat = {};
  const seenKey = () => `afterglowGlobalIncomingSeen:${authUser?.id || 'guest'}`;
  const unreadKey = () => `afterglowUnreadByChat:${authUser?.id || 'guest'}`;
  function readSet(){ try{return new Set(JSON.parse(localStorage.getItem(seenKey())||'[]'));}catch{return new Set();} }
  function writeSet(set){ try{localStorage.setItem(seenKey(), JSON.stringify([...set].slice(-800)));}catch{} }
  function readUnread(){ try{return JSON.parse(localStorage.getItem(unreadKey())||'{}')||{};}catch{return {};} }
  function writeUnread(){ try{localStorage.setItem(unreadKey(), JSON.stringify(unreadByChat));}catch{} }
  function msgId(m){ return String(m?.id || `${m?.from||''}|${m?.at||''}|${m?.type||''}|${m?.text||''}`); }
  function matchedConversationKeys(){
    try{ return (typeof mutualMatches === 'function' ? mutualMatches() : []).map(p=>String(personKey(p))).filter(Boolean); }
    catch{return [];}
  }
  function ensureBadgeStyles(){
    if(document.getElementById('afterglowGlobalBadgeStyles')) return;
    const st=document.createElement('style');
    st.id='afterglowGlobalBadgeStyles';
    st.textContent=`
      .tab{position:relative;}
      .nav-badge{position:absolute;top:6px;right:10px;min-width:17px;height:17px;padding:0 5px;border-radius:99px;background:linear-gradient(135deg,#ff3f91,#ffd37a);color:#160d18;font-size:10px;font-weight:900;line-height:17px;box-shadow:0 8px 18px rgba(255,63,145,.34);display:none;}
      .tab.has-badge .nav-badge{display:block;}
      .global-notice-pop{position:fixed;left:50%;top:86px;transform:translateX(-50%) translateY(-12px);z-index:10000;width:min(92vw,400px);display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:22px;background:rgba(26,22,35,.95);border:1px solid rgba(255,255,255,.14);box-shadow:0 22px 60px rgba(0,0,0,.38);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);opacity:0;pointer-events:auto;cursor:pointer;transition:opacity .18s ease,transform .18s ease;}
      .global-notice-pop.show{opacity:1;transform:translateX(-50%) translateY(0);}
      .global-notice-pop .mini-avatar{width:42px;height:42px;min-width:42px;border-radius:16px;}
      .global-notice-copy{min-width:0;flex:1;text-align:left;}
      .global-notice-copy b{display:block;font-size:14px;line-height:1.15;color:#fff;}
      .global-notice-copy span{display:block;margin-top:3px;font-size:12px;line-height:1.25;color:rgba(255,255,255,.72);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .global-notice-open{font-size:12px;color:#ffd37a;font-weight:900;white-space:nowrap;}
      @media (min-width:760px){.global-notice-pop{top:24px;right:24px;left:auto;transform:translateY(-12px);}.global-notice-pop.show{transform:translateY(0);}}
    `;
    document.head.appendChild(st);
  }
  function badgeFor(screen){
    const tab=document.querySelector(`.tab[data-screen="${screen}"]`);
    if(!tab) return null;
    let badge=tab.querySelector('.nav-badge');
    if(!badge){ badge=document.createElement('span'); badge.className='nav-badge'; tab.appendChild(badge); }
    return badge;
  }
  function totalUnread(){ return Object.values(unreadByChat||{}).reduce((a,b)=>a+Number(b||0),0); }
  function updateBadges(){
    ensureBadgeStyles();
    const chatCount=totalUnread();
    const chat=badgeFor('chat');
    if(chat){ chat.textContent=chatCount>9?'9+':String(chatCount); chat.closest('.tab')?.classList.toggle('has-badge', chatCount>0); }
    let likeCount=0;
    try{ likeCount=(typeof incomingLikes === 'function' ? incomingLikes() : []).length; }catch{}
    const match=badgeFor('matches');
    if(match){ match.textContent=likeCount>9?'9+':String(likeCount); match.closest('.tab')?.classList.toggle('has-badge', likeCount>0); }
  }
  function showGlobalNotice({kind='💬', title='Afterglow', body='New update', key='', action='Open', onClick=null}){
    if(document.hidden) return;
    ensureBadgeStyles();
    document.querySelectorAll('.global-notice-pop').forEach(n=>n.remove());
    let person=null;
    try{ person=(people||[]).find(p=>String(personKey(p))===String(key)); }catch{}
    const pop=document.createElement('button');
    pop.type='button';
    pop.className='global-notice-pop';
    pop.innerHTML=`${person ? miniAvatarMarkup(person) : `<div class="mini-avatar">${kind}</div>`}<div class="global-notice-copy"><b>${escapeHtml(title)}</b><span>${escapeHtml(body)}</span></div><div class="global-notice-open">${escapeHtml(action)}</div>`;
    pop.onclick=()=>{ pop.remove(); if(onClick) onClick(); else if(key && typeof openChat==='function') openChat(key); };
    document.body.appendChild(pop);
    requestAnimationFrame(()=>pop.classList.add('show'));
    setTimeout(()=>{ pop.classList.remove('show'); setTimeout(()=>pop.remove(),220); }, 4800);
  }
  // Wrap message loading so unread badges update no matter what triggered the load.
  if(typeof loadChatMessages === 'function' && !loadChatMessages.__afterglowGlobalWrapped){
    const baseLoad = loadChatMessages;
    loadChatMessages = async function(key, quiet=true){
      const keyStr=String(key||'');
      const seen=readSet();
      const result=await baseLoad(key, quiet);
      const msgs=(typeof getCachedChat==='function' ? getCachedChat(keyStr) : (result||[])) || [];
      const incoming=msgs.filter(m=>m && m.from==='them');
      const fresh=incoming.filter(m=>!seen.has(msgId(m)));
      incoming.forEach(m=>seen.add(msgId(m)));
      writeSet(seen);
      if(fresh.length && keyStr !== String(activeChatKey||'')){
        unreadByChat[keyStr]=(Number(unreadByChat[keyStr]||0)+fresh.length);
        writeUnread();
      }
      updateBadges();
      return result;
    };
    loadChatMessages.__afterglowGlobalWrapped = true;
  }
  // Wrap openChat so opening a conversation clears its unread badge.
  if(typeof openChat === 'function' && !openChat.__afterglowGlobalWrapped){
    const baseOpenChat = openChat;
    openChat = async function(key){
      const keyStr=String(key||'');
      unreadByChat[keyStr]=0;
      writeUnread();
      updateBadges();
      return baseOpenChat.apply(this, arguments);
    };
    openChat.__afterglowGlobalWrapped = true;
  }
  async function checkIncomingLikes(){
    let current=[];
    try{ current=(typeof incomingLikes==='function' ? incomingLikes() : []).map(p=>String(personKey(p))).filter(Boolean); }catch{}
    const currentSet=new Set(current);
    const added=current.filter(k=>!lastLikeKeys.has(k));
    lastLikeKeys=currentSet;
    updateBadges();
    if(added.length){
      const key=added[added.length-1];
      const p=(people||[]).find(x=>String(personKey(x))===key);
      showGlobalNotice({kind:'💞', title:'Someone liked you', body:p?`${p.name} wants to connect.`:'You have a new incoming like.', key, action:'View', onClick:()=>{ if(typeof showScreen==='function') showScreen('matches'); }});
    }
  }
  async function globalNotificationTick(){
    if(!authUser || !supa) return;
    try{
      if(typeof loadPeopleDirectory === 'function') await loadPeopleDirectory({preserveIndex:true, quiet:true});
      const keys=matchedConversationKeys();
      for(const k of keys){ await loadChatMessages(k, true); }
      await checkIncomingLikes();
      if(typeof renderChats === 'function') renderChats();
      if(typeof renderMatches === 'function') renderMatches();
    }catch(err){ console.warn('Global notification tick failed', err); }
  }
  function startGlobalNotifications(){
    if(!authUser || !supa) return;
    const id=authUser.id;
    if(globalNotifyTimer && globalNotifyStartedFor===id) return;
    stopGlobalNotifications();
    globalNotifyStartedFor=id;
    unreadByChat=readUnread();
    lastLikeKeys=new Set();
    ensureBadgeStyles();
    updateBadges();
    // Prime existing state without noisy historical notification, then monitor continuously.
    globalNotificationTick();
    globalNotifyTimer=setInterval(globalNotificationTick, GLOBAL_NOTIFY_MS);
  }
  function stopGlobalNotifications(){
    if(globalNotifyTimer) clearInterval(globalNotifyTimer);
    globalNotifyTimer=null;
    globalNotifyStartedFor='';
  }
  // Wrap auth/UI lifecycle where available.
  if(typeof openApp === 'function' && !openApp.__afterglowGlobalNotifyWrapped){
    const baseOpenApp=openApp;
    openApp=function(){ const r=baseOpenApp.apply(this,arguments); setTimeout(startGlobalNotifications,250); return r; };
    openApp.__afterglowGlobalNotifyWrapped=true;
  }
  if(typeof signOut === 'function' && !signOut.__afterglowGlobalNotifyWrapped){
    const baseSignOut=signOut;
    signOut=async function(){ stopGlobalNotifications(); return baseSignOut.apply(this,arguments); };
    signOut.__afterglowGlobalNotifyWrapped=true;
  }
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) globalNotificationTick(); });
  document.addEventListener('click',(e)=>{
    const tab=e.target.closest?.('.tab[data-screen="chat"]');
    if(tab){ unreadByChat={}; writeUnread(); updateBadges(); }
  });
  // Start shortly after this script runs if the user is already signed in.
  setTimeout(startGlobalNotifications,1200);
})();
