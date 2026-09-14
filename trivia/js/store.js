export const state = {
  config: window.TRIVIA_CONFIG || {},
  supabase: null,
  session: null,
  profile: null,
  view: "home",
  lobby: null,
  lobbyPlayers: [],
  currentQuestion: null,
  roundResults: null,
  daily: null,
  subscriptions: [],
  twitch: { token: null, user: null, socket: null, chatters: [] },
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach(fn => fn(state));
}

export function cleanupRealtime() {
  for (const sub of state.subscriptions) {
    try { state.supabase?.removeChannel(sub); } catch {}
  }
  state.subscriptions = [];
}

export function levelFromXp(xp = 0) {
  // Smooth early progress, increasingly meaningful later levels.
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 250)) + 1);
}

export function xpToNextLevel(xp = 0) {
  const level = levelFromXp(xp);
  const floor = Math.pow(level - 1, 2) * 250;
  const ceil = Math.pow(level, 2) * 250;
  return { level, floor, ceil, current: xp, progress: (xp - floor) / Math.max(1, ceil - floor) };
}
