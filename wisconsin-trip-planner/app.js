(() => {
  'use strict';
  if (window.__BEDROOM_CONNECTION_APP_LOADED__) return;
  window.__BEDROOM_CONNECTION_APP_LOADED__ = true;

  const CONFIG = window.COMPAT_CONFIG || window.TRIP_CONFIG || {};
  const sb = window.supabase?.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY || CONFIG.SUPABASE_ANON_KEY);

  const ANSWER_TYPES = {
    attraction: [
      { label:'😍 Huge Turn-On', score:4, heat:true },
      { label:'😊 Sexy', score:3, heat:true },
      { label:'😏 Kinda Into It', score:2, curious:true },
      { label:'😐 Meh', score:1 },
      { label:'👎 Not My Thing', score:0, hardNo:true }
    ],
    affection: [
      { label:'❤️ Love It', score:4, heat:true },
      { label:'😊 Enjoy It', score:3, heat:true },
      { label:'😏 Sometimes', score:2, curious:true },
      { label:'😐 Meh', score:1 },
      { label:'🙅 Not For Me', score:0, hardNo:true }
    ],
    style: [
      { label:'🔥 Favorite', score:4, heat:true },
      { label:'😈 Very Into It', score:3, heat:true },
      { label:'🤔 Depends', score:2, curious:true },
      { label:'😐 Meh', score:1 },
      { label:'🚫 Not For Me', score:0, hardNo:true }
    ],
    desire: [
      { label:'🔥 Yes Please', score:4, heat:true },
      { label:'😘 Into It', score:3, heat:true },
      { label:'👀 Curious', score:2, curious:true },
      { label:'😐 Meh', score:1 },
      { label:'🚫 Avoid It', score:0, hardNo:true }
    ],
    exploration: [
      { label:'🔥 Very Hot', score:4, heat:true },
      { label:'😍 Sounds Sexy', score:3, heat:true },
      { label:'🤔 Curious', score:2, curious:true },
      { label:'😐 Meh', score:1 },
      { label:'🚫 Not For Me', score:0, hardNo:true }
    ],
    experience: [
      { label:'✅ Loved It', score:4, heat:true },
      { label:'👍 Enjoyed It', score:3, heat:true },
      { label:'👀 Curious', score:2, curious:true },
      { label:'😶 Never Tried', score:1 },
      { label:'👎 Didn’t Enjoy', score:0, hardNo:true }
    ],
    frequency: [
      { label:'🔥 All The Time', score:4, heat:true },
      { label:'😊 Often', score:3, heat:true },
      { label:'😏 Sometimes', score:2, curious:true },
      { label:'😐 Rarely', score:1 },
      { label:'🚫 Never', score:0, hardNo:true }
    ]
  };

  let QUESTIONS = [];
  const $ = id => document.getElementById(id);
  const ids = ['loadingView','signedOutView','setupView','homeView','sessionView','loginBtn','logoutBtn','userBadge','displayNameInput','saveProfileBtn','createSessionBtn','sessionList','backBtn','copyInviteBtn','copyInviteBtn2','inviteLinkInput','inviteBox','sessionTitle','partnerLine','progressText','progressBar','syncStatus','questionArea','finalScoreCard','toggleViewBtn'];
  const els = ids.reduce((a,id)=>(a[id]=$(id),a),{});
  let state = { user:null, profile:null, sessions:[], activeSession:null, members:[], answers:[], channel:null, cardMode:false, openCategories:new Set() };

  function escapeHtml(str){ return String(str ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function toast(msg){ const t=$('toast'); if(!t) return; t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2600); }
  function showOnly(view){ ['loadingView','signedOutView','homeView','sessionView'].forEach(id=>els[id]?.classList.add('hidden')); if(view) els[view]?.classList.remove('hidden'); }
  function appUrlForSession(id){ const u = new URL(location.href); u.searchParams.set('session', id); return u.toString(); }
  function displayName(profile, user){ return profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You'; }
  function participantName(userId){ const m=state.members.find(x=>x.user_id===userId); return m?.profile?.display_name || (userId===state.user?.id ? displayName(state.profile,state.user) : 'Invite'); }
  function getOptions(q){ return ANSWER_TYPES[q.type] || ANSWER_TYPES.exploration; }
  function optionMeta(q, value){ return getOptions(q).find(o=>o.label===value) || null; }
  function myAnswer(qid){ return state.answers.find(a=>a.question_id===qid && a.user_id===state.user?.id); }
  function otherAnswer(qid){ return state.answers.find(a=>a.question_id===qid && a.user_id!==state.user?.id); }
  function compare(q,a,b){
    if(!a || !b) return { kind:'waiting', label: a || b ? 'Waiting for other answer' : 'Not answered yet', compatible:false, points:0 };
    const am=optionMeta(q,a.answer_value), bm=optionMeta(q,b.answer_value);
    if(!am || !bm) return { kind:'waiting', label:'Waiting', compatible:false, points:0 };
    if(am.hardNo || bm.hardNo) return { kind:'miss', label:'Different preferences', compatible:false, points:0 };
    if(am.score>=3 && bm.score>=3) return { kind:'match', label:'Mutual heat', compatible:true, points:1 };
    if(am.score>=2 && bm.score>=2) return { kind:'curious', label:'Shared curiosity', compatible:true, points:.75 };
    if(Math.abs(am.score-bm.score)<=1 && am.score>=1 && bm.score>=1) return { kind:'curious', label:'Possible overlap', compatible:true, points:.5 };
    return { kind:'miss', label:'Different preferences', compatible:false, points:0 };
  }

  async function loadQuestions(){
    const res = await fetch(`questions.json?v=${Date.now()}`, { cache:'no-store' });
    if(!res.ok) throw new Error('Could not load questions.json');
    const data = await res.json();
    QUESTIONS = data.map((q,i)=>({ ...q, id:String(q.id || `q_${i+1}`), category:q.category || 'Questions', type:q.type || 'exploration', text:q.text || q.question || '' })).filter(q=>q.text.trim());
    if(!QUESTIONS.length) throw new Error('questions.json is empty');
    QUESTIONS.forEach(q=>state.openCategories.add(q.category));
  }

  async function init(){
    try { await loadQuestions(); } catch(err){ console.error(err); showOnly('signedOutView'); toast(err.message); return; }
    if(!sb){ showOnly('signedOutView'); toast('Missing Supabase config.'); return; }
    const { data } = await sb.auth.getSession();
    state.user = data.session?.user || null;
    sb.auth.onAuthStateChange((_event, session)=>{ state.user = session?.user || null; bootForUser(); });
    bindEvents();
    await bootForUser();
  }

  function bindEvents(){
    els.loginBtn.onclick = login; els.logoutBtn.onclick = logout; els.saveProfileBtn.onclick = saveProfile; els.createSessionBtn.onclick = createSession;
    els.backBtn.onclick = async()=>{ history.replaceState(null,'',location.pathname); if(state.channel) sb.removeChannel(state.channel); await loadSessions(); showOnly('homeView'); };
    els.copyInviteBtn.onclick = showInvite; els.copyInviteBtn2.onclick = copyInvite;
    els.toggleViewBtn.onclick = ()=>{ state.cardMode=!state.cardMode; renderQuestions(); els.toggleViewBtn.textContent = state.cardMode ? 'List view' : 'Card view'; };
  }

  async function bootForUser(){
    els.loginBtn?.classList.toggle('hidden', !!state.user); els.logoutBtn?.classList.toggle('hidden', !state.user); els.userBadge?.classList.toggle('hidden', !state.user); els.setupView?.classList.add('hidden');
    if(!state.user){ showOnly('signedOutView'); return; }
    showOnly('loadingView');
    await loadProfile();
    if(!state.profile){ els.displayNameInput.value = displayName(null,state.user); els.setupView.classList.remove('hidden'); showOnly(null); return; }
    els.userBadge.textContent = displayName(state.profile,state.user);
    const sessionFromUrl = new URL(location.href).searchParams.get('session');
    if(sessionFromUrl) await openSession(sessionFromUrl, true); else { await loadSessions(); showOnly('homeView'); }
  }

  async function loadProfile(){
    const { data, error } = await sb.from('bcc_profiles').select('*').eq('user_id', state.user.id).maybeSingle();
    if(error) console.warn(error); state.profile = data || null;
  }
  async function saveProfile(){
    const name = els.displayNameInput.value.trim(); if(!name) return toast('Enter a display name.');
    const { data, error } = await sb.from('bcc_profiles').upsert({ user_id: state.user.id, display_name:name, email:state.user.email }, { onConflict:'user_id' }).select().single();
    if(error) return toast(error.message); state.profile=data; toast('Profile saved.'); await bootForUser();
  }
  async function login(){ const { error } = await sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.href } }); if(error) toast(error.message); }
  async function logout(){ if(state.channel) await sb.removeChannel(state.channel); await sb.auth.signOut(); }

  async function createSession(){
    const title = `${displayName(state.profile,state.user)}'s Bedroom Builder`;
    const { data, error } = await sb.from('bcc_sessions').insert({ owner_id:state.user.id, title }).select().single();
    if(error) return toast(error.message);
    const { error: memErr } = await sb.from('bcc_session_members').insert({ session_id:data.id, user_id:state.user.id, role:'owner' });
    if(memErr) return toast(memErr.message);
    history.pushState(null,'',appUrlForSession(data.id)); await openSession(data.id, false);
  }

  async function loadSessions(){
    const { data: rows, error } = await sb.from('bcc_session_members').select('session_id, role, created_at').eq('user_id', state.user.id).order('created_at',{ascending:false});
    if(error){ toast(error.message); return; }
    const ids = [...new Set((rows||[]).map(r=>r.session_id))];
    let sessions=[];
    if(ids.length){ const res = await sb.from('bcc_sessions').select('*').in('id', ids); if(res.error) toast(res.error.message); else sessions=res.data||[]; }
    state.sessions = (rows||[]).map(r=>({...r, session:sessions.find(s=>s.id===r.session_id)})).filter(r=>r.session);
    renderSessionList();
  }
  function renderSessionList(){
    els.sessionList.innerHTML='';
    if(!state.sessions.length){ els.sessionList.innerHTML='<p class="muted">No builders yet. Create one and send the private invite link.</p>'; return; }
    state.sessions.forEach(row=>{ const s=row.session; const div=document.createElement('div'); div.className='session-item';
      div.innerHTML=`<div><strong>${escapeHtml(s.title||'Bedroom Builder')}</strong><span class="muted small">${new Date(s.created_at).toLocaleDateString()}</span></div><button class="btn ghost">Open</button>`;
      div.querySelector('button').onclick=()=>{ history.pushState(null,'',appUrlForSession(s.id)); openSession(s.id,false); }; els.sessionList.appendChild(div);
    });
  }

  async function openSession(id, joining){
    showOnly('loadingView');
    const { data: session, error } = await sb.from('bcc_sessions').select('*').eq('id', id).maybeSingle();
    if(error || !session){ toast('Could not open that builder.'); history.replaceState(null,'',location.pathname); await loadSessions(); showOnly('homeView'); return; }
    const { data: existing } = await sb.from('bcc_session_members').select('*').eq('session_id',id).eq('user_id',state.user.id).maybeSingle();
    if(!existing){
      const { count } = await sb.from('bcc_session_members').select('*',{count:'exact',head:true}).eq('session_id',id);
      if(count >= 2){ toast('This builder already has two people.'); history.replaceState(null,'',location.pathname); await loadSessions(); showOnly('homeView'); return; }
      const { error: joinErr } = await sb.from('bcc_session_members').insert({ session_id:id, user_id:state.user.id, role:'partner' });
      if(joinErr){ toast(joinErr.message); return; } if(joining) toast('Joined builder.');
    }
    state.activeSession=session; await refreshSessionData(); subscribeSession(id); showOnly('sessionView'); renderSession();
  }

  async function refreshSessionData(){
    const id=state.activeSession.id;
    const [membersRes, answersRes] = await Promise.all([
      sb.from('bcc_session_members').select('*').eq('session_id',id).order('created_at',{ascending:true}),
      sb.from('bcc_answers').select('*').eq('session_id',id)
    ]);
    if(membersRes.error) toast(membersRes.error.message); if(answersRes.error) toast(answersRes.error.message);
    const members = membersRes.data || [];
    const userIds = members.map(m=>m.user_id);
    let profiles=[];
    if(userIds.length){ const profilesRes = await sb.from('bcc_profiles').select('*').in('user_id', userIds); if(profilesRes.error) console.warn(profilesRes.error); profiles = profilesRes.data || []; }
    state.members = members.map(m=>({...m, profile:profiles.find(p=>p.user_id===m.user_id)}));
    state.answers = answersRes.data || [];
  }

  function subscribeSession(id){
    if(state.channel) sb.removeChannel(state.channel);
    state.channel = sb.channel(`bedroom-builder-${id}`)
      .on('postgres_changes', {event:'*', schema:'public', table:'bcc_answers', filter:`session_id=eq.${id}`}, async()=>{ els.syncStatus.textContent='Updated live'; await refreshSessionData(); renderSession(); })
      .on('postgres_changes', {event:'*', schema:'public', table:'bcc_session_members', filter:`session_id=eq.${id}`}, async()=>{ await refreshSessionData(); renderSession(); })
      .subscribe(status=>{ els.syncStatus.textContent = status === 'SUBSCRIBED' ? 'Live sync connected' : 'Sync connecting…'; });
  }

  function renderSession(){
    els.sessionTitle.textContent = state.activeSession?.title || 'Bedroom Connection Builder';
    const others=state.members.filter(m=>m.user_id!==state.user.id);
    els.partnerLine.textContent = others.length ? `Connected with ${participantName(others[0].user_id)}` : 'Waiting for invite…';
    renderProgress(); renderFinal(); renderQuestions();
  }
  function renderProgress(){
    const bothAnswered = QUESTIONS.filter(q=>myAnswer(q.id) && otherAnswer(q.id)).length;
    const mine = QUESTIONS.filter(q=>myAnswer(q.id)).length;
    const theirs = QUESTIONS.filter(q=>otherAnswer(q.id)).length;
    els.progressText.textContent = `You: ${mine}/${QUESTIONS.length} • Other: ${theirs}/${QUESTIONS.length} • Both: ${bothAnswered}/${QUESTIONS.length}`;
    els.progressBar.style.width = `${Math.round((bothAnswered/QUESTIONS.length)*100)}%`;
  }
  function groupedQuestions(){
    return QUESTIONS.reduce((acc,q,idx)=>{ (acc[q.category] ||= []).push({...q, globalIndex:idx}); return acc; }, {});
  }
  function categoryStats(items){
    const mine=items.filter(q=>myAnswer(q.id)).length, theirs=items.filter(q=>otherAnswer(q.id)).length, both=items.filter(q=>myAnswer(q.id)&&otherAnswer(q.id)).length;
    let points=0; items.forEach(q=>{ const a=myAnswer(q.id), b=otherAnswer(q.id); if(a&&b) points += compare(q,a,b).points; });
    return {mine,theirs,both,total:items.length,score:both ? Math.round((points/items.length)*100) : 0};
  }
  function renderQuestions(){
    els.questionArea.classList.toggle('card-mode', state.cardMode);
    els.questionArea.innerHTML='';
    const grouped = groupedQuestions();
    Object.entries(grouped).forEach(([category, items])=>{
      const stats=categoryStats(items);
      const open=state.openCategories.has(category);
      const section=document.createElement('section');
      section.className=`category-section ${open?'open':''}`;
      section.innerHTML=`<button class="category-toggle" type="button"><div><span class="chev">${open?'▾':'▸'}</span><strong>${escapeHtml(category)}</strong><em>${stats.mine}/${stats.total} answered by you • ${stats.theirs}/${stats.total} by other</em></div><span class="category-score ${stats.both===stats.total?'unlocked':''}">${stats.both===stats.total ? `${stats.score}%` : `${stats.both}/${stats.total}`}</span></button><div class="category-body"></div>`;
      section.querySelector('.category-toggle').onclick=()=>{ if(state.openCategories.has(category)) state.openCategories.delete(category); else state.openCategories.add(category); renderQuestions(); };
      const body=section.querySelector('.category-body');
      if(open){
        items.forEach(q=>{
          const mine=myAnswer(q.id), theirs=otherAnswer(q.id), c=compare(q,mine,theirs);
          const card=document.createElement('article'); card.className=`q-card ${c.kind} ${q.custom?'custom-card':''}`;
          const choices=getOptions(q).map(o=>`<button class="choice ${mine?.answer_value===o.label?'selected':''}" data-value="${escapeHtml(o.label)}">${escapeHtml(o.label)}</button>`).join('');
          let reveal = '';
          if(mine && theirs) reveal = `<div class="reveal"><strong>Your answer:</strong> ${escapeHtml(mine.answer_value)}<br><strong>${escapeHtml(participantName(theirs.user_id))}:</strong> ${escapeHtml(theirs.answer_value)}</div>`;
          else if(mine) reveal = `<div class="reveal">Your answer is saved. Waiting for the other answer before revealing overlap.</div>`;
          card.innerHTML = `<div class="q-head"><div><div class="q-category">${q.globalIndex+1} / ${QUESTIONS.length} • ${escapeHtml(q.category)}</div></div><span class="status-pill ${c.kind}">${escapeHtml(c.label)}</span></div><div class="q-text">${escapeHtml(q.text)}</div><div class="choices">${choices}</div>${reveal}`;
          card.querySelectorAll('.choice').forEach(btn=>btn.onclick=()=>saveAnswer(q.id, btn.dataset.value));
          body.appendChild(card);
        });
      }
      els.questionArea.appendChild(section);
    });
  }
  async function saveAnswer(questionId, answerValue){
    const payload={ session_id:state.activeSession.id, user_id:state.user.id, question_id:questionId, answer_value:answerValue };
    const { error } = await sb.from('bcc_answers').upsert(payload, { onConflict:'session_id,user_id,question_id' });
    if(error) return toast(error.message);
    const existing=state.answers.find(a=>a.session_id===payload.session_id && a.user_id===payload.user_id && a.question_id===payload.question_id);
    if(existing) existing.answer_value=answerValue; else state.answers.push({...payload});
    renderSession();
  }

  function renderFinal(){
    const both = QUESTIONS.map(q=>({q,a:myAnswer(q.id),b:otherAnswer(q.id)})).filter(x=>x.a&&x.b);
    if(!both.length){ els.finalScoreCard.classList.add('hidden'); return; }
    let points=0; const favorites=[], curiosities=[], starters=[], differences=[];
    both.forEach(x=>{ const r=compare(x.q,x.a,x.b); points+=r.points; const am=optionMeta(x.q,x.a.answer_value), bm=optionMeta(x.q,x.b.answer_value);
      if(r.kind==='match') favorites.push(x.q.text); else if(r.kind==='curious') curiosities.push(x.q.text); else differences.push(x.q.text);
      if((am?.score>=3 && bm?.score===2) || (bm?.score>=3 && am?.score===2)) starters.push(x.q.text);
    });
    const score=Math.round((points/QUESTIONS.length)*100);
    const list=arr=>arr.slice(0,8).map(t=>`<li>${escapeHtml(t)}</li>`).join('') || '<li>Nothing here yet.</li>';
    const complete = both.length === QUESTIONS.length;
    els.finalScoreCard.innerHTML=`<div class="score-grid"><div><p class="eyebrow">${complete?'Final reveal':'Live reveal'}</p><div class="score-number">${score}%</div><p class="muted">Overall overlap so far</p><p class="muted small">${both.length}/${QUESTIONS.length} mutually answered</p></div><div><h3>Your private results</h3><p class="muted">Results update as both people answer. Category scores unlock inside each collapsible section.</p><div class="result-columns"><div class="result-box"><h4>🔥 Mutual favorites</h4><ul>${list(favorites)}</ul></div><div class="result-box"><h4>👀 Shared curiosities</h4><ul>${list(curiosities)}</ul></div><div class="result-box"><h4>💬 Conversation starters</h4><ul>${list(starters)}</ul></div><div class="result-box"><h4>⚡ Different preferences</h4><ul>${list(differences)}</ul></div></div></div></div>`;
    els.finalScoreCard.classList.remove('hidden');
  }

  function showInvite(){ els.inviteBox.classList.toggle('hidden'); els.inviteLinkInput.value=appUrlForSession(state.activeSession.id); els.inviteLinkInput.select(); }
  async function copyInvite(){ els.inviteLinkInput.value=appUrlForSession(state.activeSession.id); await navigator.clipboard.writeText(els.inviteLinkInput.value); toast('Invite link copied.'); }
  window.addEventListener('popstate',()=>bootForUser());
  init();
})();
