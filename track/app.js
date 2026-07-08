const SUPABASE_URL = 'https://cuhbzgeqvgzshwwfkpdm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Qm9pdRATY4QtAEpAJoBNtg_B0TfR1Uo';
const REDIRECT_TO = location.origin.includes('localhost') || location.protocol === 'file:' ? location.href : 'https://whatmod.com/track/';
const APP_URL = location.origin.includes('localhost') ? location.href.split('?')[0] : 'https://whatmod.com/track/';

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const els = {
  signedOut: document.getElementById('signedOut'), appArea: document.getElementById('appArea'), googleBtn: document.getElementById('googleBtn'),
  emailInput: document.getElementById('emailInput'), emailBtn: document.getElementById('emailBtn'), logoutBtn: document.getElementById('logoutBtn'),
  tripSelect: document.getElementById('tripSelect'), newTripBtn: document.getElementById('newTripBtn'), deleteTripBtn: document.getElementById('deleteTripBtn'), saveStatus: document.getElementById('saveStatus'), roleBadge: document.getElementById('roleBadge'),
  tripTitle: document.getElementById('tripTitle'), startDate: document.getElementById('startDate'), endDate: document.getElementById('endDate'), destination: document.getElementById('destination'), tripNotes: document.getElementById('tripNotes'),
  totalBudget: document.getElementById('totalBudget'), stopCount: document.getElementById('stopCount'), dayCount: document.getElementById('dayCount'), plannerTitle: document.getElementById('plannerTitle'), dayTabs: document.getElementById('dayTabs'), timeline: document.getElementById('timeline'),
  addAnyItemBtn: document.getElementById('addAnyItemBtn'), itemDialog: document.getElementById('itemDialog'), itemDialogTitle: document.getElementById('itemDialogTitle'), editingItemId: document.getElementById('editingItemId'),
  itemTitle: document.getElementById('itemTitle'), itemDate: document.getElementById('itemDate'), itemTime: document.getElementById('itemTime'), itemEndTime: document.getElementById('itemEndTime'), itemType: document.getElementById('itemType'), itemBudget: document.getElementById('itemBudget'), itemAssignedTo: document.getElementById('itemAssignedTo'), itemFromLocation: document.getElementById('itemFromLocation'), itemToLocation: document.getElementById('itemToLocation'), itemLocation: document.getElementById('itemLocation'), itemNotes: document.getElementById('itemNotes'), itemRainPlan: document.getElementById('itemRainPlan'), saveItemBtn: document.getElementById('saveItemBtn'),
  expandAllBtn: document.getElementById('expandAllBtn'), collapseAllBtn: document.getElementById('collapseAllBtn'), exportBtn: document.getElementById('exportBtn'), importInput: document.getElementById('importInput'),
  tripDialog: document.getElementById('tripDialog'), dialogTripTitle: document.getElementById('dialogTripTitle'), dialogStartDate: document.getElementById('dialogStartDate'), dialogEndDate: document.getElementById('dialogEndDate'), createTripConfirm: document.getElementById('createTripConfirm'),
  inviteRole: document.getElementById('inviteRole'), createInviteBtn: document.getElementById('createInviteBtn'), inviteOutput: document.getElementById('inviteOutput'), inviteLink: document.getElementById('inviteLink'), copyInviteBtn: document.getElementById('copyInviteBtn'), collabList: document.getElementById('collabList'),
  destinationSuggestions: document.getElementById('destinationSuggestions'), destinationMapLinks: document.getElementById('destinationMapLinks'), itemLocationSuggestions: document.getElementById('itemLocationSuggestions'), itemLocationMapLinks: document.getElementById('itemLocationMapLinks'), itemFromSuggestions: document.getElementById('itemFromSuggestions'), itemToSuggestions: document.getElementById('itemToSuggestions'), userName: document.getElementById('userName'), userAvatar: document.getElementById('userAvatar'), homeGreeting: document.getElementById('homeGreeting'), homeDaysLeft: document.getElementById('homeDaysLeft'), homeCountdownLabel: document.getElementById('homeCountdownLabel'), homeCountdownDetail: document.getElementById('homeCountdownDetail'), homeProgressBar: document.getElementById('homeProgressBar'), homeMustDoLine: document.getElementById('homeMustDoLine'), homeBudgetLine: document.getElementById('homeBudgetLine'), homeActivityLine: document.getElementById('homeActivityLine'), homeWeatherLine: document.getElementById('homeWeatherLine'), homeContinueBtn: document.getElementById('homeContinueBtn'), heroDaysLeft: document.getElementById('heroDaysLeft'), heroCountdownLabel: document.getElementById('heroCountdownLabel'), heroCountdownDetail: document.getElementById('heroCountdownDetail'), travelerCount: document.getElementById('travelerCount'), detailsDestination: document.getElementById('detailsDestination'), detailsStart: document.getElementById('detailsStart'), detailsEnd: document.getElementById('detailsEnd'), sidebarNewTripBtn: document.getElementById('sidebarNewTripBtn'), viewItineraryBtn: document.getElementById('viewItineraryBtn'), dailyMapPanel: document.getElementById('dailyMapPanel'), dailyRouteMap: document.getElementById('dailyRouteMap'), dailyMapTitle: document.getElementById('dailyMapTitle'), dailyMapHelp: document.getElementById('dailyMapHelp'), dailyMapStops: document.getElementById('dailyMapStops'), dailyDirectionsLink: document.getElementById('dailyDirectionsLink'), dailyShowTravel: document.getElementById('dailyShowTravel'), dailyMapLegend: document.getElementById('dailyMapLegend'),
  packingPanel: document.getElementById('packingPanel'), packingCount: document.getElementById('packingCount'), packingProgress: document.getElementById('packingProgress'), packingList: document.getElementById('packingList'), packingForm: document.getElementById('packingForm'), packingInput: document.getElementById('packingInput'), addPackingBtn: document.getElementById('addPackingBtn'), resetPackingBtn: document.getElementById('resetPackingBtn'),
  mustDoPanel: document.getElementById('mustDoPanel'), mustDoCount: document.getElementById('mustDoCount'), mustDoProgress: document.getElementById('mustDoProgress'), mustDoList: document.getElementById('mustDoList'), mustDoForm: document.getElementById('mustDoForm'), mustDoInput: document.getElementById('mustDoInput'), mustDoPriority: document.getElementById('mustDoPriority'), addMustDoBtn: document.getElementById('addMustDoBtn'), mustDoBudget: document.getElementById('mustDoBudget'),
  memoryPanel: document.getElementById('memoryPanel'), memoryCount: document.getElementById('memoryCount'), memoryList: document.getElementById('memoryList'), memoryForm: document.getElementById('memoryForm'), memoryInput: document.getElementById('memoryInput'), addMemoryBtn: document.getElementById('addMemoryBtn'), tripProgress: document.getElementById('tripProgress'), tripProgressText: document.getElementById('tripProgressText'), gasMiles: document.getElementById('gasMiles'), gasMpg: document.getElementById('gasMpg'), gasPrice: document.getElementById('gasPrice'), gasEstimate: document.getElementById('gasEstimate'), gasBreakdown: document.getElementById('gasBreakdown'), activitySearch: document.getElementById('activitySearch'), activityRadius: document.getElementById('activityRadius'), activityUseGps: document.getElementById('activityUseGps'), activityGenerateBtn: document.getElementById('activityGenerateBtn'), activityGeneratorStatus: document.getElementById('activityGeneratorStatus'), activityResults: document.getElementById('activityResults'), activityResultCount: document.getElementById('activityResultCount'),
  snapMode: document.getElementById('snapMode'), undoToast: document.getElementById('undoToast'), undoToastText: document.getElementById('undoToastText'), undoBtn: document.getElementById('undoBtn')
};

const typeIcon = { event: '🎟️', sightseeing: '📸', activity: '🎡', flight: '✈️', train: '🚆', ferry: '⛴️', cruise: '🚢', drive: '🚗', transport: '🚕', food: '🍽️', hotel: '🏨', gas: '⛽', shopping: '🛍️', rest: '😴', toddler: '🧸', todo: '✅' };
const travelOnlyTypes = new Set(['flight', 'train', 'ferry', 'cruise']);
const ignoreRouteTypes = new Set(['flight', 'train', 'ferry', 'cruise', 'todo', 'rest']);
const optionalRouteTypes = new Set(['toddler']);
function routeBehaviorForItem(item) {
  const type = String(item?.item_type || 'event').toLowerCase();
  // Important: explicit driving/pickup events must stay in the road route even if
  // the destination is an airport. Flights/trains/etc are the only always-separate
  // travel blocks. This keeps "Drive to PHL" routable from From -> To.
  if (type === 'drive' || type === 'transport' || type === 'gas') return { kind: 'drive', routable: true, pinClass: 'pin-drive', label: 'Driving route' };
  if (type === 'hotel') return { kind: 'hotel', routable: true, pinClass: 'pin-hotel', label: 'Lodging' };
  const haystack = `${item?.title || ''} ${item?.location || ''} ${item?.from_location || ''} ${item?.to_location || ''}`.toLowerCase();
  const airportish = /\b([a-z]{3})\b/.test(haystack) && /airport|terminal|flight|airline|arriv|depart|\bphl\b|\bmke\b|\bord\b|\bmdw\b|\bjfk\b|\blga\b|\bewr\b/.test(haystack);
  if (type === 'flight' || (airportish && /flight|arriv|depart|terminal|airline/.test(haystack))) return { kind: 'travel', routable: false, pinClass: 'pin-travel', label: 'Flight / airport' };
  if (travelOnlyTypes.has(type)) return { kind: 'travel', routable: false, pinClass: 'pin-travel', label: 'Travel event' };
  if (ignoreRouteTypes.has(type)) return { kind: 'note', routable: false, pinClass: 'pin-note', label: 'Shown only' };
  return { kind: 'stop', routable: true, pinClass: 'pin-stop', label: 'Driving stop' };
}
function mapPinIcon(point, index) {
  const icon = typeIcon[point.item.item_type] || '📍';
  const number = point.behavior.routable ? String(index) : icon;
  return L.divIcon({
    className: `smart-pin ${point.behavior.pinClass}`,
    html: `<span>${escapeHtml(number)}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16]
  });
}
const softOverlapTypes = new Set(['drive', 'flight', 'transport', 'hotel', 'gas', 'rest', 'todo']);
function shouldFlagOverlap(item, other) {
  if (!item || !other) return false;
  const a = String(item.item_type || 'event');
  const b = String(other.item_type || 'event');
  // Travel/logistics blocks commonly overlap with the person being picked up, flights, check-ins, or notes.
  // Keep them visible on the route/timeline, but don't alarm the user unless both are real scheduled activities.
  if (softOverlapTypes.has(a) || softOverlapTypes.has(b)) return false;
  return true;
}

function isPointToPointType(item) {
  const type = String(item?.item_type || '').toLowerCase();
  return ['drive','transport','flight','train','ferry','cruise'].includes(type);
}
function itemMapLocation(item) {
  if (!item) return '';
  if (isPointToPointType(item)) return item.to_location || item.location || item.from_location || '';
  return item.location || item.to_location || item.from_location || '';
}
function pointLabelForItem(item, kind) {
  if (kind === 'from') return `${item.title || 'Stop'} start`;
  if (kind === 'to') return `${item.title || 'Stop'} destination`;
  return item.title || 'Stop';
}
function routeLocationsForItem(item) {
  const behavior = routeBehaviorForItem(item);
  const from = (item.from_location || '').trim();
  const to = (item.to_location || '').trim();
  const loc = (item.location || '').trim();
  const type = String(item.item_type || '').toLowerCase();
  const points = [];
  if (isPointToPointType(item)) {
    if (from) points.push({ query: from, pointKind: 'from', item, behavior, label: pointLabelForItem(item, 'from') });
    if (to) points.push({ query: to, pointKind: 'to', item, behavior, label: pointLabelForItem(item, 'to') });
    if (!points.length && loc) points.push({ query: loc, pointKind: 'location', item, behavior, label: pointLabelForItem(item, 'location') });
    if (type === 'flight' || travelOnlyTypes.has(type)) points.forEach(p => p.behavior = { ...p.behavior, routable: false, kind: 'travel' });
    return points;
  }
  if (loc) points.push({ query: loc, pointKind: 'location', item, behavior, label: pointLabelForItem(item, 'location') });
  return points;
}
function googleFirstNameFromMeta(meta = {}, fallback = 'Traveler') {
  const raw = meta.full_name || meta.name || meta.display_name || meta.preferred_username || fallback || 'Traveler';
  return String(raw).trim().split(/\s+/)[0] || 'Traveler';
}
function currentUserFirstName() {
  return googleFirstNameFromMeta(session?.user?.user_metadata || {}, session?.user?.email?.split('@')[0] || 'You');
}
function memberRecord(userId) {
  return members.find(m => m.user_id === userId);
}
function memberLabel(userId) {
  if (!userId) return 'Everyone';
  if (userId === session?.user?.id) return currentUserFirstName();
  const m = memberRecord(userId);
  if (m?.display_name) return String(m.display_name).trim().split(/\s+/)[0] || 'Traveler';
  if (m?.email) return String(m.email).split('@')[0];
  const suffix = String(userId).slice(0, 4).toUpperCase();
  return `Traveler ${suffix}`;
}
function memberAvatarHtml(userId) {
  if (!userId) return '<span class="assignee-chip everyone">👥 Everyone</span>';
  const label = memberLabel(userId);
  const m = memberRecord(userId);
  const pic = userId === session?.user?.id ? session.user.user_metadata?.avatar_url : (m?.avatar_url || '');
  return `<span class="assignee-chip">${pic ? `<img src="${escapeHtml(pic)}" alt="">` : `<em>${escapeHtml(label.slice(0,1).toUpperCase())}</em>`}<span>${escapeHtml(label)}</span></span>`;
}
function populateAssigneeSelect(selected = '') {
  if (!els.itemAssignedTo) return;
  const seen = new Set();
  const opts = ['<option value="">Everyone / shared</option>'];
  const ids = [session?.user?.id, ...members.map(m => m.user_id)].filter(Boolean);
  ids.forEach(id => { if (seen.has(id)) return; seen.add(id); opts.push(`<option value="${escapeHtml(id)}">${escapeHtml(id === session?.user?.id ? 'Me' : memberLabel(id))}</option>`); });
  els.itemAssignedTo.innerHTML = opts.join('');
  els.itemAssignedTo.value = selected || '';
}
function syncRouteFieldVisibility() {
  const pointToPoint = isPointToPointType({ item_type: els.itemType?.value });
  document.querySelectorAll('.route-field').forEach(el => el.classList.toggle('hidden', !pointToPoint));
  if (pointToPoint && els.itemLocation) els.itemLocation.placeholder = 'Optional label/place name';
  else if (els.itemLocation) els.itemLocation.placeholder = 'Address / location';
}
let session = null, trips = [], items = [], members = [], packingItems = [], mustDoItems = [], memoryItems = [], activeTripId = null, draggedId = null, autosaveTimer = null, selectedDay = null, pendingInviteToken = null, lastUndo = null, undoTimer = null, timelineDrag = null, packingDragId = null, routeMap = null, routeLayer = null, routeMarkers = [], routeRenderToken = 0, weatherByDate = {}, weatherStatus = '';

const setStatus = m => els.saveStatus.textContent = m;
const money = n => Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const todayISO = () => new Date().toISOString().slice(0, 10);
function addDays(dateString, days) { const d = new Date(`${dateString}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function dateRange(start, end) { if (!start || !end) return []; if (end < start) end = start; const out = []; let cur = start; while (cur <= end && out.length < 90) { out.push(cur); cur = addDays(cur, 1); } return out; }
function fmtDate(d) { return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }); }
function fmtShortDate(d) { return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function fmtLongDate(d) { return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); }
function fmtTime(t) { if (!t) return ''; const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m || 0, 0, 0); return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }

