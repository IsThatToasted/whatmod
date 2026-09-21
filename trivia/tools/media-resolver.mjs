#!/usr/bin/env node
/*
  WhatMod Trivia V7 - Media Resolver V2

  Resolves a small rolling window of active question media from reusable sources.
  It NEVER needs to mirror millions of files. It stores compact candidate metadata
  and auto-selects the best verified image for each unlocked question.

  Required environment variables:
    TRIVIA_SUPABASE_URL
    TRIVIA_SUPABASE_SECRET_KEY        (preferred, sb_secret_...)
    TRIVIA_SUPABASE_SERVICE_ROLE_KEY  (legacy fallback only)

  Optional:
    MEDIA_RESOLVE_LIMIT=80     number of questions per run (1-250)
    MEDIA_CANDIDATES_PER_SOURCE=6

  Sources:
    1. Existing/Wikidata/Wikimedia Commons media
    2. Wikimedia Commons search
    3. Openverse open-license search

  Automatic selection is intentionally conservative. Openverse auto-selection is
  limited to public-domain/CC0/CC BY/CC BY-SA licenses. Other candidates may still
  be reviewed manually in /triviaadmin if they are ever added there.
*/

const SUPABASE_URL = String(process.env.TRIVIA_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = String(process.env.TRIVIA_SUPABASE_SECRET_KEY || process.env.TRIVIA_SUPABASE_SERVICE_ROLE_KEY || "").trim();
const LIMIT = Math.max(1, Math.min(250, Number(process.env.MEDIA_RESOLVE_LIMIT || 80) || 80));
const PER_SOURCE = Math.max(2, Math.min(12, Number(process.env.MEDIA_CANDIDATES_PER_SOURCE || 6) || 6));
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const OPENVERSE_API = "https://api.openverse.org/v1/images/";
const USER_AGENT = "WhatModTriviaMediaResolver/2.0 (https://whatmod.com/trivia/)";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing TRIVIA_SUPABASE_URL or Supabase server key. Set TRIVIA_SUPABASE_SECRET_KEY (preferred) or legacy TRIVIA_SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

function validateServerKey() {
  if (SERVICE_KEY.startsWith("sb_publishable_")) {
    throw new Error("Wrong Supabase key type: a publishable key cannot run backend sync jobs. Create/use an sb_secret_... key.");
  }
  if (SERVICE_KEY.startsWith("sb_secret_")) return "modern-secret";
  if (SERVICE_KEY.startsWith("eyJ")) return "legacy-service-role";
  return "unknown";
}

const SERVER_KEY_TYPE = validateServerKey();
console.log(`Supabase auth mode: ${SERVER_KEY_TYPE}; project: ${new URL(SUPABASE_URL).hostname}`);

function supabaseHeaders(extra = {}) {
  const headers = { apikey: SERVICE_KEY, ...extra };
  if (!SERVICE_KEY.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${SERVICE_KEY}`;
  }
  return headers;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = v => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const safeHttp = value => {
  try {
    const u = new URL(String(value || ""));
    if (!["http:", "https:"].includes(u.protocol)) return null;
    if (u.protocol === "http:") u.protocol = "https:";
    return u.href;
  } catch { return null; }
};
const extValue = (meta, key) => clean(meta?.[key]?.value || "");
const tokenSet = text => new Set(clean(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter(x => x.length > 2));
function overlapScore(query, title) {
  const q = tokenSet(query), t = tokenSet(title);
  if (!q.size || !t.size) return 0;
  let hit = 0;
  for (const token of q) if (t.has(token)) hit++;
  return Math.round((hit / q.size) * 24);
}
function aspectBonus(width, height) {
  width = Number(width); height = Number(height);
  if (!width || !height) return 0;
  const ratio = width / height;
  if (ratio >= 1.15 && ratio <= 2.15) return 8;
  if (ratio >= .8 && ratio <= 2.5) return 4;
  return 0;
}
function sizeBonus(width, height) {
  const edge = Math.max(Number(width) || 0, Number(height) || 0);
  return edge >= 1600 ? 8 : edge >= 900 ? 5 : edge >= 600 ? 2 : 0;
}
function licenseSlug(value) { return clean(value).toLowerCase().replace(/^cc\s*/i, "").replace(/\s+/g, "-"); }
function openverseAutoEligible(value) {
  const s = licenseSlug(value);
  return ["cc0", "pdm", "public-domain", "by", "by-sa"].includes(s);
}

async function fetchJson(url, options = {}, attempts = 3) {
  let last;
  for (let i=0;i<attempts;i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      const r = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {"User-Agent": USER_AGENT, Accept:"application/json", ...(options.headers || {})}
      });
      clearTimeout(timer);
      if (r.ok) return await r.json();
      const text = await r.text().catch(()=>"");
      last = new Error(`${r.status} ${text.slice(0,180)}`);
      if (![429,500,502,503,504].includes(r.status)) throw last;
    } catch (e) { last=e; }
    await sleep(700 * (i+1));
  }
  throw last || new Error("Request failed");
}

async function rest(path, {method="GET", body, prefer, headers={}}={}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: supabaseHeaders({
      "Content-Type":"application/json", ...(prefer?{Prefer:prefer}:{}), ...headers
    }),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${path}: ${r.status} ${text.slice(0,300)}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function loadQuestions() {
  const p = new URLSearchParams({
    select:"id,prompt,category,image_url,image_alt,image_source_url,image_attribution,image_license,image_license_url,source_type,source_entity_id,media_query,media_provider,media_review_status,media_locked,media_last_resolved_at",
    is_active:"eq.true",
    media_locked:"eq.false",
    order:"media_last_resolved_at.asc.nullsfirst,created_at.asc",
    limit:String(LIMIT)
  });
  return await rest(`questions?${p}`) || [];
}

async function wikidataLabels(ids) {
  const result = new Map();
  const unique=[...new Set(ids.filter(x=>/^Q\d+$/.test(String(x||""))))];
  for(let i=0;i<unique.length;i+=45){
    const batch=unique.slice(i,i+45);
    const p=new URLSearchParams({action:"wbgetentities",format:"json",ids:batch.join("|"),props:"labels",languages:"en"});
    try {
      const body=await fetchJson(`${WIKIDATA_API}?${p}`);
      for(const id of batch){
        const label=body.entities?.[id]?.labels?.en?.value;
        if(label) result.set(id,clean(label));
      }
    } catch(e){ console.warn(`Wikidata label batch failed: ${e.message}`); }
  }
  return result;
}

function heuristicQuery(q) {
  if (q.media_query) return clean(q.media_query);
  if (q.image_alt) return clean(q.image_alt);
  let s=clean(q.prompt)
    .replace(/^(approximately|about|roughly)\s+/i,"")
    .replace(/^(in what year (was|did)|how many|how much|how tall is|what year was)\s+/i,"")
    .replace(/[?]+$/g,"")
    .replace(/\b(first released|born|founded or established|above sea level|take to rotate once on its axis)\b.*$/i,"")
    .trim();
  if (s.length > 90) s = s.slice(0,90);
  return s || clean(q.prompt).slice(0,90);
}

async function searchWikipediaLeadCommons(query) {
  // Wikipedia is used for subject matching only. We auto-publish a lead image
  // only when that file also exists on Wikimedia Commons, where reusable
  // license metadata can be verified. Local/non-free Wikipedia images are skipped.
  const wp=new URLSearchParams({
    action:"query",format:"json",formatversion:"2",generator:"search",
    gsrsearch:query,gsrnamespace:"0",gsrlimit:"3",prop:"pageimages",
    piprop:"name|thumbnail",pithumbsize:"1200"
  });
  const search=await fetchJson(`${WIKIPEDIA_API}?${wp}`);
  const leads=(search.query?.pages||[]).filter(p=>p.pageimage).map(p=>({article:p.title,file:`File:${p.pageimage}`}));
  if(!leads.length) return [];

  const cp=new URLSearchParams({
    action:"query",format:"json",formatversion:"2",prop:"imageinfo",
    iiprop:"url|extmetadata",iiurlwidth:"1200",
    iiextmetadatafilter:"Artist|Credit|LicenseShortName|LicenseUrl|ImageDescription|ObjectName",
    titles:leads.map(x=>x.file).join("|")
  });
  const body=await fetchJson(`${COMMONS_API}?${cp}`);
  const articleByFile=new Map(leads.map(x=>[x.file.replace(/_/g," "),x.article]));
  const out=[];
  for(const page of body.query?.pages||[]){
    const info=page.imageinfo?.[0]; if(!info) continue; // not on Commons => skip
    const m=info.extmetadata||{};
    const image=safeHttp(info.url),thumb=safeHttp(info.thumburl||info.url),source=safeHttp(info.descriptionurl);
    if(!image||!thumb||!source) continue;
    const article=articleByFile.get(String(page.title||"").replace(/_/g," ")) || query;
    const title=clean(extValue(m,"ObjectName")||page.title?.replace(/^File:/,"")||article);
    const creator=extValue(m,"Artist")||extValue(m,"Credit")||"Wikimedia Commons contributor";
    const license=extValue(m,"LicenseShortName")||"Wikimedia Commons license";
    const width=Number(info.thumbwidth||info.width||0)||null,height=Number(info.thumbheight||info.height||0)||null;
    out.push({provider:"wikipedia",provider_key:String(page.pageid||page.title),title,image_url:image,thumbnail_url:thumb,source_url:source,
      creator,creator_url:null,license,license_url:safeHttp(m?.LicenseUrl?.value),width,height,
      score:132+overlapScore(query,article)+aspectBonus(width,height)+sizeBonus(width,height),auto_eligible:true,is_available:true,status:"candidate",
      metadata:{wikipedia_article:article,wikipedia_url:`https://en.wikipedia.org/wiki/${encodeURIComponent(article.replace(/ /g,"_"))}`,commons_title:page.title}}
    );
  }
  return out;
}

