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
const firstName = value => String(value || "Player").trim().split(/\s+/)[0] || "Player";
const initials = value => String(value || "?").trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||"").join("") || "?";
const categoryGlyph = value => ({Science:"⚗",Technology:"⌁",History:"⌛",Geography:"⌖",Animals:"◌",Space:"✦",Sports:"◆",Entertainment:"★",Business:"▰",Any:"✦"}[value] || "✦");
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
  const avatar = p?.avatar_url || state.session?.user?.user_metadata?.avatar_url || state.session?.user?.user_metadata?.picture || "";
  const name = p?.username || state.session?.user?.user_metadata?.full_name || state.session?.user?.user_metadata?.name || "Player";
  return `
  <div class="game-bg" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
  <header class="topbar game-hud">
    <button class="brand plain" data-nav="home"><span class="brand-mark"><b>?</b></span><span class="brand-copy"><strong>${esc(state.config.appName || "WhatMod Trivia")}</strong><small>PLAY • GUESS • CLIMB</small></span></button>
    <nav class="desktop-nav hud-nav">
      <button class="nav-pill ${state.view==="home"?"active":""}" data-nav="home"><span>▶</span> Play</button>
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
    <button data-nav="leaderboard" class="${state.view==="leaderboard"?"active":""}"><span>♛</span>Ranks</button>
    <button data-nav="profile" class="${state.view==="profile"?"active":""}"><span>☺</span>Player</button>
  </nav>`;
}

function guestBanner() {
  if (state.session) return "";
  return `<div class="guest-quest"><span class="quest-dot">!</span><div><b>Guest run</b><small>Sign in with Google to keep XP, streaks, wins and your player name.</small></div><button class="btn tiny primary" data-action="login">Save progress</button></div>`;
}