function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }
function formatCountdownParts(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
function updateTripCountdown() {
  const t = currentTrip();
  if (!els.heroDaysLeft) return;
  if (!t?.start_date || !t?.end_date) {
    els.heroDaysLeft.textContent = '0';
    if (els.heroCountdownLabel) els.heroCountdownLabel.textContent = 'Days left';
    if (els.heroCountdownDetail) els.heroCountdownDetail.textContent = 'Add trip dates';
    return;
  }
  const now = new Date();
  const start = new Date(`${t.start_date}T00:00:00`);
  const end = new Date(`${t.end_date}T23:59:59`);
  const days = dateRange(t.start_date, t.end_date);
  if (now < start) {
    const ms = start - now;
    const calendarDays = Math.max(0, Math.ceil(ms / 86400000));
    els.heroDaysLeft.textContent = calendarDays;
    if (els.heroCountdownLabel) els.heroCountdownLabel.textContent = calendarDays === 1 ? 'Day left' : 'Days left';
    if (els.heroCountdownDetail) els.heroCountdownDetail.textContent = `${formatCountdownParts(ms)} until trip`;
  } else if (now <= end) {
    const tripDay = Math.min(days.length, Math.max(1, Math.floor((now - start) / 86400000) + 1));
    const msLeft = end - now;
    els.heroDaysLeft.textContent = `Day ${tripDay}`;
    if (els.heroCountdownLabel) els.heroCountdownLabel.textContent = `of ${days.length || 1}`;
    if (els.heroCountdownDetail) els.heroCountdownDetail.textContent = `${formatCountdownParts(msLeft)} left in trip`;
  } else {
    els.heroDaysLeft.textContent = '✓';
    if (els.heroCountdownLabel) els.heroCountdownLabel.textContent = 'Trip complete';
    if (els.heroCountdownDetail) els.heroCountdownDetail.textContent = 'Memories ready';
  }
}



// Weather provider layer: Open-Meteo now, easy to swap later.
const WEATHER_FORECAST_LIMIT_DAYS = 16;
const WEATHER_CODES = {
  0:['☀️','Clear'],1:['🌤️','Mostly clear'],2:['⛅','Partly cloudy'],3:['☁️','Cloudy'],
  45:['🌫️','Fog'],48:['🌫️','Fog'],51:['🌦️','Drizzle'],53:['🌦️','Drizzle'],55:['🌦️','Drizzle'],
  61:['🌧️','Rain'],63:['🌧️','Rain'],65:['🌧️','Heavy rain'],66:['🌧️','Freezing rain'],67:['🌧️','Freezing rain'],
  71:['🌨️','Snow'],73:['🌨️','Snow'],75:['❄️','Heavy snow'],77:['❄️','Snow grains'],
  80:['🌦️','Rain showers'],81:['🌧️','Rain showers'],82:['⛈️','Heavy showers'],95:['⛈️','Thunderstorm'],96:['⛈️','Storm'],99:['⛈️','Storm']
};
function weatherCodeInfo(code){ return WEATHER_CODES[Number(code)] || ['🌡️','Forecast']; }
function daysUntilISO(dateISO){ const d = new Date(`${dateISO}T00:00:00`); const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return Math.ceil((d - today) / 86400000); }
function weatherCacheKey(trip){ return `track-weather-v2:${trip?.destination || ''}:${trip?.start_date || ''}:${trip?.end_date || ''}`; }
function weatherChipHtml(day){
  const w = weatherByDate[day];
  if (!w) return '<small class="weather-chip muted">🌤️ soon</small>';
  const [icon,label] = weatherCodeInfo(w.code);
  const rain = Number(w.precip || 0);
  return `<small class="weather-chip ${rain >= 45 ? 'rainy' : ''}" title="${escapeHtml(label)} • ${Math.round(w.min)}°-${Math.round(w.max)}° • ${Math.round(rain)}% rain">${icon} ${Math.round(w.max)}°</small>`;
}
function dayWeatherSummaryHtml(day){
  const w = weatherByDate[day];
  if (!w) {
    return `<div class="day-weather-card pending"><strong>🌤️ Live weather</strong><span>${escapeHtml(weatherStatus || 'Forecast appears here when this day is close enough.')}</span></div>`;
  }
  const [icon,label] = weatherCodeInfo(w.code);
  const rain = Number(w.precip || 0);
  return `<div class="day-weather-card ${rain >= 45 ? 'rainy' : ''}"><strong>${icon} ${escapeHtml(label)}</strong><span>${Math.round(w.min)}° / ${Math.round(w.max)}° • ${Math.round(rain)}% rain chance${rain >= 45 ? ' • Check rain plans' : ''}</span></div>`;
}
async function geocodeOne(query){
  const clean = String(query || '').trim();
  if (!clean) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(clean)}`;
  const data = await fetch(url, { headers: { Accept: 'application/json' }}).then(r=>r.json());
  const row = Array.isArray(data) ? data[0] : null;
  return row ? { lat: Number(row.lat), lon: Number(row.lon) } : null;
}
async function loadWeatherForTrip(force=false){
  const t = currentTrip();
  weatherByDate = {}; weatherStatus = '';
  if (!t?.start_date || !t?.end_date || !t?.destination) { weatherStatus = 'Add a destination to enable weather.'; return; }
  const first = daysUntilISO(t.start_date), last = daysUntilISO(t.end_date);
  if (first > WEATHER_FORECAST_LIMIT_DAYS || last < -1) { weatherStatus = `Forecast unlocks about ${WEATHER_FORECAST_LIMIT_DAYS} days before the trip.`; return; }
  const key = weatherCacheKey(t);
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      if (cached && Date.now() - cached.at < 1000 * 60 * 45) { weatherByDate = cached.byDate || {}; weatherStatus = cached.status || 'Weather cached'; return; }
    } catch {}
  }
  weatherStatus = 'Loading live weather...'; renderDayTabs(); renderTimeline();
  try {
    const geo = await geocodeOne(t.destination);
    if (!geo) { weatherStatus = 'Could not find destination weather.'; return; }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=auto&start_date=${encodeURIComponent(t.start_date)}&end_date=${encodeURIComponent(t.end_date)}`;
    const data = await fetch(url).then(r=>r.json());
    const d = data.daily || {};
    const byDate = {};
    (d.time || []).forEach((day, idx)=>{ byDate[day] = { code: d.weather_code?.[idx], max: d.temperature_2m_max?.[idx], min: d.temperature_2m_min?.[idx], precip: d.precipitation_probability_max?.[idx] ?? 0 }; });
    weatherByDate = byDate;
    weatherStatus = Object.keys(byDate).length ? 'Live forecast from Open-Meteo.' : 'Weather not available for this date yet.';
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), byDate: weatherByDate, status: weatherStatus }));
  } catch (e) {
    weatherStatus = 'Weather unavailable right now.';
  }
}

function escapeHtml(str) { return String(str || '').replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }
function isMissingRainPlanColumn(error) { return /rain_plan|schema cache|column/i.test(String(error?.message || '')); }
function isMissingSharedTable(error) { return /itinerary_must_do_items|itinerary_memories|schema cache|relation|does not exist/i.test(String(error?.message || '')); }

function shortLocationLabel(location) {
  let value = String(location || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  value = value
    .replace(/,?\s*United States(?: of America)?\.?$/i, '')
    .replace(/,?\s*USA\.?$/i, '')
    .replace(/\s+\d{5}(?:-\d{4})?/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/,\s*$/g, '')
    .trim();
  const parts = value.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 3) value = `${parts[0]}, ${parts[1]}`;
  const max = 48;
  if (value.length > max) value = value.slice(0, max - 1).trimEnd() + '…';
  return value;
}
function currentTrip() { return trips.find(t => t.id === activeTripId); }
function currentMembership() { return members.find(m => m.trip_id === activeTripId && m.user_id === session?.user?.id); }
function canEdit() { return ['owner', 'editor'].includes(currentMembership()?.role); }
function canDeleteTrip() { return currentMembership()?.role === 'owner'; }
function isLockedItem(item) { return !!(item?.locked || item?.locked_at); }
function canEditItem(item) { return canEdit() && !isLockedItem(item); }


