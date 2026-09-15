const config = window.TRIVIA_CONFIG || {};
const $=(s,e=document)=>e.querySelector(s);
const $$=(s,e=document)=>[...e.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""),location.origin);if(!['http:','https:'].includes(u.protocol))return'';if(u.protocol==='http:')u.protocol='https:';return u.href}catch{return''}};
const fmt=n=>Number(n||0).toLocaleString();
let supabase=null, session=null, detail=null, liveCandidates=[];
let filters={search:'',media_filter:'all',provider:'',category:'',offset:0,limit:40};
let adminSection='media';
let questionDetail=null;
let questionFilters={search:'',category:'',difficulty:'any',status:'active',source:'',offset:0,limit:50};
let auditFilters={search:'',action:'all',offset:0,limit:100};

function toast(msg,tone=''){const n=document.createElement('div');n.className=`toast ${tone}`;n.textContent=msg;$('#toast-root').appendChild(n);setTimeout(()=>n.remove(),3200)}
async function loadClient(){const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');supabase=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data}=await supabase.auth.getSession();session=data.session;supabase.auth.onAuthStateChange((_e,s)=>{session=s;if(!s)renderAuth()});}
function configured(){return config.supabaseUrl&&!String(config.supabaseUrl).includes('YOUR_PROJECT')&&config.supabasePublishableKey&&!String(config.supabasePublishableKey).includes('REPLACE_ME')}
async function rpc(name,args={}){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
async function signIn(){const redirectTo=new URL('./',location.href).href;const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});if(error)throw error}
async function signOut(){await supabase.auth.signOut();session=null;renderAuth()}
function renderAuth(message=''){document.body.classList.remove('ready');$('#admin-app').innerHTML=`<section class="auth panel"><div class="mark">?</div><div class="eyebrow">TRIVIA ADMIN</div><h1>Control center.</h1><p>${message?esc(message):'Sign in with the Google account that is marked as an admin in your Trivia profile.'}</p><button class="btn primary" id="login">Sign in with Google</button><a class="btn" href="../trivia/">Back to Trivia</a></section>`;$('#login').onclick=()=>signIn().catch(e=>toast(e.message,'bad'))}
function statusTag(q){const st=q.media_review_status||'unreviewed';const cls=q.image_url?(st==='approved'?'approved':'auto'):'missing';return `<span class="tag ${cls}">${esc(q.image_url?st.toUpperCase():'MISSING')}</span>${q.media_locked?'<span class="tag approved">LOCKED</span>':''}`}
function imgTag(url,alt=''){const src=safeUrl(url);return src?`<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}

function adminHeader(active='media'){return `<header class="top"><div class="brand"><i>?</i><span>Trivia Admin</span><small>${active.toUpperCase()}</small></div><nav class="admin-tabs"><button class="${active==='questions'?'active':''}" data-admin-tab="questions">Questions</button><button class="${active==='media'?'active':''}" data-admin-tab="media">Media</button><button class="${active==='changes'?'active':''}" data-admin-tab="changes">Changes</button></nav><div class="top-actions"><a class="btn tiny" href="../trivia/">Open Trivia</a><button class="btn tiny" id="refresh">Refresh</button><button class="btn tiny danger" id="logout">Sign out</button></div></header>`}
function bindAdminChrome(refreshFn){
  $$('[data-admin-tab]').forEach(b=>b.onclick=()=>{adminSection=b.dataset.adminTab;if(adminSection==='questions')renderQuestionExplorer();else if(adminSection==='changes')renderAuditLog();else renderDashboard()});
  const r=$('#refresh');if(r)r.onclick=refreshFn;const l=$('#logout');if(l)l.onclick=()=>signOut();
}
function formatWhen(v){try{return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return String(v||'')}}

async function overview(){return await rpc('admin_media_overview')}
async function listQuestions(){return await rpc('admin_list_media_questions',{p_search:filters.search||null,p_media_filter:filters.media_filter,p_provider:filters.provider||null,p_category:filters.category||null,p_limit:filters.limit,p_offset:filters.offset})}
async function checkAdmin(){return await rpc('is_trivia_admin')}

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
  const status=$('#local-pipeline-status');
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

async function renderDashboard(){
  try{
    const [stats,list]=await Promise.all([overview(),listQuestions()]);
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
            <a class="btn" href="./downloads/WhatMod-Trivia-Media-Resolver-Windows.zip" download>Download Windows resolver</a>
            <button class="btn primary" id="export-local-job" type="button">Export media job</button>
            <label class="btn good import-button">Import resolver results<input id="import-local-results" type="file" accept=".json,application/json" hidden></label>
          </div>
          <div class="pipeline-flow"><b>1</b><span>Export JSON</span><i>→</i><b>2</b><span>Resolve locally</span><i>→</i><b>3</b><span>Import JSON</span></div>
          <div id="local-pipeline-status" class="pipeline-status">Local imports publish the resolver's best reuse-safe image immediately. Existing locked/approved images are skipped.</div>
        </section>
        <form class="toolbar" id="filters">
          <input class="search" name="search" placeholder="Search question or media subject" value="${esc(filters.search)}">
          <select name="media_filter"><option value="all">All media</option><option value="missing">Missing image</option><option value="auto">Auto live</option><option value="approved">Approved</option><option value="unreviewed">Needs review</option><option value="locked">Locked</option><option value="rejected">Rejected/no image</option></select>
          <select name="provider"><option value="">All providers</option><option value="wikimedia">Wikimedia</option><option value="wikipedia">Wikipedia lead (Commons-verified)</option><option value="openverse">Openverse</option><option value="manual">Manual</option><option value="legacy">Legacy</option></select>
          <select name="category"><option value="">All categories</option>${['Science','Technology','History','Geography','Animals','Space','Sports','Entertainment','Business'].map(x=>`<option>${x}</option>`).join('')}</select>
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
    $('#import-local-results').onchange=e=>importLocalMediaResults(e.target.files?.[0]);
  }catch(e){console.error(e);if(/admin only/i.test(e.message))renderAuth('This Google account is signed in, but it is not marked as a Trivia admin.');else toast(e.message,'bad')}
}

async function renderQuestionExplorer(){
  adminSection='questions';
  try{
    const [stats,list]=await Promise.all([
      rpc('admin_question_overview'),
      rpc('admin_list_questions_v10',{p_search:questionFilters.search||null,p_category:questionFilters.category||null,p_difficulty:questionFilters.difficulty,p_status:questionFilters.status,p_source:questionFilters.source||null,p_limit:questionFilters.limit,p_offset:questionFilters.offset})
    ]);
    const items=list?.items||[],total=Number(list?.total||0);
    $('#admin-app').innerHTML=`${adminHeader('questions')}<main class="shell">
      <section class="hero"><div><small>QUESTION EXPLORER</small><h1>The question bank.</h1><p>Search every active or retired question, see community approval, edit answers and explanations, add manual questions, or remove a bad question from every active game instantly.</p></div><button class="btn primary" id="add-question">＋ Add question</button></section>
      <section class="stats question-stats"><div class="stat"><span>ACTIVE</span><b>${fmt(stats.active)}</b></div><div class="stat"><span>RETIRED</span><b>${fmt(stats.retired)}</b></div><div class="stat"><span>HYDRATED</span><b>${fmt(stats.hydrated)}</b></div><div class="stat"><span>MANUAL</span><b>${fmt(stats.manual)}</b></div><div class="stat"><span>👍 VOTES</span><b>${fmt(stats.total_upvotes)}</b></div><div class="stat"><span>👎 VOTES</span><b>${fmt(stats.total_downvotes)}</b></div></section>
      <form class="toolbar question-toolbar" id="question-filters"><input class="search" name="search" placeholder="Search prompt, canonical key or media subject" value="${esc(questionFilters.search)}"><select name="status"><option value="active">Active</option><option value="retired">Deleted / retired</option><option value="all">All</option></select><select name="difficulty"><option value="any">Any difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select><select name="category"><option value="">All categories</option>${['Science','Technology','History','Geography','Animals','Space','Sports','Entertainment','Business','General'].map(x=>`<option>${x}</option>`).join('')}</select><button class="btn primary">Apply</button></form>
      <section class="question-explorer-list">${items.length?items.map(q=>`<article class="explorer-row ${q.is_active?'':'retired'}" data-edit-qid="${esc(q.id)}"><div class="explorer-status"><span class="status-dot ${q.is_active?'live':'off'}"></span><small>${q.is_active?'ACTIVE':'RETIRED'}</small></div><div class="explorer-main"><h3>${esc(q.prompt)}</h3><div class="tags"><span class="tag">${esc(q.category)}</span><span class="tag">${esc(q.difficulty)}</span><span class="tag">${esc(q.question_type)}</span><span class="tag">${esc(q.source_type||'manual')}</span></div></div><div class="community-score"><span class="vote-up">👍 ${fmt(q.upvotes)}</span><span class="vote-down">👎 ${fmt(q.downvotes)}</span><b>${Number(q.upvotes||0)-Number(q.downvotes||0)>=0?'+':''}${fmt(Number(q.upvotes||0)-Number(q.downvotes||0))}</b></div><div class="explorer-date"><small>UPDATED</small><span>${esc(formatWhen(q.updated_at||q.created_at))}</span></div></article>`).join(''):`<div class="empty">No questions match these filters.</div>`}</section>
      <div class="pager"><button class="btn" id="q-prev" ${questionFilters.offset<=0?'disabled':''}>← Previous</button><span class="btn">${fmt(Math.min(questionFilters.offset+1,total))}–${fmt(Math.min(questionFilters.offset+questionFilters.limit,total))} of ${fmt(total)}</span><button class="btn" id="q-next" ${questionFilters.offset+questionFilters.limit>=total?'disabled':''}>Next →</button></div>
    </main>`;
    const form=$('#question-filters');form.status.value=questionFilters.status;form.difficulty.value=questionFilters.difficulty;form.category.value=questionFilters.category;
    form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);questionFilters={...questionFilters,search:String(f.get('search')||'').trim(),status:String(f.get('status')||'active'),difficulty:String(f.get('difficulty')||'any'),category:String(f.get('category')||''),offset:0};renderQuestionExplorer()};
    $$('[data-edit-qid]').forEach(row=>row.onclick=()=>openQuestionEditor(row.dataset.editQid));
    $('#add-question').onclick=()=>openQuestionEditor(null);
    $('#q-prev').onclick=()=>{questionFilters.offset=Math.max(0,questionFilters.offset-questionFilters.limit);renderQuestionExplorer()};
    $('#q-next').onclick=()=>{questionFilters.offset+=questionFilters.limit;renderQuestionExplorer()};
    bindAdminChrome(()=>renderQuestionExplorer());
  }catch(e){console.error(e);toast(e.message,'bad')}
}

function questionFormMarkup(q={}){
  const options=Array.isArray(q.options)?q.options.join('\n'):'';
  return `<form id="question-editor-form" class="question-editor-form"><div class="editor-grid"><label class="wide"><span>PROMPT</span><textarea name="prompt" required>${esc(q.prompt||'')}</textarea></label><label><span>CATEGORY</span><input name="category" value="${esc(q.category||'General')}" required></label><label><span>DIFFICULTY</span><select name="difficulty"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label><span>QUESTION TYPE</span><select name="question_type"><option value="numeric">Numeric estimate</option><option value="multiple_choice">Multiple choice</option><option value="text">Text</option></select></label><label><span>UNIT</span><input name="unit" value="${esc(q.unit||'')}" placeholder="km, year, people…"></label><label class="wide"><span>CONTEXT</span><textarea name="context">${esc(q.context||'')}</textarea></label><label><span>NUMERIC ANSWER</span><input name="answer_numeric" type="number" step="any" value="${esc(q.answer_numeric??'')}"></label><label><span>TEXT ANSWER</span><input name="answer_text" value="${esc(q.answer_text||'')}"></label><label class="wide"><span>MULTIPLE-CHOICE OPTIONS · ONE PER LINE</span><textarea name="options">${esc(options)}</textarea></label><label><span>CORRECT OPTION</span><input name="correct_option" type="number" min="0" value="${esc(q.correct_option??0)}"><small>0 = first option</small></label><label><span>MEDIA SEARCH SUBJECT</span><input name="media_query" value="${esc(q.media_query||'')}"></label><label class="wide"><span>EXPLANATION</span><textarea name="explanation">${esc(q.explanation||'')}</textarea></label><label class="wide"><span>FACT SOURCE URL</span><input name="source_url" value="${esc(q.source_url||'')}"></label></div><div class="editor-actions"><button class="btn primary" type="submit">${q.id?'Save changes':'Create question'}</button>${q.id?`<button class="btn" type="button" id="open-question-media">Media</button>${q.is_active?'<button class="btn danger" type="button" id="retire-question">Delete from bank</button>':'<button class="btn good" type="button" id="restore-question">Restore question</button>'}`:''}</div></form>`;
}

async function openQuestionEditor(id){
  try{
    questionDetail=id?await rpc('admin_get_question_v10',{p_question_id:id}):{question:{category:'General',difficulty:'medium',question_type:'numeric',is_active:true},votes:{upvotes:0,downvotes:0}};
    const q=questionDetail.question,v=questionDetail.votes||{};
    let d=$('#question-editor-root');if(!d){d=document.createElement('div');d.id='question-editor-root';document.body.appendChild(d)}
    d.innerHTML=`<div class="drawer-backdrop"><aside class="drawer question-editor-drawer"><div class="drawer-head"><div><span class="eyebrow">${q.id?'EDIT QUESTION':'NEW MANUAL QUESTION'}</span><h2>${esc(q.prompt||'Create a question')}</h2>${q.id?`<div class="editor-votes"><span>👍 ${fmt(v.upvotes)}</span><span>👎 ${fmt(v.downvotes)}</span><span>${q.is_active?'ACTIVE':'RETIRED'}</span></div>`:''}</div><button class="x" id="close-question-editor">×</button></div>${questionFormMarkup(q)}${q.id?`<section class="panel record-meta"><h3>Record details</h3><dl><dt>ID</dt><dd>${esc(q.id)}</dd><dt>SOURCE</dt><dd>${esc(q.source_type||'manual')}</dd><dt>CANONICAL KEY</dt><dd>${esc(q.canonical_key||'—')}</dd><dt>CREATED</dt><dd>${esc(formatWhen(q.created_at))}</dd><dt>UPDATED</dt><dd>${esc(formatWhen(q.updated_at||q.created_at))}</dd>${q.deleted_at?`<dt>DELETED</dt><dd>${esc(formatWhen(q.deleted_at))}${q.delete_reason?` · ${esc(q.delete_reason)}`:''}</dd>`:''}</dl></section>`:''}</aside></div>`;
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
async function retireQuestion(id,drawer){if(!confirm('Delete this question from the active bank? Any live Party or Practice session using it will skip it immediately.'))return;try{const out=await rpc('admin_delete_question_v10',{p_question_id:id,p_reason:'Deleted from Question Explorer'});toast(`Deleted. ${Number(out?.games_touched||0)} live game(s) and ${Number(out?.practices_touched||0)} practice session(s) updated.`,'good');drawer.remove();renderQuestionExplorer()}catch(e){console.error(e);toast(e.message,'bad')}}
async function restoreQuestion(id,drawer){try{await rpc('admin_restore_question_v10',{p_question_id:id});toast('Question restored to the active bank.','good');drawer.remove();renderQuestionExplorer()}catch(e){console.error(e);toast(e.message,'bad')}}

function auditSummary(item){if(item.action==='create')return 'Created a new question';if(item.action==='delete')return `Deleted from active bank${item.metadata?.reason?` · ${item.metadata.reason}`:''}`;if(item.action==='restore')return 'Restored to active bank';const before=item.before_data||{},after=item.after_data||{},keys=['prompt','category','difficulty','question_type','context','unit','answer_numeric','answer_text','correct_option','options','explanation','source_url','media_query'];const changed=keys.filter(k=>JSON.stringify(before[k]??null)!==JSON.stringify(after[k]??null));return changed.length?`Changed ${changed.join(', ')}`:'Updated question'}
async function renderAuditLog(){
  adminSection='changes';
  try{const data=await rpc('admin_list_question_audit_v10',{p_action:auditFilters.action,p_search:auditFilters.search||null,p_limit:auditFilters.limit,p_offset:auditFilters.offset});const items=data?.items||[],total=Number(data?.total||0);$('#admin-app').innerHTML=`${adminHeader('changes')}<main class="shell"><section class="hero"><div><small>AUDIT HISTORY</small><h1>Every question change.</h1><p>Manual question additions, edits, removals and restores are recorded with the acting administrator, timestamp and before/after snapshots.</p></div></section><form class="toolbar audit-toolbar" id="audit-filters"><input class="search" name="search" value="${esc(auditFilters.search)}" placeholder="Search question or administrator"><select name="action"><option value="all">All changes</option><option value="create">Created</option><option value="edit">Edited</option><option value="delete">Deleted</option><option value="restore">Restored</option></select><button class="btn primary">Apply</button></form><section class="audit-list">${items.length?items.map(a=>`<article class="audit-card ${esc(a.action)}"><div class="audit-icon">${a.action==='create'?'＋':a.action==='edit'?'✎':a.action==='delete'?'×':'↺'}</div><div class="audit-copy"><div class="audit-top"><span class="audit-action">${esc(a.action.toUpperCase())}</span><time>${esc(formatWhen(a.created_at))}</time></div><h3>${esc(a.prompt)}</h3><p>${esc(auditSummary(a))}</p><small>By <b>${esc(a.actor_username||a.actor_email||'Unknown admin')}</b>${a.actor_email&&a.actor_username?` · ${esc(a.actor_email)}`:''}</small><details><summary>View snapshots</summary><pre>${esc(JSON.stringify({before:a.before_data,after:a.after_data,metadata:a.metadata},null,2))}</pre></details></div></article>`).join(''):`<div class="empty">No audit entries match these filters.</div>`}</section><div class="pager"><button class="btn" id="a-prev" ${auditFilters.offset<=0?'disabled':''}>← Previous</button><span class="btn">${fmt(Math.min(auditFilters.offset+1,total))}–${fmt(Math.min(auditFilters.offset+auditFilters.limit,total))} of ${fmt(total)}</span><button class="btn" id="a-next" ${auditFilters.offset+auditFilters.limit>=total?'disabled':''}>Next →</button></div></main>`;const form=$('#audit-filters');form.action.value=auditFilters.action;form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);auditFilters={...auditFilters,search:String(f.get('search')||'').trim(),action:String(f.get('action')||'all'),offset:0};renderAuditLog()};$('#a-prev').onclick=()=>{auditFilters.offset=Math.max(0,auditFilters.offset-auditFilters.limit);renderAuditLog()};$('#a-next').onclick=()=>{auditFilters.offset+=auditFilters.limit;renderAuditLog()};bindAdminChrome(()=>renderAuditLog())}catch(e){console.error(e);toast(e.message,'bad')}
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
