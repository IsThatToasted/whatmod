#!/usr/bin/env node
/*
  WhatMod Trivia V6 - open-knowledge question hydrator

  Required GitHub/runner environment variables:
    TRIVIA_SUPABASE_URL
    TRIVIA_SUPABASE_SERVICE_ROLE_KEY   (server-side secret only; NEVER config.js)

  Optional:
    QUESTION_SYNC_OFFSET=auto
    QUESTION_SYNC_PER_TEMPLATE=80

  The script intentionally imports a modest cache from a much larger public
  knowledge source. Re-running with different offsets expands the bank without
  trying to mirror Wikidata into Supabase.
*/

const SUPABASE_URL = String(process.env.TRIVIA_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = String(process.env.TRIVIA_SUPABASE_SERVICE_ROLE_KEY || "");
const PER_TEMPLATE = Math.max(5, Math.min(250, Number(process.env.QUESTION_SYNC_PER_TEMPLATE || 80) || 80));
const OFFSET_RAW = String(process.env.QUESTION_SYNC_OFFSET || "auto").trim().toLowerCase();
const AUTO_WINDOW = 10000;
const AUTO_OFFSET = (Math.floor(Date.now() / (7*86400000)) * PER_TEMPLATE) % AUTO_WINDOW;
const OFFSET = OFFSET_RAW === "auto" ? AUTO_OFFSET : Math.max(0, Number(OFFSET_RAW) || 0);
const WDQS = "https://query.wikidata.org/sparql";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = "WhatModTriviaQuestionSync/1.0 (https://whatmod.com/trivia/)";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing TRIVIA_SUPABASE_URL or TRIVIA_SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}

const templates = [
  {
    id: "film-release-year", category: "Entertainment", difficulty: "medium", unit: "year",
    query: ({limit, offset}) => `
SELECT ?item ?itemLabel (MIN(?date) AS ?value) (SAMPLE(?image) AS ?image) WHERE {
  ?item wdt:P31 wd:Q11424; wdt:P577 ?date; wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks >= 8)
  OPTIONAL { ?item wdt:P18 ?image. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?item ?itemLabel
ORDER BY ?item
LIMIT ${limit} OFFSET ${offset}`,
    parse: row => yearValue(row.value?.value),
    prompt: label => `In what year was the film “${label}” first released?`,
    explanation: (label, value) => `The earliest release date recorded for “${label}” corresponds to ${value}.`
  },
  {
    id: "video-game-release-year", category: "Technology", difficulty: "medium", unit: "year",
    query: ({limit, offset}) => `
SELECT ?item ?itemLabel (MIN(?date) AS ?value) (SAMPLE(?image) AS ?image) WHERE {
  ?item wdt:P31 wd:Q7889; wdt:P577 ?date; wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks >= 5)
  OPTIONAL { ?item wdt:P18 ?image. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?item ?itemLabel
ORDER BY ?item
LIMIT ${limit} OFFSET ${offset}`,
    parse: row => yearValue(row.value?.value),
    prompt: label => `In what year was the video game “${label}” first released?`,
    explanation: (label, value) => `The earliest release date recorded for “${label}” corresponds to ${value}.`
  },
  {
    id: "person-birth-year", category: "History", difficulty: "hard", unit: "year",
    query: ({limit, offset}) => `
SELECT ?item ?itemLabel (MIN(?date) AS ?value) (SAMPLE(?image) AS ?image) WHERE {
  ?item wdt:P31 wd:Q5; wdt:P569 ?date; wikibase:sitelinks ?sitelinks.
  FILTER(?sitelinks >= 25)
  OPTIONAL { ?item wdt:P18 ?image. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?item ?itemLabel
ORDER BY ?item
LIMIT ${limit} OFFSET ${offset}`,
    parse: row => yearValue(row.value?.value),
    prompt: label => `In what year was ${label} born?`,
    explanation: (label, value) => `Wikidata records ${label}’s birth year as ${value}.`
  },
  {
    id: "business-inception-year", category: "Business", difficulty: "hard", unit: "year",
    query: ({limit, offset}) => `
SELECT ?item ?itemLabel (MIN(?date) AS ?value) (SAMPLE(?image) AS ?image) WHERE {
  ?item wdt:P571 ?date; wikibase:sitelinks ?sitelinks.
  ?item wdt:P31 ?type.
  VALUES ?type { wd:Q4830453 wd:Q783794 wd:Q43229 }
  FILTER(?sitelinks >= 8)
  OPTIONAL { ?item wdt:P18 ?image. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?item ?itemLabel
ORDER BY ?item
LIMIT ${limit} OFFSET ${offset}`,
    parse: row => yearValue(row.value?.value),
    prompt: label => `In what year was ${label} founded or established?`,
    explanation: (label, value) => `Wikidata records ${label}’s inception year as ${value}.`
  },
  {
    id: "mountain-elevation", category: "Geography", difficulty: "medium", unit: "m",
    query: ({limit, offset}) => `
SELECT ?item ?itemLabel (SAMPLE(?amount) AS ?value) (SAMPLE(?image) AS ?image) WHERE {
  ?item wdt:P31 wd:Q8502; p:P2044 ?statement; wikibase:sitelinks ?sitelinks.
  ?statement psv:P2044 ?valueNode.
  ?valueNode wikibase:quantityAmount ?amount; wikibase:quantityUnit wd:Q11573.
  FILTER(?sitelinks >= 4)
  OPTIONAL { ?item wdt:P18 ?image. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?item ?itemLabel
ORDER BY ?item
LIMIT ${limit} OFFSET ${offset}`,
    parse: row => numericValue(row.value?.value, -500, 10000),
    prompt: label => `Approximately how many meters above sea level is ${label}?`,
    explanation: (label, value) => `Wikidata records an elevation of about ${formatNumber(value)} meters for ${label}.`
  },
  {
    id: "building-height", category: "Geography", difficulty: "hard", unit: "m",
    query: ({limit, offset}) => `
SELECT ?item ?itemLabel (SAMPLE(?amount) AS ?value) (SAMPLE(?image) AS ?image) WHERE {
  ?item wdt:P31 wd:Q41176; p:P2048 ?statement; wikibase:sitelinks ?sitelinks.
  ?statement psv:P2048 ?valueNode.
  ?valueNode wikibase:quantityAmount ?amount; wikibase:quantityUnit wd:Q11573.
  FILTER(?sitelinks >= 5)
  OPTIONAL { ?item wdt:P18 ?image. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?item ?itemLabel
ORDER BY ?item
LIMIT ${limit} OFFSET ${offset}`,
    parse: row => numericValue(row.value?.value, 2, 1200),
    prompt: label => `Approximately how tall is ${label}, in meters?`,
    explanation: (label, value) => `Wikidata records a height of about ${formatNumber(value)} meters for ${label}.`
  }
];

