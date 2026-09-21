import { state, setState, subscribe, levelFromXp, xpToNextLevel, cleanupRealtime } from "./store.js";
import {
  initSupabase, isConfigured, signInGoogle, signOut, loadProfile, loadLeaderboard, updateProfile,
  createLobby, joinLobby, getLobby, getLobbyPlayers, startLobby, getCurrentQuestion,
  submitGameAnswer, revealRound, nextRound, getRoundResults, syncGameClock, getDailyState, submitDailyAnswer,
  startPractice, getPracticeQuestion, submitPracticeAnswer, nextPracticeQuestion, getPracticeSummary,
  getQuestionCommunityStats, getLibrarySessions, startLibraryPractice, subscribeLobby, updateUiTheme,
  getQuestionVoteSummary, voteQuestion, adminDeleteQuestion, matchmake, returnToLobby, touchTriviaPresence, getAvailableCategories, getMatchmakingOptions,
  createBoardLobby, startBoardGame, getBoardState, selectBoardCell, buzzBoard, submitBoardWager, submitBoardAnswer, closeBoardClue,
  submitBoardFinalWager, submitBoardFinalAnswer, syncBoardClock, resetBoardLobby
} from "./supabase.js";
import { numericScore, xpForScore, formatAnswer } from "./scoring.js";
import { renderGuessHistogram, renderClosenessScale, renderCommunityHistogram, closenessText } from "./charts.js";
import { initTwitch, connectTwitch, disconnectTwitch, announceLobby, listenToTwitchChat } from "./twitch.js";
import { getExperiencePrefs, setExperiencePrefs, applyExperiencePrefs, playSfx, bindGameFeel, enhanceV2, celebrate } from "./experience.js";

const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const uid = () => Math.random().toString(36).slice(2);
const presenceClientId = sessionStorage.getItem("trivia_presence_client") || crypto.randomUUID();
sessionStorage.setItem("trivia_presence_client", presenceClientId);
let presenceHeartbeatTimer = null;
const firstName = value => String(value || "Player").trim().split(/\s+/)[0] || "Player";
const initials = value => String(value || "?").trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||"").join("") || "?";
const BASE_CATEGORIES=["Brainrot","General Gaming Knowledge","Internet Culture","Pop Culture","Movies & TV","Music","Food & Brands","General Knowledge","Science","Technology","History","Geography","Animals","Space","Sports","Entertainment","Business"];
const categoryGlyph = value => ({Brainrot:"🌀","General Gaming Knowledge":"🎮","Internet Culture":"@","Pop Culture":"✹","Movies & TV":"▣",Music:"♫","Food & Brands":"◆","General Knowledge":"◇",Science:"⚗",Technology:"⌁",History:"⌛",Geography:"⌖",Animals:"◌",Space:"✦",Sports:"◆",Entertainment:"★",Business:"▰",Any:"✦"}[value] || "✦");
function availableCategories(){const live=(state.categories||[]).map(x=>typeof x==="string"?x:x.category).filter(Boolean);return [...new Set([...BASE_CATEGORIES,...live])];}
function categoryCount(name){const row=(state.categories||[]).find(x=>typeof x!=="string"&&x.category===name);return row?Number(row.question_count||0):null;}
function categoryOption(name){const count=categoryCount(name),known=(state.categories||[]).length>0,disabled=known&&(count===null||count<=0);return `<option value="${esc(name)}" ${disabled?"disabled":""}>${categoryGlyph(name)} ${esc(name)}${count!==null?` · ${count.toLocaleString()}${count<=0?" · unavailable":""}`:disabled?" · no active questions":""}</option>`;}
const safeUrl = value => {
  try {
    const u = new URL(String(value || ""), location.origin);
    if (!["http:","https:"].includes(u.protocol)) return "";
    // The app itself is HTTPS in production; upgrade old cached HTTP media URLs
    // so browsers do not reject them as mixed content.
    if (u.protocol === "http:") u.protocol = "https:";
    return u.href;
  } catch { return ""; }
};
function commonsRedirectFromSource(value, width=1200) {
  const source=safeUrl(value);
  if (!source) return "";
  try {
    const u=new URL(source);
    if (!/(^|\.)commons\.wikimedia\.org$/i.test(u.hostname)) return "";
    const decoded=decodeURIComponent(u.pathname);
    const marker="/wiki/File:";
    const i=decoded.indexOf(marker);
    if(i<0) return "";
    const filename=decoded.slice(i+marker.length).trim();
    if(!filename) return "";
    return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}?width=${Math.max(320,Math.min(1600,Number(width)||1200))}`;
  } catch { return ""; }
}
function mediaImageTag({src,source,alt="Question image",lazy=false,cls=""}={}) {
  const primary=safeUrl(src);
  const fallback=commonsRedirectFromSource(source);
  const first=primary || fallback;
  if(!first) return "";
  const fallbackAttr=fallback && fallback!==first ? ` data-fallback-src="${esc(fallback)}"` : "";
  return `<img class="${esc(cls)}" src="${esc(first)}"${fallbackAttr} data-media-image="1" alt="${esc(alt)}" loading="${lazy?"lazy":"eager"}" decoding="async" referrerpolicy="no-referrer">`;
}
function questionMedia(q, compact=false) {
  const source=safeUrl(q?.image_source_url), license=safeUrl(q?.image_license_url);
  const image=mediaImageTag({src:q?.image_url,source:q?.image_source_url,alt:q?.image_alt || q?.prompt || "Question image"});
  if(!image) return "";
  const credit=[q?.image_attribution,q?.image_license].filter(Boolean).join(" · ");
  return `<figure class="question-media ${compact?"compact":""}"><div class="question-media-frame">${image}<div class="media-fallback-card" hidden><span>▧</span><b>Image unavailable</b>${source?`<a href="${esc(source)}" target="_blank" rel="noopener">Open source image</a>`:""}</div></div><figcaption>${credit?`<span>${esc(credit)}</span>`:""}${source?`<a href="${esc(source)}" target="_blank" rel="noopener">Source</a>`:""}${license?`<a href="${esc(license)}" target="_blank" rel="noopener">License</a>`:""}</figcaption></figure>`;
}

function questionTitleFrame(q,{tag="h1",className=""}={}) {
  const safeTag=tag==="h2"?"h2":"h1";
  if(currentUiTheme()==="v2") return `<div class="question-title-frame nova-question-frame"><div class="question-title-copy"><span class="nova-question-label">QUESTION // LIVE DATA</span><${safeTag}${className?` class="${esc(className)}"`:""}>${esc(q?.prompt||"")}</${safeTag}></div>${questionMedia(q,true)}</div>`;
  return `<div class="question-title-frame"><div class="question-title-copy"><${safeTag}${className?` class="${esc(className)}"`:""}>${esc(q?.prompt||"")}</${safeTag}></div>${questionMedia(q,true)}</div>`;
}
function questionFeedback(q,{allowDelete=false}={}) {
  if(!q?.id || !state.session || !isConfigured()) return state.profile?.is_admin&&allowDelete&&q?.id?`<div class="question-admin-inline"><button class="admin-question-delete" data-action="admin-delete-question" data-question-id="${esc(q.id)}">✕ Delete bad question</button></div>`:"";
  return `<div class="question-community-tools" data-question-feedback="${esc(q.id)}">
    <span class="question-feedback-label">Rate this question</span>
    <button class="question-vote" data-question-vote="1" data-question-id="${esc(q.id)}" aria-label="Thumbs up">👍 <b data-vote-up>—</b></button>
    <button class="question-vote" data-question-vote="-1" data-question-id="${esc(q.id)}" aria-label="Thumbs down">👎 <b data-vote-down>—</b></button>
    ${state.profile?.is_admin&&allowDelete?`<span class="question-tools-divider"></span><button class="admin-question-delete" data-action="admin-delete-question" data-question-id="${esc(q.id)}">✕ Delete question</button>`:""}
  </div>`;
}
function wireMediaFallbacks() {
  $$('img[data-media-image="1"]').forEach(img=>{
    if(img.dataset.mediaBound==="1") return;
    img.dataset.mediaBound="1";
    const recover=()=>{
      const fallback=safeUrl(img.dataset.fallbackSrc);
      if(fallback && img.dataset.fallbackTried!=="1" && img.src!==fallback){
        img.dataset.fallbackTried="1";
        img.src=fallback;
        return;
      }
      const shell=img.closest(".question-media-frame,.library-cover");
      if (!shell || shell.dataset.mediaFailed === "1") {
        img.remove();
        return;
      }
      shell.dataset.mediaFailed = "1";
      shell.classList.add("media-failed");
      const card=shell.querySelector(".media-fallback-card");
      // Remove the failed element entirely. Safari can keep painting the
      // native broken-image glyph when author CSS overrides [hidden].
      img.remove();
      if(card) card.hidden=false;
    };
    img.addEventListener("error",recover);
    // Cached failures can complete before listeners are attached after a render.
    if(img.complete && img.naturalWidth===0) queueMicrotask(recover);
  });
}

let answerStartedAt = 0;
let refreshTimer = null;
let lobbySyncTimer = null;
let lobbyRealtimeStatus = "CONNECTING";
let lobbyLastSyncAt = 0;
let lobbyRefreshBusy = false;
let lobbyRefreshQueued = false;
let phaseRaf = null;
let phaseTimeout = null;
let phaseAutoKey = null;
let demo = null;
const inFlight = new Set();

const UI_THEME_KEY = "whatmod_trivia_ui_theme";
function normalizeUiTheme(value) { return value === "v2" ? "v2" : "v1"; }
function storedUiTheme() {
  try { return normalizeUiTheme(localStorage.getItem(UI_THEME_KEY) || "v2"); } catch { return "v2"; }
}
function currentUiTheme() { return normalizeUiTheme(state.profile?.ui_theme || storedUiTheme()); }
function applyUiTheme(value, persistLocal=true) {
  const theme=normalizeUiTheme(value);
  document.documentElement.dataset.uiTheme=theme;
  document.documentElement.style.colorScheme="dark";
  if(persistLocal){ try { localStorage.setItem(UI_THEME_KEY,theme); } catch {} }
  return theme;
}
async function chooseUiTheme(value) {
  const theme=applyUiTheme(value);
  if(state.profile) state.profile={...state.profile,ui_theme:theme};
  try {
    if(isConfigured() && state.session) await updateUiTheme(theme);
    else if(demo?.profile) demo.profile.ui_theme=theme;
    playSfx("select");
    toast(theme === "v2" ? "V2 Nova Arena enabled" : "V1 Classic enabled");
    await navigate("profile");
  } catch(error) {
    console.error(error);
    toast("Theme changed on this device. Run the V8 theme migration to sync it to your account.");
    await navigate("profile");
  }
}
applyUiTheme(storedUiTheme(), false);

function beginAction(key) {
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}
function endAction(key) { inFlight.delete(key); }

function friendlyErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const raw = String(error?.message || error || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return fallback;
  if (lower.includes("column reference") && lower.includes("ambiguous")) return "The game hit a state conflict. Refresh once and try again.";
  if (lower.includes("jwt") || lower.includes("not authenticated") || lower.includes("sign in required")) return "Your session needs to be refreshed. Sign in again and retry.";
  if (lower.includes("network") || lower.includes("failed to fetch")) return "We couldn't reach the game server. Check your connection and try again.";
  if (lower.includes("practice question was already answered")) return "That practice answer is already locked in. Continue to the next question.";
  if (lower.includes("answer the current practice question first")) return "Lock in your answer before continuing.";
  if (lower.includes("daily quest is already complete") || lower.includes("already played today")) return "Today's Daily Quest is already complete.";
  if (lower.includes("answers are closed") || lower.includes("time expired")) return "That round is already closed.";
  if (raw.length > 180 || /\b(sql|postgres|column|relation|function)\b/i.test(raw)) return fallback;
  return raw;
}
function reportError(error, fallback) {
  console.error(error);
  playSfx("error");
  toast(friendlyErrorMessage(error, fallback), "bad");
}

