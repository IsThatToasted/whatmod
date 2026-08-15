import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Room, RoomEvent, Track } from "https://esm.sh/livekit-client@2.15.6";

const cfg = window.SCOOTERCAST_CONFIG || {};
const qs = new URLSearchParams(location.search);
const shareSlug = qs.get("ride");
const el = id => document.getElementById(id);

const els = {
  liveBadge: el("liveBadge"), explorerCount: el("explorerCount"),
  errorPanel: el("errorPanel"), explorerView: el("explorerView"), viewerView: el("viewerView"),
  riderGrid: el("riderGrid"), emptyExplorer: el("emptyExplorer"), refreshExplorer: el("refreshExplorer"),
  video: el("video"), audio: el("audio"), videoPlaceholder: el("videoPlaceholder"),
  videoMessage: el("videoMessage"), rideTitle: el("rideTitle"), networkLabel: el("networkLabel"),
  speed: el("speed"), distance: el("distance"), heading: el("heading"), altitude: el("altitude"),
  battery: el("battery"), elapsed: el("elapsed"), gpsStatus: el("gpsStatus"), lastUpdate: el("lastUpdate"),
};

function fail(message) {
  els.errorPanel.textContent = message;
  els.errorPanel.classList.remove("hidden");
}

function fmtTime(total) {
  total = Math.max(0, Number(total || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return h ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` :
    `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function ageLabel(iso) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  return `${Math.floor(sec/3600)}h ago`;
}

async function startExplorer() {
  els.explorerView.classList.remove("hidden");
  els.viewerView.classList.add("hidden");
  els.liveBadge.textContent = "EXPLORER";
  els.liveBadge.className = "badge offline";

  async function load() {
    els.errorPanel.classList.add("hidden");
    try {
      const r = await fetch(`${cfg.rideApiUrl}?action=list-live`, { cache: "no-store" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `Explorer server error ${r.status}`);

      const rides = body.rides || [];
      els.explorerCount.textContent = `${rides.length} RIDER${rides.length === 1 ? "" : "S"}`;
      els.explorerCount.classList.remove("hidden");
      els.riderGrid.innerHTML = "";
      els.emptyExplorer.classList.toggle("hidden", rides.length !== 0);

      for (const ride of rides) {
        const t = ride.telemetry || {};
        const card = document.createElement("a");
        card.className = "rider-card";
        card.href = `?ride=${encodeURIComponent(ride.share_slug)}`;
        card.innerHTML = `
          <div class="rider-card-top">
            <div>
              <div class="eyebrow">LIVE RIDE</div>
              <h3>${escapeHtml(ride.title || "Scooter Ride")}</h3>
            </div>
            <div class="live-dot">● LIVE</div>
          </div>
          <div class="rider-stats">
            <div class="rider-stat"><span>SPEED</span><strong>${Number(t.speed_mph || 0).toFixed(1)} mph</strong></div>
            <div class="rider-stat"><span>DISTANCE</span><strong>${Number(t.distance_miles || 0).toFixed(2)} mi</strong></div>
            <div class="rider-stat"><span>TIME</span><strong>${fmtTime(t.elapsed_seconds)}</strong></div>
          </div>
          <div class="rider-card-foot">
            <span>Started ${ageLabel(ride.started_at)}</span>
            <span>Watch live →</span>
          </div>`;
        els.riderGrid.appendChild(card);
      }
    } catch (err) {
      fail(err.message || String(err));
    }
  }

  els.refreshExplorer.addEventListener("click", load);
  await load();
  setInterval(load, 15000);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
let rideId, room, map, marker;
let viewerSessionId = null;
let heartbeatTimer = null;
let route = [];
let routeReady = false;

function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors",
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    },
    center: [-76.7, 39.96],
    zoom: 12,
  });

  map.on("load", () => {
    map.addSource("route", {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } },
    });
    map.addLayer({
      id: "route-line", type: "line", source: "route",
      paint: { "line-color": "#66ffb3", "line-width": 4, "line-opacity": .85 },
    });
    routeReady = true;
  });
}

