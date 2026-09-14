import { state, setState, subscribe, levelFromXp, xpToNextLevel, cleanupRealtime } from "./store.js";
import {
  initSupabase, isConfigured, signInGoogle, signOut, loadProfile, loadLeaderboard, updateProfile,
  createLobby, joinLobby, getLobby, getLobbyPlayers, startLobby, getCurrentQuestion,
  submitGameAnswer, revealRound, nextRound, getRoundResults, getDailyQuestion, submitDailyAnswer,
  subscribeLobby
} from "./supabase.js";
import { numericScore, xpForScore, formatAnswer } from "./scoring.js";
import { renderGuessHistogram } from "./charts.js";
import { initTwitch, connectTwitch, disconnectTwitch, announceLobby, listenToTwitchChat } from "./twitch.js";

const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const uid = () => Math.random().toString(36).slice(2);
let answerStartedAt = 0;
let refreshTimer = null;
let demo = null;

const SAMPLE = [
  { id:"d1", category:"Science", difficulty:"medium", question_type:"numeric", prompt:"About how many kilometers is the average distance from Earth to the Moon?", unit:"km", answer_numeric:384400, explanation:"The Moon's average orbital distance is about 384,400 km." },
  { id:"d2", category:"Technology", difficulty:"easy", question_type:"numeric", prompt:"In what year was the original iPhone released?", unit:"year", answer_numeric:2007, explanation:"Apple released the first iPhone in 2007." },
  { id:"d3", category:"Geography", difficulty:"medium", question_type:"numeric", prompt:"Roughly how many square kilometers is the area of Pennsylvania?", unit:"km²", answer_numeric:119280, explanation:"Pennsylvania covers about 119,280 km²." },
  { id:"d4", category:"History", difficulty:"easy", question_type:"numeric", prompt:"In what year did the Berlin Wall fall?", unit:"year", answer_numeric:1989, explanation:"The Berlin Wall opened on November 9, 1989." },
  { id:"d5", category:"Animals", difficulty:"medium", question_type:"numeric", prompt:"About how many kilograms can an adult male African elephant weigh?", unit:"kg", answer_numeric:6000, explanation:"Large adult males commonly weigh around 6,000 kg, with exceptional individuals heavier." },
  { id:"d6", category:"Space", difficulty:"hard", question_type:"numeric", prompt:"Approximately how many Earth days does Venus take to rotate once on its axis?", unit:"days", answer_numeric:243, explanation:"Venus rotates extremely slowly: roughly 243 Earth days per sidereal rotation." }
];

function toast(message, tone="") {
  const node = document.createElement("div");
  node.className = `toast ${tone}`; node.textContent = message;
  $("#toast-root").appendChild(node);
  setTimeout(() => node.remove(), 3600);
}

function appShell(content) {
  const p = state.profile;
  const xp = xpToNextLevel(p?.xp || 0);
  const avatar = p?.avatar_url || state.session?.user?.user_metadata?.avatar_url || "";
  return `
  <header class="topbar">
    <button class="brand plain" data-nav="home"><span class="brand-mark">?</span><span>${esc(state.config.appName || "WhatMod Trivia")}</span></button>
    <nav class="desktop-nav">
      <button class="nav-pill ${state.view==="home"?"active":""}" data-nav="home">Play</button>
      <button class="nav-pill ${state.view==="leaderboard"?"active":""}" data-nav="leaderboard">Leaderboard</button>
      <button class="nav-pill ${state.view==="how"?"active":""}" data-nav="how">How it works</button>
    </nav>
    <div class="user-zone">
      ${p ? `<button class="level-chip" data-nav="profile"><span>Lv ${xp.level}</span><span class="mini-xp"><i style="width:${Math.round(xp.progress*100)}%"></i></span></button>` : ""}
      ${state.session ? `<button class="avatar-btn" data-nav="profile">${avatar?`<img src="${esc(avatar)}" alt="">`:"<span>🙂</span>"}</button>`:
        `<button class="btn small primary" data-action="login">Sign in with Google</button>`}
    </div>
  </header>
  <main class="page">${content}</main>
  <nav class="mobile-nav">
    <button data-nav="home" class="${state.view==="home"?"active":""}"><span>◉</span>Play</button>
    <button data-nav="leaderboard" class="${state.view==="leaderboard"?"active":""}"><span>♛</span>Ranks</button>
    <button data-nav="profile" class="${state.view==="profile"?"active":""}"><span>☺</span>Profile</button>
  </nav>`;
}