function lobbySyncDisplay() {
  if (lobbyRealtimeStatus === "SUBSCRIBED") return { text: "LIVE SYNC", cls: "live sync-ok" };
  if (["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(lobbyRealtimeStatus)) return { text: "BACKUP SYNC", cls: "sync-warn" };
  return { text: "CONNECTING", cls: "sync-wait" };
}

function updateLobbySyncBadge() {
  const badge = $("#lobby-sync-status");
  if (!badge) return;
  const info = lobbySyncDisplay();
  badge.className = `mode-badge ${info.cls}`;
  badge.innerHTML = `<i></i> ${info.text}`;
  badge.title = lobbyRealtimeStatus === "SUBSCRIBED"
    ? "Supabase Realtime is connected."
    : "Realtime is reconnecting. The lobby is using automatic backup refreshes.";
}

function stopLobbySync() {
  clearInterval(lobbySyncTimer);
  lobbySyncTimer = null;
  lobbyRealtimeStatus = "CONNECTING";
  lobbyLastSyncAt = 0;
}

function startLobbySyncFallback(code) {
  stopLobbySync();
  lobbyLastSyncAt = Date.now();
  lobbySyncTimer = setInterval(() => {
    if (state.view !== "lobby" || state.lobby?.code !== code) return;
    const healthy = lobbyRealtimeStatus === "SUBSCRIBED";
    const maxAge = healthy ? 12000 : 2200;
    if (Date.now() - lobbyLastSyncAt >= maxAge) refreshLobby(code, 0);
  }, 1100);
}

const SAMPLE = [
  { id:"d1", category:"Science", difficulty:"medium", question_type:"numeric", prompt:"About how many kilometers is the average distance from Earth to the Moon?", unit:"km", answer_numeric:384400, explanation:"The Moon's average orbital distance is about 384,400 km." },
  { id:"d2", category:"Technology", difficulty:"easy", question_type:"numeric", prompt:"In what year was the original iPhone released?", unit:"year", answer_numeric:2007, explanation:"Apple released the first iPhone in 2007." },
  { id:"d3", category:"Geography", difficulty:"medium", question_type:"numeric", prompt:"Roughly how many square kilometers is the area of Pennsylvania?", unit:"km²", answer_numeric:119280, explanation:"Pennsylvania covers about 119,280 km²." },
  { id:"d4", category:"History", difficulty:"easy", question_type:"numeric", prompt:"In what year did the Berlin Wall fall?", unit:"year", answer_numeric:1989, explanation:"The Berlin Wall opened on November 9, 1989." },
  { id:"d5", category:"Animals", difficulty:"medium", question_type:"numeric", prompt:"About how many kilograms can an adult male African elephant weigh?", unit:"kg", answer_numeric:6000, explanation:"Large adult males commonly weigh around 6,000 kg, with exceptional individuals heavier." },
  { id:"d6", category:"Space", difficulty:"hard", question_type:"numeric", prompt:"Approximately how many Earth days does Venus take to rotate once on its axis?", unit:"days", answer_numeric:243, explanation:"Venus rotates extremely slowly: roughly 243 Earth days per sidereal rotation." },
  { id:"d7", category:"Science", difficulty:"easy", question_type:"numeric", prompt:"At sea level, at about what temperature in Celsius does pure water boil?", unit:"°C", answer_numeric:100, explanation:"At standard atmospheric pressure, pure water boils at 100 °C." },
  { id:"d8", category:"Geography", difficulty:"easy", question_type:"numeric", prompt:"About how many kilometers long is the Nile River?", unit:"km", answer_numeric:6650, explanation:"A commonly cited estimate is roughly 6,650 km." },
  { id:"d9", category:"Space", difficulty:"easy", question_type:"numeric", prompt:"Approximately how many minutes does sunlight take to reach Earth?", unit:"minutes", answer_numeric:8.3167, explanation:"Sunlight takes about 8 minutes 20 seconds to reach Earth." },
  { id:"d10", category:"History", difficulty:"medium", question_type:"numeric", prompt:"In what year did Apollo 11 land humans on the Moon?", unit:"year", answer_numeric:1969, explanation:"Apollo 11 landed on the Moon in July 1969." },
  { id:"d11", category:"Science", difficulty:"medium", question_type:"numeric", prompt:"Approximately how fast is the speed of sound in dry air at 20 °C?", unit:"m/s", answer_numeric:343, explanation:"At 20 °C the speed of sound is about 343 m/s." },
  { id:"d12", category:"Technology", difficulty:"medium", question_type:"numeric", prompt:"In what year was the World Wide Web first made publicly available by CERN?", unit:"year", answer_numeric:1991, explanation:"The first web software became publicly available in 1991." }
];

function demoCommunityStats(answer,count=180){
  const hist=new Array(41).fill(0),a=Number(answer);
  for(let i=0;i<count;i++){
    const logErr=(Math.random()+Math.random()+Math.random()-1.5)*0.85;
    const idx=Math.max(0,Math.min(40,Math.round((Math.max(-4,Math.min(4,logErr))+4)/0.2)));
    hist[idx]++;
  }
  return {total_answers:count,histogram:hist,bucket_min:-4,bucket_max:4,bucket_step:.2,first_answered_at:null,last_answered_at:null};
}

function toast(message, tone="") {
  const node = document.createElement("div");
  node.className = `toast ${tone}`; node.textContent = message;
  $("#toast-root").appendChild(node);
  setTimeout(() => node.remove(), 3600);
}


function v2NavIcon(view){
  return ({home:"⌂",library:"▦",leaderboard:"♛",how:"?",profile:"◉"}[view]||"•");
}
function appShellV2(content){
  const p=state.profile, xp=xpToNextLevel(p?.xp||0);
  const avatar=p?.avatar_url||state.session?.user?.user_metadata?.avatar_url||state.session?.user?.user_metadata?.picture||"";
  const name=p?.username||state.session?.user?.user_metadata?.full_name||state.session?.user?.user_metadata?.name||"Player";
  const nav=[["home","PLAY"],["library","ARCHIVE"],["leaderboard","RANKS"],["how","CODEX"]];
  return `
  <div class="nova-space" aria-hidden="true"><div class="nova-nebula n1"></div><div class="nova-nebula n2"></div><div class="nova-stars"></div><div class="nova-scan"></div></div>
  <div class="nova-shell">
    <aside class="nova-rail">
      <button class="nova-logo" data-nav="home" aria-label="Home"><span>?</span><i></i></button>
      <nav class="nova-rail-nav">${nav.map(([v,label])=>`<button data-nav="${v}" class="${state.view===v?"active":""}" title="${label}"><span>${v2NavIcon(v)}</span><small>${label}</small></button>`).join("")}</nav>
      <div class="nova-rail-bottom">
        ${p?`<button class="nova-mini-profile ${state.view==="profile"?"active":""}" data-nav="profile">${avatar?`<img src="${esc(avatar)}" alt="">`:`<b>${esc(initials(name))}</b>`}<i>LV ${xp.level}</i></button>`:`<button class="nova-mini-profile" data-action="login"><b>G</b><i>SIGN IN</i></button>`}
      </div>
    </aside>
    <section class="nova-command">
      <header class="nova-topline">
        <div class="nova-breadcrumb"><span>WHATMOD // TRIVIA</span><b>${String(state.view||"home").replace(/-/g," ").toUpperCase()}</b></div>
        <div class="nova-statusbar">
          <span class="nova-online"><i></i> ONLINE</span>
          ${p?`<span><small>XP</small><b>${Number(p.xp||0).toLocaleString()}</b></span><span><small>STREAK</small><b>${Number(p.daily_streak||0)}</b></span>`:""}
          <button class="nova-sound" data-exp-sound title="Sound effects">${getExperiencePrefs().sfx?"◖":"×"}</button>
        </div>
      </header>
      <main class="page nova-page"><div class="nova-view-enter">${content}</div></main>
    </section>
  </div>
  <nav class="nova-mobile-dock">${[["home","PLAY"],["library","LIBRARY"],["leaderboard","RANKS"],["profile","PLAYER"]].map(([v,l])=>`<button data-nav="${v}" class="${state.view===v?"active":""}"><span>${v2NavIcon(v)}</span><small>${l}</small></button>`).join("")}</nav>`;
}

function homeViewV2(){
  const p=state.profile, lvl=xpToNextLevel(p?.xp||0);
  const displayName=p?.username||state.session?.user?.user_metadata?.full_name||state.session?.user?.user_metadata?.name||"Player";
  return appShellV2(`
    <section class="nova-home">
      <header class="nova-home-head">
        <div><span class="nova-kicker"><i></i> ARENA NETWORK // SEASON 01</span><h1>WELCOME BACK,<br><em>${esc(firstName(displayName).toUpperCase())}</em></h1><p>Estimate the impossible. Read the room. Climb the global ladder.</p></div>
        <div class="nova-player-core v2-tilt">
          <div class="nova-core-ring" style="--progress:${Math.round(lvl.progress*100)}"><span>${lvl.level}</span><i></i><b></b></div>
          <div><small>PLAYER LEVEL</small><strong>${Number(p?.xp||0).toLocaleString()} XP</strong><span>${lvl.needed.toLocaleString()} TO NEXT RANK</span></div>
        </div>
      </header>
      ${guestBanner()}

      <section class="nova-mission-grid">
        <article class="nova-daily-mission v2-tilt">
          <div class="nova-card-grid"></div><span class="nova-live-tag"><i></i> DAILY SIGNAL</span>
          <div class="nova-reactor"><i></i><i></i><i></i><b>∞</b></div>
          <div class="nova-mission-copy"><small>PRIMARY MISSION</small><h2>THE DAILY<br>ESTIMATE</h2><p>One shot. One global question. Precision turns into permanent XP.</p><div class="nova-rewards"><span>+ PRECISION XP</span><span>+ STREAK</span></div><button class="nova-launch primary" data-action="daily"><span>DEPLOY</span><b>→</b></button></div>
        </article>
        <aside class="nova-side-stack">
          <article class="nova-mode-card v2-tilt practice compact-mode" data-nav="practice-setup"><span class="nova-mode-icon">◎</span><div><small>TRAINING SIM</small><h3>Practice</h3><p>Custom categories · zero XP</p></div><b>→</b></article>
          <article class="nova-mode-card v2-tilt matchmaking" data-nav="matchmaking-setup"><span class="nova-mode-icon">⚔</span><div><small>QUICK PLAY</small><h3>Matchmaking</h3><p>Pick a category + difficulty, then queue</p></div><b>▶</b></article>
          <article class="nova-mode-card v2-tilt board-battle" data-nav="board-setup"><span class="nova-mode-icon">▦</span><div><small>NEW MODE · 2–10</small><h3>Board Battle</h3><p>6 categories · $400–$2000 · buzz for control</p></div><b>▶</b></article>
          <article class="nova-mode-card v2-tilt party compact-mode" data-nav="create"><span class="nova-mode-icon">♟</span><div><small>MULTIPLAYER</small><h3>Host Party</h3><p>Public or invite-only custom room</p></div><b>＋</b></article>
          <article class="nova-join-card v2-tilt"><div><small>JOIN A LIVE ROOM</small><h3>Party code</h3></div><div class="nova-code-entry"><input id="quick-code" maxlength="6" autocomplete="off" placeholder="ABC123"><button data-action="quick-join">ENTER</button></div></article>
        </aside>
      </section>

      <section class="nova-intel-row">
        <article><small>WIN RATE</small><b>${p?.games_played?Math.round((Number(p.wins||0)/Math.max(1,Number(p.games_played||0)))*100):0}%</b><span>${Number(p?.wins||0)} victories</span></article>
        <article><small>MATCHES</small><b>${Number(p?.games_played||0)}</b><span>Lifetime runs</span></article>
        <article><small>DAILY CHAIN</small><b>${Number(p?.daily_streak||0)}</b><span>Current streak</span></article>
        <article class="nova-archive-link" data-nav="library"><small>PUBLIC ARCHIVE</small><b>▦</b><span>Replay community sessions →</span></article>
      </section>
    </section>`);
}

function appShell(content) {
  if(currentUiTheme()==="v2") return appShellV2(content);
  const p = state.profile;
  const xp = xpToNextLevel(p?.xp || 0);
  const avatar = p?.avatar_url || state.session?.user?.user_metadata?.avatar_url || state.session?.user?.user_metadata?.picture || "";
  const name = p?.username || state.session?.user?.user_metadata?.full_name || state.session?.user?.user_metadata?.name || "Player";
  return `
  <div class="game-bg" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><b></b><b></b></div>
  <header class="topbar game-hud">
    <button class="brand plain" data-nav="home"><span class="brand-mark"><b>?</b></span><span class="brand-copy"><strong>${esc(state.config.appName || "WhatMod Trivia")}</strong><small>PLAY • GUESS • CLIMB</small></span></button>
    <nav class="desktop-nav hud-nav">
      <button class="nav-pill ${state.view==="home"?"active":""}" data-nav="home"><span>▶</span> Play</button>
      <button class="nav-pill ${state.view==="library"?"active":""}" data-nav="library"><span>▦</span> Library</button>
      <button class="nav-pill ${state.view==="leaderboard"?"active":""}" data-nav="leaderboard"><span>♛</span> Ranks</button>
      <button class="nav-pill ${state.view==="how"?"active":""}" data-nav="how"><span>?</span> Rules</button>
    </nav>
    <div class="user-zone">
      ${p ? `<button class="hud-level" data-nav="profile"><span class="level-orb">${xp.level}</span><span class="hud-level-copy"><b>${esc(firstName(name))}</b><small>${xp.needed.toLocaleString()} XP to Lv ${xp.level+1}</small><span class="mini-xp"><i style="width:${Math.round(xp.progress*100)}%"></i></span></span></button>` : ""}
      ${state.session ? `<button class="avatar-btn" data-nav="profile">${avatar?`<img src="${esc(avatar)}" alt="${esc(name)}">`:`<span>${esc(initials(name))}</span>`}</button>`:
        `<button class="btn small primary google-btn" data-action="login"><span>G</span> Sign in</button>`}
    </div>
  </header>
  <main class="page">${content}</main>
  <nav class="mobile-nav">
    <button data-nav="home" class="${state.view==="home"?"active":""}"><span>▶</span>Play</button>
    <button data-nav="library" class="${state.view==="library"?"active":""}"><span>▦</span>Library</button>
    <button data-nav="leaderboard" class="${state.view==="leaderboard"?"active":""}"><span>♛</span>Ranks</button>
    <button data-nav="profile" class="${state.view==="profile"?"active":""}"><span>☺</span>Player</button>
  </nav>`;
}

function guestBanner() {
  if (state.session) return "";
  return `<div class="guest-quest"><span class="quest-dot">!</span><div><b>Guest run</b><small>Sign in with Google to keep XP, streaks, wins and your player name.</small></div><button class="btn tiny primary" data-action="login">Save progress</button></div>`;
}

function homeView() {
  if(currentUiTheme()==="v2") return homeViewV2();
  const p = state.profile;
  const lvl = xpToNextLevel(p?.xp || 0);
  const displayName = p?.username || state.session?.user?.user_metadata?.full_name || state.session?.user?.user_metadata?.name || "Player";
  return appShell(`
    <section class="hub-head">
      <div>
        <div class="season-pill"><span></span> SEASON 01 • OPEN BETA</div>
        <h1>Ready, <span>${esc(firstName(displayName))}</span>?</h1>
        <p>Choose a mode, make the impossible guess, and turn being <em>almost right</em> into XP.</p>
      </div>
      ${p ? `<div class="player-rank-card">
        <div class="rank-ring" style="--p:${Math.round(lvl.progress*100)}"><span>${lvl.level}</span></div>
        <div><small>CURRENT LEVEL</small><b>${Number(p.xp||0).toLocaleString()} XP</b><span>${lvl.needed.toLocaleString()} XP until Level ${lvl.level+1}</span></div>
      </div>` : ""}
    </section>
    ${guestBanner()}

    <section class="play-grid four-modes">
      <article class="play-card daily-card">
        <div class="card-top"><span class="mode-badge hot">DAILY QUEST</span><span class="card-glyph">∞</span></div>
        <div class="card-art"><div class="planet"><i></i></div><div class="spark s1">✦</div><div class="spark s2">✧</div></div>
        <div class="card-copy"><h2>Today's Estimate</h2><p>One attempt per calendar day. Your precision earns XP and keeps the streak alive.</p></div>
        <div class="reward-row"><span>REWARD</span><b>Precision XP + Streak</b></div>
        <button class="btn play-btn primary" data-action="daily"><span>Play daily</span><b>→</b></button>
      </article>

      <article class="play-card practice-card">
        <div class="card-top"><span class="mode-badge practice-badge">PRACTICE</span><span class="card-glyph">◎</span></div>
        <div class="practice-art"><span>10</span><i>QUESTIONS</i><b>∞</b></div>
        <div class="card-copy"><h2>Practice Run</h2><p>Choose your categories and run a private set of questions whenever you want.</p></div>
        <div class="reward-row no-xp"><span>REWARD</span><b>No XP • Pure practice</b></div>
        <button class="btn play-btn practice-btn" data-nav="practice-setup"><span>Start practice</span><b>→</b></button>
      </article>

      <article class="play-card party-card">
        <div class="card-top"><span class="mode-badge">PARTY MODE</span><span class="card-glyph">♟</span></div>
        <div class="party-faces"><span>⚡</span><span>★</span><span>◆</span><span>+</span></div>
        <div class="card-copy"><h2>Host a Game</h2><p>Build a custom lobby for friends, classes, Discord, or your stream.</p></div>
        <div class="mini-tags"><span>2–20K players</span><span>Custom rules</span><span>Live scores</span></div>
        <button class="btn play-btn" data-nav="create"><span>Create lobby</span><b>＋</b></button>
      </article>

      <article class="play-card board-battle-card">
        <div class="card-top"><span class="mode-badge hot">BOARD BATTLE</span><span class="card-glyph">▦</span></div>
        <div class="board-card-art"><b>$400</b><b>$800</b><b>$1200</b><b>$1600</b><b>$2000</b></div>
        <div class="card-copy"><h2>Board Battle</h2><p>Six categories, thirty clues, buzzer battles, score swings and a final wager.</p></div>
        <div class="mini-tags"><span>2–10 players</span><span>6 × 5 board</span><span>Final wager</span></div>
        <button class="btn play-btn primary" data-nav="board-setup"><span>Build board</span><b>▶</b></button>
      </article>

      <article class="play-card join-card">
        <div class="card-top"><span class="mode-badge cool">QUICK JOIN</span><span class="card-glyph">#</span></div>
        <div class="join-big">
          <label for="quick-code">ENTER PARTY CODE</label>
          <input id="quick-code" maxlength="6" autocomplete="off" placeholder="ABC123">
        </div>
        <p>No setup. Drop in with the code from your host.</p>
        <button class="btn play-btn aqua" data-action="quick-join"><span>Join party</span><b>→</b></button>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="hud-panel quest-panel">
        <div class="panel-title"><span>⚔</span><div><small>PLAYER QUEST</small><b>Level ${lvl.level} → ${lvl.level+1}</b></div><strong>${Math.round(lvl.progress*100)}%</strong></div>
        <div class="quest-xp"><i style="width:${Math.round(lvl.progress*100)}%"></i></div>
        <div class="quest-stats"><span><b>${Number(p?.wins||0)}</b> wins</span><span><b>${Number(p?.games_played||0)}</b> games</span><span><b>${Number(p?.daily_streak||0)}</b> day streak</span></div>
      </article>
      <article class="hud-panel library-panel"><span class="stream-icon">▦</span><div><small>REPLAY LIBRARY</small><b>Never run out of rounds.</b><p>Replay public Practice and Party question sets saved by the community.</p></div><button class="btn tiny" data-nav="library">Browse</button></article>
      <article class="hud-panel streamer-panel"><span class="stream-icon">◈</span><div><small>CREATOR MODE</small><b>Going live?</b><p>Make a Twitch-sized room with an OBS join overlay.</p></div><button class="btn tiny" data-nav="create" data-mode="event">Launch</button></article>
    </section>

    <section class="category-rail"><span>PLAY YOUR WAY</span>${["General Knowledge","General Gaming Knowledge","Brainrot","Internet Culture","Pop Culture","Science"].map(c=>`<i>${categoryGlyph(c)} ${c}</i>`).join("")}</section>
  `);
}

function createView(presetEvent=false) {
  return appShell(`
    <section class="game-screen-head"><button class="back game-back" data-nav="home">←</button><div><div class="mode-badge hot">PARTY BUILDER</div><h1>Build your game</h1><p>Pick the rules. We handle the chaos.</p></div><div class="screen-number">01</div></section>
    <form id="create-form" class="setup-shell">
      <section class="setup-main hud-panel">
        <div class="setup-title"><span>✦</span><div><small>GAME IDENTITY</small><h3>Name the party</h3></div></div>
        <label class="game-field big-field"><span>LOBBY NAME</span><input name="title" maxlength="60" placeholder="Friday Night Brain Battle"></label>

        <div class="setup-title"><span>⌁</span><div><small>QUESTION PACK</small><h3>Choose the challenge</h3></div></div>
        <div class="form-grid game-fields">
          <label class="game-field"><span>CATEGORY</span><select name="category"><option value="Any">✦ Anything goes</option>${availableCategories().map(categoryOption).join("")}</select></label>
          <label class="game-field"><span>DIFFICULTY</span><select name="difficulty"><option value="any">⚡ Mixed</option><option>easy</option><option>medium</option><option>hard</option></select></label>
          <label class="game-field"><span>ROUNDS</span><select name="questionCount"><option>5</option><option selected>10</option><option>15</option><option>20</option><option>30</option></select></label>
          <label class="game-field"><span>ROUND TIMER</span><select name="secondsPerQuestion"><option>10</option><option selected>20</option><option>30</option><option>45</option><option>60</option></select></label>
        </div>
      </section>

      <aside class="setup-side">
        <section class="hud-panel room-card">
          <div class="setup-title"><span>♟</span><div><small>ROOM SIZE</small><h3>Party capacity</h3></div></div>
          <label class="game-field"><span>MAX PLAYERS</span><input name="maxPlayers" type="number" min="2" max="20000" value="${presetEvent?20000:10}"></label>
          <div class="mode-picker">
            <label><input type="radio" name="gameMode" value="standard" ${presetEvent?"":"checked"}><span><b>⚡ Standard</b><small>Fast realtime party play</small><em>Best for 2–100</em></span></label>
            <label><input type="radio" name="gameMode" value="event" ${presetEvent?"checked":""}><span><b>◈ Event / Twitch</b><small>Reduced fan-out large room</small><em>Built for crowds</em></span></label>
          </div>
          <div class="visibility-picker">
            <small>ROOM ACCESS</small>
            <label><input type="radio" name="visibility" value="public" checked><span><b>🌐 Public</b><em>Can receive Quick Play players</em></span></label>
            <label><input type="radio" name="visibility" value="invite_only"><span><b>🔒 Invite only</b><em>Code/link required</em></span></label>
            <label class="matchmaking-toggle"><input type="checkbox" name="allowMatchmaking" checked><span><b>Allow matchmaking fill</b><em>Queued players may join open slots</em></span></label>
          </div>
        </section>
        <section class="loadout-card"><span>YOUR LOADOUT</span><b>Precision scoring</b><p>Numeric guesses earn partial credit from 0–1,000 based on how close they land.</p></section>
        <button class="btn primary launch-btn" type="submit"><span>Create game</span><b>GENERATE CODE →</b></button>
      </aside>
    </form>
  `);
}

function boardSetupView() {
  const categoryDataKnown=(state.categories||[]).length>0;
  const rows=availableCategories().map(name=>({name,count:categoryCount(name)}))
    .filter(x=>!categoryDataKnown || Number(x.count||0)>=5)
    .sort((a,b)=>(Number(b.count||0)-Number(a.count||0)) || a.name.localeCompare(b.name));
  const defaults=new Set(rows.slice(0,6).map(x=>x.name));
  return appShell(`
    <section class="game-screen-head board-setup-head"><button class="back game-back" data-nav="home">←</button><div><div class="mode-badge hot">BOARD BATTLE</div><h1>Build the board.</h1><p>Pick exactly six categories. Thirty clues will be arranged from $400 to $2,000, then 2–10 players fight for board control.</p></div><div class="screen-number">▦</div></section>
    ${!isConfigured()?`<section class="hud-panel board-live-required"><b>Live backend required</b><p>Board Battle is a synchronized multiplayer mode and requires Supabase.</p></section>`:""}
    <form id="board-setup-form" class="board-setup-shell">
      <section class="hud-panel board-builder-main">
        <div class="setup-title"><span>01</span><div><small>BOARD CATEGORIES</small><h3>Choose six lanes</h3></div><button class="btn tiny ghost" type="button" data-action="board-auto-categories">Auto pick six</button></div>
        <div class="board-category-counter"><b id="board-category-count">${defaults.size}</b><span>/ 6 selected</span></div>
        <div class="board-category-picker">
          ${rows.map((x,i)=>`<label class="board-category-option ${defaults.has(x.name)?"selected":""}"><input type="checkbox" name="categories" value="${esc(x.name)}" ${defaults.has(x.name)?"checked":""}><span>${categoryGlyph(x.name)}</span><div><b>${esc(x.name)}</b><small>${x.count===null?"Live count unavailable":`${Number(x.count).toLocaleString()} active questions`}</small></div><i>${defaults.has(x.name)?"✓":"+"}</i></label>`).join("") || `<div class="empty">No categories currently have enough active questions. Hydrate at least six categories to 5+ questions first.</div>`}
        </div>
      </section>
      <aside class="board-builder-side">
        <section class="hud-panel">
          <div class="setup-title"><span>02</span><div><small>ROOM RULES</small><h3>Configure the match</h3></div></div>
          <label class="game-field"><span>LOBBY NAME</span><input name="title" maxlength="60" placeholder="Friday Board Battle"></label>
          <div class="form-grid game-fields board-fields">
            <label class="game-field"><span>MAX PLAYERS</span><select name="maxPlayers"><option>2</option><option>3</option><option>4</option><option>5</option><option selected>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select></label>
            <label class="game-field"><span>ANSWER TIMER</span><select name="secondsPerQuestion"><option>10</option><option selected>15</option><option>20</option><option>25</option><option>30</option></select></label>
          </div>
          <div class="visibility-picker board-visibility"><small>ROOM ACCESS</small><label><input type="radio" name="visibility" value="invite_only" checked><span><b>🔒 Invite only</b><em>Best for a private group</em></span></label><label><input type="radio" name="visibility" value="public"><span><b>🌐 Public</b><em>Joinable by code; not in Quick Match yet</em></span></label></div>
        </section>
        <section class="board-rules-preview">
          <small>FORMAT</small><h3>6 × 5</h3><div class="board-value-row"><b>$400</b><b>$800</b><b>$1200</b><b>$1600</b><b>$2000</b></div>
          <ul><li>First buzz gets the clue</li><li>Wrong answers lose the clue value</li><li>Other players may rebound after a miss</li><li>Two hidden Double Down clues</li><li>Final wager after the board clears</li></ul>
        </section>
        <button class="btn primary launch-btn" id="board-create-button" type="submit" ${rows.length<6||!isConfigured()?"disabled":""}><span>CREATE BOARD LOBBY</span><b>▶</b></button>
      </aside>
    </form>`);
}

function boardPlayerName(id){ return (state.boardGame?.players||[]).find(p=>String(p.user_id)===String(id))?.username || "Player"; }
function boardScore(value){ const n=Number(value||0); return `${n<0?"−":""}$${Math.abs(n).toLocaleString()}`; }
function boardAnswerControl(q,{final=false}={}){
  if(!q) return "";
  if(q.question_type==="multiple_choice"){
    const options=Array.isArray(q.options)?q.options:[];
    return `<div class="board-choice-grid">${options.map((o,i)=>`<button type="button" class="board-choice" data-board-answer="${esc(i)}" data-board-final="${final?"1":"0"}">${esc(o)}</button>`).join("")}</div>`;
  }
  const type=q.question_type==="numeric"?"number":"text";
  const step=q.question_type==="numeric"?' step="any" inputmode="decimal"':'';
  return `<form class="board-answer-form" data-board-final="${final?"1":"0"}"><div class="board-answer-line"><input name="answer" type="${type}"${step} autocomplete="off" placeholder="${q.question_type==="numeric"?"Your answer":"Type your response"}" required><span>${esc(q.unit||"")}</span></div><button class="btn primary" type="submit">LOCK ANSWER</button></form>`;
}

function boardScoreRail(b){
  const players=b.players||[];
  return `<div class="board-score-rail">${players.map((p,i)=>`<article class="board-score-player ${p.is_control?"control":""} ${p.is_buzzed?"buzzed":""} ${p.is_me?"me":""}"><span>${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:esc(initials(p.username))}</span><div><small>${p.is_control?"BOARD CONTROL":p.is_buzzed?"BUZZED IN":p.is_host?"HOST":`PLAYER ${i+1}`}</small><b>${esc(p.username)}</b></div><strong class="${Number(p.score)<0?"negative":""}">${boardScore(p.score)}</strong></article>`).join("")}</div>`;
}

function boardGridView(b){
  const me=(b.players||[]).find(p=>p.is_me), canPick=!!me?.is_control;
  const cells=b.cells||[];
  const cats=b.categories||[];
  return `<section class="board-stage">
    <div class="board-turn-banner ${canPick?"your-turn":""}"><span>${canPick?"YOUR BOARD":"BOARD CONTROL"}</span><b>${canPick?"Choose the next clue":`${esc(boardPlayerName(b.control_user_id))} is choosing`}</b><small>${30-cells.filter(c=>c.used).length} clues remaining</small></div>
    <div class="board-scroll" role="region" aria-label="Board Battle clue board"><div class="board-grid">
      ${cats.map(c=>`<div class="board-category-head"><span>${categoryGlyph(c)}</span><b>${esc(c)}</b></div>`).join("")}
      ${[0,1,2,3,4].map(row=>cats.map((cat,col)=>{const c=cells.find(x=>Number(x.row)===row&&Number(x.col)===col);if(!c)return`<div class="board-cell unavailable">—</div>`;return `<button class="board-cell ${c.used?"used":""}" type="button" data-board-cell="${esc(c.id)}" ${c.used||!canPick?"disabled":""}><span>${c.used?"":`$${Number(c.value).toLocaleString()}`}</span>${c.used?`<i>✓</i>`:""}</button>`;}).join("")).join("")}
    </div></div>
  </section>`;
}

function boardClueView(b){
  const phase=b.phase,q=b.question,me=(b.players||[]).find(p=>p.is_me),active=(b.cells||[]).find(c=>c.id===b.active_cell_id);
  const host=!!me?.is_host,locked=!!me?.locked_out,buzzed=String(b.buzz_user_id||"")===String(me?.user_id||"");
  const attempts=b.attempts||[];
  if(phase==="wager"){
    const mine=buzzed;
    return `<section class="board-clue-stage special"><div class="board-clue-meta"><span>${esc(active?.category||"")}</span><strong>$${Number(active?.value||0).toLocaleString()}</strong><em id="board-phase-clock">—</em></div><div class="board-double-burst">DOUBLE<br>DOWN</div><h2>${mine?"Set your wager before the clue appears.":`${esc(boardPlayerName(b.buzz_user_id))} found a Double Down.`}</h2>${mine?`<form id="board-wager-form" class="board-wager-form"><label>WAGER <small>Maximum ${boardScore(b.my_max_double_wager)}</small><input name="wager" type="number" min="0" max="${Number(b.my_max_double_wager||0)}" value="${Math.min(Number(b.my_max_double_wager||0),Number(active?.value||0))}" required></label><button class="btn primary" type="submit">LOCK WAGER →</button></form>`:`<div class="board-waiting"><i></i> Waiting for the wager…</div>`}</section>`;
  }
  return `<section class="board-clue-stage ${phase}">
    <div class="board-clue-meta"><span>${esc(active?.category||q?.category||"")}</span><strong>$${Number(active?.value||0).toLocaleString()}</strong><em id="board-phase-clock">—</em></div>
    ${q?`${questionTitleFrame(q,{tag:"h1",className:"board-clue-prompt"})}${q.context?`<p class="board-clue-context">${esc(q.context)}</p>`:""}`:`<div class="center-stage"><div class="spinner"></div></div>`}
    ${phase==="buzz"?`<div class="board-buzz-zone">${locked?`<button class="board-buzzer locked" disabled><span>LOCKED OUT</span><small>Another player can steal it</small></button>`:`<button class="board-buzzer" data-action="board-buzz" ${!me?"disabled":""}><span>BUZZ</span><small>First tap gets control</small></button>`}<p>${attempts.length?`${attempts.length} miss${attempts.length===1?"":"es"} — clue is still live.`:"Buzzing is open."}</p></div>`:""}
    ${phase==="answer"?`<div class="board-answer-zone">${buzzed?`<span class="board-you-have-it">YOU HAVE THE BUZZER</span>${boardAnswerControl(q)}`:`<div class="board-waiting"><i></i><b>${esc(boardPlayerName(b.buzz_user_id))}</b> is answering…</div>`}</div>`:""}
    ${phase==="reveal"?`<div class="board-reveal"><small>CORRECT RESPONSE</small><h2>${esc(b.answer_display||"—")}</h2>${q?.explanation?`<p>${esc(q.explanation)}</p>`:""}<div class="board-attempts">${attempts.map(a=>`<span class="${a.correct?"correct":"wrong"}"><b>${esc(a.username)}</b> ${a.correct?"✓":"✕"} ${a.delta>=0?"+":"−"}$${Math.abs(Number(a.delta||0)).toLocaleString()}</span>`).join("")}</div><em>Returning to the board…</em></div>`:""}
    ${host&&(phase==="buzz"||phase==="answer")?`<button class="btn tiny ghost board-close-clue" data-action="board-close-clue">Reveal / close clue</button>`:""}
  </section>`;
}

function boardFinalView(b){
  const me=(b.players||[]).find(p=>p.is_me),phase=b.phase,spectator=b.my_participation_status==="spectator";
  if(phase==="final_wager") return `<section class="board-final-stage"><span class="mode-badge hot">FINAL WAGER</span><h1>${esc(b.final_category||"Final clue")}</h1><p>The clue stays hidden until every active player locks a wager.</p>${spectator?`<div class="board-waiting"><i></i> Spectating the final wager…</div>`:me?.final_wagered?`<div class="board-waiting"><i></i> Wager locked. Waiting for the room…</div>`:`<form id="board-final-wager-form" class="board-wager-form"><label>YOUR WAGER <small>Maximum ${boardScore(b.my_max_final_wager)}</small><input name="wager" type="number" min="0" max="${Number(b.my_max_final_wager||0)}" value="0" required></label><button class="btn primary" type="submit">LOCK FINAL WAGER</button></form>`}<div class="final-ready-list">${(b.players||[]).map(p=>`<span class="${p.final_wagered?"ready":""}">${p.final_wagered?"✓":"○"} ${esc(p.username)}</span>`).join("")}</div><em id="board-phase-clock">—</em></section>`;
  if(phase==="final_clue") return `<section class="board-final-stage clue"><span class="mode-badge hot">FINAL CLUE · ${esc(b.final_category||"")}</span><em id="board-phase-clock">—</em>${b.question?questionTitleFrame(b.question,{tag:"h1",className:"board-clue-prompt"}):""}${spectator?`<div class="board-waiting"><i></i> Spectating Final…</div>`:me?.final_answered?`<div class="board-waiting"><i></i> Final answer locked.</div>`:boardAnswerControl(b.question,{final:true})}<div class="final-ready-list">${(b.players||[]).map(p=>`<span class="${p.final_answered?"ready":""}">${p.final_answered?"✓":"○"} ${esc(p.username)}</span>`).join("")}</div></section>`;
  return "";
}

function boardFinishedView(b){
  const players=[...(b.players||[])].sort((a,c)=>Number(c.score)-Number(a.score)),winner=players[0],me=players.find(p=>p.is_me);
  const meHost=String(state.lobby?.host_id||"")===String(state.session?.user?.id||"");
  return `<section class="board-finish"><div class="victory-burst"><span>♛</span></div><span class="mode-badge hot">BOARD COMPLETE</span><h1>${winner?`${esc(winner.username)} wins the board!`:"Board complete"}</h1><p>Thirty clues, one final wager, and a whole lot of score swings.${me?` You banked <b>+${Number(me.xp_awarded||0).toLocaleString()} XP</b>.`:""}</p>
    ${b.question?`<div class="board-final-answer"><small>FINAL RESPONSE</small><b>${esc(b.answer_display||"—")}</b>${b.question.explanation?`<span>${esc(b.question.explanation)}</span>`:""}</div>`:""}
    <div class="board-final-standings">${players.map((p,i)=>`<article class="${i===0?"winner":""}"><span>#${i+1}</span><div><b>${esc(p.username)}</b><small>${p.final_wager!=null?`Final wager ${boardScore(p.final_wager)} · ${p.final_correct?"correct":"missed"}`:""}</small></div><strong class="${Number(p.score)<0?"negative":""}">${boardScore(p.score)}</strong></article>`).join("")}</div>
    ${meHost?`<button class="btn primary launch-btn" data-action="return-lobby"><span>RETURN TO SAME LOBBY</span><b>↻</b></button>`:`<div class="board-return-wait">Returning everyone to the same lobby in <b id="board-return-countdown">8</b>s…</div>`}</section>`;
}

function boardGameView(){
  const b=state.boardGame;
  if(!b) return appShell(`<section class="center-stage"><div class="spinner"></div><h2>Loading the board…</h2></section>`);
  const spectator=b.my_participation_status==="spectator";
  return appShell(`<section class="board-game-shell">
    <header class="board-game-head"><div><span class="mode-badge hot">BOARD BATTLE</span><h1>${esc(state.lobby?.title||"Board Battle")}</h1><p>ROOM ${esc(state.lobby?.code||b.code||"")} · ${Number(state.lobby?.current_question_index||0)}/30 clues cleared</p></div><div class="board-game-logo"><span>6 × 5</span><b>BUZZ • RISK • WIN</b></div></header>
    ${spectator?`<section class="board-spectator-banner"><b>SPECTATOR MODE</b><span>This board is already in progress. Watch this game, then you’ll be activated when the room resets.</span></section>`:""}
    ${boardScoreRail(b)}
    ${b.phase==="board"?boardGridView(b):b.phase==="final_wager"||b.phase==="final_clue"?boardFinalView(b):b.phase==="finished"?boardFinishedView(b):boardClueView(b)}
  </section>`);
}

function lobbyView() {
  const g = state.lobby;
  if (!g) return homeView();
  const meHost = !g.host_id || g.host_id === state.session?.user?.id || g.demoHost;
  const joinUrl = `${state.config.publicUrl || new URL("./",location.href).href}?join=${g.code}`;
  const players = state.lobbyPlayers || [];
  const spectators = players.filter(p=>p.participation_status==="spectator");
  const playing = players.filter(p=>p.participation_status!=="spectator");
  const phase = g.status || "lobby";
  if (g.experience_mode === "board" && (phase === "question" || phase === "results" || phase === "finished")) return boardGameView();
  if (phase === "question" || phase === "results" || phase === "finished") return gameView();

  return appShell(`
    <section class="party-room-head">
      <div><span class="mode-badge ${lobbySyncDisplay().cls}" id="lobby-sync-status"><i></i> ${lobbySyncDisplay().text}</span><h1>${esc(g.title || "Trivia Party")}</h1><p>Invite the squad. The roster updates automatically as players join.</p></div>
      <div class="party-code"><small>PARTY CODE</small><strong>${esc(g.code)}</strong><button data-copy="${esc(g.code)}">COPY</button></div>
    </section>

    <section class="party-layout">
      <div class="party-main">
        <section class="hud-panel invite-card">
          <div><small>INVITE LINK</small><b>${esc(joinUrl)}</b></div><button class="btn tiny" data-copy="${esc(joinUrl)}">Copy link</button><a class="btn tiny ghost" target="_blank" rel="noopener" href="?overlay=${encodeURIComponent(g.code)}">OBS overlay</a>
        </section>
        <section class="hud-panel roster-card">
          <div class="panel-title"><span>♟</span><div><small>PARTY ROSTER</small><b>${playing.length} playing${spectators.length?` · ${spectators.length} spectating`:""}</b></div><strong class="ready-chip">${g.lobby_kind==="matchmaking"?"QUEUE":"READY"}</strong></div>
          <div class="roster-grid">${players.map((p,i)=>`<article class="roster-player ${p.user_id===String(g.host_id)?"host":""} ${p.is_bot?"bot":""} ${p.participation_status==="spectator"?"spectator":""}"><span class="roster-avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}">`:`${esc(initials(p.username))}`}</span><div><b>${esc(p.username||"Player")}</b><small>${p.is_bot?"BOT CHALLENGER":p.participation_status==="spectator"?"SPECTATOR · NEXT MATCH":p.user_id===String(g.host_id)?"HOST":"PLAYER " + String(i+1).padStart(2,"0")}</small></div>${p.is_bot?`<i>AI</i>`:p.participation_status==="spectator"?`<i>◉</i>`:p.user_id===String(g.host_id)?`<i>♛</i>`:`<i>✓</i>`}</article>`).join("") || `<div class="empty">Your party is waiting for its first player…</div>`}</div>
        </section>
      </div>

      <aside class="party-side">
        <section class="hud-panel rules-card"><small>GAME RULES</small><h3>Match loadout</h3>
          ${g.experience_mode==="board"?`<div class="rule-row"><span>▦ Mode</span><b>Board Battle</b></div><div class="rule-row board-lobby-categories"><span>6 Categories</span><b>${esc((state.boardGame?.categories||[]).join(" · ")||"Loading…")}</b></div><div class="rule-row"><span>◆ Board</span><b>30 clues · $400–$2000</b></div><div class="rule-row"><span>◷ Answer timer</span><b>${g.seconds_per_question}s</b></div>`:`<div class="rule-row"><span>${categoryGlyph(g.category)} Category</span><b>${esc(g.category)}</b></div><div class="rule-row"><span>⚡ Difficulty</span><b>${esc(g.difficulty)}</b></div><div class="rule-row"><span>◫ Rounds</span><b>${g.question_count}</b></div><div class="rule-row"><span>◷ Timer</span><b id="timer-value">${g.seconds_per_question}s</b></div><div class="rule-row"><span>◈ Network</span><b>${g.game_mode==="event"?"Event":"Standard"}</b></div>`}
          <div class="rule-row"><span>${g.visibility==="public"?"🌐":"🔒"} Access</span><b>${g.visibility==="public"?"Public":"Invite only"}</b></div>
          ${g.lobby_kind==="matchmaking"?`<div class="rule-row"><span>⚔ Queue</span><b>Quick Match</b></div>`:""}
        </section>
        ${meHost?`<section class="host-launch"><small>HOST CONTROL</small><h3>${g.experience_mode==="board"?"Ready to open the board?":"Everyone here?"}</h3><p>${g.experience_mode==="board"?"Board Battle requires at least 2 players. Starting builds all 30 clues and randomly assigns first control.":"Starting locks the game rules and launches Round 1."}</p><button class="btn primary launch-btn" data-action="start-game" ${playing.filter(p=>!p.is_bot).length<(g.experience_mode==="board"?2:1)?"disabled":""}><span>${g.experience_mode==="board"?"START BOARD":"START MATCH"}</span><b>▶</b></button></section>`:`<section class="host-launch waiting-card"><span class="waiting-pulse"></span><small>WAITING FOR HOST</small><h3>You're in.</h3><p>${g.experience_mode==="board"?"The board will appear when the host starts the game.":"The first question will appear automatically."}</p></section>`}
      </aside>
    </section>

    ${meHost ? `<section class="hud-panel twitch-panel game-twitch"><div><span class="stream-icon">◈</span><div><small>TWITCH CONTROL</small><b>${state.twitch.user?`Connected as ${esc(state.twitch.user.display_name)}`:"Connect your stream"}</b><p>Post the party code to chat and listen for !trivia / !join.</p></div></div><div class="row-actions">${state.twitch.user?`<button class="btn tiny twitch" data-action="twitch-announce">Post lobby</button><button class="btn tiny" data-action="twitch-listen">Listen</button><button class="btn tiny ghost" data-action="twitch-disconnect">Disconnect</button>`:`<button class="btn twitch" data-action="twitch-connect">Connect Twitch</button>`}</div>${state.twitch.chatters.length?`<div class="chat-interest">${state.twitch.chatters.map(c=>`<span>${esc(c.name)}</span>`).join("")}</div>`:""}</section>`:""}
  `);
}

function questionInput(q, prefix="game") {
  if (q.question_type === "multiple_choice") return `<div class="choice-grid">${(q.options||[]).map((x,i)=>`<button type="button" class="choice" data-answer="${i}">${esc(x)}</button>`).join("")}</div>`;
  if (q.question_type === "text") return `<input id="${prefix}-answer" class="answer-input text" autocomplete="off" placeholder="Type your answer">`;
  return `<div class="answer-wrap"><input id="${prefix}-answer" class="answer-input" type="number" step="any" inputmode="decimal" placeholder="Your best guess"><span>${esc(q.unit||"")}</span></div>`;
}

function gameView() {
  const g = state.lobby;
  const q = state.currentQuestion;
  if (g.status === "finished") return finalView();
  if (!q) return appShell(`<section class="center-stage loading-stage"><div class="spinner"></div><h2>Loading the arena…</h2><p>Syncing the next question with the party.</p></section>`);
  const host = g.demoHost || g.host_id === state.session?.user?.id;
  const finalRound = Number(g.current_question_index||0)+1 >= Number(g.question_count||0);

  if (g.status === "results") {
    const rows = state.roundResults || [];
    return appShell(`
      <section class="arena-head"><div><span class="round-chip">ROUND ${g.current_question_index+1} / ${g.question_count}</span><span class="mode-badge success">RESULTS</span></div><div class="arena-category">${categoryGlyph(q.category)} ${esc(q.category)} · ${esc(q.difficulty)}</div></section>
      <section class="results-arena">
        <div class="result-question"><small>THE QUESTION</small>${questionTitleFrame(q)}${questionFeedback(q,{allowDelete:true})}</div>
        <section class="correct-answer-card"><div><small>CORRECT ANSWER</small><strong>${formatAnswer(q.answer_numeric ?? q.answer_text ?? q.answer_display)} <em>${esc(q.unit||"")}</em></strong><p>${esc(q.explanation||"")}</p></div><span>✓</span></section>
        <div class="result-grid">
          <section class="hud-panel chart-card game-chart"><div class="panel-title"><span>⌁</span><div><small>THE CROWD</small><b>Guess distribution</b></div></div><canvas id="guess-chart"></canvas></section>
          <section class="hud-panel scoreboard"><div class="panel-title"><span>♛</span><div><small>LIVE RANKS</small><b>Round leaderboard</b></div><strong>${rows.filter(r=>r.answer_value!=null).length}/${rows.length} answered</strong></div>${rows.slice(0,20).map((r,i)=>`<div class="score-row ${r.is_me?"me":""}"><span class="score-place">${i+1}</span><b>${esc(r.username)} ${r.is_bot?`<em class="bot-chip">BOT</em>`:""}</b><span>+${r.score}</span><strong>${r.total_score}</strong></div>`).join("") || `<div class="empty">No answers this round.</div>`}</section>
        </div>
        <div class="round-auto-controls">
          <div class="auto-advance-banner"><span>${finalRound?"MATCH ENDS":"NEXT ROUND"} IN <b id="result-countdown">5</b>s</span><small>Automatic</small></div>
          ${host?`<button class="btn primary next-round-btn" data-action="next-round"><span>${finalRound?"FINISH NOW":"NEXT NOW"}</span><b>→</b></button>`:`<div class="waiting-banner"><span></span> Results are locked in. Continuing automatically…</div>`}
        </div>
      </section>`);
  }

  return appShell(`
    <section class="arena-head"><div><span class="round-chip">ROUND ${g.current_question_index+1} / ${g.question_count}</span><span class="mode-badge live"><i></i> LIVE</span></div><div class="arena-category">${categoryGlyph(q.category)} ${esc(q.category)} · ${esc(q.difficulty)}</div></section>
    <section class="question-arena">
      <div class="arena-timer"><span>THINK FAST</span><div class="timer-line"><i id="timer-bar"></i></div><b id="timer-value">${g.seconds_per_question}s</b></div>
      <div class="question-number">Q${String(g.current_question_index+1).padStart(2,"0")}</div>
      ${questionTitleFrame(q)}
      ${questionFeedback(q,{allowDelete:true})}
      ${q.context ? `<p class="question-context">${esc(q.context)}</p>`:""}
      ${g.my_participation_status==="spectator"?`<div class="spectator-banner"><span>◉</span><div><b>SPECTATOR MODE</b><small>This match is already underway. Watch live — you'll become an active player when the lobby restarts.</small></div></div>`:`<form id="answer-form" class="answer-form game-answer-form">
        ${questionInput(q)}
        ${q.question_type!=="multiple_choice"?`<button class="btn primary lock-btn" type="submit"><span>LOCK IT IN</span><b>✓</b></button>`:""}
      </form>
      <div id="answer-status" class="answer-status"><span>◎</span> One answer. No take-backs.</div>`}
      ${host?`<button class="btn ghost host-reveal" data-action="reveal-round">Host: reveal results</button>`:""}
    </section>`);
}

function finalView() {
  const rows = state.roundResults || [];
  const me = rows.find(r=>r.is_me);
  const spectator=state.lobby?.my_participation_status==="spectator";
  return appShell(`
    <section class="finish game-finish">
      <div class="victory-burst"><span>♛</span></div><div class="mode-badge hot">MATCH COMPLETE</div><h1>GG, party.</h1><p>${esc(state.lobby?.title || "Trivia Night")}${me&&!spectator?` · <b>+${Number(me.xp_awarded||0).toLocaleString()} XP</b>`:spectator?` · <b>You join the next run</b>`:""}</p>
      <div class="podium">${rows.slice(0,3).map((r,i)=>`<div class="podium-card p${i+1}"><span class="medal">${i===0?"♛":i===1?"◆":"▲"}</span><small>#${i+1}</small><b>${esc(r.username)}${r.is_bot?` <em class="bot-chip">BOT</em>`:""}</b><strong>${Number(r.total_score||0).toLocaleString()}</strong><em>points${r.is_bot?"":` · +${Number(r.xp_awarded||0).toLocaleString()} XP`}</em></div>`).join("")}</div>
      <div class="scoreboard hud-panel">${rows.slice(3,50).map((r,i)=>`<div class="score-row"><span class="score-place">${i+4}</span><b>${esc(r.username)} ${r.is_bot?`<em class="bot-chip">BOT</em>`:""}</b><span>${Number(r.total_score||0).toLocaleString()} pts${r.is_bot?"":` · +${Number(r.xp_awarded||0).toLocaleString()} XP`}</span></div>`).join("")}</div>
      <div class="return-lobby-card"><div><small>SAME PARTY · SAME CODE ${esc(state.lobby?.code||"")}</small><b>Returning to lobby in <span id="lobby-return-countdown">8</span>s</b><p>Late spectators become active players. Matchmaking bots are recalculated when the host launches again.</p></div><button class="btn primary launch-btn" data-action="return-lobby"><span>RETURN NOW</span><b>→</b></button></div>
    </section>`);
}

function dailyView() {
  const q = state.daily?.question || state.daily;
  const result = state.daily?.result;
  if (!q) return appShell(`<section class="center-stage loading-stage"><div class="spinner"></div><h2>Generating today's quest…</h2></section>`);
  if (result) {
    const rankText = result.score >= 950 ? "LEGENDARY" : result.score >= 800 ? "EPIC" : result.score >= 600 ? "RARE" : result.score >= 350 ? "SOLID" : "WILD GUESS";
    return appShell(`
      <section class="daily-results-head"><span class="mode-badge success">QUEST COMPLETE</span><h1>${rankText}</h1><p>You banked <b>+${result.xp_awarded} XP</b> today.</p></section>
      <section class="daily-result-grid">
        <article class="score-burst game-score-burst"><span>PRECISION</span><strong>${result.score}</strong><small>/ 1,000</small><i>+${result.xp_awarded} XP</i></article>
        <article class="hud-panel daily-answer-panel"><small>TODAY'S QUESTION</small>${questionTitleFrame(q,{tag:"h2"})}${questionFeedback(q)}<div class="versus-answers"><span><small>YOU GUESSED</small><b>${formatAnswer(result.your_answer)} ${esc(q.unit||"")}</b></span><i>VS</i><span><small>ANSWER</small><b>${formatAnswer(result.answer_numeric ?? q.answer_numeric)} ${esc(q.unit||"")}</b></span></div><p>${esc(result.explanation||q.explanation||"")}</p></article>
      </section>
      <section class="hud-panel chart-card daily-chart-card"><div class="panel-title"><span>⌁</span><div><small>GLOBAL READ</small><b>Where everyone landed</b></div></div><canvas id="daily-chart"></canvas></section>
      <div class="row-actions center"><button class="btn primary" data-nav="home">Claim & return</button><button class="btn" data-copy="${esc(location.href)}">Share challenge</button></div>
    `);
  }
  return appShell(`
    <section class="daily-quest-shell">
      <div class="daily-side-mark"><span>∞</span><small>DAILY<br>QUEST</small></div>
      <div class="daily-quest-main">
        <div class="daily-kicker"><span>DAILY #${esc(q.daily_number||"—")}</span><span>${categoryGlyph(q.category)} ${esc(q.category)} • ${esc(q.difficulty)}</span></div>
        <div class="quest-reward-chip">+ Precision XP <i>•</i> Keep your streak alive</div>
        ${questionTitleFrame(q)}
        ${questionFeedback(q)}
        ${q.context?`<p class="question-context">${esc(q.context)}</p>`:""}
        <form id="daily-form" class="answer-form game-answer-form">${questionInput(q,"daily")}<button class="btn primary lock-btn" type="submit"><span>SUBMIT FINAL GUESS</span><b>✓</b></button></form>
        <p class="one-shot"><span>◎</span> One shot per day. Accuracy determines XP.</p>
      </div>
    </section>`);
}


const practiceCategories = () => availableCategories();

function practiceSetupView() {
  return appShell(`
    <section class="game-screen-head"><button class="back game-back" data-nav="home">←</button><div><div class="mode-badge practice-badge">PRACTICE MODE</div><h1>Train your guess.</h1><p>Unlimited private rounds. Scores are tracked for the run, but Practice never awards XP, streaks, wins, or leaderboard progress.</p></div><div class="screen-number">◎</div></section>
    <form id="practice-setup-form" class="practice-setup-shell">
      <section class="hud-panel practice-builder">
        <div class="setup-title"><span>◫</span><div><small>ROUND LENGTH</small><h3>How long is the run?</h3></div></div>
        <div class="practice-counts">
          ${[5,10,15,20].map(n=>`<label><input type="radio" name="questionCount" value="${n}" ${n===10?"checked":""}><span><b>${n}</b><small>questions</small></span></label>`).join("")}
        </div>

        <div class="setup-title practice-section-title"><span>⌁</span><div><small>CATEGORY LOADOUT</small><h3>Choose one or mix several</h3></div></div>
        <div class="practice-categories">
          ${practiceCategories().map(c=>{const count=categoryCount(c),disabled=(state.categories||[]).length&&(count===null||count<=0);return `<label class="${disabled?"disabled":""}"><input type="checkbox" name="categories" value="${esc(c)}" ${disabled?"disabled":"checked"}><span><i>${categoryGlyph(c)}</i><b>${esc(c)}</b>${count!==null?`<small>${count.toLocaleString()} questions</small>`:""}</span></label>`}).join("")}
        </div>

        <div class="practice-options-row">
          <label class="game-field"><span>DIFFICULTY</span><select name="difficulty"><option value="any">⚡ Mixed difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
          <div class="practice-zero-xp"><span>0 XP</span><div><b>Practice is consequence-free.</b><small>Replay as much as you want without affecting your account progression.</small></div></div>
        </div>
      </section>
      <aside class="hud-panel practice-sidecard">
        <div class="practice-target">◎</div><small>TRAINING RUN</small><h2>Sharpen your estimation instinct.</h2><p>Every question still uses the same 0–1,000 precision scoring as competitive play, so you can see exactly how close you were.</p>
        <ul><li>✓ Unlimited attempts</li><li>✓ Category selection</li><li>✓ Round score + average precision</li><li>✓ Correct answer after every guess</li><li class="muted">× No XP farming</li></ul>
        <button class="btn practice-btn launch-btn" type="submit"><span>BEGIN PRACTICE</span><b>→</b></button>
      </aside>
    </form>
  `);
}

function matchmakingSetupView() {
  const options=state.matchmakingOptions||[];
  const rowFor=c=>options.find(x=>x.category===c)||null;
  const cats=availableCategories().filter(c=>c!=="Any");
  const playable=cats.filter(c=>{const r=rowFor(c);return !options.length||r&&Math.max(Number(r.easy_count||0),Number(r.medium_count||0),Number(r.hard_count||0))>=10});
  const optionMarkup=playable.map(c=>{const r=rowFor(c);const suffix=r?` · E ${Number(r.easy_count||0)} / M ${Number(r.medium_count||0)} / H ${Number(r.hard_count||0)}`:"";return `<option value="${esc(c)}">${categoryGlyph(c)} ${esc(c)}${suffix}</option>`}).join("");
  return appShell(`
    <section class="game-screen-head"><button class="back game-back" data-nav="home">←</button><div><div class="mode-badge hot">MATCHMAKING</div><h1>Choose your arena.</h1><p>Your category and difficulty define the entire match. We only place you into rooms with the exact same loadout; otherwise a fresh 10-player room launches with bot challengers.</p></div><div class="screen-number">⚔</div></section>
    <form id="matchmaking-setup-form" class="matchmaking-setup-shell">
      <section class="hud-panel matchmaking-builder">
        <div class="setup-title"><span>⌁</span><div><small>CATEGORY</small><h3>What do you want to play?</h3></div></div>
        <label class="game-field big-field"><span>MATCH CATEGORY</span><select name="category" required>${optionMarkup}</select></label>
        <div class="matchmaking-count-hint" id="matchmaking-count-hint">At least 10 active questions are required at the selected difficulty.</div>
        <div class="setup-title practice-section-title"><span>⚡</span><div><small>DIFFICULTY</small><h3>Pick your challenge level</h3></div></div>
        <div class="matchmaking-difficulty">
          ${[["easy","Easy","Relaxed knowledge + wider clues"],["medium","Medium","Balanced competitive play"],["hard","Hard","Deep cuts + tougher facts"]].map(([v,t,d],i)=>`<label data-mm-difficulty="${v}"><input type="radio" name="difficulty" value="${v}" ${i===1?"checked":""}><span><b>${t}</b><small>${d}<em data-mm-count="${v}"></em></small></span></label>`).join("")}
        </div>
        <div class="matchmaking-rule-note"><span>◎</span><div><b>Exact-match queue</b><small>Only rooms using this category and difficulty are considered. Mid-match joins spectate until the next run. Empty seats are filled by bots.</small></div></div>
      </section>
      <aside class="hud-panel matchmaking-sidecard">
        <div class="matchmaking-crosshair">⚔</div><small>QUICK PLAY</small><h2>Find a room or create one instantly.</h2><ul><li>✓ 10 total competitors</li><li>✓ Human-first matchmaking</li><li>✓ Bots fill empty slots</li><li>✓ Same category all match</li><li>✓ Same lobby persists after the match</li></ul>
        <button class="btn primary launch-btn" id="matchmaking-play" type="submit" ${playable.length?"":"disabled"}><span>${playable.length?"PLAY":"NO ELIGIBLE CATEGORIES"}</span><b>▶</b></button>
      </aside>
    </form>
  `);
}

function updateMatchmakingDifficultyAvailability(){
  const form=$("#matchmaking-setup-form");if(!form)return;const category=form.category?.value;const row=(state.matchmakingOptions||[]).find(x=>x.category===category);
  let firstEligible=null;
  ["easy","medium","hard"].forEach(d=>{const label=form.querySelector(`[data-mm-difficulty="${d}"]`),input=label?.querySelector('input'),count=row?Number(row[`${d}_count`]||0):99;const ok=count>=10;label?.classList.toggle('disabled',!ok);if(input)input.disabled=!ok;const c=label?.querySelector(`[data-mm-count="${d}"]`);if(c)c.textContent=row?` · ${count.toLocaleString()} available`:'';if(ok&&!firstEligible)firstEligible=input;});
  const checked=form.querySelector('input[name="difficulty"]:checked');if((!checked||checked.disabled)&&firstEligible)firstEligible.checked=true;
  const play=$("#matchmaking-play");if(play)play.disabled=!form.querySelector('input[name="difficulty"]:checked:not(:disabled)');
}


function practiceView() {
  const pr = state.practice;
  if (!pr) return practiceSetupView();

  if (pr.status === "completed") {
    const rows = pr.summary || [];
    const count = pr.question_count || rows.length || 1;
    const total = Number(pr.total_score || rows.reduce((s,r)=>s+Number(r.score||0),0));
    const avg = Math.round(total / Math.max(1,count));
    const grade = avg >= 900 ? "Elite instinct" : avg >= 750 ? "Locked in" : avg >= 550 ? "Getting sharp" : avg >= 350 ? "Warming up" : "Keep training";
    return appShell(`
      <section class="practice-complete">
        <div class="practice-target big">◎</div><div class="mode-badge practice-badge">PRACTICE COMPLETE</div>
        <h1>${grade}</h1><p>This run changed absolutely nothing on your XP profile — exactly as intended.</p>
        <div class="practice-summary-stats">
          <article><small>TOTAL SCORE</small><strong>${total.toLocaleString()}</strong><span>/ ${(count*1000).toLocaleString()}</span></article>
          <article><small>AVG PRECISION</small><strong>${avg}</strong><span>/ 1,000</span></article>
          <article><small>QUESTIONS</small><strong>${count}</strong><span>completed</span></article>
        </div>
        <section class="hud-panel practice-review">
          <div class="panel-title"><span>◫</span><div><small>RUN REVIEW</small><b>Every answer</b></div><strong>NO XP</strong></div>
          ${rows.map((r,i)=>`<div class="practice-review-row"><span>${String(i+1).padStart(2,"0")}</span><div><b>${esc(r.prompt)}</b><small>${categoryGlyph(r.category)} ${esc(r.category)} • You: ${esc(r.your_answer||"—")} • Answer: ${esc(r.correct_answer||"—")}</small></div><strong>${Number(r.score||0)}</strong></div>`).join("")}
        </section>
        <div class="row-actions center practice-finish-actions"><button class="btn practice-btn" data-action="practice-restart">Practice again</button><button class="btn" data-nav="home">Back to hub</button></div>
      </section>`);
  }

  const q = pr.question;
  if (!q) return appShell(`<section class="center-stage"><div class="spinner"></div><h2>Loading your practice round…</h2></section>`);
  const result = pr.result || (q.answered ? q : null);

  if (result) {
    const correct = result.answer_display ?? result.answer_numeric ?? result.answer_text ?? "—";
    const your = result.your_answer ?? result.answer_value ?? "—";
    return appShell(`
      <section class="practice-arena">
        <div class="practice-progress-head"><span class="mode-badge practice-badge">PRACTICE</span><b>QUESTION ${Number(pr.current_index||0)+1} / ${pr.question_count}</b><strong>${Number(pr.total_score||0).toLocaleString()} PTS</strong></div>
        <div class="practice-round-track"><i style="width:${Math.round(((Number(pr.current_index||0)+1)/Math.max(1,pr.question_count))*100)}%"></i></div>
        <section class="hud-panel practice-reveal-card">
          <div class="practice-score-orb"><small>PRECISION</small><strong>${Number(result.score||0)}</strong><span>/ 1000</span></div>
          <div class="practice-reveal-copy"><small>${categoryGlyph(q.category)} ${esc(q.category)} • ${esc(q.difficulty)}</small>${questionTitleFrame(q)}${questionFeedback(q,{allowDelete:true})}
            <div class="practice-answer-compare"><span><small>YOUR GUESS</small><b>${esc(your)} ${esc(q.unit||"")}</b></span><i>→</i><span><small>CORRECT ANSWER</small><b>${esc(correct)} ${esc(q.unit||"")}</b></span></div>
            <p>${esc(result.explanation||q.explanation||"")}</p>
          </div>
        </section>
        <div class="practice-result-actions">
          <button class="btn practice-btn practice-next-btn" data-action="practice-next"><span>${Number(pr.current_index||0)+1>=pr.question_count?"Finish practice":"Next question"}</span><b>→</b></button>
          <div class="practice-no-xp-note"><b>0 XP earned</b><span>Practice scores exist only inside this run.</span></div>
        </div>
        ${q.question_type==="numeric"?`<section class="hud-panel practice-distance-panel"><div class="panel-title"><span>◎</span><div><small>YOUR DISTANCE</small><b>${esc(closenessText(correct,your))}</b></div><strong>${Number(result.score||0)} / 1000</strong></div><div class="practice-distance-chart"><canvas id="practice-closeness-chart"></canvas></div></section>
        <details class="hud-panel community-details" ${Number(pr.community?.total_answers||0)>1?"open":""}><summary><span>⌁</span><div><small>COMMUNITY ANSWERS</small><b>See how everyone else guessed</b></div><strong>${Number(pr.community?.total_answers||0).toLocaleString()} answers</strong></summary><div class="community-chart-wrap"><canvas id="practice-community-chart"></canvas><p>Answers are stored as anonymous aggregate buckets, so this crowd view becomes richer over time without keeping a second analytics record for every player.</p></div></details>`:""}
      </section>`);
  }

  return appShell(`
    <section class="practice-arena">
      <div class="practice-progress-head"><span class="mode-badge practice-badge">PRACTICE</span><b>QUESTION ${Number(pr.current_index||0)+1} / ${pr.question_count}</b><strong>${Number(pr.total_score||0).toLocaleString()} PTS</strong></div>
      <div class="practice-round-track"><i style="width:${Math.round((Number(pr.current_index||0)/Math.max(1,pr.question_count))*100)}%"></i></div>
      <div class="practice-question-meta"><span>${categoryGlyph(q.category)} ${esc(q.category)}</span><span>${esc(q.difficulty)}</span><span>NO TIMER</span></div>
      ${questionTitleFrame(q,{className:"practice-question-title"})}
      ${questionFeedback(q,{allowDelete:true})}
      ${q.context?`<p class="question-context">${esc(q.context)}</p>`:""}
      <form id="practice-answer-form" class="answer-form game-answer-form">
        ${questionInput(q,"practice")}
        ${q.question_type!=="multiple_choice"?`<button class="btn practice-btn lock-btn" type="submit"><span>CHECK MY GUESS</span><b>✓</b></button>`:""}
      </form>
      <div class="practice-no-xp-note"><b>PRACTICE MODE</b><span>Unlimited plays • No XP • No streak changes</span></div>
    </section>`);
}


async function libraryView() {
  const f=state.libraryFilters || {search:"",category:"",difficulty:"any",sort:"new"};
  let rows=[];
  if(isConfigured()) {
    try { rows=await getLibrarySessions(f); }
    catch(e){ console.error(e); }
  }
  state.libraryItems=rows;
  const total=Number(rows[0]?.total_count || rows.length || 0);
  const catOptions=["",...availableCategories()];
  return appShell(`
    <section class="library-head">
      <div><span class="mode-badge cool">REPLAY LIBRARY</span><h1>Play it again.</h1><p>Completed Practice and Party question sets become compact public replays. Pick a pack and run the exact questions yourself — Practice rules, zero XP.</p></div>
      <div class="library-count"><strong>${total.toLocaleString()}</strong><span>public replays</span></div>
    </section>
    <form id="library-filter-form" class="hud-panel library-filter">
      <label class="library-search"><span>⌕</span><input name="search" value="${esc(f.search||"")}" placeholder="Search replay library"></label>
      <select name="category">${catOptions.map(c=>`<option value="${esc(c)}" ${c===(f.category||"")?"selected":""}>${c||"All categories"}</option>`).join("")}</select>
      <select name="difficulty"><option value="any" ${f.difficulty==="any"?"selected":""}>Any difficulty</option><option value="easy" ${f.difficulty==="easy"?"selected":""}>Easy</option><option value="medium" ${f.difficulty==="medium"?"selected":""}>Medium</option><option value="hard" ${f.difficulty==="hard"?"selected":""}>Hard</option></select>
      <select name="sort"><option value="new" ${f.sort==="new"?"selected":""}>Newest</option><option value="popular" ${f.sort==="popular"?"selected":""}>Most played</option></select>
      <button class="btn" type="submit">Filter</button>
    </form>
    ${!isConfigured()?`<div class="hud-panel empty-library"><span>▦</span><h2>Connect Supabase to unlock public replays.</h2><p>The live Replay Library is database-backed and intentionally unavailable in local demo mode.</p></div>`:
      rows.length?`<section class="library-grid">${rows.map(item=>{
        const cover=safeUrl(item.cover_image_url),source=safeUrl(item.cover_image_source_url);
        const cats=(item.categories||[]).slice(0,3);
        return `<article class="library-card">
          <div class="library-cover ${cover?"has-image":""}">${cover?`${mediaImageTag({src:cover,source:item.cover_image_source_url,alt:item.cover_image_alt||item.title,lazy:true})}<div class="media-fallback-card" hidden><span>${categoryGlyph(cats[0]||"Any")}</span><b>Preview unavailable</b></div>`:`<div class="library-cover-glyph">${categoryGlyph(cats[0]||"Any")}</div>`}<span class="library-source">${item.source_kind==="party"?"PARTY REPLAY":"PRACTICE REPLAY"}</span></div>
          <div class="library-card-body"><div class="library-tags">${cats.map(c=>`<span>${categoryGlyph(c)} ${esc(c)}</span>`).join("")}<span>${esc(item.difficulty||"any")}</span></div><h2>${esc(item.title)}</h2><p>${esc(item.description||"Replay this exact question set in Practice Mode.")}</p>
            <div class="library-meta"><span><b>${item.question_count}</b> questions</span><span><b>${Number(item.play_count||0).toLocaleString()}</b> replays</span><span><b>${Number(item.times_generated||1).toLocaleString()}</b> discoveries</span></div>
            <button class="btn practice-btn library-play" data-action="library-play" data-library-id="${esc(item.id)}"><span>REPLAY SESSION</span><b>→</b></button>
            ${source?`<a class="library-credit" href="${esc(source)}" target="_blank" rel="noopener">${esc(item.cover_image_attribution||"Image source")}${item.cover_image_license?` · ${esc(item.cover_image_license)}`:""}</a>`:""}
          </div>
        </article>`;
      }).join("")}</section>`:`<div class="hud-panel empty-library"><span>⌕</span><h2>No replay packs match that filter.</h2><p>Complete a Practice or Party session and it will automatically become a reusable public pack.</p><button class="btn practice-btn" data-nav="practice-setup">Create one in Practice</button></div>`}
  `);
}

async function librarySearch(e){
  e.preventDefault();
  const data=new FormData(e.currentTarget);
  state.libraryFilters={search:String(data.get("search")||"").trim(),category:String(data.get("category")||""),difficulty:String(data.get("difficulty")||"any"),sort:String(data.get("sort")||"new")};
  await navigate("library");
}

async function libraryPlay(id){
  if(!id) return;
  if(!isConfigured()){toast("Connect Supabase to replay public sessions.","bad");return;}
  if(!state.session){
    sessionStorage.setItem("pending_library",id);
    toast("Sign in with Google to start this replay.");
    try{await signInGoogle();}catch(e){reportError(e)}
    return;
  }
  if(!beginAction("library-play")) return;
  try{
    const session=await startLibraryPractice(id);
    if(!session) throw new Error("Replay could not be started.");
    const q=await getPracticeQuestion(session.session_id);
    if(!q) throw new Error("Replay question could not be loaded.");
    state.practice={...session,session_id:session.session_id,question:q,result:q?.answered?q:null,summary:[],from_library:id,community:null};
    if(q?.answered && q.question_type==="numeric") state.practice.community=await getQuestionCommunityStats(q.id);
    answerStartedAt=performance.now();
    await navigate("practice");
  }catch(e){reportError(e,"That replay couldn't be started. Please try another session.");}
  finally{endAction("library-play");}
}

async function leaderboardView() {
  let rows = [];
  if (!isConfigured()) {
    rows = [
      {username:"Nova",xp:18400,wins:42,games_played:87},{username:"Quasar",xp:16120,wins:36,games_played:91},
      {username:"MetricMind",xp:14950,wins:31,games_played:72},{username:"EstimateThis",xp:12220,wins:24,games_played:68},
      {username:"FermiFan",xp:10980,wins:19,games_played:56}
    ];
  } else {
    try { rows = await loadLeaderboard(); } catch(e) { reportError(e); }
  }
  return appShell(`
    <section class="game-screen-head rank-head"><div><div class="mode-badge hot">GLOBAL LADDER</div><h1>Hall of guesses</h1><p>Lifetime XP decides who owns the top of the board.</p></div><div class="screen-number">♛</div></section>
    <section class="leader-shell">
      <div class="top-three">${rows.slice(0,3).map((r,i)=>`<article class="champ-card c${i+1}"><span class="champ-rank">#${i+1}</span><span class="leader-avatar">${r.avatar_url?`<img src="${esc(r.avatar_url)}">`:esc(initials(r.username))}</span><b>${esc(r.username)}</b><small>LEVEL ${levelFromXp(r.xp)}</small><strong>${Number(r.xp||0).toLocaleString()} XP</strong><em>${r.wins||0} wins</em></article>`).join("")}</div>
      <section class="hud-panel leaderboard game-leaderboard"><div class="leader-table-head"><span>RANK</span><span>PLAYER</span><span>LEVEL</span><span>WINS</span><span>XP</span></div>${rows.slice(3).map((r,i)=>`<div class="leader-row"><span class="place">${i+4}</span><span class="leader-avatar">${r.avatar_url?`<img src="${esc(r.avatar_url)}">`:esc(initials(r.username))}</span><div><b>${esc(r.username)}</b><small>${r.games_played||0} matches</small></div><span class="level-square">${levelFromXp(r.xp)}</span><span>${r.wins||0}</span><strong>${Number(r.xp||0).toLocaleString()}</strong></div>`).join("")}</section>
    </section>`);
}


function experienceSettingsMarkup(){
  const e=getExperiencePrefs();
  return `<section class="hud-panel player-settings-panel experience-settings">
    <div class="settings-copy"><small>GAME FEEL</small><h2>Sound & motion</h2><p>V2 Nova Arena uses synthesized UI audio, haptics, particles and motion. Tune it without affecting gameplay.</p></div>
    <div class="experience-controls">
      <label class="experience-toggle"><input id="exp-sfx" type="checkbox" ${e.sfx?"checked":""}><span></span><b>Sound FX</b><small>UI, lock-in, reveal and victory cues</small></label>
      <label class="experience-toggle"><input id="exp-motion" type="checkbox" ${e.motion?"checked":""}><span></span><b>Motion FX</b><small>Card depth, particles and transitions</small></label>
      <label class="experience-toggle"><input id="exp-haptics" type="checkbox" ${e.haptics?"checked":""}><span></span><b>Haptics</b><small>Supported phones only</small></label>
      <label class="experience-volume"><span>FX VOLUME</span><input id="exp-volume" type="range" min="0" max="100" value="${Math.round(e.volume*100)}"><b id="exp-volume-label">${Math.round(e.volume*100)}%</b></label>
    </div>
  </section>`;
}

function profileView() {
  if (!state.session && isConfigured()) return appShell(`<section class="auth-gate player-gate"><div class="victory-burst"><span>☺</span></div><div class="mode-badge">PLAYER PROFILE</div><h1>Keep your progress.</h1><p>Google sign-in creates your player card from your Google name and avatar. You can change the display name anytime.</p><button class="btn primary launch-btn" data-action="login"><span>SIGN IN WITH GOOGLE</span><b>G</b></button></section>`);
  const p = state.profile || demo?.profile || {username:"Demo Player",xp:0,wins:0,games_played:0,daily_streak:0};
  const l = xpToNextLevel(p.xp);
  const googleName = state.session?.user?.user_metadata?.full_name || state.session?.user?.user_metadata?.name || p.username;
  const avatar = p.avatar_url || state.session?.user?.user_metadata?.avatar_url || state.session?.user?.user_metadata?.picture || "";
  return appShell(`
    <section class="profile-game-card">
      <div class="profile-banner"><div class="profile-avatar-xl">${avatar?`<img src="${esc(avatar)}">`:esc(initials(p.username))}<span>${l.level}</span></div><div><small>PLAYER CARD</small><h1>${esc(p.username)}</h1><p>${state.session?`Google profile: ${esc(googleName)}`:"Local demo profile"}</p></div><div class="profile-power"><small>LIFETIME XP</small><b>${Number(p.xp||0).toLocaleString()}</b></div></div>
      <div class="profile-progress"><div><span>LEVEL ${l.level}</span><b>${l.needed.toLocaleString()} XP TO LEVEL ${l.level+1}</b></div><div class="xpbar large"><i style="width:${Math.round(l.progress*100)}%"></i></div></div>
      <div class="stats-grid game-stats"><div><span>♛</span><small>WINS</small><strong>${p.wins||0}</strong></div><div><span>▶</span><small>MATCHES</small><strong>${p.games_played||0}</strong></div><div><span>🔥</span><small>STREAK</small><strong>${p.daily_streak||0}</strong></div><div><span>⚡</span><small>LEVEL</small><strong>${l.level}</strong></div></div>
    </section>
    <form id="profile-form" class="hud-panel profile-form game-profile-form"><div><small>DISPLAY NAME</small><h3>How should the arena know you?</h3><p>We start with your Google name. Changing this only changes your trivia display name.</p></div><label><span>PLAYER NAME</span><input name="username" maxlength="24" value="${esc(p.username)}"></label><button class="btn primary" type="submit">Save name</button></form>
    <section class="hud-panel player-settings-panel">
      <div class="settings-copy"><small>PLAYER SETTINGS</small><h2>Interface theme</h2><p>Switch anytime. V1 preserves the original card-based launch UI; V2 Nova Arena is a completely different full-screen game command experience. Gameplay and progress never change.</p></div>
      <div class="theme-choice-grid">
        <button type="button" class="theme-choice ${currentUiTheme()==="v1"?"selected":""}" data-theme-choice="v1"><span class="theme-preview preview-v1"><i></i><i></i><i></i></span><b>V1 Classic</b><small>Original dark game HUD</small><em>${currentUiTheme()==="v1"?"ACTIVE":"SELECT"}</em></button>
        <button type="button" class="theme-choice ${currentUiTheme()==="v2"?"selected":""}" data-theme-choice="v2"><span class="theme-preview preview-v2"><i></i><i></i><i></i></span><b>V2 Nova Arena</b><small>Full-screen game command interface</small><em>${currentUiTheme()==="v2"?"ACTIVE":"SELECT"}</em></button>
      </div>
    </section>
    ${experienceSettingsMarkup()}
    <div class="row-actions profile-actions">${p.is_admin?`<a class="btn" href="/triviaadmin/"><span>⚙</span> Admin dashboard</a>`:""}${state.session?`<button class="btn danger-soft" data-action="logout">Sign out</button>`:`<button class="btn primary" data-action="login">Connect Google to save this player</button>`}</div>
  `);
}

function howView() {
  return appShell(`
    <section class="game-screen-head"><div><div class="mode-badge cool">HOW TO PLAY</div><h1>Close counts here.</h1><p>Trivia for people who like making a smart guess instead of memorizing everything.</p></div><div class="screen-number">?</div></section>
    <section class="rule-cards">
      <article><span>01</span><i>◎</i><h3>Make the guess</h3><p>Numeric questions are designed for estimation. You never need the exact number to score.</p></article>
      <article><span>02</span><i>⚡</i><h3>Earn precision</h3><p>Every answer earns 0–1,000 points based on closeness, including huge Fermi-scale values.</p></article>
      <article><span>03</span><i>⌁</i><h3>See the crowd</h3><p>After reveal, the distribution shows your guess, the room, and the real answer.</p></article>
      <article><span>04</span><i>♛</i><h3>Climb forever</h3><p>XP powers a persistent Level 0+ player profile across daily quests and multiplayer.</p></article>
    </section>
    <section class="hud-panel long-copy network-explainer"><span class="stream-icon">◈</span><div><small>BIG ROOM TECH</small><h2>Party mode when it's 8 friends. Event mode when it's 8,000 viewers.</h2><p>Standard rooms favor rich realtime updates. Event rooms deliberately reduce per-player fan-out so stream audiences can submit without turning every individual answer into a room-wide event.</p></div></section>`);
}

function overlayView(code) {
  document.body.classList.add("overlay-mode");
  $("#app").innerHTML = `<div class="overlay-card"><div class="overlay-brand"><span>?</span>${esc(state.config.appName||"Trivia")}</div><div class="overlay-label">JOIN LIVE</div><div class="overlay-code">${esc(code)}</div><div class="overlay-url">whatmod.com/trivia</div><div id="overlay-status">Waiting for game…</div></div>`;
  if (isConfigured()) {
    getLobby(code).then(g => {
      if (!g) return;
      $("#overlay-status").textContent = `${g.title||"Trivia"} · ${g.player_count||0} playing`;
      subscribeLobby(g.id, async()=> {
        const fresh = await getLobby(code); if (fresh) $("#overlay-status").textContent = `${fresh.title||"Trivia"} · ${fresh.player_count||0} playing · ${fresh.status}`;
      });
    }).catch(()=>{});
  }
}

async function sendPresenceHeartbeat() {
  if (!state.session?.user || !isConfigured()) return;
  const gameId = state.view === "lobby" ? (state.lobby?.id || null) : null;
  await touchTriviaPresence(state.view || "home", gameId, presenceClientId);
}
function startPresenceHeartbeat() {
  clearInterval(presenceHeartbeatTimer);
  if (!state.session?.user || !isConfigured()) return;
  sendPresenceHeartbeat().catch(()=>{});
  presenceHeartbeatTimer = setInterval(()=>{ if(document.visibilityState === 'visible') sendPresenceHeartbeat().catch(()=>{}); }, 50000);
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState === "visible") sendPresenceHeartbeat().catch(()=>{}); });

function demoInit() {
  demo = {
    profile: { user_id:"demo", username:"Demo Player", avatar_url:"", xp:0, wins:0, games_played:0, daily_streak:0, username_customized:false, ui_theme:storedUiTheme() },
    lobby: null
  };
  if (!isConfigured()) state.profile = demo.profile;
}

async function navigate(view, opts={}) {
  stopPhaseTimers();
  const leavingLobby = state.view === "lobby" && view !== "lobby";
  if (leavingLobby) { stopLobbySync(); cleanupRealtime(); }
  state.view = view;
  if (view === "home") $("#app").innerHTML = homeView();
  else if (view === "create") $("#app").innerHTML = createView(opts.event);
  else if (view === "board-setup") $("#app").innerHTML = boardSetupView();
  else if (view === "lobby") $("#app").innerHTML = lobbyView();
  else if (view === "daily") $("#app").innerHTML = dailyView();
  else if (view === "practice-setup") $("#app").innerHTML = practiceSetupView();
  else if (view === "matchmaking-setup") $("#app").innerHTML = matchmakingSetupView();
  else if (view === "practice") $("#app").innerHTML = practiceView();
  else if (view === "library") $("#app").innerHTML = await libraryView();
  else if (view === "leaderboard") $("#app").innerHTML = await leaderboardView();
  else if (view === "profile") $("#app").innerHTML = profileView();
  else if (view === "how") $("#app").innerHTML = howView();
  bind();
  postRender();
  sendPresenceHeartbeat().catch(()=>{});
}

function bind() {
  $$("[data-nav]").forEach(el => el.onclick = () => navigate(el.dataset.nav, {event:el.dataset.mode==="event"}));
  $$("[data-copy]").forEach(el => el.onclick = async() => { await navigator.clipboard.writeText(el.dataset.copy); toast("Copied"); });
  $$("[data-action]").forEach(el => {
    const a = el.dataset.action;
    if (a==="login") el.onclick = async()=>{ try{ await signInGoogle(); }catch(e){reportError(e)} };
    if (a==="logout") el.onclick = async()=>{ stopLobbySync(); clearInterval(presenceHeartbeatTimer); await signOut(); navigate("home"); };
    if (a==="daily") el.onclick = openDaily;
    if (a==="practice-next") el.onclick = practiceNext;
    if (a==="practice-restart") el.onclick = ()=>{ state.practice=null; navigate("practice-setup"); };
    if (a==="library-play") el.onclick = ()=> libraryPlay(el.dataset.libraryId);
    if (a==="quick-join") el.onclick = ()=> quickJoin($("#quick-code")?.value);
    if (a==="matchmake") el.onclick = ()=>navigate("matchmaking-setup");
    if (a==="board-auto-categories") el.onclick = autoPickBoardCategories;
    if (a==="board-buzz") el.onclick = boardBuzzAction;
    if (a==="board-close-clue") el.onclick = boardCloseClueAction;
    if (a==="return-lobby") el.onclick = returnMatchToLobby;
    if (a==="start-game") el.onclick = hostStart;
    if (a==="reveal-round") el.onclick = hostReveal;
    if (a==="next-round") el.onclick = hostNext;
    if (a==="twitch-connect") el.onclick = ()=>{try{connectTwitch()}catch(e){reportError(e)}};
    if (a==="twitch-disconnect") el.onclick = ()=>{disconnectTwitch();navigate("lobby")};
    if (a==="twitch-announce") el.onclick = async()=>{try{await announceLobby(state.lobby.code);toast("Lobby posted to Twitch chat")}catch(e){reportError(e)}};
    if (a==="twitch-listen") el.onclick = async()=>{try{await listenToTwitchChat(()=>navigate("lobby"));toast("Listening for !trivia and !join")}catch(e){reportError(e)}};
    if (a==="admin-delete-question") el.onclick = ()=> adminDeleteCurrentQuestion(el.dataset.questionId);
  });
  $("#create-form")?.addEventListener("submit", createSubmit);
  $("#board-setup-form")?.addEventListener("submit", createBoardSubmit);
  $("#board-wager-form")?.addEventListener("submit", boardWagerSubmit);
  $("#board-final-wager-form")?.addEventListener("submit", boardFinalWagerSubmit);
  $$(".board-answer-form").forEach(form=>form.addEventListener("submit",boardAnswerSubmit));
  $$("[data-board-cell]").forEach(btn=>btn.onclick=()=>boardSelectCellAction(btn.dataset.boardCell));
  $$("[data-board-answer]").forEach(btn=>btn.onclick=()=>boardAnswerSubmitValue(btn.dataset.boardAnswer,{final:btn.dataset.boardFinal==="1"}));
  $$('#board-setup-form input[name="categories"]').forEach(box=>box.addEventListener("change",()=>{if(box.checked&&$$('#board-setup-form input[name="categories"]:checked').length>6){box.checked=false;toast("Board Battle uses exactly six categories.","bad");}refreshBoardCategoryPicker();}));
  if($("#board-setup-form")) refreshBoardCategoryPicker();
  $("#daily-form")?.addEventListener("submit", dailySubmit);
  $("#practice-setup-form")?.addEventListener("submit", practiceStart);
  $("#matchmaking-setup-form")?.addEventListener("submit", startMatchmaking);
  if($("#matchmaking-setup-form")){ $("#matchmaking-setup-form").category?.addEventListener("change",updateMatchmakingDifficultyAvailability); updateMatchmakingDifficultyAvailability(); }
  $("#practice-answer-form")?.addEventListener("submit", practiceSubmit);
  $("#library-filter-form")?.addEventListener("submit", librarySearch);
  $("#answer-form")?.addEventListener("submit", gameSubmit);
  $("#profile-form")?.addEventListener("submit", profileSubmit);
  $$('[data-theme-choice]').forEach(b => b.onclick = () => chooseUiTheme(b.dataset.themeChoice));
  const sfxToggle=$("#exp-sfx"),motionToggle=$("#exp-motion"),hapticToggle=$("#exp-haptics"),volume=$("#exp-volume");
  if(sfxToggle) sfxToggle.onchange=()=>{setExperiencePrefs({sfx:sfxToggle.checked});if(sfxToggle.checked)playSfx("success")};
  if(motionToggle) motionToggle.onchange=()=>{setExperiencePrefs({motion:motionToggle.checked});navigate("profile")};
  if(hapticToggle) hapticToggle.onchange=()=>setExperiencePrefs({haptics:hapticToggle.checked});
  if(volume) volume.oninput=()=>{const v=Number(volume.value)/100;setExperiencePrefs({volume:v});const l=$("#exp-volume-label");if(l)l.textContent=`${volume.value}%`};
  $$('[data-exp-sound]').forEach(b=>b.onclick=()=>{const e=getExperiencePrefs();setExperiencePrefs({sfx:!e.sfx});toast(!e.sfx?"Sound FX enabled":"Sound FX muted");if(!e.sfx)playSfx("select")});
  bindGameFeel();
  $$(".choice").forEach(b => b.onclick = () => {
    $$(".choice").forEach(x=>x.classList.remove("selected")); b.classList.add("selected");
    const form = b.closest("form"); form.dataset.choice = b.dataset.answer;
    if (form.id==="answer-form") gameSubmit(new Event("submit"));
    if (form.id==="practice-answer-form") practiceSubmit(new Event("submit"));
  });
  $$('[data-question-vote]').forEach(b=>b.onclick=()=>castQuestionVote(b.dataset.questionId,Number(b.dataset.questionVote)));
}


let lastExperienceCue="";
function runExperienceCue(){
  let key="",sound="";
  if(state.view==="daily"&&state.daily?.result){key=`daily:${state.daily.question?.id}:${state.daily.result.score}`;sound=Number(state.daily.result.score||0)>=800?"success":"reveal";if(Number(state.daily.result.score||0)>=900)celebrate(key,1.2)}
  else if(state.view==="practice"&&state.practice?.result){key=`practice:${state.practice.session_id||"demo"}:${state.practice.current_index}:result`;sound="reveal"}
  else if(state.view==="lobby"&&state.lobby?.experience_mode==="board"&&state.boardGame?.phase==="reveal"){key=`board:${state.lobby.id}:${state.boardGame.active_cell_id}:reveal`;sound="reveal"}
  else if(state.view==="lobby"&&state.lobby?.experience_mode==="board"&&state.boardGame?.phase==="finished"){key=`board:${state.lobby.id}:finished`;sound="win";celebrate(key,1.8)}
  else if(state.view==="lobby"&&state.lobby?.status==="results"){key=`lobby:${state.lobby.id}:${state.lobby.current_question_index}:results`;sound="reveal"}
  else if(state.view==="lobby"&&state.lobby?.status==="finished"){key=`lobby:${state.lobby.id}:finished`;sound="win";celebrate(key,1.8)}
  if(key&&key!==lastExperienceCue){lastExperienceCue=key;setTimeout(()=>playSfx(sound),90)}
}

function postRender() {
  wireMediaFallbacks();
  hydrateQuestionVoteWidgets();
  applyExperiencePrefs();
  enhanceV2(document);
  runExperienceCue();
  if (state.view === "daily" && state.daily?.result) {
    requestAnimationFrame(()=>{
      const answer=state.daily.result.answer_numeric ?? state.daily.question?.answer_numeric;
      const guess=state.daily.result.your_answer;
      if(state.daily.community) renderCommunityHistogram($("#daily-chart"),state.daily.community,answer,guess);
      else renderGuessHistogram($("#daily-chart"),state.daily.result.guesses||[],answer,guess);
    });
  }
  if (state.view === "practice" && state.practice?.result && state.practice?.question?.question_type === "numeric") {
    requestAnimationFrame(()=>{
      const pr=state.practice,q=pr.question,r=pr.result;
      const answer=Number(r.answer_numeric ?? q.answer_numeric),guess=Number(r.your_answer ?? r.answer_value);
      renderClosenessScale($("#practice-closeness-chart"),answer,guess);
      renderCommunityHistogram($("#practice-community-chart"),pr.community || {total_answers:0,histogram:new Array(41).fill(0),bucket_min:-4,bucket_max:4,bucket_step:.2},answer,guess,true);
    });
  }
  if (state.view === "lobby" && state.lobby?.status === "results") {
    requestAnimationFrame(()=>{
      const rows=state.roundResults||[]; const me=rows.find(x=>x.is_me);
      renderGuessHistogram($("#guess-chart"), rows.map(x=>x.answer_numeric).filter(x=>x!=null), state.currentQuestion?.answer_numeric, me?.answer_numeric);
    });
  }
  if (state.view === "lobby" && state.lobby?.experience_mode === "board") {
    if(state.boardGame?.phase && state.boardGame.phase!=="board") startBoardPhaseTimer();
    return;
  }
  if (state.view === "lobby" && state.lobby?.status === "question") startTimer();
  if (state.view === "lobby" && state.lobby?.status === "results") startResultsTimer();
  if (state.view === "lobby" && state.lobby?.status === "finished") startFinishedTimer();
}

async function hydrateQuestionVoteWidgets() {
  if(!state.session || !isConfigured()) return;
  const widgets=$$('[data-question-feedback]');
  await Promise.all(widgets.map(async widget=>{
    const questionId=widget.dataset.questionFeedback;
    try{
      const summary=await getQuestionVoteSummary(questionId);
      paintQuestionVoteWidget(widget,summary);
    }catch(error){ console.warn("Question vote summary unavailable",error); }
  }));
}

function paintQuestionVoteWidget(widget,summary={}) {
  if(!widget)return;
  const up=widget.querySelector('[data-vote-up]'),down=widget.querySelector('[data-vote-down]');
  if(up)up.textContent=Number(summary?.upvotes||0).toLocaleString();
  if(down)down.textContent=Number(summary?.downvotes||0).toLocaleString();
  widget.querySelectorAll('[data-question-vote]').forEach(btn=>{
    btn.classList.toggle('selected',Number(btn.dataset.questionVote)===Number(summary?.my_vote||0));
  });
}

async function castQuestionVote(questionId,vote) {
  if(!questionId || !state.session)return;
  const key=`vote:${questionId}`;
  if(!beginAction(key))return;
  const widgets=$$(`[data-question-feedback="${CSS.escape(questionId)}"]`);
  widgets.forEach(w=>w.querySelectorAll('[data-question-vote]').forEach(b=>b.disabled=true));
  try{
    const summary=await voteQuestion(questionId,vote);
    widgets.forEach(w=>paintQuestionVoteWidget(w,summary));
  }catch(error){ reportError(error,"Your vote could not be saved."); }
  finally{widgets.forEach(w=>w.querySelectorAll('[data-question-vote]').forEach(b=>b.disabled=false));endAction(key)}
}

async function adminDeleteCurrentQuestion(questionId) {
  if(!state.profile?.is_admin || !questionId)return;
  if(!confirm("Delete this question from the active bank? Any live Party or Practice session using it will immediately skip it. The record is retained only as an audit tombstone."))return;
  const key=`admin-delete:${questionId}`;
  if(!beginAction(key))return;
  try{
    const result=await adminDeleteQuestion(questionId,"Removed during live gameplay",state.view==="practice"?state.practice?.session_id:null);
    toast(`Question removed • ${Number(result?.games_touched||0)} live game(s) and ${Number(result?.practices_touched||0)} practice session(s) updated.`);
    if(state.view==="lobby" && state.lobby?.code){ await refreshLobby(state.lobby.code,0); return; }
    if(state.view==="practice" && state.practice?.session_id){
      const pr=state.practice;
      const q=await getPracticeQuestion(pr.session_id);
      if(q){
        pr.current_index=q.ordinal;pr.question_count=q.question_count;pr.total_score=q.total_score;pr.status=q.status;pr.question=q;pr.result=q.answered?q:null;
        pr.community=(q.answered&&q.question_type==="numeric")?await getQuestionCommunityStats(q.id):null;
      }else{
        pr.status="completed";pr.question_count=Math.max(0,Number(pr.question_count||1)-1);pr.summary=await getPracticeSummary(pr.session_id);
      }
      await navigate("practice");
    }
  }catch(error){reportError(error,"The question could not be removed.");}
  finally{endAction(key)}
}

async function requireAuthOrDemo() {
  if (state.session) return true;
  if (!isConfigured()) return true;
  toast("Sign in with Google to play multiplayer.","bad"); return false;
}

async function openDaily() {
  state.view="daily"; state.daily=null; $("#app").innerHTML=appShell(`<section class="center-stage"><div class="spinner"></div><h2>Loading today's challenge…</h2></section>`);
  try {
    if (!isConfigured()) {
      const dayKey = new Date().toISOString().slice(0,10);
      const day = Math.floor(Date.now()/86400000);
      const q = {...SAMPLE[day % SAMPLE.length], daily_number: day-20000};
      const savedRaw = localStorage.getItem(`trivia_demo_daily_${dayKey}`);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        state.daily={question:q,result:saved,community:saved.community||demoCommunityStats(q.answer_numeric)};
      } else {
        state.daily={question:q};
      }
      answerStartedAt=performance.now(); await navigate("daily");
    } else {
      if (!state.session) { toast("Sign in with Google to play the Daily Quest.","bad"); return navigate("home"); }
      const d=await getDailyState();
      if (!d) throw new Error("No daily question configured.");
      const q={
        id:d.id,daily_number:d.daily_number,category:d.category,difficulty:d.difficulty,
        question_type:d.question_type,prompt:d.prompt,context:d.context,unit:d.unit,options:d.options,
        image_url:d.image_url,image_alt:d.image_alt,image_source_url:d.image_source_url,image_attribution:d.image_attribution,
        image_license:d.image_license,image_license_url:d.image_license_url
      };
      state.daily={question:q,community:null};
      if (d.already_played) {
        state.daily.result={
          score:d.score,xp_awarded:d.xp_awarded,your_answer:d.your_answer,
          answer_numeric:d.answer_numeric,answer_text:d.answer_text,answer_display:d.answer_display,
          explanation:d.explanation,already_played:true
        };
        if(q.question_type==="numeric") state.daily.community=await getQuestionCommunityStats(q.id);
      }
      answerStartedAt=performance.now(); await navigate("daily");
    }
  } catch(e){ reportError(e); navigate("home");}
}

async function dailySubmit(e) {
  e?.preventDefault();
  if (!beginAction("daily-submit")) return;
  const q=state.daily?.question;
  const form=$("#daily-form");
  const value=q.question_type==="multiple_choice"?form.dataset.choice:$("#daily-answer")?.value;
  if (value===""||value==null){toast("Enter an answer first.","bad");endAction("daily-submit");return}
  try {
    if (!isConfigured()) {
      const dayKey = new Date().toISOString().slice(0,10);
      if (localStorage.getItem(`trivia_demo_daily_${dayKey}`)) { toast("Today's Daily Quest is already complete.","bad"); return openDaily(); }
      const score=numericScore(value,q.answer_numeric), xp=xpForScore(score,{daily:true});
      demo.profile.xp+=xp; demo.profile.daily_streak++;
      const spread=Array.from({length:68},()=>q.answer_numeric*Math.pow(10,(Math.random()-.5)*1.4));
      const community=demoCommunityStats(q.answer_numeric);
      const result={score,xp_awarded:xp,your_answer:Number(value),answer_numeric:q.answer_numeric,explanation:q.explanation,guesses:spread,community,already_played:true};
      localStorage.setItem(`trivia_demo_daily_${dayKey}`, JSON.stringify(result));
      state.daily.result=result; state.daily.community=community;
      state.profile=demo.profile; await navigate("daily");
    } else {
      const r=await submitDailyAnswer(value); state.daily.result=r; if(q.question_type==="numeric") state.daily.community=await getQuestionCommunityStats(q.id); await loadProfile(); await navigate("daily");
    }
  } catch(err){ reportError(err, "Your Daily answer couldn't be saved. Please try again."); }
  finally { endAction("daily-submit"); }
}


function demoPracticeQuestion(pr) {
  const q = pr.questions[pr.current_index];
  return q ? {...q, ordinal:pr.current_index, answered:false} : null;
}

async function practiceStart(e) {
  e.preventDefault();
  if (!beginAction("practice-start")) return;
  const submitButton=e.currentTarget?.querySelector('button[type="submit"]');
  if(submitButton) submitButton.disabled=true;
  try {
    const f = new FormData(e.currentTarget);
    const categories = f.getAll("categories");
    const questionCount = Number(f.get("questionCount") || 10);
    const difficulty = String(f.get("difficulty") || "any");
    if (!categories.length) { toast("Choose at least one practice category.","bad"); return; }

    if (!isConfigured()) {
      let pool = SAMPLE.filter(q=>categories.includes(q.category) && (difficulty==="any" || q.difficulty===difficulty));
      if (!pool.length) pool = SAMPLE.filter(q=>categories.includes(q.category));
      if (!pool.length) throw new Error("No demo questions match those categories.");
      const shuffled=[...pool].sort(()=>Math.random()-.5);
      const questions=[];
      while (questions.length<questionCount) questions.push({...shuffled[questions.length%shuffled.length],id:`${shuffled[questions.length%shuffled.length].id}-${questions.length}`});
      state.practice={demo:true,questions,question_count:questionCount,current_index:0,total_score:0,status:"active",result:null,summary:[],community:null};
      state.practice.question=demoPracticeQuestion(state.practice);
      answerStartedAt=performance.now();
      await navigate("practice");
      return;
    }
    if (!state.session) { toast("Sign in with Google to use Practice on the live site.","bad"); return; }
    const session=await startPractice({categories,difficulty,questionCount});
    if (!session) throw new Error("Practice session could not be created.");
    const q=await getPracticeQuestion(session.session_id);
    if (!q) throw new Error("Practice question could not be loaded.");
    state.practice={...session,session_id:session.session_id,question:q,result:q?.answered?q:null,summary:[],community:null};
    if(q?.answered && q.question_type==="numeric") state.practice.community=await getQuestionCommunityStats(q.id);
    answerStartedAt=performance.now();
    await navigate("practice");
  } catch(err){ reportError(err, "Practice couldn't start. Please try again."); }
  finally {
    endAction("practice-start");
    if(submitButton?.isConnected) submitButton.disabled=false;
  }
}

async function practiceSubmit(e) {
  e?.preventDefault();
  if (!beginAction("practice-submit")) return;
  const pr=state.practice, q=pr?.question, form=$("#practice-answer-form");
  if(!pr||!q||pr.result){ endAction("practice-submit"); return; }
  const value=q.question_type==="multiple_choice"?form?.dataset.choice:$("#practice-answer")?.value;
  if(value==null||value===""){toast("Enter a guess first.","bad");endAction("practice-submit");return}
  form?.querySelectorAll("input,button").forEach(el=>el.disabled=true);
  try {
    if (pr.demo) {
      let score=0, correct, your=value;
      if(q.question_type==="numeric"){score=numericScore(value,q.answer_numeric);correct=q.answer_numeric;}
      else if(q.question_type==="multiple_choice"){score=String(value)===String(q.correct_option)?1000:0;correct=q.options?.[q.correct_option];your=q.options?.[Number(value)]??value;}
      else {score=String(value).trim().toLowerCase()===String(q.answer_text).trim().toLowerCase()?1000:0;correct=q.answer_text;}
      const result={score,your_answer:your,answer_numeric:q.answer_numeric,answer_text:q.answer_text,answer_display:correct,explanation:q.explanation};
      pr.total_score+=score; pr.result=result; pr.community=q.question_type==="numeric"?demoCommunityStats(q.answer_numeric):null;
      pr.summary.push({prompt:q.prompt,category:q.category,score,your_answer:String(your),correct_answer:String(correct??"—")});
      await navigate("practice");
      return;
    }
    const result=await submitPracticeAnswer(pr.session_id,value,performance.now()-answerStartedAt);
    if (!result) throw new Error("Practice answer was not saved.");
    pr.result=result;
    pr.total_score=result.total_score;
    pr.community=q.question_type==="numeric"?await getQuestionCommunityStats(q.id):null;
    await navigate("practice");
  } catch(err){ reportError(err, "Your practice answer couldn't be saved. Please try again."); }
  finally {
    endAction("practice-submit");
    if(form?.isConnected && !pr?.result) form.querySelectorAll("input,button").forEach(el=>el.disabled=false);
  }
}

async function practiceNext() {
  if (!beginAction("practice-next")) return;
  const pr=state.practice;
  const nextButton=document.querySelector('[data-action="practice-next"]');
  if(nextButton) nextButton.disabled=true;
  try{
    if(!pr) { await navigate("practice-setup"); return; }
    if(!pr.result && !pr.question?.answered){ toast("Lock in your answer before continuing.","bad"); return; }

    if(pr.demo){
      if(pr.current_index+1>=pr.question_count){
        pr.status="completed"; await navigate("practice"); return;
      }
      pr.current_index++; pr.question=demoPracticeQuestion(pr); pr.result=null; pr.community=null; answerStartedAt=performance.now();
      await navigate("practice");
      return;
    }

    const s=await nextPracticeQuestion(pr.session_id);
    if(!s) throw new Error("Practice state could not be advanced.");
    pr.current_index=s.current_index; pr.question_count=s.question_count; pr.total_score=s.total_score; pr.status=s.status; pr.result=null; pr.community=null;
    if(s.status==="completed"){
      pr.summary=await getPracticeSummary(pr.session_id);
      await navigate("practice");
      return;
    }
    pr.question=await getPracticeQuestion(pr.session_id);
    if(!pr.question) throw new Error("The next practice question could not be loaded.");
    pr.result=pr.question?.answered?pr.question:null;
    if(pr.result && pr.question.question_type==="numeric") pr.community=await getQuestionCommunityStats(pr.question.id);
    answerStartedAt=performance.now();
    await navigate("practice");
  }catch(err){
    reportError(err, "Practice couldn't move to the next question. Refresh and try again.");
    // Re-sync the current server state after a failed transition whenever possible.
    if(pr && !pr.demo && pr.session_id){
      try {
        const q=await getPracticeQuestion(pr.session_id);
        if(q){ pr.current_index=q.ordinal; pr.question_count=q.question_count; pr.total_score=q.total_score; pr.status=q.status; pr.question=q; pr.result=q.answered?q:null; pr.community=(q.answered&&q.question_type==="numeric")?await getQuestionCommunityStats(q.id):null; }
      } catch(syncError) { console.warn("Practice re-sync failed",syncError); }
    }
  } finally {
    endAction("practice-next");
    if(nextButton?.isConnected) nextButton.disabled=false;
  }
}

async function createBoardSubmit(e){
  e.preventDefault();
  if(!beginAction("create-board-lobby")) return;
  try{
    if(!(await requireAuthOrDemo())) return;
    if(!isConfigured()){ toast("Board Battle requires the live Supabase backend.","bad"); return; }
    const fd=new FormData(e.currentTarget);
    const categories=fd.getAll("categories").map(String).filter(Boolean);
    if(categories.length!==6 || new Set(categories).size!==6){ toast("Choose exactly six different categories.","bad"); return; }
    if((state.categories||[]).length){
      const counts=categories.map(categoryCount);
      if(counts.some(x=>Number(x||0)<5)){toast("Every Board Battle category needs at least 5 active questions.","bad");return;}
      if(counts.reduce((sum,x)=>sum+Number(x||0),0)<31){toast("Those six categories need at least 31 total questions so Final gets a fresh clue.","bad");return;}
    }
    const settings={categories,maxPlayers:Number(fd.get("maxPlayers")||6),secondsPerQuestion:Number(fd.get("secondsPerQuestion")||15),title:String(fd.get("title")||"").trim(),visibility:String(fd.get("visibility")||"invite_only")};
    const g=await createBoardLobby(settings);
    if(!g?.code) throw new Error("Board lobby did not return a code.");
    await enterLobby(g.code);
  }catch(error){ reportError(error,"The Board Battle lobby couldn't be created."); }
  finally{ endAction("create-board-lobby"); }
}

function refreshBoardCategoryPicker(){
  const form=$("#board-setup-form"); if(!form)return;
  const boxes=$$('input[name="categories"]',form);
  const checked=boxes.filter(x=>x.checked);
  boxes.forEach(box=>{
    const label=box.closest('.board-category-option');
    label?.classList.toggle('selected',box.checked);
    const mark=label?.querySelector('i'); if(mark)mark.textContent=box.checked?'✓':'+';
    box.disabled=!box.checked&&checked.length>=6;
  });
  const counter=$("#board-category-count"); if(counter)counter.textContent=String(checked.length);
  const button=$("#board-create-button"); if(button)button.disabled=checked.length!==6||!isConfigured();
}

function autoPickBoardCategories(){
  const form=$("#board-setup-form"); if(!form)return;
  const boxes=$$('input[name="categories"]',form);
  boxes.forEach((b,i)=>b.checked=i<6);
  refreshBoardCategoryPicker();
  playSfx("select");
}

async function boardSelectCellAction(cellId){
  if(!state.lobby?.id||!cellId||!beginAction("board-select"))return;
  try{ await selectBoardCell(state.lobby.id,cellId); await performLobbyRefresh(state.lobby.code); }
  catch(error){ reportError(error,"That clue couldn't be selected."); }
  finally{ endAction("board-select"); }
}

async function boardBuzzAction(){
  if(!state.lobby?.id||!beginAction("board-buzz"))return;
  try{
    const result=await buzzBoard(state.lobby.id);
    if(!result?.accepted){ if(result?.reason==="locked_out")toast("You're locked out of this clue after a miss.","bad"); else if(result?.reason==="expired")toast("The buzz window just closed.","bad"); else toast("Someone beat you to the buzzer.","bad"); }
    else playSfx("select");
    await performLobbyRefresh(state.lobby.code);
  }catch(error){ reportError(error,"The buzzer didn't register."); }
  finally{ endAction("board-buzz"); }
}

async function boardWagerSubmit(e){
  e.preventDefault(); if(!state.lobby?.id||!beginAction("board-wager"))return;
  try{ const wager=Number(new FormData(e.currentTarget).get("wager")||0); await submitBoardWager(state.lobby.id,wager); await performLobbyRefresh(state.lobby.code); }
  catch(error){ reportError(error,"That wager couldn't be locked."); }
  finally{ endAction("board-wager"); }
}

async function boardAnswerSubmitValue(answer,{final=false}={}){
  if(!state.lobby?.id||answer==null||String(answer).trim()===""||!beginAction(final?"board-final-answer":"board-answer"))return;
  try{
    if(final) await submitBoardFinalAnswer(state.lobby.id,String(answer));
    else await submitBoardAnswer(state.lobby.id,String(answer));
    await performLobbyRefresh(state.lobby.code);
  }catch(error){ reportError(error,"Your answer couldn't be submitted."); }
  finally{ endAction(final?"board-final-answer":"board-answer"); }
}

async function boardAnswerSubmit(e){
  e.preventDefault(); const fd=new FormData(e.currentTarget); await boardAnswerSubmitValue(fd.get("answer"),{final:e.currentTarget.dataset.boardFinal==="1"});
}

async function boardFinalWagerSubmit(e){
  e.preventDefault(); if(!state.lobby?.id||!beginAction("board-final-wager"))return;
  try{ const wager=Number(new FormData(e.currentTarget).get("wager")||0); await submitBoardFinalWager(state.lobby.id,wager); await performLobbyRefresh(state.lobby.code); }
  catch(error){ reportError(error,"That final wager couldn't be locked."); }
  finally{ endAction("board-final-wager"); }
}

async function boardCloseClueAction(){
  if(!state.lobby?.id||!beginAction("board-close"))return;
  try{ await closeBoardClue(state.lobby.id); await performLobbyRefresh(state.lobby.code); }
  catch(error){ reportError(error,"The clue couldn't be closed."); }
  finally{ endAction("board-close"); }
}

async function syncBoardAndRefresh(reason="board-clock"){
  if(!state.lobby?.id||state.lobby?.experience_mode!=="board"||state.view!=="lobby")return;
  const key=`board-clock:${state.lobby.id}`; if(!beginAction(key))return;
  try{ await syncBoardClock(state.lobby.id); await performLobbyRefresh(state.lobby.code); }
  catch(error){ console.warn(`Board clock sync failed (${reason})`,error); }
  finally{ endAction(key); }
}

function startBoardPhaseTimer(){
  const b=state.boardGame;if(!b||state.lobby?.experience_mode!=="board")return;
  stopPhaseTimers();
  let start=null,total=0;
  if(b.phase==="wager"){start=Date.parse(b.clue_opened_at||"");total=30000;}
  else if(b.phase==="buzz"){start=Date.parse(b.buzz_opened_at||"");total=12000;}
  else if(b.phase==="answer"){start=Date.parse(b.answer_started_at||"");total=Math.max(10,Math.min(30,Number(b.seconds_per_question||state.lobby?.seconds_per_question||15)))*1000;}
  else if(b.phase==="reveal"){start=Date.parse(b.reveal_started_at||"");total=4000;}
  else if(b.phase==="final_wager"){start=Date.parse(b.updated_at||"");total=30000;}
  else if(b.phase==="final_clue"){start=Date.parse(b.final_clue_started_at||"");total=30000;}
  else if(b.phase==="finished"){start=Date.parse(state.lobby?.finished_at||"");total=8000;}
  else return;
  if(!Number.isFinite(start))start=Date.now();
  const end=start+total,key=`board:${state.lobby.id}:${b.phase}:${start}`;
  const tick=()=>{
    if(state.view!=="lobby"||state.lobby?.experience_mode!=="board"||state.boardGame?.phase!==b.phase)return;
    const remaining=Math.max(0,end-Date.now()),node=$(b.phase==="finished"?"#board-return-countdown":"#board-phase-clock");
    if(node)node.textContent=String(Math.ceil(remaining/1000))+(b.phase==="finished"?"":"s");
    if(remaining<=0){
      if(phaseAutoKey!==key){phaseAutoKey=key;if(b.phase==="finished")returnMatchToLobby();else syncBoardAndRefresh("phase-expired");}
      return;
    }
    phaseRaf=requestAnimationFrame(tick);
  };
  phaseRaf=requestAnimationFrame(tick);
}

async function createSubmit(e) {
  e.preventDefault();
  if (!beginAction("create-lobby")) return;
  if (!(await requireAuthOrDemo())) { endAction("create-lobby"); return; }
  const f=new FormData(e.currentTarget);
  const settings={title:f.get("title"),category:f.get("category"),difficulty:f.get("difficulty"),questionCount:+f.get("questionCount"),
    maxPlayers:+f.get("maxPlayers"),gameMode:f.get("gameMode"),secondsPerQuestion:+f.get("secondsPerQuestion"),visibility:String(f.get("visibility")||"invite_only"),allowMatchmaking:f.get("allowMatchmaking")==="on"};
  if(settings.gameMode==="standard"&&settings.maxPlayers>250) toast("For rooms above 250, Event mode is strongly recommended.");
  try {
    if (!isConfigured()) {
      const code=Math.random().toString(36).slice(2,8).toUpperCase();
      state.lobby={id:"demo-"+uid(),code,host_id:"demo",demoHost:true,status:"lobby",current_question_index:0,...{
        title:settings.title||"Demo Trivia",category:settings.category,difficulty:settings.difficulty,question_count:settings.questionCount,
        max_players:settings.maxPlayers,game_mode:settings.gameMode,seconds_per_question:settings.secondsPerQuestion}};
      state.lobbyPlayers=[{user_id:"demo",username:demo.profile.username,avatar_url:""}]; demo.lobby=state.lobby; navigate("lobby");
    } else {
      const g=await createLobby(settings); state.lobby=g; await enterLobby(g.code);
    }
  } catch(err){reportError(err, "The lobby couldn't be created. Please try again.");}
  finally { endAction("create-lobby"); }
}

async function startMatchmaking(e){
  e?.preventDefault?.();
  if(!beginAction("matchmaking")) return;
  try{
    if(!(await requireAuthOrDemo())) return;
    if(!isConfigured()){ toast("Matchmaking requires the live Supabase backend.","bad"); return; }
    const form=e?.currentTarget||$("#matchmaking-setup-form");
    const fd=form?new FormData(form):new FormData();
    const category=String(fd.get("category")||"").trim();
    const difficulty=String(fd.get("difficulty")||"medium").trim().toLowerCase();
    if(!category){toast("Choose a matchmaking category.","bad");return;}
    toast(`Searching ${category} · ${difficulty}…`);
    const result=await matchmake({category,difficulty});
    if(!result?.code) throw new Error("Matchmaking did not return a lobby.");
    await enterLobby(result.code);
    if(result.join_mode==="spectator") toast("Match found — spectating this run. You are locked in for the next match.");
    else if(result.created_new) toast("No matching room found — launching with bot challengers.");
    else toast("Match found!");
  }catch(e){ reportError(e,"Matchmaking couldn't find a game with that loadout. Try another category or difficulty."); }
  finally{ endAction("matchmaking"); }
}

async function returnMatchToLobby(){
  if(!state.lobby?.id||!beginAction("return-lobby")) return;
  try{
    if(state.lobby.experience_mode==="board") await resetBoardLobby(state.lobby.id);
    else await returnToLobby(state.lobby.id);
    await performLobbyRefresh(state.lobby.code);
  }
  catch(e){ reportError(e,"Couldn't return to the lobby yet."); }
  finally{ endAction("return-lobby"); }
}

async function quickJoin(code) {
  if(!code||code.trim().length<4){toast("Enter a lobby code.","bad");return}
  if (!beginAction("join-lobby")) return;
  try {
    if(!(await requireAuthOrDemo())) return;
    if(!isConfigured()){toast("Demo mode can host a local test lobby. Connect Supabase for cross-device joining.");await navigate("create");return}
    await joinLobby(code); await enterLobby(code);
  } catch(e){reportError(e, "That lobby couldn't be joined. Check the code and try again.")}
  finally { endAction("join-lobby"); }
}

async function enterLobby(code) {
  cleanupRealtime();
  stopLobbySync();
  const g=await getLobby(code); if(!g) throw new Error("Lobby not found.");
  state.lobby=g; state.lobbyPlayers=await getLobbyPlayers(g.id);
  if(g.experience_mode==="board"){
    state.boardGame=await getBoardState(g.id); state.currentQuestion=null; state.roundResults=null;
  } else if(g.status==="question"||g.status==="results"){ state.currentQuestion=await getCurrentQuestion(g.id); if(g.status==="results") state.roundResults=await getRoundResults(g.id); }
  else if(g.status==="finished"){ state.roundResults=await getRoundResults(g.id); }
  lobbyRealtimeStatus = "CONNECTING";
  lobbyLastSyncAt = Date.now();
  subscribeLobby(
    g.id,
    () => {
      lobbyLastSyncAt = Date.now();
      refreshLobby(code, 35);
    },
    status => {
      lobbyRealtimeStatus = status;
      updateLobbySyncBadge();
      if (status === "SUBSCRIBED") {
        lobbyLastSyncAt = Date.now();
        refreshLobby(code, 0);
      }
    }
  );
  startLobbySyncFallback(code);
  await navigate("lobby");
  updateLobbySyncBadge();
}

async function performLobbyRefresh(code) {
  if (lobbyRefreshBusy) { lobbyRefreshQueued = true; return; }
  lobbyRefreshBusy = true;
  try{
    const previousGame = state.lobby;
    const previousBoard = state.boardGame;
    const previousRoster = (state.lobbyPlayers || []).map(p=>`${p.user_id}:${p.username || ""}:${p.avatar_url || ""}`).sort().join("|");
    const g=await getLobby(code); if(!g)return;
    const players=await getLobbyPlayers(g.id);
    const nextRoster = players.map(p=>`${p.user_id}:${p.username || ""}:${p.avatar_url || ""}`).sort().join("|");
    const phaseChanged = !previousGame || previousGame.status !== g.status || previousGame.current_question_index !== g.current_question_index || previousGame.question_count !== g.question_count || previousGame.question_started_at !== g.question_started_at || previousGame.cycle_no !== g.cycle_no || previousGame.my_participation_status !== g.my_participation_status || previousGame.experience_mode !== g.experience_mode;
    const rosterChanged = previousRoster !== nextRoster;
    state.lobby=g; state.lobbyPlayers=players;
    let boardChanged=false;
    if(g.experience_mode==="board"){
      const nextBoard=await getBoardState(g.id);
      boardChanged=!previousBoard || previousBoard.updated_at!==nextBoard?.updated_at || previousBoard.phase!==nextBoard?.phase;
      state.boardGame=nextBoard; state.currentQuestion=null; state.roundResults=null;
    } else {
      state.boardGame=null;
      if(g.status==="question"||g.status==="results"){state.currentQuestion=await getCurrentQuestion(g.id);}
      if(g.status==="results"||g.status==="finished") state.roundResults=await getRoundResults(g.id);
    }
    if(g.status==="finished" && previousGame?.status!=="finished") {
      try { await loadProfile(); } catch(profileError) { console.warn("Profile XP refresh failed",profileError); }
    }
    lobbyLastSyncAt = Date.now();
    if(state.view==="lobby" && (phaseChanged || rosterChanged || boardChanged)) await navigate("lobby");
    updateLobbySyncBadge();
  }catch(e){
    console.warn("Lobby sync refresh failed", e);
  } finally {
    lobbyRefreshBusy = false;
    if (lobbyRefreshQueued) {
      lobbyRefreshQueued = false;
      refreshLobby(code, 20);
    }
  }
}

function refreshLobby(code, delay=120) {
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>performLobbyRefresh(code),Math.max(0,delay));
}

async function hostStart() {
  if (!beginAction("host-transition")) return;
  try{
    if(state.lobby.demoHost){
      state.lobby.status="question"; state.lobby.current_question_index=0; state.currentQuestion={...SAMPLE[0]}; answerStartedAt=performance.now(); return navigate("lobby");
    }
    if(state.lobby.experience_mode==="board") await startBoardGame(state.lobby.id);
    else await startLobby(state.lobby.id);
    await refreshLobby(state.lobby.code);
  }catch(e){reportError(e)}
  finally { endAction("host-transition"); }
}

async function gameSubmit(e) {
  e?.preventDefault();
  const q=state.currentQuestion, form=$("#answer-form");
  if(!q||form?.dataset.submitted==="1") return;
  const value=q.question_type==="multiple_choice"?form.dataset.choice:$("#game-answer")?.value;
  if(value==null||value===""){toast("Enter an answer first.","bad");return}
  form.dataset.submitted="1";
  $("#answer-status").innerHTML=`<b>✓ Answer locked</b> — waiting for reveal`;
  form.querySelectorAll("input,button").forEach(x=>x.disabled=true);
  try{
    if(state.lobby.demoHost){
      state._demoAnswer=value; toast("Answer locked");
    }else await submitGameAnswer(state.lobby.id,value,performance.now()-answerStartedAt);
  }catch(err){reportError(err)}
}

async function hostReveal() {
  if (!beginAction("host-transition")) return;
  try{
    if(state.lobby.demoHost){
      const q=state.currentQuestion, guess=Number(state._demoAnswer ?? q.answer_numeric*1.4), score=numericScore(guess,q.answer_numeric);
      state.lobby.status="results";
      state.roundResults=[
        {username:demo.profile.username,answer_numeric:guess,score,total_score:score,is_me:true},
        ...["Nova","MetricMind","Quasar","FermiFan"].map((n,i)=>{const g=q.answer_numeric*Math.pow(10,(Math.random()-.5));return{username:n,answer_numeric:g,score:numericScore(g,q.answer_numeric),total_score:numericScore(g,q.answer_numeric),is_me:false}})
      ].sort((a,b)=>b.total_score-a.total_score);
      return navigate("lobby");
    }
    await revealRound(state.lobby.id,state.lobby.current_question_index); await performLobbyRefresh(state.lobby.code);
  }catch(e){reportError(e)}
  finally { endAction("host-transition"); }
}

async function hostNext() {
  if (!beginAction("host-transition")) return;
  try{
    if(state.lobby.demoHost){
      if(state.lobby.current_question_index+1>=state.lobby.question_count||state.lobby.current_question_index+1>=SAMPLE.length){
        state.lobby.status="finished"; return navigate("lobby");
      }
      state.lobby.current_question_index++; state.lobby.status="question";
      state.currentQuestion={...SAMPLE[state.lobby.current_question_index%SAMPLE.length]}; state.roundResults=null; state._demoAnswer=null; answerStartedAt=performance.now();
      return navigate("lobby");
    }
    await nextRound(state.lobby.id,state.lobby.current_question_index); await performLobbyRefresh(state.lobby.code);
  }catch(e){reportError(e)}
  finally { endAction("host-transition"); }
}

function stopPhaseTimers() {
  if (phaseRaf) cancelAnimationFrame(phaseRaf);
  if (phaseTimeout) clearTimeout(phaseTimeout);
  phaseRaf = null;
  phaseTimeout = null;
  phaseAutoKey = null;
}

async function syncClockAndRefresh(reason="clock") {
  if (!state.lobby?.id || state.view!=="lobby") return;
  const key=`game-clock:${state.lobby.id}`;
  if (!beginAction(key)) return;
  try {
    if (state.lobby.demoHost) {
      if (state.lobby.status==="question") await hostReveal();
      else if (state.lobby.status==="results") await hostNext();
      return;
    }
    await syncGameClock(state.lobby.id);
    await performLobbyRefresh(state.lobby.code);
  } catch (error) {
    console.warn(`Game clock sync failed (${reason})`, error);
  } finally {
    endAction(key);
  }
}

function expireLocalAnswer() {
  const form=$("#answer-form");
  if(!form || form.dataset.submitted==="1" || form.dataset.timedOut==="1") return;
  form.dataset.timedOut="1";
  form.querySelectorAll("input,button").forEach(x=>x.disabled=true);
  const status=$("#answer-status");
  if(status) status.innerHTML=`<b>⌛ Time's up</b> — +0 this round`;
}

function startTimer() {
  const bar=$("#timer-bar");
  if(!bar || !state.lobby) return;
  stopPhaseTimers();

  const total=Math.max(1,Number(state.lobby.seconds_per_question||20))*1000;
  const serverStart=Date.parse(state.lobby.question_started_at||"");
  const start=Number.isFinite(serverStart)?serverStart:Date.now();
  const end=start+total;
  const elapsed=Math.max(0,Date.now()-start);
  answerStartedAt=performance.now()-elapsed;
  const timerValue=$("#timer-value");
  const clockKey=`q:${state.lobby.id}:${state.lobby.current_question_index}:${start}`;

  const tick=()=>{
    if(state.view!=="lobby" || state.lobby?.status!=="question" || !$("#timer-bar")) return;
    const remaining=Math.max(0,end-Date.now());
    const left=Math.max(0,Math.min(1,remaining/total));
    bar.style.transform=`scaleX(${left})`;
    if(timerValue) timerValue.textContent=`${Math.ceil(remaining/1000)}s`;
    if(remaining<=0){
      expireLocalAnswer();
      if(phaseAutoKey!==clockKey){
        phaseAutoKey=clockKey;
        syncClockAndRefresh("question-expired");
      }
      return;
    }
    phaseRaf=requestAnimationFrame(tick);
  };
  phaseRaf=requestAnimationFrame(tick);
}

function startResultsTimer() {
  if(!state.lobby || state.lobby.status!=="results") return;
  stopPhaseTimers();
  const shownAt=Date.parse(state.lobby.results_started_at||"");
  const start=Number.isFinite(shownAt)?shownAt:Date.now();
  const end=start+5000;
  const key=`r:${state.lobby.id}:${state.lobby.current_question_index}:${start}`;

  const tick=()=>{
    if(state.view!=="lobby" || state.lobby?.status!=="results") return;
    const remaining=Math.max(0,end-Date.now());
    const node=$("#result-countdown");
    if(node) node.textContent=String(Math.max(0,Math.ceil(remaining/1000)));
    if(remaining<=0){
      if(phaseAutoKey!==key){
        phaseAutoKey=key;
        syncClockAndRefresh("results-expired");
      }
      return;
    }
    phaseRaf=requestAnimationFrame(tick);
  };
  phaseRaf=requestAnimationFrame(tick);
}

function startFinishedTimer(){
  if(!state.lobby||state.lobby.status!=="finished") return;
  stopPhaseTimers();
  const ended=Date.parse(state.lobby.finished_at||"")||Date.now();
  const end=ended+8000;
  const tick=()=>{
    if(state.view!=="lobby"||state.lobby?.status!=="finished") return;
    const remaining=Math.max(0,end-Date.now());
    const node=$("#lobby-return-countdown"); if(node) node.textContent=String(Math.ceil(remaining/1000));
    if(remaining<=0){ returnMatchToLobby(); return; }
    phaseRaf=requestAnimationFrame(tick);
  };
  phaseRaf=requestAnimationFrame(tick);
}

async function profileSubmit(e){
  e.preventDefault(); const username=new FormData(e.currentTarget).get("username").trim();
  if(username.length<2){toast("Display name must be at least 2 characters.","bad");return}
  try{
    if(!isConfigured()){demo.profile.username=username;state.profile=demo.profile;toast("Demo profile updated");navigate("profile")}
    else{await updateProfile(username);toast("Profile saved");navigate("profile")}
  }catch(err){reportError(err)}
}

document.addEventListener("keydown", e=>{
  if(e.key==="Enter"&&document.activeElement?.id==="quick-code") quickJoin(document.activeElement.value);
});

subscribe(()=>{});

async function boot() {
  applyExperiencePrefs();
  bindGameFeel();
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
  demoInit();
  await initSupabase();
  if(state.session){
    try{await loadProfile();applyUiTheme(state.profile?.ui_theme || storedUiTheme());}catch(e){console.warn(e)}
    startPresenceHeartbeat();
  } else { applyUiTheme(storedUiTheme(), false); }
  if(isConfigured()){ try{const [categories,matchmakingOptions]=await Promise.all([getAvailableCategories(),getMatchmakingOptions()]);setState({categories,matchmakingOptions});}catch(e){console.warn(e)} }
  await initTwitch();

  const params=new URLSearchParams(location.search);
  const overlay=params.get("overlay");
  if(overlay){overlayView(overlay.toUpperCase());return}

  const join=params.get("join");
  if(join){
    if(state.session) { try{await joinLobby(join);await enterLobby(join);return}catch(e){reportError(e)} }
    else {
      sessionStorage.setItem("pending_join",join.toUpperCase());
      if(isConfigured()){toast("Sign in to join this lobby.");}
    }
  }
  const pending=sessionStorage.getItem("pending_join");
  if(pending&&state.session){sessionStorage.removeItem("pending_join");try{await joinLobby(pending);await enterLobby(pending);return}catch(e){reportError(e)}}
  const pendingLibrary=sessionStorage.getItem("pending_library");
  if(pendingLibrary&&state.session){sessionStorage.removeItem("pending_library");await libraryPlay(pendingLibrary);return;}
  navigate("home");
}
boot();
