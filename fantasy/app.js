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
const KEY = 'fantasyVaultDatingV3';
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

const people = [
  {name:'Maya', age:29, distance:4, score:94, vibe:'Playful, open-minded, loves late-night chemistry', gradient:['#ff3f91','#8b5cff'], initial:'M', tags:['Night owl','Adventurous','Verified'], mutual:['🎭 Role-play themes','🗣️ Direct talk','🔒 Private photos']},
  {name:'Sasha', age:27, distance:12, score:86, vibe:'Sensual, romantic, curious, and emotionally warm', gradient:['#ff6b73','#ffd37a'], initial:'S', tags:['Romance','Curious','Local'], mutual:['💬 Praise','🫦 Sensory play','🌹 Soft romance']},
  {name:'Riley', age:35, distance:18, score:81, vibe:'Bold energy, honest conversations, mutual respect', gradient:['#ff3f91','#ff6b73'], initial:'R', tags:['Bold','Open-minded','Verified'], mutual:['⚡ Power exchange','✅ Check-ins','🔥 Teasing']},
  {name:'Avery', age:30, distance:24, score:78, vibe:'Warm, funny, privacy-focused, slow-burn chemistry', gradient:['#7c5cff','#ff3f91'], initial:'A', tags:['Private','Funny','Deep chat'], mutual:['🛑 Boundaries','⏳ Quality time','✍️ Fantasy writing']},
  {name:'Nova', age:33, distance:31, score:88, vibe:'Confident, flirt-forward, loves trying new things safely', gradient:['#57c8ff','#ff3f91'], initial:'N', tags:['Flirty','Verified','Spontaneous'], mutual:['😈 Spicy language','📍 Subtle public flirt','💞 Aftercare']}
];

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

function base(){return {ageOk:false, userId: getDeviceId(), profile:{displayName:'Brian',headline:'',city:'',radius:'25 miles',lookingFor:'Intimate connection',bio:'',avatarUrl:''}, ratings:{}, liked:[], passed:[], updatedAt:new Date().toISOString()};}
function getDeviceId(){let id=localStorage.getItem('fvDeviceId'); if(!id){id='local-'+crypto.randomUUID(); localStorage.setItem('fvDeviceId',id);} return id;}
function load(){try{return {...base(), ...(JSON.parse(localStorage.getItem(KEY))||{})}}catch{return base()}}
function save(){state.updatedAt=new Date().toISOString(); localStorage.setItem(KEY, JSON.stringify(state)); renderVaultStats(); renderMatches(); renderChats(); debounceSync();}
let syncTimer=null; function debounceSync(){clearTimeout(syncTimer); syncTimer=setTimeout(()=>syncToSupabase(false),700);}

