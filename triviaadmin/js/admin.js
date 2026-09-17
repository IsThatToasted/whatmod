const config = window.TRIVIA_CONFIG || {};
const ADMIN_CATEGORIES=["Brainrot","General Gaming Knowledge","Internet Culture","Pop Culture","Movies & TV","Music","Food & Brands","General Knowledge","Science","Technology","History","Geography","Animals","Space","Sports","Entertainment","Business"];
const $=(s,e=document)=>e.querySelector(s);
const $$=(s,e=document)=>[...e.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""),location.origin);if(!['http:','https:'].includes(u.protocol))return'';if(u.protocol==='http:')u.protocol='https:';return u.href}catch{return''}};
const fmt=n=>Number(n||0).toLocaleString();
const formatBytes=n=>{const v=Number(n||0);if(v<1024)return `${v} B`;if(v<1024**2)return `${(v/1024).toFixed(1)} KB`;if(v<1024**3)return `${(v/1024**2).toFixed(1)} MB`;return `${(v/1024**3).toFixed(2)} GB`};
let supabase=null, session=null, detail=null, liveCandidates=[];
let filters={search:'',media_filter:'all',provider:'',category:'',offset:0,limit:40};
let adminSection='media';
let questionDetail=null;
let questionFilters={search:'',category:'',difficulty:'any',status:'active',source:'',offset:0,limit:50};
let auditFilters={search:'',action:'all',offset:0,limit:100};
let voteFilters={direction:-1,search:'',status:'all',offset:0,limit:75};
let liveOpsTimer=null;
let categoryPopulation=[];