async function searchCommons(query) {
  const p=new URLSearchParams({
    action:"query",format:"json",formatversion:"2",generator:"search",
    gsrsearch:query,gsrnamespace:"6",gsrlimit:String(PER_SOURCE),
    prop:"imageinfo",iiprop:"url|extmetadata",iiurlwidth:"1200",
    iiextmetadatafilter:"Artist|Credit|LicenseShortName|LicenseUrl|ImageDescription|ObjectName"
  });
  const body=await fetchJson(`${COMMONS_API}?${p}`);
  const out=[];
  for(const page of body.query?.pages || []){
    const info=page.imageinfo?.[0]; if(!info) continue;
    const m=info.extmetadata||{};
    const image=safeHttp(info.url), thumb=safeHttp(info.thumburl || info.url), source=safeHttp(info.descriptionurl);
    if(!image || !thumb || !source) continue;
    const license=extValue(m,"LicenseShortName") || "Wikimedia Commons license";
    const title=clean(extValue(m,"ObjectName") || page.title?.replace(/^File:/,"") || query);
    const creator=extValue(m,"Artist") || extValue(m,"Credit") || "Wikimedia Commons contributor";
    const width=Number(info.thumbwidth || info.width || 0)||null, height=Number(info.thumbheight || info.height || 0)||null;
    const score=112 + overlapScore(query,title) + aspectBonus(width,height) + sizeBonus(width,height);
    out.push({
      provider:"wikimedia",provider_key:String(page.pageid || page.title),title,
      image_url:image,thumbnail_url:thumb,source_url:source,creator,creator_url:null,
      license,license_url:safeHttp(m?.LicenseUrl?.value),width,height,score,
      auto_eligible:true,is_available:true,status:"candidate",
      metadata:{description:extValue(m,"ImageDescription"),commons_title:page.title}
    });
  }
  return out;
}