function yearValue(raw) {
  const m = String(raw || "").match(/^([+-]?\d{1,6})-/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) && y >= -5000 && y <= 3000 ? y : null;
}
function numericValue(raw, min=-1e15, max=1e15) {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function formatNumber(v) { return new Intl.NumberFormat("en-US", {maximumFractionDigits:2}).format(v); }
function qidFromUri(uri) { return String(uri || "").match(/\/(Q\d+)$/)?.[1] || null; }
function fileTitleFromSpecialFilePath(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const marker = "/Special:FilePath/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    return `File:${decodeURIComponent(u.pathname.slice(idx + marker.length)).replace(/_/g," ")}`;
  } catch { return null; }
}
function cleanHtml(raw) {
  return String(raw || "").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
}
function extValue(meta, key) { return meta?.[key]?.value ? cleanHtml(meta[key].value) : ""; }

async function wdqs(query) {
  const url = `${WDQS}?format=json&query=${encodeURIComponent(query)}`;
  const r = await fetch(url, {headers:{Accept:"application/sparql-results+json","User-Agent":USER_AGENT}});
  if (!r.ok) throw new Error(`Wikidata query failed: ${r.status} ${await r.text().then(x=>x.slice(0,200))}`);
  return (await r.json()).results?.bindings || [];
}

async function commonsMetadata(titles) {
  const out = new Map();
  const unique = [...new Set(titles.filter(Boolean))];
  for (let i=0;i<unique.length;i+=20) {
    const batch = unique.slice(i,i+20);
    const p = new URLSearchParams({
      action:"query",format:"json",formatversion:"2",prop:"imageinfo",
      iiprop:"url|extmetadata",iiurlwidth:"1200",
      iiextmetadatafilter:"Artist|Credit|LicenseShortName|LicenseUrl",
      titles:batch.join("|")
    });
    const r = await fetch(`${COMMONS_API}?${p}`, {headers:{"User-Agent":USER_AGENT}});
    if (!r.ok) { console.warn(`Commons metadata batch failed: ${r.status}`); continue; }
    const body = await r.json();
    for (const page of body.query?.pages || []) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const m = info.extmetadata || {};
      const normalizeHttps = value => {
        if (!value) return null;
        try { const u=new URL(value); if(u.protocol==="http:") u.protocol="https:"; return u.href; } catch { return value; }
      };
      out.set(page.title, {
        image_url: normalizeHttps(info.thumburl || info.url || null),
        image_source_url: normalizeHttps(info.descriptionurl || null),
        image_attribution: extValue(m,"Artist") || extValue(m,"Credit") || "Wikimedia Commons contributor",
        image_license: extValue(m,"LicenseShortName") || null,
        image_license_url: m?.LicenseUrl?.value || null
      });
    }
    await new Promise(r=>setTimeout(r,180));
  }
  return out;
}