function homeView() {
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

    <section class="play-grid">
      <article class="play-card daily-card">
        <div class="card-top"><span class="mode-badge hot">DAILY QUEST</span><span class="card-glyph">∞</span></div>
        <div class="card-art"><div class="planet"><i></i></div><div class="spark s1">✦</div><div class="spark s2">✧</div></div>
        <div class="card-copy"><h2>Today's Estimate</h2><p>One shot. One global question. Get close enough to climb.</p></div>
        <div class="reward-row"><span>REWARD</span><b>Precision XP + Streak</b></div>
        <button class="btn play-btn primary" data-action="daily"><span>Play daily</span><b>→</b></button>
      </article>

      <article class="play-card party-card">
        <div class="card-top"><span class="mode-badge">PARTY MODE</span><span class="card-glyph">♟</span></div>
        <div class="party-faces"><span>⚡</span><span>★</span><span>◆</span><span>+</span></div>
        <div class="card-copy"><h2>Host a Game</h2><p>Build a custom lobby for friends, classes, Discord, or your stream.</p></div>
        <div class="mini-tags"><span>2–20K players</span><span>Custom rules</span><span>Live scores</span></div>
        <button class="btn play-btn" data-nav="create"><span>Create lobby</span><b>＋</b></button>
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
      <article class="hud-panel streamer-panel">
        <span class="stream-icon">◈</span><div><small>CREATOR MODE</small><b>Going live?</b><p>Make a Twitch-sized room with an OBS join overlay.</p></div><button class="btn tiny" data-nav="create" data-mode="event">Launch</button>
      </article>
    </section>

    <section class="category-rail"><span>PLAY YOUR WAY</span>${["Science","Technology","History","Geography","Animals","Space"].map(c=>`<i>${categoryGlyph(c)} ${c}</i>`).join("")}</section>
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
          <label class="game-field"><span>CATEGORY</span><select name="category"><option value="Any">✦ Anything goes</option><option>Science</option><option>Technology</option><option>History</option><option>Geography</option><option>Animals</option><option>Space</option><option>Sports</option><option>Entertainment</option><option>Business</option></select></label>
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
        </section>
        <section class="loadout-card"><span>YOUR LOADOUT</span><b>Precision scoring</b><p>Numeric guesses earn partial credit from 0–1,000 based on how close they land.</p></section>
        <button class="btn primary launch-btn" type="submit"><span>Create game</span><b>GENERATE CODE →</b></button>
      </aside>
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
    <section class="party-room-head">
      <div><span class="mode-badge live"><i></i> LOBBY LIVE</span><h1>${esc(g.title || "Trivia Party")}</h1><p>Invite the squad. The host starts when everyone is ready.</p></div>
      <div class="party-code"><small>PARTY CODE</small><strong>${esc(g.code)}</strong><button data-copy="${esc(g.code)}">COPY</button></div>
    </section>

    <section class="party-layout">
      <div class="party-main">
        <section class="hud-panel invite-card">
          <div><small>INVITE LINK</small><b>${esc(joinUrl)}</b></div><button class="btn tiny" data-copy="${esc(joinUrl)}">Copy link</button><a class="btn tiny ghost" target="_blank" rel="noopener" href="?overlay=${encodeURIComponent(g.code)}">OBS overlay</a>
        </section>
        <section class="hud-panel roster-card">
          <div class="panel-title"><span>♟</span><div><small>PARTY ROSTER</small><b>${players.length} / ${g.max_players} joined</b></div><strong class="ready-chip">READY</strong></div>
          <div class="roster-grid">${players.map((p,i)=>`<article class="roster-player ${p.user_id===g.host_id?"host":""}"><span class="roster-avatar">${p.avatar_url?`<img src="${esc(p.avatar_url)}">`:`${esc(initials(p.username))}`}</span><div><b>${esc(p.username||"Player")}</b><small>${p.user_id===g.host_id?"HOST":"PLAYER " + String(i+1).padStart(2,"0")}</small></div>${p.user_id===g.host_id?`<i>♛</i>`:`<i>✓</i>`}</article>`).join("") || `<div class="empty">Your party is waiting for its first player…</div>`}</div>
        </section>
      </div>

      <aside class="party-side">
        <section class="hud-panel rules-card"><small>GAME RULES</small><h3>Match loadout</h3>
          <div class="rule-row"><span>${categoryGlyph(g.category)} Category</span><b>${esc(g.category)}</b></div>
          <div class="rule-row"><span>⚡ Difficulty</span><b>${esc(g.difficulty)}</b></div>
          <div class="rule-row"><span>◫ Rounds</span><b>${g.question_count}</b></div>
          <div class="rule-row"><span>◷ Timer</span><b>${g.seconds_per_question}s</b></div>
          <div class="rule-row"><span>◈ Network</span><b>${g.game_mode==="event"?"Event":"Standard"}</b></div>
        </section>
        ${meHost?`<section class="host-launch"><small>HOST CONTROL</small><h3>Everyone here?</h3><p>Starting locks the game rules and launches Round 1.</p><button class="btn primary launch-btn" data-action="start-game" ${players.length<1?"disabled":""}><span>START MATCH</span><b>▶</b></button></section>`:`<section class="host-launch waiting-card"><span class="waiting-pulse"></span><small>WAITING FOR HOST</small><h3>You're in.</h3><p>The first question will appear automatically.</p></section>`}
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

  if (g.status === "results") {
    const rows = state.roundResults || [];
    return appShell(`
      <section class="arena-head"><div><span class="round-chip">ROUND ${g.current_question_index+1} / ${g.question_count}</span><span class="mode-badge success">RESULTS</span></div><div class="arena-category">${categoryGlyph(q.category)} ${esc(q.category)} · ${esc(q.difficulty)}</div></section>
      <section class="results-arena">
        <div class="result-question"><small>THE QUESTION</small><h1>${esc(q.prompt)}</h1></div>
        <section class="correct-answer-card"><div><small>CORRECT ANSWER</small><strong>${formatAnswer(q.answer_numeric ?? q.answer_text ?? q.answer_display)} <em>${esc(q.unit||"")}</em></strong><p>${esc(q.explanation||"")}</p></div><span>✓</span></section>
        <div class="result-grid">
          <section class="hud-panel chart-card game-chart"><div class="panel-title"><span>⌁</span><div><small>THE CROWD</small><b>Guess distribution</b></div></div><canvas id="guess-chart"></canvas></section>
          <section class="hud-panel scoreboard"><div class="panel-title"><span>♛</span><div><small>LIVE RANKS</small><b>Round leaderboard</b></div><strong>${rows.length} answers</strong></div>${rows.slice(0,20).map((r,i)=>`<div class="score-row ${r.is_me?"me":""}"><span class="score-place">${i+1}</span><b>${esc(r.username)}</b><span>+${r.score}</span><strong>${r.total_score}</strong></div>`).join("") || `<div class="empty">No answers this round.</div>`}</section>
        </div>
        ${host?`<button class="btn primary next-round-btn" data-action="next-round"><span>${g.current_question_index+1>=g.question_count?"FINISH MATCH":"NEXT ROUND"}</span><b>→</b></button>`:`<div class="waiting-banner"><span></span> Waiting for the host to launch the next round…</div>`}
      </section>`);
  }

  return appShell(`
    <section class="arena-head"><div><span class="round-chip">ROUND ${g.current_question_index+1} / ${g.question_count}</span><span class="mode-badge live"><i></i> LIVE</span></div><div class="arena-category">${categoryGlyph(q.category)} ${esc(q.category)} · ${esc(q.difficulty)}</div></section>
    <section class="question-arena">
      <div class="arena-timer"><span>THINK FAST</span><div class="timer-line"><i id="timer-bar"></i></div><b>${g.seconds_per_question}s</b></div>
      <div class="question-number">Q${String(g.current_question_index+1).padStart(2,"0")}</div>
      <h1>${esc(q.prompt)}</h1>
      ${q.context ? `<p class="question-context">${esc(q.context)}</p>`:""}
      <form id="answer-form" class="answer-form game-answer-form">
        ${questionInput(q)}
        ${q.question_type!=="multiple_choice"?`<button class="btn primary lock-btn" type="submit"><span>LOCK IT IN</span><b>✓</b></button>`:""}
      </form>
      <div id="answer-status" class="answer-status"><span>◎</span> One answer. No take-backs.</div>
      ${host?`<button class="btn ghost host-reveal" data-action="reveal-round">Host: reveal results</button>`:""}
    </section>`);
}