async function searchOpenverse(query) {
  const p=new URLSearchParams({q:query,page_size:String(PER_SOURCE)});
  const body=await fetchJson(`${OPENVERSE_API}?${p}`);
  const out=[];
  for(const item of body.results || []){
    if(item.is_sensitive || item.sensitivity?.length) continue;
    const image=safeHttp(item.url), thumb=safeHttp(item.thumbnail || item.url), source=safeHttp(item.foreign_landing_url || item.detail_url);
    if(!image || !thumb || !source) continue;
    const license=clean([item.license, item.license_version].filter(Boolean).join(" "));
    const eligible=openverseAutoEligible(item.license);
    const width=Number(item.width||0)||null,height=Number(item.height||0)||null;
    let score=88 + overlapScore(query,item.title || "") + aspectBonus(width,height) + sizeBonus(width,height);
    if(eligible) score += 10; else score -= 35;
    if(item.watermarked) score -= 50;
    out.push({
      provider:"openverse",provider_key:String(item.id || item.foreign_identifier || item.url),title:clean(item.title || query),
      image_url:image,thumbnail_url:thumb,source_url:source,creator:clean(item.creator || "Unknown creator"),creator_url:safeHttp(item.creator_url),
      license:license || null,license_url:safeHttp(item.license_url || item.meta_data?.license_url),width,height,score,
      auto_eligible:eligible,is_available:true,status:"candidate",
      metadata:{source:item.source,provider:item.provider,openverse_id:item.id,watermarked:!!item.watermarked}
    });
  }
  return out;
}