function guestBanner() {
  if (state.session) return "";
  return `<div class="notice"><b>Play instantly in demo mode.</b> Sign in with Google on the live build to save XP, streaks, wins, and multiplayer history.</div>`;
}

function homeView() {
  const p = state.profile;
  const lvl = xpToNextLevel(p?.xp || 0);
  return appShell(`
    <section class="hero">
      <div class="eyebrow">DAILY ESTIMATION + LIVE TRIVIA</div>
      <h1>Guess smarter.<br><span>Level up together.</span></h1>
      <p>One daily question, precision-based scoring, friend lobbies, streamer-sized events, and a profile that keeps every win.</p>
      ${guestBanner()}
    </section>

    ${p ? `<section class="profile-strip">
      <div><span class="label">Level</span><strong>${lvl.level}</strong></div>
      <div class="grow"><span class="label">${p.xp} XP · ${lvl.ceil-p.xp} to next level</span><div class="xpbar"><i style="width:${Math.round(lvl.progress*100)}%"></i></div></div>
      <div><span class="label">Wins</span><strong>${p.wins||0}</strong></div>
      <div><span class="label">Games</span><strong>${p.games_played||0}</strong></div>
    </section>`:""}

    <section class="mode-grid">
      <article class="mode-card featured">
        <div class="card-icon">∞</div><div class="mode-tag">TODAY'S CHALLENGE</div>
        <h2>Daily Estimate</h2>
        <p>Make your best numeric guess. The closer you are—even across huge scales—the more XP you earn.</p>
        <button class="btn primary wide" data-action="daily">Play today's question <span>→</span></button>
      </article>
      <article class="mode-card">
        <div class="card-icon">＋</div><div class="mode-tag">HOST</div>
        <h2>Create a Lobby</h2>
        <p>Pick category, difficulty, timer, question count, and room size. Share one six-character code.</p>
        <button class="btn wide" data-nav="create">Create game</button>
      </article>
      <article class="mode-card">
        <div class="card-icon">#</div><div class="mode-tag">JOIN</div>
        <h2>Enter a Code</h2>
        <p>Jump directly into a friend's room or a creator's live game.</p>
        <div class="join-inline"><input id="quick-code" maxlength="6" placeholder="ABC123"><button class="btn" data-action="quick-join">Join</button></div>
      </article>
      <article class="mode-card streamer">
        <div class="card-icon">◈</div><div class="mode-tag">STREAMER MODE</div>
        <h2>Twitch-ready Games</h2>
        <p>OBS overlay, shareable join links, chat announcements, and a large-room mode that avoids per-player broadcast spam.</p>
        <button class="btn wide ghost" data-nav="create" data-mode="event">Create stream game</button>
      </article>
    </section>

    <section class="feature-row">
      <div><b>0–1,000</b><span>precision score each round</span></div>
      <div><b>2–20K</b><span>designed room range*</span></div>
      <div><b>Live</b><span>leaderboards & distributions</span></div>
      <div><b>1 code</b><span>zero-friction joining</span></div>
    </section>
    <p class="fineprint">*Very large event rooms use a reduced-realtime architecture and require production-scale backend capacity.</p>
  `);
}

function createView(presetEvent=false) {
  return appShell(`
    <section class="section-head"><button class="back" data-nav="home">←</button><div><div class="eyebrow">NEW GAME</div><h1>Create a lobby</h1><p>Everything can be changed before the first question starts.</p></div></section>
    <form id="create-form" class="panel form-panel">
      <div class="form-grid">
        <label><span>Lobby name</span><input name="title" maxlength="60" placeholder="Friday Night Trivia"></label>
        <label><span>Category</span><select name="category">
          <option value="Any">Any category</option><option>Science</option><option>Technology</option><option>History</option><option>Geography</option><option>Animals</option><option>Space</option><option>Sports</option><option>Entertainment</option><option>Business</option>
        </select></label>
        <label><span>Difficulty</span><select name="difficulty"><option value="any">Mixed</option><option>easy</option><option>medium</option><option>hard</option></select></label>
        <label><span>Questions</span><select name="questionCount"><option>5</option><option selected>10</option><option>15</option><option>20</option><option>30</option></select></label>
        <label><span>Seconds per question</span><select name="secondsPerQuestion"><option>10</option><option selected>20</option><option>30</option><option>45</option><option>60</option></select></label>
        <label><span>Maximum players</span><input name="maxPlayers" type="number" min="2" max="20000" value="${presetEvent?20000:10}"></label>
      </div>
      <div class="segmented-wrap"><span>Room architecture</span><div class="segmented">
        <label><input type="radio" name="gameMode" value="standard" ${presetEvent?"":"checked"}><span>Standard <small>2–100 recommended</small></span></label>
        <label><input type="radio" name="gameMode" value="event" ${presetEvent?"checked":""}><span>Event / Twitch <small>batched large-room UX</small></span></label>
      </div></div>
      <div class="callout"><b>Question mix</b><span>Numeric estimate questions award partial credit based on proximity. Multiple choice and text questions can also be added to the bank.</span></div>
      <button class="btn primary big" type="submit">Generate lobby code</button>
    </form>
  `);
}

