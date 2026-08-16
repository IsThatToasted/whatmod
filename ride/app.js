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
  averageSpeed: el("averageSpeed"), maxSpeed: el("maxSpeed"), movingTime: el("movingTime"),
  gpsQuality: el("gpsQuality"), streamHealth: el("streamHealth"), heroGrid: el("heroGrid"),
  saveMoment: el("saveMoment"), reactionStatus: el("reactionStatus"),
  liveTab: el("liveTab"), replayTab: el("replayTab"),
  liveExplorerPanel: el("liveExplorerPanel"), replayExplorerPanel: el("replayExplorerPanel"),
  replayGrid: el("replayGrid"), emptyReplays: el("emptyReplays"), refreshReplays: el("refreshReplays"),
  replayView: el("replayView"), replayTitle: el("replayTitle"), replaySummary: el("replaySummary"),
  replaySpeed: el("replaySpeed"), replayDistance: el("replayDistance"),
  replayAverageSpeed: el("replayAverageSpeed"), replayMaxSpeed: el("replayMaxSpeed"),
  replayAltitude: el("replayAltitude"), replayBattery: el("replayBattery"),
  replayGPS: el("replayGPS"), replayMoving: el("replayMoving"),
  replayElapsed: el("replayElapsed"), replayDuration: el("replayDuration"),
  replaySlider: el("replaySlider"), replayMarkers: el("replayMarkers"),
  replayPlayPause: el("replayPlayPause"), replayRestart: el("replayRestart"),
  replayEventsList: el("replayEventsList"),
  replayVideo: el("replayVideo"), replayVideoCard: el("replayVideoCard"),
  noReplayVideo: el("noReplayVideo"),
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


async function loadReplays() {
  if (!els.replayGrid) return;

  try {
    const r = await fetch(`${cfg.rideApiUrl}?action=list-replays`, { cache: "no-store" });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error || `Replay server error ${r.status}`);

    const rides = body.rides || [];
    els.replayGrid.innerHTML = "";
    els.emptyReplays.classList.toggle("hidden", rides.length !== 0);

    for (const ride of rides) {
      const t = ride.telemetry || {};
      const card = document.createElement("a");
      card.className = "rider-card";
      card.href = `?ride=${encodeURIComponent(ride.share_slug)}`;
      card.innerHTML = `
        <div class="rider-card-top">
          <div>
            <div class="replay-card-badge">REPLAY</div>
            <h3>${escapeHtml(ride.title || "Scooter Ride")}</h3>
          </div>
          <div>↺</div>
        </div>
        <div class="rider-stats">
          <div class="rider-stat"><span>DISTANCE</span><strong>${Number(t.distance_miles || 0).toFixed(2)} mi</strong></div>
          <div class="rider-stat"><span>MAX</span><strong>${Number(t.max_speed_mph || 0).toFixed(1)} mph</strong></div>
          <div class="rider-stat"><span>TIME</span><strong>${fmtTime(t.elapsed_seconds)}</strong></div>
        </div>
        <div class="rider-card-foot">
          <span>${new Date(ride.ended_at).toLocaleDateString()}</span>
          <span>${ride.event_count || 0} moments/reactions · Replay →</span>
        </div>`;
      els.replayGrid.appendChild(card);
    }
  } catch (err) {
    fail(err.message || String(err));
  }
}

function showExplorerPanel(mode) {
  const replay = mode === "replays";
  els.liveExplorerPanel?.classList.toggle("hidden", replay);
  els.replayExplorerPanel?.classList.toggle("hidden", !replay);
  els.liveTab?.classList.toggle("active", !replay);
  els.replayTab?.classList.toggle("active", replay);

  if (replay) loadReplays();
}

