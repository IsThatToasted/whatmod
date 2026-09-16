import { state, setState, cleanupRealtime } from "./store.js";

let createClientFn = null;

async function loadSupabase() {
  if (createClientFn) return createClientFn;
  const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  createClientFn = mod.createClient;
  return createClientFn;
}

export function isConfigured() {
  const c = state.config;
  return !!(c.supabaseUrl && !c.supabaseUrl.includes("YOUR_PROJECT") &&
    c.supabasePublishableKey && !c.supabasePublishableKey.includes("REPLACE_ME"));
}

export async function initSupabase() {
  if (!isConfigured()) return null;
  const createClient = await loadSupabase();
  const client = createClient(state.config.supabaseUrl, state.config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    realtime: { params: { eventsPerSecond: 10 } }
  });
  state.supabase = client;
  const { data } = await client.auth.getSession();
  setState({ session: data.session || null });

  client.auth.onAuthStateChange((_event, session) => {
    setState({ session });
    if (!session) setState({ profile: null });
  });
  return client;
}

export async function signInGoogle() {
  if (!state.supabase) throw new Error("Supabase is not configured.");
  const redirectTo = state.config.publicUrl || new URL("./", location.href).href;
  const { error } = await state.supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo }
  });
  if (error) throw error;
}

export async function signOut() {
  cleanupRealtime();
  try { await clearTriviaPresence(); } catch {}
  if (state.supabase) await state.supabase.auth.signOut();
  setState({
    session: null, profile: null, lobby: null, lobbyPlayers: [],
    currentQuestion: null, roundResults: null, daily: null, practice: null, libraryItems: []
  });
}