function finalView() {
  const rows = state.roundResults || [];
  return appShell(`
    <section class="finish game-finish">
      <div class="victory-burst"><span>♛</span></div><div class="mode-badge hot">MATCH COMPLETE</div><h1>GG, party.</h1><p>${esc(state.lobby?.title || "Trivia Night")}</p>
      <div class="podium">${rows.slice(0,3).map((r,i)=>`<div class="podium-card p${i+1}"><span class="medal">${i===0?"♛":i===1?"◆":"▲"}</span><small>#${i+1}</small><b>${esc(r.username)}</b><strong>${r.total_score.toLocaleString()}</strong><em>points</em></div>`).join("")}</div>
      <div class="scoreboard hud-panel">${rows.slice(3,50).map((r,i)=>`<div class="score-row"><span class="score-place">${i+4}</span><b>${esc(r.username)}</b><span>${r.total_score.toLocaleString()} pts</span></div>`).join("")}</div>
      <button class="btn primary launch-btn finish-btn" data-nav="home"><span>BACK TO PLAY HUB</span><b>→</b></button>
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
        <article class="hud-panel daily-answer-panel"><small>TODAY'S QUESTION</small><h2>${esc(q.prompt)}</h2><div class="versus-answers"><span><small>YOU GUESSED</small><b>${formatAnswer(result.your_answer)} ${esc(q.unit||"")}</b></span><i>VS</i><span><small>ANSWER</small><b>${formatAnswer(result.answer_numeric ?? q.answer_numeric)} ${esc(q.unit||"")}</b></span></div><p>${esc(result.explanation||q.explanation||"")}</p></article>
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
        <h1>${esc(q.prompt)}</h1>
        ${q.context?`<p class="question-context">${esc(q.context)}</p>`:""}
        <form id="daily-form" class="answer-form game-answer-form">${questionInput(q,"daily")}<button class="btn primary lock-btn" type="submit"><span>SUBMIT FINAL GUESS</span><b>✓</b></button></form>
        <p class="one-shot"><span>◎</span> One shot per day. Accuracy determines XP.</p>
      </div>
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
    <section class="game-screen-head rank-head"><div><div class="mode-badge hot">GLOBAL LADDER</div><h1>Hall of guesses</h1><p>Lifetime XP decides who owns the top of the board.</p></div><div class="screen-number">♛</div></section>
    <section class="leader-shell">
      <div class="top-three">${rows.slice(0,3).map((r,i)=>`<article class="champ-card c${i+1}"><span class="champ-rank">#${i+1}</span><span class="leader-avatar">${r.avatar_url?`<img src="${esc(r.avatar_url)}">`:esc(initials(r.username))}</span><b>${esc(r.username)}</b><small>LEVEL ${levelFromXp(r.xp)}</small><strong>${Number(r.xp||0).toLocaleString()} XP</strong><em>${r.wins||0} wins</em></article>`).join("")}</div>
      <section class="hud-panel leaderboard game-leaderboard"><div class="leader-table-head"><span>RANK</span><span>PLAYER</span><span>LEVEL</span><span>WINS</span><span>XP</span></div>${rows.slice(3).map((r,i)=>`<div class="leader-row"><span class="place">${i+4}</span><span class="leader-avatar">${r.avatar_url?`<img src="${esc(r.avatar_url)}">`:esc(initials(r.username))}</span><div><b>${esc(r.username)}</b><small>${r.games_played||0} matches</small></div><span class="level-square">${levelFromXp(r.xp)}</span><span>${r.wins||0}</span><strong>${Number(r.xp||0).toLocaleString()}</strong></div>`).join("")}</section>
    </section>`);
}

function profileView() {
  if (!state.session && !state.config.demoMode) return appShell(`<section class="auth-gate player-gate"><div class="victory-burst"><span>☺</span></div><div class="mode-badge">PLAYER PROFILE</div><h1>Keep your progress.</h1><p>Google sign-in creates your player card from your Google name and avatar. You can change the display name anytime.</p><button class="btn primary launch-btn" data-action="login"><span>SIGN IN WITH GOOGLE</span><b>G</b></button></section>`);
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
    ${state.session?`<button class="btn danger-soft" data-action="logout">Sign out</button>`:`<button class="btn primary" data-action="login">Connect Google to save this player</button>`}
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

function demoInit() {
  demo = {
    profile: { user_id:"demo", username:"Demo Player", avatar_url:"", xp:0, wins:0, games_played:0, daily_streak:0, username_customized:false },
    lobby: null
  };
  if (state.config.demoMode || !isConfigured()) state.profile = demo.profile;
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