els.liveTab?.addEventListener("click", () => showExplorerPanel("live"));
els.replayTab?.addEventListener("click", () => showExplorerPanel("replays"));
els.refreshReplays?.addEventListener("click", loadReplays);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
let rideId, room, map, marker;
let viewerSessionId = null;
let heartbeatTimer = null;
let rideStatusTimer = null;
let transitioningToReplay = false;
let replayRefreshTimer = null;
let route = [];
let routeReady = false;
let replayMap = null;
let replayMarker = null;
let replayTelemetry = [];
let replayEvents = [];
let replayIndex = 0;
let replayTimer = null;

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
  if (els.averageSpeed) els.averageSpeed.textContent = Number(t.average_speed_mph || 0).toFixed(1);
  if (els.maxSpeed) els.maxSpeed.textContent = Number(t.max_speed_mph || 0).toFixed(1);
  if (els.movingTime) els.movingTime.textContent = fmtTime(t.moving_seconds || 0);
  if (els.gpsQuality) els.gpsQuality.textContent = String(t.gps_quality || "—").toUpperCase();

  const accuracy = Number(t.horizontal_accuracy_m || 0);
  els.gpsStatus.textContent = `GPS ● ±${Math.round(accuracy)}m`;
  els.lastUpdate.textContent = `Updated ${new Date(t.captured_at).toLocaleTimeString()}`;

  if (els.streamHealth) {
    const ageSeconds = Math.max(0, (Date.now() - new Date(t.captured_at).getTime()) / 1000);
    els.streamHealth.className = "stream-health";
    if (ageSeconds < 6) {
      els.streamHealth.textContent = "● STREAM HEALTH GOOD";
      els.streamHealth.classList.add("good");
    } else if (ageSeconds < 15) {
      els.streamHealth.textContent = "● TELEMETRY DELAYED";
      els.streamHealth.classList.add("warn");
    } else {
      els.streamHealth.textContent = "● CONNECTION WEAK";
      els.streamHealth.classList.add("bad");
    }
  }

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


function initReplayMap() {
  replayMap = new maplibregl.Map({
    container: "replayMap",
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

  replayMap.on("load", () => {
    replayMap.resize();
    const coords = replayTelemetry
      .map(t => [Number(t.longitude), Number(t.latitude)])
      .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));

    replayMap.addSource("replay-route", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
      },
    });

    replayMap.addLayer({
      id: "replay-route-line",
      type: "line",
      source: "replay-route",
      paint: { "line-color": "#66ffb3", "line-width": 4, "line-opacity": .85 },
    });

    if (coords.length) {
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0]),
      );
      replayMap.fitBounds(bounds, { padding: 50, maxZoom: 16 });
    }

    renderReplayFrame(0);
  });
}

function replayEventSeconds(event) {
  if (!replayTelemetry.length) return 0;
  const start = new Date(replayTelemetry[0].captured_at).getTime();
  return Math.max(0, Math.round((new Date(event.created_at).getTime() - start) / 1000));
}

function replayIndexForElapsed(seconds) {
  return nearestReplayIndex(Math.max(0, Math.round(seconds)));
}

function nearestReplayIndex(seconds) {
  if (!replayTelemetry.length) return 0;
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < replayTelemetry.length; i++) {
    const delta = Math.abs(Number(replayTelemetry[i].elapsed_seconds || 0) - seconds);
    if (delta < bestDelta) {
      best = i;
      bestDelta = delta;
    }
  }
  return best;
}

