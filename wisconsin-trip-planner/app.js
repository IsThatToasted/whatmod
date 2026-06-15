const LS_KEY = 'bondquest-rpg-test-v1';
const APP_ID = () => window.TRIP_CONFIG?.TRIP_ID || 'bondquest-test-v1';
const tabs = [
  ['dashboard','Dashboard'],['quests','Quests'],['distance','DistanceSync'],['compatibility','Compatibility'],['memories','Memory Vault'],['heatmap','Heat Map'],['settings','Settings']
];
const statNames = ['Connection','Romance','Intimacy','Adventure','Support'];
const moodNames = ['Mood','Energy','Stress','Affection','Connection','Desire'];
const compatTopics = ['Cuddling / affection','Flirty texting','Video date intimacy','Roleplay curiosity','Trying new things','Receiving gifts','Words of affirmation','Physical boundaries talk','Aftercare / reassurance','Planning visits','Private photos comfort','Deep fantasy talk'];
const defaultQuests = [
  q('Send a voice note that is not about logistics','Connection',20),
  q('Plan the next virtual date night','Romance',35),
  q('Share one boundary and one curiosity','Intimacy',45),
  q('Add three ideas to the shared bucket list','Adventure',30),
  q('Ask what would make this week easier','Support',25)
];
let state = {
  partnerA:'You', partnerB:'Partner', nextVisit:'', xp:0, streak:0, lastQuestDate:'',
  stats:{Connection:35,Romance:30,Intimacy:25,Adventure:20,Support:35},
  quests:defaultQuests, milestones:[], memories:[], moodLogs:[], compatibility:{}, dateIdea:''
};
let supa = null, user = null, cloudTimer = null;
const $ = id => document.getElementById(id);
function q(title, category='Connection', xp=25){ return {id:crypto.randomUUID(), title, category, xp:Number(xp)||25, completed:false, createdAt:new Date().toISOString()}; }
function init(){ load(); bind(); initSupabase(); render(); }
function bind(){
  $('partnerA').oninput=e=>{state.partnerA=e.target.value||'You'; persist(); render();};
  $('partnerB').oninput=e=>{state.partnerB=e.target.value||'Partner'; persist(); render();};
  $('nextVisit').onchange=e=>{state.nextVisit=e.target.value; persist(); render();};
  $('loginBtn').onclick=login; $('logoutBtn').onclick=logout; $('syncBtn').onclick=saveCloud;
  $('newQuestBtn').onclick=generateQuest; $('addQuestBtn').onclick=()=>showTab('quests'); $('saveQuestBtn').onclick=saveQuest;
  $('logMoodBtn').onclick=()=>showTab('heatmap'); $('saveMoodBtn').onclick=saveMood;
  $('saveMilestoneBtn').onclick=saveMilestone; $('dateGenBtn').onclick=generateDateIdea; $('saveMemoryBtn').onclick=saveMemory;
  $('exportBtn').onclick=exportJson; $('importFile').onchange=importJson; $('resetBtn').onclick=resetDemo;
}
function render(){
  $('partnerA').value=state.partnerA; $('partnerB').value=state.partnerB; $('nextVisit').value=state.nextVisit||'';
  $('tabs').innerHTML=tabs.map(([id,label])=>`<button class="${id==='dashboard'?'active':''}" data-tab="${id}">${label}</button>`).join('');
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
  renderDashboard(); renderQuests(); renderDistance(); renderCompat(); renderMemories(); renderMood(); renderDebug();
}
function showTab(id){ document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===id)); document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id)); }
function renderDashboard(){
  const level = Math.floor(state.xp/100)+1, into = state.xp%100;
  $('level').textContent=level; $('coupleName').textContent=`${state.partnerA||'You'} + ${state.partnerB||'Partner'}`; $('xpText').textContent=`${into} / 100 XP to next level`; $('xpBar').style.width=into+'%';
  $('countdown').textContent=countdown(); $('streak').textContent=state.streak||0; $('memoryCount').textContent=state.memories.length; $('matchCount').textContent=getMatches().length;
  $('statsGrid').innerHTML=statNames.map(n=>`<div class="stat"><h4>${n}</h4><strong>${state.stats[n]||0}</strong><div class="statbar"><i style="width:${state.stats[n]||0}%"></i></div></div>`).join('');
  $('questList').innerHTML=state.quests.filter(x=>!x.completed).slice(0,5).map(renderQuest).join('') || '<p class="muted">No active quests. Generate one.</p>';
  $('heatSnapshot').innerHTML=latestMoodHtml();
  $('gmTip').textContent=gameMasterTip();
}
function renderQuests(){ $('allQuests').innerHTML=state.quests.map(renderQuest).join('') || '<p class="muted">No quests yet.</p>'; }
function renderQuest(x){ return `<div class="quest ${x.completed?'completed':''}"><div><h4>${esc(x.title)}</h4><small>${esc(x.category)} • ${x.xp} XP</small></div><button onclick="completeQuest('${x.id}')">${x.completed?'Undo':'Complete'}</button></div>`; }
window.completeQuest = id => { const item=state.quests.find(x=>x.id===id); if(!item)return; item.completed=!item.completed; if(item.completed){ state.xp+=item.xp; bump(item.category,8); updateStreak(); } else { state.xp=Math.max(0,state.xp-item.xp); } persist(); render(); };
function saveQuest(){ const title=$('questTitle').value.trim(); if(!title)return; state.quests.unshift(q(title,$('questCategory').value,$('questXp').value)); $('questTitle').value=''; persist(); render(); }
function generateQuest(){ const pool=[['Have a 20 minute no-phone video call','Connection',35],['Create a shared playlist with 5 songs each','Romance',30],['Privately answer 3 compatibility cards','Intimacy',40],['Pick one future trip stop and add it to DistanceSync','Adventure',35],['Send reassurance about one thing they are stressed about','Support',25],['Plan a $0 cozy virtual date','Romance',30],['Ask: what made you feel loved this week?','Connection',25]]; const r=pool[Math.floor(Math.random()*pool.length)]; state.quests.unshift(q(...r)); persist(); render(); }
function renderDistance(){
  $('milestoneMap').innerHTML=state.milestones.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')).map(m=>`<div class="timeline-item"><h4>${esc(m.title)}</h4><small>${esc(m.type)} ${m.date?'• '+m.date:''}</small><button class="ghost" onclick="deleteMilestone('${m.id}')">Delete</button></div>`).join('')||'<p class="muted">Add visits, gifts, goals, and bucket list items.</p>';
  $('dateIdea').innerHTML=state.dateIdea||'<p class="muted">Generate a date quest based on time, budget, and vibe.</p>';
}
function saveMilestone(){ const title=$('milestoneTitle').value.trim(); if(!title)return; state.milestones.push({id:crypto.randomUUID(),title,date:$('milestoneDate').value,type:$('milestoneType').value}); $('milestoneTitle').value=''; persist(); render(); }
window.deleteMilestone=id=>{state.milestones=state.milestones.filter(x=>x.id!==id);persist();render();};
function generateDateIdea(){ const budget=Number($('dateBudget').value)||0, mins=Number($('dateMinutes').value)||60, vibe=$('dateVibe').value; let title=''; if(vibe==='Cozy') title='Cozy Campfire Call'; else if(vibe==='Sexy but safe') title='Consent-First Flirt Night'; else if(vibe==='Funny') title='Bad Movie Roast Date'; else if(vibe==='Deep conversation') title='Truth Map Date'; else title='Two-City Scavenger Hunt'; state.dateIdea=`<h4>${title}</h4><p>Time: ${mins} minutes • Budget: $${budget}</p><p>Quest: each partner brings one surprise, one question, and one small challenge. Complete it for +60 Romance and Connection XP.</p>`; state.quests.unshift(q(title,'Romance',60)); persist(); render(); }
function renderCompat(){
  const c=state.compatibility;
  $('compatGrid').innerHTML=compatTopics.map(t=>{ const a=c[t]?.a||'unset', b=c[t]?.b||'unset'; return `<div class="compat-item"><h4>${esc(t)}</h4><small>Reveal only when both say yes/open.</small><div class="compat-controls"><button class="${a==='yes'?'yes':''}" onclick="setCompat('${enc(t)}','a','yes')">${esc(state.partnerA)} open</button><button onclick="setCompat('${enc(t)}','a','no')">${esc(state.partnerA)} no</button><button class="${b==='yes'?'yes':''}" onclick="setCompat('${enc(t)}','b','yes')">${esc(state.partnerB)} open</button><button onclick="setCompat('${enc(t)}','b','no')">${esc(state.partnerB)} no</button></div></div>`}).join('');
  const matches=getMatches(); const pct=Math.round(matches.length/compatTopics.length*100);
  $('compatReport').innerHTML=`<h3>${pct}% mutual comfort overlap</h3><p>Unlocked mutual matches: ${matches.length?matches.map(esc).join(', '):'None yet.'}</p>`;
}
window.setCompat=(topic,key,val)=>{ topic=dec(topic); state.compatibility[topic]=state.compatibility[topic]||{}; state.compatibility[topic][key]=val; persist(); render(); };
function getMatches(){ return compatTopics.filter(t=>state.compatibility[t]?.a==='yes'&&state.compatibility[t]?.b==='yes'); }
function renderMemories(){ $('memoryVault').innerHTML=state.memories.map(m=>`<div class="memory ${m.rarity}"><small>${esc(m.rarity)} Memory ${m.date?'• '+m.date:''}</small><h4>${esc(m.title)}</h4><p class="muted">${esc(m.notes||'')}</p>${m.url?`<a class="muted" href="${esc(m.url)}" target="_blank">Open attachment</a>`:''}<br><button class="ghost" onclick="deleteMemory('${m.id}')">Delete</button></div>`).join('')||'<p class="muted">Add photos, voice-note links, inside jokes, and trip memories.</p>'; }
function saveMemory(){ const title=$('memoryTitle').value.trim(); if(!title)return; state.memories.unshift({id:crypto.randomUUID(),title,date:$('memoryDate').value,rarity:$('memoryRarity').value,url:$('memoryUrl').value.trim(),notes:$('memoryNotes').value.trim()}); ['memoryTitle','memoryUrl','memoryNotes'].forEach(id=>$(id).value=''); persist(); render(); }
window.deleteMemory=id=>{state.memories=state.memories.filter(x=>x.id!==id);persist();render();};
function renderMood(){ $('sliderGrid').innerHTML=moodNames.map(n=>`<div class="mood-row"><label>${n}<input id="mood_${n}" type="range" min="0" max="100" value="50" oninput="this.nextElementSibling.textContent=this.value"></label><b>50</b></div>`).join(''); $('heatHistory').innerHTML=state.moodLogs.slice(0,10).map(l=>`<div class="mood-row"><h4>${new Date(l.createdAt).toLocaleString()}</h4>${moodNames.map(n=>`${n}: ${l[n]}`).join(' • ')}</div>`).join('')||'<p class="muted">No mood logs yet.</p>'; }
function saveMood(){ const log={id:crypto.randomUUID(),createdAt:new Date().toISOString()}; moodNames.forEach(n=>log[n]=Number($('mood_'+n).value)); state.moodLogs.unshift(log); state.stats.Connection=Math.round((state.stats.Connection+log.Connection)/2); state.stats.Intimacy=Math.round((state.stats.Intimacy+log.Desire)/2); persist(); render(); showTab('heatmap'); }
function latestMoodHtml(){ const l=state.moodLogs[0]; if(!l)return '<p class="muted">No status logged yet.</p>'; return moodNames.map(n=>`<div><b>${n}</b><div class="statbar"><i style="width:${l[n]}%"></i></div></div>`).join(''); }
function gameMasterTip(){ const l=state.moodLogs[0]; if(!l) return 'Game Master: Log a status check to unlock smarter quest suggestions.'; if(l.Stress>70) return 'Game Master: Stress is high. Try a low-pressure support quest instead of a heavy conversation.'; if(l.Connection<45) return 'Game Master: Connection is dipping. A voice-note or video-date quest would help.'; if(getMatches().length>=3) return 'Game Master: You have compatibility overlap. Turn one match into a consent-first quest.'; return 'Game Master: The bond is stable. Add a memory or plan the next visit.'; }
function bump(category,amt){ const map={Connection:'Connection',Romance:'Romance',Intimacy:'Intimacy',Adventure:'Adventure',Support:'Support'}; const k=map[category]||'Connection'; state.stats[k]=Math.min(100,(state.stats[k]||0)+amt); }
function updateStreak(){ const today=new Date().toISOString().slice(0,10); if(state.lastQuestDate!==today){ state.streak=(state.streak||0)+1; state.lastQuestDate=today; } }
function countdown(){ if(!state.nextVisit)return '—'; const d=Math.ceil((new Date(state.nextVisit+'T00:00:00')-new Date())/86400000); return d<0?'past':String(d); }
function persist(){ localStorage.setItem(LS_KEY,JSON.stringify(state)); clearTimeout(cloudTimer); cloudTimer=setTimeout(()=>{ if(user) saveCloud(false); },800); renderDebug(); }
function load(){ try{ const raw=localStorage.getItem(LS_KEY); if(raw) state={...state,...JSON.parse(raw)}; }catch(e){} }
async function initSupabase(){ const cfg=window.TRIP_CONFIG||{}; if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){ setAuth('No Supabase config found. Local mode only.'); return; } supa=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY); window.bondSupabase=supa; const {data}=await supa.auth.getSession(); user=data.session?.user||null; updateAuthUi(); if(user) await loadCloud(); supa.auth.onAuthStateChange(async(_e,session)=>{user=session?.user||null; updateAuthUi(); if(user) await loadCloud();}); }
async function login(){ if(!supa)return alert('Supabase is not configured.'); await supa.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href.split('#')[0]}}); }
async function logout(){ if(!supa)return; await supa.auth.signOut(); user=null; updateAuthUi(); }
function updateAuthUi(){ $('loginBtn').classList.toggle('hidden',!!user); $('logoutBtn').classList.toggle('hidden',!user); setAuth(user?`Logged in as ${user.email}. Supabase sync enabled.`:'Local save is active. Login enables Supabase sync per user.'); }
function setAuth(t){ $('authStatus').textContent=t; }
async function saveCloud(show=true){ if(!supa||!user){ if(show) alert('Login first to sync. Local save is still active.'); return; } const row={user_id:user.id, app_id:APP_ID(), data:state, updated_at:new Date().toISOString()}; const {error}=await supa.from('bondquest_apps').upsert(row,{onConflict:'user_id,app_id'}); if(error){ alert('Supabase save failed. Run the included schema SQL first. '+error.message); return; } if(show) setAuth('Saved to Supabase.'); }
async function loadCloud(){ const {data,error}=await supa.from('bondquest_apps').select('data,updated_at').eq('user_id',user.id).eq('app_id',APP_ID()).maybeSingle(); if(error){ setAuth('Supabase connected, but table may not exist yet. Run schema SQL.'); return; } if(data?.data){ state={...state,...data.data}; localStorage.setItem(LS_KEY,JSON.stringify(state)); render(); setAuth(`Loaded cloud save from ${new Date(data.updated_at).toLocaleString()}.`); } else await saveCloud(false); }
function exportJson(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='bondquest-save.json'; a.click(); URL.revokeObjectURL(a.href); }
function importJson(e){ const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ state={...state,...JSON.parse(r.result)}; persist(); render(); }catch(err){alert('Invalid JSON');} }; r.readAsText(f); }
function resetDemo(){ if(!confirm('Reset this local demo?'))return; localStorage.removeItem(LS_KEY); location.reload(); }
function renderDebug(){ if($('debugBox')) $('debugBox').textContent=JSON.stringify({app_id:APP_ID(), logged_in:!!user, local_key:LS_KEY, counts:{quests:state.quests.length,memories:state.memories.length,milestones:state.milestones.length,mood_logs:state.moodLogs.length}},null,2); }
function esc(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));} function enc(s){return encodeURIComponent(s)} function dec(s){return decodeURIComponent(s)}
window.addEventListener('DOMContentLoaded',init);
