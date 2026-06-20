const CQ={
  content:null,user:null,profile:null,
  state:{xp:0,level:1,completedAreas:[],answers:{},secrets:{},view:'home'},
  sb:null,authReady:false
};
CQ.cfg=()=>window.CQ_CONFIG||window.COMPAT_CONFIG||{};
CQ.key=()=>`cq_state_${CQ.user?.id||'local'}`;
CQ.init=async()=>{
  const cfg=CQ.cfg();
  const key=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY;
  CQ.sb=(window.supabase&&cfg.SUPABASE_URL&&key&&!cfg.SUPABASE_URL.includes('YOUR-'))?window.supabase.createClient(cfg.SUPABASE_URL,key):null;
  CQ.content=await fetch('game-content.json',{cache:'no-store'}).then(r=>r.json());
  CQ.state=JSON.parse(localStorage.getItem('cq_state_local')||JSON.stringify(CQ.state));
  if(CQ.sb){
    const {data,error}=await CQ.sb.auth.getSession();
    if(error) CQ.toast(error.message);
    CQ.user=data.session?.user||null;
    CQ.sb.auth.onAuthStateChange(async(_event,session)=>{CQ.user=session?.user||null; await CQ.afterAuth(); CQ.render();});
    await CQ.afterAuth();
  }
  CQ.render();
};
CQ.afterAuth=async()=>{
  if(!CQ.user||!CQ.sb) return;
  localStorage.setItem('cq_last_user',CQ.user.id);
  await CQ.loadRemote();
};
CQ.loadRemote=async()=>{
  if(!CQ.sb||!CQ.user) return;
  let {data:profile}=await CQ.sb.from('cq_profiles').select('*').eq('user_id',CQ.user.id).maybeSingle();
  CQ.profile=profile||null;
  let {data:prog}=await CQ.sb.from('cq_progress').select('*').eq('user_id',CQ.user.id).maybeSingle();
  if(prog){CQ.state.xp=prog.xp||0;CQ.state.level=prog.level||1;CQ.state.completedAreas=prog.completed_areas||[];}
  let {data:secs}=await CQ.sb.from('cq_secret_answers').select('secret_id,answer_value').eq('user_id',CQ.user.id);
  if(secs) CQ.state.secrets=Object.fromEntries(secs.map(s=>[s.secret_id,s.answer_value]));
  localStorage.setItem(CQ.key(),JSON.stringify(CQ.state));
};
CQ.save=async()=>{
  localStorage.setItem(CQ.user?CQ.key():'cq_state_local',JSON.stringify(CQ.state));
  if(CQ.sb&&CQ.user){
    await CQ.sb.from('cq_progress').upsert({user_id:CQ.user.id,xp:CQ.state.xp,level:CQ.state.level,completed_areas:CQ.state.completedAreas,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  }
};
CQ.ensureProfile=async(name)=>{
  if(!CQ.sb||!CQ.user) return;
  name=(name||'').trim()||CQ.user.user_metadata?.full_name||CQ.user.email?.split('@')[0]||'Explorer';
  const {data,error}=await CQ.sb.from('cq_profiles').upsert({user_id:CQ.user.id,display_name:name,email:CQ.user.email,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select().single();
  if(error) CQ.toast(error.message); else {CQ.profile=data;CQ.render();}
};
CQ.levelFromXP=xp=>{let l=1;(CQ.content.settings.levelCurve||[]).forEach((v,i)=>{if(xp>=v)l=i+1});return l};
CQ.addXP=async n=>{CQ.state.xp+=n;const old=CQ.state.level;CQ.state.level=CQ.levelFromXP(CQ.state.xp);await CQ.save();CQ.toast(old<CQ.state.level?`Level up — Level ${CQ.state.level}`:`+${n} XP`);};
CQ.signIn=async()=>{if(!CQ.sb)return CQ.toast('Supabase config is missing.');const {error}=await CQ.sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)CQ.toast(error.message)};
CQ.signOut=async()=>{if(CQ.sb)await CQ.sb.auth.signOut();CQ.user=null;CQ.profile=null;CQ.state.view='home';CQ.render()};
CQ.secretCount=()=>Object.values(CQ.state.secrets||{}).filter(v=>String(v||'').trim()).length;
CQ.areaUnlocked=a=>CQ.state.level>=a.unlock.level&&CQ.state.xp>=a.unlock.xp&&CQ.secretCount()>=a.unlock.secrets&&(a.unlock.completedAreas||[]).every(id=>CQ.state.completedAreas.includes(id));
CQ.requiresStarter=()=>CQ.secretCount()>=CQ.content.settings.starterSecretMinimum;
CQ.render=()=>{const app=document.getElementById('app');if(CQ.user&&!CQ.profile)return CQ.renderProfile(app);if(CQ.state.view==='app')return CQ.renderApp(app);return CQ.renderLanding(app)};
CQ.renderLanding=app=>{app.innerHTML=`
<section class="landing">
  <div class="nav"><div class="brand"><span>✦</span> Connection Quest</div><div class="nav-actions">${CQ.user?`<button class="small ghost" onclick="CQ.state.view='app';CQ.render()">Enter App</button><button class="small ghost" onclick="CQ.signOut()">Sign Out</button>`:`<button class="small ghost" onclick="CQ.signIn()">Login with Google</button>`}</div></div>
  <div class="hero2">
    <div class="hero-copy">
      <div class="eyebrow">Private two-person compatibility game</div>
      <h1>Discover chemistry through quests, secrets, and unlockable worlds.</h1>
      <p class="sub big">A polished intimacy game for adults built around attraction, trust, communication, boundaries, fantasy, and bedroom compatibility — without feeling like a boring form.</p>
      <div class="cta-row"><button onclick="${CQ.user?"CQ.state.view='app';CQ.render()":"CQ.signIn()"}">${CQ.user?'Continue Quest':'Login & Start'}</button><button class="ghost" onclick="CQ.state.view='app';CQ.render()">Preview Local Mode</button></div>
      <div class="trust-row"><span>🔐 Supabase login restored</span><span>🎮 XP + unlocks</span><span>🖤 Private secret vault</span></div>
    </div>
    <div class="phone-card">
      <div class="phone-top"><span></span><span></span><span></span></div>
      <div class="level-ring"><b>Lv ${CQ.state.level}</b><small>${CQ.state.xp} XP</small></div>
      <h2>Chemistry Map</h2><p class="sub">Unlock Attraction, Trust, Fantasy, and Bedroom Builder as both players progress.</p>
      <div class="mini-worlds"><div>Intro</div><div>Attraction</div><div>Trust</div><div class="locked-mini">Bedroom</div></div>
    </div>
  </div>
</section>`};
CQ.renderProfile=app=>{app.innerHTML=`<section class="landing"><div class="profile-card card"><h1>Create your explorer profile</h1><p class="sub">This is required once after login so your connection can save correctly.</p><input id="displayName" placeholder="Display name" value="${CQ.user?.user_metadata?.full_name||''}"><button onclick="CQ.ensureProfile(document.getElementById('displayName').value)">Save Profile</button><button class="ghost" onclick="CQ.signOut()">Sign Out</button></div></section>`};
CQ.renderApp=app=>{app.innerHTML=`<div class="top"><div class="topin"><b>Connection Quest</b><div class="topstats"><span class="pill">${CQ.profile?.display_name||'Local Explorer'}</span><span class="pill">Lv ${CQ.state.level}</span><span class="pill">${CQ.state.xp} XP</span><span class="pill">${CQ.secretCount()} secrets</span><button class="small ghost" onclick="CQ.openSecrets()">Secret Vault</button><button class="small ghost" onclick="CQ.connectGate()">Connect</button></div></div></div><div class="wrap dash"><aside class="side card"><button class="navbtn" onclick="CQ.renderMap()">Quest Map</button><button class="navbtn" onclick="CQ.openSecrets()">Secret Vault</button><button class="navbtn" onclick="CQ.openBedroom()">Bedroom Builder</button><button class="navbtn" onclick="CQ.state.view='home';CQ.render()">Landing</button>${CQ.user?'<button class="navbtn" onclick="CQ.signOut()">Sign Out</button>':''}<hr><p class="tiny">Connecting and private compatibility challenges require ${CQ.content.settings.starterSecretMinimum} starter secrets.</p></aside><main id="main"></main></div>`;CQ.renderMap()};
CQ.renderMap=()=>{let main=document.getElementById('main');main.innerHTML=`<h1>Quest Map</h1><p class="sub">Every area, rule, challenge, and secret is editable in the desktop dashboard editor.</p><div class="grid">${CQ.content.areas.map(a=>{let u=CQ.areaUnlocked(a), done=CQ.state.completedAreas.includes(a.id);return `<div class="card area ${u?'':'locked'}"><div class="icon">${a.icon}</div><h2>${a.name}</h2><div class="tag">${a.subtitle}</div><p class="sub">${a.description}</p><p class="tiny">Unlock: Lv ${a.unlock.level} · ${a.unlock.xp} XP · ${a.unlock.secrets} secrets ${a.unlock.completedAreas?.length?'· after '+a.unlock.completedAreas.join(', '):''}</p><button class="${u?'':'ghost'}" onclick="CQ.startArea('${a.id}')">${done?'Replay':u?'Enter':'Locked'}</button></div>`}).join('')}</div>`};
CQ.startArea=id=>{let a=CQ.content.areas.find(x=>x.id===id);if(!CQ.areaUnlocked(a))return CQ.block(`Locked: ${a.name}`,`Needs Level ${a.unlock.level}, ${a.unlock.xp} XP, ${a.unlock.secrets} secrets, and required areas completed.`);let ch=CQ.content.challenges.find(c=>c.areaId===id);CQ.playChallenge(ch,0,{})};
CQ.playChallenge=(ch,idx,session)=>{if(!ch)return CQ.renderMap();if(ch.requiresSecrets&&!CQ.requiresStarter())return CQ.block('Secret Vault Required','This challenge uses private compatibility context. Complete the starter secrets first.');let q=ch.questions[idx];let main=document.getElementById('main');if(!q){if(!CQ.state.completedAreas.includes(ch.areaId))CQ.state.completedAreas.push(ch.areaId);CQ.addXP(ch.xpReward);CQ.save();return CQ.renderMap()}let renderOpts='';if(['single','yesno'].includes(q.type))renderOpts=(q.options||['Yes','No']).map(o=>`<div class="ans" onclick="CQ.answer('${ch.id}',${idx},${JSON.stringify(o).replace(/"/g,'&quot;')})">${o}</div>`).join('');else if(q.type==='multi')renderOpts=(q.options||[]).map(o=>`<label class="ans"><input type="checkbox" value="${o}"> ${o}</label>`).join('')+`<button onclick="CQ.answerMulti('${ch.id}',${idx})">Submit</button>`;else if(q.type==='scale')renderOpts=`<input type="range" min="1" max="10" value="5" id="scale"><div class="tiny">${q.lowLabel||'Low'} ← → ${q.highLabel||'High'}</div><button onclick="CQ.answer('${ch.id}',${idx},document.getElementById('scale').value)">Submit</button>`;else if(q.type==='boundary')renderOpts=`${q.items.map(it=>`<div class="secret-row"><b>${it}</b><select data-boundary="${it}">${q.options.map(o=>`<option>${o}</option>`).join('')}</select></div>`).join('')}<button onclick="CQ.answerBoundary('${ch.id}',${idx})">Submit</button>`;else renderOpts=`<textarea id="txt" maxlength="${CQ.content.settings.storageCaps.textAnswerMaxChars}" placeholder="Answer privately..."></textarea><button onclick="CQ.answer('${ch.id}',${idx},document.getElementById('txt').value)">Submit</button>`;main.innerHTML=`<div class="card quest-card"><div class="tag">${ch.title}</div><h1>${q.prompt}</h1>${q.prompt.includes('CUSTOM_REPLACE')?'<p class="replace">Marked for your replacement in the admin editor.</p>':''}<div class="answers">${renderOpts}</div><button class="ghost" onclick="CQ.playChallenge(CQ.content.challenges.find(c=>c.id==='${ch.id}'),${idx+1},{})">Skip Card</button></div>`};
CQ.answer=async(chid,idx,val)=>{CQ.state.answers[`${chid}_${idx}`]=String(val).slice(0,CQ.content.settings.storageCaps.textAnswerMaxChars);await CQ.save();CQ.playChallenge(CQ.content.challenges.find(c=>c.id===chid),idx+1,{})};
CQ.answerMulti=(chid,idx)=>{let vals=[...document.querySelectorAll('input[type=checkbox]:checked')].map(x=>x.value);CQ.answer(chid,idx,vals.join('|'))};
CQ.answerBoundary=(chid,idx)=>{let vals={};document.querySelectorAll('[data-boundary]').forEach(s=>vals[s.dataset.boundary]=s.value);CQ.answer(chid,idx,JSON.stringify(vals))};
CQ.openSecrets=()=>{let body=`<h1>Secret Vault</h1><p class="sub">Complete at least ${CQ.content.settings.starterSecretMinimum} to connect. You can skip for now; partial answers are saved.</p>${CQ.content.secrets.map(s=>`<div class="secret-row"><div class="tag">${s.category} · Lv ${s.unlockLevel}</div><label>${s.prompt}</label><textarea maxlength="${CQ.content.settings.storageCaps.secretMaxChars}" data-secret="${s.id}">${CQ.state.secrets[s.id]||''}</textarea></div>`).join('')}<button onclick="CQ.saveSecrets()">Save Secrets</button> <button class="ghost" onclick="CQ.closeModal()">Skip For Now</button>`;CQ.modal(body)};
CQ.saveSecrets=async()=>{let rows=[];document.querySelectorAll('[data-secret]').forEach(t=>{if(t.value.trim()){let v=t.value.trim().slice(0,CQ.content.settings.storageCaps.secretMaxChars);CQ.state.secrets[t.dataset.secret]=v;if(CQ.user)rows.push({user_id:CQ.user.id,secret_id:t.dataset.secret,answer_value:v,updated_at:new Date().toISOString()});}});if(CQ.sb&&CQ.user&&rows.length){const {error}=await CQ.sb.from('cq_secret_answers').upsert(rows,{onConflict:'user_id,secret_id'});if(error)CQ.toast(error.message)}await CQ.addXP(25);await CQ.save();CQ.closeModal();CQ.renderMap()};
CQ.connectGate=async()=>{if(!CQ.requiresStarter())return CQ.block('Complete Starter Secrets','Connecting requires at least 4 starter secrets so the compatibility engine has meaningful private context. Your partial answers are saved.');if(!CQ.user)return CQ.modal('<h1>Login Required</h1><p class="sub">Preview mode is local only. Login with Google to create or join a real connection.</p><button onclick="CQ.signIn()">Login with Google</button> <button class="ghost" onclick="CQ.closeModal()">Not Now</button>');if(CQ.sb){const {data,error}=await CQ.sb.from('cq_connections').insert({owner_id:CQ.user.id,status:'open'}).select().single();if(error)return CQ.toast(error.message);return CQ.modal(`<h1>Connection Created</h1><p class="sub">Invite code:</p><h2>${data.invite_code}</h2><p class="tiny">Partner join flow can be expanded next; the Supabase write is working.</p><button onclick="CQ.closeModal()">Done</button>`)}CQ.modal('<h1>Connection Ready</h1><p class="sub">Local mode confirms the gate works.</p><button onclick="CQ.closeModal()">Continue</button>')};
CQ.openBedroom=()=>{let a=CQ.content.areas.find(x=>x.id==='bedroom_builder');if(!a)return CQ.block('Bedroom Builder Missing','No bedroom_builder area exists in game-content.json.');if(!CQ.areaUnlocked(a))return CQ.block('Bedroom Builder Locked','Complete trust, fantasy, and starter secret requirements first.');CQ.startArea('bedroom_builder')};
CQ.block=(title,msg)=>CQ.modal(`<h1>${title}</h1><p class="sub">${msg}</p><button onclick="CQ.openSecrets()">Open Secret Vault</button> <button class="ghost" onclick="CQ.closeModal()">Not Now</button>`);
CQ.modal=html=>{document.getElementById('modalBody').innerHTML=html;document.getElementById('modal').classList.remove('hidden')};CQ.closeModal=()=>document.getElementById('modal').classList.add('hidden');CQ.toast=m=>{let t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3500)};
window.addEventListener('load',CQ.init);window.CQ=CQ;
