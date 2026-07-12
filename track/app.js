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
  packingPanel: document.getElementById('packingPanel'), packingCount: document.getElementById('packingCount'), packingProgress: document.getElementById('packingProgress'), packingProgressList: document.getElementById('packingProgressList'), packingList: document.getElementById('packingList'), packingForm: document.getElementById('packingForm'), packingInput: document.getElementById('packingInput'), addPackingBtn: document.getElementById('addPackingBtn'), resetPackingBtn: document.getElementById('resetPackingBtn'),
  mustDoPanel: document.getElementById('mustDoPanel'), mustDoCount: document.getElementById('mustDoCount'), mustDoProgress: document.getElementById('mustDoProgress'), mustDoList: document.getElementById('mustDoList'), mustDoForm: document.getElementById('mustDoForm'), mustDoInput: document.getElementById('mustDoInput'), mustDoPriority: document.getElementById('mustDoPriority'), addMustDoBtn: document.getElementById('addMustDoBtn'), mustDoBudget: document.getElementById('mustDoBudget'),
  memoryPanel: document.getElementById('memoryPanel'), memoryCount: document.getElementById('memoryCount'), memoryList: document.getElementById('memoryList'), memoryForm: document.getElementById('memoryForm'), memoryInput: document.getElementById('memoryInput'), addMemoryBtn: document.getElementById('addMemoryBtn'), tripProgress: document.getElementById('tripProgress'), tripProgressText: document.getElementById('tripProgressText'), gasMiles: document.getElementById('gasMiles'), gasMpg: document.getElementById('gasMpg'), gasPrice: document.getElementById('gasPrice'), gasEstimate: document.getElementById('gasEstimate'), gasBreakdown: document.getElementById('gasBreakdown'), activitySearch: document.getElementById('activitySearch'), activityRadius: document.getElementById('activityRadius'), activityUseGps: document.getElementById('activityUseGps'), activityGenerateBtn: document.getElementById('activityGenerateBtn'), activityGeneratorStatus: document.getElementById('activityGeneratorStatus'), activityResults: document.getElementById('activityResults'), activityResultCount: document.getElementById('activityResultCount'), avatarFunBtn: document.getElementById('avatarFunBtn'), funIdeasDialog: document.getElementById('funIdeasDialog'), funAccessPanel: document.getElementById('funAccessPanel'), funPermissionList: document.getElementById('funPermissionList'), funIdeasList: document.getElementById('funIdeasList'), funIdeaId: document.getElementById('funIdeaId'), funIdeaTitle: document.getElementById('funIdeaTitle'), funIdeaDescription: document.getElementById('funIdeaDescription'), funIdeaPlayType: document.getElementById('funIdeaPlayType'), funIdeaStatus: document.getElementById('funIdeaStatus'), funIdeaVisibility: document.getElementById('funIdeaVisibility'), funIdeaAssignedTo: document.getElementById('funIdeaAssignedTo'), funIdeaCategory: document.getElementById('funIdeaCategory'), funCategoryFilter: document.getElementById('funCategoryFilter'), funCategoryManageBtn: document.getElementById('funCategoryManageBtn'), funCategoryEditor: document.getElementById('funCategoryEditor'), funCategoryName: document.getElementById('funCategoryName'), funCategoryEmoji: document.getElementById('funCategoryEmoji'), funAddCategoryBtn: document.getElementById('funAddCategoryBtn'), funCategoryList: document.getElementById('funCategoryList'), funNewIdeaBtn: document.getElementById('funNewIdeaBtn'), funCancelEditorBtn: document.getElementById('funCancelEditorBtn'), funClearBtn: document.getElementById('funClearBtn'), funSaveBtn: document.getElementById('funSaveBtn'), memoryPhotoInput: document.getElementById('memoryPhotoInput'), memoryPhotoBtn: document.getElementById('memoryPhotoBtn'), memorySlideshowBtn: document.getElementById('memorySlideshowBtn'), memorySlideshowDialog: document.getElementById('memorySlideshowDialog'), memorySlideshowStage: document.getElementById('memorySlideshowStage'), memoryPrevBtn: document.getElementById('memoryPrevBtn'), memoryNextBtn: document.getElementById('memoryNextBtn'), shoppingListDialog: document.getElementById('shoppingListDialog'), shoppingListTitle: document.getElementById('shoppingListTitle'), shoppingPermissionPanel: document.getElementById('shoppingPermissionPanel'), shoppingPermissionList: document.getElementById('shoppingPermissionList'), shoppingListBody: document.getElementById('shoppingListBody'), shoppingNewBtn: document.getElementById('shoppingNewBtn'), shoppingEditor: document.getElementById('shoppingEditor'), shoppingItemId: document.getElementById('shoppingItemId'), shoppingItemName: document.getElementById('shoppingItemName'), shoppingItemQty: document.getElementById('shoppingItemQty'), shoppingItemNotes: document.getElementById('shoppingItemNotes'), shoppingCancelEditorBtn: document.getElementById('shoppingCancelEditorBtn'), shoppingSaveBtn: document.getElementById('shoppingSaveBtn'),
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
function isCoarsePointerDevice() {
  return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
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

function populateFunAssigneeSelect(selected = '') {
  if (!els.funIdeaAssignedTo) return;
  const seen = new Set();
  const opts = ['<option value="">Anyone / shared</option>'];
  const ids = [session?.user?.id, ...members.map(m => m.user_id)].filter(Boolean);
  ids.forEach(id => {
    if (seen.has(id)) return;
    seen.add(id);
    opts.push(`<option value="${escapeHtml(id)}">${escapeHtml(id === session?.user?.id ? 'Me' : memberLabel(id))}</option>`);
  });
  els.funIdeaAssignedTo.innerHTML = opts.join('');
  els.funIdeaAssignedTo.value = selected || '';
}

function syncRouteFieldVisibility() {
  const pointToPoint = isPointToPointType({ item_type: els.itemType?.value });
  document.querySelectorAll('.route-field').forEach(el => el.classList.toggle('hidden', !pointToPoint));
  if (pointToPoint && els.itemLocation) els.itemLocation.placeholder = 'Optional label/place name';
  else if (els.itemLocation) els.itemLocation.placeholder = 'Address / location';
}
let session = null, trips = [], items = [], members = [], packingItems = [], packingProgressByUser = [], mustDoItems = [], memoryItems = [], funIdeas = [], funPermissions = [], funCategories = [], shoppingListItems = [], shoppingListPermissions = [], activeShoppingItemId = null, funCategoryFilterValue = 'all', activeMemorySlide = 0, activeTripId = null, draggedId = null, autosaveTimer = null, selectedDay = null, pendingInviteToken = null, lastUndo = null, undoTimer = null, timelineDrag = null, packingDragId = null, realtimeChannel = null, liveSyncTimer = null, lastLiveSyncKey = '', routeMap = null, routeLayer = null, routeMarkers = [], routeRenderToken = 0, weatherByDate = {}, weatherStatus = '', quickMemoryCaptureMode = false, starterCleanupChecked = false;

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
function isMissingSharedTable(error) { return /itinerary_must_do_items|itinerary_memories|trip_fun_ideas|trip_fun_permissions|itinerary_shopping_items|itinerary_shopping_permissions|schema cache|relation|does not exist/i.test(String(error?.message || '')); }

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


function uniqueGeocodeQueries(query) {
  const clean = String(query || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const out = [clean];
  const lower = clean.toLowerCase();
  const airportMatch = clean.match(/([A-Z][A-Za-z .'-]+?\s+(?:International\s+)?Airport)/i);
  if (airportMatch?.[1]) out.push(airportMatch[1].trim());
  if (/philadelphia|\bphl\b/i.test(clean) && /airport|terminal|island/i.test(clean)) out.push('Philadelphia International Airport, Philadelphia, PA');
  if (/milwaukee|mke|mitchell/i.test(clean) && /airport|terminal|flight/i.test(clean)) out.push('Milwaukee Mitchell International Airport, Milwaukee, WI');
  if (lower.includes(',')) {
    const parts = clean.split(',').map(x => x.trim()).filter(Boolean);
    if (parts[0]) out.push(parts[0]);
    if (parts.length >= 2) out.push(`${parts[0]}, ${parts[parts.length - 2]}`);
  }
  // Last-resort cleanup: Nominatim sometimes fails when a selected result is very long
  // or contains terminal/road detail. Keep the recognizable place name first.
  out.push(clean.replace(/\b(Island Avenue|Terminal [A-Z0-9]+|Arrivals|Departures|Garage|Lot)\b.*$/i, '').replace(/,+\s*$/,'').trim());
  return [...new Set(out.filter(Boolean))];
}
async function geocodeOne(query) {
  const clean = String(query || '').trim();
  if (!clean) return null;
  const cacheKey = `geo:${clean.toLowerCase()}`;
  if (locationCache.has(cacheKey)) return locationCache.get(cacheKey);
  let best = null;
  for (const q of uniqueGeocodeQueries(clean)) {
    try {
      const suggestions = await fetchLocationSuggestions(q);
      if (suggestions[0]) {
        best = { label: suggestions[0].label, lat: Number(suggestions[0].lat), lon: Number(suggestions[0].lon), queryUsed: q };
        break;
      }
    } catch (err) {
      console.warn('Geocode attempt failed:', q, err);
    }
  }
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
    else if (routePoints.length === 1) {
      const hasPointToPoint = dayItems.some(i => isPointToPointType(i) && i.from_location && i.to_location);
      els.dailyMapHelp.textContent = hasPointToPoint ? 'One end of a drive could not be mapped. Try simplifying the From/To address, for example “Philadelphia International Airport, PA”.' : 'One driving stop found for this day. Add another routed location to draw a route.';
    }
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
    els.userAvatar.classList.toggle('hidden', !signedIn || !avatar); if (els.avatarFunBtn) els.avatarFunBtn.classList.toggle('hidden', !signedIn || !avatar);
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
async function logout() { if (realtimeChannel) { try { client.removeChannel(realtimeChannel); } catch {} realtimeChannel = null; } await client.auth.signOut(); trips = []; items = []; members = []; activeTripId = null; render(); }
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

  // One-time per session cleanup for old duplicate starter trips. This only removes
  // empty default "My Trip/New trip" records for the signed-in user, keeping real trips safe.
  if (!starterCleanupChecked && session?.user?.id) {
    starterCleanupChecked = true;
    try {
      const { data: removed, error: cleanupError } = await client.rpc('cleanup_duplicate_empty_itinerary_starters');
      if (!cleanupError && Number(removed || 0) > 0) {
        setStatus(`Cleaned up ${removed} empty starter trip${Number(removed) === 1 ? '' : 's'}`);
        const refreshed = await client.from('itinerary_trips').select('*').order('start_date', { ascending: true });
        if (!refreshed.error) trips = refreshed.data || trips;
      }
    } catch (cleanupError) {
      console.warn('Starter cleanup unavailable. Run schema.sql to enable it.', cleanupError);
    }
  }

  if (!trips.length) {
    activeTripId = null;
    localStorage.removeItem('activeTripId');
    items = []; members = []; packingItems = []; packingProgressByUser = []; mustDoItems = []; memoryItems = [];
    funIdeas = []; funPermissions = []; funCategories = []; shoppingListItems = []; shoppingListPermissions = [];
    setStatus('No trips yet — create one to start planning');
    render();
    try { openTripDialog(); } catch {}
    return;
  }
  activeTripId = activeTripId || localStorage.getItem('activeTripId') || trips[0]?.id;
  if (!trips.find(t => t.id === activeTripId)) activeTripId = trips[0]?.id;
  await loadTripData();
}
async function loadTripData() { await Promise.all([loadItems(), loadMembers(), loadPackingItems(), loadMustDoItems(), loadMemoryItems()]); await loadPackingProgress(); await loadWeatherForTrip(); setupRealtimeSync(); setStatus('Ready'); render(); }

function setupRealtimeSync() {
  if (!client || !activeTripId || !session?.user?.id) return;
  if (realtimeChannel) {
    try { client.removeChannel(realtimeChannel); } catch {}
    realtimeChannel = null;
  }
  const tableNames = [
    'itinerary_items',
    'itinerary_trip_members',
    'itinerary_packing_items',
    'itinerary_must_do',
    'itinerary_memories',
    'trip_fun_permissions',
    'trip_fun_ideas',
    'trip_fun_categories',
    'itinerary_shopping_items'
  ];
  let channel = client.channel(`trip-live-${activeTripId}`);
  tableNames.forEach(table => {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `trip_id=eq.${activeTripId}` }, payload => handleRealtimePayload(table, payload));
  });
  channel = channel.on('broadcast', { event: 'trip-change' }, ({ payload }) => {
    if (!payload || payload.trip_id !== activeTripId) return;
    if (payload.actor && payload.actor === session?.user?.id) return;
    setStatus(payload.label || 'Trip updated');
    clearTimeout(liveSyncTimer);
    liveSyncTimer = setTimeout(refreshLiveTripData, 120);
  });
  realtimeChannel = channel.subscribe(status => {
    if (status === 'SUBSCRIBED') setStatus('Live sync on');
  });
}
function broadcastTripChange(label = 'Trip updated') {
  try {
    if (!realtimeChannel || !activeTripId) return;
    realtimeChannel.send({ type: 'broadcast', event: 'trip-change', payload: { trip_id: activeTripId, actor: session?.user?.id || '', label, at: Date.now() } });
  } catch (error) { console.warn('Broadcast sync unavailable', error); }
}

function handleRealtimePayload(table, payload) {
  if (!activeTripId) return;
  const actor = payload?.new?.user_id || payload?.new?.created_by || payload?.new?.updated_by || payload?.old?.user_id || payload?.old?.created_by || '';
  const selfChange = actor && session?.user?.id && actor === session.user.id;
  if (!selfChange) {
    const label = table === 'itinerary_packing_items' ? 'Packing progress updated'
      : table === 'itinerary_items' ? 'Itinerary updated'
      : table === 'itinerary_memories' ? 'Memories updated'
      : table === 'itinerary_must_do' ? 'Must Do updated'
      : table === 'trip_fun_ideas' || table === 'trip_fun_permissions' || table === 'trip_fun_categories' ? 'Private list updated'
      : table === 'itinerary_shopping_items' ? 'Shopping list updated'
      : 'Trip updated';
    setStatus(label);
  }
  const key = `${table}:${payload.eventType}:${payload.new?.id || payload.old?.id || ''}:${payload.new?.updated_at || payload.old?.updated_at || Date.now()}`;
  if (key === lastLiveSyncKey) return;
  lastLiveSyncKey = key;
  clearTimeout(liveSyncTimer);
  liveSyncTimer = setTimeout(refreshLiveTripData, selfChange ? 250 : 120);
}

async function refreshLiveTripData() {
  if (!activeTripId || !session?.user?.id) return;
  try {
    await Promise.all([loadItems(), loadMembers(), loadPackingItems(), loadMustDoItems(), loadMemoryItems()]);
    await loadPackingProgress();
    if (typeof loadFunCategories === 'function') await loadFunCategories();
    if (typeof loadFunIdeas === 'function') await loadFunIdeas();
    if (activeShoppingItemId && typeof loadShoppingForItem === 'function') await loadShoppingForItem(activeShoppingItemId);
    render();
    if (activeShoppingItemId && els.shoppingListDialog?.open) renderShoppingListModal();
  } catch (error) {
    console.warn('Live refresh failed', error);
  }
}

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


async function loadPackingProgress() {
  packingProgressByUser = [];
  if (!activeTripId || !session?.user?.id) return;
  try {
    const { data, error } = await client.rpc('get_itinerary_packing_progress', { target_trip_id: activeTripId });
    if (error) throw error;
    packingProgressByUser = (data || []).map(row => ({
      user_id: row.user_id,
      display_name: row.display_name || memberLabel(row.user_id),
      avatar_url: row.avatar_url || '',
      packed_count: Number(row.packed_count || 0),
      total_count: Number(row.total_count || 0)
    }));
  } catch (error) {
    // Older schema fallback: show the current user's progress only until schema.sql is rerun.
    const mineTotal = packingItems.length;
    const mineDone = packingItems.filter(i => i.packed).length;
    packingProgressByUser = [{ user_id: session.user.id, display_name: currentUserFirstName(), avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '', packed_count: mineDone, total_count: mineTotal }];
    console.warn('Packing progress helper unavailable. Run schema.sql to share progress counts only.', error);
  }
}


function syncLocalPackingProgress() {
  if (!session?.user?.id) return;
  const mine = { user_id: session.user.id, display_name: currentUserFirstName(), avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '', packed_count: packingItems.filter(i => i.packed).length, total_count: packingItems.length };
  const idx = packingProgressByUser.findIndex(r => r.user_id === session.user.id);
  if (idx >= 0) packingProgressByUser[idx] = { ...packingProgressByUser[idx], ...mine };
  else packingProgressByUser.unshift(mine);
}

function renderPackingProgressSummary() {
  if (!els.packingProgressList) return;
  const rows = packingProgressByUser.length ? packingProgressByUser : [{ user_id: session?.user?.id, display_name: currentUserFirstName(), avatar_url: session?.user?.user_metadata?.avatar_url || '', packed_count: packingItems.filter(i => i.packed).length, total_count: packingItems.length }];
  els.packingProgressList.innerHTML = rows.map(row => {
    const total = Number(row.total_count || 0);
    const done = Number(row.packed_count || 0);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const name = escapeHtml((row.display_name || memberLabel(row.user_id)).split(/\s+/)[0] || 'Traveler');
    const avatar = row.avatar_url ? `<img src="${escapeHtml(row.avatar_url)}" alt="" />` : `<span>${escapeHtml(name.slice(0,1).toUpperCase())}</span>`;
    return `<div class="packing-progress-pill" title="${done}/${total} packed">
      <span class="progress-avatar">${avatar}</span>
      <span class="progress-name">${name}</span>
      <strong>${done}/${total}</strong>
    </div>`;
  }).join('');
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
async function deleteTrip() {
  if (!activeTripId || !canDeleteTrip()) return alert('Only the trip owner can delete the trip.');
  const trip = currentTrip();
  if (!confirm(`Delete "${trip?.title || 'this trip'}" and all of its itinerary data? This cannot be undone.`)) return;

  let error = null;
  try {
    const res = await client.rpc('delete_itinerary_trip_cascade', { target_trip_id: activeTripId });
    error = res.error;
  } catch (rpcError) {
    console.warn('delete_itinerary_trip_cascade unavailable, falling back to direct delete.', rpcError);
    error = rpcError;
  }

  // Backward-compatible fallback for users who have not rerun schema.sql yet.
  if (error) {
    const fallback = await client.from('itinerary_trips').delete().eq('id', activeTripId);
    error = fallback.error;
  }

  if (error) return showDbError(error);

  const deletedId = activeTripId;
  trips = trips.filter(t => t.id !== deletedId);
  if (localStorage.getItem('activeTripId') === deletedId) localStorage.removeItem('activeTripId');
  activeTripId = trips[0]?.id || null;

  if (!activeTripId) {
    items = []; members = []; packingItems = []; packingProgressByUser = []; mustDoItems = []; memoryItems = [];
    funIdeas = []; funPermissions = []; funCategories = []; shoppingListItems = []; shoppingListPermissions = [];
    setStatus('Trip deleted. Create a new trip when ready.');
    render();
    try { openTripDialog(); } catch {}
    return;
  }
  localStorage.setItem('activeTripId', activeTripId);
  await loadTripData();
}

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
async function updateItem(id, patch) { if (!canEdit()) return; const current = items.find(i => i.id === id); if (current && isLockedItem(current) && !('locked' in patch) && !('locked_at' in patch)) return alert('This card is locked. Unlock it first to make changes.'); const { data, error } = await client.from('itinerary_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single(); if (error) return showDbError(error); items = items.map(i => i.id === id ? data : i); broadcastTripChange('Itinerary updated'); render(); }
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
function renderTripSelect() { els.tripSelect.innerHTML = trips.length ? trips.map(t => `<option value="${t.id}">${escapeHtml(t.title || 'Untitled trip')}</option>`).join('') : '<option value="">No trips yet</option>'; els.tripSelect.value = activeTripId || ''; }
function renderTripEditor() {
  const t = currentTrip();
  if (!t) {
    ['tripTitle','startDate','endDate','destination','tripNotes'].forEach(k => { if (els[k]) els[k].value = ''; });
    [els.tripTitle, els.startDate, els.endDate, els.destination, els.tripNotes, els.gasMiles, els.gasMpg, els.gasPrice, els.addAnyItemBtn, els.deleteTripBtn].forEach(el => { if (el) el.disabled = true; });
    return;
  } els.tripTitle.value = t.title || ''; els.startDate.value = t.start_date || ''; els.endDate.value = t.end_date || ''; els.destination.value = t.destination || ''; els.tripNotes.value = t.notes || ''; if (els.gasMiles) els.gasMiles.value = Number(t.gas_miles || 0) || ''; if (els.gasMpg) els.gasMpg.value = Number(t.gas_mpg || 0) || ''; if (els.gasPrice) els.gasPrice.value = Number(t.gas_price || 0) || ''; renderMapLinks(els.destinationMapLinks, t.destination || ''); selectedDay ||= t.start_date;
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
  card.draggable = canEdit() && !locked && !isCoarsePointerDevice();
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
  meta.innerHTML = `<span class="type-pill">${escapeHtml(item.item_type || 'event')}</span>${String(item.item_type || '').toLowerCase() === 'shopping' ? `<button type="button" class="shopping-list-pill" title="Open shopping list">🧾 List</button>` : ''}${budget ? `<span class="cost-pill">${money(budget)}</span>` : ''}${item.rain_plan ? '<span class="rain-pill">☔ Rain ready</span>' : ''}${locked ? '<span class="locked-pill">🔒 Locked</span>' : ''}${assignee ? `<span class="assigned-pill">${assignee}</span>` : '<span class="assigned-pill everyone">👥 Everyone</span>'}<span class="created-pill">Added by ${escapeHtml(memberLabel(item.user_id))}</span>${mapQuery ? `<a class="location-link full-row" target="_blank" rel="noopener" title="${escapeHtml(mapQuery)}" href="${mapsUrl(mapQuery, 'google')}">📍 ${escapeHtml(displayLocation)}</a>` : ''}`;
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
  tpl.querySelector('.shopping-list-pill')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openShoppingListDialog(item.id); });
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
  broadcastTripChange(locked ? 'Card unlocked' : 'Card locked');
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
  if (e.pointerType === 'touch' || (isCoarsePointerDevice() && e.pointerType !== 'mouse')) return;
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
  syncLocalPackingProgress();
  const editable = canEdit();
  const total = packingItems.length;
  const done = packingItems.filter(i => i.packed).length;
  if (els.packingCount) els.packingCount.textContent = `${done}/${total}`;
  if (els.packingProgress) els.packingProgress.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
  if (els.packingInput) els.packingInput.disabled = !editable;
  if (els.addPackingBtn) els.addPackingBtn.disabled = !editable;
  if (els.resetPackingBtn) els.resetPackingBtn.disabled = !editable;
  renderPackingProgressSummary();
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
  packingItems.push(normalizePackingItem(data)); await loadPackingProgress(); renderPackingList();
}

async function updatePackingItem(id, patch) {
  if (!canEdit()) return;
  packingItems = packingItems.map(i => i.id === id ? { ...i, ...patch } : i);
  syncLocalPackingProgress();
  renderPackingList();
  if (packingIsLocalOnly(id)) { savePackingFallback(); return; }
  const { error } = await client.from('itinerary_packing_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', session.user.id);
  if (error) { console.warn('Packing update failed; keeping local UI value.', error); savePackingFallback(); return; }
  await loadPackingProgress();
  renderPackingProgressSummary();
}

async function deletePackingItem(id) {
  if (!canEdit()) return;
  packingItems = packingItems.filter(i => i.id !== id);
  syncLocalPackingProgress();
  renderPackingList();
  if (packingIsLocalOnly(id)) { savePackingFallback(); return; }
  const { error } = await client.from('itinerary_packing_items').delete().eq('id', id).eq('user_id', session.user.id);
  if (error) { console.warn('Packing delete failed.', error); return; }
  await loadPackingProgress();
  renderPackingProgressSummary();
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
  await loadPackingProgress();
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

const mobileQuickNav = document.querySelector('.mobile-quick-nav');
const mobileNavHome = document.getElementById('mobileNavHome');
const mobileNavPlan = document.getElementById('mobileNavPlan');
const mobileNavMustDo = document.getElementById('mobileNavMustDo');
const mobileNavMemory = document.getElementById('mobileNavMemory');
const mobileNavPacking = document.getElementById('mobileNavPacking');
let mobileQuickNavIdleTimer = null;
function mobileNavIsPhone() { return window.matchMedia?.('(max-width: 760px)').matches; }
function wakeMobileQuickNav() {
  if (!mobileQuickNav || !mobileNavIsPhone()) return;
  mobileQuickNav.classList.remove('is-idle');
  clearTimeout(mobileQuickNavIdleTimer);
  mobileQuickNavIdleTimer = setTimeout(() => {
    if (window.scrollY > 40 && mobileNavIsPhone()) mobileQuickNav.classList.add('is-idle');
  }, 10000);
}
function attachMobileQuickNavAutoHide() {
  if (!mobileQuickNav) return;
  ['scroll','touchstart','touchmove','wheel'].forEach(evt => window.addEventListener(evt, wakeMobileQuickNav, { passive: true }));
  window.addEventListener('resize', wakeMobileQuickNav, { passive: true });
  wakeMobileQuickNav();
}
mobileNavHome?.addEventListener('click', () => { wakeMobileQuickNav(); scrollToAppSection('homeDashboard'); });
mobileNavPlan?.addEventListener('click', () => { wakeMobileQuickNav(); scrollToAppSection('plannerTitle'); });
mobileNavMustDo?.addEventListener('click', () => { wakeMobileQuickNav(); scrollToAppSection('mustDoPanel'); });
mobileNavMemory?.addEventListener('click', () => { wakeMobileQuickNav(); startQuickMemoryCapture(); });
mobileNavPacking?.addEventListener('click', () => { wakeMobileQuickNav(); scrollToAppSection('packingPanel'); });
attachMobileQuickNavAutoHide();

init();

/* Fun Ideas + Photo Memories patch v36 */
function isTripOwner() { return currentMembership()?.role === 'owner'; }
function canAccessFunIdeasLocal() {
  if (!activeTripId || !session?.user?.id) return false;
  if (isTripOwner()) return true;
  return funPermissions.some(p => p.trip_id === activeTripId && p.user_id === session.user.id && p.can_access);
}
function canManageFunCategories() { return canEdit() && canAccessFunIdeasLocal(); }
async function loadFunPermissions() {
  funPermissions = [];
  if (!activeTripId || !session?.user?.id) return;
  const { data, error } = await client.from('trip_fun_permissions').select('*').eq('trip_id', activeTripId);
  if (error) { console.warn('Fun Ideas permissions unavailable. Run schema.sql.', error); return; }
  funPermissions = data || [];
}
async function loadFunIdeas() {
  funIdeas = [];
  if (!activeTripId || !session?.user?.id) return;
  await loadFunPermissions();
  if (!canAccessFunIdeasLocal()) return;
  await loadFunCategories();
  const { data, error } = await client.from('trip_fun_ideas').select('*').eq('trip_id', activeTripId).order('created_at', { ascending: false });
  if (error) { console.warn('Fun Ideas table unavailable. Run schema.sql.', error); return; }
  funIdeas = data || [];
}
async function openFunIdeasDialog() {
  if (!activeTripId || !session?.user?.id) return;
  await loadFunIdeas();
  if (!canAccessFunIdeasLocal()) return;
  renderFunIdeasModal();
  els.funIdeasDialog?.showModal();
}
function clearFunIdeaForm() {
  if (els.funIdeaId) els.funIdeaId.value = '';
  if (els.funIdeaTitle) els.funIdeaTitle.value = '';
  if (els.funIdeaDescription) els.funIdeaDescription.value = '';
  if (els.funIdeaPlayType) els.funIdeaPlayType.value = 'private';
  if (els.funIdeaVisibility) els.funIdeaVisibility.value = 'shared';
  populateFunAssigneeSelect('');
  populateFunCategorySelect('');
}


async function loadFunCategories() {
  funCategories = [];
  if (!activeTripId || !session?.user?.id) return;
  const { data, error } = await client.from('trip_fun_categories').select('*').eq('trip_id', activeTripId).order('created_at', { ascending: true });
  if (error) { console.warn('Fun Ideas categories unavailable. Run schema.sql.', error); return; }
  funCategories = data || [];
  if (!funCategories.length && canManageFunCategories()) await ensureDefaultFunCategories();
}
async function ensureDefaultFunCategories() {
  const defaults = [
    { emoji: '💕', name: 'Romantic' },
    { emoji: '🔥', name: 'Adventurous' },
    { emoji: '🛁', name: 'Relaxing' },
    { emoji: '🎭', name: 'Roleplay' },
    { emoji: '⭐', name: 'Favorites' }
  ];
  const { data, error } = await client.from('trip_fun_categories').insert(defaults.map(c => ({ ...c, trip_id: activeTripId, created_by: session.user.id }))).select('*');
  if (!error) funCategories = data || [];
}
function funCategoryName(id) {
  if (!id) return '';
  const c = funCategories.find(x => x.id === id);
  return c ? `${c.emoji || '✨'} ${c.name || 'Category'}` : '';
}
function populateFunCategorySelect(selected = '') {
  if (!els.funIdeaCategory) return;
  els.funIdeaCategory.innerHTML = '<option value="">No category</option>' + funCategories.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml((c.emoji || '✨') + ' ' + (c.name || 'Category'))}</option>`).join('');
  els.funIdeaCategory.value = selected || '';
}
function renderFunCategoryFilter() {
  if (!els.funCategoryFilter) return;
  const chips = [`<button type="button" class="fun-category-chip ${funCategoryFilterValue === 'all' ? 'active' : ''}" data-filter="all">All</button>`]
    .concat(funCategories.map(c => `<button type="button" class="fun-category-chip ${funCategoryFilterValue === c.id ? 'active' : ''}" data-filter="${escapeHtml(c.id)}">${escapeHtml(c.emoji || '✨')} ${escapeHtml(c.name || 'Category')}</button>`));
  els.funCategoryFilter.innerHTML = chips.join('');
}
function renderFunCategoryManager() {
  if (!els.funCategoryList) return;
  els.funCategoryList.innerHTML = funCategories.length ? funCategories.map(c => `<div class="fun-category-row" data-id="${escapeHtml(c.id)}"><span>${escapeHtml(c.emoji || '✨')} <strong>${escapeHtml(c.name || 'Category')}</strong></span><span><button type="button" class="fun-category-edit ghost-btn">Edit</button><button type="button" class="fun-category-delete danger ghost-btn">Delete</button></span></div>`).join('') : '<p class="helper-text">No categories yet.</p>';
}
async function addFunCategory() {
  if (!canManageFunCategories()) return;
  const name = (els.funCategoryName?.value || '').trim();
  if (!name) return els.funCategoryName?.focus();
  const emoji = (els.funCategoryEmoji?.value || '✨').trim().slice(0, 4) || '✨';
  const { error } = await client.from('trip_fun_categories').insert({ trip_id: activeTripId, created_by: session.user.id, name, emoji });
  if (error) { showDbError(error); return; }
  if (els.funCategoryName) els.funCategoryName.value = '';
  if (els.funCategoryEmoji) els.funCategoryEmoji.value = '✨';
  await loadFunCategories(); renderFunIdeasModal(); broadcastTripChange('Fun Ideas categories updated');
}
async function editFunCategory(id) {
  if (!canManageFunCategories()) return;
  const c = funCategories.find(x => x.id === id); if (!c) return;
  const name = prompt('Category name', c.name || ''); if (name === null) return;
  const emoji = prompt('Emoji', c.emoji || '✨'); if (emoji === null) return;
  const { error } = await client.from('trip_fun_categories').update({ name: name.trim() || c.name, emoji: (emoji.trim() || c.emoji || '✨').slice(0, 4), updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { showDbError(error); return; }
  await loadFunCategories(); renderFunIdeasModal(); broadcastTripChange('Fun Ideas categories updated');
}
async function deleteFunCategory(id) {
  if (!canManageFunCategories()) return;
  if (!confirm('Delete this category? Ideas will stay, but lose this category.')) return;
  await client.from('trip_fun_ideas').update({ category_id: null, updated_at: new Date().toISOString() }).eq('category_id', id);
  const { error } = await client.from('trip_fun_categories').delete().eq('id', id);
  if (error) { showDbError(error); return; }
  if (funCategoryFilterValue === id) funCategoryFilterValue = 'all';
  await loadFunCategories(); await loadFunIdeas(); renderFunIdeasModal(); broadcastTripChange('Fun Ideas categories updated');
}
function showFunEditor(show = true) {
  document.querySelector('.fun-editor')?.classList.toggle('hidden', !show);
  if (show) setTimeout(() => els.funIdeaTitle?.focus(), 50);
}

function funIdeaForChipHtml(assignedTo) {
  if (!assignedTo) return '<span class="fun-chip assignee for-us"><span class="fun-everyone-avatar">👥</span><span>For Us</span></span>';
  const isMe = assignedTo === session?.user?.id;
  const label = isMe ? 'Me' : memberLabel(assignedTo);
  const rawName = isMe ? currentUserFirstName() : memberLabel(assignedTo);
  const m = memberRecord(assignedTo);
  const pic = isMe ? session?.user?.user_metadata?.avatar_url : (m?.avatar_url || '');
  const initial = String(rawName || label || 'U').trim().slice(0, 1).toUpperCase() || 'U';
  const avatar = pic
    ? `<span class="fun-person-avatar"><img src="${escapeHtml(pic)}" alt=""></span>`
    : `<span class="fun-person-avatar initial">${escapeHtml(initial)}</span>`;
  return `<span class="fun-chip assignee">${avatar}<span>For ${escapeHtml(label)}</span></span>`;
}

function renderFunIdeasModal() {
  populateFunAssigneeSelect(els.funIdeaAssignedTo?.value || '');
  populateFunCategorySelect(els.funIdeaCategory?.value || '');
  renderFunCategoryFilter();
  renderFunCategoryManager();
  const editable = canEdit() && canAccessFunIdeasLocal();
  if (els.funAccessPanel) els.funAccessPanel.classList.toggle('hidden', !isTripOwner());
  if (els.funPermissionList) {
    els.funPermissionList.innerHTML = members.map(m => {
      const isOwnerMember = m.role === 'owner';
      const allowed = isOwnerMember || funPermissions.some(p => p.user_id === m.user_id && p.can_access);
      const label = memberLabel(m.user_id);
      const pic = m.user_id === session?.user?.id ? session.user.user_metadata?.avatar_url : (m.avatar_url || '');
      const initial = String(label || 'U').trim().slice(0, 1).toUpperCase() || 'U';
      const avatar = pic
        ? `<img class="permission-avatar" src="${escapeHtml(pic)}" alt="">`
        : `<em class="permission-avatar fallback">${escapeHtml(initial)}</em>`;
      return `<label class="fun-permission-row"><span class="permission-person">${avatar}<span class="permission-copy"><strong>${escapeHtml(label)}</strong><em>${escapeHtml(m.role || 'editor')}</em></span></span><input type="checkbox" data-user-id="${escapeHtml(m.user_id)}" ${allowed ? 'checked' : ''} ${isOwnerMember ? 'disabled' : ''}></label>`;
    }).join('') || '<p class="helper-text">Invite a traveler to share access.</p>';
  }
  if (els.funIdeasList) {
    const visible = funIdeas.filter(i => (i.visibility !== 'private' || i.created_by === session.user.id || isTripOwner()) && (funCategoryFilterValue === 'all' || i.category_id === funCategoryFilterValue));
    els.funIdeasList.innerHTML = visible.length ? visible.map(i => {
      const visibilityChip = i.visibility === 'private' ? '🔒 Private' : '🌐 Shared';
      const playChip = i.play_type === 'public' ? '✨ Public Play' : '💕 Private Play';
      const assigneeChip = funIdeaForChipHtml(i.assigned_to || '');
      const categoryChip = i.category_id ? `<span class="fun-chip category">${escapeHtml(funCategoryName(i.category_id))}</span>` : '';
      const hasDescription = !!String(i.description || '').trim();
      return `<article class="fun-idea-card" data-id="${escapeHtml(i.id)}">
        <button type="button" class="fun-card-main" aria-expanded="false">
          <span class="fun-title-row"><strong>${escapeHtml(i.title || 'Untitled idea')}</strong><span class="fun-expand-icon">⌄</span></span>
          <span class="fun-badges">${assigneeChip}${categoryChip}<span class="fun-chip">${escapeHtml(visibilityChip)}</span><span class="fun-chip">${escapeHtml(playChip)}</span></span>
        </button>
        <div class="fun-card-details">
          ${hasDescription ? `<p>${escapeHtml(i.description || '')}</p>` : '<p class="muted">No extra notes added.</p>'}
          <div class="fun-card-actions"><button type="button" class="fun-edit ghost-btn" ${editable ? '' : 'disabled'}>Edit</button><button type="button" class="fun-delete danger ghost-btn" ${editable ? '' : 'disabled'}>Delete</button></div>
        </div>
      </article>`;
    }).join('') : '<div class="packing-empty">No Fun Ideas yet. Add one when you are ready.</div>';
  }
}
async function saveFunIdea() {
  if (!activeTripId || !session?.user?.id || !canEdit() || !canAccessFunIdeasLocal()) return;
  const title = (els.funIdeaTitle?.value || '').trim();
  if (!title) { els.funIdeaTitle?.focus(); return; }
  const payload = {
    trip_id: activeTripId,
    created_by: session.user.id,
    title,
    description: (els.funIdeaDescription?.value || '').trim(),
    play_type: els.funIdeaPlayType?.value || 'private',
    visibility: els.funIdeaVisibility?.value || 'shared',
    assigned_to: els.funIdeaAssignedTo?.value || null,
    category_id: els.funIdeaCategory?.value || null,
    updated_at: new Date().toISOString()
  };
  const id = els.funIdeaId?.value;
  let result;
  if (id) result = await client.from('trip_fun_ideas').update(payload).eq('id', id).select('*').single();
  else result = await client.from('trip_fun_ideas').insert(payload).select('*').single();
  if (result.error) { showDbError(result.error); return; }
  await loadFunIdeas(); clearFunIdeaForm(); showFunEditor(false); renderFunIdeasModal(); broadcastTripChange('Private list updated');
}
function editFunIdea(id) {
  const i = funIdeas.find(x => x.id === id); if (!i) return;
  if (els.funIdeaId) els.funIdeaId.value = i.id;
  if (els.funIdeaTitle) els.funIdeaTitle.value = i.title || '';
  if (els.funIdeaDescription) els.funIdeaDescription.value = i.description || '';
  if (els.funIdeaPlayType) els.funIdeaPlayType.value = i.play_type || 'private';
  if (els.funIdeaVisibility) els.funIdeaVisibility.value = i.visibility || 'shared';
  populateFunAssigneeSelect(i.assigned_to || '');
  populateFunCategorySelect(i.category_id || '');
  showFunEditor(true);
  els.funIdeaTitle?.focus();
}
async function deleteFunIdea(id) {
  if (!canEdit() || !canAccessFunIdeasLocal()) return;
  if (!confirm('Remove this Fun Idea?')) return;
  const { error } = await client.from('trip_fun_ideas').delete().eq('id', id);
  if (error) { showDbError(error); return; }
  await loadFunIdeas(); renderFunIdeasModal(); broadcastTripChange('Private list updated');
}
async function toggleFunPermission(userId, canAccess) {
  if (!isTripOwner() || !activeTripId || !userId) return;
  const payload = { trip_id: activeTripId, user_id: userId, can_access: !!canAccess, updated_at: new Date().toISOString() };
  const { error } = await client.from('trip_fun_permissions').upsert(payload, { onConflict: 'trip_id,user_id' });
  if (error) { showDbError(error); return; }
  await loadFunPermissions(); renderFunIdeasModal(); broadcastTripChange('Private list access updated');
}

function normalizeMemory(row) {
  return { id: row.id, trip_id: row.trip_id || activeTripId, user_id: row.user_id || row.created_by, note: row.note || row.title || '', location: row.location || '', photo_url: row.photo_url || '', photo_path: row.photo_path || '', memory_date: row.memory_date || todayISO(), created_at: row.created_at || null };
}
async function loadMemoryItems() {
  if (!activeTripId) { memoryItems = []; return; }
  const { data, error } = await client.from('itinerary_memories').select('*').eq('trip_id', activeTripId).order('created_at', { ascending: false }).limit(60);
  if (error) { console.warn('Memories table unavailable. Run schema.sql to enable shared Memories.', error); memoryItems = []; return; }
  memoryItems = (data || []).map(normalizeMemory);
}
function renderMemoryList() {
  if (!els.memoryList) return;
  const editable = canEdit();
  const photoCount = memoryItems.filter(m => m.photo_url).length;
  if (els.memoryCount) els.memoryCount.textContent = String(memoryItems.length);
  if (els.memoryInput) els.memoryInput.disabled = !editable;
  if (els.addMemoryBtn) els.addMemoryBtn.disabled = !editable;
  if (els.memoryPhotoBtn) els.memoryPhotoBtn.disabled = !editable;
  if (els.memorySlideshowBtn) { els.memorySlideshowBtn.disabled = !photoCount; els.memorySlideshowBtn.classList.toggle('hidden', !photoCount); }
  if (!memoryItems.length) { els.memoryList.innerHTML = `<div class="packing-empty">No memories yet.${editable ? ' Add a note or photo during the trip.' : ''}</div>`; renderTripProgress(); return; }
  els.memoryList.innerHTML = memoryItems.slice(0,12).map(mem => `
    <div class="memory-row ${mem.photo_url ? 'photo-memory' : ''}" data-id="${escapeHtml(mem.id)}">
      ${mem.photo_url ? `<button type="button" class="memory-photo-btn" data-id="${escapeHtml(mem.id)}"><img src="${escapeHtml(mem.photo_url)}" alt="Trip memory" loading="lazy" /></button>` : '<span class="shared-icon">💜</span>'}
      <div><strong>${escapeHtml(mem.note || (mem.photo_url ? 'Photo memory' : 'Memory'))}</strong><em>${escapeHtml(fmtShortDate(mem.memory_date))}${mem.location ? ` • ${escapeHtml(shortLocationLabel(mem.location))}` : ''}</em></div>
      <button type="button" class="memory-delete ghost-btn" ${editable ? '' : 'disabled'} title="Remove memory">×</button>
    </div>`).join('');
  renderTripProgress();
}
async function uploadMemoryPhoto(file) {
  if (!file) return { photo_url: '', photo_path: '' };
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${activeTripId}/${session.user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const { error } = await client.storage.from('trip-memories').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg' });
  if (error) throw error;
  const { data } = client.storage.from('trip-memories').getPublicUrl(path);
  return { photo_url: data?.publicUrl || '', photo_path: path };
}
async function addMemoryItem(note) {
  const clean = (note || '').trim();
  const file = els.memoryPhotoInput?.files?.[0] || null;
  if ((!clean && !file) || !activeTripId || !session?.user?.id || !canEdit()) return;
  try {
    const photo = await uploadMemoryPhoto(file);
    const payload = { trip_id: activeTripId, user_id: session.user.id, note: clean || (file ? 'Photo memory' : ''), memory_date: selectedDay || todayISO(), ...photo };
    const { data, error } = await client.from('itinerary_memories').insert(payload).select('*').single();
    if (error) { showDbError(error); return; }
    memoryItems.unshift(normalizeMemory(data));
    if (els.memoryPhotoInput) els.memoryPhotoInput.value = '';
    renderMemoryList();
  } catch (err) {
    console.error(err);
    alert(`${err.message || 'Photo upload failed'}\n\nRun schema.sql once and make sure the trip-memories storage bucket exists.`);
  }
}
function openMemorySlideshow(startId = null) {
  const photos = memoryItems.filter(m => m.photo_url);
  if (!photos.length) return;
  activeMemorySlide = Math.max(0, startId ? photos.findIndex(m => m.id === startId) : 0);
  if (activeMemorySlide < 0) activeMemorySlide = 0;
  renderMemorySlideshow();
  els.memorySlideshowDialog?.showModal();
}
function renderMemorySlideshow() {
  const photos = memoryItems.filter(m => m.photo_url);
  const mem = photos[activeMemorySlide];
  if (!els.memorySlideshowStage || !mem) return;
  els.memorySlideshowStage.innerHTML = `<figure class="memory-slide"><img src="${escapeHtml(mem.photo_url)}" alt="Trip memory"><figcaption><strong>${escapeHtml(mem.note || 'Photo memory')}</strong><span>${escapeHtml(fmtShortDate(mem.memory_date))} • ${activeMemorySlide + 1}/${photos.length}</span></figcaption></figure>`;
}
function stepMemorySlide(dir) {
  const photos = memoryItems.filter(m => m.photo_url);
  if (!photos.length) return;
  activeMemorySlide = (activeMemorySlide + dir + photos.length) % photos.length;
  renderMemorySlideshow();
}


function shoppingEventById(id) { return items.find(i => i.id === id); }
function canManageShoppingAccess(item) {
  return false;
}
function canAccessShoppingListLocal(item) {
  // Shopping lists are public to trip members/collaborators.
  return !!item && !!session?.user?.id && !!currentMembership();
}
async function loadShoppingForItem(itemId) {
  shoppingListItems = [];
  shoppingListPermissions = [];
  if (!activeTripId || !itemId || !session?.user?.id) return;
  const { data, error } = await client
    .from('itinerary_shopping_items')
    .select('*')
    .eq('trip_id', activeTripId)
    .eq('itinerary_item_id', itemId)
    .order('created_at', { ascending: true });
  if (error) { console.warn('Shopping list unavailable. Run schema.sql.', error); shoppingListItems = []; }
  else shoppingListItems = data || [];
}
async function openShoppingListDialog(itemId) {
  const item = shoppingEventById(itemId);
  if (!item) return;
  activeShoppingItemId = itemId;
  await loadShoppingForItem(itemId);
  if (!canAccessShoppingListLocal(item)) {
    activeShoppingItemId = null;
    return alert('You need to be part of this trip to open the shopping list.');
  }
  clearShoppingForm();
  renderShoppingListModal();
  els.shoppingListDialog?.showModal();
}
function clearShoppingForm() {
  if (els.shoppingItemId) els.shoppingItemId.value = '';
  if (els.shoppingItemName) els.shoppingItemName.value = '';
  if (els.shoppingItemQty) els.shoppingItemQty.value = '1';
  if (els.shoppingItemNotes) els.shoppingItemNotes.value = '';
}
function showShoppingEditor(show=true) {
  els.shoppingEditor?.classList.toggle('hidden', !show);
  if (show) setTimeout(() => els.shoppingItemName?.focus(), 40);
}
function renderShoppingListModal() {
  const item = shoppingEventById(activeShoppingItemId);
  if (!item) return;
  const access = canAccessShoppingListLocal(item);
  const editable = canEdit() && access;
  const canPerm = false;
  if (els.shoppingListTitle) els.shoppingListTitle.textContent = `Shopping List · ${item.title || 'Shopping'}`;
  if (els.shoppingPermissionPanel) els.shoppingPermissionPanel.classList.add('hidden');
  if (els.shoppingPermissionList) els.shoppingPermissionList.innerHTML = '';
  const done = shoppingListItems.filter(x => x.completed).length;
  if (els.shoppingListBody) {
    els.shoppingListBody.innerHTML = shoppingListItems.length ? shoppingListItems.map(x => `
      <article class="shopping-list-row ${x.completed ? 'is-complete' : ''}" data-id="${escapeHtml(x.id)}">
        <label class="shopping-check"><input type="checkbox" class="shopping-complete" ${x.completed ? 'checked' : ''} ${editable ? '' : 'disabled'}><span></span></label>
        <div class="shopping-row-main"><strong>${escapeHtml(x.label || 'Shopping item')}</strong><em>${Number(x.quantity || 1)} needed${x.notes ? ` · ${escapeHtml(x.notes)}` : ''}</em></div>
        <button type="button" class="shopping-edit ghost-btn" ${editable ? '' : 'disabled'}>Edit</button>
        <button type="button" class="shopping-delete danger ghost-btn" ${editable ? '' : 'disabled'}>×</button>
      </article>`).join('') : '<div class="packing-empty">No shopping items yet. Add what everyone should grab.</div>';
  }
  const count = els.shoppingListDialog?.querySelector('.shopping-count');
  if (count) count.textContent = `${done}/${shoppingListItems.length} complete`;
  if (els.shoppingNewBtn) els.shoppingNewBtn.disabled = !editable;
  if (els.shoppingSaveBtn) els.shoppingSaveBtn.disabled = !editable;
}
async function saveShoppingItem() {
  const eventItem = shoppingEventById(activeShoppingItemId);
  if (!eventItem || !canEdit() || !canAccessShoppingListLocal(eventItem)) return;
  const label = (els.shoppingItemName?.value || '').trim();
  if (!label) return els.shoppingItemName?.focus();
  const payload = {
    trip_id: activeTripId,
    itinerary_item_id: activeShoppingItemId,
    user_id: session.user.id,
    label,
    quantity: Math.max(1, Number(els.shoppingItemQty?.value || 1)),
    notes: (els.shoppingItemNotes?.value || '').trim(),
    updated_at: new Date().toISOString()
  };
  const id = els.shoppingItemId?.value;
  const result = id
    ? await client.from('itinerary_shopping_items').update(payload).eq('id', id).select('*').single()
    : await client.from('itinerary_shopping_items').insert(payload).select('*').single();
  if (result.error) return showDbError(result.error);
  await loadShoppingForItem(activeShoppingItemId); clearShoppingForm(); showShoppingEditor(false); renderShoppingListModal(); broadcastTripChange('Shopping list updated');
}
function editShoppingItem(id) {
  const row = shoppingListItems.find(x => x.id === id); if (!row) return;
  if (els.shoppingItemId) els.shoppingItemId.value = row.id;
  if (els.shoppingItemName) els.shoppingItemName.value = row.label || '';
  if (els.shoppingItemQty) els.shoppingItemQty.value = String(row.quantity || 1);
  if (els.shoppingItemNotes) els.shoppingItemNotes.value = row.notes || '';
  showShoppingEditor(true);
}
async function updateShoppingItem(id, patch) {
  const eventItem = shoppingEventById(activeShoppingItemId);
  if (!eventItem || !canEdit() || !canAccessShoppingListLocal(eventItem)) return;
  const { error } = await client.from('itinerary_shopping_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return showDbError(error);
  await loadShoppingForItem(activeShoppingItemId); renderShoppingListModal(); broadcastTripChange('Shopping list updated');
}
async function deleteShoppingItem(id) {
  const eventItem = shoppingEventById(activeShoppingItemId);
  if (!eventItem || !canEdit() || !canAccessShoppingListLocal(eventItem)) return;
  if (!confirm('Remove this shopping item?')) return;
  const { error } = await client.from('itinerary_shopping_items').delete().eq('id', id);
  if (error) return showDbError(error);
  await loadShoppingForItem(activeShoppingItemId); renderShoppingListModal(); broadcastTripChange('Shopping list updated');
}
async function toggleShoppingPermission(userId, canAccess) { return; }

function defaultMemoryTitle() {
  const d = new Date();
  const stamp = d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return `Memory ${stamp}`;
}
function scrollToAppSection(id) {
  const el = document.getElementById(id) || document.querySelector(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function startQuickMemoryCapture() {
  if (!activeTripId) return alert('Create or select a trip first.');
  if (!canEdit()) return alert('You need edit access to add memories.');
  quickMemoryCaptureMode = true;
  els.memoryPhotoInput?.click();
}


if (els.funNewIdeaBtn) els.funNewIdeaBtn.addEventListener('click', () => { clearFunIdeaForm(); showFunEditor(true); });
if (els.funCancelEditorBtn) els.funCancelEditorBtn.addEventListener('click', () => { clearFunIdeaForm(); showFunEditor(false); });
if (els.funCategoryManageBtn) els.funCategoryManageBtn.addEventListener('click', () => els.funCategoryEditor?.classList.toggle('hidden'));
if (els.funAddCategoryBtn) els.funAddCategoryBtn.addEventListener('click', addFunCategory);
if (els.funCategoryFilter) els.funCategoryFilter.addEventListener('click', e => {
  const btn = e.target.closest('.fun-category-chip'); if (!btn) return;
  funCategoryFilterValue = btn.dataset.filter || 'all'; renderFunIdeasModal();
});
if (els.funCategoryList) els.funCategoryList.addEventListener('click', e => {
  const row = e.target.closest('.fun-category-row'); if (!row) return;
  if (e.target.closest('.fun-category-edit')) editFunCategory(row.dataset.id);
  if (e.target.closest('.fun-category-delete')) deleteFunCategory(row.dataset.id);
});

if (els.avatarFunBtn) els.avatarFunBtn.addEventListener('click', openFunIdeasDialog);
if (els.funSaveBtn) els.funSaveBtn.addEventListener('click', saveFunIdea);
if (els.funClearBtn) els.funClearBtn.addEventListener('click', clearFunIdeaForm);
if (els.funPermissionList) els.funPermissionList.addEventListener('change', e => {
  const cb = e.target.closest('input[type="checkbox"][data-user-id]');
  if (cb) toggleFunPermission(cb.dataset.userId, cb.checked);
});
if (els.funIdeasList) els.funIdeasList.addEventListener('click', e => {
  const card = e.target.closest('.fun-idea-card');
  if (!card) return;
  if (e.target.closest('.fun-edit')) { editFunIdea(card.dataset.id); return; }
  if (e.target.closest('.fun-delete')) { deleteFunIdea(card.dataset.id); return; }
  if (e.target.closest('.fun-card-main')) {
    const open = card.classList.toggle('is-open');
    e.target.closest('.fun-card-main')?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
});
if (els.memoryPhotoBtn) els.memoryPhotoBtn.addEventListener('click', () => els.memoryPhotoInput?.click());
if (els.memoryPhotoInput) els.memoryPhotoInput.addEventListener('change', async () => {
  const file = els.memoryPhotoInput.files?.[0];
  if (!file) { quickMemoryCaptureMode = false, starterCleanupChecked = false; return; }
  // Mobile-first memory flow: no popup. A photo automatically saves as a dated memory.
  quickMemoryCaptureMode = false;
  starterCleanupChecked = false;
  const title = defaultMemoryTitle();
  if (els.memoryInput) els.memoryInput.value = title;
  await addMemoryItem(title);
  if (els.memoryInput) els.memoryInput.value = '';
});
if (els.memorySlideshowBtn) els.memorySlideshowBtn.addEventListener('click', () => openMemorySlideshow());
if (els.memoryList) els.memoryList.addEventListener('click', e => {
  const photoBtn = e.target.closest('.memory-photo-btn');
  if (photoBtn) openMemorySlideshow(photoBtn.dataset.id);
});
if (els.memoryPrevBtn) els.memoryPrevBtn.addEventListener('click', () => stepMemorySlide(-1));
if (els.memoryNextBtn) els.memoryNextBtn.addEventListener('click', () => stepMemorySlide(1));


if (els.shoppingListDialog) els.shoppingListDialog.addEventListener('close', () => { activeShoppingItemId = null; shoppingListItems = []; shoppingListPermissions = []; });
if (els.shoppingNewBtn) els.shoppingNewBtn.addEventListener('click', () => { clearShoppingForm(); showShoppingEditor(true); });
if (els.shoppingCancelEditorBtn) els.shoppingCancelEditorBtn.addEventListener('click', () => { clearShoppingForm(); showShoppingEditor(false); });
if (els.shoppingSaveBtn) els.shoppingSaveBtn.addEventListener('click', saveShoppingItem);
if (els.shoppingPermissionList) els.shoppingPermissionList.addEventListener('change', e => {
  const cb = e.target.closest('input[type="checkbox"][data-user-id]');
  if (cb) toggleShoppingPermission(cb.dataset.userId, cb.checked);
});
if (els.shoppingListBody) els.shoppingListBody.addEventListener('click', e => {
  const row = e.target.closest('.shopping-list-row'); if (!row) return;
  if (e.target.closest('.shopping-edit')) return editShoppingItem(row.dataset.id);
  if (e.target.closest('.shopping-delete')) return deleteShoppingItem(row.dataset.id);
});
if (els.shoppingListBody) els.shoppingListBody.addEventListener('change', e => {
  const cb = e.target.closest('.shopping-complete');
  const row = e.target.closest('.shopping-list-row');
  if (cb && row) updateShoppingItem(row.dataset.id, { completed: cb.checked });
});


/* v51 Production UI Revamp theme boot */
(function productionUIRevampThemeBoot(){
  const PREF_KEY = 'itineraryTrackerV2.settings';
  const THEMES = ['light', 'dark', 'purple'];
  function readTheme(){
    try {
      const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      return THEMES.includes(prefs.appTheme) ? prefs.appTheme : (THEMES.includes(localStorage.getItem('itineraryTrackerV2.theme')) ? localStorage.getItem('itineraryTrackerV2.theme') : 'purple');
    } catch { return 'purple'; }
  }
  function writeTheme(theme){
    const value = THEMES.includes(theme) ? theme : 'purple';
    try {
      const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      prefs.appTheme = value;
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
      localStorage.setItem('itineraryTrackerV2.theme', value);
    } catch {}
    applyTheme(value);
  }
  function applyTheme(theme){
    const value = THEMES.includes(theme) ? theme : 'purple';
    document.documentElement.dataset.theme = value;
    document.body.classList.remove('theme-light','theme-dark','theme-purple');
    document.body.classList.add('theme-' + value);
    document.querySelectorAll('[data-theme-pick]').forEach(btn => btn.classList.toggle('active', btn.dataset.themePick === value));
  }
  function injectSwitcher(){
    const topActions = document.querySelector('.top-actions');
    if (!topActions || document.getElementById('themeSwitcher')) return;
    const box = document.createElement('div');
    box.id = 'themeSwitcher';
    box.className = 'theme-switcher';
    box.setAttribute('aria-label','Theme picker');
    box.innerHTML = '<button type="button" data-theme-pick="light" title="Clean Light"><span></span></button><button type="button" data-theme-pick="purple" title="Purple Glow"><span></span></button><button type="button" data-theme-pick="dark" title="Night Mode"><span></span></button>';
    topActions.prepend(box);
    box.addEventListener('click', e => { const btn = e.target.closest('[data-theme-pick]'); if (btn) writeTheme(btn.dataset.themePick); });
    applyTheme(readTheme());
  }
  applyTheme(readTheme());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectSwitcher); else injectSwitcher();
  window.addEventListener('storage', e => { if (e.key === PREF_KEY || e.key === 'itineraryTrackerV2.theme') applyTheme(readTheme()); });
})();

/* v2.1.8 memory upload hardening
   Fixes: file input re-select glitches, title prompt not appearing after first upload,
   optimistic memory list not refreshing, and safe fallback if the photo columns were not
   added yet. */
function resetMemoryPhotoPicker() {
  if (els.memoryPhotoInput) els.memoryPhotoInput.value = '';
}
function startQuickMemoryCapture() {
  if (!activeTripId) return alert('Create or select a trip first.');
  if (!canEdit()) return alert('You need edit access to add memories.');
  quickMemoryCaptureMode = true;
  resetMemoryPhotoPicker();
  // Keep the camera/file picker inside the user gesture; iOS can block delayed clicks.
  els.memoryPhotoInput?.click();
}
async function insertMemoryRecordFixed(note, photo) {
  const base = {
    trip_id: activeTripId,
    user_id: session.user.id,
    note: (note || '').trim() || defaultMemoryTitle(),
    memory_date: selectedDay || todayISO()
  };
  const withPhoto = { ...base, ...(photo || {}) };
  let result = await client.from('itinerary_memories').insert(withPhoto).select('*').single();
  if (result.error && /photo_url|photo_path|column/i.test(String(result.error.message || '')) && (photo?.photo_url || photo?.photo_path)) {
    result = await client.from('itinerary_memories').insert(base).select('*').single();
  }
  return result;
}
async function addMemoryItem(note) {
  const clean = (note || '').trim();
  const file = els.memoryPhotoInput?.files?.[0] || null;
  if ((!clean && !file) || !activeTripId || !session?.user?.id || !canEdit()) return;
  try {
    const photo = file ? await uploadMemoryPhoto(file) : { photo_url: '', photo_path: '' };
    const { error } = await insertMemoryRecordFixed(clean || (file ? defaultMemoryTitle() : ''), photo);
    if (error) { showDbError(error); return; }
    resetMemoryPhotoPicker();
    if (els.memoryInput) els.memoryInput.value = '';
    await loadMemoryItems();
    renderMemoryList();
    renderHomeDashboard?.();
    renderTripProgress?.();
    broadcastTripChange?.('Memory added');
  } catch (err) {
    console.error(err);
    alert(`${err.message || 'Photo upload failed'}\n\nRun schema.sql once and make sure the trip-memories storage bucket exists.`);
  } finally {
    quickMemoryCaptureMode = false, starterCleanupChecked = false;
    resetMemoryPhotoPicker();
  }
}
async function handleMemoryPhotoInputChangeFixed(event) {
  event?.stopImmediatePropagation?.();
  const file = els.memoryPhotoInput?.files?.[0] || null;
  if (!file) { quickMemoryCaptureMode = false, starterCleanupChecked = false; return; }
  // No title popup. Every camera/photo memory auto-saves with the local date and time.
  const title = defaultMemoryTitle();
  if (els.memoryInput) els.memoryInput.value = title;
  await addMemoryItem(title);
  if (els.memoryInput) els.memoryInput.value = '';
}
// Clear the file input before every picker open so selecting the same photo/camera result still fires change.
els.memoryPhotoBtn?.addEventListener('click', (event) => {
  // Capture-phase guard: prevents the older bubble-phase listener from also firing,
  // which caused the desktop file picker to open twice.
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
  resetMemoryPhotoPicker();
  quickMemoryCaptureMode = false;
  starterCleanupChecked = false;
  els.memoryPhotoInput?.click();
}, true);
els.memoryPhotoInput?.addEventListener('click', () => { /* intentionally no-op; value is reset before programmatic click */ }, true);
els.memoryPhotoInput?.addEventListener('change', handleMemoryPhotoInputChangeFixed, true);


/* v2.1.10 delete confirmations + memory picker single-open guard */
async function deleteMemoryItem(id) {
  if (!canEdit()) return;
  const mem = memoryItems.find(i => i.id === id);
  const label = mem?.note || (mem?.photo_url ? 'this photo memory' : 'this memory');
  if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
  const prev = memoryItems.slice();
  memoryItems = memoryItems.filter(i => i.id !== id);
  renderMemoryList();
  const { error } = await client.from('itinerary_memories').delete().eq('id', id);
  if (error) { memoryItems = prev; renderMemoryList(); showDbError(error); return; }
  await loadMemoryItems();
  renderMemoryList();
  renderHomeDashboard?.();
  renderTripProgress?.();
  broadcastTripChange?.('Memory deleted');
}
async function deletePackingItem(id) {
  if (!canEdit()) return;
  const item = packingItems.find(i => i.id === id);
  const label = item?.title || item?.name || 'this packing item';
  if (!confirm(`Remove "${label}" from your packing list?`)) return;
  const prev = packingItems.slice();
  packingItems = packingItems.filter(i => i.id !== id);
  syncLocalPackingProgress();
  renderPackingList();
  if (packingIsLocalOnly(id)) { savePackingFallback(); return; }
  const { error } = await client.from('itinerary_packing_items').delete().eq('id', id).eq('user_id', session.user.id);
  if (error) { packingItems = prev; syncLocalPackingProgress(); renderPackingList(); console.warn('Packing delete failed.', error); showDbError?.(error); return; }
  await loadPackingProgress();
  renderPackingProgressSummary();
  broadcastTripChange?.('Packing updated');
}


/* v2.1.12 final polish: storage-safe memories, completed-trip story mode, and cleanup hardening */
(function finalPolishStorageAndCompletedMode(){
  let originalRender = typeof render === 'function' ? render : null;
  let storyTimer = null;
  let storyIndex = 0;
  let ambientCtx = null;
  let ambientNodes = [];
  let plannerOverride = false;

  function localDateTimeTitle(){
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    } catch { return new Date().toLocaleString(); }
  }
  function tripEnded(trip){
    if (!trip?.end_date) return false;
    const end = new Date(`${trip.end_date}T23:59:59`);
    return Number.isFinite(end.getTime()) && Date.now() > end.getTime();
  }
  function tripStarted(trip){
    if (!trip?.start_date) return false;
    const start = new Date(`${trip.start_date}T00:00:00`);
    return Number.isFinite(start.getTime()) && Date.now() >= start.getTime();
  }
  function completedStorageKey(){ return `itineraryTrackerV2.completedPlannerOpen:${activeTripId || 'none'}`; }
  function readPlannerOverride(){
    try { return localStorage.getItem(completedStorageKey()) === '1'; } catch { return false; }
  }
  function writePlannerOverride(value){
    plannerOverride = !!value;
    try { localStorage.setItem(completedStorageKey(), plannerOverride ? '1' : '0'); } catch {}
    renderCompletedTripExperience();
  }
  function memoryPhotos(){ return (memoryItems || []).filter(m => m && m.photo_url); }
  function ensureCompletedTripStory(){
    let el = document.getElementById('completedTripStory');
    if (el) return el;
    el = document.createElement('section');
    el.id = 'completedTripStory';
    el.className = 'completed-trip-story glass hidden';
    el.innerHTML = `
      <div class="completed-story-bg"><span></span><span></span><span></span></div>
      <div class="completed-story-copy">
        <p class="eyebrow">Trip complete</p>
        <h2 id="completedStoryTitle">Your memories are ready</h2>
        <p id="completedStorySub">Relive the best moments from this trip.</p>
        <div class="completed-story-stats" id="completedStoryStats"></div>
        <div class="completed-story-actions">
          <button type="button" id="completedAddMemoryBtn">📷 Add Memory</button>
          <button type="button" id="completedViewSlideshowBtn" class="ghost-btn">▶ Full Slideshow</button>
          <button type="button" id="completedAmbientBtn" class="ghost-btn">♪ Ambience</button>
          <button type="button" id="completedPlannerToggleBtn" class="ghost-btn">Open planner</button>
        </div>
      </div>
      <div class="completed-story-stage" id="completedStoryStage"></div>`;
    const home = document.getElementById('homeDashboard');
    if (home?.parentNode) home.parentNode.insertBefore(el, home.nextSibling);
    else document.querySelector('main')?.prepend(el);
    el.querySelector('#completedAddMemoryBtn')?.addEventListener('click', () => {
      if (typeof startQuickMemoryCapture === 'function') startQuickMemoryCapture();
      else els.memoryPhotoInput?.click();
    });
    el.querySelector('#completedViewSlideshowBtn')?.addEventListener('click', () => openMemorySlideshow?.());
    el.querySelector('#completedAmbientBtn')?.addEventListener('click', toggleAmbientMemorySound);
    el.querySelector('#completedPlannerToggleBtn')?.addEventListener('click', () => writePlannerOverride(!plannerOverride));
    return el;
  }
  function renderCompletedTripExperience(){
    const trip = currentTrip?.();
    const el = ensureCompletedTripStory();
    plannerOverride = readPlannerOverride();
    const complete = !!trip && tripEnded(trip);
    document.body.classList.toggle('trip-complete-mode', complete);
    document.body.classList.toggle('trip-planner-override', complete && plannerOverride);
    el.classList.toggle('hidden', !complete);
    if (!complete) { stopStoryTimer(); return; }

    const photos = memoryPhotos();
    const title = el.querySelector('#completedStoryTitle');
    const sub = el.querySelector('#completedStorySub');
    const stats = el.querySelector('#completedStoryStats');
    const toggle = el.querySelector('#completedPlannerToggleBtn');
    if (title) title.textContent = `${trip.title || 'Trip'} Memories`;
    if (sub) sub.textContent = photos.length ? 'A soft slideshow from the moments you saved.' : 'Add photo memories to build your trip recap.';
    if (stats) stats.innerHTML = `<span>📸 ${photos.length} photos</span><span>💜 ${memoryItems?.length || 0} memories</span><span>🗓 ${fmtShortDate?.(trip.start_date) || trip.start_date || ''} – ${fmtShortDate?.(trip.end_date) || trip.end_date || ''}</span>`;
    if (toggle) toggle.textContent = plannerOverride ? 'Return to memories' : 'Open planner';
    renderCompletedStorySlide();
    startStoryTimer();
  }
  function renderCompletedStorySlide(){
    const stage = document.getElementById('completedStoryStage');
    if (!stage) return;
    const photos = memoryPhotos();
    if (!photos.length) {
      stage.innerHTML = `<div class="completed-empty-memory"><span>📷</span><strong>No photo memories yet</strong><p>Tap Add Memory to capture the first photo recap for this trip.</p></div>`;
      return;
    }
    storyIndex = ((storyIndex % photos.length) + photos.length) % photos.length;
    const mem = photos[storyIndex];
    const next = photos[(storyIndex + 1) % photos.length];
    stage.innerHTML = `
      <figure class="completed-slide-card" key="${escapeHtml(mem.id)}">
        <img src="${escapeHtml(mem.photo_url)}" alt="Trip memory" loading="eager" />
        <figcaption><strong>${escapeHtml(mem.note || localDateTimeTitle())}</strong><span>${escapeHtml(fmtShortDate?.(mem.memory_date) || mem.memory_date || '')} • ${storyIndex + 1}/${photos.length}</span></figcaption>
      </figure>
      ${next && photos.length > 1 ? `<img class="completed-next-preload" src="${escapeHtml(next.photo_url)}" alt="" loading="lazy" />` : ''}`;
  }
  function startStoryTimer(){
    const photos = memoryPhotos();
    stopStoryTimer();
    if (!document.body.classList.contains('trip-complete-mode') || photos.length < 2) return;
    storyTimer = setInterval(() => { storyIndex += 1; renderCompletedStorySlide(); }, 5200);
  }
  function stopStoryTimer(){ if (storyTimer) clearInterval(storyTimer); storyTimer = null; }
  function toggleAmbientMemorySound(){
    const btn = document.getElementById('completedAmbientBtn');
    if (ambientCtx) { stopAmbientMemorySound(); if (btn) btn.textContent = '♪ Ambience'; return; }
    try {
      ambientCtx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ambientCtx.createGain(); master.gain.value = 0.025; master.connect(ambientCtx.destination);
      [196, 246.94, 329.63].forEach((freq, idx) => {
        const osc = ambientCtx.createOscillator();
        const gain = ambientCtx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        gain.gain.value = 0.12 / (idx + 1);
        osc.connect(gain); gain.connect(master); osc.start();
        ambientNodes.push(osc, gain);
      });
      if (btn) btn.textContent = 'Pause ambience';
    } catch { alert('Ambient audio is not available in this browser.'); }
  }
  function stopAmbientMemorySound(){
    try { ambientNodes.forEach(n => { if (typeof n.stop === 'function') n.stop(); }); } catch {}
    try { ambientCtx?.close?.(); } catch {}
    ambientNodes = []; ambientCtx = null;
  }

  async function optimizeMemoryImage(file){
    if (!file || !/^image\//i.test(file.type || '') || /svg/i.test(file.type || '')) return file;
    const maxDim = 1600;
    const quality = 0.82;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      if (scale >= 0.98 && file.size < 900000) return file;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      bitmap.close?.();
      if (!blob || blob.size >= file.size) return file;
      const safeName = (file.name || 'memory.jpg').replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], safeName, { type: 'image/jpeg', lastModified: Date.now() });
    } catch (err) {
      console.warn('Memory image optimization skipped.', err);
      return file;
    }
  }

  uploadMemoryPhoto = async function uploadMemoryPhotoFinal(file){
    if (!file) return { photo_url: '', photo_path: '' };
    const optimized = await optimizeMemoryImage(file);
    const ext = ((optimized.name || '').split('.').pop() || (optimized.type === 'image/jpeg' ? 'jpg' : 'jpg')).toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${activeTripId}/${session.user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
    const { error } = await client.storage.from('trip-memories').upload(path, optimized, { cacheControl: '31536000', upsert: false, contentType: optimized.type || 'image/jpeg' });
    if (error) throw error;
    const { data } = client.storage.from('trip-memories').getPublicUrl(path);
    return { photo_url: data?.publicUrl || '', photo_path: path };
  };

  async function removeMemoryPhotoPaths(paths){
    const clean = [...new Set((paths || []).filter(Boolean))];
    if (!clean.length) return;
    for (let i = 0; i < clean.length; i += 50) {
      const batch = clean.slice(i, i + 50);
      const { error } = await client.storage.from('trip-memories').remove(batch);
      if (error) console.warn('Some memory photos could not be removed from storage.', error);
    }
  }

  deleteMemoryItem = async function deleteMemoryItemFinal(id){
    if (!canEdit()) return;
    const mem = memoryItems.find(i => i.id === id);
    const label = mem?.note || (mem?.photo_url ? 'this photo memory' : 'this memory');
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    const prev = memoryItems.slice();
    memoryItems = memoryItems.filter(i => i.id !== id);
    renderMemoryList();
    const { error } = await client.from('itinerary_memories').delete().eq('id', id);
    if (error) { memoryItems = prev; renderMemoryList(); showDbError(error); return; }
    if (mem?.photo_path) await removeMemoryPhotoPaths([mem.photo_path]);
    await loadMemoryItems();
    renderMemoryList(); renderCompletedTripExperience();
    renderHomeDashboard?.(); renderTripProgress?.();
    broadcastTripChange?.('Memory deleted');
  };

  const originalDeleteTrip = typeof deleteTrip === 'function' ? deleteTrip : null;
  deleteTrip = async function deleteTripFinal(){
    if (!activeTripId || !canDeleteTrip()) return alert('Only the trip owner can delete the trip.');
    const trip = currentTrip();
    if (!confirm(`Delete "${trip?.title || 'this trip'}" and all of its itinerary data? This cannot be undone.`)) return;
    const deletedId = activeTripId;
    let photoPaths = [];
    try {
      const { data } = await client.from('itinerary_memories').select('photo_path').eq('trip_id', deletedId);
      photoPaths = (data || []).map(x => x.photo_path).filter(Boolean);
    } catch (err) { console.warn('Could not list memory photo paths before trip delete.', err); }
    try { await removeMemoryPhotoPaths(photoPaths); } catch (err) { console.warn('Storage cleanup before trip delete skipped.', err); }

    let error = null;
    try {
      const res = await client.rpc('delete_itinerary_trip_cascade', { target_trip_id: deletedId });
      error = res.error;
    } catch (rpcError) { error = rpcError; }
    if (error) {
      console.warn('delete_itinerary_trip_cascade unavailable, falling back to direct delete.', error);
      const fallback = await client.from('itinerary_trips').delete().eq('id', deletedId);
      error = fallback.error;
    }
    if (error) return showDbError(error);

    trips = trips.filter(t => t.id !== deletedId);
    if (localStorage.getItem('activeTripId') === deletedId) localStorage.removeItem('activeTripId');
    activeTripId = trips[0]?.id || null;
    try { localStorage.removeItem(`itineraryTrackerV2.completedPlannerOpen:${deletedId}`); } catch {}
    if (!activeTripId) {
      items = []; members = []; packingItems = []; packingProgressByUser = []; mustDoItems = []; memoryItems = [];
      funIdeas = []; funPermissions = []; funCategories = []; shoppingListItems = []; shoppingListPermissions = [];
      setStatus('Trip deleted. Create a new trip when ready.');
      stopAmbientMemorySound();
      render();
      return;
    }
    localStorage.setItem('activeTripId', activeTripId);
    setStatus('Trip deleted');
    await loadTripData();
  };

  render = function renderFinalPolish(){
    originalRender?.();
    renderCompletedTripExperience();
  };

  // Rebind trip delete with capture so this fixed path wins even if older listeners exist.
  els.deleteTripBtn?.addEventListener('click', (event) => {
    event.preventDefault(); event.stopImmediatePropagation(); deleteTrip();
  }, true);

  // Live refresh completed story when slideshow dialog closes/changes and when visibility changes.
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopStoryTimer(); else renderCompletedTripExperience(); });

  // Initial final render once this patch is installed.
  setTimeout(() => { try { renderCompletedTripExperience(); } catch (err) { console.warn(err); } }, 600);
})();

/* v2.1.14 traveler profiles + Fun Ideas lock access + activity/card polish */
(function(){
  const $ = (id) => document.getElementById(id);
  function firstName(name){ return String(name || 'Traveler').trim().split(/\s+/)[0] || 'Traveler'; }
  function memberById(userId){ return members.find(m => m.user_id === userId); }
  function memberProfileName(m){ return firstName(m?.display_name || memberLabel(m?.user_id || '') || 'Traveler'); }
  function avatarNodeHtml(m, sizeClass=''){
    const name = memberProfileName(m);
    const avatar = m?.avatar_url || '';
    return avatar ? `<img class="${sizeClass}" src="${escapeHtml(avatar)}" alt="${escapeHtml(name)} avatar" />` : `<span class="traveler-avatar-fallback ${sizeClass}">${escapeHtml(name.slice(0,1).toUpperCase())}</span>`;
  }
  function ensureProfileDialog(){ return $('profileDialog'); }
  function fillProfileDialog(member){
    const dialog = ensureProfileDialog(); if (!dialog || !member) return;
    const isSelf = member.user_id === session?.user?.id;
    const name = member.display_name || memberLabel(member.user_id) || 'Traveler';
    const first = firstName(name);
    const img = $('profileAvatarPreview'); const fallback = $('profileAvatarFallback');
    if (img) { img.src = member.avatar_url || ''; img.classList.toggle('hidden', !member.avatar_url); }
    if (fallback) { fallback.textContent = first.slice(0,1).toUpperCase(); fallback.classList.toggle('hidden', !!member.avatar_url); }
    if ($('profileDialogTitle')) $('profileDialogTitle').textContent = isSelf ? 'Your Profile' : `${first}'s Profile`;
    const viewer = $('profileViewer'); const editor = $('profileEditor');
    if (viewer) {
      const rows = [
        ['Favorite foods', member.favorite_foods],
        ['Favorite activities', member.favorite_activities],
        ['Personal interests', member.personal_interests || member.interests],
        ['Trip notes', member.profile_notes || member.notes]
      ];
      viewer.innerHTML = rows.map(([label, val]) => `<div class="profile-row"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(val || 'Not added yet.')}</p></div>`).join('');
      viewer.classList.toggle('hidden', isSelf);
    }
    if (editor) {
      $('profileDisplayName').value = member.display_name || name;
      $('profileFavoriteFoods').value = member.favorite_foods || '';
      $('profileFavoriteActivities').value = member.favorite_activities || '';
      $('profileInterests').value = member.personal_interests || member.interests || '';
      $('profileNotes').value = member.profile_notes || member.notes || '';
      editor.classList.toggle('hidden', !isSelf);
    }
    dialog.dataset.userId = member.user_id;
  }
  window.openTravelerProfile = function(userId){
    if (!userId) return;
    const member = memberById(userId) || (userId === session?.user?.id ? { user_id:userId, display_name: currentUserFirstName(), avatar_url: session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || '' } : null);
    if (!member) return;
    fillProfileDialog(member);
    $('profileDialog')?.showModal();
  };
  async function saveProfile(){
    const dialog = $('profileDialog'); const userId = dialog?.dataset?.userId;
    if (!activeTripId || !session?.user?.id || userId !== session.user.id) return;
    const payload = {
      display_name: ($('profileDisplayName')?.value || '').trim() || currentUserFirstName(),
      favorite_foods: ($('profileFavoriteFoods')?.value || '').trim(),
      favorite_activities: ($('profileFavoriteActivities')?.value || '').trim(),
      personal_interests: ($('profileInterests')?.value || '').trim(),
      profile_notes: ($('profileNotes')?.value || '').trim()
    };
    const { data, error } = await client.from('itinerary_trip_members').update(payload).eq('trip_id', activeTripId).eq('user_id', session.user.id).select().single();
    if (error) return showDbError(error);
    members = members.map(m => m.id === data.id ? data : m);
    renderTravelerStrip();
    dialog?.close();
    if (typeof showUndoToast === 'function') showUndoToast('Profile saved', null);
  }
  $('saveProfileBtn')?.addEventListener('click', saveProfile);

  function renderTravelerStrip(){
    const title = $('plannerTitle'); if (!title) return;
    let strip = $('travelerStrip');
    if (!strip) {
      strip = document.createElement('div'); strip.id = 'travelerStrip'; strip.className = 'traveler-strip';
      title.insertAdjacentElement('afterend', strip);
    }
    if (!activeTripId || !members.length) { strip.classList.add('hidden'); strip.innerHTML=''; return; }
    strip.classList.remove('hidden');
    const sorted = [...members].sort((a,b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0));
    const firstFive = sorted.slice(0,5);
    strip.innerHTML = firstFive.map(m => `<button type="button" class="traveler-person" data-profile-user="${escapeHtml(m.user_id)}">${avatarNodeHtml(m)}<span>${escapeHtml(memberProfileName(m))}</span></button>`).join('') + (sorted.length > 5 ? `<button type="button" class="traveler-more" id="travelerMoreBtn">Show more</button>` : '');
  }
  document.addEventListener('click', e => {
    const profileBtn = e.target.closest('[data-profile-user]');
    if (profileBtn) { e.preventDefault(); openTravelerProfile(profileBtn.dataset.profileUser); return; }
    if (e.target.closest('#travelerMoreBtn')) { e.preventDefault(); showAllTravelers(); }
  });
  function showAllTravelers(){
    const list = [...members].sort((a,b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0));
    const dialog = $('profileDialog'); if (!dialog) return;
    if ($('profileDialogTitle')) $('profileDialogTitle').textContent = 'Travelers';
    $('profileAvatarPreview')?.classList.add('hidden');
    if ($('profileAvatarFallback')) { $('profileAvatarFallback').textContent = '👥'; $('profileAvatarFallback').classList.remove('hidden'); }
    $('profileEditor')?.classList.add('hidden');
    const viewer = $('profileViewer');
    if (viewer) {
      viewer.innerHTML = `<div class="traveler-full-list">${list.map(m => `<button type="button" class="traveler-full-row" data-profile-user="${escapeHtml(m.user_id)}">${avatarNodeHtml(m)}<span><strong>${escapeHtml(memberLabel(m.user_id))}</strong><em>${escapeHtml(m.role || 'editor')}</em></span></button>`).join('')}</div>`;
      viewer.classList.remove('hidden');
    }
    dialog.showModal();
  }

  async function refreshFunLockVisibility(){
    const lock = $('funLockBtn'); if (!lock) return;
    if (!activeTripId || !session?.user?.id) { lock.classList.add('hidden'); return; }
    try { if (!funPermissions.length && typeof loadFunPermissions === 'function') await loadFunPermissions(); } catch {}
    const allowed = (typeof isTripOwner === 'function' && isTripOwner()) || (typeof canAccessFunIdeasLocal === 'function' && canAccessFunIdeasLocal());
    lock.classList.toggle('hidden', !allowed);
  }
  $('funLockBtn')?.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); await openFunIdeasDialog(); });
  const oldAvatar = $('avatarFunBtn');
  if (oldAvatar) {
    oldAvatar.title = 'Edit profile';
    oldAvatar.setAttribute('aria-label','Edit traveler profile');
    oldAvatar.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); openTravelerProfile(session?.user?.id); }, true);
  }

  const oldRender = render;
  render = function renderWithTravelerProfilePatch(){
    oldRender?.();
    renderTravelerStrip();
    refreshFunLockVisibility();
  };
  const oldRenderDayTabs = renderDayTabs;
  renderDayTabs = function renderDayTabsWithTravelers(){
    oldRenderDayTabs?.();
    renderTravelerStrip();
  };
  setTimeout(() => { renderTravelerStrip(); refreshFunLockVisibility(); }, 900);
})();