function legacyCandidate(q, query) {
  const image=safeHttp(q.image_url), source=safeHttp(q.image_source_url);
  if(!image) return null;
  const provider = q.media_provider || (source?.includes("commons.wikimedia.org") ? "wikimedia" : "legacy");
  const commons = provider === "wikimedia" || source?.includes("commons.wikimedia.org");
  return {
    provider,provider_key:`current:${q.id}`,title:clean(q.image_alt || query || q.prompt),
    image_url:image,thumbnail_url:image,source_url:source,creator:clean(q.image_attribution || "") || null,creator_url:null,
    license:clean(q.image_license || "") || null,license_url:safeHttp(q.image_license_url),width:null,height:null,
    score:commons?145:100,auto_eligible:commons || openverseAutoEligible(q.image_license),is_available:true,status:"candidate",metadata:{legacy:true}
  };
}

async function probe(candidate) {
  const url=candidate.thumbnail_url || candidate.image_url;
  if(!url) return false;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const r=await fetch(url,{method:"GET",signal:controller.signal,headers:{"User-Agent":USER_AGENT,Accept:"image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",Range:"bytes=0-65535"},redirect:"follow"});
    const type=(r.headers.get("content-type")||"").toLowerCase();
    const ok=r.ok && (type.startsWith("image/") || /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(new URL(r.url).pathname));
    try { await r.body?.cancel(); } catch {}
    return ok;
  }catch{return false;}finally{clearTimeout(timer);}
}

async function rejectedCandidateKeys(questionId) {
  const p=new URLSearchParams({select:"provider,provider_key",question_id:`eq.${questionId}`,status:"eq.rejected"});
  const rows=await rest(`question_media_candidates?${p}`) || [];
  return new Set(rows.map(r=>`${r.provider}:${r.provider_key}`));
}

async function upsertCandidates(questionId, candidates) {
  if(!candidates.length) return [];
  const rows=candidates.map(c=>({question_id:questionId,...c,updated_at:new Date().toISOString(),last_checked_at:new Date().toISOString()}));
  const p=new URLSearchParams({on_conflict:"question_id,provider,provider_key",select:"id,question_id,provider,provider_key,title,image_url,thumbnail_url,source_url,creator,creator_url,license,license_url,width,height,score,auto_eligible,is_available,status,metadata"});
  return await rest(`question_media_candidates?${p}`,{method:"POST",body:rows,prefer:"resolution=merge-duplicates,return=representation"}) || [];
}