async function upsertQuestions(rows) {
  if (!rows.length) return;

  // Preserve media decisions already made by Media Resolver/Admin. Question sync
  // owns factual question data, but must never overwrite an approved/locked image.
  const keys=rows.map(r=>r.canonical_key).filter(Boolean);
  const existing=new Map();
  if(keys.length){
    const encoded=keys.map(k=>`"${String(k).replace(/"/g,'\\"')}"`).join(",");
    const url=`${SUPABASE_URL}/rest/v1/questions?select=canonical_key,image_url,media_locked,media_review_status&canonical_key=in.(${encodeURIComponent(encoded)})`;
    const er=await fetch(url,{headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`}});
    if(er.ok){ for(const row of await er.json()) existing.set(row.canonical_key,row); }
  }

  const payload=rows.map(row=>{
    const copy={...row};
    const prev=existing.get(row.canonical_key);
    if(prev){
      // Existing image selection is now owned by the resolver/admin pipeline.
      for(const key of ["image_url","image_alt","image_source_url","image_attribution","image_license","image_license_url","media_provider","media_review_status","media_locked"]){
        delete copy[key];
      }
    }
    return copy;
  });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/questions?on_conflict=canonical_key`, {
    method:"POST",
    headers:{
      apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,
      "Content-Type":"application/json",
      Prefer:"resolution=merge-duplicates,return=minimal"
    },
    body:JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Supabase upsert failed: ${r.status} ${await r.text()}`);
}

async function prunePractice() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/prune_ephemeral_practice`, {
    method:"POST",
    headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,"Content-Type":"application/json"},
    body:JSON.stringify({p_days:30})
  });
  if (!r.ok) { console.warn(`Practice prune skipped: ${r.status} ${await r.text().then(x=>x.slice(0,160))}`); return; }
  console.log(`Pruned completed ephemeral practice rows: ${await r.text()}`);
}

let imported = 0;
for (const template of templates) {
  try {
    console.log(`\n[${template.id}] offset=${OFFSET} limit=${PER_TEMPLATE}`);
    const bindings = await wdqs(template.query({limit:PER_TEMPLATE,offset:OFFSET}));
    const prelim = [];
    for (const row of bindings) {
      const qid = qidFromUri(row.item?.value);
      const label = String(row.itemLabel?.value || "").trim();
      const answer = template.parse(row);
      if (!qid || !label || answer === null || answer === undefined) continue;
      const fileTitle = fileTitleFromSpecialFilePath(row.image?.value);
      prelim.push({qid,label,answer,fileTitle});
    }
    const media = await commonsMetadata(prelim.map(x=>x.fileTitle));
    const questions = prelim.map(x=>{
      const img = media.get(x.fileTitle) || {};
      return {
        category:template.category,difficulty:template.difficulty,question_type:"numeric",
        prompt:template.prompt(x.label),context:null,unit:template.unit,options:null,
        answer_numeric:x.answer,answer_text:null,correct_option:null,
        explanation:template.explanation(x.label,x.answer),
        source_url:`https://www.wikidata.org/wiki/${x.qid}`,
        is_active:true,
        image_url:img.image_url || null,image_alt:x.fileTitle ? x.label : null,
        image_source_url:img.image_source_url || null,image_attribution:img.image_attribution || null,
        image_license:img.image_license || null,image_license_url:img.image_license_url || null,
        media_query:x.label,media_provider:img.image_url ? "wikimedia" : null,
        source_type:"wikidata",source_entity_id:x.qid,canonical_key:`wikidata:${template.id}:${x.qid}`
      };
    });
    await upsertQuestions(questions);
    imported += questions.length;
    console.log(`Upserted ${questions.length} questions.`);
    await new Promise(r=>setTimeout(r,500));
  } catch (e) {
    console.warn(`[${template.id}] skipped: ${e.message}`);
  }
}

await prunePractice();
console.log(`\nDone. ${imported} question rows processed across ${templates.length} templates.`);
