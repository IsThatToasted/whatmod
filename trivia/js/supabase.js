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
  if (state.supabase) await state.supabase.auth.signOut();
  setState({
    session: null, profile: null, lobby: null, lobbyPlayers: [],
    currentQuestion: null, roundResults: null, daily: null, practice: null
  });
}

export async function rpc(name, args = {}) {
  if (!state.supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await state.supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export async function syncMyGoogleProfile() {
  if (!state.session?.user || !state.supabase) return null;
  try { return await rpc("sync_my_google_profile"); }
  catch (error) { console.warn("Profile metadata sync skipped:", error.message); return null; }
}

export async function loadProfile() {
  if (!state.session?.user || !state.supabase) return null;
  await syncMyGoogleProfile();
  const { data, error } = await state.supabase
    .from("profiles")
    .select("user_id,username,username_customized,avatar_url,xp,wins,games_played,daily_streak,is_admin,created_at")
    .eq("user_id", state.session.user.id)
    .single();
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

export async function createLobby(settings) {
  const rows = await rpc("create_lobby", {
    p_category: settings.category,
    p_difficulty: settings.difficulty,
    p_question_count: settings.questionCount,
    p_max_players: settings.maxPlayers,
    p_game_mode: settings.gameMode,
    p_seconds_per_question: settings.secondsPerQuestion,
    p_title: settings.title || null
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function joinLobby(code) {
  const rows = await rpc("join_lobby", { p_code: code.trim().toUpperCase() });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function getLobby(code) {
  const rows = await rpc("get_lobby", { p_code: code.trim().toUpperCase() });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function getLobbyPlayers(gameId) {
  return await rpc("get_lobby_players", { p_game_id: gameId });
}

export async function startLobby(gameId) {
  return await rpc("start_lobby", { p_game_id: gameId });
}

export async function getCurrentQuestion(gameId) {
  const rows = await rpc("get_current_question", { p_game_id: gameId });
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

export async function revealRound(gameId) {
  return await rpc("reveal_round", { p_game_id: gameId });
}

export async function nextRound(gameId) {
  return await rpc("next_round", { p_game_id: gameId });
}

export async function getRoundResults(gameId) {
  const rows = await rpc("get_round_results", { p_game_id: gameId });
  return rows || [];
}

export async function getDailyState() {
  const rows = await rpc("get_daily_state");
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
  const rows = await rpc("get_practice_question", { p_session_id: sessionId });
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

export function subscribeLobby(gameId, onChange) {
  if (!state.supabase) return null;
  const channel = state.supabase.channel(`game:${gameId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` }, onChange)
    .subscribe();
  state.subscriptions.push(channel);
  return channel;
}
