const config = window.TRIVIA_CONFIG || {};
const $=(s,e=document)=>e.querySelector(s);
const $$=(s,e=document)=>[...e.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const safeUrl=v=>{try{const u=new URL(String(v||""),location.origin);if(!['http:','https:'].includes(u.protocol))return'';if(u.protocol==='http:')u.protocol='https:';return u.href}catch{return''}};
const fmt=n=>Number(n||0).toLocaleString();
let supabase=null, session=null, detail=null, liveCandidates=[];
let filters={search:'',media_filter:'all',provider:'',category:'',offset:0,limit:40};

function toast(msg,tone=''){const n=document.createElement('div');n.className=`toast ${tone}`;n.textContent=msg;$('#toast-root').appendChild(n);setTimeout(()=>n.remove(),3200)}
async function loadClient(){const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');supabase=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data}=await supabase.auth.getSession();session=data.session;supabase.auth.onAuthStateChange((_e,s)=>{session=s;if(!s)renderAuth()});}
function configured(){return config.supabaseUrl&&!String(config.supabaseUrl).includes('YOUR_PROJECT')&&config.supabasePublishableKey&&!String(config.supabasePublishableKey).includes('REPLACE_ME')}
async function rpc(name,args={}){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
async function signIn(){const redirectTo=new URL('./',location.href).href;const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});if(error)throw error}
async function signOut(){await supabase.auth.signOut();session=null;renderAuth()}
function renderAuth(message=''){document.body.classList.remove('ready');$('#admin-app').innerHTML=`<section class="auth panel"><div class="mark">?</div><div class="eyebrow">TRIVIA ADMIN</div><h1>Media control room.</h1><p>${message?esc(message):'Sign in with the Google account that is marked as an admin in your Trivia profile.'}</p><button class="btn primary" id="login">Sign in with Google</button><a class="btn" href="../trivia/">Back to Trivia</a></section>`;$('#login').onclick=()=>signIn().catch(e=>toast(e.message,'bad'))}
function statusTag(q){const st=q.media_review_status||'unreviewed';const cls=q.image_url?(st==='approved'?'approved':'auto'):'missing';return `<span class="tag ${cls}">${esc(q.image_url?st.toUpperCase():'MISSING')}</span>${q.media_locked?'<span class="tag approved">LOCKED</span>':''}`}
function imgTag(url,alt=''){const src=safeUrl(url);return src?`<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}

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
      <header class="top"><div class="brand"><i>?</i><span>Trivia Admin</span><small>MEDIA</small></div><div class="top-actions"><a class="btn tiny" href="../trivia/">Open Trivia</a><button class="btn tiny" id="refresh">Refresh</button><button class="btn tiny danger" id="logout">Sign out</button></div></header>
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
    $('#refresh').onclick=()=>renderDashboard();$('#logout').onclick=()=>signOut();
    $('#export-local-job').onclick=exportLocalMediaJob;
    $('#import-local-results').onchange=e=>importLocalMediaResults(e.target.files?.[0]);
  }catch(e){console.error(e);if(/admin only/i.test(e.message))renderAuth('This Google account is signed in, but it is not marked as a Trivia admin.');else toast(e.message,'bad')}
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