const DAY_START_MIN = 4 * 60;
const DAY_END_MIN = 24 * 60;
const SLOT_HEIGHT = 62;
const TIMELINE_TOP_PAD = 18;
const TIMELINE_BOTTOM_PAD = 42;
const TIMELINE_EVENT_GAP = 12;
function getSnapMinutes() { return Number(els.snapMode?.value || localStorage.getItem('timelineSnapMinutes') || 30); }
function minutesToY(mins) { return TIMELINE_TOP_PAD + ((mins - DAY_START_MIN) / 30) * SLOT_HEIGHT; }
function yToMinutes(y) { return DAY_START_MIN + ((y - TIMELINE_TOP_PAD) / SLOT_HEIGHT) * 30; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function snapMinutes(mins) { const snap = getSnapMinutes(); return Math.round(mins / snap) * snap; }
function timeToMinutes(t) { if (!t) return null; const [h, m] = String(t).split(':').map(Number); if (Number.isNaN(h)) return null; return h * 60 + (m || 0); }
function minutesToTime(mins) { mins = clamp(Math.round(mins), 0, 23 * 60 + 59); const h = Math.floor(mins / 60); const m = mins % 60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
function itemStartMinutes(item) { return timeToMinutes(item.start_time) ?? DAY_START_MIN; }
function itemEndMinutes(item) {
  const start = itemStartMinutes(item);
  const end = timeToMinutes(item.end_time);
  return end && end > start ? end : start + 60;
}
function itemDuration(item) { return Math.max(30, itemEndMinutes(item) - itemStartMinutes(item)); }
function defaultTimedPatch(item, newStart) {
  const duration = itemDuration(item);
  const start = clamp(snapMinutes(newStart), 0, DAY_END_MIN - 30);
  const end = clamp(start + duration, 30, DAY_END_MIN);
  return { start_time: minutesToTime(start), end_time: minutesToTime(end), sort_order: start };
}
function findOverlap(item, patch = {}) {
  const start = timeToMinutes(patch.start_time ?? item.start_time);
  const end = timeToMinutes(patch.end_time ?? item.end_time);
  const day = patch.item_date ?? item.item_date;
  if (start === null || end === null || end <= start) return null;
  return items.find(other => {
    if (other.id === item.id || other.item_date !== day) return false;
    const otherStart = timeToMinutes(other.start_time);
    const otherEnd = timeToMinutes(other.end_time);
    if (otherStart === null || otherEnd === null) return false;
    const overlaps = start < otherEnd && end > otherStart;
    return overlaps && shouldFlagOverlap({ ...item, ...patch }, other);
  });
}
function findSoftOverlap(item) {
  const start = timeToMinutes(item.start_time);
  const end = timeToMinutes(item.end_time);
  if (start === null || end === null || end <= start) return null;
  return items.find(other => {
    if (other.id === item.id || other.item_date !== item.item_date) return false;
    const otherStart = timeToMinutes(other.start_time);
    const otherEnd = timeToMinutes(other.end_time);
    if (otherStart === null || otherEnd === null) return false;
    const overlaps = start < otherEnd && end > otherStart;
    return overlaps && !shouldFlagOverlap(item, other);
  });
}
function showUndoToast(text, undoAction) {
  lastUndo = undoAction;
  if (!els.undoToast) return;
  els.undoToastText.textContent = text;
  els.undoToast.classList.remove('hidden');
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => els.undoToast?.classList.add('hidden'), 7000);
}
async function updateItemWithUndo(id, patch, label = 'Event updated') {
  const prev = items.find(i => i.id === id);
  if (!prev) return;
  if (isLockedItem(prev)) return alert('This card is locked. Unlock it first to move or resize.');
  const previousPatch = { item_date: prev.item_date, start_time: prev.start_time, end_time: prev.end_time, sort_order: prev.sort_order };
  await updateItem(id, patch);
  showUndoToast(`${label}${patch.start_time ? ` to ${fmtTime(patch.start_time)}` : ''}`, async () => {
    await updateItem(id, previousPatch);
    els.undoToast?.classList.add('hidden');
  });
}
function isInteractiveTarget(target) { return !!target.closest('button,input,textarea,select,a,[contenteditable="true"]'); }

const STARTER_PACKING_ITEMS = ['Clothing', 'Toiletries', 'Chargers', 'Medications', 'Swimwear', 'Comfort items', 'Snacks', 'Travel documents'];
function packingStorageKey() { return `packing:${session?.user?.id || 'local'}:${activeTripId || 'no-trip'}`; }
function savePackingFallback() {
  try { localStorage.setItem(packingStorageKey(), JSON.stringify(packingItems)); } catch {}
}
function loadPackingFallback() {
  try {
    const saved = JSON.parse(localStorage.getItem(packingStorageKey()) || 'null');
    if (Array.isArray(saved)) return saved;
  } catch {}
  return STARTER_PACKING_ITEMS.map((label, idx) => ({ id: `local-${idx}-${Date.now()}`, label, packed: false, trip_id: activeTripId, user_id: session?.user?.id, sort_order: idx }));
}
function normalizePackingItem(row, idx = 0) {
  return { id: row.id || `local-${idx}-${Date.now()}`, trip_id: row.trip_id || activeTripId, user_id: row.user_id || session?.user?.id, label: row.label || row.title || 'Packing item', packed: !!row.packed, sort_order: row.sort_order ?? idx, local_only: !!row.local_only };
}
function inviteTokenFromUrl() { return new URLSearchParams(location.search).get('invite'); }

const locationCache = new Map();

function loadExternalAsset(tag, attrs) {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => { if (v !== undefined && v !== null) el.setAttribute(k, v); });
    el.onload = resolve;
    el.onerror = reject;
    document.head.appendChild(el);
  });
}
async function ensureLeafletAvailable() {
  if (window.L) return true;
  if (!document.querySelector('link[data-leaflet-fallback]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
    css.dataset.leafletFallback = 'true';
    document.head.appendChild(css);
  }
  const sources = [
    'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
  ];
  for (const src of sources) {
    try {
      await loadExternalAsset('script', { src, 'data-leaflet-fallback': 'true' });
      if (window.L) return true;
    } catch (_) {}
  }
  return !!window.L;
}

let locationSearchTimer = null;
function mapsUrl(query, app = 'google') {
  const q = encodeURIComponent(query || '');
  if (!q) return '#';
  if (app === 'apple') return `https://maps.apple.com/?q=${q}`;
  if (app === 'waze') return `https://waze.com/ul?q=${q}&navigate=yes`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
function renderMapLinks(container, query) {
  if (!container) return;
  const clean = (query || '').trim();
  if (!clean) { container.classList.add('hidden'); container.innerHTML = ''; return; }
  container.innerHTML = `<a target="_blank" rel="noopener" href="${mapsUrl(clean, 'google')}">Google Maps</a><a target="_blank" rel="noopener" href="${mapsUrl(clean, 'apple')}">Apple Maps</a><a target="_blank" rel="noopener" href="${mapsUrl(clean, 'waze')}">Waze</a>`;
  container.classList.remove('hidden');
}
async function fetchLocationSuggestions(query) {
  const clean = query.trim();
  if (clean.length < 3) return [];
  if (locationCache.has(clean.toLowerCase())) return locationCache.get(clean.toLowerCase());
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(clean)}`;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Location lookup failed');
    const data = await res.json();
    const suggestions = data.map(row => ({ label: row.display_name, lat: row.lat, lon: row.lon })).filter(x => x.label);
    locationCache.set(clean.toLowerCase(), suggestions);
    return suggestions;
  } catch (err) {
    console.warn('Autocomplete unavailable:', err);
    return [];
  }
}
function setupLocationAutocomplete(input, suggestionBox, linksBox) {
  if (!input || !suggestionBox) return;
  const close = () => { suggestionBox.classList.add('hidden'); suggestionBox.innerHTML = ''; };
  input.addEventListener('input', () => {
    renderMapLinks(linksBox, input.value);
    clearTimeout(locationSearchTimer);
    const q = input.value.trim();
    if (q.length < 3) return close();
    locationSearchTimer = setTimeout(async () => {
      const suggestions = await fetchLocationSuggestions(q);
      if (!suggestions.length) return close();
      suggestionBox.innerHTML = suggestions.map(s => `<button type="button" data-label="${escapeHtml(s.label)}"><strong>${escapeHtml(s.label.split(',')[0])}</strong><span>${escapeHtml(s.label.split(',').slice(1, 4).join(',').trim())}</span></button>`).join('');
      suggestionBox.classList.remove('hidden');
      suggestionBox.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
        input.value = btn.dataset.label;
        close();
        renderMapLinks(linksBox, input.value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }));
    }, 350);
  });
  input.addEventListener('focus', () => renderMapLinks(linksBox, input.value));
  document.addEventListener('click', e => { if (!suggestionBox.contains(e.target) && e.target !== input) close(); });
}


async function geocodeOne(query) {
  const clean = String(query || '').trim();
  if (!clean) return null;
  const cacheKey = `geo:${clean.toLowerCase()}`;
  if (locationCache.has(cacheKey)) return locationCache.get(cacheKey);
  const suggestions = await fetchLocationSuggestions(clean);
  const best = suggestions[0] ? { label: suggestions[0].label, lat: Number(suggestions[0].lat), lon: Number(suggestions[0].lon) } : null;
  locationCache.set(cacheKey, best);
  return best;
}
function selectedDayMapItems() {
  const day = selectedDay || currentTrip()?.start_date || todayISO();
  return items
    .filter(i => i.item_date === day && timeToMinutes(i.start_time) !== null && (i.location || i.from_location || i.to_location))
    .sort((a,b) => `${a.start_time || '99:99'} ${a.sort_order || 0}`.localeCompare(`${b.start_time || '99:99'} ${b.sort_order || 0}`));
}
async function renderDayMap() {
  if (!els.dailyRouteMap) return;
  const hasLeaflet = await ensureLeafletAvailable();
  if (!hasLeaflet) {
    if (els.dailyMapHelp) els.dailyMapHelp.textContent = 'Map library could not load. Check your connection or try refreshing.';
    els.dailyRouteMap.innerHTML = '<div class="map-fallback">Map could not load yet.</div>';
    return;
  }
  const seq = ++routeRenderToken;
  const day = selectedDay || currentTrip()?.start_date || todayISO();
  const dayItems = selectedDayMapItems();
  const showTravel = els.dailyShowTravel ? els.dailyShowTravel.checked !== false : true;

  if (els.dailyMapTitle) els.dailyMapTitle.textContent = `Route for ${fmtLongDate(day)}`;
  if (!routeMap) {
    els.dailyRouteMap.innerHTML = '';
    routeMap = L.map(els.dailyRouteMap, { scrollWheelZoom: false, tap: true, zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(routeMap);
    routeLayer = L.layerGroup().addTo(routeMap);
    routeMap.setView([39.5, -98.35], 4);
    requestAnimationFrame(() => routeMap.invalidateSize(true));
    setTimeout(() => routeMap.invalidateSize(true), 350);
    setTimeout(() => routeMap.invalidateSize(true), 900);
  }

  routeLayer.clearLayers();
  routeMarkers = [];
  if (els.dailyDirectionsLink) els.dailyDirectionsLink.classList.add('hidden');
  if (els.dailyMapStops) els.dailyMapStops.innerHTML = '';
  if (els.dailyMapLegend) els.dailyMapLegend.classList.toggle('hidden', !dayItems.length);

  if (!dayItems.length) {
    if (els.dailyMapHelp) els.dailyMapHelp.textContent = 'Add locations to timed plans to see this day’s pins and route.';
    setTimeout(() => routeMap?.invalidateSize(true), 120);
    return;
  }

  if (els.dailyMapHelp) els.dailyMapHelp.textContent = 'Building this day’s smart route…';
  const points = [];
  for (const item of dayItems.slice(0, 30)) {
    const itemPoints = routeLocationsForItem(item);
    for (const point of itemPoints) {
      if (!showTravel && point.behavior.kind === 'travel') continue;
      const geo = await geocodeOne(point.query);
      if (seq !== routeRenderToken) return;
      if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) points.push({ ...point, ...geo });
    }
  }

  if (!points.length) {
    if (els.dailyMapHelp) els.dailyMapHelp.textContent = 'Could not place these locations yet. Try using more specific addresses.';
    setTimeout(() => routeMap?.invalidateSize(true), 120);
    return;
  }

  const routePoints = points.filter(p => p.behavior.routable);
  const travelPoints = points.filter(p => !p.behavior.routable);
  const bounds = [];
  let routeIndex = 0;
  points.forEach((p) => {
    bounds.push([p.lat, p.lon]);
    const isRoute = p.behavior.routable;
    const displayIndex = isRoute ? ++routeIndex : 0;
    const marker = L.marker([p.lat, p.lon], { icon: mapPinIcon(p, displayIndex) })
      .bindPopup(`<strong>${isRoute ? `${displayIndex}. ` : ''}${escapeHtml(p.item.title)}</strong><br>${escapeHtml(p.behavior.label)}<br>${escapeHtml(fmtTime(p.item.start_time))}<br>${escapeHtml(shortLocationLabel(p.query || itemMapLocation(p.item)))}`);
    marker.addTo(routeLayer);
    routeMarkers.push(marker);
  });

  if (els.dailyMapStops) {
    const routeHtml = routePoints.map((p, idx) => `<a class="route-stop driving" target="_blank" rel="noopener" href="${mapsUrl(p.query || itemMapLocation(p.item), 'google')}"><b>${idx + 1}</b><strong>${escapeHtml(p.label || p.item.title)}</strong><span>${escapeHtml(fmtTime(p.item.start_time))}</span></a>`).join('');
    const travelHtml = travelPoints.map((p) => `<a class="route-stop travel" target="_blank" rel="noopener" href="${mapsUrl(p.query || itemMapLocation(p.item), 'google')}"><b>${escapeHtml(typeIcon[p.item.item_type] || '✈️')}</b><strong>${escapeHtml(p.label || p.item.title)}</strong><span>${escapeHtml(fmtTime(p.item.start_time))}</span></a>`).join('');
    els.dailyMapStops.innerHTML = `${routeHtml}${travelHtml ? `<div class="travel-stop-divider">Travel events shown separately</div>${travelHtml}` : ''}`;
  }

  const waypoints = routePoints.map(p => encodeURIComponent(p.query || itemMapLocation(p.item))); 
  if (els.dailyDirectionsLink && waypoints.length) {
    els.dailyDirectionsLink.href = waypoints.length === 1 ? mapsUrl(routePoints[0].query || itemMapLocation(routePoints[0].item), 'google') : `https://www.google.com/maps/dir/?api=1&origin=${waypoints[0]}&destination=${waypoints[waypoints.length - 1]}&waypoints=${waypoints.slice(1, -1).join('%7C')}`;
    els.dailyDirectionsLink.classList.remove('hidden');
  }

  if (routePoints.length >= 2) {
    const coordString = routePoints.map(p => `${p.lon},${p.lat}`).join(';');
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`);
      const data = await res.json();
      if (seq !== routeRenderToken) return;
      const route = data?.routes?.[0];
      if (route?.geometry) {
        L.geoJSON(route.geometry, { weight: 5, opacity: 0.82, className: 'smart-route-line' }).addTo(routeLayer);
        const miles = route.distance ? (route.distance / 1609.344).toFixed(1) : null;
        const hours = route.duration ? Math.round(route.duration / 3600 * 10) / 10 : null;
        const extra = travelPoints.length ? ` • ${travelPoints.length} travel event${travelPoints.length === 1 ? '' : 's'} separate` : '';
        if (els.dailyMapHelp) els.dailyMapHelp.textContent = `${routePoints.length} driving stops${miles ? ` • about ${miles} mi` : ''}${hours ? ` • ${hours} hr drive` : ''}${extra}. Verify route in your maps app.`;
      } else if (els.dailyMapHelp) els.dailyMapHelp.textContent = `${routePoints.length} driving pins found. Route line unavailable right now.${travelPoints.length ? ` ${travelPoints.length} travel event(s) shown separately.` : ''}`;
    } catch (err) {
      console.warn('Daily route unavailable:', err);
      if (els.dailyMapHelp) els.dailyMapHelp.textContent = `${routePoints.length} driving pins found. Route line unavailable right now.${travelPoints.length ? ` ${travelPoints.length} travel event(s) shown separately.` : ''}`;
    }
  } else if (els.dailyMapHelp) {
    if (routePoints.length === 1 && travelPoints.length) els.dailyMapHelp.textContent = 'One driving stop found. Flights/trains are shown separately and do not affect the driving route.';
    else if (routePoints.length === 1) els.dailyMapHelp.textContent = 'One driving stop found for this day. Add another routed location to draw a route.';
    else if (travelPoints.length) els.dailyMapHelp.textContent = 'Only flight/transit events found. They are shown separately and excluded from driving directions.';
    else els.dailyMapHelp.textContent = 'No routed stops found for this day.';
  }

  routeMap.fitBounds(bounds, { padding: [34, 34], maxZoom: 13 });
  setTimeout(() => routeMap?.invalidateSize(true), 160);
}
function debounceDayMapRender() {
  clearTimeout(window.__dailyMapTimer);
  window.__dailyMapTimer = setTimeout(renderDayMap, 450);
}


async function init() {
  pendingInviteToken = inviteTokenFromUrl();
  const { data } = await client.auth.getSession(); session = data.session;
  client.auth.onAuthStateChange(async (_event, s) => { session = s; refreshAuthUI(); if (session) await bootSignedIn(); });
  refreshAuthUI();
  if (session) await bootSignedIn();
  else if (pendingInviteToken) setStatus('Sign in to accept invite');
}
async function bootSignedIn() {
  if (pendingInviteToken) await acceptInvite(pendingInviteToken);
  await loadTrips();
}
function refreshAuthUI() {
  const signedIn = !!session?.user;
  const meta = session?.user?.user_metadata || {};
  const displayName = meta.full_name || meta.name || session?.user?.email?.split('@')[0] || 'Traveler';
  if (els.userName) els.userName.textContent = displayName.split(' ')[0] || 'Traveler';
  if (els.userAvatar) {
    const avatar = meta.avatar_url || meta.picture || '';
    els.userAvatar.src = avatar;
    els.userAvatar.classList.toggle('hidden', !signedIn || !avatar);
  }
  els.signedOut.classList.toggle('hidden', signedIn);
  els.appArea.classList.toggle('hidden', !signedIn);
  els.googleBtn.classList.toggle('hidden', signedIn);
  document.querySelector('.email-login').classList.toggle('hidden', signedIn);
  els.logoutBtn.classList.toggle('hidden', !signedIn);
  if (!signedIn && pendingInviteToken) {
    els.signedOut.querySelector('h2').textContent = 'You were invited to a shared itinerary.';
    els.signedOut.querySelector('p').textContent = 'Sign in first, then the invite will be added to your account automatically.';
  }
}
async function loginGoogle() { await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href.includes('?invite=') ? location.href : REDIRECT_TO } }); }
async function loginEmail() { const email = els.emailInput.value.trim(); if (!email) return alert('Enter your email first.'); const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.includes('?invite=') ? location.href : REDIRECT_TO } }); if (error) return alert(error.message); alert('Magic link sent. Check your email.'); }
async function logout() { await client.auth.signOut(); trips = []; items = []; members = []; activeTripId = null; render(); }
function showDbError(error) { console.error(error); alert(`${error.message}\n\nRun the newest schema.sql in Supabase SQL Editor. This version needs the members, invites, and accept_itinerary_invite function.`); setStatus('Database setup needed'); }

async function acceptInvite(token) {
  setStatus('Accepting invite...');
  const { data, error } = await client.rpc('accept_itinerary_invite', { invite_token: token });
  if (error) { showDbError(error); return; }
  activeTripId = data;
  localStorage.setItem('activeTripId', activeTripId);
  pendingInviteToken = null;
  history.replaceState({}, '', location.pathname);
  setStatus('Invite accepted');
}

async function loadTrips() {
  setStatus('Loading...');
  const { data, error } = await client.from('itinerary_trips').select('*').order('start_date', { ascending: true });
  if (error) return showDbError(error);
  trips = data || [];
  if (!trips.length) return createTrip({ title: 'My Trip', start_date: todayISO(), end_date: addDays(todayISO(), 3) });
  activeTripId = activeTripId || localStorage.getItem('activeTripId') || trips[0]?.id;
  if (!trips.find(t => t.id === activeTripId)) activeTripId = trips[0]?.id;
  await loadTripData();
}
async function loadTripData() { await Promise.all([loadItems(), loadMembers(), loadPackingItems(), loadMustDoItems(), loadMemoryItems()]); await loadWeatherForTrip(); setStatus('Ready'); render(); }
async function loadItems() {
  if (!activeTripId) return;
  const { data, error } = await client.from('itinerary_items').select('*').eq('trip_id', activeTripId).order('item_date').order('start_time');
  if (error) return showDbError(error);
  items = data || [];
}
async function loadMembers() {
  if (!activeTripId) return;
  const { data, error } = await client.from('itinerary_trip_members').select('*').eq('trip_id', activeTripId).order('created_at');
  if (error) return showDbError(error);
  members = data || [];
  await syncCurrentMemberProfile();
}
async function syncCurrentMemberProfile() {
  if (!activeTripId || !session?.user?.id) return;
  const meta = session.user.user_metadata || {};
  const display_name = meta.full_name || meta.name || session.user.email?.split('@')[0] || 'Traveler';
  const avatar_url = meta.avatar_url || meta.picture || '';
  const current = members.find(m => m.trip_id === activeTripId && m.user_id === session.user.id);
  if (!current) return;
  if (current.display_name === display_name && (current.avatar_url || '') === avatar_url) return;
  const { data, error } = await client.from('itinerary_trip_members')
    .update({ display_name, avatar_url })
    .eq('trip_id', activeTripId)
    .eq('user_id', session.user.id)
    .select()
    .single();
  if (!error && data) members = members.map(m => m.id === data.id ? data : m);
}

async function loadPackingItems() {
  if (!activeTripId || !session?.user?.id) { packingItems = []; return; }
  const { data, error } = await client
    .from('itinerary_packing_items')
    .select('*')
    .eq('trip_id', activeTripId)
    .eq('user_id', session.user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('Packing list table unavailable. Using local fallback until schema.sql is run.', error);
    packingItems = loadPackingFallback();
    setStatus('Packing list local only — run schema.sql for sync');
    return;
  }
  packingItems = (data || []).map(normalizePackingItem);
  if (!packingItems.length) await seedStarterPackingItems();
}

async function seedStarterPackingItems() {
  if (!activeTripId || !session?.user?.id) return;
  const rows = STARTER_PACKING_ITEMS.map((label, idx) => ({ trip_id: activeTripId, user_id: session.user.id, label, packed: false, sort_order: idx }));
  const { data, error } = await client.from('itinerary_packing_items').insert(rows).select('*');
  if (error) {
    console.warn('Could not seed Supabase packing list. Using local starter list.', error);
    packingItems = loadPackingFallback();
    savePackingFallback();
    return;
  }
  packingItems = (data || []).map(normalizePackingItem);
}
async function createTrip(input) {
  const { data: userData, error: userError } = await client.auth.getUser();
  const user = userData?.user || session?.user;
  if (userError || !user) {
    alert('Please sign in again before creating a trip.');
    return;
  }

  const title = input.title || 'New trip';
  const startDate = input.start_date || todayISO();
  const endDate = input.end_date || input.start_date || todayISO();

  // Use the security-definer helper from schema.sql so trip creation cannot be blocked by stale RLS policies.
  let { data, error } = await client.rpc('create_itinerary_trip', {
    trip_title: title,
    trip_start_date: startDate,
    trip_end_date: endDate
  });

  // Backward-compatible fallback for anyone who has not rerun the newest schema yet.
  if (error && String(error.message || '').includes('create_itinerary_trip')) {
    const payload = { user_id: user.id, title, start_date: startDate, end_date: endDate, destination: '', notes: '' };
    ({ data, error } = await client.from('itinerary_trips').insert(payload).select().single());
  }

  if (error) return showDbError(error);
  if (Array.isArray(data)) data = data[0];
  trips.push(data);
  activeTripId = data.id;
  selectedDay = data.start_date;
  localStorage.setItem('activeTripId', activeTripId);
  await loadTripData();
}
async function deleteTrip() { if (!activeTripId || !canDeleteTrip()) return alert('Only the trip owner can delete the trip.'); if (!confirm('Delete this entire trip and all itinerary items?')) return; const { error } = await client.from('itinerary_trips').delete().eq('id', activeTripId); if (error) return showDbError(error); trips = trips.filter(t => t.id !== activeTripId); activeTripId = trips[0]?.id || null; if (!activeTripId) await createTrip({ title: 'My Trip', start_date: todayISO(), end_date: addDays(todayISO(), 3) }); else await loadTripData(); }

function getTripPatchFromInputs() {
  let start = els.startDate.value || todayISO(); let end = els.endDate.value || start; if (end < start) { end = start; els.endDate.value = end; }
  return { title: els.tripTitle.value.trim() || 'Untitled trip', start_date: start, end_date: end, destination: els.destination.value.trim(), notes: els.tripNotes.value.trim(), gas_miles: Number(els.gasMiles?.value || 0), gas_mpg: Number(els.gasMpg?.value || 0), gas_price: Number(els.gasPrice?.value || 0), updated_at: new Date().toISOString() };
}
function queueTripSave() {
  if (!canEdit()) return renderTripEditor();
  const trip = currentTrip(); if (trip) Object.assign(trip, getTripPatchFromInputs());
  const days = dateRange(trip?.start_date, trip?.end_date); if (!days.includes(selectedDay)) selectedDay = trip?.start_date;
  renderTripSelect(); renderSummary(); renderDayTabs(); renderTimeline(); debounceDayMapRender();
  clearTimeout(autosaveTimer); setStatus('Saving...'); autosaveTimer = setTimeout(saveTrip, 500);
}
async function saveTrip() {
  const trip = currentTrip(); if (!trip || !canEdit()) return; const patch = getTripPatchFromInputs();
  const { data, error } = await client.from('itinerary_trips').update(patch).eq('id', trip.id).select().single(); if (error) return showDbError(error);
  trips = trips.map(t => t.id === data.id ? data : t); await loadWeatherForTrip(true); setStatus('Saved'); render();
}

function openItemDialog(date, item = null) {
  if (!canEdit()) return alert('This invite is view-only. Ask the owner for an edit invite.');
  if (item && isLockedItem(item)) return alert('This card is locked. Unlock it first to edit.');
  els.itemDialogTitle.textContent = item ? 'Edit itinerary item' : 'Add itinerary item';
  els.editingItemId.value = item?.id || ''; els.itemTitle.value = item?.title || ''; els.itemDate.value = item?.item_date || date || selectedDay || currentTrip()?.start_date || todayISO();
  els.itemTime.value = item?.start_time || ''; els.itemEndTime.value = item?.end_time || ''; els.itemType.value = item?.item_type || 'event'; els.itemBudget.value = item?.budget || ''; populateAssigneeSelect(item?.assigned_to || ''); if (els.itemFromLocation) els.itemFromLocation.value = item?.from_location || ''; if (els.itemToLocation) els.itemToLocation.value = item?.to_location || ''; els.itemLocation.value = item?.location || ''; els.itemNotes.value = item?.notes || ''; if (els.itemRainPlan) els.itemRainPlan.value = item?.rain_plan || '';
  syncRouteFieldVisibility(); renderMapLinks(els.itemLocationMapLinks, itemMapLocation({ ...item, location: els.itemLocation.value, from_location: els.itemFromLocation?.value || '', to_location: els.itemToLocation?.value || '', item_type: els.itemType.value }));
  els.itemDialog.showModal(); setTimeout(() => els.itemTitle.focus(), 50);
}
async function saveItemFromDialog(e) {
  e.preventDefault(); if (!activeTripId || !canEdit()) return;
  const title = els.itemTitle.value.trim(); if (!title) return alert('Add a title first.');
  const payload = { title, item_date: els.itemDate.value || currentTrip()?.start_date || todayISO(), start_time: els.itemTime.value || null, end_time: els.itemEndTime.value || null, item_type: els.itemType.value, budget: Number(els.itemBudget.value || 0), assigned_to: els.itemAssignedTo?.value || null, from_location: els.itemFromLocation?.value.trim() || '', to_location: els.itemToLocation?.value.trim() || '', location: els.itemLocation.value.trim(), notes: els.itemNotes.value.trim(), rain_plan: els.itemRainPlan?.value.trim() || '', sort_order: Date.now(), updated_at: new Date().toISOString() };
  const id = els.editingItemId.value;
  if (id) {
    let { data, error } = await client.from('itinerary_items').update(payload).eq('id', id).select().single();
    if (error && isMissingRainPlanColumn(error)) {
      const { rain_plan, ...safePayload } = payload;
      ({ data, error } = await client.from('itinerary_items').update(safePayload).eq('id', id).select().single());
      if (!error) setStatus('Saved without rain sync — run schema.sql to enable Rain Plan');
    }
    if (error) return showDbError(error);
    if (data && !('rain_plan' in data)) data.rain_plan = payload.rain_plan;
    items = items.map(i => i.id === id ? data : i);
  } else {
    let { data, error } = await client.from('itinerary_items').insert({ ...payload, user_id: session.user.id, trip_id: activeTripId }).select().single();
    if (error && isMissingRainPlanColumn(error)) {
      const { rain_plan, ...safePayload } = payload;
      ({ data, error } = await client.from('itinerary_items').insert({ ...safePayload, user_id: session.user.id, trip_id: activeTripId }).select().single());
      if (!error) setStatus('Saved without rain sync — run schema.sql to enable Rain Plan');
    }
    if (error) return showDbError(error);
    if (data && !('rain_plan' in data)) data.rain_plan = payload.rain_plan;
    items.push(data);
  }
  selectedDay = payload.item_date; els.itemDialog.close(); render();
}
async function updateItem(id, patch) { if (!canEdit()) return; const current = items.find(i => i.id === id); if (current && isLockedItem(current) && !('locked' in patch) && !('locked_at' in patch)) return alert('This card is locked. Unlock it first to make changes.'); const { data, error } = await client.from('itinerary_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single(); if (error) return showDbError(error); items = items.map(i => i.id === id ? data : i); render(); }
async function deleteItem(id) { if (!canEdit()) return; const item = items.find(i => i.id === id); if (isLockedItem(item)) return alert('This card is locked. Unlock it before deleting.'); if (!confirm('Delete this item?')) return; const { error } = await client.from('itinerary_items').delete().eq('id', id); if (error) return showDbError(error); items = items.filter(i => i.id !== id); render(); }

async function createInviteLink() {
  if (!activeTripId || !canEdit()) return alert('Only editors can create invite links.');
  const payload = { trip_id: activeTripId, created_by: session.user.id, role: els.inviteRole.value || 'editor' };
  const { data, error } = await client.from('itinerary_trip_invites').insert(payload).select('token, role').single();
  if (error) return showDbError(error);
  const link = `${APP_URL}?invite=${encodeURIComponent(data.token)}`;
  els.inviteLink.value = link;
  els.inviteOutput.classList.remove('hidden');
  try { await navigator.clipboard.writeText(link); setStatus(`${data.role === 'viewer' ? 'View' : 'Edit'} invite copied`); } catch { setStatus('Invite created'); }
}
async function copyInviteLink() { if (!els.inviteLink.value) return; await navigator.clipboard.writeText(els.inviteLink.value); setStatus('Invite copied'); }

function render() { renderTripSelect(); renderTripEditor(); renderSummary(); renderHomeDashboard(); renderSharePanel(); renderDayTabs(); renderTimeline(); renderPackingList(); renderMustDoList(); renderMemoryList(); renderDayMap(); }
function renderTripSelect() { els.tripSelect.innerHTML = trips.map(t => `<option value="${t.id}">${escapeHtml(t.title || 'Untitled trip')}</option>`).join(''); els.tripSelect.value = activeTripId || ''; }
function renderTripEditor() {
  const t = currentTrip(); if (!t) return; els.tripTitle.value = t.title || ''; els.startDate.value = t.start_date || ''; els.endDate.value = t.end_date || ''; els.destination.value = t.destination || ''; els.tripNotes.value = t.notes || ''; if (els.gasMiles) els.gasMiles.value = Number(t.gas_miles || 0) || ''; if (els.gasMpg) els.gasMpg.value = Number(t.gas_mpg || 0) || ''; if (els.gasPrice) els.gasPrice.value = Number(t.gas_price || 0) || ''; renderMapLinks(els.destinationMapLinks, t.destination || ''); selectedDay ||= t.start_date;
  if (els.detailsDestination) els.detailsDestination.textContent = t.destination || 'Add destination';
  if (els.detailsStart) els.detailsStart.textContent = t.start_date ? new Date(`${t.start_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  if (els.detailsEnd) els.detailsEnd.textContent = t.end_date ? new Date(`${t.end_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const editable = canEdit();
  [els.tripTitle, els.startDate, els.endDate, els.destination, els.tripNotes, els.gasMiles, els.gasMpg, els.gasPrice, els.addAnyItemBtn, els.exportBtn, els.importInput].forEach(el => { if (el) el.disabled = !editable && el !== els.exportBtn; });
  els.deleteTripBtn.disabled = !canDeleteTrip();
}
function renderSummary() { const t = currentTrip(); const days = t ? dateRange(t.start_date, t.end_date) : []; const itemBudget = items.reduce((sum, i) => sum + Number(i.budget || 0), 0); const mustBudget = mustDoItems.reduce((sum, i) => String(i.priority || '').toLowerCase() === 'must' ? sum + Number(i.budget || 0) : sum, 0); const gasBudget = calcGasCost(); els.totalBudget.textContent = money(itemBudget + mustBudget + gasBudget); els.stopCount.textContent = items.length; els.dayCount.textContent = days.length; if (els.travelerCount) els.travelerCount.textContent = Math.max(1, members.length); updateTripCountdown(); els.plannerTitle.textContent = t ? `${t.title || 'Trip'} • ${days.length} day${days.length === 1 ? '' : 's'}` : 'Your itinerary'; renderGasCalculator(); renderTripProgress(); }
function renderHomeDashboard() {
  if (!els.homeGreeting) return;
  const t = currentTrip();
  const first = (session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || 'Traveler').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  els.homeGreeting.textContent = `${hour < 18 ? '☀' : '🌙'} ${greeting}, ${first}`;
  const now = new Date();
  const start = t?.start_date ? new Date(`${t.start_date}T00:00:00`) : null;
  const end = t?.end_date ? new Date(`${t.end_date}T23:59:59`) : null;
  if (!t || !start) {
    els.homeDaysLeft.textContent = '—'; els.homeCountdownLabel.textContent = 'days until your trip'; els.homeCountdownDetail.textContent = 'Create a trip to start planning.';
  } else if (now < start) {
    const diff = start - now;
    const days = Math.max(0, Math.ceil(diff / 86400000));
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    els.homeDaysLeft.textContent = String(days);
    els.homeCountdownLabel.textContent = `days until ${t.title || 'your trip'}`;
    els.homeCountdownDetail.textContent = `${Math.max(0, days-1)}d ${hours}h ${mins}m until go time`;
  } else if (end && now <= end) {
    const allDays = dateRange(t.start_date, t.end_date);
    const today = todayISO();
    const idx = Math.max(0, allDays.indexOf(today));
    const diff = end - now;
    els.homeDaysLeft.textContent = `Day ${idx + 1}`;
    els.homeCountdownLabel.textContent = `of ${allDays.length}`;
    els.homeCountdownDetail.textContent = `${Math.ceil(diff / 86400000)}d left in this adventure`;
  } else {
    els.homeDaysLeft.textContent = '✓'; els.homeCountdownLabel.textContent = 'trip complete'; els.homeCountdownDetail.textContent = 'Add memories and save your favorite moments.';
  }
  const must = mustDoItems.filter(i => String(i.priority || '').toLowerCase() === 'must');
  const doneMust = must.filter(i => i.completed).length;
  els.homeMustDoLine.textContent = `${must.length} Must Do${must.length === 1 ? '' : 's'}${must.length ? ` • ${doneMust}/${must.length} done` : ''}`;
  const planned = items.reduce((sum, i) => sum + Number(i.budget || 0), 0) + must.reduce((sum, i) => sum + Number(i.budget || 0), 0) + calcGasCost();
  const tripBudget = Number(t?.budget || 0);
  const pct = tripBudget ? Math.min(999, Math.round((planned / tripBudget) * 100)) : (planned ? 100 : 0);
  els.homeBudgetLine.textContent = tripBudget ? `Budget ${pct}% • ${money(planned)} / ${money(tripBudget)}` : `Planned ${money(planned)}`;
  const progressPct = (() => { const val = els.tripProgressText?.textContent?.match(/\d+/); return val ? Number(val[0]) : 0; })();
  if (els.homeProgressBar) els.homeProgressBar.style.width = `${Math.max(6, Math.min(100, progressPct || pct || 8))}%`;
  const recent = items.slice().sort((a,b)=> new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
  const other = recent.find(i => i.user_id && i.user_id !== session?.user?.id);
  const todayAdded = recent.filter(i => String(i.created_at || '').slice(0,10) === todayISO()).length;
  els.homeActivityLine.textContent = other ? `${memberLabel(other.user_id)} updated ${other.title || 'an event'}` : todayAdded ? `${todayAdded} event${todayAdded === 1 ? '' : 's'} added today` : `${items.length} planned event${items.length === 1 ? '' : 's'}`;
  const w = weatherByDate?.[selectedDay || t?.start_date];
  if (w) { const [wi, wl] = weatherCodeInfo(w.code); els.homeWeatherLine.textContent = `${wi} ${wl} • ${Math.round(w.max)}° / ${Math.round(w.min)}° • ${Math.round(w.precip || 0)}% rain`; } else { els.homeWeatherLine.textContent = weatherStatus || 'Weather ready'; }
}

function renderSharePanel() {
  const role = currentMembership()?.role || 'viewer';
  els.roleBadge.textContent = role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : 'Viewer';
  els.roleBadge.className = `role-badge ${role}`;
  els.createInviteBtn.disabled = !canEdit();
  els.inviteRole.disabled = !canEdit();
  els.collabList.innerHTML = members.map(m => `<div class="collab-pill"><strong>${escapeHtml(memberLabel(m.user_id))}</strong><span>${escapeHtml(m.role || 'editor')}</span></div>`).join('') || '<p class="helper-text">No collaborators yet.</p>';
}
function renderDayTabs() {
  const t = currentTrip(); const days = t ? dateRange(t.start_date, t.end_date) : []; if (!days.includes(selectedDay)) selectedDay = days[0];
  els.dayTabs.innerHTML = days.map((day, idx) => { const count = items.filter(i => i.item_date === day).length; return `<button class="day-tab ${day === selectedDay ? 'active' : ''}" data-day="${day}"><span>Day ${idx + 1}</span><strong>${fmtShortDate(day)}</strong><em>${count} item${count === 1 ? '' : 's'}</em>${weatherChipHtml(day)}</button>`; }).join('');
  els.dayTabs.querySelectorAll('.day-tab').forEach(btn => btn.addEventListener('click', () => { selectedDay = btn.dataset.day; renderDayTabs(); renderTimeline(); renderDayMap(); }));
}
function renderTimeline() {
  const t = currentTrip(); if (!t) { els.timeline.innerHTML = ''; return; }
  const days = dateRange(t.start_date, t.end_date); const visibleDays = document.body.classList.contains('show-all-days') ? days : [selectedDay || days[0]];
  els.timeline.innerHTML = '';
  visibleDays.forEach(day => {
    const dayItems = items.filter(i => i.item_date === day).sort((a,b) => `${a.start_time || '99:99'}-${a.sort_order}`.localeCompare(`${b.start_time || '99:99'}-${b.sort_order}`));
    const timedItems = dayItems.filter(i => timeToMinutes(i.start_time) !== null);
    const anytimeItems = dayItems.filter(i => timeToMinutes(i.start_time) === null);
    const card = document.createElement('section'); card.className = 'day-card glass'; card.dataset.date = day;
    card.innerHTML = `<div class="day-header"><div><p>Day ${days.indexOf(day) + 1}</p><strong>${fmtDate(day)}</strong></div><span>${dayItems.length} planned</span></div>${dayWeatherSummaryHtml(day)}<div class="timeline-board" data-day="${day}"></div><div class="anytime-list"></div><button class="quick-add ghost-btn">+ Add to this day</button>`;
    const board = card.querySelector('.timeline-board');
    const anytime = card.querySelector('.anytime-list');
    const totalRows = (DAY_END_MIN - DAY_START_MIN) / 30;
    board.style.height = `${TIMELINE_TOP_PAD + (totalRows * SLOT_HEIGHT) + TIMELINE_BOTTOM_PAD}px`;
    for (let mins = DAY_START_MIN; mins < DAY_END_MIN; mins += 30) {
      const row = document.createElement('div');
      row.className = `time-row ${mins % 60 === 0 ? 'hour' : 'half'}`;
      row.style.top = `${minutesToY(mins)}px`;
      row.innerHTML = mins % 60 === 0 ? `<span>${fmtTime(minutesToTime(mins))}</span>` : '<span></span>';
      board.appendChild(row);
    }
    if (!timedItems.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-day timeline-empty';
      empty.innerHTML = '<strong>No timed plans yet</strong><p>Drag cards onto the timeline or add a start time.</p>';
      board.appendChild(empty);
    }
    timedItems.forEach(item => board.appendChild(renderItem(item, true)));
    if (anytimeItems.length) {
      anytime.innerHTML = '<h3>Anytime / Unscheduled</h3>';
      anytimeItems.forEach(item => anytime.appendChild(renderItem(item, false)));
    } else if (!dayItems.length) {
      anytime.innerHTML = `<div class="empty-day"><strong>No plans yet</strong><p>Add a stop, drive block, hotel, food idea, or reminder for this day.</p></div>`;
    }
    const quick = card.querySelector('.quick-add'); quick.disabled = !canEdit(); quick.addEventListener('click', () => openItemDialog(day));
    if (canEdit()) {
      board.addEventListener('dragover', e => { e.preventDefault(); board.classList.add('drag-over'); });
      board.addEventListener('dragleave', () => board.classList.remove('drag-over'));
      board.addEventListener('drop', async e => {
        e.preventDefault(); board.classList.remove('drag-over');
        if (!draggedId) return;
        const dragged = items.find(i => i.id === draggedId); if (!dragged) return; if (isLockedItem(dragged)) { draggedId = null; return alert('This card is locked. Unlock it first to move it.'); }
        const rect = board.getBoundingClientRect();
        const newStart = yToMinutes(e.clientY - rect.top);
        await updateItemWithUndo(draggedId, { item_date: day, ...defaultTimedPatch(dragged, newStart) }, 'Event moved');
        draggedId = null;
      });
    }
    els.timeline.appendChild(card);
  });
}
function renderItem(item, isTimed = false) {
  const tpl = document.getElementById('itemTemplate').content.cloneNode(true);
  const card = tpl.querySelector('.item-card');
  card.dataset.id = item.id;
  const locked = isLockedItem(item);
  if (locked) card.classList.add('is-locked');
  card.draggable = canEdit() && !locked;
  const start = itemStartMinutes(item), end = itemEndMinutes(item);
  if (isTimed) {
    card.classList.add('timeline-item');
    card.style.top = `${minutesToY(start) + (TIMELINE_EVENT_GAP / 2)}px`;
    const naturalHeight = minutesToY(end) - minutesToY(start) - TIMELINE_EVENT_GAP;
    card.style.minHeight = `${Math.max(82, naturalHeight)}px`;
    card.style.height = `${Math.max(82, naturalHeight)}px`;
    card.classList.toggle('compact-time-card', naturalHeight < 70);
    card.classList.toggle('roomy-time-card', naturalHeight >= 110);
    card.classList.toggle('very-roomy-time-card', naturalHeight >= 170);
  }
  const time = [fmtTime(item.start_time), fmtTime(item.end_time)].filter(Boolean).join(' - ');
  tpl.querySelector('.time-chip').textContent = time || 'Anytime';
  tpl.querySelector('.item-type').textContent = typeIcon[item.item_type] || '📌';
  tpl.querySelector('h3').textContent = item.title;
  card.classList.add(`type-${String(item.item_type || 'event').toLowerCase()}`);
  const meta = tpl.querySelector('.item-meta');
  const routeText = item.from_location && item.to_location ? `${shortLocationLabel(item.from_location)} → ${shortLocationLabel(item.to_location)}` : '';
  const displayLocation = routeText || shortLocationLabel(itemMapLocation(item));
  const mapQuery = itemMapLocation(item);
  const budget = Number(item.budget || 0);
  const assignee = memberAvatarHtml(item.assigned_to || '');
  meta.innerHTML = `<span class="type-pill">${escapeHtml(item.item_type || 'event')}</span>${budget ? `<span class="cost-pill">${money(budget)}</span>` : ''}${item.rain_plan ? '<span class="rain-pill">☔ Rain ready</span>' : ''}${locked ? '<span class="locked-pill">🔒 Locked</span>' : ''}${assignee ? `<span class="assigned-pill">${assignee}</span>` : '<span class="assigned-pill everyone">👥 Everyone</span>'}<span class="created-pill">Added by ${escapeHtml(memberLabel(item.user_id))}</span>${mapQuery ? `<a class="location-link full-row" target="_blank" rel="noopener" title="${escapeHtml(mapQuery)}" href="${mapsUrl(mapQuery, 'google')}">📍 ${escapeHtml(displayLocation)}</a>` : ''}`;
  tpl.querySelector('.item-notes').textContent = item.notes || '';
  const overlap = findOverlap(item);
  const softOverlap = !overlap ? findSoftOverlap(item) : null;
  const warning = tpl.querySelector('.overlap-warning');
  if (overlap) {
    card.classList.add('has-overlap');
    warning.classList.remove('hidden');
    warning.textContent = `⚠ Overlaps with ${overlap.title}`;
  } else if (softOverlap) {
    card.classList.add('has-soft-overlap');
    warning.classList.remove('hidden');
    warning.textContent = `↔ Same time as ${softOverlap.title}`;
  }
  const rainText = tpl.querySelector('.rain-plan-text');
  if (rainText) rainText.textContent = item.rain_plan || 'No rain backup added yet. Tap Edit rain plan to add an indoor option, alternate time, or weather note.';
  if (item.rain_plan) card.classList.add('has-rain-plan');
  const editBtn = tpl.querySelector('.edit'); const delBtn = tpl.querySelector('.delete'); const earlierBtn = tpl.querySelector('.earlier'); const laterBtn = tpl.querySelector('.later'); const lockBtn = tpl.querySelector('.lock-toggle'); const rainBtn = tpl.querySelector('.rain-toggle'); const rainClose = tpl.querySelector('.rain-close'); const editRainBtn = tpl.querySelector('.edit-rain'); const resetRainBtn = tpl.querySelector('.reset-rain');
  editBtn.disabled = delBtn.disabled = earlierBtn.disabled = laterBtn.disabled = !canEdit() || locked; if (editRainBtn) editRainBtn.disabled = !canEdit() || locked; if (resetRainBtn) resetRainBtn.disabled = !canEdit() || locked;
  // Compact icon actions keep timeline cards clean on desktop and mobile.
  earlierBtn.textContent = '−30'; earlierBtn.title = 'Move 30 minutes earlier'; earlierBtn.setAttribute('aria-label', 'Move 30 minutes earlier');
  laterBtn.textContent = '+30'; laterBtn.title = 'Move 30 minutes later'; laterBtn.setAttribute('aria-label', 'Move 30 minutes later');
  editBtn.textContent = '✎'; editBtn.title = 'Edit event'; editBtn.setAttribute('aria-label', 'Edit event');
  delBtn.textContent = '×'; delBtn.title = 'Delete event'; delBtn.setAttribute('aria-label', 'Delete event');
  if (rainBtn) { rainBtn.textContent = item.rain_plan ? '☔' : '☔+'; rainBtn.title = item.rain_plan ? 'View rain plan' : 'Add rain plan'; rainBtn.setAttribute('aria-label', rainBtn.title); }
  if (lockBtn) { lockBtn.disabled = !canEdit(); lockBtn.textContent = locked ? '🔒' : '🔓'; lockBtn.title = locked ? 'Unlock this card' : 'Lock this card'; lockBtn.setAttribute('aria-label', lockBtn.title); }
  editBtn.addEventListener('click', () => openItemDialog(item.item_date, item));
  lockBtn?.addEventListener('click', () => toggleItemLock(item));
  rainBtn?.addEventListener('click', () => handleRainButton(card, item));
  rainClose?.addEventListener('click', () => card.classList.remove('rain-flipped'));
  editRainBtn?.addEventListener('click', () => openRainEditor(item));
  resetRainBtn?.addEventListener('click', () => resetRainPlan(item.id));
  attachRainLongPress(card, item);
  delBtn.addEventListener('click', () => deleteItem(item.id));
  earlierBtn.addEventListener('click', () => shiftItemBy(item.id, -30));
  laterBtn.addEventListener('click', () => shiftItemBy(item.id, 30));
  if (canEdit() && !locked) {
    card.addEventListener('dragstart', () => { draggedId = item.id; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('pointerdown', e => startTimelinePointer(e, item, card));
  }
  return tpl;
}

async function toggleItemLock(item) {
  if (!canEdit()) return;
  const locked = isLockedItem(item);
  const patch = locked
    ? { locked: false, locked_by: null, locked_at: null }
    : { locked: true, locked_by: session.user.id, locked_at: new Date().toISOString() };
  const { data, error } = await client.from('itinerary_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', item.id).select().single();
  if (error) return showDbError(error);
  items = items.map(i => i.id === item.id ? data : i);
  setStatus(locked ? 'Card unlocked' : 'Card locked');
  render();
}

function openRainEditor(item) {
  openItemDialog(item.item_date, item);
  setTimeout(() => { els.itemRainPlan?.focus(); els.itemRainPlan?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
}
function handleRainButton(card, item) {
  if (item.rain_plan && String(item.rain_plan).trim()) {
    card.classList.toggle('rain-flipped');
  } else if (canEdit()) {
    openRainEditor(item);
  } else {
    card.classList.toggle('rain-flipped');
  }
}
async function resetRainPlan(id) {
  if (!canEdit()) return;
  if (!confirm('Clear this rain plan?')) return;
  await updateItemWithUndo(id, { rain_plan: '' }, 'Rain plan cleared');
}

function attachRainLongPress(card, item) {
  let timer = null;
  let startX = 0, startY = 0;
  const clear = () => { if (timer) clearTimeout(timer); timer = null; };
  card.addEventListener('touchstart', e => {
    if (isInteractiveTarget(e.target)) return;
    const t = e.touches?.[0]; if (!t) return;
    startX = t.clientX; startY = t.clientY;
    timer = setTimeout(() => {
      handleRainButton(card, item);
      if (navigator.vibrate) navigator.vibrate(18);
    }, 560);
  }, { passive: true });
  card.addEventListener('touchmove', e => {
    const t = e.touches?.[0];
    if (!t) return clear();
    if (Math.abs(t.clientX - startX) > 14 || Math.abs(t.clientY - startY) > 14) clear();
  }, { passive: true });
  card.addEventListener('touchend', clear, { passive: true });
  card.addEventListener('touchcancel', clear, { passive: true });
}

async function shiftItemBy(id, delta) {
  const item = items.find(i => i.id === id); if (!item || !canEdit()) return; if (isLockedItem(item)) return alert('This card is locked. Unlock it first to move it.');
  const start = timeToMinutes(item.start_time) ?? DAY_START_MIN;
  const end = timeToMinutes(item.end_time) ?? start + 60;
  const duration = Math.max(30, end - start);
  let newStart = clamp(start + delta, 0, DAY_END_MIN - duration);
  const patch = { start_time: minutesToTime(newStart), end_time: minutesToTime(newStart + duration), sort_order: newStart };
  await updateItemWithUndo(id, patch, delta > 0 ? 'Event moved later' : 'Event moved earlier');
}

function startTimelinePointer(e, item, card) {
  const resizeStart = e.target.closest('.resize-start');
  const resizeEnd = e.target.closest('.resize-end');
  if (!canEdit() || isLockedItem(item) || (!resizeStart && !resizeEnd && isInteractiveTarget(e.target))) return;
  const board = card.closest('.timeline-board'); if (!board) return;
  e.preventDefault();
  card.setPointerCapture?.(e.pointerId);
  const rect = board.getBoundingClientRect();
  const initialTop = parseFloat(card.style.top || '0');
  const initialHeight = card.offsetHeight;
  const offset = e.clientY - card.getBoundingClientRect().top;
  timelineDrag = { id: item.id, mode: resizeStart ? 'resize-start' : resizeEnd ? 'resize-end' : 'move', board, rect, initialTop, initialHeight, offset, day: board.dataset.day, item };
  card.classList.add('timeline-moving');
  const onMove = ev => {
    if (!timelineDrag) return;
    const y = ev.clientY - timelineDrag.rect.top;
    if (timelineDrag.mode === 'move') {
      const top = clamp(y - timelineDrag.offset, TIMELINE_TOP_PAD, timelineDrag.board.offsetHeight - TIMELINE_BOTTOM_PAD - 40);
      card.style.top = `${top}px`;
    } else if (timelineDrag.mode === 'resize-start') {
      const bottom = timelineDrag.initialTop + timelineDrag.initialHeight;
      const top = clamp(y, 0, bottom - 40);
      card.style.top = `${top}px`;
      card.style.minHeight = `${bottom - top}px`; card.style.height = `${bottom - top}px`;
    } else if (timelineDrag.mode === 'resize-end') {
      const height = clamp(y - timelineDrag.initialTop, 40, timelineDrag.board.offsetHeight - timelineDrag.initialTop);
      card.style.minHeight = `${height}px`; card.style.height = `${height}px`;
    }
  };
  const onUp = async ev => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    card.classList.remove('timeline-moving');
    if (!timelineDrag) return;
    const targetBoard = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.timeline-board') || timelineDrag.board;
    const targetRect = targetBoard.getBoundingClientRect();
    const draggedItem = items.find(i => i.id === timelineDrag.id); if (!draggedItem) { timelineDrag = null; return; }
    let patch = {};
    if (timelineDrag.mode === 'move') {
      const newStart = yToMinutes(ev.clientY - targetRect.top - timelineDrag.offset);
      patch = { item_date: targetBoard.dataset.day, ...defaultTimedPatch(draggedItem, newStart) };
    } else if (timelineDrag.mode === 'resize-start') {
      const oldEnd = itemEndMinutes(draggedItem);
      const newStart = clamp(snapMinutes(yToMinutes(parseFloat(card.style.top || timelineDrag.initialTop) - (TIMELINE_EVENT_GAP / 2))), DAY_START_MIN, oldEnd - 30);
      patch = { start_time: minutesToTime(newStart), end_time: minutesToTime(oldEnd), sort_order: newStart };
    } else {
      const oldStart = itemStartMinutes(draggedItem);
      const newEnd = clamp(snapMinutes(yToMinutes(parseFloat(card.style.top || timelineDrag.initialTop) + card.offsetHeight + (TIMELINE_EVENT_GAP / 2))), oldStart + 30, DAY_END_MIN);
      patch = { start_time: minutesToTime(oldStart), end_time: minutesToTime(newEnd), sort_order: oldStart };
    }
    timelineDrag = null;
    await updateItemWithUndo(draggedItem.id, patch, patch.end_time && patch.start_time ? 'Event time updated' : 'Event moved');
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function renderPackingList() {
  if (!els.packingList) return;
  const editable = canEdit();
  const total = packingItems.length;
  const done = packingItems.filter(i => i.packed).length;
  if (els.packingCount) els.packingCount.textContent = `${done}/${total}`;
  if (els.packingProgress) els.packingProgress.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
  if (els.packingInput) els.packingInput.disabled = !editable;
  if (els.addPackingBtn) els.addPackingBtn.disabled = !editable;
  if (els.resetPackingBtn) els.resetPackingBtn.disabled = !editable;
  if (!total) {
    els.packingList.innerHTML = `<div class="packing-empty">No packing items yet.${editable ? ' Add your first item below.' : ''}</div>`;
    return;
  }
  els.packingList.innerHTML = packingItems
    .slice()
    .sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(item => `
      <div class="packing-row ${item.packed ? 'done' : ''}" data-id="${escapeHtml(item.id)}" draggable="${editable ? 'true' : 'false'}">
        <button type="button" class="packing-drag ghost-btn" ${editable ? '' : 'disabled'} title="Drag to reorder">⋮⋮</button>
        <label>
          <input type="checkbox" ${item.packed ? 'checked' : ''} ${editable ? '' : 'disabled'} />
          <span class="packing-label" contenteditable="${editable ? 'true' : 'false'}" spellcheck="false">${escapeHtml(item.label)}</span>
        </label>
        <button type="button" class="packing-delete ghost-btn" ${editable ? '' : 'disabled'} title="Remove item">×</button>
      </div>`).join('');
}

function packingIsLocalOnly(id) { return String(id || '').startsWith('local-'); }

async function addPackingItem(label) {
  const clean = (label || '').trim();
  if (!clean || !activeTripId || !session?.user?.id || !canEdit()) return;
  const payload = { trip_id: activeTripId, user_id: session.user.id, label: clean, packed: false, sort_order: Date.now() };
  const { data, error } = await client.from('itinerary_packing_items').insert(payload).select('*').single();
  if (error) {
    const local = normalizePackingItem({ ...payload, id: `local-${Date.now()}`, local_only: true });
    packingItems.push(local); savePackingFallback(); renderPackingList();
    console.warn('Packing item saved locally because Supabase table is unavailable.', error);
    return;
  }
  packingItems.push(normalizePackingItem(data)); renderPackingList();
}

async function updatePackingItem(id, patch) {
  if (!canEdit()) return;
  packingItems = packingItems.map(i => i.id === id ? { ...i, ...patch } : i);
  renderPackingList();
  if (packingIsLocalOnly(id)) { savePackingFallback(); return; }
  const { error } = await client.from('itinerary_packing_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', session.user.id);
  if (error) { console.warn('Packing update failed; keeping local UI value.', error); savePackingFallback(); }
}

async function deletePackingItem(id) {
  if (!canEdit()) return;
  packingItems = packingItems.filter(i => i.id !== id);
  renderPackingList();
  if (packingIsLocalOnly(id)) { savePackingFallback(); return; }
  const { error } = await client.from('itinerary_packing_items').delete().eq('id', id).eq('user_id', session.user.id);
  if (error) { console.warn('Packing delete failed.', error); }
}

async function resetPackingItems() {
  if (!canEdit() || !activeTripId || !session?.user?.id) return;
  if (!confirm('Reset your packing list to the starter list?')) return;
  const { error } = await client.from('itinerary_packing_items').delete().eq('trip_id', activeTripId).eq('user_id', session.user.id);
  if (error) {
    packingItems = STARTER_PACKING_ITEMS.map((label, idx) => normalizePackingItem({ id: `local-${idx}-${Date.now()}`, label, sort_order: idx, local_only: true }));
    savePackingFallback(); renderPackingList(); return;
  }
  packingItems = [];
  await seedStarterPackingItems();
  renderPackingList();
}

async function reorderPackingItems(dragId, targetId) {
  if (!canEdit() || !dragId || !targetId || dragId === targetId) return;
  const ordered = packingItems.slice().sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const from = ordered.findIndex(i => i.id === dragId);
  const to = ordered.findIndex(i => i.id === targetId);
  if (from < 0 || to < 0) return;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  const updates = ordered.map((item, idx) => ({ ...item, sort_order: idx * 100 }));
  packingItems = updates;
  renderPackingList();
  savePackingFallback();
  const remote = updates.filter(i => !packingIsLocalOnly(i.id));
  await Promise.all(remote.map(i => client.from('itinerary_packing_items').update({ sort_order: i.sort_order, updated_at: new Date().toISOString() }).eq('id', i.id).eq('user_id', session.user.id)));
}



function normalizeMustDo(row, idx = 0) {
  return { id: row.id, trip_id: row.trip_id || activeTripId, title: row.title || row.label || 'Must do', notes: row.notes || '', location: row.location || '', budget: Number(row.budget || 0), priority: row.priority || 'want', completed: !!row.completed, completed_by: row.completed_by || null, completed_at: row.completed_at || null, created_by: row.created_by || row.user_id || null, sort_order: row.sort_order ?? idx, created_at: row.created_at || null };
}
async function loadMustDoItems() {
  if (!activeTripId) { mustDoItems = []; return; }
  const { data, error } = await client.from('itinerary_must_do_items').select('*').eq('trip_id', activeTripId).order('completed', { ascending: true }).order('sort_order', { ascending: true });
  if (error) { console.warn('Must Do table unavailable. Run schema.sql to enable shared Must Do.', error); mustDoItems = []; return; }
  mustDoItems = (data || []).map(normalizeMustDo);
}
function renderMustDoList() {
  if (!els.mustDoList) return;
  const editable = canEdit();
  const total = mustDoItems.length;
  const done = mustDoItems.filter(i => i.completed).length;
  if (els.mustDoCount) els.mustDoCount.textContent = `${done}/${total}`;
  if (els.mustDoProgress) els.mustDoProgress.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
  if (els.mustDoInput) els.mustDoInput.disabled = !editable;
  if (els.mustDoPriority) els.mustDoPriority.disabled = !editable;
  if (els.mustDoBudget) els.mustDoBudget.disabled = !editable;
  if (els.addMustDoBtn) els.addMustDoBtn.disabled = !editable;
  if (!total) { els.mustDoList.innerHTML = `<div class="packing-empty">No shared must-do items yet.${editable ? ' Add one for everyone.' : ''}</div>`; renderTripProgress(); return; }
  const priorityLabel = { must: 'Must', want: 'Want', maybe: 'Maybe' };
  const priorityIcon = { must: '⭐', want: '💜', maybe: '✨' };
  els.mustDoList.innerHTML = mustDoItems.slice().sort((a,b)=>(a.completed-b.completed)||((a.sort_order??0)-(b.sort_order??0))).map(item => `
    <div class="shared-row mustdo-row ${item.completed ? 'done' : ''}" data-id="${escapeHtml(item.id)}">
      <label>
        <input type="checkbox" ${item.completed ? 'checked' : ''} ${editable ? '' : 'disabled'} />
        <span class="shared-icon">${priorityIcon[item.priority] || '⭐'}</span>
        <span class="shared-text"><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(priorityLabel[item.priority] || 'Want')}${item.budget ? ` • ${money(item.budget)}` : ''}${item.location ? ` • ${escapeHtml(shortLocationLabel(item.location))}` : ''}</em></span>
      </label>
      <button type="button" class="shared-delete ghost-btn" ${editable ? '' : 'disabled'} title="Remove item">×</button>
    </div>`).join('');
  renderTripProgress();
}
async function addMustDoItem(title) {
  const clean = (title || '').trim();
  if (!clean || !activeTripId || !session?.user?.id || !canEdit()) return;
  const payload = { trip_id: activeTripId, created_by: session.user.id, title: clean, priority: els.mustDoPriority?.value || 'want', budget: Number(els.mustDoBudget?.value || 0), completed: false, sort_order: Date.now() };
  const { data, error } = await client.from('itinerary_must_do_items').insert(payload).select('*').single();
  if (error) { showDbError(error); return; }
  mustDoItems.push(normalizeMustDo(data)); renderMustDoList();
}
async function updateMustDoItem(id, patch) {
  if (!canEdit()) return;
  if ('completed' in patch) { patch.completed_by = patch.completed ? session.user.id : null; patch.completed_at = patch.completed ? new Date().toISOString() : null; }
  const prev = mustDoItems.slice();
  mustDoItems = mustDoItems.map(i => i.id === id ? { ...i, ...patch } : i); renderMustDoList();
  const { data, error } = await client.from('itinerary_must_do_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) { mustDoItems = prev; renderMustDoList(); showDbError(error); return; }
  mustDoItems = mustDoItems.map(i => i.id === id ? normalizeMustDo(data) : i); renderMustDoList();
}
async function deleteMustDoItem(id) {
  if (!canEdit()) return;
  const item = mustDoItems.find(i => i.id === id);
  if (!item || !confirm(`Remove "${item.title}" from Must Do Together?`)) return;
  const prev = mustDoItems.slice(); mustDoItems = mustDoItems.filter(i => i.id !== id); renderMustDoList();
  const { error } = await client.from('itinerary_must_do_items').delete().eq('id', id);
  if (error) { mustDoItems = prev; renderMustDoList(); showDbError(error); }
}

function calcGasCost() {
  const t = currentTrip() || {};
  const miles = Number(els.gasMiles?.value || t.gas_miles || 0);
  const mpg = Number(els.gasMpg?.value || t.gas_mpg || 0);
  const price = Number(els.gasPrice?.value || t.gas_price || 0);
  if (!miles || !mpg || !price) return 0;
  return (miles / mpg) * price;
}
function renderGasCalculator() {
  if (!els.gasEstimate) return;
  const miles = Number(els.gasMiles?.value || 0), mpg = Number(els.gasMpg?.value || 0), price = Number(els.gasPrice?.value || 0);
  const gallons = miles && mpg ? miles / mpg : 0;
  const cost = calcGasCost();
  els.gasEstimate.textContent = money(cost);
  if (els.gasBreakdown) els.gasBreakdown.textContent = cost ? `${gallons.toFixed(1)} gallons × ${money(price)}/gal = ${money(cost)}` : 'Add values to calculate fuel cost.';
}
async function geocodeText(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q || '')}`;
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const data = await r.json();
  if (!data?.[0]) throw new Error('Could not find that area.');
  return { lat: Number(data[0].lat), lon: Number(data[0].lon), label: data[0].display_name };
}
function activityQueryFor(term) {
  const t = String(term || '').toLowerCase();
  if (/coffee|cafe/.test(t)) return ['node[amenity=cafe]', 'way[amenity=cafe]'];
  if (/food|restaurant|dinner|lunch|breakfast/.test(t)) return ['node[amenity=restaurant]', 'way[amenity=restaurant]'];
  if (/museum|science|art/.test(t)) return ['node[tourism=museum]', 'way[tourism=museum]'];
  if (/park|playground|kid/.test(t)) return ['node[leisure=park]', 'way[leisure=park]', 'node[leisure=playground]'];
  if (/beach|lake|water/.test(t)) return ['node[natural=beach]', 'way[natural=beach]', 'node[tourism=viewpoint]'];
  return ['node[tourism~"attraction|museum|viewpoint"]', 'node[amenity~"cafe|restaurant"]', 'way[leisure=park]'];
}
async function generateActivities(useGps = false) {
  if (!els.activityResults) return;
  els.activityGeneratorStatus.textContent = 'Searching nearby open map data...';
  els.activityResults.innerHTML = '';
  try {
    let center;
    if (useGps && navigator.geolocation) {
      center = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(p => resolve({lat:p.coords.latitude, lon:p.coords.longitude, label:'Your current GPS position'}), reject, { enableHighAccuracy:true, timeout:10000 }));
    } else {
      const q = currentTrip()?.destination || els.destination?.value || '';
      if (!q) throw new Error('Add a destination or use GPS first.');
      center = await geocodeText(q);
    }
    const radius = Number(els.activityRadius?.value || 5000);
    const filters = activityQueryFor(els.activitySearch?.value || 'fun');
    const body = `[out:json][timeout:18];(${filters.map(f=>`${f}(around:${radius},${center.lat},${center.lon});`).join('')});out center tags 20;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', { method:'POST', body });
    const data = await res.json();
    const found = (data.elements || []).map(el => ({
      title: el.tags?.name || el.tags?.brand || 'Nearby idea',
      type: el.tags?.tourism || el.tags?.amenity || el.tags?.leisure || 'place',
      lat: el.lat || el.center?.lat,
      lon: el.lon || el.center?.lon,
      address: [el.tags?.['addr:housenumber'], el.tags?.['addr:street'], el.tags?.['addr:city']].filter(Boolean).join(' ')
    })).filter(x => x.title !== 'Nearby idea').slice(0,12);
    els.activityResultCount.textContent = String(found.length);
    els.activityGeneratorStatus.textContent = found.length ? `Found ${found.length} ideas near ${center.label}.` : 'No ideas found. Try a broader word like food, park, museum, or coffee.';
    els.activityResults.innerHTML = found.map((r, idx)=>`<div class="activity-result"><div><strong>${escapeHtml(r.title)}</strong><em>${escapeHtml(r.type)}${r.address ? ' • '+escapeHtml(r.address) : ''}</em></div><button type="button" data-idx="${idx}" data-action="must">Must Do</button><button type="button" data-idx="${idx}" data-action="schedule" class="ghost-btn">Schedule</button></div>`).join('');
    window.__activityResults = found;
  } catch (err) {
    els.activityGeneratorStatus.textContent = err.message || 'Activity search failed.';
  }
}

function normalizeMemory(row) {
  return { id: row.id, trip_id: row.trip_id || activeTripId, user_id: row.user_id || row.created_by, note: row.note || row.title || '', location: row.location || '', memory_date: row.memory_date || todayISO(), created_at: row.created_at || null };
}
async function loadMemoryItems() {
  if (!activeTripId) { memoryItems = []; return; }
  const { data, error } = await client.from('itinerary_memories').select('*').eq('trip_id', activeTripId).order('created_at', { ascending: false }).limit(20);
  if (error) { console.warn('Memories table unavailable. Run schema.sql to enable shared Memories.', error); memoryItems = []; return; }
  memoryItems = (data || []).map(normalizeMemory);
}
function renderMemoryList() {
  if (!els.memoryList) return;
  const editable = canEdit();
  if (els.memoryCount) els.memoryCount.textContent = String(memoryItems.length);
  if (els.memoryInput) els.memoryInput.disabled = !editable;
  if (els.addMemoryBtn) els.addMemoryBtn.disabled = !editable;
  if (!memoryItems.length) { els.memoryList.innerHTML = `<div class="packing-empty">No memories yet.${editable ? ' Add a small note during the trip.' : ''}</div>`; renderTripProgress(); return; }
  els.memoryList.innerHTML = memoryItems.slice(0,6).map(mem => `
    <div class="memory-row" data-id="${escapeHtml(mem.id)}">
      <span class="shared-icon">💜</span>
      <div><strong>${escapeHtml(mem.note)}</strong><em>${escapeHtml(fmtShortDate(mem.memory_date))}${mem.location ? ` • ${escapeHtml(shortLocationLabel(mem.location))}` : ''}</em></div>
      <button type="button" class="memory-delete ghost-btn" ${editable ? '' : 'disabled'} title="Remove memory">×</button>
    </div>`).join('');
  renderTripProgress();
}
async function addMemoryItem(note) {
  const clean = (note || '').trim();
  if (!clean || !activeTripId || !session?.user?.id || !canEdit()) return;
  const payload = { trip_id: activeTripId, user_id: session.user.id, note: clean, memory_date: selectedDay || todayISO() };
  const { data, error } = await client.from('itinerary_memories').insert(payload).select('*').single();
  if (error) { showDbError(error); return; }
  memoryItems.unshift(normalizeMemory(data)); renderMemoryList();
}
async function deleteMemoryItem(id) {
  if (!canEdit()) return;
  const prev = memoryItems.slice(); memoryItems = memoryItems.filter(i => i.id !== id); renderMemoryList();
  const { error } = await client.from('itinerary_memories').delete().eq('id', id);
  if (error) { memoryItems = prev; renderMemoryList(); showDbError(error); }
}
function renderTripProgress() {
  if (!els.tripProgress || !els.tripProgressText) return;
  const itemScore = items.length ? items.filter(i => i.item_date && i.start_time).length / Math.max(1, items.length) : 0;
  const mustScore = mustDoItems.length ? mustDoItems.filter(i => i.completed).length / mustDoItems.length : 0;
  const packScore = packingItems.length ? packingItems.filter(i => i.packed).length / packingItems.length : 0;
  const memoryScore = Math.min(1, memoryItems.length / 5);
  const pieces = [itemScore, mustScore, packScore, memoryScore].filter(n => !Number.isNaN(n));
  const pct = Math.round((pieces.reduce((a,b)=>a+b,0) / Math.max(1,pieces.length)) * 100);
  els.tripProgress.style.width = `${pct}%`;
  els.tripProgressText.textContent = `${pct}% trip progress`;
}

function exportJson() { const data = { trip: currentTrip(), items }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${currentTrip()?.title || 'trip'}-itinerary.json`; a.click(); URL.revokeObjectURL(a.href); }
async function importJson(file) { if (!canEdit()) return; const parsed = JSON.parse(await file.text()); if (!parsed?.items?.length) return alert('No items found in JSON.'); const newItems = parsed.items.map(i => ({ user_id: session.user.id, trip_id: activeTripId, title: i.title, item_date: i.item_date, start_time: i.start_time, end_time: i.end_time, item_type: i.item_type || 'event', budget: Number(i.budget || 0), location: i.location || '', from_location: i.from_location || '', to_location: i.to_location || '', assigned_to: i.assigned_to || null, notes: i.notes || '', sort_order: i.sort_order || Date.now() })); const { error } = await client.from('itinerary_items').insert(newItems); if (error) return showDbError(error); await loadTripData(); }

els.googleBtn.addEventListener('click', loginGoogle); els.emailBtn.addEventListener('click', loginEmail); els.logoutBtn.addEventListener('click', logout);
els.tripSelect.addEventListener('change', async () => { activeTripId = els.tripSelect.value; selectedDay = null; localStorage.setItem('activeTripId', activeTripId); await loadTripData(); });
function openTripDialog() { els.dialogTripTitle.value = ''; els.dialogStartDate.value = todayISO(); els.dialogEndDate.value = addDays(todayISO(), 3); els.tripDialog.showModal(); }
els.newTripBtn.addEventListener('click', openTripDialog); if (els.sidebarNewTripBtn) els.sidebarNewTripBtn.addEventListener('click', openTripDialog); if (els.viewItineraryBtn) els.viewItineraryBtn.addEventListener('click', () => document.getElementById('plannerTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); if (els.homeContinueBtn) els.homeContinueBtn.addEventListener('click', () => document.getElementById('plannerTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
els.createTripConfirm.addEventListener('click', e => { e.preventDefault(); els.tripDialog.close(); createTrip({ title: els.dialogTripTitle.value, start_date: els.dialogStartDate.value, end_date: els.dialogEndDate.value }); });
[els.gasMiles, els.gasMpg, els.gasPrice].forEach(el => el?.addEventListener('input', queueTripSave));
els.activityGenerateBtn?.addEventListener('click', () => generateActivities(false));
els.activityUseGps?.addEventListener('click', () => generateActivities(true));
els.activityResults?.addEventListener('click', e => { const btn = e.target.closest('button[data-idx]'); if (!btn) return; const idea = window.__activityResults?.[Number(btn.dataset.idx)]; if (!idea) return; const loc = idea.lat && idea.lon ? `${idea.title}, ${idea.address || ''}`.trim() : idea.address || idea.title; if (btn.dataset.action === 'must') { if (els.mustDoInput) els.mustDoInput.value = idea.title; if (els.mustDoPriority) els.mustDoPriority.value = 'want'; addMustDoItem(idea.title); } else { openItemDialog(selectedDay || currentTrip()?.start_date || todayISO(), { title: idea.title, item_type: 'event', location: loc, notes: `Generated idea: ${idea.type}` }); } });
els.deleteTripBtn.addEventListener('click', deleteTrip); if (els.dailyShowTravel) els.dailyShowTravel.addEventListener('change', renderDayMap); ['tripTitle','startDate','endDate','destination','tripNotes'].forEach(k => els[k].addEventListener('input', queueTripSave));
els.addAnyItemBtn.addEventListener('click', () => openItemDialog(selectedDay)); els.saveItemBtn.addEventListener('click', saveItemFromDialog);
els.createInviteBtn.addEventListener('click', createInviteLink); els.copyInviteBtn.addEventListener('click', copyInviteLink);
setupLocationAutocomplete(els.destination, els.destinationSuggestions, els.destinationMapLinks);
setupLocationAutocomplete(els.itemLocation, els.itemLocationSuggestions, els.itemLocationMapLinks);
setupLocationAutocomplete(els.itemFromLocation, els.itemFromSuggestions, null);
setupLocationAutocomplete(els.itemToLocation, els.itemToSuggestions, null);
els.itemType?.addEventListener('change', syncRouteFieldVisibility);
els.expandAllBtn.addEventListener('click', () => { document.body.classList.add('show-all-days'); renderTimeline(); }); els.collapseAllBtn.addEventListener('click', () => { document.body.classList.remove('show-all-days'); renderTimeline(); });
els.exportBtn.addEventListener('click', exportJson); els.importInput.addEventListener('change', e => e.target.files[0] && importJson(e.target.files[0]));

if (els.packingForm) els.packingForm.addEventListener('submit', async e => {
  e.preventDefault();
  await addPackingItem(els.packingInput.value);
  els.packingInput.value = '';
});
if (els.packingList) els.packingList.addEventListener('change', e => {
  const row = e.target.closest('.packing-row');
  if (row && e.target.matches('input[type="checkbox"]')) updatePackingItem(row.dataset.id, { packed: e.target.checked });
});
if (els.packingList) els.packingList.addEventListener('click', e => {
  const row = e.target.closest('.packing-row');
  if (row && e.target.closest('.packing-delete')) deletePackingItem(row.dataset.id);
});
if (els.packingList) els.packingList.addEventListener('focusout', e => {
  const label = e.target.closest('.packing-label');
  const row = e.target.closest('.packing-row');
  if (label && row) {
    const clean = label.textContent.trim();
    const item = packingItems.find(i => i.id === row.dataset.id);
    if (!clean) return deletePackingItem(row.dataset.id);
    if (item && item.label !== clean) updatePackingItem(row.dataset.id, { label: clean });
  }
});

if (els.packingList) els.packingList.addEventListener('dragstart', e => {
  const row = e.target.closest('.packing-row');
  if (!row || !canEdit()) return;
  packingDragId = row.dataset.id;
  row.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', packingDragId);
});
if (els.packingList) els.packingList.addEventListener('dragover', e => {
  const row = e.target.closest('.packing-row');
  if (!row || !packingDragId || row.dataset.id === packingDragId) return;
  e.preventDefault();
  row.classList.add('drag-over');
});
if (els.packingList) els.packingList.addEventListener('dragleave', e => {
  e.target.closest('.packing-row')?.classList.remove('drag-over');
});
if (els.packingList) els.packingList.addEventListener('drop', async e => {
  const row = e.target.closest('.packing-row');
  e.preventDefault();
  els.packingList.querySelectorAll('.packing-row').forEach(r => r.classList.remove('drag-over','dragging'));
  if (!row || !packingDragId) return;
  const sourceId = packingDragId;
  packingDragId = null;
  await reorderPackingItems(sourceId, row.dataset.id);
});
if (els.packingList) els.packingList.addEventListener('dragend', () => {
  packingDragId = null;
  els.packingList.querySelectorAll('.packing-row').forEach(r => r.classList.remove('drag-over','dragging'));
});


if (els.mustDoForm) els.mustDoForm.addEventListener('submit', async e => {
  e.preventDefault();
  await addMustDoItem(els.mustDoInput.value);
  els.mustDoInput.value = '';
  if (els.mustDoBudget) els.mustDoBudget.value = '';
});
if (els.mustDoList) els.mustDoList.addEventListener('change', e => {
  const row = e.target.closest('.mustdo-row');
  if (row && e.target.matches('input[type="checkbox"]')) updateMustDoItem(row.dataset.id, { completed: e.target.checked });
});
if (els.mustDoList) els.mustDoList.addEventListener('click', e => {
  const row = e.target.closest('.mustdo-row');
  if (row && e.target.closest('.shared-delete')) deleteMustDoItem(row.dataset.id);
});
if (els.memoryForm) els.memoryForm.addEventListener('submit', async e => {
  e.preventDefault();
  await addMemoryItem(els.memoryInput.value);
  els.memoryInput.value = '';
});
if (els.memoryList) els.memoryList.addEventListener('click', e => {
  const row = e.target.closest('.memory-row');
  if (row && e.target.closest('.memory-delete')) deleteMemoryItem(row.dataset.id);
});

if (els.resetPackingBtn) els.resetPackingBtn.addEventListener('click', resetPackingItems);
if (els.snapMode) { els.snapMode.value = localStorage.getItem('timelineSnapMinutes') || '30'; els.snapMode.addEventListener('change', () => { localStorage.setItem('timelineSnapMinutes', els.snapMode.value); renderTimeline(); }); }
if (els.undoBtn) els.undoBtn.addEventListener('click', async () => { if (lastUndo) await lastUndo(); });

setInterval(updateTripCountdown, 60000);
init();