async function syncToSupabase(show=true){
  if(bootingRemote) return;
  if(!supa){setSync('local fallback'); if(show) showToast('Supabase unavailable; saved locally.'); return;}
  if(!authUser){setSync('local only — sign in to sync'); if(show) showToast('Sign in with Google before syncing.'); return;}
  try{
    const payload={
      user_id: authUser.id,
      email: authUser.email || null,
      profile:state.profile,
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
      state = {...state, profile:{...state.profile,...(data.profile||{})}, ratings:data.ratings||{}, liked:data.liked||[], passed:data.passed||[], userId:authUser.id};
      localStorage.setItem(KEY, JSON.stringify(state));
      hydrateProfileForm(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); renderStack();
      setSync('loaded from Supabase');
    }else{
      state.userId = authUser.id;
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
  console.log('[Fantasy Vault] OAuth redirectTo:', redirectTo);
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
  localStorage.removeItem('fvDeviceId');
  state = load();
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
    state.ageOk = true;
    state.userId = authUser.id;
    localStorage.setItem(KEY, JSON.stringify(state));
    await loadRemoteProfile();
    await loadAdminConfig();
    openApp();
  }
  supa.auth.onAuthStateChange(async (event, session)=>{
    authUser=session?.user || null;
    updateAuthUi();
    if(event === 'SIGNED_IN' && authUser){
      state.ageOk = true;
      state.userId = authUser.id;
      await loadRemoteProfile();
      await loadAdminConfig();
      save();
      openApp();
      showToast('Google login connected.');
    }
    if(event === 'SIGNED_OUT'){ setSync('local only — signed out'); }
  });
}

function setSync(text){const el=$('#syncStatus'); if(el) el.textContent=text;}


function hydrateProfileForm(){
  ['displayName','headline','city','radius','lookingFor','bio'].forEach(id=>{const el=$('#'+id); if(el) el.value=state.profile[id]||'';});
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
  $('#resetDemo').onclick=()=>{localStorage.removeItem(KEY); location.reload();};
  $('#exportData').onclick=()=>$('#exportBox').textContent=JSON.stringify(state,null,2);
  $('#googleLogin').onclick=signInWithGoogle;
  $('#signOut').onclick=signOut;
  $('#syncNow').onclick=()=>syncToSupabase(true);
  const avatarUpload=$('#avatarUpload'); if(avatarUpload) avatarUpload.onchange=e=>handleAvatarUpload(e.target.files?.[0]);
  const removeAvatar=$('#removeAvatar'); if(removeAvatar) removeAvatar.onclick=()=>{state.profile.avatarUrl=''; updateAvatar(); save(); showToast('Photo removed.');};
  const adminSeed=$('#adminSeed'); if(adminSeed) adminSeed.onclick=()=>saveAdminConfig(true);
  const adminReload=$('#adminReload'); if(adminReload) adminReload.onclick=()=>loadAdminConfig();
  const adminSave=$('#adminSave'); if(adminSave) adminSave.onclick=()=>saveAdminConfig(false);
  const adminResetDefaults=$('#adminResetDefaults'); if(adminResetDefaults) adminResetDefaults.onclick=resetAdminEditorsToDefaults;
  ['displayName','headline','city','radius','lookingFor','bio'].forEach(id=>{const el=$('#'+id); el.value=state.profile[id]||''; el.oninput=e=>{state.profile[id]=e.target.value; updateAvatar(); save();};});
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
function orderedPeople(){ let arr=[...people]; if(mode==='nearby') arr.sort((a,b)=>a.distance-b.distance); if(mode==='compatible') arr.sort((a,b)=>b.score-a.score); if(mode==='new') arr.reverse(); return arr.filter(p=>!state.passed.includes(p.name)); }
function renderStack(){
  const arr=orderedPeople(); if(index>=arr.length) index=0; const p=arr[index];
  if(!p){ $('#cardStack').innerHTML='<div class="empty-state">No more local profiles in this demo.</div>'; return; }
  $('#cardStack').innerHTML=`<article class="person-card">
    <div class="person-photo" style="background:linear-gradient(145deg,${p.gradient[0]},${p.gradient[1]})"><span class="distance">📍 ${p.distance} mi away</span><span class="verified">✓ verified</span><div class="fake-face">${p.initial}</div></div>
    <div class="person-info"><div class="name-row"><h2>${p.name}, ${p.age}</h2><strong>${p.score}%</strong></div><p class="headline">${p.vibe}</p><div class="chips">${p.tags.map(t=>`<span class="chip">${t}</span>`).join('')}</div><div class="mutual-box"><b>${p.mutual.length} mutual Vault signals:</b><br>${p.mutual.join(' • ')}</div></div>
  </article>`;
}
function act(type){ const arr=orderedPeople(); const p=arr[index]; if(!p)return; if(type==='like'&&!state.liked.includes(p.name)){state.liked.push(p.name); showToast(`Liked ${p.name}. Match preview added.`);} if(type==='pass'&&!state.passed.includes(p.name)){state.passed.push(p.name); showToast(`Passed on ${p.name}.`);} index++; save(); renderStack(); }
function showToast(msg){ const old=$('.toast'); if(old)old.remove(); const t=document.createElement('div'); t.className='toast'; t.textContent=msg; $('.phone').appendChild(t); setTimeout(()=>t.remove(),2100); }
function populateCats(){ const cats=[...new Set(vaultCards.map(c=>c.cat))].sort(); $('#categoryFilter').innerHTML='<option value="all">🌈 All</option>'+cats.map(c=>`<option value="${c}">${categoryMeta[c]?.emoji||'✨'} ${c}</option>`).join(''); }
function renderVault(){
  const q=$('#searchCards').value.toLowerCase(); const cat=$('#categoryFilter').value;
  const list=vaultCards.filter(c=>(cat==='all'||c.cat===cat)&&(!q||`${c.title} ${c.desc} ${c.cat}`.toLowerCase().includes(q)));
  $('#cards').innerHTML=list.map(card=>{const cur=state.ratings[card.id]; const meta=categoryMeta[card.cat]||{emoji:'✨', theme:'theme-fantasy'}; return `<article class="vcard ${meta.theme}"><div class="vcard-top"><span class="cat-badge">${meta.emoji} ${card.cat}</span><span class="rating-badge">${cur?labels[cur]:'❔ Unanswered'}</span></div><h3>${card.title}</h3><p>${card.desc}</p><div class="answers">${Object.entries(labels).map(([k,v])=>`<button class="answer-btn ${cur===k?'selected':''}" data-id="${card.id}" data-answer="${k}">${v}</button>`).join('')}</div></article>`}).join('');
  $$('.answer-btn').forEach(b=>b.onclick=()=>{state.ratings[b.dataset.id]=b.dataset.answer; save(); renderVault();});
}
function renderVaultStats(){ const vals=Object.values(state.ratings); $('#ratedCount').textContent=vals.length; $('#limitCount').textContent=vals.filter(v=>v==='limit').length; $('#vaultPct').textContent=(vaultCards.length?Math.round(vals.length/vaultCards.length*100):0)+'%'; }
function renderMatches(){ const liked=people.filter(p=>state.liked.includes(p.name)); $('#matchesList').innerHTML=(liked.length?liked:people.slice(0,3)).map(p=>`<article class="match-card"><div class="mini-avatar" style="background:linear-gradient(135deg,${p.gradient[0]},${p.gradient[1]})">${p.initial}</div><div><h3>${p.name}, ${p.age}</h3><p>${p.distance} miles away • ${p.mutual[0]} + more</p></div><span class="score-badge">${p.score}%</span></article>`).join(''); }
function renderChats(){ const liked=people.filter(p=>state.liked.includes(p.name)); const rows=(liked.length?liked:people.slice(0,3)); $('#chatList').innerHTML=rows.map(p=>`<article class="chat-row"><div class="mini-avatar" style="background:linear-gradient(135deg,${p.gradient[0]},${p.gradient[1]})">${p.initial}</div><div><h3>${p.name}</h3><p>You both marked ${p.mutual[0]} as compatible. Try asking what makes it exciting.</p></div></article>`).join(''); }

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

init();
