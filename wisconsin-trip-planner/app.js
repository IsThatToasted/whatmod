(() => {
  'use strict';

  if (window.__BCC_APP_STARTED__) return;
  window.__BCC_APP_STARTED__ = true;

  const CONFIG = window.COMPAT_CONFIG || window.TRIP_CONFIG || {};
  const SUPABASE_URL = CONFIG.SUPABASE_URL || '';
  const SUPABASE_KEY = CONFIG.SUPABASE_PUBLISHABLE_KEY || CONFIG.SUPABASE_ANON_KEY || '';
  const bccSupabase = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY);

  const QUESTIONS = [
    { id: 'cuddling', category: 'Affection', text: 'How important is cuddling or physical closeness to you?', options: ['Not important', 'Nice sometimes', 'Very important', 'Essential'], compatible: 'same_or_close' },
    { id: 'frequency', category: 'Desire', text: 'How often would you ideally want intimate connection?', options: ['Rarely', 'Monthly', 'Weekly', 'Several times weekly', 'Daily'], compatible: 'same_or_close' },
    { id: 'initiation', category: 'Initiation', text: 'How do you feel about initiating intimacy?', options: ['I prefer partner initiates', 'Either is fine', 'I like initiating', 'I want a balance'], compatible: 'overlap' },
    { id: 'aftercare', category: 'Care', text: 'Do you like reassurance, cuddling, or check-ins afterward?', options: ['No need', 'Sometimes', 'Usually', 'Always'], compatible: 'same_or_close' },
    { id: 'texting', category: 'Long distance', text: 'Are flirty messages helpful when apart?', options: ['No', 'Sometimes', 'Often', 'Very much'], compatible: 'same_or_close' },
    { id: 'video_dates', category: 'Long distance', text: 'How do you feel about planned video date nights?', options: ['Not for me', 'Occasionally', 'Weekly', 'As often as possible'], compatible: 'same_or_close' },
    { id: 'surprises', category: 'Romance', text: 'Do surprise romantic gestures excite you?', options: ['Not really', 'Small surprises', 'Thoughtful surprises', 'Big romantic surprises'], compatible: 'same_or_close' },
    { id: 'privacy', category: 'Boundaries', text: 'How private should your intimate life stay?', options: ['Very private', 'Mostly private', 'Open with close friends', 'Not very private'], compatible: 'same_or_close' },
    { id: 'new_things', category: 'Exploration', text: 'How open are you to trying new intimate ideas together?', options: ['Not open', 'Slowly', 'Pretty open', 'Very open'], compatible: 'same_or_close' },
    { id: 'planning', category: 'Planning', text: 'Do you prefer intimacy to be spontaneous or planned?', options: ['Fully spontaneous', 'Mostly spontaneous', 'A mix', 'Mostly planned'], compatible: 'same_or_close' },
    { id: 'communication', category: 'Communication', text: 'How directly do you want to discuss needs and boundaries?', options: ['Very gently', 'Somewhat directly', 'Directly', 'Very directly'], compatible: 'same_or_close' },
    { id: 'rejection', category: 'Safety', text: 'How should a partner handle “not tonight”?', options: ['Give space', 'Offer affection', 'Talk briefly', 'Ask what I need'], compatible: 'overlap' },
    { id: 'affection_public', category: 'Affection', text: 'How do you feel about public affection?', options: ['No thanks', 'Hand holding only', 'Some affection', 'Very affectionate'], compatible: 'same_or_close' },
    { id: 'gifts', category: 'Romance', text: 'Do gifts help you feel desired and thought of?', options: ['Not much', 'Sometimes', 'Yes', 'A lot'], compatible: 'same_or_close' },
    { id: 'distance_support', category: 'Long distance', text: 'When apart, what helps you feel most connected?', options: ['Texts', 'Calls', 'Video dates', 'Shared plans'], compatible: 'overlap' }
  ];

  const $ = id => document.getElementById(id);
  const ids = ['loadingView','signedOutView','setupView','homeView','sessionView','loginBtn','logoutBtn','userBadge','displayNameInput','saveProfileBtn','createSessionBtn','sessionList','backBtn','copyInviteBtn','copyInviteBtn2','inviteLinkInput','inviteBox','sessionTitle','partnerLine','progressText','progressBar','syncStatus','questionArea','finalScoreCard','toggleViewBtn'];
  const els = ids.reduce((a, id) => (a[id] = $(id), a), {});

  const state = { user:null, profile:null, sessions:[], activeSession:null, members:[], answers:[], channel:null, cardMode:false, booting:false };

  function showToast(msg){ const t=$('toast'); if(!t) return alert(msg); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(showToast._timer); showToast._timer=setTimeout(()=>t.classList.add('hidden'),3200); }
  function showOnly(view){ ['loadingView','signedOutView','homeView','sessionView'].forEach(id=>els[id]?.classList.add('hidden')); if(view && els[view]) els[view].classList.remove('hidden'); }
  function appBaseUrl(){ return `${location.origin}${location.pathname}`; }
  function appUrlForSession(id){ const u = new URL(appBaseUrl()); u.searchParams.set('session', id); return u.toString(); }
  function currentSessionParam(){ return new URL(location.href).searchParams.get('session'); }
  function displayName(profile, user){ return profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Partner'; }
  function optionIndex(q, value){ return q.options.indexOf(value); }
  function isCompatible(q, a, b){ if(!a || !b) return null; if(a.answer_value === b.answer_value) return true; if(q.compatible === 'same_or_close') return Math.abs(optionIndex(q,a.answer_value)-optionIndex(q,b.answer_value)) <= 1; return false; }
  function participantName(userId){ const m=state.members.find(x=>x.user_id===userId); return m?.profile?.display_name || m?.profiles?.display_name || (userId===state.user?.id ? displayName(state.profile,state.user) : 'Partner'); }
  function escapeHtml(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function escapeAttr(s=''){ return escapeHtml(s).replace(/`/g,'&#96;'); }

  function requireClient(){
    if (!window.supabase) return 'Supabase JS did not load. Check your internet/CDN access.';
    if (!SUPABASE_URL || !SUPABASE_KEY) return 'Missing Supabase URL or publishable/anon key in config.js.';
    if (!bccSupabase) return 'Supabase client could not be created.';
    return '';
  }

  async function init(){
    const clientError = requireClient();
    if(clientError){ showOnly('signedOutView'); showToast(clientError); return; }
    const { data, error } = await bccSupabase.auth.getSession();
    if(error) showToast(error.message);
    state.user = data.session?.user || null;
    bccSupabase.auth.onAuthStateChange((_event, session)=>{ state.user = session?.user || null; bootForUser(); });
    await bootForUser();
  }

  async function bootForUser(){
    if(state.booting) return;
    state.booting = true;
    try {
      els.loginBtn?.classList.toggle('hidden', !!state.user);
      els.logoutBtn?.classList.toggle('hidden', !state.user);
      els.userBadge?.classList.toggle('hidden', !state.user);
      els.setupView?.classList.add('hidden');
      if(!state.user){ showOnly('signedOutView'); return; }
      els.userBadge.textContent = displayName(state.profile,state.user);
      showOnly('loadingView');
      await loadProfile();
      if(!state.profile){
        els.displayNameInput.value = displayName(null,state.user);
        els.setupView.classList.remove('hidden');
        showOnly(null);
        return;
      }
      els.userBadge.textContent = displayName(state.profile,state.user);
      const sessionFromUrl = currentSessionParam();
      if(sessionFromUrl) await openSession(sessionFromUrl, true);
      else { await loadSessions(); showOnly('homeView'); }
    } finally {
      state.booting = false;
    }
  }

  async function loadProfile(){
    const { data, error } = await bccSupabase.from('bcc_profiles').select('*').eq('user_id', state.user.id).maybeSingle();
    if(error){ console.warn(error); showToast(error.message); }
    state.profile = data || null;
  }

  async function saveProfile(){
    const name = els.displayNameInput.value.trim();
    if(!name) return showToast('Enter a display name.');
    const { data, error } = await bccSupabase.from('bcc_profiles').upsert({ user_id: state.user.id, display_name:name, email:state.user.email }, { onConflict:'user_id' }).select().single();
    if(error) return showToast(error.message);
    state.profile=data;
    showToast('Profile saved.');
    await bootForUser();
  }

  async function login(){
    const redirectTo = location.href;
    const { error } = await bccSupabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } });
    if(error) showToast(error.message);
  }

  async function logout(){ await bccSupabase.auth.signOut(); }

  async function createSession(){
    const title = `${displayName(state.profile,state.user)}'s Compatibility Builder`;
    const { data, error } = await bccSupabase.from('bcc_sessions').insert({ owner_id:state.user.id, title }).select().single();
    if(error) return showToast(error.message);
    const { error: memberError } = await bccSupabase.from('bcc_session_members').insert({ session_id:data.id, user_id:state.user.id, role:'owner' });
    if(memberError) return showToast(memberError.message);
    history.pushState(null,'',appUrlForSession(data.id));
    await openSession(data.id, false);
  }

  async function loadSessions(){
    const { data, error } = await bccSupabase.from('bcc_session_members').select('session_id, role, created_at, bcc_sessions(*)').eq('user_id', state.user.id).order('created_at',{ascending:false});
    if(error){ showToast(error.message); return; }
    state.sessions = data || [];
    renderSessionList();
  }

  function renderSessionList(){
    els.sessionList.innerHTML = '';
    if(!state.sessions.length){ els.sessionList.innerHTML = '<p class="muted">No builders yet. Create one and send the invite link.</p>'; return; }
    state.sessions.forEach(row=>{
      const s=row.bcc_sessions;
      if(!s) return;
      const div=document.createElement('div'); div.className='session-item';
      div.innerHTML=`<div><strong>${escapeHtml(s.title||'Compatibility Builder')}</strong><span class="muted small">${new Date(s.created_at).toLocaleDateString()}</span></div><button class="btn ghost">Open</button>`;
      div.querySelector('button').onclick=()=>{ history.pushState(null,'',appUrlForSession(s.id)); openSession(s.id,false); };
      els.sessionList.appendChild(div);
    });
  }

  async function openSession(id, joining){
    showOnly('loadingView');
    const { data: session, error } = await bccSupabase.from('bcc_sessions').select('*').eq('id', id).maybeSingle();
    if(error || !session){ showToast(error?.message || 'Could not open that builder.'); history.replaceState(null,'',appBaseUrl()); await loadSessions(); showOnly('homeView'); return; }
    const { data: existing, error: existingError } = await bccSupabase.from('bcc_session_members').select('*').eq('session_id',id).eq('user_id',state.user.id).maybeSingle();
    if(existingError) console.warn(existingError);
    if(!existing){
      const { error: joinErr } = await bccSupabase.from('bcc_session_members').insert({ session_id:id, user_id:state.user.id, role:'partner' });
      if(joinErr){ showToast(joinErr.message); history.replaceState(null,'',appBaseUrl()); await loadSessions(); showOnly('homeView'); return; }
      if(joining) showToast('Joined builder.');
    }
    state.activeSession=session;
    await refreshSessionData();
    subscribeSession(id);
    showOnly('sessionView');
    renderSession();
  }

  async function refreshSessionData(){
    const id=state.activeSession.id;
    const [membersRes, answersRes] = await Promise.all([
      bccSupabase.from('bcc_session_members').select('*, profile:bcc_profiles(display_name,email)').eq('session_id',id).order('created_at'),
      bccSupabase.from('bcc_answers').select('*').eq('session_id',id)
    ]);
    if(membersRes.error){ console.warn(membersRes.error); showToast(membersRes.error.message); }
    if(answersRes.error){ console.warn(answersRes.error); showToast(answersRes.error.message); }
    state.members=membersRes.data||[];
    state.answers=answersRes.data||[];
  }

  function subscribeSession(id){
    if(state.channel) bccSupabase.removeChannel(state.channel);
    state.channel = bccSupabase.channel(`bcc-${id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'bcc_answers',filter:`session_id=eq.${id}`}, async()=>{ els.syncStatus.textContent='Updated just now'; await refreshSessionData(); renderSession(); })
      .on('postgres_changes',{event:'*',schema:'public',table:'bcc_session_members',filter:`session_id=eq.${id}`}, async()=>{ await refreshSessionData(); renderSession(); })
      .subscribe(status=>{ els.syncStatus.textContent = status === 'SUBSCRIBED' ? 'Live sync active' : 'Connecting live sync…'; });
  }

  function renderSession(){
    const s=state.activeSession; if(!s) return;
    els.sessionTitle.textContent=s.title || 'Compatibility Builder';
    const partner = state.members.find(m=>m.user_id!==state.user.id);
    els.partnerLine.textContent = partner ? `Connected with ${participantName(partner.user_id)}` : 'Waiting for your partner to join from the invite link.';
    els.inviteLinkInput.value=appUrlForSession(s.id);
    els.inviteBox.classList.toggle('hidden', !!partner);
    els.questionArea.classList.toggle('card-mode', state.cardMode);
    els.toggleViewBtn.textContent = state.cardMode ? 'List view' : 'Card view';
    renderProgress();
    renderQuestions();
  }

  function answersFor(qid){ return state.answers.filter(a=>a.question_id===qid); }
  function myAnswer(qid){ return state.answers.find(a=>a.question_id===qid && a.user_id===state.user.id); }

  function renderProgress(){
    const both = QUESTIONS.filter(q=>answersFor(q.id).length>=2).length;
    els.progressText.textContent = `${both} of ${QUESTIONS.length} answered by both people`;
    els.progressBar.style.width = `${Math.round((both/QUESTIONS.length)*100)}%`;
    if(both === QUESTIONS.length){
      const matches = QUESTIONS.filter(q=>{ const a=answersFor(q.id); return isCompatible(q,a[0],a[1]); }).length;
      const pct = Math.round((matches / QUESTIONS.length) * 100);
      els.finalScoreCard.classList.remove('hidden');
      els.finalScoreCard.innerHTML = `<p class="eyebrow">Final reveal</p><h2>Compatibility Score</h2><div class="score-number">${pct}%</div><p class="muted">${matches} positive compatibility cards and ${QUESTIONS.length-matches} mismatch cards.</p>`;
    } else {
      els.finalScoreCard.classList.add('hidden');
    }
  }

  function renderQuestions(){
    els.questionArea.innerHTML='';
    QUESTIONS.forEach((q,i)=>{
      const all=answersFor(q.id);
      const mine=myAnswer(q.id);
      const both=all.length>=2;
      const comp=both ? isCompatible(q,all[0],all[1]) : null;
      const cls = both ? (comp?'match':'miss') : 'waiting';
      const status = both ? (comp?'Compatible':'Not compatible') : (mine?'Waiting for partner':'Your answer needed');
      const div=document.createElement('article'); div.className=`q-card ${cls}`;
      div.innerHTML=`
        <div class="q-head"><span class="q-category">${i+1}. ${escapeHtml(q.category)}</span><span class="status-pill ${cls}">${status}</span></div>
        <div class="q-text">${escapeHtml(q.text)}</div>
        <div class="choices">${q.options.map(opt=>`<button class="choice ${mine?.answer_value===opt?'selected':''}" data-value="${escapeAttr(opt)}">${escapeHtml(opt)}</button>`).join('')}</div>
        ${both ? `<div class="reveal"><strong>${comp?'Overlap found':'Mismatch found'}:</strong> ${escapeHtml(participantName(all[0].user_id))} chose “${escapeHtml(all[0].answer_value)}” and ${escapeHtml(participantName(all[1].user_id))} chose “${escapeHtml(all[1].answer_value)}”.</div>` : `<div class="reveal">${mine?'Your answer is saved. Your partner can answer later.':'Choose your answer privately.'}</div>`}
      `;
      div.querySelectorAll('.choice').forEach(btn=>btn.onclick=()=>saveAnswer(q.id, btn.dataset.value));
      els.questionArea.appendChild(div);
    });
  }

  async function saveAnswer(question_id, answer_value){
    const { error } = await bccSupabase.from('bcc_answers').upsert({ session_id:state.activeSession.id, user_id:state.user.id, question_id, answer_value }, { onConflict:'session_id,user_id,question_id' });
    if(error) return showToast(error.message);
    await refreshSessionData();
    renderSession();
  }

  async function copyInvite(){
    await navigator.clipboard.writeText(appUrlForSession(state.activeSession.id));
    showToast('Invite link copied.');
  }

  function goHome(){
    if(state.channel) bccSupabase.removeChannel(state.channel);
    state.activeSession=null;
    history.pushState(null,'',appBaseUrl());
    loadSessions().then(()=>showOnly('homeView'));
  }

  function bind(){
    els.loginBtn.onclick=login;
    els.logoutBtn.onclick=logout;
    els.saveProfileBtn.onclick=saveProfile;
    els.createSessionBtn.onclick=createSession;
    els.backBtn.onclick=goHome;
    els.copyInviteBtn.onclick=copyInvite;
    els.copyInviteBtn2.onclick=copyInvite;
    els.toggleViewBtn.onclick=()=>{state.cardMode=!state.cardMode;renderSession();};
    window.addEventListener('popstate',()=>bootForUser());
  }

  bind();
  init();
})();
