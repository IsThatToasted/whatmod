const $ = (id) => document.getElementById(id);
const storeKey = 'tripforge.v1';
const GOOGLE_MAX_WAYPOINTS = 8; // Google Maps URLs reliably support about 10 total route points: origin + 8 stops + destination.

const state = {
  start: null,
  end: null,
  route: null,
  gasStations: [],
  events: [],
  selectedEventId: null,
  tripDate: new Date().toISOString().slice(0,10)
};

const map = L.map('map', { zoomControl: false }).setView([39.95, -75.16], 7);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let routingControl = null;
let markers = L.layerGroup().addTo(map);
let gasMarkers = L.layerGroup().addTo(map);


function locationLabel(loc) {
  if (!loc) return '';
  return loc.address || loc.label || loc.location || loc.name || '';
}
function locationCoords(loc) {
  if (!loc || loc.lat == null || loc.lng == null) return '';
  return `${loc.lat},${loc.lng}`;
}
function navQuery(loc, includeName=true) {
  const label = locationLabel(loc);
  const coords = locationCoords(loc);
  if (label && !/^OpenStreetMap fuel location$/i.test(label)) {
    return includeName && loc.name ? `${loc.name}, ${label}` : label;
  }
  return coords || label;
}
function googleWaypointQuery(loc) {
  // Coordinates survive Google Maps URL parsing better than long OSM/Nominatim addresses,
  // especially when several gas stops are chained as waypoints.
  return locationCoords(loc) || navQuery(loc, false);
}
function externalUrl(app, loc) {
  const q = navQuery(loc);
  const coords = locationCoords(loc);
  if (!q) return '#';
  if (app === 'google') return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  if (app === 'apple') return `https://maps.apple.com/?q=${encodeURIComponent(q)}`;
  if (app === 'waze') return coords ? `https://waze.com/ul?ll=${encodeURIComponent(coords)}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
  return '#';
}

function selectedGasStopsForRoute() {
  return [...state.gasStations]
    .filter(g => g.plannedStop)
    .sort((a,b) => (a.routeProgress ?? Infinity) - (b.routeProgress ?? Infinity))
    .slice(0, GOOGLE_MAX_WAYPOINTS);
}
function selectedGasCount() {
  return state.gasStations.filter(g => g.plannedStop).length;
}
function routeUrl(app) {
  if (!state.start || !state.end) return '#';
  const origin = navQuery(state.start, false);
  const dest = navQuery(state.end, false);
  const destCoords = locationCoords(state.end);
  if (app === 'google') {
    const stops = selectedGasStopsForRoute();
    const waypointPart = stops.length ? `&waypoints=${stops.map(g => encodeURIComponent(googleWaypointQuery(g))).join('%7C')}` : '';
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=driving${waypointPart}`;
  }
  if (app === 'apple') return `https://maps.apple.com/?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(dest)}&dirflg=d`;
  if (app === 'waze') return destCoords ? `https://waze.com/ul?ll=${encodeURIComponent(destCoords)}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(dest)}&navigate=yes`;
  return '#';
}
function openExternal(app, loc) {
  const url = loc ? externalUrl(app, loc) : routeUrl(app);
  if (url === '#') { alert('Add or select a location first.'); return; }
  if (!loc && app === 'google') {
    const total = selectedGasCount();
    if (total > GOOGLE_MAX_WAYPOINTS) {
      alert(`Google Maps route links can preload only ${GOOGLE_MAX_WAYPOINTS} fuel stops here. Opening the first ${GOOGLE_MAX_WAYPOINTS} planned stops in route order. The remaining ${total - GOOGLE_MAX_WAYPOINTS} stop(s) can be opened individually from the fuel list.`);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
function stationDisplayAddress(g) {
  return [g.name, g.address].filter(Boolean).join(', ');
}
async function reverseAddress(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lng);
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Reverse geocoding failed');
  const data = await res.json();
  return data.display_name || '';
}
async function enrichStationAddresses(stations) {
  for (const g of stations) {
    if (g.address && g.address !== 'OpenStreetMap fuel location') continue;
    try {
      const addr = await reverseAddress(g.lat, g.lng);
      if (addr) g.address = addr;
      await new Promise(r => setTimeout(r, 120));
    } catch (_) {}
  }
}

function setStatus(text, kind='muted') {
  const el = $('routeStatus');
  el.textContent = text;
  el.className = `pill ${kind}`;
}

function toastSave() {
  $('saveState').textContent = `Saved ${new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`;
}

function save() {
  localStorage.setItem(storeKey, JSON.stringify(state));
  toastSave();
}

function load() {
  try {
    const raw = localStorage.getItem(storeKey);
    if (!raw) return;
    const loaded = JSON.parse(raw);
    Object.assign(state, loaded);
    $('tripDate').value = state.tripDate || new Date().toISOString().slice(0,10);
    renderTimeline();
    renderGasList();
    updateStats();
    if (state.start) $('startInput').value = state.start.label || '';
    if (state.end) $('endInput').value = state.end.label || '';
  } catch (err) { console.warn(err); }
}

async function geocode(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  if (!data.length) throw new Error(`No result for ${query}`);
  return { lat: +data[0].lat, lng: +data[0].lon, label: data[0].display_name };
}

function locationPopup(title, loc) {
  const safeTitle = escapeHtml(title);
  const safeLabel = escapeHtml(locationLabel(loc) || locationCoords(loc));
  return `<b>${safeTitle}</b><br>${safeLabel}<div class="popup-actions"><a target="_blank" rel="noopener" href="${externalUrl('google', loc)}">Google</a><a target="_blank" rel="noopener" href="${externalUrl('apple', loc)}">Apple</a><a target="_blank" rel="noopener" href="${externalUrl('waze', loc)}">Waze</a></div>`;
}

function planRoute() {
  if (!state.start || !state.end) return;
  markers.clearLayers();
  L.marker([state.start.lat, state.start.lng]).bindPopup(locationPopup('Start', state.start)).addTo(markers);
  L.marker([state.end.lat, state.end.lng]).bindPopup(locationPopup('Destination', state.end)).addTo(markers);
  if (routingControl) map.removeControl(routingControl);
  routingControl = L.Routing.control({
    waypoints: [L.latLng(state.start.lat, state.start.lng), L.latLng(state.end.lat, state.end.lng)],
    routeWhileDragging: false,
    showAlternatives: true,
    fitSelectedRoutes: true,
    addWaypoints: false,
    lineOptions: { styles: [{ weight: 6, opacity: .85 }] },
    altLineOptions: { styles: [{ weight: 4, opacity: .35 }] },
    createMarker: () => null
  }).addTo(map);
  routingControl.on('routesfound', (e) => {
    const r = e.routes[0];
    state.route = {
      distance: r.summary.totalDistance,
      duration: r.summary.totalTime,
      coordinates: r.coordinates.map(c => ({ lat: c.lat, lng: c.lng }))
    };
    updateStats();
    setStatus('Route ready', '');
    save();
  });
  routingControl.on('routingerror', () => setStatus('Routing error', 'danger'));
}

function updateStats() {
  const miles = state.route ? state.route.distance / 1609.344 : 0;
  const hours = state.route ? state.route.duration / 3600 : 0;
  const mpg = Math.max(1, parseFloat($('mpgInput').value || '24'));
  const gallons = miles / mpg;
  const prices = state.gasStations.map(g => +g.price).filter(Boolean);
  const avgPrice = prices.length ? prices.reduce((a,b)=>a+b,0)/prices.length : 4.11;
  $('distanceOut').textContent = miles ? `${miles.toFixed(1)} mi` : '—';
  $('durationOut').textContent = hours ? formatDuration(hours) : '—';
  $('fuelOut').textContent = gallons ? `${gallons.toFixed(1)} gal` : '—';
  $('costOut').textContent = gallons ? `$${(gallons * avgPrice).toFixed(2)}` : '—';
}

function formatDuration(hours) {
  const h = Math.floor(hours), m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function sampleRoute(coords, count) {
  if (!coords?.length) return [];
  const picks = [];
  for (let i=0; i<count; i++) {
    const idx = Math.floor((i/(count-1)) * (coords.length-1));
    picks.push(coords[idx]);
  }
  return picks;
}

async function findGas() {
  if (!state.route?.coordinates?.length) { setStatus('Plan route first', 'danger'); return; }
  setStatus('Finding gas...', '');
  const radius = +$('gasRadius').value;
  const samples = sampleRoute(state.route.coordinates, +$('sampleCount').value);
  const around = samples.map(p => `node(around:${radius},${p.lat},${p.lng})[amenity=fuel];way(around:${radius},${p.lat},${p.lng})[amenity=fuel];`).join('');
  const query = `[out:json][timeout:30];(${around});out center tags;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method:'POST', body: query });
  if (!res.ok) throw new Error('Fuel search failed');
  const data = await res.json();
  const seen = new Set();
  const stations = [];
  for (const el of data.elements || []) {
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    if (!lat || !lng) continue;
    const key = `${Math.round(lat*10000)},${Math.round(lng*10000)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const name = el.tags?.brand || el.tags?.name || 'Fuel station';
    const dist = distanceToRoute({lat,lng}, state.route.coordinates);
    stations.push({ id: crypto.randomUUID(), name, lat, lng, dist, routeProgress: routeProgressIndex({lat,lng}, state.route.coordinates), plannedStop: false, price: '', address: addressFromTags(el.tags || {}) });
  }
  state.gasStations = buildAutomaticFuelPlan(stations);
  renderGasList();
  setStatus(`Resolving ${state.gasStations.length} fuel stop addresses...`, '');
  await enrichStationAddresses(state.gasStations);
  renderGasList();
  setStatus(`${selectedGasCount()} planned fuel stop${selectedGasCount() === 1 ? '' : 's'} selected from ${state.gasStations.length} nearby station option${state.gasStations.length === 1 ? '' : 's'}`, '');
  save();
}

function addressFromTags(t){ return [t['addr:housenumber'], t['addr:street'], t['addr:city'], t['addr:state']].filter(Boolean).join(' ') || 'OpenStreetMap fuel location'; }
function distanceToRoute(point, coords){
  let best = Infinity;
  for (let i=0;i<coords.length;i+=Math.max(1, Math.floor(coords.length/200))) best = Math.min(best, haversine(point, coords[i]));
  return best;
}

function routeProgressIndex(point, coords){
  let best = Infinity, bestIdx = 0;
  const step = Math.max(1, Math.floor(coords.length/300));
  for (let i=0;i<coords.length;i+=step) {
    const d = haversine(point, coords[i]);
    if (d < best) { best = d; bestIdx = i; }
  }
  return bestIdx;
}
function haversine(a,b){
  const R=6371000, dLat=(b.lat-a.lat)*Math.PI/180, dLng=(b.lng-a.lng)*Math.PI/180;
  const s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
  const q=s1*s1+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*s2*s2;
  return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}

function renderGasList() {
  gasMarkers.clearLayers();
  const box = $('gasList'); box.innerHTML = '';
  if (!state.gasStations.length) { box.className = 'gas-list empty-state'; box.textContent = 'No fuel stops loaded yet.'; updateGasRouteSummary(); return; }
  box.className = 'gas-list';
  updateGasRouteSummary();
  const tpl = $('gasItemTemplate');
  state.gasStations.forEach(g => {
    const node = tpl.content.cloneNode(true);
    const article = node.querySelector('.gas-item');
    article.classList.toggle('planned-stop', !!g.plannedStop);
    node.querySelector('.gas-name').textContent = g.name;
    node.querySelector('.gas-meta').textContent = `${(g.dist/1609.344).toFixed(1)} mi from route • ${g.address}`;
    const badge = node.querySelector('.gas-route-badge');
    badge.textContent = g.plannedStop ? 'Planned stop' : 'Nearby option';
    badge.classList.toggle('planned', !!g.plannedStop);
    const price = node.querySelector('.gas-price'); price.value = g.price || '';
    price.addEventListener('change', () => { g.price = price.value; updateStats(); save(); });
    node.querySelector('.add-gas-event').addEventListener('click', () => addGasEvent(g));
    node.querySelector('.open-google').addEventListener('click', () => openExternal('google', g));
    node.querySelector('.open-apple').addEventListener('click', () => openExternal('apple', g));
    node.querySelector('.open-waze').addEventListener('click', () => openExternal('waze', g));
    box.appendChild(node);
    L.marker([g.lat,g.lng]).bindPopup(`<b>${escapeHtml(g.name)}</b><br>${escapeHtml(g.address)}<br>${g.price ? '$'+escapeHtml(g.price)+'/gal' : 'Add price in planner'}<div class="popup-actions"><a target="_blank" rel="noopener" href="${externalUrl('google', g)}">Google</a><a target="_blank" rel="noopener" href="${externalUrl('apple', g)}">Apple</a><a target="_blank" rel="noopener" href="${externalUrl('waze', g)}">Waze</a></div>`).addTo(gasMarkers);
  });
}


function updateGasRouteSummary() {
  const el = $('gasRouteSummary');
  if (!el) return;
  const selected = selectedGasStopsForRoute();
  const totalSelected = selectedGasCount();
  const extra = totalSelected > selected.length
    ? ` Google Maps can only preload ${GOOGLE_MAX_WAYPOINTS} fuel stops in one route link here, so ${totalSelected - selected.length} extra planned stop${totalSelected - selected.length === 1 ? '' : 's'} will not transfer. Open extras individually from the fuel list.`
    : '';
  el.textContent = selected.length
    ? `${selected.length} automatic fuel stop${selected.length>1?'s':''} will be sent to Google Maps as coordinate waypoints in route order.${extra}`
    : 'No fuel stop is needed based on the route distance, MPG, and tank size. Nearby stations are still listed as backups.';
}
function buildAutomaticFuelPlan(stations) {
  const sortedByRoute = stations
    .filter(g => Number.isFinite(g.routeProgress))
    .sort((a,b) => (a.routeProgress ?? Infinity) - (b.routeProgress ?? Infinity));

  const miles = state.route ? state.route.distance / 1609.344 : 0;
  const mpg = Math.max(1, parseFloat($('mpgInput').value || '24'));
  const tank = Math.max(1, parseFloat($('tankInput').value || '14'));
  const safeRangeMiles = Math.max(50, mpg * tank * 0.70);
  const stopsNeeded = Math.min(GOOGLE_MAX_WAYPOINTS, Math.max(0, Math.ceil(miles / safeRangeMiles) - 1));

  sortedByRoute.forEach(g => g.plannedStop = false);
  const planned = [];
  if (stopsNeeded > 0 && sortedByRoute.length) {
    for (let i = 1; i <= stopsNeeded; i++) {
      const target = Math.round((i / (stopsNeeded + 1)) * (state.route.coordinates.length - 1));
      const candidate = sortedByRoute
        .filter(g => !planned.includes(g))
        .sort((a,b) => {
          const aScore = Math.abs((a.routeProgress ?? 0) - target) + (a.dist / 75);
          const bScore = Math.abs((b.routeProgress ?? 0) - target) + (b.dist / 75);
          return aScore - bScore;
        })[0];
      if (candidate) { candidate.plannedStop = true; planned.push(candidate); }
    }
  }

  const backups = sortedByRoute
    .filter(g => !g.plannedStop)
    .sort((a,b) => a.dist - b.dist)
    .slice(0, Math.max(6, 12 - planned.length));

  return [...planned.sort((a,b)=>(a.routeProgress??0)-(b.routeProgress??0)), ...backups]
    .slice(0, 12);
}
function replanFuelStops() {
  state.gasStations = buildAutomaticFuelPlan(state.gasStations);
  renderGasList();
  save();
}
function useOnlyCheapestPriced(maxStops = 3) {
  state.gasStations.forEach(g => g.plannedStop = false);
  const priced = state.gasStations
    .filter(g => parseFloat(g.price) > 0)
    .sort((a,b) => parseFloat(a.price) - parseFloat(b.price))
    .slice(0, maxStops);
  priced.forEach(g => g.plannedStop = true);
  renderGasList();
  save();
}
function timeToMin(t) { if (!t) return null; const [h,m] = t.split(':').map(Number); return h*60+m; }
function minToTime(n) { return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`; }

function renderTimeline() {
  const hours = $('timelineHours'), tl = $('timeline'); hours.innerHTML = ''; tl.innerHTML = '';
  for (let h=6; h<=23; h++) {
    const lab = document.createElement('div'); lab.className = 'hour-label'; lab.style.top = `${(h-6)*60}px`; lab.textContent = `${h>12?h-12:h}${h>=12?'PM':'AM'}`; hours.appendChild(lab);
  }
  const conflicts = detectConflicts();
  state.events.sort((a,b)=>timeToMin(a.start)-timeToMin(b.start)).forEach(ev => {
    const s = timeToMin(ev.start), e = timeToMin(ev.end); if (s == null || e == null) return;
    const block = document.createElement('div');
    const conflict = conflicts.byId[ev.id] || [];
    block.className = `event-block ${ev.type || 'event'} ${conflict.some(c=>c.kind==='overlap')?'conflict':''} ${conflict.some(c=>c.kind==='hours')?'warn':''}`;
    block.style.top = `${Math.max(0, s - 360)}px`; block.style.height = `${Math.max(36, e-s)}px`;
    block.innerHTML = `<strong>${escapeHtml(ev.title || 'Untitled')}</strong><span>${ev.start}–${ev.end}${ev.location ? ' • '+escapeHtml(ev.location): ''}</span>`;
    block.title = conflict.map(c=>c.message).join('\n');
    block.addEventListener('click', () => editEvent(ev.id));
    tl.appendChild(block);
  });
  renderConflicts(conflicts.list);
}

function detectConflicts() {
  const list = [], byId = {};
  const add = (id, kind, message) => { (byId[id] ||= []).push({kind,message}); list.push(message); };
  const evs = [...state.events].sort((a,b)=>timeToMin(a.start)-timeToMin(b.start));
  evs.forEach(ev => {
    const s=timeToMin(ev.start), e=timeToMin(ev.end), open=timeToMin(ev.open), close=timeToMin(ev.close);
    if (s != null && e != null && e <= s) add(ev.id,'overlap',`${ev.title}: end time is before start time.`);
    if (open != null && s < open) add(ev.id,'hours',`${ev.title}: starts before opening time (${ev.open}).`);
    if (close != null && e > close) add(ev.id,'hours',`${ev.title}: ends after closing time (${ev.close}).`);
  });
  for (let i=0;i<evs.length-1;i++) {
    const a=evs[i], b=evs[i+1];
    if (timeToMin(a.end) > timeToMin(b.start)) {
      add(a.id,'overlap',`${a.title} overlaps ${b.title}.`);
      add(b.id,'overlap',`${b.title} overlaps ${a.title}.`);
    }
  }
  return { list:[...new Set(list)], byId };
}

function renderConflicts(list) {
  const banner = $('conflictBanner');
  if (!list.length) { banner.classList.add('hidden'); banner.innerHTML=''; return; }
  banner.classList.remove('hidden');
  banner.innerHTML = `<strong>${list.length} planning flag${list.length>1?'s':''}</strong><ul>${list.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
}

function editEvent(id) {
  const ev = state.events.find(e=>e.id===id); if (!ev) return;
  state.selectedEventId = id;
  $('editorTitle').textContent = 'Edit Event'; $('deleteEventBtn').classList.remove('hidden');
  $('evTitle').value = ev.title || ''; $('evStart').value = ev.start || '09:00'; $('evEnd').value = ev.end || '10:00';
  $('evLocation').value = ev.location || ''; $('evOpen').value = ev.open || ''; $('evClose').value = ev.close || '';
  $('evType').value = ev.type || 'event'; $('evNotes').value = ev.notes || '';
}
function clearEditor(){ state.selectedEventId = null; $('editorTitle').textContent='Add / Edit Event'; $('deleteEventBtn').classList.add('hidden'); ['evTitle','evLocation','evOpen','evClose','evNotes'].forEach(id=>$(id).value=''); $('evStart').value='09:00'; $('evEnd').value='10:00'; $('evType').value='event'; }
function saveEvent(){
  const ev = { id: state.selectedEventId || crypto.randomUUID(), title:$('evTitle').value.trim() || 'Untitled Event', start:$('evStart').value, end:$('evEnd').value, location:$('evLocation').value.trim(), open:$('evOpen').value, close:$('evClose').value, type:$('evType').value, notes:$('evNotes').value.trim() };
  const idx = state.events.findIndex(e=>e.id===ev.id); if (idx>=0) state.events[idx]=ev; else state.events.push(ev);
  clearEditor(); renderTimeline(); save();
}
function deleteEvent(){ if (!state.selectedEventId) return; state.events = state.events.filter(e=>e.id!==state.selectedEventId); clearEditor(); renderTimeline(); save(); }
function addGasEvent(g){
  const start = prompt('Gas stop start time (HH:MM)', '12:00') || '12:00';
  const s = timeToMin(start), end = minToTime(Math.min(23*60+59, s+20));
  state.events.push({ id:crypto.randomUUID(), title:`Fuel stop: ${g.name}`, start, end, location:stationDisplayAddress(g), open:'', close:'', type:'fuel', notes:(g.price ? `Fuel price: $${g.price}/gal. ` : 'Add live/manual gas price. ') + `Coordinates: ${g.lat}, ${g.lng}` });
  renderTimeline(); save();
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

$('planRouteBtn').addEventListener('click', async () => {
  try { setStatus('Geocoding...', ''); state.start = await geocode($('startInput').value); state.end = await geocode($('endInput').value); planRoute(); }
  catch (err) { setStatus(err.message, 'danger'); }
});
$('locateBtn').addEventListener('click', () => navigator.geolocation?.getCurrentPosition(pos => { state.start = { lat:pos.coords.latitude, lng:pos.coords.longitude, label:'My current location' }; $('startInput').value = state.start.label; save(); }, () => setStatus('Location denied', 'danger')));
$('findGasBtn').addEventListener('click', () => findGas().catch(err => setStatus(err.message, 'danger')));
$('selectCheapGasBtn').addEventListener('click', () => useOnlyCheapestPriced(3));
$('clearGasRouteBtn').addEventListener('click', replanFuelStops);
$('addEventBtn').addEventListener('click', clearEditor); $('saveEventBtn').addEventListener('click', saveEvent); $('clearEditorBtn').addEventListener('click', clearEditor); $('deleteEventBtn').addEventListener('click', deleteEvent);
$('tripDate').addEventListener('change', () => { state.tripDate = $('tripDate').value; save(); });
['mpgInput','tankInput'].forEach(id => $(id).addEventListener('input', () => { updateStats(); if (state.gasStations.length) replanFuelStops(); save(); }));
$('exportBtn').addEventListener('click', () => { const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tripforge-${state.tripDate || 'plan'}.json`; a.click(); URL.revokeObjectURL(a.href); });
$('importInput').addEventListener('change', async (e) => { const file = e.target.files[0]; if(!file) return; Object.assign(state, JSON.parse(await file.text())); renderTimeline(); renderGasList(); updateStats(); save(); });
$('routeGoogleBtn').addEventListener('click', () => openExternal('google'));
$('routeAppleBtn').addEventListener('click', () => openExternal('apple'));
$('routeWazeBtn').addEventListener('click', () => openExternal('waze'));
['Google','Apple','Waze'].forEach(appName => {
  const app = appName.toLowerCase();
  $(`event${appName}Btn`).addEventListener('click', () => openExternal(app, { location: $('evLocation').value.trim() }));
});
$('resetBtn').addEventListener('click', () => { if(confirm('Clear this trip planner?')) { localStorage.removeItem(storeKey); location.reload(); } });

(function init(){ $('tripDate').value = state.tripDate; renderTimeline(); load(); })();