function renderReplayFrame(index, syncVideo = true) {
  if (!replayTelemetry.length) return;

  replayIndex = Math.max(0, Math.min(index, replayTelemetry.length - 1));
  const t = replayTelemetry[replayIndex];

  els.replaySpeed.textContent = Number(t.speed_mph || 0).toFixed(1);
  els.replayDistance.textContent = Number(t.distance_miles || 0).toFixed(2);
  els.replayAverageSpeed.textContent = Number(t.average_speed_mph || 0).toFixed(1);
  els.replayMaxSpeed.textContent = Number(t.max_speed_mph || 0).toFixed(1);
  els.replayAltitude.textContent = Math.round(Number(t.altitude_ft || 0));
  els.replayBattery.textContent = t.phone_battery == null ? "—" : Math.round(Number(t.phone_battery) * 100);
  els.replayGPS.textContent = String(t.gps_quality || "—").toUpperCase();
  els.replayMoving.textContent = fmtTime(t.moving_seconds || 0);
  els.replayElapsed.textContent = fmtTime(t.elapsed_seconds || 0);
  els.replaySlider.value = replayIndex;

  if (
    syncVideo &&
    els.replayVideo &&
    els.replayVideo.src &&
    Number.isFinite(Number(t.elapsed_seconds))
  ) {
    const target = Number(t.elapsed_seconds || 0);
    if (Math.abs((els.replayVideo.currentTime || 0) - target) > 1.0) {
      try { els.replayVideo.currentTime = target; } catch (_) {}
    }
  }

  const point = [Number(t.longitude), Number(t.latitude)];
  if (Number.isFinite(point[0]) && Number.isFinite(point[1]) && replayMap) {
    if (!replayMarker) {
      replayMarker = new maplibregl.Marker().setLngLat(point).addTo(replayMap);
    } else {
      replayMarker.setLngLat(point);
    }
    replayMap.easeTo({ center: point, duration: 250 });
  }
}

function stopReplayPlayback() {
  if (replayTimer) clearInterval(replayTimer);
  replayTimer = null;
  if (els.replayVideo && !els.replayVideo.paused) {
    els.replayVideo.pause();
  }
  if (els.replayPlayPause) els.replayPlayPause.textContent = "▶ Play";
}

function startReplayPlayback() {
  if (replayTelemetry.length < 2) return;

  els.replayPlayPause.textContent = "❚❚ Pause";

  if (els.replayVideo?.src) {
    els.replayVideo.play().catch(() => {});
    return;
  }

  if (replayTimer) return;
  replayTimer = setInterval(() => {
    if (replayIndex >= replayTelemetry.length - 1) {
      stopReplayPlayback();
      return;
    }
    renderReplayFrame(replayIndex + 1, false);
  }, 250);
}