function headingName(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function applyTelemetry(t) {
  els.speed.textContent = Number(t.speed_mph || 0).toFixed(1);
  els.distance.textContent = Number(t.distance_miles || 0).toFixed(2);
  els.heading.textContent = `${headingName(Number(t.heading || 0))} ${Math.round(Number(t.heading || 0))}°`;
  els.altitude.textContent = Math.round(Number(t.altitude_ft || 0));
  els.battery.textContent = t.phone_battery == null ? "—" : Math.round(Number(t.phone_battery) * 100);
  els.elapsed.textContent = fmtTime(t.elapsed_seconds);
  const accuracy = Number(t.horizontal_accuracy_m || 0);
  els.gpsStatus.textContent = `GPS ● ±${Math.round(accuracy)}m`;
  els.lastUpdate.textContent = `Updated ${new Date(t.captured_at).toLocaleTimeString()}`;

  const point = [Number(t.longitude), Number(t.latitude)];
  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;

  if (!marker) {
    marker = new maplibregl.Marker().setLngLat(point).addTo(map);
    map.jumpTo({ center: point, zoom: 15 });
  } else {
    marker.setLngLat(point);
    map.easeTo({ center: point, duration: 500 });
  }

  route.push(point);
  if (route.length > 3000) route = route.slice(-3000);
  if (routeReady) {
    map.getSource("route").setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: route },
    });
  }
}

async function subscribeTelemetry() {
  const { data } = await supabase.from("ride_telemetry").select("*")
    .eq("ride_id", rideId).order("captured_at", { ascending: false }).limit(1).maybeSingle();
  if (data) applyTelemetry(data);

  supabase.channel(`telemetry-${rideId}`)
    .on("postgres_changes", {
      event: "INSERT", schema: "public", table: "ride_telemetry",
      filter: `ride_id=eq.${rideId}`,
    }, payload => applyTelemetry(payload.new))
    .subscribe();
}

function attachTrack(track) {
  if (track.kind === Track.Kind.Video) {
    track.attach(els.video);
    els.video.muted = true;
    els.video.play().catch(() => {});
    els.videoPlaceholder.classList.add("hidden");
    els.networkLabel.textContent = "Video connected";
  } else if (track.kind === Track.Kind.Audio) {
    track.attach(els.audio);
    els.audio.play().catch(() => {
      els.networkLabel.textContent = "Video live · tap page to enable audio";
      document.addEventListener("click", () => els.audio.play().catch(() => {}), { once: true });
    });
  }
}

function attachExistingRemoteTracks() {
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.track) attachTrack(publication.track);
    }
  }
}

async function connectLiveKit(info) {
  room = new Room({ adaptiveStream: true, dynacast: true });

  room.on(RoomEvent.TrackSubscribed, track => attachTrack(track));
  room.on(RoomEvent.TrackUnsubscribed, track => track.detach());
  room.on(RoomEvent.TrackPublished, publication => {
    // Auto-subscribe is enabled by default; TrackSubscribed will attach it.
    els.networkLabel.textContent = `Media published: ${publication.kind}`;
  });
  room.on(RoomEvent.TrackSubscriptionFailed, sid => {
    els.videoMessage.textContent = `Could not subscribe to camera track ${sid}.`;
    els.networkLabel.textContent = "Camera subscription failed";
  });
  room.on(RoomEvent.Reconnecting, () => els.networkLabel.textContent = "Reconnecting video…");
  room.on(RoomEvent.Reconnected, () => {
    els.networkLabel.textContent = "Video connected";
    attachExistingRemoteTracks();
  });
  room.on(RoomEvent.Disconnected, () => {
    els.networkLabel.textContent = "Video offline — telemetry may continue";
    els.videoPlaceholder.classList.remove("hidden");
  });

  await room.connect(info.livekit_url, info.viewer_token);
  els.networkLabel.textContent = "Connected · waiting for camera";
  attachExistingRemoteTracks();
}

async function startViewer() {
  els.viewerView.classList.remove("hidden");
  els.explorerView.classList.add("hidden");
  els.liveBadge.textContent = "● LIVE";
  els.liveBadge.className = "badge live";
  initMap();

  try {
    const response = await fetch(`${cfg.rideApiUrl}?action=viewer-token&ride=${encodeURIComponent(shareSlug)}`);
    const info = await response.json();
    if (!response.ok) throw new Error(info.error || "Unable to open ride");

    rideId = info.ride_id;
    viewerSessionId = info.viewer_session_id || null;
    els.rideTitle.textContent = info.title || "Scooter Ride";

    if (viewerSessionId) {
      const heartbeat = async () => {
        try {
          await fetch(`${cfg.rideApiUrl}?action=viewer-heartbeat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ viewer_session_id: viewerSessionId }),
            keepalive: true,
          });
        } catch (_) {}
      };

      await heartbeat();
      heartbeatTimer = setInterval(heartbeat, 30000);
    }

    await Promise.all([subscribeTelemetry(), connectLiveKit(info)]);
  } catch (err) {
    fail(err.message || String(err));
  }
}

shareSlug ? startViewer() : startExplorer();