async function markCandidateStatuses(questionId, chosenId) {
  const filter=new URLSearchParams({question_id:`eq.${questionId}`,status:"neq.rejected"});
  await rest(`question_media_candidates?${filter}`,{method:"PATCH",body:{status:"candidate",updated_at:new Date().toISOString()},prefer:"return=minimal"});
  if(chosenId){
    const p=new URLSearchParams({id:`eq.${chosenId}`});
    await rest(`question_media_candidates?${p}`,{method:"PATCH",body:{status:"auto_selected",updated_at:new Date().toISOString()},prefer:"return=minimal"});
  }
}

async function updateQuestion(q, query, chosen) {
  const p=new URLSearchParams({id:`eq.${q.id}`});
  const now=new Date().toISOString();
  const body={media_query:query,media_last_resolved_at:now};
  if(chosen){
    body.image_url=chosen.thumbnail_url || chosen.image_url;
    body.image_alt=chosen.title || query || q.prompt;
    body.image_source_url=chosen.source_url;
    body.image_attribution=chosen.creator;
    body.image_license=chosen.license;
    body.image_license_url=chosen.license_url;
    body.media_provider=chosen.provider;
    body.media_candidate_id=chosen.id;
    body.media_review_status="auto";
    body.media_updated_at=now;
  }
  await rest(`questions?${p}`,{method:"PATCH",body,prefer:"return=minimal"});
}

const questions=await loadQuestions();
console.log(`Media Resolver V2: ${questions.length} unlocked questions in this run.`);
if(!questions.length) process.exit(0);

const labels=await wikidataLabels(questions.map(q=>q.source_entity_id));
let resolved=0, missing=0, candidateCount=0;

for(const [index,q] of questions.entries()){
  const query=clean(q.media_query || labels.get(q.source_entity_id) || heuristicQuery(q));
  console.log(`[${index+1}/${questions.length}] ${query || q.prompt.slice(0,60)}`);
  const candidates=[];
  const legacy=legacyCandidate(q,query); if(legacy) candidates.push(legacy);
  try { candidates.push(...await searchWikipediaLeadCommons(query)); } catch(e){ console.warn(`  Wikipedia lead: ${e.message}`); }
  await sleep(120);
  try { candidates.push(...await searchCommons(query)); } catch(e){ console.warn(`  Commons: ${e.message}`); }
  await sleep(180);
  try { candidates.push(...await searchOpenverse(query)); } catch(e){ console.warn(`  Openverse: ${e.message}`); }

  const dedup=new Map();
  for(const c of candidates){
    const key=`${c.provider}:${c.provider_key}`;
    if(!dedup.has(key) || Number(c.score)>Number(dedup.get(key).score)) dedup.set(key,c);
  }
  const rejected=await rejectedCandidateKeys(q.id).catch(()=>new Set());
  const compact=[...dedup.values()]
    .filter(c=>!rejected.has(`${c.provider}:${c.provider_key}`))
    .sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,14);

  // Verify the most promising candidates first. Unverified/failed media remains in
  // the candidate table as unavailable evidence, but is never auto-published.
  for(const c of compact.slice(0,8)){
    c.is_available=await probe(c);
    if(!c.is_available) c.score=Number(c.score)-120;
  }
  for(const c of compact.slice(8)) c.is_available=false;

  let stored=[];
  try { stored=await upsertCandidates(q.id,compact); }
  catch(e){ console.warn(`  Candidate upsert failed: ${e.message}`); }
  candidateCount += stored.length;

  const chosen=stored
    .filter(c=>c.auto_eligible && c.is_available && c.status!=="rejected")
    .sort((a,b)=>Number(b.score)-Number(a.score))[0] || null;

  try{
    await markCandidateStatuses(q.id,chosen?.id || null);
    await updateQuestion(q,query,chosen);
    if(chosen){ resolved++; console.log(`  ✓ ${chosen.provider} · ${chosen.title || "image"}`); }
    else { missing++; console.log("  – no auto-eligible working image found"); }
  }catch(e){ console.warn(`  Selection update failed: ${e.message}`); }

  await sleep(260);
}

console.log(`\nDone. Auto-resolved ${resolved}; unresolved ${missing}; candidate rows processed ${candidateCount}.`);