/* v2.1.15 Traveler Passport profile polish */
(function(){
  const $ = (id) => document.getElementById(id);
  const STYLE_OPTIONS = ['Relaxed','Packed schedule','Early riser','Night owl','Budget-friendly','Splurge sometimes','Needs breaks','Kid-friendly','Outdoor focused','Indoor focused','Foodie','Photo moments'];
  function esc(v){ return typeof escapeHtml === 'function' ? escapeHtml(v == null ? '' : String(v)) : String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function firstName(name){ return String(name || 'Traveler').trim().split(/\s+/)[0] || 'Traveler'; }
  function memberById(userId){ return (window.members || members || []).find(m => m.user_id === userId); }
  function displayName(m){ return m?.display_name || (typeof memberLabel === 'function' ? memberLabel(m?.user_id || '') : '') || 'Traveler'; }
  function avatarUrl(m){ return m?.avatar_url || ''; }
  function splitList(value){ return String(value || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean).slice(0,24); }
  function chipList(value, opts={}){ const items = Array.isArray(value) ? value : splitList(value); if (!items.length) return `<span class="passport-empty">Not added yet.</span>`; return `<div class="passport-chip-cloud">${items.map(x => `<span class="passport-chip ${opts.className||''}">${opts.prefix||''}${esc(x)}</span>`).join('')}</div>`; }
  function boolVal(v){ return String(v || '').trim(); }
  function completion(m){
    const keys = ['display_name','trip_role','favorite_foods','foods_to_avoid','favorite_activities','personal_interests','shopping_interests','rainy_day_favorites','outdoor_favorites','travel_style','budget_comfort','preferred_wake_time','logistics_notes','profile_notes'];
    const done = keys.filter(k => boolVal(m?.[k])).length;
    return Math.max(8, Math.round((done / keys.length) * 100));
  }
  function roleText(m){ return m?.trip_role || (m?.role === 'owner' ? 'Trip Owner' : 'Traveler'); }
  function budgetText(m){ return m?.budget_comfort || 'Not set'; }
  function renderPassportViewer(m, isSelf){
    const pct = completion(m);
    const styles = splitList(m?.travel_style);
    return `
      <div class="passport-body" id="passportViewerV2">
        <div class="passport-section-grid">
          <section class="passport-section"><h3>🍽 Food</h3>${chipList(m?.favorite_foods,{className:'good'})}<h3 style="margin-top:14px">🚫 Avoids</h3>${chipList(m?.foods_to_avoid,{className:'avoid'})}</section>
          <section class="passport-section"><h3>🎢 Activities</h3>${chipList(m?.favorite_activities)}<h3 style="margin-top:14px">🛍 Shopping interests</h3>${chipList(m?.shopping_interests)}</section>
          <section class="passport-section"><h3>🌧 Rainy-day picks</h3>${chipList(m?.rainy_day_favorites)}</section>
          <section class="passport-section"><h3>🌲 Outdoor favorites</h3>${chipList(m?.outdoor_favorites,{className:'good'})}</section>
          <section class="passport-section"><h3>🚗 Travel style</h3>${chipList(styles,{className:'muted'})}<div class="passport-chip-cloud" style="margin-top:10px"><span class="passport-chip">💵 ${esc(budgetText(m))}</span>${m?.preferred_wake_time ? `<span class="passport-chip">⏰ ${esc(m.preferred_wake_time)}</span>` : ''}</div></section>
          <section class="passport-section"><h3>🧳 Logistics</h3><p class="passport-note">${esc(m?.logistics_notes || 'No logistics notes yet.')}</p></section>
          <section class="passport-section full"><h3>💬 Good to know</h3><p class="passport-note">${esc(m?.profile_notes || m?.notes || 'No trip notes yet.')}</p></section>
        </div>
      </div>`;
  }
  function editorHtml(m){
    const selectedStyles = new Set(splitList(m?.travel_style));
    return `
      <div class="passport-editor" id="passportEditorV2">
        <div class="passport-editor-grid">
          <label>Display name<input id="profileDisplayNameV2" maxlength="80" value="${esc(m?.display_name || displayName(m))}" placeholder="Your name" /></label>
          <label>Nickname<input id="profileNicknameV2" maxlength="60" value="${esc(m?.nickname || '')}" placeholder="Optional nickname" /></label>
          <label>Trip role<select id="profileTripRoleV2">
            ${['Traveler','Trip Owner','Planner','Driver','Passenger','Parent','Photographer','Food Scout','Budget Keeper'].map(r => `<option ${roleText(m)===r?'selected':''}>${r}</option>`).join('')}
          </select></label>
          <label>Budget comfort<select id="profileBudgetComfortV2">
            ${['Not set','Budget-friendly','Moderate','Splurge sometimes','Ask before expensive activities'].map(r => `<option ${budgetText(m)===r?'selected':''}>${r}</option>`).join('')}
          </select></label>
          <label>Preferred wake-up time<input id="profileWakeTimeV2" type="time" value="${esc(m?.preferred_wake_time || '')}" /></label>
          <label>Favorite foods<textarea id="profileFavoriteFoodsV2" placeholder="Coffee, seafood, burgers, ice cream...">${esc(m?.favorite_foods || '')}</textarea></label>
          <label>Foods to avoid<textarea id="profileFoodsAvoidV2" placeholder="Spicy food, seafood, long waits...">${esc(m?.foods_to_avoid || '')}</textarea></label>
          <label>Favorite activities<textarea id="profileFavoriteActivitiesV2" placeholder="Museums, beach, hiking, shopping...">${esc(m?.favorite_activities || '')}</textarea></label>
          <label>Shopping interests<textarea id="profileShoppingInterestsV2" placeholder="Souvenirs, outlets, local markets...">${esc(m?.shopping_interests || '')}</textarea></label>
          <label>Rainy-day favorites<textarea id="profileRainyFavoritesV2" placeholder="Arcades, movies, museums, cozy restaurants...">${esc(m?.rainy_day_favorites || '')}</textarea></label>
          <label>Outdoor favorites<textarea id="profileOutdoorFavoritesV2" placeholder="Walks, lakes, beaches, scenic drives...">${esc(m?.outdoor_favorites || '')}</textarea></label>
          <label class="full">Personal interests<textarea id="profileInterestsV2" placeholder="Anything helpful for planning a trip together...">${esc(m?.personal_interests || m?.interests || '')}</textarea></label>
          <label class="full">Travel style<div class="style-chip-grid">${STYLE_OPTIONS.map(s => `<label><input type="checkbox" data-style-chip="${esc(s)}" ${selectedStyles.has(s)?'checked':''}/> ${esc(s)}</label>`).join('')}</div></label>
          <label class="full">Logistics / accessibility notes<textarea id="profileLogisticsV2" placeholder="Needs breaks, motion sickness, quiet ride, accessibility notes...">${esc(m?.logistics_notes || '')}</textarea></label>
          <label class="full">Good to know / trip notes<textarea id="profileNotesV2" placeholder="Helpful notes others should know when planning with you...">${esc(m?.profile_notes || m?.notes || '')}</textarea></label>
        </div>
        <div class="dialog-actions"><button id="cancelPassportEditBtn" class="ghost-btn" type="button">Cancel</button><button id="saveProfilePassportBtn" type="button">Save Traveler Passport</button></div>
      </div>`;
  }
  function renderProfileDialogV2(m){
    const dialog = $('profileDialog'); if (!dialog || !m) return;
    const card = dialog.querySelector('.dialog-card') || dialog.firstElementChild;
    if (!card) return;
    card.classList.add('passport-card');
    const isSelf = m.user_id === session?.user?.id;
    const name = displayName(m);
    const first = firstName(name);
    const pct = completion(m);
    const av = avatarUrl(m);
    card.innerHTML = `
      <div class="passport-hero">
        <div class="passport-avatar-wrap">${av ? `<img src="${esc(av)}" alt="${esc(first)} avatar" />` : `<div class="passport-avatar-fallback">${esc(first.slice(0,1).toUpperCase())}</div>`}</div>
        <div class="passport-title-block">
          <p class="eyebrow">Traveler Passport</p>
          <div class="passport-title-line"><h2>${isSelf ? 'Your Traveler Passport' : `${esc(first)}’s Passport`}</h2><span class="passport-role-chip">🧭 ${esc(roleText(m))}</span></div>
          <p class="passport-sub">${esc(m?.nickname ? `${name} · “${m.nickname}”` : name)}</p>
          <div class="passport-progress"><div class="passport-progress-row"><span>Profile completion</span><span>${pct}%</span></div><div class="passport-progress-bar"><div class="passport-progress-fill" style="width:${pct}%"></div></div></div>
        </div>
        <div class="passport-actions"><button value="cancel" class="ghost-btn" type="button" id="passportCloseBtn">Close</button>${isSelf ? `<button type="button" id="passportEditBtn">Edit Profile</button>` : ''}</div>
      </div>
      ${renderPassportViewer(m,isSelf)}
      ${isSelf ? editorHtml(m) : ''}`;
    dialog.dataset.userId = m.user_id;
    $('passportCloseBtn')?.addEventListener('click', () => dialog.close());
    $('passportEditBtn')?.addEventListener('click', () => { $('passportEditorV2')?.classList.add('is-open'); $('passportEditorV2')?.scrollIntoView({behavior:'smooth', block:'nearest'}); });
    $('cancelPassportEditBtn')?.addEventListener('click', () => { $('passportEditorV2')?.classList.remove('is-open'); });
    $('saveProfilePassportBtn')?.addEventListener('click', savePassportV2);
  }
  async function savePassportV2(){
    const dialog = $('profileDialog');
    if (!activeTripId || !session?.user?.id || dialog?.dataset?.userId !== session.user.id) return;
    const styles = [...document.querySelectorAll('[data-style-chip]:checked')].map(x => x.getAttribute('data-style-chip')).filter(Boolean).join(', ');
    const payload = {
      display_name: ($('profileDisplayNameV2')?.value || '').trim() || (typeof currentUserFirstName === 'function' ? currentUserFirstName() : 'Traveler'),
      nickname: ($('profileNicknameV2')?.value || '').trim(),
      trip_role: ($('profileTripRoleV2')?.value || '').trim(),
      favorite_foods: ($('profileFavoriteFoodsV2')?.value || '').trim(),
      foods_to_avoid: ($('profileFoodsAvoidV2')?.value || '').trim(),
      favorite_activities: ($('profileFavoriteActivitiesV2')?.value || '').trim(),
      personal_interests: ($('profileInterestsV2')?.value || '').trim(),
      shopping_interests: ($('profileShoppingInterestsV2')?.value || '').trim(),
      rainy_day_favorites: ($('profileRainyFavoritesV2')?.value || '').trim(),
      outdoor_favorites: ($('profileOutdoorFavoritesV2')?.value || '').trim(),
      travel_style: styles,
      budget_comfort: ($('profileBudgetComfortV2')?.value || '').trim(),
      preferred_wake_time: ($('profileWakeTimeV2')?.value || '').trim() || null,
      logistics_notes: ($('profileLogisticsV2')?.value || '').trim(),
      profile_notes: ($('profileNotesV2')?.value || '').trim()
    };
    const { data, error } = await client.from('itinerary_trip_members').update(payload).eq('trip_id', activeTripId).eq('user_id', session.user.id).select().single();
    if (error) return showDbError(error);
    members = members.map(m => m.id === data.id ? data : m);
    renderProfileDialogV2(data);
    if (typeof renderTravelerStrip === 'function') { try { renderTravelerStrip(); } catch {} }
    if (typeof showUndoToast === 'function') showUndoToast('Traveler Passport saved', null);
  }
  window.openTravelerProfile = function(userId){
    if (!userId) return;
    const m = memberById(userId) || (userId === session?.user?.id ? { user_id:userId, display_name:(typeof currentUserFirstName === 'function' ? currentUserFirstName() : 'Traveler'), avatar_url: session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || '' } : null);
    if (!m) return;
    renderProfileDialogV2(m);
    $('profileDialog')?.showModal();
  };
})();


/* v2.2 production stabilization patch: agenda default, toasts, silent refresh fallback, QA helpers */
(function productionStabilizationV22(){
  const $ = id => document.getElementById(id);
  const PREF_VIEW = 'itineraryTrackerV2.planViewMode';
  const PREF_TOASTS = 'itineraryTrackerV2.showToasts';
  const LIVE_POLL_MS = 45000;
  let silentPollTimer = null;
  let lastToastAt = 0;
  function ensureToastHost(){
    let host = $('toastHost');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'toastHost';
    host.className = 'toast-host';
    host.setAttribute('aria-live','polite');
    document.body.appendChild(host);
    return host;
  }
  window.showAppToast = function showAppToast(message, type='info', timeout=3200){
    const prefs = (() => { try { return JSON.parse(localStorage.getItem('itineraryTrackerV2.settings') || '{}'); } catch { return {}; } })();
    if (prefs.showLiveToasts === false || localStorage.getItem(PREF_TOASTS) === '0') return;
    const host = ensureToastHost();
    const now = Date.now();
    if (now - lastToastAt < 350 && host.lastElementChild?.textContent === String(message || '')) return;
    lastToastAt = now;
    const toast = document.createElement('div');
    toast.className = `app-toast ${type}`;
    toast.innerHTML = `<span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : '✨'}</span><strong>${escapeHtml(String(message || 'Updated'))}</strong>`;
    host.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 260); }, timeout);
  };
  const oldSetStatus = typeof setStatus === 'function' ? setStatus : null;
  if (oldSetStatus && !oldSetStatus._v22Wrapped) {
    const wrapped = function setStatusV22(msg){
      oldSetStatus(msg);
      const text = String(msg || '').trim();
      if (!text || ['Ready','Loading...','Live sync on'].includes(text)) return;
      if (/error|failed|needed|unavailable/i.test(text)) showAppToast(text, 'error');
      else if (/saved|updated|added|deleted|locked|unlocked|accepted|created|cleaned/i.test(text)) showAppToast(text, 'success');
    };
    wrapped._v22Wrapped = true;
    setStatus = wrapped;
  }
  const oldShowDbError = typeof showDbError === 'function' ? showDbError : null;
  showDbError = function showDbErrorV22(error){
    console.error(error);
    const message = error?.message || String(error || 'Something went wrong');
    showAppToast(message, 'error', 6500);
    if (oldSetStatus) oldSetStatus('Database action failed');
  };
  function dialogsOpen(){
    return !!document.querySelector('dialog[open]');
  }
  function isTyping(){
    const el = document.activeElement;
    return !!el && ['INPUT','TEXTAREA','SELECT'].includes(el.tagName);
  }
  window.silentRefreshTripData = async function silentRefreshTripData(label='Synced changes'){
    if (!activeTripId || !session?.user?.id) return;
    if (dialogsOpen() || isTyping()) return;
    try {
      await refreshLiveTripData();
      if (label) showAppToast(label, 'info', 1800);
    } catch (err) { console.warn('Silent refresh failed', err); }
  };
  function startSilentPoll(){
    clearInterval(silentPollTimer);
    silentPollTimer = setInterval(() => silentRefreshTripData(''), LIVE_POLL_MS);
  }
  startSilentPoll();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) silentRefreshTripData('Trip refreshed'); });

  function ensurePlanViewControls(){
    const panel = document.querySelector('.planner-panel');
    const head = panel?.querySelector('.panel-head');
    if (!panel || !head || $('planViewToggle')) return;
    const wrap = document.createElement('div');
    wrap.className = 'plan-view-toggle';
    wrap.id = 'planViewToggle';
    wrap.innerHTML = `<button type="button" data-view="agenda">Agenda</button><button type="button" data-view="timeline">Timeline</button>`;
    head.appendChild(wrap);
    wrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;
      setPlanView(btn.dataset.view);
    });
  }
  function setPlanView(mode){
    const view = mode === 'timeline' ? 'timeline' : 'agenda';
    document.body.classList.toggle('agenda-view', view === 'agenda');
    document.body.classList.toggle('timeline-view', view === 'timeline');
    localStorage.setItem(PREF_VIEW, view);
    document.querySelectorAll('#planViewToggle [data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
    try { renderTimeline(); } catch {}
  }
  const oldRender = typeof render === 'function' ? render : null;
  render = function renderV22(){
    if (oldRender) oldRender();
    ensurePlanViewControls();
    const view = localStorage.getItem(PREF_VIEW) || 'agenda';
    setTimeout(() => setPlanView(view), 0);
  };

  // Improve event feedback without disturbing current save flow.
  const oldBroadcast = typeof broadcastTripChange === 'function' ? broadcastTripChange : null;
  if (oldBroadcast && !oldBroadcast._v22Wrapped) {
    const wrappedBroadcast = function(label='Trip updated'){
      oldBroadcast(label);
      if (/locked|unlocked|updated|added|deleted|moved|saved/i.test(label)) showAppToast(label, 'success', 1800);
    };
    wrappedBroadcast._v22Wrapped = true;
    broadcastTripChange = wrappedBroadcast;
  }

  // Better empty-state copy for no-trip users without auto-generating starter trips.
  function ensureNoTripEmptyState(){
    const app = $('appArea');
    if (!app || activeTripId || trips.length) return;
    const existing = $('noTripsState');
    if (existing) return;
    const section = document.createElement('section');
    section.id = 'noTripsState';
    section.className = 'no-trips-state glass';
    section.innerHTML = `<span>🧳</span><h2>Start your first trip</h2><p>Create a trip, invite your people, then add plans, packing, memories, and must-dos.</p><button type="button" id="noTripsCreateBtn">Create Trip</button>`;
    app.prepend(section);
    $('noTripsCreateBtn')?.addEventListener('click', () => openTripDialog?.());
  }
  const oldLoadTrips = typeof loadTrips === 'function' ? loadTrips : null;
  if (oldLoadTrips && !oldLoadTrips._v22Wrapped) {
    const wrappedLoadTrips = async function loadTripsV22(){
      await oldLoadTrips();
      ensureNoTripEmptyState();
      startSilentPoll();
    };
    wrappedLoadTrips._v22Wrapped = true;
    loadTrips = wrappedLoadTrips;
  }

  // Lightweight production debug: Ctrl/⌘ + Shift + D toggles current sync diagnostics.
  document.addEventListener('keydown', e => {
    if (!(e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd')) return;
    let panel = $('debugSyncPanel');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'debugSyncPanel';
      panel.className = 'debug-sync-panel';
      document.body.appendChild(panel);
    }
    panel.classList.toggle('open');
    panel.innerHTML = `<strong>ItineraryTrackerV2.2 Diagnostics</strong><p>User: ${escapeHtml(session?.user?.email || 'not signed in')}</p><p>Trip: ${escapeHtml(activeTripId || 'none')}</p><p>Items: ${items?.length || 0}</p><p>Members: ${members?.length || 0}</p><p>Realtime: ${realtimeChannel ? 'initialized' : 'off'}</p><p>Last sync: ${new Date().toLocaleTimeString()}</p>`;
  });

  window.addEventListener('online', () => silentRefreshTripData('Back online — refreshed'));
  window.addEventListener('offline', () => showAppToast('Offline — changes may not sync until connection returns', 'error', 4500));
})();