export async function rpc(name, args = {}) {
  if (!state.supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await state.supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export async function touchTriviaPresence(page = "home", gameId = null, clientId = null) {
  if (!state.session?.user || !state.supabase) return null;
  try {
    return await rpc("touch_trivia_presence_v15", {
      p_page: String(page || "home").slice(0, 80),
      p_game_id: gameId || null,
      p_client_id: clientId || null
    });
  } catch (error) {
    // Presence is observability only; never make gameplay depend on it during a
    // rolling deploy where migration 015 may not have landed yet.
    if (!/touch_trivia_presence_v15|does not exist|schema cache/i.test(String(error?.message || ""))) console.warn("Presence heartbeat skipped:", error.message);
    return null;
  }
}

export async function clearTriviaPresence() {
  if (!state.session?.user || !state.supabase) return null;
  try { return await rpc("clear_trivia_presence_v15"); }
  catch { return null; }
}

export async function syncMyGoogleProfile() {
  if (!state.session?.user || !state.supabase) return null;
  try { return await rpc("sync_my_google_profile"); }
  catch (error) { console.warn("Profile metadata sync skipped:", error.message); return null; }
}

export async function loadProfile() {
  if (!state.session?.user || !state.supabase) return null;
  await syncMyGoogleProfile();
  let { data, error } = await state.supabase
    .from("profiles")
    .select("user_id,username,username_customized,avatar_url,xp,wins,games_played,daily_streak,is_admin,ui_theme,created_at")
    .eq("user_id", state.session.user.id)
    .single();
  // Keep the app playable during a rolling deploy if the V8 theme migration
  // has not reached Supabase yet. Theme sync simply remains local until 009 runs.
  if (error && /ui_theme/i.test(String(error.message || error.details || ""))) {
    const legacy = await state.supabase
      .from("profiles")
      .select("user_id,username,username_customized,avatar_url,xp,wins,games_played,daily_streak,is_admin,created_at")
      .eq("user_id", state.session.user.id)
      .single();
    data = legacy.data ? { ...legacy.data, ui_theme: "v1" } : null;
    error = legacy.error;
  }
  if (error) throw error;
  setState({ profile: data });
  return data;
}

export async function loadLeaderboard() {
  if (!state.supabase) return [];
  const { data, error } = await state.supabase
    .from("profiles")
    .select("user_id,username,avatar_url,xp,wins,games_played")
    .order("xp", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function updateProfile(username) {
  const data = await rpc("update_my_profile", { p_username: username });
  await loadProfile();
  return data;
}

export async function updateUiTheme(theme) {
  const normalized = theme === "v2" ? "v2" : "v1";
  const data = await rpc("update_my_ui_theme", { p_theme: normalized });
  await loadProfile();
  return data;
}

export async function createLobby(settings) {
  const rows = await rpc("create_lobby_v14", {
    p_category: settings.category,
    p_difficulty: settings.difficulty,
    p_question_count: settings.questionCount,
    p_max_players: settings.maxPlayers,
    p_game_mode: settings.gameMode,
    p_seconds_per_question: settings.secondsPerQuestion,
    p_title: settings.title || null,
    p_visibility: settings.visibility || "invite_only",
    p_allow_matchmaking: !!settings.allowMatchmaking
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function joinLobby(code) {
  const rows = await rpc("join_lobby_v14", { p_code: code.trim().toUpperCase() });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function getLobby(code) {
  const rows = await rpc("get_lobby_v14", { p_code: code.trim().toUpperCase() });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function getLobbyPlayers(gameId) {
  return await rpc("get_lobby_players_v14", { p_game_id: gameId });
}

export async function startLobby(gameId) {
  return await rpc("start_lobby_v14", { p_game_id: gameId });
}

export async function getCurrentQuestion(gameId) {
  const rows = await rpc("get_current_question_v6", { p_game_id: gameId });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function submitGameAnswer(gameId, value, responseMs) {
  const rows = await rpc("submit_game_answer", {
    p_game_id: gameId,
    p_answer: String(value),
    p_response_ms: Math.max(0, Math.round(responseMs || 0))
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function revealRound(gameId, expectedIndex) {
  return await rpc("reveal_round_v14", { p_game_id: gameId, p_expected_index: Number(expectedIndex) });
}

export async function nextRound(gameId, expectedIndex) {
  return await rpc("advance_round_v14", { p_game_id: gameId, p_expected_index: Number(expectedIndex) });
}

export async function getRoundResults(gameId) {
  const rows = await rpc("get_round_results_v14", { p_game_id: gameId });
  return rows || [];
}

export async function syncGameClock(gameId) {
  const rows = await rpc("sync_game_clock_v14", { p_game_id: gameId });
  return Array.isArray(rows) ? rows[0] : rows;
}


export async function matchmake() {
  const rows = await rpc("matchmake_v14");
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function returnToLobby(gameId) {
  return await rpc("return_to_lobby_v14", { p_game_id: gameId });
}

export async function getDailyState() {
  const rows = await rpc("get_daily_state_v6");
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function submitDailyAnswer(answer) {
  const rows = await rpc("submit_daily_answer", { p_answer: String(answer) });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function startPractice({ categories = [], difficulty = "any", questionCount = 10 } = {}) {
  const rows = await rpc("start_practice", {
    p_categories: categories,
    p_difficulty: difficulty,
    p_question_count: questionCount
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function getPracticeQuestion(sessionId) {
  const rows = await rpc("get_practice_question_v6", { p_session_id: sessionId });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function submitPracticeAnswer(sessionId, answer, responseMs = 0) {
  const rows = await rpc("submit_practice_answer", {
    p_session_id: sessionId,
    p_answer: String(answer),
    p_response_ms: Math.max(0, Math.round(responseMs || 0))
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function nextPracticeQuestion(sessionId) {
  const rows = await rpc("next_practice_question", { p_session_id: sessionId });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function getPracticeSummary(sessionId) {
  return await rpc("get_practice_summary", { p_session_id: sessionId });
}

export async function getQuestionCommunityStats(questionId) {
  const rows = await rpc("get_question_community_stats", { p_question_id: questionId });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function getQuestionVoteSummary(questionId) {
  const rows = await rpc("get_question_vote_summary", { p_question_id: questionId });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function voteQuestion(questionId, vote) {
  const rows = await rpc("vote_question", { p_question_id: questionId, p_vote: Number(vote) });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function adminDeleteQuestion(questionId, reason = null, practiceSessionId = null) {
  return await rpc("admin_delete_question_v10", { p_question_id: questionId, p_reason: reason, p_practice_session_id: practiceSessionId });
}

export async function getLibrarySessions({ search = null, category = null, difficulty = "any", sort = "new", limit = 30, offset = 0 } = {}) {
  const rows = await rpc("get_library_sessions", {
    p_search: search || null,
    p_category: category || null,
    p_difficulty: difficulty || "any",
    p_sort: sort || "new",
    p_limit: limit,
    p_offset: offset
  });
  return rows || [];
}

export async function startLibraryPractice(librarySessionId) {
  const rows = await rpc("start_library_practice", { p_library_session_id: librarySessionId });
  return Array.isArray(rows) ? rows[0] : rows;
}

export function subscribeLobby(gameId, onChange, onStatus) {
  if (!state.supabase) return null;
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel = state.supabase.channel(`game:${gameId}:${suffix}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, payload => onChange?.(payload))
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, payload => onChange?.(payload))
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, payload => onChange?.(payload))
    .subscribe(status => onStatus?.(status));
  state.subscriptions.push(channel);
  return channel;
}
