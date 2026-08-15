import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Room, RoomEvent, Track } from "https://esm.sh/livekit-client@2.15.6";

const cfg = window.SCOOTERCAST_CONFIG || {};
const qs = new URLSearchParams(location.search);
const shareSlug = qs.get("ride");

const els = Object.fromEntries(
  ["liveBadge","errorPanel","video","audio","videoPlaceholder","rideTitle","networkLabel",
   "speed","distance","heading","altitude","battery","elapsed","gpsStatus","lastUpdate"]
    .map(id => [id, document.getElementById(id)])
);

function fail(message) {
  els.errorPanel.textContent = message;
  els.errorPanel.classList.remove("hidden");
  els.liveBadge.textContent = "OFFLINE";
  els.liveBadge.className = "badge offline";
}

if (!shareSlug) fail("This ScooterCast link is missing its private ride code.");
if (!cfg.supabaseUrl || cfg.supabaseUrl.includes("YOUR_PROJECT")) fail("ScooterCast web config has not been set yet.");

const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
let rideId = null;
let room = null;
let map = null;
let marker = null;
let route = [];
let routeSourceReady = false;

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
          attribution: "© OpenStreetMap contributors"
        }
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }]
    },
    center: [-76.7, 39.96],
    zoom: 12
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.on("load", () => {
    map.addSource("route", {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } }
    });
    map.addLayer({
      id: "route-line",
      type: "line",
      source: "route",
      paint: { "line-color": "#66ffb3", "line-width": 4, "line-opacity": 0.85 }
    });
    routeSourceReady = true;
  });
}

function headingName(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function fmtTime(total) {
  total = Math.max(0, Number(total || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return h ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` :
             `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function applyTelemetry(t) {
  els.speed.textContent = Number(t.speed_mph || 0).toFixed(1);
  els.distance.textContent = Number(t.distance_miles || 0).toFixed(2);
  els.heading.textContent = `${headingName(Number(t.heading || 0))} ${Math.round(Number(t.heading || 0))}°`;
  els.altitude.textContent = Math.round(Number(t.altitude_ft || 0));
  els.battery.textContent = t.phone_battery == null ? "—" : Math.round(Number(t.phone_battery) * 100);
  els.elapsed.textContent = fmtTime(t.elapsed_seconds);

  const accuracy = Number(t.horizontal_accuracy_m);
  els.gpsStatus.textContent =
    accuracy <= 5 ? `GPS ● Excellent ±${Math.round(accuracy)}m` :
    accuracy <= 15 ? `GPS ● Good ±${Math.round(accuracy)}m` :
    `GPS ● ±${Math.round(accuracy || 0)}m`;

  const when = new Date(t.captured_at);
  els.lastUpdate.textContent = `Updated ${when.toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"})}`;

  const lngLat = [Number(t.longitude), Number(t.latitude)];
  if (!Number.isFinite(lngLat[0]) || !Number.isFinite(lngLat[1])) return;

  if (!marker) {
    const el = document.createElement("div");
    el.style.cssText = "width:22px;height:22px;border-radius:50%;background:#66ffb3;border:4px solid #071013;box-shadow:0 0 0 3px rgba(102,255,179,.35)";
    marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
    map.jumpTo({ center: lngLat, zoom: 15 });
  } else {
    marker.setLngLat(lngLat);
    map.easeTo({ center: lngLat, duration: 500 });
  }

  const last = route[route.length - 1];
  if (!last || Math.abs(last[0]-lngLat[0]) > .00001 || Math.abs(last[1]-lngLat[1]) > .00001) {
    route.push(lngLat);
    if (route.length > 3000) route = route.slice(-3000);
    if (routeSourceReady) {
      map.getSource("route").setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: route }
      });
    }
  }
}

async function loadLatestTelemetry() {
  if (!rideId) return;
  const { data } = await supabase
    .from("ride_telemetry")
    .select("*")
    .eq("ride_id", rideId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) applyTelemetry(data);
}

async function subscribeTelemetry() {
  await loadLatestTelemetry();

  supabase
    .channel(`telemetry-${rideId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "ride_telemetry",
      filter: `ride_id=eq.${rideId}`
    }, payload => applyTelemetry(payload.new))
    .subscribe();
}

function attachTrack(track) {
  if (track.kind === Track.Kind.Video) {
    track.attach(els.video);
    els.videoPlaceholder.classList.add("hidden");
  } else if (track.kind === Track.Kind.Audio) {
    track.attach(els.audio);
  }
}

async function connectLiveKit(info) {
  room = new Room({
    adaptiveStream: true,
    dynacast: true
  });

  room.on(RoomEvent.TrackSubscribed, (track) => attachTrack(track));
  room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());
  room.on(RoomEvent.Reconnecting, () => {
    els.networkLabel.textContent = "Reconnecting video…";
  });
  room.on(RoomEvent.Reconnected, () => {
    els.networkLabel.textContent = "Video connected";
  });
  room.on(RoomEvent.Disconnected, () => {
    els.networkLabel.textContent = "Video offline — telemetry may continue";
    els.videoPlaceholder.classList.remove("hidden");
  });

  await room.connect(info.livekit_url, info.viewer_token);
  els.networkLabel.textContent = "Video connected";

  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.track) attachTrack(publication.track);
    }
  }
}

async function start() {
  if (!shareSlug || !cfg.rideApiUrl) return;
  initMap();

  try {
    const response = await fetch(`${cfg.rideApiUrl}?action=viewer-token&ride=${encodeURIComponent(shareSlug)}`);
    const info = await response.json();
    if (!response.ok) throw new Error(info.error || "Unable to open ride");

    rideId = info.ride_id;
    els.rideTitle.textContent = info.title || "Scooter Ride";
    els.liveBadge.textContent = "● LIVE";
    els.liveBadge.className = "badge live";

    await Promise.all([
      subscribeTelemetry(),
      connectLiveKit(info)
    ]);
  } catch (err) {
    console.error(err);
    fail(err.message || String(err));
  }
}

start();
