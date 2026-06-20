(() => {
  'use strict';
  if (window.__CONNECTION_QUEST_LOADED__) return;
  window.__CONNECTION_QUEST_LOADED__ = true;

  const CONFIG = window.COMPAT_CONFIG || window.TRIP_CONFIG || {};
  const sb = window.supabase?.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY || CONFIG.SUPABASE_ANON_KEY);
  const $ = id => document.getElementById(id);
  const els = ['loadingView','signedOutView','setupView','onboardingView','homeView','gameView','builderView','loginBtn','logoutBtn','userBadge','displayNameInput','vibeInput','saveProfileBtn','saveSecretsBtn','secretSetupGrid','createSessionBtn','sessionList','backBtn','copyInviteBtn','sessionTitle','partnerLine','levelText','xpText','xpBar','progressText','syncStatus','areaMap','challengeStage','compatText','openSecretsBtn','secretModal','closeSecretModal','secretVault','openBuilderBtn','hiddenBuilderBtn','closeBuilderBtn','legacyQuestionArea','homeLogo'].reduce((a,id)=>(a[id]=$(id),a),{});
  const state = { user:null, profile:null, content:null, sessions:[], activeSession:null, members:[], answers:[], secrets:[], player:null, channel:null, activeArea:null };
  const answerScore = {'Love it':4,'Into it':3,'Curious':2,'Depends on the person':1,'Not my thing':0};
  const escapeHtml = s => String(s ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const toast = msg => { const t=$('toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2600); };
  const show = id => { ['loadingView','signedOutView','setupView','onboardingView','homeView','gameView','builderView'].forEach(v=>els[v]?.classList.add('hidden')); if(id) els[id].classList.remove('hidden'); };
  const nameFor = (profile,user) => profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Player';
  const sessionUrl = id => { const u=new URL(location.href); u.searchParams.set('session',id); return u.toString(); };
  const levelFromXp = xp => [...state.content.levels].reverse().find(l=>xp>=l.xpRequired) || state.content.levels[0];
  const nextLevel = lvl => state.content.levels.find(l=>l.level===lvl+1) || state.content.levels[state.content.levels.length-1];

  async function init(){
    try { state.content = await (await fetch(`game-content.json?v=${Date.now()}`,{cache:'no-store'})).json(); } catch(e){ show('signedOutView'); return toast('Could not load game-content.json'); }
    bind();
    if(!sb){ show('signedOutView'); return toast('Missing Supabase config.'); }
    const {data} = await sb.auth.getSession(); state.user = data.session?.user || null;
    sb.auth.onAuthStateChange((_e,session)=>{ state.user=session?.user || null; boot(); });
    boot();
  }

  function bind(){
    els.loginBtn.onclick=()=>sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href}});
    els.logoutBtn.onclick=async()=>{ if(state.channel) await sb.removeChannel(state.channel); await sb.auth.signOut(); };
    els.saveProfileBtn.onclick=saveProfile; els.saveSecretsBtn.onclick=saveStarterSecrets; els.createSessionBtn.onclick=createSession;
    els.backBtn.onclick=async()=>{ history.replaceState(null,'',location.pathname); if(state.channel) await sb.removeChannel(state.channel); await loadSessions(); show('homeView'); };
    els.copyInviteBtn.onclick=()=>navigator.clipboard.writeText(sessionUrl(state.activeSession.id)).then(()=>toast('Invite link copied.'));
    els.openSecretsBtn.onclick=openSecretVault; els.closeSecretModal.onclick=()=>els.secretModal.classList.add('hidden');
    els.openBuilderBtn.onclick=()=>renderLegacyBuilder(); els.hiddenBuilderBtn.onclick=()=>renderLegacyBuilder(); els.closeBuilderBtn.onclick=()=>show('gameView');
    els.homeLogo.onclick=()=> state.activeSession ? show('gameView') : show('homeView');
  }

  async function boot(){
    els.logoutBtn.classList.toggle('hidden',!state.user); els.userBadge.classList.toggle('hidden',!state.user);
    if(!state.user) return show('signedOutView');
    show('loadingView'); await loadProfile();
    if(!state.profile){ els.displayNameInput.value=nameFor(null,state.user); return show('setupView'); }
    els.userBadge.textContent=nameFor(state.profile,state.user); await loadSecrets();
    if(!hasStarterSecrets()) { renderSecretSetup(); return show('onboardingView'); }
    const sid=new URL(location.href).searchParams.get('session'); if(sid) await openSession(sid,true); else { await loadSessions(); show('homeView'); }
  }

  async function loadProfile(){ const {data}=await sb.from('bcc_profiles').select('*').eq('user_id',state.user.id).maybeSingle(); state.profile=data; }
  async function saveProfile(){
    const display_name=els.displayNameInput.value.trim(); if(!display_name) return toast('Enter a display name.');
    const {data,error}=await sb.from('bcc_profiles').upsert({user_id:state.user.id,display_name,email:state.user.email,vibe:els.vibeInput.value},{onConflict:'user_id'}).select().single();
    if(error) return toast(error.message); state.profile=data; boot();
  }
  async function loadSecrets(){ const {data}=await sb.from('bcc_user_secrets').select('*').eq('user_id',state.user.id); state.secrets=data||[]; }
  function hasStarterSecrets(){ return state.content.secretPrompts.slice(0,4).every(p=>state.secrets.some(s=>s.secret_id===p.id && s.answer_text)); }
  function renderSecretSetup(){
    els.secretSetupGrid.innerHTML=state.content.secretPrompts.slice(0,8).map(p=>`<label><b>${escapeHtml(p.category)}</b><span>${escapeHtml(p.prompt)}</span><textarea data-secret="${p.id}" maxlength="180" placeholder="Short private answer…"></textarea></label>`).join('');
  }
  async function saveStarterSecrets(){
    const rows=[...els.secretSetupGrid.querySelectorAll('textarea')].map(t=>({user_id:state.user.id,secret_id:t.dataset.secret,answer_text:t.value.trim().slice(0,180)})).filter(r=>r.answer_text);
    if(rows.length<4) return toast('Add at least 4 starter secrets.');
    const {error}=await sb.from('bcc_user_secrets').upsert(rows,{onConflict:'user_id,secret_id'}); if(error) return toast(error.message); await loadSecrets(); boot();
  }

  async function createSession(){
    const {data,error}=await sb.from('bcc_sessions').insert({owner_id:state.user.id,title:`${nameFor(state.profile,state.user)}'s Connection Quest`}).select().single(); if(error) return toast(error.message);
    const mem=await sb.from('bcc_session_members').insert({session_id:data.id,user_id:state.user.id,role:'owner'}); if(mem.error) return toast(mem.error.message);
    history.pushState(null,'',sessionUrl(data.id)); await openSession(data.id,false);
  }
  async function loadSessions(){
    const {data,error}=await sb.from('bcc_session_members').select('session_id,role,created_at').eq('user_id',state.user.id).order('created_at',{ascending:false}); if(error) return toast(error.message);
    const ids=[...new Set((data||[]).map(r=>r.session_id))]; let sessions=[]; if(ids.length){ const r=await sb.from('bcc_sessions').select('*').in('id',ids); sessions=r.data||[]; }
    state.sessions=(data||[]).map(r=>({...r,session:sessions.find(s=>s.id===r.session_id)})).filter(r=>r.session); renderSessionList();
  }
  function renderSessionList(){
    els.sessionList.innerHTML=state.sessions.length?state.sessions.map(r=>`<button class="session-card" data-id="${r.session.id}"><b>${escapeHtml(r.session.title)}</b><span>${new Date(r.session.created_at).toLocaleString()}</span></button>`).join(''):'<p class="muted">No quests yet.</p>';
    els.sessionList.querySelectorAll('button').forEach(b=>b.onclick=()=>{history.pushState(null,'',sessionUrl(b.dataset.id));openSession(b.dataset.id,false);});
  }
  async function openSession(id,joining){
    const {data:session,error}=await sb.from('bcc_sessions').select('*').eq('id',id).maybeSingle(); if(error||!session){ toast('Quest not found.'); history.replaceState(null,'',location.pathname); await loadSessions(); return show('homeView'); }
    const mem=await sb.from('bcc_session_members').select('*').eq('session_id',id).eq('user_id',state.user.id).maybeSingle();
    if(!mem.data){ const count=await sb.from('bcc_session_members').select('*',{count:'exact',head:true}).eq('session_id',id); if(count.count>=2) return toast('This quest already has two players.'); const j=await sb.from('bcc_session_members').insert({session_id:id,user_id:state.user.id,role:'partner'}); if(j.error) return toast(j.error.message); if(joining) toast('Joined quest.'); }
    state.activeSession=session; await refreshSession(); subscribe(id); show('gameView'); renderGame();
  }
  async function refreshSession(){
    const id=state.activeSession.id;
    const [m,a,p]=await Promise.all([sb.from('bcc_session_members').select('*').eq('session_id',id).order('created_at'), sb.from('bcc_answers').select('*').eq('session_id',id), sb.from('bcc_player_state').select('*').eq('session_id',id).eq('user_id',state.user.id).maybeSingle()]);
    const userIds=(m.data||[]).map(x=>x.user_id); let profiles=[]; if(userIds.length){ const pr=await sb.from('bcc_profiles').select('*').in('user_id',userIds); profiles=pr.data||[]; }
    state.members=(m.data||[]).map(x=>({...x,profile:profiles.find(p=>p.user_id===x.user_id)})); state.answers=a.data||[]; state.player=p.data||{xp:0,unlocked:{}};
  }
  function subscribe(id){
    if(state.channel) sb.removeChannel(state.channel);
    state.channel=sb.channel(`cq-${id}`).on('postgres_changes',{event:'*',schema:'public',table:'bcc_answers',filter:`session_id=eq.${id}`},async()=>{await refreshSession();renderGame();}).on('postgres_changes',{event:'*',schema:'public',table:'bcc_session_members',filter:`session_id=eq.${id}`},async()=>{await refreshSession();renderGame();}).subscribe(s=>els.syncStatus.textContent=s==='SUBSCRIBED'?'Live sync connected':'Sync connecting…');
  }

  function stats(){
    const challenges=state.content.challenges, mine=challenges.filter(c=>myAnswer(c.id)), both=challenges.filter(c=>myAnswer(c.id)&&otherAnswer(c.id)); let points=0;
    both.forEach(c=>{ const a=answerScore[myAnswer(c.id).answer_value]??0,b=answerScore[otherAnswer(c.id).answer_value]??0; if(a>=3&&b>=3) points+=1; else if(a>=2&&b>=2) points+=.75; else if(Math.abs(a-b)<=1) points+=.5; });
    return {mine:mine.length,both:both.length,compat:both.length?Math.round(points/both.length*100):0};
  }
  const myAnswer=id=>state.answers.find(a=>a.question_id===id&&a.user_id===state.user.id);
  const otherAnswer=id=>state.answers.find(a=>a.question_id===id&&a.user_id!==state.user.id);
  function renderGame(){
    const xp=(state.player?.xp||0), lvl=levelFromXp(xp), nxt=nextLevel(lvl.level), pct=Math.min(100,Math.round(((xp-lvl.xpRequired)/(nxt.xpRequired-lvl.xpRequired||1))*100)); const st=stats();
    els.sessionTitle.textContent=state.activeSession.title; const other=state.members.find(m=>m.user_id!==state.user.id); els.partnerLine.textContent=other?`Connected with ${nameFor(other.profile,{})}`:'Waiting for invite…';
    els.levelText.textContent=`${lvl.level}`; els.xpText.textContent=xp; els.xpBar.style.width=`${pct}%`; els.progressText.textContent=`${lvl.title} • ${st.mine}/${state.content.challenges.length} answered • ${st.both} synced`; els.compatText.textContent=`${st.compat}%`;
    const bedroomUnlocked=lvl.level>=10; els.openBuilderBtn.classList.toggle('hidden',!bedroomUnlocked); els.hiddenBuilderBtn.classList.toggle('hidden',!bedroomUnlocked);
    renderAreas(lvl.level);
  }
  function renderAreas(level){
    els.areaMap.innerHTML=state.content.areas.map(a=>{ const locked=level<a.unlockLevel; const items=state.content.challenges.filter(c=>c.areaId===a.id); const done=items.filter(c=>myAnswer(c.id)).length; return `<button class="area-card ${locked?'locked':''}" data-area="${a.id}" ${locked?'disabled':''}><span class="area-icon">${a.icon}</span><b>${escapeHtml(a.name)}</b><em>${locked?'Unlocks at Level '+a.unlockLevel:a.description}</em><div class="mini-track"><i style="width:${Math.round(done/items.length*100)}%"></i></div><small>${done}/${items.length}</small></button>`; }).join('');
    els.areaMap.querySelectorAll('.area-card:not(.locked)').forEach(b=>b.onclick=()=>openArea(b.dataset.area));
  }
  function openArea(id){ state.activeArea=id; const area=state.content.areas.find(a=>a.id===id); const items=state.content.challenges.filter(c=>c.areaId===id); els.challengeStage.classList.remove('hidden'); els.challengeStage.innerHTML=`<div class="challenge-head"><button id="closeArea" class="pill">← Map</button><div><p class="eyebrow">${area.icon} ${escapeHtml(area.name)}</p><h2>${escapeHtml(area.description)}</h2></div></div><div class="challenge-grid">${items.map(renderChallenge).join('')}</div>`; $('closeArea').onclick=()=>els.challengeStage.classList.add('hidden'); bindChallengeButtons(); }
  function renderChallenge(c){ const mine=myAnswer(c.id), other=otherAnswer(c.id); let badge=mine?(other?'Synced':'Waiting'):'Open'; return `<article class="challenge-card ${mine?'answered':''}"><span>${escapeHtml(badge)} • +${c.xp} XP</span><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.prompt)}</p><div>${c.answers.map(a=>`<button class="answer ${mine?.answer_value===a?'selected':''}" data-c="${c.id}" data-a="${escapeHtml(a)}">${escapeHtml(a)}</button>`).join('')}</div></article>`; }
  function bindChallengeButtons(){ els.challengeStage.querySelectorAll('.answer').forEach(b=>b.onclick=()=>saveAnswer(b.dataset.c,b.dataset.a)); }
  async function saveAnswer(challengeId,value){
    const c=state.content.challenges.find(x=>x.id===challengeId), first=!myAnswer(challengeId);
    const {error}=await sb.from('bcc_answers').upsert({session_id:state.activeSession.id,user_id:state.user.id,question_id:challengeId,answer_value:value},{onConflict:'session_id,user_id,question_id'}); if(error) return toast(error.message);
    if(first){ const xp=(state.player?.xp||0)+c.xp; await sb.from('bcc_player_state').upsert({session_id:state.activeSession.id,user_id:state.user.id,xp},{onConflict:'session_id,user_id'}); }
    await refreshSession(); renderGame(); if(state.activeArea) openArea(state.activeArea); toast(first?`+${c.xp} XP`:'Answer updated');
  }

  function openSecretVault(){
    const lvl=levelFromXp(state.player?.xp||0).level;
    els.secretVault.innerHTML=state.content.secretPrompts.map(p=>{ const unlocked=lvl>=p.unlockLevel; const mine=state.secrets.find(s=>s.secret_id===p.id); return `<div class="vault-card ${unlocked?'':'locked'}"><b>${escapeHtml(p.category)} ${unlocked?'':'🔒'}</b><p>${unlocked?escapeHtml(mine?.answer_text||'You have not filled this secret yet.'):('Unlocks at Level '+p.unlockLevel)}</p></div>`; }).join('');
    els.secretModal.classList.remove('hidden');
  }
  function renderLegacyBuilder(){
    const bedroom=state.content.challenges.filter(c=>c.areaId==='bedroom'); show('builderView');
    els.legacyQuestionArea.innerHTML=bedroom.map(c=>`<div class="legacy-row"><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.prompt)}</p><div>${c.answers.map(a=>`<button class="answer" data-c="${c.id}" data-a="${escapeHtml(a)}">${escapeHtml(a)}</button>`).join('')}</div></div>`).join('');
    els.legacyQuestionArea.querySelectorAll('.answer').forEach(b=>b.onclick=()=>saveAnswer(b.dataset.c,b.dataset.a));
  }
  init();
})();