function lobbyView() {
  const g = state.lobby;
  if (!g) return homeView();
  const meHost = !g.host_id || g.host_id === state.session?.user?.id || g.demoHost;
  const joinUrl = `${state.config.publicUrl || new URL("./",location.href).href}?join=${g.code}`;
  const players = state.lobbyPlayers || [];
  const phase = g.status || "lobby";
  if (phase === "question" || phase === "results" || phase === "finished") return gameView();

  return appShell(`
    <section class="lobby-layout">
      <div>
        <div class="eyebrow">LOBBY OPEN</div>
        <h1>${esc(g.title || "Trivia Night")}</h1>
        <div class="code-card"><span>JOIN CODE</span><strong>${esc(g.code)}</strong><button class="copy" data-copy="${esc(g.code)}">Copy code</button></div>
        <div class="share-url">${esc(joinUrl)}</div>
        <div class="lobby-actions">
          <button class="btn" data-copy="${esc(joinUrl)}">Copy join link</button>
          <a class="btn ghost" target="_blank" rel="noopener" href="?overlay=${encodeURIComponent(g.code)}">Open OBS overlay</a>
        </div>
      </div>
      <aside class="panel lobby-side">
        <div class="panel-head"><div><span class="label">PLAYERS</span><h3>${players.length} / ${g.max_players}</h3></div><span class="pulse">● LIVE</span></div>
        <div class="player-list">${players.map((p,i)=>`<div class="player"><span class="rank">${i+1}</span>${p.avatar_url?`<img src="${esc(p.avatar_url)}">`:`<i>${esc((p.username||"?")[0])}</i>`}<b>${esc(p.username||"Player")}</b>${p.user_id===g.host_id?`<small>HOST</small>`:""}</div>`).join("") || `<div class="empty">Waiting for players…</div>`}</div>
      </aside>
    </section>

    <section class="panel lobby-config">
      <div><span>Category</span><b>${esc(g.category)}</b></div><div><span>Difficulty</span><b>${esc(g.difficulty)}</b></div>
      <div><span>Questions</span><b>${g.question_count}</b></div><div><span>Timer</span><b>${g.seconds_per_question}s</b></div>
      <div><span>Mode</span><b>${g.game_mode==="event"?"Event / Twitch":"Standard"}</b></div>
    </section>

    ${meHost ? `<section class="host-controls panel">
      <div><div class="eyebrow">HOST CONTROLS</div><h3>Ready when your room is.</h3><p>Players stay synced automatically once you begin.</p></div>
      <button class="btn primary big" data-action="start-game" ${players.length<1?"disabled":""}>Start game</button>
    </section>`:""}

    ${meHost ? `<section class="panel twitch-panel">
      <div><div class="eyebrow">TWITCH</div><h3>${state.twitch.user?`Connected as ${esc(state.twitch.user.display_name)}`:"Connect your channel"}</h3>
      <p>Announce this lobby in chat and listen for <code>!trivia</code> / <code>!join</code> interest commands.</p></div>
      <div class="row-actions">${state.twitch.user
        ? `<button class="btn" data-action="twitch-announce">Post lobby to chat</button><button class="btn ghost" data-action="twitch-listen">Listen for commands</button><button class="btn danger-soft" data-action="twitch-disconnect">Disconnect</button>`
        : `<button class="btn twitch" data-action="twitch-connect">Connect Twitch</button>`}</div>
      ${state.twitch.chatters.length ? `<div class="chat-interest">${state.twitch.chatters.map(c=>`<span>${esc(c.name)}</span>`).join("")}</div>`:""}
    </section>`:""}
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
  if (!q) return appShell(`<section class="center-stage"><div class="spinner"></div><h2>Syncing the next question…</h2></section>`);
  const host = g.demoHost || g.host_id === state.session?.user?.id;

  if (g.status === "results") {
    const rows = state.roundResults || [];
    const guesses = rows.map(r=>r.answer_numeric).filter(v=>v!==null && v!==undefined);
    return appShell(`
      <section class="question-stage results-stage">
        <div class="round-meta"><span>ROUND ${g.current_question_index+1} / ${g.question_count}</span><span>${esc(q.category)} · ${esc(q.difficulty)}</span></div>
        <h1>${esc(q.prompt)}</h1>
        <div class="answer-reveal"><span>ANSWER</span><strong>${formatAnswer(q.answer_numeric ?? q.answer_text ?? q.answer_display)} ${esc(q.unit||"")}</strong><p>${esc(q.explanation||"")}</p></div>
        <div class="chart-card"><canvas id="guess-chart"></canvas></div>
        <div class="scoreboard panel">
          <div class="panel-head"><h3>Round leaderboard</h3><span>${rows.length} answers</span></div>
          ${rows.slice(0,20).map((r,i)=>`<div class="score-row"><span>${i+1}</span><b>${esc(r.username)}</b><span>${r.score} pts</span><strong>${r.total_score}</strong></div>`).join("") || `<div class="empty">No answers this round.</div>`}
        </div>
        ${host?`<button class="btn primary big center" data-action="next-round">${g.current_question_index+1>=g.question_count?"Finish game":"Next question"} →</button>`:"<div class='waiting'>Waiting for the host…</div>"}
      </section>`);
  }

  return appShell(`
    <section class="question-stage">
      <div class="round-meta"><span>ROUND ${g.current_question_index+1} / ${g.question_count}</span><span>${esc(q.category)} · ${esc(q.difficulty)}</span></div>
      <div class="timer-line"><i id="timer-bar"></i></div>
      <h1>${esc(q.prompt)}</h1>
      ${q.context ? `<p class="question-context">${esc(q.context)}</p>`:""}
      <form id="answer-form" class="answer-form">
        ${questionInput(q)}
        ${q.question_type!=="multiple_choice"?`<button class="btn primary big" type="submit">Lock answer</button>`:""}
      </form>
      <div id="answer-status" class="answer-status">Your answer is final once submitted.</div>
      ${host?`<button class="btn ghost host-reveal" data-action="reveal-round">Reveal results</button>`:""}
    </section>`);
}

function finalView() {
  const rows = state.roundResults || [];
  return appShell(`
    <section class="finish">
      <div class="trophy">♛</div><div class="eyebrow">GAME COMPLETE</div><h1>Final standings</h1>
      <p>${esc(state.lobby?.title || "Trivia Night")}</p>
      <div class="podium">${rows.slice(0,3).map((r,i)=>`<div class="podium-card p${i+1}"><span>#${i+1}</span><b>${esc(r.username)}</b><strong>${r.total_score}</strong><small>points</small></div>`).join("")}</div>
      <div class="scoreboard panel">${rows.slice(3,50).map((r,i)=>`<div class="score-row"><span>${i+4}</span><b>${esc(r.username)}</b><span>${r.total_score} pts</span></div>`).join("")}</div>
      <button class="btn primary big" data-nav="home">Back to home</button>
    </section>`);
}

function dailyView() {
  const q = state.daily?.question || state.daily;
  const result = state.daily?.result;
  if (!q) return appShell(`<section class="center-stage"><div class="spinner"></div><h2>Picking today's question…</h2></section>`);
  if (result) {
    return appShell(`
      <section class="question-stage results-stage daily-result">
        <div class="eyebrow">TODAY'S RESULT</div>
        <h1>${esc(q.prompt)}</h1>
        <div class="score-burst"><span>PRECISION SCORE</span><strong>${result.score}</strong><small>/ 1,000</small></div>
        <div class="answer-reveal"><span>CORRECT ANSWER</span><strong>${formatAnswer(result.answer_numeric ?? q.answer_numeric)} ${esc(q.unit||"")}</strong>
          <p>Your guess: <b>${formatAnswer(result.your_answer)}</b> · +${result.xp_awarded} XP</p><p>${esc(result.explanation||q.explanation||"")}</p>
        </div>
        <div class="chart-card"><canvas id="daily-chart"></canvas></div>
        <div class="row-actions center"><button class="btn primary" data-nav="home">Done</button><button class="btn" data-copy="${esc(location.href)}">Share challenge</button></div>
      </section>`);
  }
  return appShell(`
    <section class="question-stage daily-stage">
      <div class="daily-kicker"><span>DAILY #${esc(q.daily_number||"—")}</span><span>${esc(q.category)} · ${esc(q.difficulty)}</span></div>
      <h1>${esc(q.prompt)}</h1>
      ${q.context?`<p class="question-context">${esc(q.context)}</p>`:""}
      <form id="daily-form" class="answer-form">${questionInput(q,"daily")}<button class="btn primary big" type="submit">Submit estimate</button></form>
      <p class="fineprint center">Your first submitted answer is final. Accuracy determines XP.</p>
    </section>`);
}

async function leaderboardView() {
  let rows = [];
  if (state.config.demoMode || !isConfigured()) {
    rows = [
      {username:"Nova",xp:18400,wins:42,games_played:87},{username:"Quasar",xp:16120,wins:36,games_played:91},
      {username:"MetricMind",xp:14950,wins:31,games_played:72},{username:"EstimateThis",xp:12220,wins:24,games_played:68},
      {username:"FermiFan",xp:10980,wins:19,games_played:56}
    ];
  } else {
    try { rows = await loadLeaderboard(); } catch(e) { toast(e.message,"bad"); }
  }
  return appShell(`
    <section class="section-head"><div><div class="eyebrow">GLOBAL</div><h1>Leaderboard</h1><p>Lifetime XP across daily challenges and multiplayer games.</p></div></section>
    <section class="panel leaderboard">
      ${rows.map((r,i)=>`<div class="leader-row ${i<3?"top":""}"><span class="place">${i+1}</span><span class="leader-avatar">${r.avatar_url?`<img src="${esc(r.avatar_url)}">`:(r.username||"?")[0]}</span>
      <div><b>${esc(r.username)}</b><small>Level ${levelFromXp(r.xp)} · ${r.wins||0} wins</small></div><strong>${Number(r.xp||0).toLocaleString()} XP</strong></div>`).join("")}
    </section>`);
}

function profileView() {
  if (!state.session && !state.config.demoMode) return appShell(`<section class="auth-gate"><div class="card-icon">☺</div><h1>Your trivia profile</h1><p>Sign in with Google to save XP, streaks, wins, and game history.</p><button class="btn primary big" data-action="login">Sign in with Google</button></section>`);
  const p = state.profile || demo?.profile || {username:"Demo Player",xp:760,wins:2,games_played:7,daily_streak:3};
  const l = xpToNextLevel(p.xp);
  return appShell(`
    <section class="profile-page">
      <div class="profile-hero panel"><div class="huge-level">${l.level}</div><div><div class="eyebrow">LEVEL ${l.level}</div><h1>${esc(p.username)}</h1><p>${p.xp.toLocaleString()} lifetime XP</p></div></div>
      <div class="xpbar large"><i style="width:${Math.round(l.progress*100)}%"></i></div>
      <div class="stats-grid"><div><span>Wins</span><strong>${p.wins||0}</strong></div><div><span>Games</span><strong>${p.games_played||0}</strong></div><div><span>Daily streak</span><strong>${p.daily_streak||0}</strong></div><div><span>Next level</span><strong>${Math.max(0,l.ceil-p.xp)} XP</strong></div></div>
      <form id="profile-form" class="panel profile-form"><label><span>Display name</span><input name="username" maxlength="24" value="${esc(p.username)}"></label><button class="btn" type="submit">Save profile</button></form>
      ${state.session?`<button class="btn danger-soft" data-action="logout">Sign out</button>`:`<button class="btn primary" data-action="login">Connect Google to save this profile</button>`}
    </section>`);
}

function howView() {
  return appShell(`
    <section class="section-head"><div><div class="eyebrow">THE RULES</div><h1>Simple to play. Deep enough to master.</h1></div></section>
    <section class="explainer-grid">
      <article class="panel"><span>01</span><h3>Estimate</h3><p>Numeric questions reward closeness rather than all-or-nothing correctness. Being off by 10% hurts much less than being off by 10×.</p></article>
      <article class="panel"><span>02</span><h3>Score</h3><p>Each round is worth up to 1,000 precision points. Multiplayer keeps a running total; XP is awarded to your persistent profile.</p></article>
      <article class="panel"><span>03</span><h3>See the crowd</h3><p>After reveal, a distribution chart shows where everyone guessed, your position, and the actual answer.</p></article>
      <article class="panel"><span>04</span><h3>Level up</h3><p>Daily participation, accurate answers, and wins build XP. Levels get progressively harder to earn.</p></article>
    </section>
    <section class="panel long-copy"><h2>Two multiplayer architectures</h2><p><b>Standard rooms</b> are fully realtime and ideal for friends, classrooms, Discord groups, and typical creator games. <b>Event rooms</b> deliberately reduce presence and fan-out traffic so thousands of viewers can submit without every answer becoming a websocket event for every other player.</p></section>`);
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

function demoInit() {
  demo = {
    profile: { user_id:"demo", username:"Demo Player", avatar_url:"", xp:760, wins:2, games_played:7, daily_streak:3 },
    lobby: null
  };
  state.profile = demo.profile;
}

async function navigate(view, opts={}) {
  state.view = view;
  if (view === "home") $("#app").innerHTML = homeView();
  else if (view === "create") $("#app").innerHTML = createView(opts.event);
  else if (view === "lobby") $("#app").innerHTML = lobbyView();
  else if (view === "daily") $("#app").innerHTML = dailyView();
  else if (view === "leaderboard") $("#app").innerHTML = await leaderboardView();
  else if (view === "profile") $("#app").innerHTML = profileView();
  else if (view === "how") $("#app").innerHTML = howView();
  bind();
  postRender();
}

function bind() {
  $$("[data-nav]").forEach(el => el.onclick = () => navigate(el.dataset.nav, {event:el.dataset.mode==="event"}));
  $$("[data-copy]").forEach(el => el.onclick = async() => { await navigator.clipboard.writeText(el.dataset.copy); toast("Copied"); });
  $$("[data-action]").forEach(el => {
    const a = el.dataset.action;
    if (a==="login") el.onclick = async()=>{ try{ await signInGoogle(); }catch(e){toast(e.message,"bad")} };
    if (a==="logout") el.onclick = async()=>{ await signOut(); navigate("home"); };
    if (a==="daily") el.onclick = openDaily;
    if (a==="quick-join") el.onclick = ()=> quickJoin($("#quick-code")?.value);
    if (a==="start-game") el.onclick = hostStart;
    if (a==="reveal-round") el.onclick = hostReveal;
    if (a==="next-round") el.onclick = hostNext;
    if (a==="twitch-connect") el.onclick = ()=>{try{connectTwitch()}catch(e){toast(e.message,"bad")}};
    if (a==="twitch-disconnect") el.onclick = ()=>{disconnectTwitch();navigate("lobby")};
    if (a==="twitch-announce") el.onclick = async()=>{try{await announceLobby(state.lobby.code);toast("Lobby posted to Twitch chat")}catch(e){toast(e.message,"bad")}};
    if (a==="twitch-listen") el.onclick = async()=>{try{await listenToTwitchChat(()=>navigate("lobby"));toast("Listening for !trivia and !join")}catch(e){toast(e.message,"bad")}};
  });
  $("#create-form")?.addEventListener("submit", createSubmit);
  $("#daily-form")?.addEventListener("submit", dailySubmit);
  $("#answer-form")?.addEventListener("submit", gameSubmit);
  $("#profile-form")?.addEventListener("submit", profileSubmit);
  $$(".choice").forEach(b => b.onclick = () => {
    $$(".choice").forEach(x=>x.classList.remove("selected")); b.classList.add("selected");
    const form = b.closest("form"); form.dataset.choice = b.dataset.answer;
    if (form.id==="answer-form") gameSubmit(new Event("submit"));
  });
}

function postRender() {
  if (state.view === "daily" && state.daily?.result) {
    requestAnimationFrame(()=>renderGuessHistogram($("#daily-chart"), state.daily.result.guesses||[], state.daily.result.answer_numeric, state.daily.result.your_answer));
  }
  if (state.view === "lobby" && state.lobby?.status === "results") {
    requestAnimationFrame(()=>{
      const rows=state.roundResults||[]; const me=rows.find(x=>x.is_me);
      renderGuessHistogram($("#guess-chart"), rows.map(x=>x.answer_numeric).filter(x=>x!=null), state.currentQuestion?.answer_numeric, me?.answer_numeric);
    });
  }
  if (state.view === "lobby" && state.lobby?.status === "question") startTimer();
}

async function requireAuthOrDemo() {
  if (state.session) return true;
  if (state.config.demoMode || !isConfigured()) return true;
  toast("Sign in with Google to play multiplayer.","bad"); return false;
}

async function openDaily() {
  state.view="daily"; state.daily=null; $("#app").innerHTML=appShell(`<section class="center-stage"><div class="spinner"></div><h2>Loading today's challenge…</h2></section>`);
  try {
    if (state.config.demoMode || !isConfigured()) {
      const day = Math.floor(Date.now()/86400000);
      const q = {...SAMPLE[day % SAMPLE.length], daily_number: day-20000};
      state.daily={question:q}; answerStartedAt=performance.now(); await navigate("daily");
    } else {
      if (!state.session) { toast("Sign in with Google to save your daily result.","bad"); return navigate("home"); }
      const q=await getDailyQuestion(); state.daily={question:q}; answerStartedAt=performance.now(); await navigate("daily");
    }
  } catch(e){ toast(e.message,"bad"); navigate("home");}
}

async function dailySubmit(e) {
  e?.preventDefault();
  const q=state.daily?.question;
  const form=$("#daily-form");
  const value=q.question_type==="multiple_choice"?form.dataset.choice:$("#daily-answer")?.value;
  if (value===""||value==null){toast("Enter an answer first.","bad");return}
  try {
    if (state.config.demoMode || !isConfigured()) {
      const score=numericScore(value,q.answer_numeric), xp=xpForScore(score,{daily:true});
      demo.profile.xp+=xp; demo.profile.daily_streak++;
      const spread=Array.from({length:68},()=>q.answer_numeric*Math.pow(10,(Math.random()-.5)*1.4));
      state.daily.result={score,xp_awarded:xp,your_answer:Number(value),answer_numeric:q.answer_numeric,explanation:q.explanation,guesses:spread};
      state.profile=demo.profile; await navigate("daily");
    } else {
      const r=await submitDailyAnswer(value); state.daily.result=r; await loadProfile(); await navigate("daily");
    }
  } catch(err){toast(err.message,"bad")}
}

async function createSubmit(e) {
  e.preventDefault(); if (!(await requireAuthOrDemo())) return;
  const f=new FormData(e.currentTarget);
  const settings={title:f.get("title"),category:f.get("category"),difficulty:f.get("difficulty"),questionCount:+f.get("questionCount"),
    maxPlayers:+f.get("maxPlayers"),gameMode:f.get("gameMode"),secondsPerQuestion:+f.get("secondsPerQuestion")};
  if(settings.gameMode==="standard"&&settings.maxPlayers>250) toast("For rooms above 250, Event mode is strongly recommended.");
  try {
    if (state.config.demoMode || !isConfigured()) {
      const code=Math.random().toString(36).slice(2,8).toUpperCase();
      state.lobby={id:"demo-"+uid(),code,host_id:"demo",demoHost:true,status:"lobby",current_question_index:0,...{
        title:settings.title||"Demo Trivia",category:settings.category,difficulty:settings.difficulty,question_count:settings.questionCount,
        max_players:settings.maxPlayers,game_mode:settings.gameMode,seconds_per_question:settings.secondsPerQuestion}};
      state.lobbyPlayers=[{user_id:"demo",username:demo.profile.username,avatar_url:""}]; demo.lobby=state.lobby; navigate("lobby");
    } else {
      const g=await createLobby(settings); state.lobby=g; await enterLobby(g.code);
    }
  } catch(err){toast(err.message,"bad")}
}

async function quickJoin(code) {
  if(!code||code.trim().length<4){toast("Enter a lobby code.","bad");return}
  if(!(await requireAuthOrDemo())) return;
  try {
    if(state.config.demoMode||!isConfigured()){toast("Demo mode can host a local test lobby. Connect Supabase for cross-device joining.");return navigate("create")}
    await joinLobby(code); await enterLobby(code);
  } catch(e){toast(e.message,"bad")}
}

async function enterLobby(code) {
  cleanupRealtime();
  const g=await getLobby(code); if(!g) throw new Error("Lobby not found.");
  state.lobby=g; state.lobbyPlayers=await getLobbyPlayers(g.id);
  if(g.status!=="lobby"){ state.currentQuestion=await getCurrentQuestion(g.id); if(g.status==="results") state.roundResults=await getRoundResults(g.id); }
  subscribeLobby(g.id, ()=>refreshLobby(code));
  await navigate("lobby");
}

async function refreshLobby(code) {
  clearTimeout(refreshTimer); refreshTimer=setTimeout(async()=>{
    try{
      const g=await getLobby(code); if(!g)return;
      state.lobby=g; state.lobbyPlayers=await getLobbyPlayers(g.id);
      if(g.status==="question"||g.status==="results"){state.currentQuestion=await getCurrentQuestion(g.id);}
      if(g.status==="results"||g.status==="finished") state.roundResults=await getRoundResults(g.id);
      if(state.view==="lobby") await navigate("lobby");
    }catch(e){console.warn(e)}
  },120);
}

async function hostStart() {
  try{
    if(state.lobby.demoHost){
      state.lobby.status="question"; state.lobby.current_question_index=0; state.currentQuestion={...SAMPLE[0]}; answerStartedAt=performance.now(); return navigate("lobby");
    }
    await startLobby(state.lobby.id); await refreshLobby(state.lobby.code);
  }catch(e){toast(e.message,"bad")}
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
  }catch(err){toast(err.message,"bad")}
}

async function hostReveal() {
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
    await revealRound(state.lobby.id); await refreshLobby(state.lobby.code);
  }catch(e){toast(e.message,"bad")}
}

