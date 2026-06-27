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

const categoryMeta = {
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

const vaultCards = [
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

const labels = {love:'😍 Love', enjoy:'😏 Enjoy', curious:'👀 Curious', neutral:'😌 Neutral', no:'🙅 No', limit:'🛑 Limit'};
let index = 0;
let mode = 'nearby';
let state = load();
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function base(){return {ageOk:false, userId: getDeviceId(), profile:{displayName:'Brian',headline:'',city:'',radius:'25 miles',lookingFor:'Intimate connection',bio:''}, ratings:{}, liked:[], passed:[], updatedAt:new Date().toISOString()};}
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
      user_key: authUser.id,
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

function authRedirectUrl(){
  // Always return to the exact page the user is currently on.
  // This prevents a stale config.js or Supabase Site URL from sending hosted builds to localhost.
  if(location.protocol === 'file:') return window.location.href.split('#')[0];
  const cleanPath = window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/';
  return window.location.origin + cleanPath;
}

async function signInWithGoogle(){
  if(!supa){ showToast('Supabase is not available. Check config.js.'); return; }
  const redirectTo = authRedirectUrl();
  console.log('[Fantasy Vault] Google OAuth redirectTo:', redirectTo);
  const {error}=await supa.auth.signInWithOAuth({
    provider:'google',
    options:{ redirectTo, queryParams:{ prompt:'select_account' } }
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
}

function updateGateUi(){
  const ageConfirm=$('#ageConfirm');
  const gateLogin=$('#googleGate');
  const gateEnter=$('#enterApp');
  const gateSignOut=$('#gateSignOut');
  const confirmed = !!ageConfirm?.checked || !!state.ageOk;
  if(ageConfirm) ageConfirm.checked = confirmed;
  if(gateLogin){
    gateLogin.disabled = !confirmed || !!authUser;
    gateLogin.classList.toggle('hidden', !!authUser);
  }
  if(gateEnter) gateEnter.classList.toggle('hidden', !(confirmed && !!authUser));
  if(gateSignOut) gateSignOut.classList.toggle('hidden', !authUser);
}

function canEnter(){ return !!state.ageOk && !!authUser; }

async function initAuth(){
  if(!supa){ updateAuthUi(); return; }
  const {data}=await supa.auth.getSession();
  authUser=data?.session?.user || null;
  updateAuthUi();
  if(authUser) await loadRemoteProfile();
  supa.auth.onAuthStateChange(async (event, session)=>{
    authUser=session?.user || null;
    updateAuthUi();
    if(event === 'SIGNED_IN' && authUser){ state.userId=authUser.id; await loadRemoteProfile(); save(); showToast('Google login connected.'); }
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
  $('#enterApp').onclick=()=>{ if(canEnter()) openApp(); else showToast('Please confirm 18+ and sign in with Google first.'); };
  $('#googleGate').onclick=async()=>{ if(!state.ageOk){showToast('Please confirm you are 18+ first.'); return;} await signInWithGoogle(); };
  $('#gateSignOut').onclick=signOut;
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
  ['displayName','headline','city','radius','lookingFor','bio'].forEach(id=>{const el=$('#'+id); el.value=state.profile[id]||''; el.oninput=e=>{state.profile[id]=e.target.value; updateAvatar(); save();};});
  $('#searchCards').oninput=renderVault; $('#categoryFilter').onchange=renderVault;
  populateCats(); updateAvatar(); renderStack(); renderVault(); renderVaultStats(); renderMatches(); renderChats(); await initAuth(); updateGateUi(); if(canEnter()) openApp(); syncToSupabase(false);
}
function openApp(){ $('#ageGate').classList.add('hidden'); $('#app').classList.remove('hidden'); }
function closeApp(){ $('#app').classList.add('hidden'); $('#ageGate').classList.remove('hidden'); }
function showScreen(id){ $$('.screen').forEach(s=>s.classList.toggle('active-screen',s.id===id)); $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.screen===id)); }
function updateAvatar(){ $('.profile-avatar').textContent=(state.profile.displayName||'V').trim()[0]?.toUpperCase()||'V'; }
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
function renderVaultStats(){ const vals=Object.values(state.ratings); $('#ratedCount').textContent=vals.length; $('#limitCount').textContent=vals.filter(v=>v==='limit').length; $('#vaultPct').textContent=Math.round(vals.length/vaultCards.length*100)+'%'; }
function renderMatches(){ const liked=people.filter(p=>state.liked.includes(p.name)); $('#matchesList').innerHTML=(liked.length?liked:people.slice(0,3)).map(p=>`<article class="match-card"><div class="mini-avatar" style="background:linear-gradient(135deg,${p.gradient[0]},${p.gradient[1]})">${p.initial}</div><div><h3>${p.name}, ${p.age}</h3><p>${p.distance} miles away • ${p.mutual[0]} + more</p></div><span class="score-badge">${p.score}%</span></article>`).join(''); }
function renderChats(){ const liked=people.filter(p=>state.liked.includes(p.name)); const rows=(liked.length?liked:people.slice(0,3)); $('#chatList').innerHTML=rows.map(p=>`<article class="chat-row"><div class="mini-avatar" style="background:linear-gradient(135deg,${p.gradient[0]},${p.gradient[1]})">${p.initial}</div><div><h3>${p.name}</h3><p>You both marked ${p.mutual[0]} as compatible. Try asking what makes it exciting.</p></div></article>`).join(''); }
init();