async function startReplay(slug, fromLiveTransition = false) {
  els.viewerView.classList.add("hidden");
  els.explorerView.classList.add("hidden");
  els.replayView.classList.remove("hidden");
  els.liveBadge.textContent = "REPLAY";
  els.liveBadge.className = "badge offline";

  try {
    const response = await fetch(`${cfg.rideApiUrl}?action=replay&ride=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load replay");

    replayTelemetry = body.telemetry || [];
    replayEvents = body.events || [];

    if (replayRefreshTimer) {
      clearInterval(replayRefreshTimer);
      replayRefreshTimer = null;
    }

    if (body.recording_url && els.replayVideo) {
      els.replayVideo.src = body.recording_url;
      els.replayVideoCard?.classList.remove("hidden");
      els.noReplayVideo?.classList.add("hidden");

      els.replayVideo.addEventListener("timeupdate", () => {
        const idx = replayIndexForElapsed(els.replayVideo.currentTime || 0);
        renderReplayFrame(idx, false);
      });

      els.replayVideo.addEventListener("play", () => {
        els.replayPlayPause.textContent = "❚❚ Pause";
      });

      els.replayVideo.addEventListener("pause", () => {
        if (!replayTimer) els.replayPlayPause.textContent = "▶ Play";
      });

      els.replayVideo.addEventListener("ended", () => {
        stopReplayPlayback();
      });
    } else {
      if (els.replayVideo) {
        els.replayVideo.removeAttribute("src");
        els.replayVideo.load();
      }

      const recordingStatus = body.ride?.recording_status || "none";
      const recordingError = body.ride?.recording_error || "";

      if (els.noReplayVideo) {
        els.noReplayVideo.classList.remove("hidden");

        const heading = els.noReplayVideo.querySelector("h2");
        const paragraph = els.noReplayVideo.querySelector("p");

        if (["recording", "finalizing"].includes(recordingStatus)) {
          if (heading) heading.textContent = "Finalizing video…";
          if (paragraph) paragraph.textContent =
            "The ride has ended. LiveKit is finishing and uploading the MP4.";

          replayRefreshTimer = setInterval(async () => {
            try {
              const statusResponse = await fetch(
                `${cfg.rideApiUrl}?action=ride-status&ride=${encodeURIComponent(slug)}`,
                { cache: "no-store" }
              );
              if (!statusResponse.ok) return;
              const state = await statusResponse.json();

              if (state.video_ready || state.recording_status === "ready") {
                clearInterval(replayRefreshTimer);
                replayRefreshTimer = null;
                await startReplay(slug, false);
              } else if (state.recording_status === "error") {
                clearInterval(replayRefreshTimer);
                replayRefreshTimer = null;
                if (heading) heading.textContent = "Video recording failed";
                if (paragraph) paragraph.textContent =
                  state.recording_error || "The telemetry/map replay is still available.";
              }
            } catch (_) {}
          }, 4000);
        } else if (recordingStatus === "error") {
          if (heading) heading.textContent = "Video recording failed";
          if (paragraph) paragraph.textContent =
            recordingError || "The telemetry/map replay is still available.";
        } else {
          if (heading) heading.textContent = "No video recording";
          if (paragraph) paragraph.textContent =
            "This ride still has its full telemetry and map replay.";
        }
      }
    }

    if (!replayTelemetry.length) {
      throw new Error("This ride has no telemetry to replay.");
    }

    const ride = body.ride || {};
    els.replayTitle.textContent = ride.title || "Scooter Ride";

    const last = replayTelemetry[replayTelemetry.length - 1];
    els.replayDuration.textContent = fmtTime(last.elapsed_seconds || 0);
    els.replaySummary.textContent =
      `${Number(last.distance_miles || 0).toFixed(2)} mi · ${fmtTime(last.elapsed_seconds || 0)} · ${replayEvents.length} moments/reactions`;

    els.replaySlider.max = Math.max(0, replayTelemetry.length - 1);
    els.replaySlider.value = 0;

    els.replayMarkers.innerHTML = "";
    els.replayEventsList.innerHTML = "";

    for (const event of replayEvents) {
      const seconds = replayEventSeconds(event);
      const idx = nearestReplayIndex(seconds);
      const pct = replayTelemetry.length > 1 ? idx / (replayTelemetry.length - 1) * 100 : 0;

      const markerButton = document.createElement("button");
      markerButton.className = "replay-marker";
      markerButton.style.left = `${pct}%`;
      markerButton.textContent = event.emoji || (event.event_type === "moment" ? "📸" : "👋");
      markerButton.title = `${event.label || event.event_type} · ${fmtTime(seconds)}`;
      markerButton.addEventListener("click", () => {
        stopReplayPlayback();
        renderReplayFrame(idx);
      });
      els.replayMarkers.appendChild(markerButton);

      const card = document.createElement("div");
      card.className = "replay-event-card";
      card.innerHTML = `
        <div>${event.emoji || (event.event_type === "moment" ? "📸" : "👋")}</div>
        <strong>${escapeHtml(event.label || (event.event_type === "moment" ? "Saved moment" : "Viewer reaction"))}</strong>
        <span>${fmtTime(seconds)}</span>`;
      card.addEventListener("click", () => {
        stopReplayPlayback();
        renderReplayFrame(idx);
      });
      els.replayEventsList.appendChild(card);
    }

    els.replaySlider.addEventListener("input", () => {
      stopReplayPlayback();
      renderReplayFrame(Number(els.replaySlider.value));
    });

    els.replayPlayPause.addEventListener("click", () => {
      if (replayTimer) stopReplayPlayback();
      else startReplayPlayback();
    });

    els.replayRestart.addEventListener("click", () => {
      stopReplayPlayback();
      if (els.replayVideo?.src) {
        try { els.replayVideo.currentTime = 0; } catch (_) {}
      }
      renderReplayFrame(0, false);
    });

    initReplayMap();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => replayMap?.resize());
    });
  } catch (err) {
    fail(err.message || String(err));
  }
}


function stopLiveViewerTimers() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;

  if (rideStatusTimer) clearInterval(rideStatusTimer);
  rideStatusTimer = null;
}

async function transitionLiveToReplay() {
  if (transitioningToReplay || !shareSlug) return;
  transitioningToReplay = true;

  stopLiveViewerTimers();

  try {
    if (room) {
      await room.disconnect();
      room = null;
    }
  } catch (_) {}

  try {
    if (map) {
      map.remove();
      map = null;
    }
  } catch (_) {}

  els.viewerView.classList.add("hidden");
  await startReplay(shareSlug, true);
}

function startRideStatusWatch() {
  if (!shareSlug || rideStatusTimer) return;

  const check = async () => {
    try {
      const response = await fetch(
        `${cfg.rideApiUrl}?action=ride-status&ride=${encodeURIComponent(shareSlug)}`,
        { cache: "no-store" }
      );

      if (!response.ok) return;
      const status = await response.json();

      if (status.status === "ended") {
        await transitionLiveToReplay();
      }
    } catch (_) {
      // A temporary status-poll failure must not interrupt the live media.
    }
  };

  rideStatusTimer = setInterval(check, 4000);
}

async function startViewer() {
  els.viewerView.classList.remove("hidden");
  els.explorerView.classList.add("hidden");
  els.replayView.classList.add("hidden");
  els.liveBadge.textContent = "● LIVE";
  els.liveBadge.className = "badge live";
  initMap();

  try {
    const response = await fetch(`${cfg.rideApiUrl}?action=viewer-token&ride=${encodeURIComponent(shareSlug)}`);
    const info = await response.json();

    if (!response.ok) {
      if (response.status === 404) {
        els.viewerView.classList.add("hidden");
        if (map) {
          try { map.remove(); } catch (_) {}
          map = null;
        }
        await startReplay(shareSlug);
        return;
      }
      throw new Error(info.error || "Unable to open ride");
    }

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
    startRideStatusWatch();
  } catch (err) {
    fail(err.message || String(err));
  }
}


async function sendViewerEvent(eventType, emoji, label) {
  if (!shareSlug) return;

  if (els.reactionStatus) els.reactionStatus.textContent = "Sending…";

  try {
    const response = await fetch(`${cfg.rideApiUrl}?action=send-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ride: shareSlug,
        event_type: eventType,
        emoji,
        label,
      }),
    });

    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not send");

    if (els.reactionStatus) {
      els.reactionStatus.textContent =
        eventType === "moment" ? "Moment saved ✓" : "Sent ✓";
      setTimeout(() => { els.reactionStatus.textContent = ""; }, 1800);
    }
  } catch (err) {
    if (els.reactionStatus) els.reactionStatus.textContent = err.message || "Could not send";
  }
}

document.querySelectorAll(".reaction-button[data-emoji]").forEach(button => {
  button.addEventListener("click", () => {
    sendViewerEvent(
      "reaction",
      button.dataset.emoji || "👋",
      button.dataset.label || "Viewer reaction"
    );
  });
});

if (els.saveMoment) {
  els.saveMoment.addEventListener("click", () => {
    sendViewerEvent("moment", "📸", "Viewer saved this moment");
  });
}

document.querySelectorAll(".view-mode").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".view-mode").forEach(b => b.classList.remove("active"));
    button.classList.add("active");

    if (!els.heroGrid) return;
    els.heroGrid.classList.remove("video-only", "map-only");

    const mode = button.dataset.viewMode;
    if (mode === "video") els.heroGrid.classList.add("video-only");
    if (mode === "map") {
      els.heroGrid.classList.add("map-only");
      setTimeout(() => map?.resize(), 50);
    }
    if (mode === "split") setTimeout(() => map?.resize(), 50);
  });
});

shareSlug ? startViewer() : startExplorer();