async function hostNext() {
  try{
    if(state.lobby.demoHost){
      if(state.lobby.current_question_index+1>=state.lobby.question_count||state.lobby.current_question_index+1>=SAMPLE.length){
        state.lobby.status="finished"; return navigate("lobby");
      }
      state.lobby.current_question_index++; state.lobby.status="question";
      state.currentQuestion={...SAMPLE[state.lobby.current_question_index%SAMPLE.length]}; state.roundResults=null; state._demoAnswer=null; answerStartedAt=performance.now();
      return navigate("lobby");
    }
    await nextRound(state.lobby.id); await refreshLobby(state.lobby.code);
  }catch(e){toast(e.message,"bad")}
}

function startTimer() {
  const bar=$("#timer-bar"); if(!bar)return; answerStartedAt=performance.now();
  const total=(state.lobby.seconds_per_question||20)*1000;
  const start=Date.now();
  const tick=()=>{ if(!$("#timer-bar"))return; const left=Math.max(0,1-(Date.now()-start)/total); bar.style.transform=`scaleX(${left})`; if(left>0)requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

async function profileSubmit(e){
  e.preventDefault(); const username=new FormData(e.currentTarget).get("username").trim();
  if(username.length<2){toast("Display name must be at least 2 characters.","bad");return}
  try{
    if(state.config.demoMode||!isConfigured()){demo.profile.username=username;state.profile=demo.profile;toast("Demo profile updated");navigate("profile")}
    else{await updateProfile(username);toast("Profile saved");navigate("profile")}
  }catch(err){toast(err.message,"bad")}
}

document.addEventListener("keydown", e=>{
  if(e.key==="Enter"&&document.activeElement?.id==="quick-code") quickJoin(document.activeElement.value);
});

subscribe(()=>{});

async function boot() {
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
  demoInit();
  await initSupabase();
  if(state.session){
    try{await loadProfile();}catch(e){console.warn(e)}
  }
  await initTwitch();

  const params=new URLSearchParams(location.search);
  const overlay=params.get("overlay");
  if(overlay){overlayView(overlay.toUpperCase());return}

  const join=params.get("join");
  if(join){
    if(state.session) { try{await joinLobby(join);await enterLobby(join);return}catch(e){toast(e.message,"bad")} }
    else {
      sessionStorage.setItem("pending_join",join.toUpperCase());
      if(!state.config.demoMode&&isConfigured()){toast("Sign in to join this lobby.");}
    }
  }
  const pending=sessionStorage.getItem("pending_join");
  if(pending&&state.session){sessionStorage.removeItem("pending_join");try{await joinLobby(pending);await enterLobby(pending);return}catch(e){toast(e.message,"bad")}}
  navigate("home");
}
boot();