function toast(msg,tone=''){const n=document.createElement('div');n.className=`toast ${tone}`;n.textContent=msg;$('#toast-root').appendChild(n);setTimeout(()=>n.remove(),3200)}
async function loadClient(){const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');supabase=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data}=await supabase.auth.getSession();session=data.session;supabase.auth.onAuthStateChange((_e,s)=>{session=s;if(!s)renderAuth()});}
function configured(){return config.supabaseUrl&&!String(config.supabaseUrl).includes('YOUR_PROJECT')&&config.supabasePublishableKey&&!String(config.supabasePublishableKey).includes('REPLACE_ME')}
async function rpc(name,args={}){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
async function signIn(){const redirectTo=new URL('./',location.href).href;const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});if(error)throw error}
async function signOut(){await supabase.auth.signOut();session=null;renderAuth()}
function renderAuth(message=''){document.body.classList.remove('ready');$('#admin-app').innerHTML=`<section class="auth panel"><div class="mark">?</div><div class="eyebrow">TRIVIA ADMIN</div><h1>Control center.</h1><p>${message?esc(message):'Sign in with the Google account that is marked as an admin in your Trivia profile.'}</p><button class="btn primary" id="login">Sign in with Google</button><a class="btn" href="../trivia/">Back to Trivia</a></section>`;$('#login').onclick=()=>signIn().catch(e=>toast(e.message,'bad'))}
function statusTag(q){const st=q.media_review_status||'unreviewed';const cls=q.image_url?(st==='approved'?'approved':'auto'):'missing';return `<span class="tag ${cls}">${esc(q.image_url?st.toUpperCase():'MISSING')}</span>${q.media_locked?'<span class="tag approved">LOCKED</span>':''}`}
function imgTag(url,alt=''){const src=safeUrl(url);return src?`<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}

function adminHeader(active='media'){return `<header class="top"><div class="brand"><i>?</i><span>Trivia Admin</span><small>${active.toUpperCase()}</small></div><nav class="admin-tabs"><button class="${active==='questions'?'active':''}" data-admin-tab="questions">Questions</button><button class="${active==='votes'?'active':''}" data-admin-tab="votes">Votes</button><button class="${active==='media'?'active':''}" data-admin-tab="media">Media</button><button class="${active==='live'?'active':''}" data-admin-tab="live">Live Ops</button><button class="${active==='changes'?'active':''}" data-admin-tab="changes">Changes</button></nav><div class="top-actions"><a class="btn tiny" href="../trivia/">Open Trivia</a><button class="btn tiny" id="refresh">Refresh</button><button class="btn tiny danger" id="logout">Sign out</button></div></header>`}
function bindAdminChrome(refreshFn){
  $$('[data-admin-tab]').forEach(b=>b.onclick=()=>{clearTimeout(liveOpsTimer);adminSection=b.dataset.adminTab;if(adminSection==='questions')renderQuestionExplorer();else if(adminSection==='votes')renderVoteReview();else if(adminSection==='live')renderLiveOps();else if(adminSection==='changes')renderAuditLog();else renderDashboard()});
  const r=$('#refresh');if(r)r.onclick=refreshFn;const l=$('#logout');if(l)l.onclick=()=>{clearTimeout(liveOpsTimer);signOut()};
}
function formatWhen(v){try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return String(v||'')}}

async function overview(){return await rpc('admin_media_overview')}
async function listQuestions(){return await rpc('admin_list_media_questions',{p_search:filters.search||null,p_media_filter:filters.media_filter,p_provider:filters.provider||null,p_category:filters.category||null,p_limit:filters.limit,p_offset:filters.offset})}
async function checkAdmin(){return await rpc('is_trivia_admin')}

function zeroCategoryRow(category){return {category,total_count:0,active_count:0,easy_count:0,medium_count:0,hard_count:0,valid_photo_count:0,missing_photo_count:0,retired_count:0,upvotes:0,downvotes:0}}
function normalizeCategoryPopulation(rows=[]){
  const map=new Map(ADMIN_CATEGORIES.map(c=>[c,zeroCategoryRow(c)]));
  for(const row of (rows||[])){const name=String(row?.category||'').trim();if(!name)continue;map.set(name,{...zeroCategoryRow(name),...(map.get(name)||{}),...row,category:name})}
  return [...map.values()].sort((a,b)=>{const ai=ADMIN_CATEGORIES.indexOf(a.category),bi=ADMIN_CATEGORIES.indexOf(b.category);if(ai>=0||bi>=0){if(ai<0)return 1;if(bi<0)return-1;return ai-bi}return a.category.localeCompare(b.category)});
}
async function loadCategoryPopulation(){
  try{categoryPopulation=normalizeCategoryPopulation(await rpc('admin_category_population_v19'));return categoryPopulation}
  catch(e){console.warn('Category population V19 unavailable',e);categoryPopulation=normalizeCategoryPopulation([]);return categoryPopulation}
}
function categoryTerms(name){
  const map={
    'Brainrot':['Italian brainrot','Tralalero Tralala','Bombardiro Crocodilo','Ballerina Cappuccina','Tung Tung Tung Sahur','brainrot meme','TikTok meme','viral meme','internet meme'],
    'General Gaming Knowledge':['Minecraft','Fortnite','Roblox','Grand Theft Auto','Call of Duty','Pokémon','Mario','The Legend of Zelda','Sonic the Hedgehog','Nintendo','PlayStation','Xbox'],
    'Internet Culture':['YouTube','TikTok','Twitch','Discord','Reddit','internet meme','viral video','social media','online creator'],
    'Pop Culture':['Marvel','Star Wars','Disney','celebrity','superhero','streaming television','award show','famous actor'],
    'Movies & TV':['blockbuster film','television series','animated film','sitcom','movie franchise','streaming series'],
    'Music':['pop music','hip hop','rock band','singer','album','Billboard chart','music artist'],
    'Food & Brands':["McDonald's",'Coca-Cola','Pepsi','Starbucks','Oreo','Doritos','restaurant chain','food brand','consumer brand'],
    'General Knowledge':['famous landmark','major city','world record','famous person','popular animal','country','museum','university'],
    'Science':['chemistry','physics','biology','chemical element','scientist','scientific discovery'],
    'Technology':['software','operating system','programming language','computer','smartphone','aircraft','technology company'],
    'History':['historical event','battle','world leader','ancient civilization','historical figure','war'],
    'Geography':['country','capital city','river','mountain','island','lake','skyscraper','bridge'],
    'Animals':['mammal','bird','reptile','marine animal','wild animal','animal species'],
    'Space':['planet','moon','space mission','astronaut','exoplanet','solar system'],
    'Sports':['football club','basketball team','stadium','athlete','Olympics','sports league'],
    'Entertainment':['book','author','comic','theme park','board game','entertainment franchise'],
    'Business':['company','brand','founder','employee count','retail company','restaurant company']
  };
  return map[name]||[name];
}
function categoryHealth(row){const n=Number(row.active_count||0);if(n<=0)return['EMPTY','empty'];if(n>=500)return['STRONG','good'];if(n>=200)return['HEALTHY','good'];if(n>=75)return['GROWING','warn'];return['LOW','bad']}
function categoryJobPayload(row,requested=100,audience='mainstream',difficulty='smart'){
  return {format:'whatmod-trivia-category-acquisition-job',version:1,generated_at:new Date().toISOString(),category:row.category,requested:Number(requested),audience,difficulty_focus:difficulty,auto_resolve:true,current:{total_count:Number(row.total_count||0),active_count:Number(row.active_count||0),easy_count:Number(row.easy_count||0),medium_count:Number(row.medium_count||0),hard_count:Number(row.hard_count||0),valid_photo_count:Number(row.valid_photo_count||0),missing_photo_count:Number(row.missing_photo_count||0),retired_count:Number(row.retired_count||0)},terms:categoryTerms(row.category),media:{concurrency:4,probe_count:4}};
}
function exportCategoryDashboard(){
  if(!categoryPopulation.length)return toast('Category population is not available yet.','bad');
  downloadJson(`whatmod-trivia-category-dashboard-${new Date().toISOString().slice(0,10)}.json`,{format:'whatmod-trivia-category-dashboard',version:1,generated_at:new Date().toISOString(),categories:categoryPopulation.map(r=>({...r,terms:categoryTerms(r.category)}))});
  toast('Category dashboard exported for Content Studio.','good');
}
function openCategoryAddModal(name){
  const row=categoryPopulation.find(x=>x.category===name);if(!row)return;
  document.querySelector('#category-add-modal')?.remove();
  const [health]=categoryHealth(row);
  const node=document.createElement('div');node.id='category-add-modal';node.className='category-modal-shell';
  node.innerHTML=`<div class="category-modal-backdrop" data-close-category></div><section class="category-add-modal panel"><header><div><span class="eyebrow">CATEGORY REFILL</span><h2>${esc(row.category)}</h2><p>${fmt(row.active_count)} active · ${fmt(row.easy_count)} easy · ${fmt(row.medium_count)} medium · ${fmt(row.hard_count)} hard · ${health}</p></div><button class="modal-x" data-close-category>×</button></header><div class="category-modal-grid"><label><span>QUESTIONS TO ADD</span><select id="category-add-count"><option>25</option><option>50</option><option selected>100</option><option>250</option><option>500</option></select></label><label><span>AUDIENCE</span><select id="category-add-audience"><option value="mainstream" selected>Mainstream</option><option value="balanced">Balanced</option><option value="deep">Deep cuts</option></select></label><label class="wide"><span>DIFFICULTY PRIORITY</span><select id="category-add-difficulty"><option value="smart" selected>Smart · refill the thinnest difficulty</option><option value="balanced">Balanced mix</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label></div><div class="category-job-note">This creates a tiny Studio job. Open it in the Windows Content Studio, press <b>Acquire + Resolve</b>, then import the resulting Content Package here.</div><div class="category-modal-actions"><button class="btn" id="category-open-studio">Open Content Studio</button><button class="btn primary" id="category-download-job">Download Studio Job</button></div></section>`;
  document.body.appendChild(node);
  node.querySelectorAll('[data-close-category]').forEach(x=>x.onclick=()=>node.remove());
  node.querySelector('#category-open-studio').onclick=()=>window.open('http://127.0.0.1:8767/','_blank','noopener');
  node.querySelector('#category-download-job').onclick=()=>{const job=categoryJobPayload(row,node.querySelector('#category-add-count').value,node.querySelector('#category-add-audience').value,node.querySelector('#category-add-difficulty').value);downloadJson(`whatmod-trivia-add-${row.category.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${job.requested}.json`,job);toast(`${row.category} Studio job exported.`,'good');node.remove()};
}
function renderCategoryCommandCenter(rows){
  rows=normalizeCategoryPopulation(rows);
  const total=rows.reduce((s,r)=>s+Number(r.active_count||0),0),missing=rows.reduce((s,r)=>s+Number(r.missing_photo_count||0),0),empty=rows.filter(r=>Number(r.active_count||0)===0).length;
  return `<section class="panel category-command-center"><div class="category-command-head"><div><span class="eyebrow">CATEGORY COMMAND CENTER</span><h2>Every playable category, in one place.</h2><p>Built-in and custom categories stay listed even at zero questions. Empty categories are disabled for players until you hydrate them here.</p></div><div class="category-command-actions"><span><b>${fmt(total)}</b> active questions</span><span><b>${fmt(empty)}</b> empty categories</span><span><b>${fmt(missing)}</b> missing photos</span><button class="btn" id="export-category-dashboard">Export Studio Snapshot</button></div></div><div class="category-pop-grid">${rows.map(r=>{const [health,cls]=categoryHealth(r),active=Number(r.active_count||0),photos=Number(r.valid_photo_count||0),pct=active?Math.round(photos/active*100):0,targetPct=Math.min(100,Math.round(active/200*100));return `<article class="category-pop-card ${cls}" data-category-card="${esc(r.category)}"><div class="category-pop-title"><div><span class="category-health ${cls}">${health}</span><h3>${esc(r.category)}</h3></div><strong>${fmt(active)}</strong></div><div class="category-diff"><span><b>${fmt(r.easy_count)}</b>EASY</span><span><b>${fmt(r.medium_count)}</b>MED</span><span><b>${fmt(r.hard_count)}</b>HARD</span></div>${active?`<div class="category-photo"><div><i style="width:${pct}%"></i></div><span>${pct}% photo coverage · ${fmt(r.missing_photo_count)} missing</span></div>`:`<div class="category-empty-note"><b>No playable questions yet.</b><span>Hydrate this category before players can select it.</span></div>`}<div class="category-target"><span>Bank target</span><div><i style="width:${targetPct}%"></i></div><small>${fmt(active)} / 200 starter target</small></div><button class="btn primary category-add-btn ${active?'':'urgent'}" data-add-category="${esc(r.category)}">${active?'＋ Add questions':'⚡ Hydrate category'}</button></article>`}).join('')}</div></section>`;
}

function downloadJson(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportLocalMediaJob(){
  const scope=$('#local-export-scope')?.value||'missing';
  const limit=Math.max(1,Math.min(5000,Number($('#local-export-limit')?.value||1000)));
  const btn=$('#export-local-job');
  try{
    if(btn){btn.disabled=true;btn.textContent='Preparing…'}
    const job=await rpc('admin_export_media_job',{p_scope:scope,p_limit:limit});
    const count=Number(job?.question_count||0);
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    downloadJson(`whatmod-trivia-media-job-${count}-${stamp}.json`,job);
    toast(count?`Exported ${count} question${count===1?'':'s'} for local resolving.`:'No matching questions to export.',count?'good':'');
  }catch(e){console.error(e);toast(e.message,'bad')}
  finally{if(btn){btn.disabled=false;btn.textContent='Export media job'}}
}
async function importLocalMediaResults(file){
  if(!file)return;
  let payload;
  try{payload=JSON.parse(await file.text())}catch{toast('That file is not valid JSON.','bad');return}
  if(payload?.format!=='whatmod-trivia-media-results'||Number(payload?.version)!==1||!Array.isArray(payload?.questions)){
    toast('This is not a WhatMod Trivia media results file.','bad');return;
  }
  const questions=payload.questions;
  if(!questions.length){toast('The results file contains no questions.');return}
  const status=$('#universal-import-status')||$('#local-pipeline-status');
  const input=$('#import-local-results');
  if(input)input.disabled=true;
  let totals={imported_questions:0,imported_candidates:0,published_questions:0,skipped_locked:0,skipped_missing:0};
  try{
    for(let i=0;i<questions.length;i+=25){
      const chunk=questions.slice(i,i+25);
      if(status)status.textContent=`Importing ${Math.min(i+chunk.length,questions.length)} / ${questions.length}…`;
      const out=await rpc('admin_import_media_results',{p_results:chunk,p_auto_publish:true,p_skip_locked:true});
      for(const k of Object.keys(totals))totals[k]+=Number(out?.[k]||0);
    }
    if(status)status.textContent=`Imported ${totals.imported_questions} questions · ${totals.imported_candidates} candidates · ${totals.published_questions} images published`;
    toast(`Imported local media: ${totals.published_questions} images published.`, 'good');
    await renderDashboard();
  }catch(e){console.error(e);if(status)status.textContent='Import failed.';toast(e.message,'bad')}
  finally{if(input){input.disabled=false;input.value=''}}
}


async function importMediaOnlyContentPackage(payload,fileInput=null){
  const rows=(payload?.questions||[]).map(q=>q?.media||q).filter(q=>q&&q.id);
  if(!rows.length){toast('The media-only package contains no resolved question records.','bad');return}
  const status=$('#universal-import-status')||$('#content-import-status')||$('#local-pipeline-status');
  if(fileInput)fileInput.disabled=true;
  let totals={imported_questions:0,imported_candidates:0,published_questions:0,skipped_locked:0,skipped_missing:0};
  try{
    for(let i=0;i<rows.length;i+=25){
      const chunk=rows.slice(i,i+25);
      if(status)status.textContent=`Importing media ${Math.min(i+chunk.length,rows.length).toLocaleString()} / ${rows.length.toLocaleString()}…`;
      const out=await rpc('admin_import_media_results',{p_results:chunk,p_auto_publish:true,p_skip_locked:true});
      for(const k of Object.keys(totals))totals[k]+=Number(out?.[k]||0);
    }
    if(status)status.textContent=`Media-only package complete · ${totals.imported_candidates.toLocaleString()} candidates · ${totals.published_questions.toLocaleString()} images published`;
    toast(`Media-only package imported: ${totals.published_questions} images published.`,'good');
    if(adminSection==='questions')await renderQuestionExplorer();else await renderDashboard();
  }catch(e){console.error(e);if(status)status.textContent='Media-only import failed.';toast(e.message,'bad')}
  finally{if(fileInput){fileInput.disabled=false;fileInput.value=''}}
}

async function importLocalContentPackage(file){
  if(!file)return;
  let payload;
  try{payload=JSON.parse(await file.text())}catch{toast('That file is not valid JSON.','bad');return}
  if(payload?.format!=='whatmod-trivia-content-package'||Number(payload?.version)!==1||!Array.isArray(payload?.questions)){
    toast('This is not a WhatMod Trivia content package.','bad');return;
  }
  const questions=payload.questions,packageId=String(payload.package_id||'');
  if(!questions.length){toast('The content package contains no questions.');return}
  if(payload.package_kind==='media_only'){return importMediaOnlyContentPackage(payload,$('#import-content-package'))}
  const status=$('#universal-import-status')||$('#content-import-status'),input=$('#import-content-package');
  if(input)input.disabled=true;
  const totals={created:0,updated:0,unchanged:0,content_locked:0,retired:0,media_locked:0,imported_candidates:0,published_media:0,invalid:0};
  try{
    for(let i=0;i<questions.length;i+=40){
      const chunk=questions.slice(i,i+40);
      if(status)status.textContent=`Importing ${Math.min(i+chunk.length,questions.length).toLocaleString()} / ${questions.length.toLocaleString()}…`;
      const out=await rpc('admin_import_content_package_v12',{p_questions:chunk,p_package_id:packageId||null,p_auto_publish:true,p_preserve_content_locked:true,p_preserve_media_locked:true});
      for(const k of Object.keys(totals))totals[k]+=Number(out?.[k]||0);
    }
    if(status)status.textContent=`Complete · ${totals.created.toLocaleString()} new · ${totals.updated.toLocaleString()} updated · ${totals.published_media.toLocaleString()} images published · ${totals.content_locked.toLocaleString()} admin-locked preserved`;
    toast(`Content package imported: ${totals.created} new questions, ${totals.published_media} images published.`,'good');
    await renderQuestionExplorer();
  }catch(e){console.error(e);if(status)status.textContent='Import failed.';toast(e.message,'bad')}
  finally{if(input){input.disabled=false;input.value=''}}
}

function universalImportMarkup(){return `<section class="panel universal-import-panel" id="universal-import-zone" tabindex="0"><input id="universal-import-file" type="file" accept=".json,application/json" hidden><div class="universal-import-icon">⇧</div><div><span class="eyebrow">SMART JSON IMPORT</span><h3>Drop any Trivia Admin import here.</h3><p>Content Package · Media Results · Media-only Package · Question Edit Pack</p><small id="universal-import-status">Drop a JSON file anywhere on this box, or click to browse. The admin detects the file type automatically.</small></div><button class="btn good" type="button" id="universal-import-browse">Choose JSON</button></section>`}
async function handleUniversalAdminFile(file){
  if(!file)return;let payload;
  const status=$('#universal-import-status');if(status)status.textContent=`Reading ${file.name}…`;
  try{payload=JSON.parse(await file.text())}catch{if(status)status.textContent='Invalid JSON file.';return toast('That file is not valid JSON.','bad')}
  const format=String(payload?.format||'');
  if(status)status.textContent=`Detected ${format||'unknown file'}…`;
  if(format==='whatmod-trivia-media-results')return importLocalMediaResults(file);
  if(format==='whatmod-trivia-content-package')return importLocalContentPackage(file);
  if(format==='whatmod-trivia-question-edit-pack')return importQuestionEditPack(file);
  toast(`Unsupported Trivia JSON: ${format||'format not found'}.`,'bad');if(status)status.textContent='Unsupported file. Use a Content Package, Media Results, or Question Edit Pack.';
}
function bindUniversalImportZone(){
  const zone=$('#universal-import-zone'),input=$('#universal-import-file'),browse=$('#universal-import-browse');if(!zone||!input)return;
  const open=()=>input.click();browse?.addEventListener('click',e=>{e.stopPropagation();open()});zone.addEventListener('click',e=>{if(e.target!==browse)open()});
  input.onchange=e=>{const f=e.target.files?.[0];if(f)handleUniversalAdminFile(f);input.value=''};
  ['dragenter','dragover'].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();e.stopPropagation();zone.classList.add('over')}));
  ['dragleave','drop'].forEach(t=>zone.addEventListener(t,e=>{e.preventDefault();e.stopPropagation();zone.classList.remove('over')}));
  zone.addEventListener('drop',e=>{const f=e.dataTransfer?.files?.[0];if(f)handleUniversalAdminFile(f)});
}

async function renderDashboard(){
  clearTimeout(liveOpsTimer);adminSection='media';
  try{
    const [stats,list,categories]=await Promise.all([overview(),listQuestions(),loadCategoryPopulation()]);
    const items=list?.items||[],total=Number(list?.total||0);
    $('#admin-app').innerHTML=`
      ${adminHeader("media")}
      <main class="shell">
        <section class="hero"><div><small>MEDIA CONTROL ROOM</small><h1>Question imagery.</h1><p>Images can be resolved locally on your Windows PC, imported in bulk, and published immediately when they are reuse-safe. Use this dashboard to approve and lock good choices, swap them, reject them, or search for better alternatives.</p></div><div><span class="tag auto">AUTO = LIVE, NOT YET LOCKED</span></div></section>
        <section class="stats">
          <div class="stat"><span>QUESTIONS</span><b>${fmt(stats.total_questions)}</b></div>
          <div class="stat"><span>WITH IMAGE</span><b>${fmt(stats.with_image)}</b></div>
          <div class="stat"><span>MISSING</span><b>${fmt(stats.missing_image)}</b></div>
          <div class="stat"><span>AUTO LIVE</span><b>${fmt(stats.auto)}</b></div>
          <div class="stat"><span>APPROVED</span><b>${fmt(stats.approved)}</b></div>
          <div class="stat"><span>CANDIDATES</span><b>${fmt(stats.candidates)}</b></div>
        </section>
        <section class="local-pipeline panel">
          <div class="pipeline-copy">
            <span class="eyebrow">LOCAL MEDIA PIPELINE</span>
            <h2>Resolve images on your Windows PC.</h2>
            <p>Export unresolved questions, run the free local resolver on your own machine, then import the result file here. No Supabase secret is placed on the PC and no GitHub Actions minutes are used for image resolution.</p>
          </div>
          <div class="pipeline-controls">
            <label><span>Export</span><select id="local-export-scope"><option value="missing">Missing images only</option><option value="needs_review">Missing + auto/unapproved</option><option value="auto">Auto-selected images</option><option value="all_unlocked">All unlocked questions</option></select></label>
            <label><span>Maximum questions</span><select id="local-export-limit"><option>100</option><option>250</option><option selected>1000</option><option>2500</option><option>5000</option></select></label>
            <a class="btn" href="./downloads/WhatMod-Trivia-Content-Studio-Windows.zip" download>Download Windows Content Studio</a>
            <button class="btn primary" id="export-local-job" type="button">Export media job</button>
          </div>
          <div class="pipeline-flow"><b>1</b><span>Export JSON</span><i>→</i><b>2</b><span>Resolve locally</span><i>→</i><b>3</b><span>Drop result below</span></div>
          <div id="local-pipeline-status" class="pipeline-status">Local imports publish the resolver's best reuse-safe image immediately. Existing locked/approved images are skipped.</div>
        </section>
        ${universalImportMarkup()}
        <form class="toolbar" id="filters">
          <input class="search" name="search" placeholder="Search question or media subject" value="${esc(filters.search)}">
          <select name="media_filter"><option value="all">All media</option><option value="missing">Missing image</option><option value="auto">Auto live</option><option value="approved">Approved</option><option value="unreviewed">Needs review</option><option value="locked">Locked</option><option value="rejected">Rejected/no image</option></select>
          <select name="provider"><option value="">All providers</option><option value="wikimedia">Wikimedia</option><option value="wikipedia">Wikipedia lead (Commons-verified)</option><option value="openverse">Openverse</option><option value="manual">Manual</option><option value="legacy">Legacy</option></select>
          <select name="category"><option value="">All categories</option>${[...new Set([...ADMIN_CATEGORIES,...categories.map(x=>x.category)])].sort().map(x=>`<option>${esc(x)}</option>`).join('')}</select>
          <button class="btn primary">Apply</button>
        </form>
        <section class="question-list">${items.length?items.map(q=>`<article class="qrow" data-qid="${esc(q.id)}"><div class="qthumb">${imgTag(q.image_url,q.prompt)||'▧'}</div><div class="qcopy"><h3>${esc(q.prompt)}</h3><div class="tags"><span class="tag">${esc(q.category)}</span><span class="tag">${esc(q.difficulty)}</span>${statusTag(q)}${q.media_provider?`<span class="tag">${esc(q.media_provider)}</span>`:''}</div></div><div class="rowmeta"><b>${fmt(q.candidate_count)}</b> candidates<br>${q.media_query?esc(q.media_query):'No media query'}</div></article>`).join(''):`<div class="empty">No questions match these filters.</div>`}</section>
        <div class="pager"><button class="btn" id="prev" ${filters.offset<=0?'disabled':''}>← Previous</button><span class="btn">${fmt(Math.min(filters.offset+1,total))}–${fmt(Math.min(filters.offset+filters.limit,total))} of ${fmt(total)}</span><button class="btn" id="next" ${filters.offset+filters.limit>=total?'disabled':''}>Next →</button></div>
      </main>`;
    const form=$('#filters');form.media_filter.value=filters.media_filter;form.provider.value=filters.provider;form.category.value=filters.category;
    form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);filters={...filters,search:String(f.get('search')||'').trim(),media_filter:String(f.get('media_filter')||'all'),provider:String(f.get('provider')||''),category:String(f.get('category')||''),offset:0};renderDashboard()};
    $$('.qrow').forEach(el=>el.onclick=()=>openQuestion(el.dataset.qid));
    $('#prev').onclick=()=>{filters.offset=Math.max(0,filters.offset-filters.limit);renderDashboard()};
    $('#next').onclick=()=>{filters.offset+=filters.limit;renderDashboard()};
    bindAdminChrome(()=>renderDashboard());
    $('#export-local-job').onclick=exportLocalMediaJob;
    bindUniversalImportZone();
  }catch(e){console.error(e);if(/admin only/i.test(e.message))renderAuth('This Google account is signed in, but it is not marked as a Trivia admin.');else toast(e.message,'bad')}
}

async function exportQuestionEditPack(){
  const btn=$('#export-question-edit-pack');
  if(btn){btn.disabled=true;btn.textContent='Exporting…'}
  try{
    const all=[];let offset=0,total=0;
    do{
      const page=await rpc('admin_export_questions_for_edit_v18',{p_search:questionFilters.search||null,p_category:questionFilters.category||null,p_difficulty:questionFilters.difficulty,p_status:questionFilters.status,p_source:questionFilters.source||null,p_limit:500,p_offset:offset});
      const items=page?.items||[];total=Number(page?.total||items.length);all.push(...items);offset+=items.length;
      if(btn)btn.textContent=`Exporting ${all.length.toLocaleString()} / ${total.toLocaleString()}…`;
      if(!items.length)break;
    }while(offset<total);
    const payload={format:'whatmod-trivia-question-edit-pack',version:1,exported_at:new Date().toISOString(),question_count:all.length,filters:{search:questionFilters.search||'',category:questionFilters.category||'',difficulty:questionFilters.difficulty,status:questionFilters.status,source:questionFilters.source||''},instructions:{purpose:'Bulk editorial rewrite. Keep id/canonical_key unchanged so the importer can match records.',editable_fields:['prompt','category','difficulty','question_type','context','unit','answer_numeric','answer_text','options','correct_option','explanation','source_url','media_query'],note:'Answers and answer types are factual fields. Only change them when intentionally correcting the underlying question.'},questions:all};
    const stamp=new Date().toISOString().slice(0,10);
    downloadJson(`whatmod-trivia-edit-pack-${all.length}-${stamp}.json`,payload);
    toast(`Exported ${all.length.toLocaleString()} questions for bulk editing.`,'good');
  }catch(e){console.error(e);toast(e.message,'bad')}
  finally{if(btn){btn.disabled=false;btn.textContent='Export for Edit'}}
}

async function importQuestionEditPack(file){
  if(!file)return;let payload;
  try{payload=JSON.parse(await file.text())}catch{toast('That edit pack is not valid JSON.','bad');return}
  if(payload?.format!=='whatmod-trivia-question-edit-pack'||Number(payload?.version)!==1||!Array.isArray(payload?.questions)){toast('This is not a WhatMod Trivia Question Edit Pack.','bad');return}
  const rows=payload.questions;if(!rows.length){toast('The edit pack contains no questions.');return}
  if(!confirm(`Import edits for ${rows.length.toLocaleString()} questions? Only changed records are updated and every change is audited.`))return;
  const input=$('#import-question-edit-pack'),status=$('#universal-import-status')||$('#question-edit-pack-status');if(input)input.disabled=true;
  const totals={updated:0,unchanged:0,missing:0,failed:0};const batchId=crypto.randomUUID();let firstErrors=[];
  try{
    for(let i=0;i<rows.length;i+=50){
      const chunk=rows.slice(i,i+50);if(status)status.textContent=`Importing ${Math.min(i+chunk.length,rows.length).toLocaleString()} / ${rows.length.toLocaleString()}…`;
      const out=await rpc('admin_import_question_edit_pack_v18',{p_questions:chunk,p_batch_id:batchId});
      for(const k of Object.keys(totals))totals[k]+=Number(out?.[k]||0);
      if(firstErrors.length<10&&Array.isArray(out?.errors))firstErrors.push(...out.errors.slice(0,10-firstErrors.length));
    }
    if(status)status.textContent=`Edit pack complete · ${totals.updated.toLocaleString()} updated · ${totals.unchanged.toLocaleString()} unchanged · ${totals.failed.toLocaleString()} failed`;
    toast(`Question edits imported: ${totals.updated.toLocaleString()} updated${totals.failed?` · ${totals.failed} failed`:''}.`,totals.failed?'':'good');
    if(firstErrors.length)console.warn('Question edit import errors',firstErrors);
    await renderQuestionExplorer();
  }catch(e){console.error(e);if(status)status.textContent='Edit pack import failed.';toast(e.message,'bad')}
  finally{if(input){input.disabled=false;input.value=''}}
}

async function renderQuestionExplorer(){
  adminSection='questions';clearTimeout(liveOpsTimer);
  try{
    const [stats,list,photo,categories]=await Promise.all([
      rpc('admin_question_overview_v15'),
      rpc('admin_list_questions_v15',{p_search:questionFilters.search||null,p_category:questionFilters.category||null,p_difficulty:questionFilters.difficulty,p_status:questionFilters.status,p_source:questionFilters.source||null,p_limit:questionFilters.limit,p_offset:questionFilters.offset}),
      rpc('admin_photo_health_v15'),
      loadCategoryPopulation()
    ]);
    const items=list?.items||[],total=Number(list?.total||0);
    const statusLabel=q=>q.photo_disabled?'PHOTO DISABLED':q.is_active?'ACTIVE':'RETIRED';
    $('#admin-app').innerHTML=`${adminHeader('questions')}<main class="shell">
      <section class="hero"><div><small>QUESTION EXPLORER</small><h1>The question bank.</h1><p>Search every question, inspect community feedback, edit every field, bulk-export the bank for editorial rewrites, or retire bad content instantly.</p></div><div class="hero-actions"><button class="btn" id="export-question-edit-pack">⇩ Export for Edit</button><button class="btn primary" id="add-question">＋ Add question</button></div></section>
      <div id="question-edit-pack-status" class="edit-pack-status">Export uses the current Question Explorer filters. Imported edits are content-locked and audited.</div><section class="local-pipeline content-pipeline panel">
        <div class="pipeline-copy"><span class="eyebrow">LOCAL CONTENT STUDIO</span><h2>Questions + media in one upload.</h2><p>Acquire new questions and resolve their media locally, then import one content package here. Canonical keys deduplicate reimports and admin edits remain protected.</p></div>
        <div class="pipeline-controls"><a class="btn" href="./downloads/WhatMod-Trivia-Content-Studio-Windows.zip" download>Download Content Studio</a></div>
        <div id="content-import-status" class="pipeline-status">No package imported yet.</div>
      </section>
      ${universalImportMarkup()}
      ${renderCategoryCommandCenter(categories)}
      <section class="stats question-stats">
        <div class="stat"><span>ACTIVE</span><b>${fmt(stats.active)}</b></div>
        <div class="stat"><span>RETIRED</span><b>${fmt(stats.retired)}</b></div>
        <div class="stat"><span>HYDRATED</span><b>${fmt(stats.hydrated)}</b></div>
        <div class="stat"><span>MANUAL</span><b>${fmt(stats.manual)}</b></div>
        <button class="stat stat-button up" data-vote-review="1"><span>👍 VOTES · OPEN REVIEW</span><b>${fmt(stats.total_upvotes)}</b></button>
        <button class="stat stat-button down" data-vote-review="-1"><span>👎 VOTES · OPEN REVIEW</span><b>${fmt(stats.total_downvotes)}</b></button>
      </section>
      <section class="panel photo-health-panel">
        <div class="photo-health-copy"><span class="eyebrow">PHOTO QUALITY GATE</span><h2>Keep image-less questions out of rotation.</h2><p>“Valid” uses the stored resolver/admin verification state. Disabling is reversible and does not permanently delete the question.</p></div>
        <div class="photo-health-stats"><span><b>${fmt(photo.active_with_valid_photo)}</b> active with valid photo</span><span class="bad"><b>${fmt(photo.active_without_valid_photo)}</b> active without valid photo</span><span><b>${fmt(photo.photo_disabled)}</b> photo-disabled</span></div>
        <div class="photo-health-actions"><button class="btn danger" id="disable-invalid-photo" ${Number(photo.active_without_valid_photo||0)<=0?'disabled':''}>Disable ${fmt(photo.active_without_valid_photo)} without valid photos</button><button class="btn good" id="restore-photo-disabled" ${Number(photo.photo_disabled||0)<=0?'disabled':''}>Undo · restore ${fmt(photo.photo_disabled)}</button></div>
      </section>
      <form class="toolbar question-toolbar" id="question-filters"><input class="search" name="search" placeholder="Search prompt, canonical key or media subject" value="${esc(questionFilters.search)}"><select name="status"><option value="active">Active</option><option value="missing_photo">Active · invalid/missing photo</option><option value="photo_disabled">Photo-disabled</option><option value="retired">Deleted / retired</option><option value="all">All</option></select><select name="difficulty"><option value="any">Any difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select><select name="category"><option value="">All categories</option>${normalizeCategoryPopulation(categories).map(x=>`<option>${esc(x.category)}</option>`).join('')}</select><button class="btn primary">Apply</button></form>
      <section class="question-explorer-list">${items.length?items.map(q=>`<article class="explorer-row ${q.is_active?'':'retired'} ${q.photo_disabled?'photo-disabled':''}" data-edit-qid="${esc(q.id)}"><div class="explorer-status"><span class="status-dot ${q.is_active?'live':q.photo_disabled?'photo-off':'off'}"></span><small>${statusLabel(q)}</small></div><div class="explorer-main"><h3>${esc(q.prompt)}</h3><div class="tags"><span class="tag">${esc(q.category)}</span><span class="tag">${esc(q.difficulty)}</span><span class="tag">${esc(q.question_type)}</span><span class="tag">${esc(q.source_type||'manual')}</span><span class="tag ${q.has_valid_photo?'approved':'missing'}">${q.has_valid_photo?'PHOTO OK':'PHOTO INVALID'}</span></div></div><div class="community-score"><span class="vote-up">👍 ${fmt(q.upvotes)}</span><span class="vote-down">👎 ${fmt(q.downvotes)}</span><b>${Number(q.upvotes||0)-Number(q.downvotes||0)>=0?'+':''}${fmt(Number(q.upvotes||0)-Number(q.downvotes||0))}</b></div><div class="explorer-date"><small>UPDATED</small><span>${esc(formatWhen(q.updated_at||q.created_at))}</span></div></article>`).join(''):`<div class="empty">No questions match these filters.</div>`}</section>
      <div class="pager"><button class="btn" id="q-prev" ${questionFilters.offset<=0?'disabled':''}>← Previous</button><span class="btn">${fmt(Math.min(questionFilters.offset+1,total))}–${fmt(Math.min(questionFilters.offset+questionFilters.limit,total))} of ${fmt(total)}</span><button class="btn" id="q-next" ${questionFilters.offset+questionFilters.limit>=total?'disabled':''}>Next →</button></div>
    </main>`;
    const form=$('#question-filters');form.status.value=questionFilters.status;form.difficulty.value=questionFilters.difficulty;form.category.value=questionFilters.category;
    form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);questionFilters={...questionFilters,search:String(f.get('search')||'').trim(),status:String(f.get('status')||'active'),difficulty:String(f.get('difficulty')||'any'),category:String(f.get('category')||''),offset:0};renderQuestionExplorer()};
    $$('[data-edit-qid]').forEach(row=>row.onclick=()=>openQuestionEditor(row.dataset.editQid));
    $$('[data-vote-review]').forEach(b=>b.onclick=()=>{voteFilters.direction=Number(b.dataset.voteReview);voteFilters.offset=0;adminSection='votes';renderVoteReview()});
    $('#add-question').onclick=()=>openQuestionEditor(null);
    $('#export-question-edit-pack').onclick=exportQuestionEditPack;
    bindUniversalImportZone();
    const catExport=$('#export-category-dashboard');if(catExport)catExport.onclick=exportCategoryDashboard;
    $$('[data-add-category]').forEach(b=>b.onclick=e=>{e.stopPropagation();openCategoryAddModal(b.dataset.addCategory)});
    $('#disable-invalid-photo').onclick=disableInvalidPhotoQuestions;
    $('#restore-photo-disabled').onclick=restorePhotoDisabledQuestions;
    $('#q-prev').onclick=()=>{questionFilters.offset=Math.max(0,questionFilters.offset-questionFilters.limit);renderQuestionExplorer()};
    $('#q-next').onclick=()=>{questionFilters.offset+=questionFilters.limit;renderQuestionExplorer()};
    bindAdminChrome(()=>renderQuestionExplorer());
  }catch(e){console.error(e);toast(e.message,'bad')}
}

async function disableInvalidPhotoQuestions(){
  if(!confirm('Disable every currently active question that does not have a valid stored photo? This is reversible.'))return;
  try{const out=await rpc('admin_disable_questions_without_valid_photos_v15');toast(`Disabled ${fmt(out?.disabled)} question(s) without valid photos.`,'good');questionFilters.status='photo_disabled';questionFilters.offset=0;renderQuestionExplorer()}catch(e){console.error(e);toast(e.message,'bad')}
}
async function restorePhotoDisabledQuestions(){
  if(!confirm('Restore every question disabled by the photo quality gate? Permanently deleted questions will stay deleted.'))return;
  try{const out=await rpc('admin_restore_photo_disabled_questions_v15');toast(`Restored ${fmt(out?.restored)} photo-disabled question(s).`,'good');questionFilters.status='active';questionFilters.offset=0;renderQuestionExplorer()}catch(e){console.error(e);toast(e.message,'bad')}
}

async function renderVoteReview(){
  adminSection='votes';clearTimeout(liveOpsTimer);
  try{
    const data=await rpc('admin_list_voted_questions_v15',{p_vote:Number(voteFilters.direction),p_search:voteFilters.search||null,p_status:voteFilters.status,p_limit:voteFilters.limit,p_offset:voteFilters.offset});
    const items=data?.items||[],total=Number(data?.total||0),positive=Number(voteFilters.direction)===1;
    $('#admin-app').innerHTML=`${adminHeader('votes')}<main class="shell"><section class="hero"><div><small>COMMUNITY REVIEW</small><h1>${positive?'Liked':'Disliked'} questions.</h1><p>Open any question to fully edit its prompt, answer, explanation, media search subject, source, or remove it from the bank. Sort order prioritizes the selected community signal.</p></div><div class="vote-switch"><button class="btn ${positive?'good':''}" data-vote-direction="1">👍 Likes</button><button class="btn ${!positive?'danger':''}" data-vote-direction="-1">👎 Dislikes</button></div></section>
      <form class="toolbar vote-toolbar" id="vote-filters"><input class="search" name="search" value="${esc(voteFilters.search)}" placeholder="Search voted questions"><select name="status"><option value="all">All statuses</option><option value="active">Active only</option><option value="retired">Inactive only</option></select><button class="btn primary">Apply</button></form>
      <section class="vote-review-list">${items.length?items.map(q=>`<article class="vote-review-card ${q.is_active?'':'retired'}" data-vote-qid="${esc(q.id)}"><div class="vote-rank"><strong>${positive?`👍 ${fmt(q.upvotes)}`:`👎 ${fmt(q.downvotes)}`}</strong><span>${fmt(q.upvotes)} up · ${fmt(q.downvotes)} down</span><i>${Number(q.approval_pct||0).toFixed(1)}% approval</i></div><div class="vote-question"><h3>${esc(q.prompt)}</h3><div class="tags"><span class="tag">${esc(q.category)}</span><span class="tag">${esc(q.difficulty)}</span><span class="tag">${q.is_active?'ACTIVE':q.photo_disabled?'PHOTO DISABLED':'RETIRED'}</span>${q.image_url?'<span class="tag approved">HAS IMAGE</span>':'<span class="tag missing">NO IMAGE</span>'}</div></div><div class="vote-net"><small>NET</small><b>${Number(q.score)>=0?'+':''}${fmt(q.score)}</b><span>EDIT →</span></div></article>`).join(''):`<div class="empty">No ${positive?'liked':'disliked'} questions match these filters.</div>`}</section>
      <div class="pager"><button class="btn" id="v-prev" ${voteFilters.offset<=0?'disabled':''}>← Previous</button><span class="btn">${fmt(Math.min(voteFilters.offset+1,total))}–${fmt(Math.min(voteFilters.offset+voteFilters.limit,total))} of ${fmt(total)}</span><button class="btn" id="v-next" ${voteFilters.offset+voteFilters.limit>=total?'disabled':''}>Next →</button></div></main>`;
    $$('[data-vote-direction]').forEach(b=>b.onclick=()=>{voteFilters.direction=Number(b.dataset.voteDirection);voteFilters.offset=0;renderVoteReview()});
    $$('[data-vote-qid]').forEach(row=>row.onclick=()=>openQuestionEditor(row.dataset.voteQid));
    const form=$('#vote-filters');form.status.value=voteFilters.status;form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);voteFilters={...voteFilters,search:String(f.get('search')||'').trim(),status:String(f.get('status')||'all'),offset:0};renderVoteReview()};
    $('#v-prev').onclick=()=>{voteFilters.offset=Math.max(0,voteFilters.offset-voteFilters.limit);renderVoteReview()};
    $('#v-next').onclick=()=>{voteFilters.offset+=voteFilters.limit;renderVoteReview()};
    bindAdminChrome(()=>renderVoteReview());
  }catch(e){console.error(e);toast(e.message,'bad')}
}

function playerPresenceCard(p){return `<article class="live-player ${p.online?'online':'offline'} ${p.is_bot?'bot':''}"><div class="live-avatar">${p.avatar_url?`<img src="${esc(safeUrl(p.avatar_url))}" alt="">`:`${p.is_bot?'AI':esc(String(p.username||'?')[0].toUpperCase())}`}</div><div><b>${esc(p.username||'Player')}</b><span>${p.is_bot?'BOT':esc(p.participation_status||'active').toUpperCase()}${p.online?' · ONLINE':' · OFFLINE'}</span></div><strong>${fmt(p.total_score||0)}</strong></article>`}
function roomHealthBadge(h={}){const state=String(h.state||'unknown');const score=Number(h.score||0);return `<span class="room-health ${esc(state)}"><i></i>${esc(state.toUpperCase())} · ${score}%</span>`}
async function adminRoomAction(gameId,action){
  clearTimeout(liveOpsTimer);
  const isShutdown=action==='shutdown';
  if(!confirm(isShutdown?'Shut this room down now? All players and bots will be removed from the live room and the code will be closed.':'Reset/unstick this room? Current round answers, scores, bots and question order will be cleared, but human players and the room code will be preserved.')){if(adminSection==='live')liveOpsTimer=setTimeout(()=>renderLiveOps(),5000);return}
  try{
    const out=isShutdown?await rpc('admin_shutdown_room_v18',{p_game_id:gameId,p_reason:'Manual shutdown from Trivia Admin'}):await rpc('admin_reset_room_v18',{p_game_id:gameId});
    toast(isShutdown?`Room ${out?.code||''} shut down · ${Number(out?.removed_humans||0)} player(s) removed.`:`Room ${out?.code||''} reset to lobby with ${Number(out?.player_count||0)} player(s) preserved.`,'good');
    await renderLiveOps();
  }catch(e){console.error(e);toast(e.message,'bad');if(adminSection==='live')liveOpsTimer=setTimeout(()=>renderLiveOps(),5000)}
}

async function renderLiveOps(){
  adminSection='live';clearTimeout(liveOpsTimer);
  try{
    const [data,storage]=await Promise.all([
      rpc('admin_live_operations_v15'),
      rpc('admin_storage_hygiene_status_v22').catch(()=>null)
    ]);
    const games=data?.games||[],users=data?.online_users||[],life=data?.lifecycle||{},last=life?.last_result||{};
    const storageLast=storage?.last_result||{},mediaStore=storage?.media_candidates||{},auditStore=storage?.audit_log||{},retention=storage?.retention||{};
    $('#admin-app').innerHTML=`${adminHeader('live')}<main class="shell"><section class="hero"><div><small>LIVE OPERATIONS</small><h1>Players online now.</h1><p>Presence is heartbeat-based. A player is considered online when the signed-in Trivia client has checked in within the last 90 seconds. V17 also runs a conservative stale-room sweep in the background without touching rooms that still have active humans.</p></div><div class="live-generated"><span class="pulse">● LIVE</span><small>Snapshot ${esc(formatWhen(data?.generated_at))}</small></div></section>
      <section class="stats live-stats"><div class="stat"><span>ONLINE USERS</span><b>${fmt(data?.online_count)}</b></div><div class="stat"><span>LIVE ROOMS</span><b>${fmt(data?.live_game_count)}</b></div><div class="stat"><span>PLAYING / LOBBY</span><b>${fmt(users.filter(x=>x.game_id).length)}</b></div><div class="stat"><span>BROWSING</span><b>${fmt(users.filter(x=>!x.game_id).length)}</b></div></section>
      <section class="panel lifecycle-panel"><div class="panel-title"><div><h3>Room lifecycle maintenance</h3><p>Automatic sweeps are throttled to once every 5 minutes and only close rooms with no recent human heartbeat after a conservative grace period.</p></div><button class="btn" id="run-room-sweep">Run stale-room sweep</button></div><div class="lifecycle-grid"><div><span>LAST SWEEP</span><b>${life.last_run_at?esc(formatWhen(life.last_run_at)):'Not run yet'}</b></div><div><span>LAST CLOSED</span><b>${fmt(last.rooms_closed||0)}</b></div><div><span>NO RECENT HUMANS</span><b>${fmt(life.rooms_with_no_recent_humans||0)}</b></div><div><span>STALE PRESENCE</span><b>${fmt(life.stale_presence_rows||0)}</b></div></div><p class="lifecycle-note">Safety windows: matchmaking lobby 30m · public lobby 90m · invite-only lobby 4h · abandoned active match 20–30m · finished room 20m. Any recent human heartbeat keeps the room alive.</p></section>
      ${storage?`<section class="panel lifecycle-panel storage-hygiene"><div class="panel-title"><div><h3>Free-plan storage hygiene</h3><p>V22 keeps permanent questions, profiles, replays and aggregate statistics, while compacting disposable resolver/audit/runtime data.</p></div><button class="btn" id="run-storage-sweep">Run storage cleanup</button></div><div class="lifecycle-grid"><div><span>MEDIA CANDIDATES</span><b>${formatBytes(mediaStore.bytes)} · ${fmt(mediaStore.rows)} rows</b></div><div><span>AUDIT HISTORY</span><b>${formatBytes(auditStore.bytes)} · ${fmt(auditStore.rows)} rows</b></div><div><span>LAST CLEANUP</span><b>${storage.last_run_at?esc(formatWhen(storage.last_run_at)):'Not run yet'}</b></div><div><span>LAST MEDIA TRIM</span><b>${fmt(storageLast?.media?.extra_rows_deleted||0)} extras removed</b></div></div><p class="lifecycle-note">Retention: ${fmt(retention.media_alternatives_per_question||4)} media alternatives/question · bot runtime ${fmt(retention.bot_runtime_days||14)}d · completed game/practice runtime ${fmt(retention.completed_runtime_days||30)}d · Daily attempts ${fmt(retention.daily_attempt_days||120)}d. Replays and aggregate community stats remain permanent.</p></section>`:''}
      <section class="panel live-users-panel"><div class="panel-title"><div><h3>Connected accounts</h3><p>Signed-in users with a recent heartbeat, including players outside a game.</p></div><span class="tag approved">AUTO REFRESH · 5S</span></div><div class="online-user-grid">${users.length?users.map(u=>`<article class="online-user"><span class="presence-dot"></span><div class="live-avatar">${u.avatar_url?`<img src="${esc(safeUrl(u.avatar_url))}" alt="">`:`${esc(String(u.username||'?')[0].toUpperCase())}`}</div><div><b>${esc(u.username||'Player')}</b><span>${u.game_code?`Room ${esc(u.game_code)} · ${esc(u.game_status||'')}`:`${esc(String(u.page||'home').replace(/-/g,' '))}`}</span></div><time>${esc(formatWhen(u.last_seen_at))}</time></article>`).join(''):'<div class="empty">No signed-in users have checked in during the last 90 seconds.</div>'}</div></section>
      <section class="live-game-list"><div class="section-kicker"><span>ACTIVE ROOMS</span><b>${fmt(games.length)}</b></div>${games.length?games.map(g=>`<details class="live-game health-${esc(g.health?.state||'unknown')}" open><summary><div><div class="room-summary-badges"><span class="game-status ${esc(g.status)}">${esc(String(g.status).toUpperCase())}</span>${roomHealthBadge(g.health)}</div><h3>${esc(g.title||'Trivia Party')}</h3><small>Code ${esc(g.code)} · ${esc(g.visibility)} · ${esc(g.lobby_kind)} · Cycle ${fmt(g.cycle_no)}</small></div><div class="live-game-metrics"><span><b>${fmt(g.online_human_count)}</b> online</span><span><b>${fmt(g.human_count)}</b> humans</span><span><b>${fmt(g.spectator_count)}</b> spectators</span><span><b>${fmt(g.bot_count)}</b> bots</span></div></summary><div class="live-game-body"><div class="live-game-question"><small>CURRENT QUESTION</small><b>${esc(g.current_question|| (g.status==='lobby'?'Waiting in lobby':'No question loaded'))}</b><span>${esc(g.category)} · ${esc(g.difficulty)} · Round ${Math.min(Number(g.current_question_index||0)+1,Number(g.question_count||0))}/${fmt(g.question_count)}</span><em>Last room activity: ${g.last_activity_at?esc(formatWhen(g.last_activity_at)):'—'}</em><div class="health-detail"><b>Room health ${fmt(g.health?.score||0)}%</b><span>${(g.health?.reasons||[]).length?(g.health.reasons||[]).map(x=>`• ${esc(x)}`).join('<br>'):'No health warnings detected.'}</span></div><div class="room-admin-actions"><button class="btn good" data-room-action="reset" data-game-id="${esc(g.id)}">↻ Refresh / Unstuck</button><button class="btn danger" data-room-action="shutdown" data-game-id="${esc(g.id)}">■ Shutdown + Remove Players</button></div></div><div class="live-roster">${(g.players||[]).length?(g.players||[]).map(playerPresenceCard).join(''):'<div class="empty">No participants.</div>'}</div></div></details>`).join(''):'<div class="empty panel">There are no active games right now.</div>'}</section>
    </main>`;
    bindAdminChrome(()=>renderLiveOps());
    const sweep=$('#run-room-sweep');if(sweep)sweep.onclick=async()=>{sweep.disabled=true;sweep.textContent='Sweeping…';try{const r=await rpc('admin_run_room_lifecycle_sweep_v17');toast(`Sweep complete · ${Number(r?.rooms_closed||0)} stale room(s) closed · ${Number(r?.presence_rows_pruned||0)} old presence row(s) pruned.`,'good');await renderLiveOps()}catch(e){console.error(e);toast(e.message,'bad');sweep.disabled=false;sweep.textContent='Run stale-room sweep'}};
    const storageSweep=$('#run-storage-sweep');if(storageSweep)storageSweep.onclick=async()=>{storageSweep.disabled=true;storageSweep.textContent='Cleaning…';try{const r=await rpc('admin_run_storage_hygiene_v22');toast(`Storage cleanup complete · ${Number(r?.media?.extra_rows_deleted||0)+Number(r?.media?.unavailable_rows_deleted||0)} media candidate row(s) removed · ${Number(r?.practice_sessions_pruned||0)} old practice run(s) pruned.`,'good');await renderLiveOps()}catch(e){console.error(e);toast(e.message,'bad');storageSweep.disabled=false;storageSweep.textContent='Run storage cleanup'}};
    $$('[data-room-action]').forEach(b=>b.onclick=()=>adminRoomAction(b.dataset.gameId,b.dataset.roomAction));
    if(adminSection==='live')liveOpsTimer=setTimeout(()=>renderLiveOps(),5000);
  }catch(e){console.error(e);toast(e.message,'bad');if(adminSection==='live')liveOpsTimer=setTimeout(()=>renderLiveOps(),8000)}
}

function questionFormMarkup(q={}){
  const options=Array.isArray(q.options)?q.options.join('\n'):'';
  return `<form id="question-editor-form" class="question-editor-form"><div class="editor-grid"><label class="wide"><span>PROMPT</span><textarea name="prompt" required>${esc(q.prompt||'')}</textarea></label><label><span>CATEGORY</span><input name="category" value="${esc(q.category||'General')}" required></label><label><span>DIFFICULTY</span><select name="difficulty"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label><span>QUESTION TYPE</span><select name="question_type"><option value="numeric">Numeric estimate</option><option value="multiple_choice">Multiple choice</option><option value="text">Text</option></select></label><label><span>UNIT</span><input name="unit" value="${esc(q.unit||'')}" placeholder="km, year, people…"></label><label class="wide"><span>CONTEXT</span><textarea name="context">${esc(q.context||'')}</textarea></label><label><span>NUMERIC ANSWER</span><input name="answer_numeric" type="number" step="any" value="${esc(q.answer_numeric??'')}"></label><label><span>TEXT ANSWER</span><input name="answer_text" value="${esc(q.answer_text||'')}"></label><label class="wide"><span>MULTIPLE-CHOICE OPTIONS · ONE PER LINE</span><textarea name="options">${esc(options)}</textarea></label><label><span>CORRECT OPTION</span><input name="correct_option" type="number" min="0" value="${esc(q.correct_option??0)}"><small>0 = first option</small></label><label><span>MEDIA SEARCH SUBJECT</span><input name="media_query" value="${esc(q.media_query||'')}"></label><label class="wide"><span>EXPLANATION</span><textarea name="explanation">${esc(q.explanation||'')}</textarea></label><label class="wide"><span>FACT SOURCE URL</span><input name="source_url" value="${esc(q.source_url||'')}"></label></div><div class="editor-actions"><button class="btn primary" type="submit">${q.id?'Save changes':'Create question'}</button>${q.id?`<button class="btn" type="button" id="open-question-media">Media</button>${q.is_active?'<button class="btn danger" type="button" id="retire-question">Delete from bank</button>':q.photo_disabled?'<button class="btn good" type="button" id="restore-question">Restore from photo gate</button><button class="btn danger" type="button" id="retire-question">Delete permanently</button>':'<button class="btn good" type="button" id="restore-question">Restore question</button>'}`:''}</div></form>`;
}

async function openQuestionEditor(id){
  try{
    questionDetail=id?await rpc('admin_get_question_v10',{p_question_id:id}):{question:{category:'General',difficulty:'medium',question_type:'numeric',is_active:true},votes:{upvotes:0,downvotes:0}};
    const q=questionDetail.question,v=questionDetail.votes||{};
    let d=$('#question-editor-root');if(!d){d=document.createElement('div');d.id='question-editor-root';document.body.appendChild(d)}
    d.innerHTML=`<div class="drawer-backdrop"><aside class="drawer question-editor-drawer"><div class="drawer-head"><div><span class="eyebrow">${q.id?'EDIT QUESTION':'NEW MANUAL QUESTION'}</span><h2>${esc(q.prompt||'Create a question')}</h2>${q.id?`<div class="editor-votes"><span>👍 ${fmt(v.upvotes)}</span><span>👎 ${fmt(v.downvotes)}</span><span>${q.is_active?'ACTIVE':q.photo_disabled?'PHOTO DISABLED':'RETIRED'}</span></div>`:''}</div><button class="x" id="close-question-editor">×</button></div>${questionFormMarkup(q)}${q.id?`<section class="panel record-meta"><h3>Record details</h3><dl><dt>ID</dt><dd>${esc(q.id)}</dd><dt>SOURCE</dt><dd>${esc(q.source_type||'manual')}</dd><dt>CANONICAL KEY</dt><dd>${esc(q.canonical_key||'—')}</dd><dt>CONTENT SYNC</dt><dd>${q.content_locked?'LOCKED BY ADMIN EDIT':'AUTOMATED UPDATES ALLOWED'}</dd><dt>PHOTO GATE</dt><dd>${q.photo_disabled?`DISABLED ${q.photo_disabled_at?`· ${esc(formatWhen(q.photo_disabled_at))}`:''}`:'NOT DISABLED'}</dd><dt>CREATED</dt><dd>${esc(formatWhen(q.created_at))}</dd><dt>UPDATED</dt><dd>${esc(formatWhen(q.updated_at||q.created_at))}</dd>${q.deleted_at?`<dt>DELETED</dt><dd>${esc(formatWhen(q.deleted_at))}${q.delete_reason?` · ${esc(q.delete_reason)}`:''}</dd>`:''}</dl></section>`:''}</aside></div>`;
    const form=$('#question-editor-form');form.difficulty.value=q.difficulty||'medium';form.question_type.value=q.question_type||'numeric';
    $('#close-question-editor').onclick=()=>d.remove();d.querySelector('.drawer-backdrop').onclick=e=>{if(e.target.classList.contains('drawer-backdrop'))d.remove()};
    form.onsubmit=e=>saveQuestionEditor(e,q.id);
    const media=$('#open-question-media');if(media)media.onclick=async()=>{d.remove();adminSection='media';await renderDashboard();openQuestion(q.id)};
    const del=$('#retire-question');if(del)del.onclick=()=>retireQuestion(q.id,d);
    const restore=$('#restore-question');if(restore)restore.onclick=()=>restoreQuestion(q.id,d);
  }catch(e){console.error(e);toast(e.message,'bad')}
}

function editorPayload(form){const f=new FormData(form);const options=String(f.get('options')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);return {prompt:String(f.get('prompt')||'').trim(),category:String(f.get('category')||'General').trim(),difficulty:String(f.get('difficulty')||'medium'),question_type:String(f.get('question_type')||'numeric'),context:String(f.get('context')||'').trim(),unit:String(f.get('unit')||'').trim(),answer_numeric:String(f.get('answer_numeric')||'').trim(),answer_text:String(f.get('answer_text')||'').trim(),options,correct_option:String(f.get('correct_option')??'0'),explanation:String(f.get('explanation')||'').trim(),source_url:String(f.get('source_url')||'').trim(),media_query:String(f.get('media_query')||'').trim()}}
async function saveQuestionEditor(e,id){e.preventDefault();const form=e.currentTarget,btn=form.querySelector('[type="submit"]');btn.disabled=true;try{const payload=editorPayload(form);questionDetail=id?await rpc('admin_update_question_v10',{p_question_id:id,p_payload:payload}):await rpc('admin_create_question_v10',{p_payload:payload});toast(id?'Question updated.':'Question created.','good');$('#question-editor-root')?.remove();await renderQuestionExplorer()}catch(err){console.error(err);toast(err.message,'bad')}finally{btn.disabled=false}}
async function retireQuestion(id,drawer){if(!confirm('Delete this question from the active bank? Any live Party or Practice session using it will skip it immediately.'))return;try{const out=await rpc('admin_delete_question_v15',{p_question_id:id,p_reason:'Deleted from Question Explorer',p_practice_session_id:null});toast(`Deleted. ${Number(out?.games_touched||0)} live game(s) and ${Number(out?.practices_touched||0)} practice session(s) updated.`,'good');drawer.remove();renderQuestionExplorer()}catch(e){console.error(e);toast(e.message,'bad')}}
async function restoreQuestion(id,drawer){try{await rpc('admin_restore_question_v15',{p_question_id:id});toast('Question restored to the active bank.','good');drawer.remove();renderQuestionExplorer()}catch(e){console.error(e);toast(e.message,'bad')}}

function auditSummary(item){const local=item.metadata?.origin==='local_content_studio';if(item.action==='create')return local?'Imported new question from Local Content Studio':'Created a new question';if(item.action==='delete')return `Deleted from active bank${item.metadata?.reason?` · ${item.metadata.reason}`:''}`;if(item.action==='restore')return 'Restored to active bank';if(item.action==='media_disable')return 'Disabled by the no-valid-photo quality gate';if(item.action==='media_restore')return 'Restored from the photo quality gate';const before=item.before_data||{},after=item.after_data||{},keys=['prompt','category','difficulty','question_type','context','unit','answer_numeric','answer_text','correct_option','options','explanation','source_url','media_query'];const changed=keys.filter(k=>JSON.stringify(before[k]??null)!==JSON.stringify(after[k]??null));if(local)return changed.length?`Local Content Studio synced ${changed.join(', ')}`:'Local Content Studio sync';return changed.length?`Changed ${changed.join(', ')}`:'Updated question'}
async function renderAuditLog(){
  adminSection='changes';clearTimeout(liveOpsTimer);
  try{const data=await rpc('admin_list_question_audit_v10',{p_action:auditFilters.action,p_search:auditFilters.search||null,p_limit:auditFilters.limit,p_offset:auditFilters.offset});const items=data?.items||[],total=Number(data?.total||0);$('#admin-app').innerHTML=`${adminHeader('changes')}<main class="shell"><section class="hero"><div><small>AUDIT HISTORY</small><h1>Every question change.</h1><p>Manual changes and Local Content Studio imports are recorded with the acting administrator, timestamp, origin metadata and compact before/after changes.</p></div></section><form class="toolbar audit-toolbar" id="audit-filters"><input class="search" name="search" value="${esc(auditFilters.search)}" placeholder="Search question or administrator"><select name="action"><option value="all">All changes</option><option value="create">Created</option><option value="edit">Edited</option><option value="delete">Deleted</option><option value="restore">Restored</option><option value="media_disable">Photo disabled</option><option value="media_restore">Photo restored</option></select><button class="btn primary">Apply</button></form><section class="audit-list">${items.length?items.map(a=>`<article class="audit-card ${esc(a.action)}"><div class="audit-icon">${a.action==='create'?'＋':a.action==='edit'?'✎':a.action==='delete'?'×':a.action==='media_disable'?'▧':a.action==='media_restore'?'↥':'↺'}</div><div class="audit-copy"><div class="audit-top"><span class="audit-action">${esc(a.action.toUpperCase())}</span><time>${esc(formatWhen(a.created_at))}</time></div><h3>${esc(a.prompt)}</h3><p>${esc(auditSummary(a))}</p><small>By <b>${esc(a.actor_username||a.actor_email||'Unknown admin')}</b>${a.actor_email&&a.actor_username?` · ${esc(a.actor_email)}`:''}</small><details><summary>View changed fields</summary><pre>${esc(JSON.stringify({before:a.before_data,after:a.after_data,metadata:a.metadata},null,2))}</pre></details></div></article>`).join(''):`<div class="empty">No audit entries match these filters.</div>`}</section><div class="pager"><button class="btn" id="a-prev" ${auditFilters.offset<=0?'disabled':''}>← Previous</button><span class="btn">${fmt(Math.min(auditFilters.offset+1,total))}–${fmt(Math.min(auditFilters.offset+auditFilters.limit,total))} of ${fmt(total)}</span><button class="btn" id="a-next" ${auditFilters.offset+auditFilters.limit>=total?'disabled':''}>Next →</button></div></main>`;const form=$('#audit-filters');form.action.value=auditFilters.action;form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);auditFilters={...auditFilters,search:String(f.get('search')||'').trim(),action:String(f.get('action')||'all'),offset:0};renderAuditLog()};$('#a-prev').onclick=()=>{auditFilters.offset=Math.max(0,auditFilters.offset-auditFilters.limit);renderAuditLog()};$('#a-next').onclick=()=>{auditFilters.offset+=auditFilters.limit;renderAuditLog()};bindAdminChrome(()=>renderAuditLog())}catch(e){console.error(e);toast(e.message,'bad')}
}

function licenseClass(c){return c.auto_eligible?'license-ok':'license-review'}
function candidateCard(c,index=null){const selected=detail?.question?.media_candidate_id===c.id;const key=index===null?`candidate:${c.id}`:`live:${index}`;return `<article class="candidate ${selected?'selected':''}"><div class="cand-img">${imgTag(c.thumbnail_url||c.image_url,c.title)||'Image unavailable'}</div><div class="cand-body"><div class="tags"><span class="tag">${esc(c.provider||'external')}</span>${selected?'<span class="tag approved">CURRENT</span>':''}${c.auto_eligible?'<span class="tag approved">AUTO SAFE</span>':'<span class="tag missing">REVIEW</span>'}</div><h4>${esc(c.title||'Untitled image')}</h4><p>${esc(c.creator||'Unknown creator')}</p><p class="${licenseClass(c)}">${esc(c.license||'License metadata unavailable')}</p><p>Score ${Math.round(Number(c.score||0))}${c.width?` · ${c.width}×${c.height||'?'}`:''}</p><div class="cand-actions"><button class="btn tiny" data-cand-action="use" data-key="${esc(key)}">Use now</button><button class="btn tiny good" data-cand-action="approve" data-key="${esc(key)}">Approve + lock</button>${index===null?`<button class="btn tiny danger" data-cand-action="reject" data-key="${esc(key)}">Reject</button>`:''}${safeUrl(c.source_url)?`<a class="btn tiny" href="${esc(safeUrl(c.source_url))}" target="_blank" rel="noopener">Source</a>`:''}</div></div></article>`}

function renderDrawer(){
  const q=detail.question,cands=detail.candidates||[];
  const current=q.image_url?`<img src="${esc(safeUrl(q.image_url))}" alt="${esc(q.image_alt||q.prompt)}" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.insertAdjacentHTML('beforeend','<div class=&quot;image-missing&quot;>Current image failed to load</div>')">`:`<div class="image-missing">No image selected</div>`;
  let d=$('#drawer-root');if(!d){d=document.createElement('div');d.id='drawer-root';document.body.appendChild(d)}
  d.innerHTML=`<div class="drawer-backdrop"><aside class="drawer"><div class="drawer-head"><div><span class="eyebrow">${esc(q.category)} · ${esc(q.difficulty)}</span><h2>${esc(q.prompt)}</h2><div class="tags">${statusTag(q)}${q.media_provider?`<span class="tag">${esc(q.media_provider)}</span>`:''}</div></div><button class="x" id="close-drawer">×</button></div>
    <section class="current-media"><div class="image-card">${current}</div><div class="media-info"><small class="eyebrow">CURRENT LIVE MEDIA</small><dl><dt>QUERY</dt><dd>${esc(q.media_query||'—')}</dd><dt>PROVIDER</dt><dd>${esc(q.media_provider||'—')}</dd><dt>ATTRIBUTION</dt><dd>${esc(q.image_attribution||'—')}</dd><dt>LICENSE</dt><dd>${esc(q.image_license||'—')}</dd><dt>SOURCE</dt><dd>${safeUrl(q.image_source_url)?`<a href="${esc(safeUrl(q.image_source_url))}" target="_blank">Open source page</a>`:'—'}</dd></dl><div class="actions">${q.image_url&&q.media_review_status!=='approved'?'<button class="btn good" data-action="approve-current">Approve + lock</button>':''}${q.media_locked?'<button class="btn" data-action="unlock">Unlock automation</button>':'<button class="btn warn" data-action="queue">Queue re-resolve</button>'}<button class="btn danger" data-action="clear">No image + lock</button></div></div></section>
    <section class="panel"><div class="panel-title"><div><h3>Media search subject</h3><p>Changing this improves future automated and manual searches.</p></div></div><div class="query-row"><input id="media-query" value="${esc(q.media_query||'')}" placeholder="e.g. Venus planet"><button class="btn" data-action="save-query">Save query</button><button class="btn primary" data-action="find-more">Find more now</button></div><div id="search-status" class="search-status"></div><div id="live-results" class="candidate-grid"></div></section>
    <section class="panel"><div class="panel-title"><div><h3>Resolver candidates</h3><p>These are compact metadata records. The actual image files remain at their licensed source.</p></div><span class="tag">${cands.length} saved</span></div><div class="candidate-grid">${cands.length?cands.map(c=>candidateCard(c)).join(''):'<div class="empty">No saved candidates yet. Use Find more or let the scheduled resolver populate this question.</div>'}</div></section>
    <section class="panel"><div class="panel-title"><div><h3>Manual image override</h3><p>Use this when you already know the exact image and source. Approving locks it from automated replacement.</p></div></div><form id="manual-form" class="manual-form"><input class="wide" name="image_url" required placeholder="Direct image URL (https://…)"><input class="wide" name="source_url" placeholder="Source/landing page URL"><input name="creator" placeholder="Creator / attribution"><input name="license" placeholder="License (e.g. CC BY 4.0)"><input name="license_url" placeholder="License URL"><input name="title" placeholder="Image title / alt text"><button class="btn" name="mode" value="use">Use now</button><button class="btn good" name="mode" value="approve">Approve + lock</button></form></section>
  </aside></div>`;
  $('#close-drawer').onclick=()=>d.remove();$('.drawer-backdrop').onclick=e=>{if(e.target.classList.contains('drawer-backdrop'))d.remove()};
  bindDrawer();
}

async function refreshDetail(){detail=await rpc('admin_get_question_media',{p_question_id:detail.question.id});renderDrawer()}
function bindDrawer(){
  $$('[data-action="approve-current"]').forEach(b=>b.onclick=()=>doRpc('admin_approve_current_media',{p_question_id:detail.question.id},'Approved and locked.'));
  $$('[data-action="unlock"]').forEach(b=>b.onclick=()=>doRpc('admin_unlock_question_media',{p_question_id:detail.question.id},'Automation unlocked.'));
  $$('[data-action="queue"]').forEach(b=>b.onclick=()=>doRpc('admin_update_media_query',{p_question_id:detail.question.id,p_query:$('#media-query').value},'Queued for the next resolver run.'));
  $$('[data-action="clear"]').forEach(b=>b.onclick=()=>doRpc('admin_clear_question_media',{p_question_id:detail.question.id,p_lock:true},'Question locked with no image.'));
  $$('[data-action="save-query"]').forEach(b=>b.onclick=()=>doRpc('admin_update_media_query',{p_question_id:detail.question.id,p_query:$('#media-query').value},'Search subject saved.'));
  $$('[data-action="find-more"]').forEach(b=>b.onclick=()=>findMore($('#media-query').value||detail.question.prompt));
  $$('[data-cand-action]').forEach(b=>b.onclick=()=>candidateAction(b.dataset.candAction,b.dataset.key));
  const mf=$('#manual-form');if(mf)mf.onsubmit=manualSubmit;
}
async function doRpc(name,args,msg){try{detail=await rpc(name,args);toast(msg,'good');renderDrawer();renderDashboard()}catch(e){console.error(e);toast(e.message,'bad')}}
async function openQuestion(id){try{detail=await rpc('admin_get_question_media',{p_question_id:id});liveCandidates=[];renderDrawer()}catch(e){toast(e.message,'bad')}}

function htmlText(raw=''){const t=document.createElement('textarea');t.innerHTML=String(raw).replace(/<[^>]*>/g,' ');return t.value.replace(/\s+/g,' ').trim()}
function ext(meta,key){return htmlText(meta?.[key]?.value||'')}
async function searchCommons(query){const p=new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'12',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1000',iiextmetadatafilter:'Artist|Credit|LicenseShortName|LicenseUrl|ObjectName'});const r=await fetch(`https://commons.wikimedia.org/w/api.php?${p}`);if(!r.ok)throw new Error(`Commons search failed (${r.status})`);const body=await r.json();return (body.query?.pages||[]).flatMap(page=>{const i=page.imageinfo?.[0];if(!i)return[];const m=i.extmetadata||{};return[{provider:'wikimedia',provider_key:String(page.pageid||page.title),title:ext(m,'ObjectName')||String(page.title||'').replace(/^File:/,''),image_url:safeUrl(i.url),thumbnail_url:safeUrl(i.thumburl||i.url),source_url:safeUrl(i.descriptionurl),creator:ext(m,'Artist')||ext(m,'Credit')||'Wikimedia Commons contributor',creator_url:null,license:ext(m,'LicenseShortName')||'Wikimedia Commons license',license_url:safeUrl(m?.LicenseUrl?.value),width:i.thumbwidth||i.width||null,height:i.thumbheight||i.height||null,score:120,auto_eligible:true}]}).filter(x=>x.image_url&&x.source_url)}
async function searchWikipediaLead(query){
  const p=new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',generator:'search',gsrsearch:query,gsrnamespace:'0',gsrlimit:'4',prop:'pageimages',piprop:'name|thumbnail',pithumbsize:'1000'});
  const r=await fetch(`https://en.wikipedia.org/w/api.php?${p}`);if(!r.ok)throw new Error(`Wikipedia search failed (${r.status})`);
  const body=await r.json();const leads=(body.query?.pages||[]).filter(x=>x.pageimage).map(x=>({article:x.title,file:`File:${x.pageimage}`}));if(!leads.length)return[];
  const cp=new URLSearchParams({action:'query',format:'json',formatversion:'2',origin:'*',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1000',iiextmetadatafilter:'Artist|Credit|LicenseShortName|LicenseUrl|ObjectName',titles:leads.map(x=>x.file).join('|')});
  const cr=await fetch(`https://commons.wikimedia.org/w/api.php?${cp}`);if(!cr.ok)throw new Error(`Commons verification failed (${cr.status})`);const cb=await cr.json();
  const amap=new Map(leads.map(x=>[x.file.replace(/_/g,' '),x.article]));
  return (cb.query?.pages||[]).flatMap(page=>{const i=page.imageinfo?.[0];if(!i)return[];const m=i.extmetadata||{},article=amap.get(String(page.title||'').replace(/_/g,' '))||query;return[{provider:'wikipedia',provider_key:String(page.pageid||page.title),title:ext(m,'ObjectName')||String(page.title||'').replace(/^File:/,''),image_url:safeUrl(i.url),thumbnail_url:safeUrl(i.thumburl||i.url),source_url:safeUrl(i.descriptionurl),creator:ext(m,'Artist')||ext(m,'Credit')||'Wikimedia Commons contributor',creator_url:null,license:ext(m,'LicenseShortName')||'Wikimedia Commons license',license_url:safeUrl(m?.LicenseUrl?.value),width:i.thumbwidth||i.width||null,height:i.thumbheight||i.height||null,score:130,auto_eligible:true,metadata:{wikipedia_article:article}}]}).filter(x=>x.image_url&&x.source_url)
}
function openverseEligible(license=''){const s=String(license).toLowerCase().replace(/^cc\s*/,'').replace(/\s+/g,'-');return['cc0','pdm','public-domain','by','by-sa'].includes(s)}
async function searchOpenverse(query){const p=new URLSearchParams({q:query,page_size:'12'});const r=await fetch(`https://api.openverse.org/v1/images/?${p}`);if(!r.ok)throw new Error(`Openverse search failed (${r.status})`);const body=await r.json();return (body.results||[]).filter(x=>!x.is_sensitive&&!x.sensitivity?.length).map(x=>({provider:'openverse',provider_key:String(x.id||x.foreign_identifier||x.url),title:x.title||query,image_url:safeUrl(x.url),thumbnail_url:safeUrl(x.thumbnail||x.url),source_url:safeUrl(x.foreign_landing_url||x.detail_url),creator:x.creator||'Unknown creator',creator_url:safeUrl(x.creator_url),license:[x.license,x.license_version].filter(Boolean).join(' '),license_url:safeUrl(x.license_url||x.meta_data?.license_url),width:x.width||null,height:x.height||null,score:95,auto_eligible:openverseEligible(x.license)})).filter(x=>x.image_url&&x.source_url)}
async function findMore(query){const status=$('#search-status'),box=$('#live-results');status.textContent='Searching Wikipedia, Wikimedia Commons, and Openverse…';box.innerHTML='';try{const settled=await Promise.allSettled([searchWikipediaLead(query),searchCommons(query),searchOpenverse(query)]);liveCandidates=settled.flatMap(r=>r.status==='fulfilled'?r.value:[]);const seen=new Set();liveCandidates=liveCandidates.filter(c=>{const k=c.image_url;if(seen.has(k))return false;seen.add(k);return true}).slice(0,24);status.textContent=`Found ${liveCandidates.length} options. Auto-safe means the license is suitable for automatic display by our resolver; always keep attribution/source metadata.`;box.innerHTML=liveCandidates.length?liveCandidates.map((c,i)=>candidateCard(c,i)).join(''):'<div class="empty">No reusable images found for that search.</div>';$$('[data-cand-action]',box).forEach(b=>b.onclick=()=>candidateAction(b.dataset.candAction,b.dataset.key))}catch(e){console.error(e);status.textContent=e.message}}
async function candidateAction(action,key){try{if(key.startsWith('candidate:')){const id=key.slice(10);if(action==='reject'){detail=await rpc('admin_reject_media_candidate',{p_candidate_id:id});toast('Candidate rejected.','good')}else{detail=await rpc('admin_select_media_candidate',{p_question_id:detail.question.id,p_candidate_id:id,p_approve:action==='approve'});toast(action==='approve'?'Approved and locked.':'Image is live.','good')}}else{const c=liveCandidates[Number(key.slice(5))];if(!c)return;detail=await rpc('admin_use_external_media',{p_question_id:detail.question.id,p_provider:c.provider,p_provider_key:c.provider_key,p_title:c.title,p_image_url:c.image_url,p_thumbnail_url:c.thumbnail_url||null,p_source_url:c.source_url||null,p_creator:c.creator||null,p_creator_url:c.creator_url||null,p_license:c.license||null,p_license_url:c.license_url||null,p_width:c.width||null,p_height:c.height||null,p_score:c.score||100,p_auto_eligible:!!c.auto_eligible,p_approve:action==='approve'});toast(action==='approve'?'Approved and locked.':'Image is live.','good')}renderDrawer();renderDashboard()}catch(e){console.error(e);toast(e.message,'bad')}}
async function manualSubmit(e){e.preventDefault();const f=new FormData(e.currentTarget);const submitter=e.submitter;try{detail=await rpc('admin_use_external_media',{p_question_id:detail.question.id,p_provider:'manual',p_provider_key:crypto.randomUUID(),p_title:String(f.get('title')||detail.question.media_query||detail.question.prompt),p_image_url:String(f.get('image_url')||''),p_thumbnail_url:null,p_source_url:String(f.get('source_url')||'')||null,p_creator:String(f.get('creator')||'')||null,p_creator_url:null,p_license:String(f.get('license')||'')||null,p_license_url:String(f.get('license_url')||'')||null,p_width:null,p_height:null,p_score:200,p_auto_eligible:false,p_approve:submitter?.value==='approve'});toast(submitter?.value==='approve'?'Manual image approved and locked.':'Manual image is live.','good');renderDrawer();renderDashboard()}catch(err){console.error(err);toast(err.message,'bad')}}

async function boot(){if(!configured()){renderAuth('Supabase is not configured in /trivia/config.js.');return}try{await loadClient();if(!session){renderAuth();return}if(!(await checkAdmin())){renderAuth('This account is not marked as a Trivia admin.');return}await renderDashboard()}catch(e){console.error(e);renderAuth(e.message)}}
boot();
