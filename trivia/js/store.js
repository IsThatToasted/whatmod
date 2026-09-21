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
  boardGame: null,
  daily: null,
  practice: null,
  libraryItems: [],
  categories: [],
  libraryFilters: { search: "", category: "", difficulty: "any", sort: "new" },
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
  // New players begin at Level 0. Each level requires progressively more total XP:
  // L1=250, L2=1000, L3=2250, L4=4000, ...
  return Math.max(0, Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 250)));
}

export function xpToNextLevel(xp = 0) {
  const current = Math.max(0, Number(xp) || 0);
  const level = levelFromXp(current);
  const floor = Math.pow(level, 2) * 250;
  const ceil = Math.pow(level + 1, 2) * 250;
  return {
    level,
    floor,
    ceil,
    current,
    needed: Math.max(0, ceil - current),
    progress: Math.max(0, Math.min(1, (current - floor) / Math.max(1, ceil - floor)))
  };
}
