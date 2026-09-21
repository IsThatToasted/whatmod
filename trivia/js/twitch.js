import { state, setState } from "./store.js";

const LS_TOKEN = "whatmod_trivia_twitch_token";

function parseOAuthHash() {
  if (!location.hash.includes("access_token=")) return null;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("access_token");
  if (token) {
    localStorage.setItem(LS_TOKEN, token);
    history.replaceState({}, "", location.pathname + location.search);
  }
  return token;
}

export async function initTwitch() {
  const token = parseOAuthHash() || localStorage.getItem(LS_TOKEN);
  if (!token || !state.config.twitchClientId) return null;
  try {
    const r = await fetch("https://api.twitch.tv/helix/users", {
      headers: { "Authorization": `Bearer ${token}`, "Client-Id": state.config.twitchClientId }
    });
    if (!r.ok) throw new Error("Twitch token invalid");
    const body = await r.json();
    const user = body.data?.[0] || null;
    setState({ twitch: { ...state.twitch, token, user } });
    return user;
  } catch {
    localStorage.removeItem(LS_TOKEN);
    return null;
  }
}

export function connectTwitch() {
  const id = state.config.twitchClientId;
  if (!id) throw new Error("Add twitchClientId to config.js first.");
  const redirect = state.config.twitchRedirectUri || state.config.publicUrl || location.href.split("#")[0];
  const p = new URLSearchParams({
    response_type: "token",
    client_id: id,
    redirect_uri: redirect,
    scope: "user:read:chat user:write:chat",
    state: crypto.randomUUID()
  });
  location.href = `https://id.twitch.tv/oauth2/authorize?${p}`;
}

export function disconnectTwitch() {
  try { state.twitch.socket?.close(); } catch {}
  localStorage.removeItem(LS_TOKEN);
  setState({ twitch: { token: null, user: null, socket: null, chatters: [] } });
}

export async function announceLobby(code) {
  const { token, user } = state.twitch;
  if (!token || !user) throw new Error("Connect Twitch first.");
  const joinUrl = `${state.config.publicUrl || location.origin + location.pathname}?join=${encodeURIComponent(code)}`;
  const r = await fetch("https://api.twitch.tv/helix/chat/messages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Client-Id": state.config.twitchClientId,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      broadcaster_id: user.id,
      sender_id: user.id,
      message: `Trivia lobby ${code} is open — join here: ${joinUrl}`
    })
  });
  if (!r.ok) throw new Error(`Twitch announcement failed (${r.status})`);
  return await r.json();
}

export async function listenToTwitchChat(onCommand) {
  const { token, user } = state.twitch;
  if (!token || !user) throw new Error("Connect Twitch first.");
  try { state.twitch.socket?.close(); } catch {}

  const ws = new WebSocket("wss://eventsub.wss.twitch.tv/ws");
  state.twitch.socket = ws;

  ws.onmessage = async ev => {
    const msg = JSON.parse(ev.data);
    if (msg.metadata?.message_type === "session_welcome") {
      const sessionId = msg.payload.session.id;
      const r = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Client-Id": state.config.twitchClientId,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: "channel.chat.message",
          version: "1",
          condition: { broadcaster_user_id: user.id, user_id: user.id },
          transport: { method: "websocket", session_id: sessionId }
        })
      });
      if (!r.ok) console.warn("Twitch EventSub subscription failed", r.status);
    }
    if (msg.metadata?.subscription_type === "channel.chat.message") {
      const e = msg.payload?.event;
      const text = e?.message?.text || "";
      if (/^!trivia\b/i.test(text) || /^!join\b/i.test(text)) {
        const chatter = { id: e.chatter_user_id, name: e.chatter_user_name, text, at: Date.now() };
        state.twitch.chatters = [chatter, ...state.twitch.chatters.filter(x => x.id !== chatter.id)].slice(0, 30);
        onCommand?.(chatter);
      }
    }
  };
  return ws;
}
