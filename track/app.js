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
  itemTitle: document.getElementById('itemTitle'), itemDate: document.getElementById('itemDate'), itemTime: document.getElementById('itemTime'), itemEndTime: document.getElementById('itemEndTime'), itemType: document.getElementById('itemType'), itemBudget: document.getElementById('itemBudget'), itemLocation: document.getElementById('itemLocation'), itemNotes: document.getElementById('itemNotes'), itemRainPlan: document.getElementById('itemRainPlan'), saveItemBtn: document.getElementById('saveItemBtn'),
  expandAllBtn: document.getElementById('expandAllBtn'), collapseAllBtn: document.getElementById('collapseAllBtn'), exportBtn: document.getElementById('exportBtn'), importInput: document.getElementById('importInput'),
  tripDialog: document.getElementById('tripDialog'), dialogTripTitle: document.getElementById('dialogTripTitle'), dialogStartDate: document.getElementById('dialogStartDate'), dialogEndDate: document.getElementById('dialogEndDate'), createTripConfirm: document.getElementById('createTripConfirm'),
  inviteRole: document.getElementById('inviteRole'), createInviteBtn: document.getElementById('createInviteBtn'), inviteOutput: document.getElementById('inviteOutput'), inviteLink: document.getElementById('inviteLink'), copyInviteBtn: document.getElementById('copyInviteBtn'), collabList: document.getElementById('collabList'),
  destinationSuggestions: document.getElementById('destinationSuggestions'), destinationMapLinks: document.getElementById('destinationMapLinks'), itemLocationSuggestions: document.getElementById('itemLocationSuggestions'), itemLocationMapLinks: document.getElementById('itemLocationMapLinks'), userName: document.getElementById('userName'), userAvatar: document.getElementById('userAvatar'), heroDaysLeft: document.getElementById('heroDaysLeft'), travelerCount: document.getElementById('travelerCount'), detailsDestination: document.getElementById('detailsDestination'), detailsStart: document.getElementById('detailsStart'), detailsEnd: document.getElementById('detailsEnd'), sidebarNewTripBtn: document.getElementById('sidebarNewTripBtn'), viewItineraryBtn: document.getElementById('viewItineraryBtn'),
  packingPanel: document.getElementById('packingPanel'), packingCount: document.getElementById('packingCount'), packingProgress: document.getElementById('packingProgress'), packingList: document.getElementById('packingList'), packingForm: document.getElementById('packingForm'), packingInput: document.getElementById('packingInput'), addPackingBtn: document.getElementById('addPackingBtn'), resetPackingBtn: document.getElementById('resetPackingBtn'), snapMode: document.getElementById('snapMode'), undoToast: document.getElementById('undoToast'), undoToastText: document.getElementById('undoToastText'), undoBtn: document.getElementById('undoBtn')
};

const typeIcon = { event: '🎟️', drive: '🚗', food: '🍽️', hotel: '🏨', gas: '⛽', todo: '✅' };
let session = null, trips = [], items = [], members = [], packingItems = [], activeTripId = null, draggedId = null, autosaveTimer = null, selectedDay = null, pendingInviteToken = null, lastUndo = null, undoTimer = null, timelineDrag = null, packingDragId = null;

const setStatus = m => els.saveStatus.textContent = m;
const money = n => Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const todayISO = () => new Date().toISOString().slice(0, 10);
function addDays(dateString, days) { const d = new Date(`${dateString}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function dateRange(start, end) { if (!start || !end) return []; if (end < start) end = start; const out = []; let cur = start; while (cur <= end && out.length < 90) { out.push(cur); cur = addDays(cur, 1); } return out; }
function fmtDate(d) { return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }); }
function fmtShortDate(d) { return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function fmtTime(t) { if (!t) return ''; const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m || 0, 0, 0); return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
function escapeHtml(str) { return String(str || '').replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }
function isMissingRainPlanColumn(error) { return /rain_plan|schema cache|column/i.test(String(error?.message || '')); }

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
  return items.find(other => other.id !== item.id && other.item_date === day && timeToMinutes(other.start_time) !== null && timeToMinutes(other.end_time) !== null && start < timeToMinutes(other.end_time) && end > timeToMinutes(other.start_time));
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
async function loadTripData() { await Promise.all([loadItems(), loadMembers(), loadPackingItems()]); setStatus('Ready'); render(); }
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
  const payload = { user_id: session.user.id, title: input.title || 'New trip', start_date: input.start_date || todayISO(), end_date: input.end_date || input.start_date || todayISO(), destination: '', notes: '' };
  const { data, error } = await client.from('itinerary_trips').insert(payload).select().single(); if (error) return showDbError(error);
  trips.push(data); activeTripId = data.id; selectedDay = data.start_date; localStorage.setItem('activeTripId', activeTripId); await loadTripData();
}
async function deleteTrip() { if (!activeTripId || !canDeleteTrip()) return alert('Only the trip owner can delete the trip.'); if (!confirm('Delete this entire trip and all itinerary items?')) return; const { error } = await client.from('itinerary_trips').delete().eq('id', activeTripId); if (error) return showDbError(error); trips = trips.filter(t => t.id !== activeTripId); activeTripId = trips[0]?.id || null; if (!activeTripId) await createTrip({ title: 'My Trip', start_date: todayISO(), end_date: addDays(todayISO(), 3) }); else await loadTripData(); }

function getTripPatchFromInputs() {
  let start = els.startDate.value || todayISO(); let end = els.endDate.value || start; if (end < start) { end = start; els.endDate.value = end; }
  return { title: els.tripTitle.value.trim() || 'Untitled trip', start_date: start, end_date: end, destination: els.destination.value.trim(), notes: els.tripNotes.value.trim(), updated_at: new Date().toISOString() };
}
function queueTripSave() {
  if (!canEdit()) return renderTripEditor();
  const trip = currentTrip(); if (trip) Object.assign(trip, getTripPatchFromInputs());
  const days = dateRange(trip?.start_date, trip?.end_date); if (!days.includes(selectedDay)) selectedDay = trip?.start_date;
  renderTripSelect(); renderSummary(); renderDayTabs(); renderTimeline();
  clearTimeout(autosaveTimer); setStatus('Saving...'); autosaveTimer = setTimeout(saveTrip, 500);
}
async function saveTrip() {
  const trip = currentTrip(); if (!trip || !canEdit()) return; const patch = getTripPatchFromInputs();
  const { data, error } = await client.from('itinerary_trips').update(patch).eq('id', trip.id).select().single(); if (error) return showDbError(error);
  trips = trips.map(t => t.id === data.id ? data : t); setStatus('Saved'); render();
}

function openItemDialog(date, item = null) {
  if (!canEdit()) return alert('This invite is view-only. Ask the owner for an edit invite.');
  els.itemDialogTitle.textContent = item ? 'Edit itinerary item' : 'Add itinerary item';
  els.editingItemId.value = item?.id || ''; els.itemTitle.value = item?.title || ''; els.itemDate.value = item?.item_date || date || selectedDay || currentTrip()?.start_date || todayISO();
  els.itemTime.value = item?.start_time || ''; els.itemEndTime.value = item?.end_time || ''; els.itemType.value = item?.item_type || 'event'; els.itemBudget.value = item?.budget || ''; els.itemLocation.value = item?.location || ''; els.itemNotes.value = item?.notes || ''; if (els.itemRainPlan) els.itemRainPlan.value = item?.rain_plan || '';
  renderMapLinks(els.itemLocationMapLinks, els.itemLocation.value);
  els.itemDialog.showModal(); setTimeout(() => els.itemTitle.focus(), 50);
}
async function saveItemFromDialog(e) {
  e.preventDefault(); if (!activeTripId || !canEdit()) return;
  const title = els.itemTitle.value.trim(); if (!title) return alert('Add a title first.');
  const payload = { title, item_date: els.itemDate.value || currentTrip()?.start_date || todayISO(), start_time: els.itemTime.value || null, end_time: els.itemEndTime.value || null, item_type: els.itemType.value, budget: Number(els.itemBudget.value || 0), location: els.itemLocation.value.trim(), notes: els.itemNotes.value.trim(), rain_plan: els.itemRainPlan?.value.trim() || '', sort_order: Date.now(), updated_at: new Date().toISOString() };
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
async function updateItem(id, patch) { if (!canEdit()) return; const { data, error } = await client.from('itinerary_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single(); if (error) return showDbError(error); items = items.map(i => i.id === id ? data : i); render(); }
async function deleteItem(id) { if (!canEdit()) return; if (!confirm('Delete this item?')) return; const { error } = await client.from('itinerary_items').delete().eq('id', id); if (error) return showDbError(error); items = items.filter(i => i.id !== id); render(); }

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

function render() { renderTripSelect(); renderTripEditor(); renderSummary(); renderSharePanel(); renderDayTabs(); renderTimeline(); renderPackingList(); }
function renderTripSelect() { els.tripSelect.innerHTML = trips.map(t => `<option value="${t.id}">${escapeHtml(t.title || 'Untitled trip')}</option>`).join(''); els.tripSelect.value = activeTripId || ''; }
function renderTripEditor() {
  const t = currentTrip(); if (!t) return; els.tripTitle.value = t.title || ''; els.startDate.value = t.start_date || ''; els.endDate.value = t.end_date || ''; els.destination.value = t.destination || ''; els.tripNotes.value = t.notes || ''; renderMapLinks(els.destinationMapLinks, t.destination || ''); selectedDay ||= t.start_date;
  if (els.detailsDestination) els.detailsDestination.textContent = t.destination || 'Add destination';
  if (els.detailsStart) els.detailsStart.textContent = t.start_date ? new Date(`${t.start_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  if (els.detailsEnd) els.detailsEnd.textContent = t.end_date ? new Date(`${t.end_date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const editable = canEdit();
  [els.tripTitle, els.startDate, els.endDate, els.destination, els.tripNotes, els.addAnyItemBtn, els.exportBtn, els.importInput].forEach(el => { if (el) el.disabled = !editable && el !== els.exportBtn; });
  els.deleteTripBtn.disabled = !canDeleteTrip();
}
function renderSummary() { const t = currentTrip(); const days = t ? dateRange(t.start_date, t.end_date) : []; els.totalBudget.textContent = money(items.reduce((sum, i) => sum + Number(i.budget || 0), 0)); els.stopCount.textContent = items.length; els.dayCount.textContent = days.length; if (els.travelerCount) els.travelerCount.textContent = Math.max(1, members.length); if (els.heroDaysLeft) { const today = new Date(todayISO() + 'T12:00:00'); const start = t?.start_date ? new Date(t.start_date + 'T12:00:00') : today; const diff = Math.max(0, Math.ceil((start - today) / 86400000)); els.heroDaysLeft.textContent = days.length ? (diff || days.length) : 0; } els.plannerTitle.textContent = t ? `${t.title || 'Trip'} • ${days.length} day${days.length === 1 ? '' : 's'}` : 'Your itinerary'; }
function renderSharePanel() {
  const role = currentMembership()?.role || 'viewer';
  els.roleBadge.textContent = role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : 'Viewer';
  els.roleBadge.className = `role-badge ${role}`;
  els.createInviteBtn.disabled = !canEdit();
  els.inviteRole.disabled = !canEdit();
  els.collabList.innerHTML = members.map(m => `<div class="collab-pill"><strong>${m.user_id === session?.user?.id ? 'You' : 'User'}</strong><span>${m.role}</span></div>`).join('') || '<p class="helper-text">No collaborators yet.</p>';
}
function renderDayTabs() {
  const t = currentTrip(); const days = t ? dateRange(t.start_date, t.end_date) : []; if (!days.includes(selectedDay)) selectedDay = days[0];
  els.dayTabs.innerHTML = days.map((day, idx) => { const count = items.filter(i => i.item_date === day).length; return `<button class="day-tab ${day === selectedDay ? 'active' : ''}" data-day="${day}"><span>Day ${idx + 1}</span><strong>${fmtShortDate(day)}</strong><em>${count} item${count === 1 ? '' : 's'}</em></button>`; }).join('');
  els.dayTabs.querySelectorAll('.day-tab').forEach(btn => btn.addEventListener('click', () => { selectedDay = btn.dataset.day; renderDayTabs(); renderTimeline(); }));
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
    card.innerHTML = `<div class="day-header"><div><p>Day ${days.indexOf(day) + 1}</p><strong>${fmtDate(day)}</strong></div><span>${dayItems.length} planned</span></div><div class="timeline-board" data-day="${day}"></div><div class="anytime-list"></div><button class="quick-add ghost-btn">+ Add to this day</button>`;
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
        const dragged = items.find(i => i.id === draggedId); if (!dragged) return;
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
  card.draggable = canEdit();
  const start = itemStartMinutes(item), end = itemEndMinutes(item);
  if (isTimed) {
    card.classList.add('timeline-item');
    card.style.top = `${minutesToY(start) + (TIMELINE_EVENT_GAP / 2)}px`;
    const naturalHeight = minutesToY(end) - minutesToY(start) - TIMELINE_EVENT_GAP;
    card.style.minHeight = `${Math.max(44, naturalHeight)}px`;
    card.style.height = `${Math.max(44, naturalHeight)}px`;
    card.classList.toggle('compact-time-card', naturalHeight < 70);
    card.classList.toggle('roomy-time-card', naturalHeight >= 110);
    card.classList.toggle('very-roomy-time-card', naturalHeight >= 170);
  }
  const time = [fmtTime(item.start_time), fmtTime(item.end_time)].filter(Boolean).join(' - ');
  tpl.querySelector('.time-chip').textContent = time || 'Anytime';
  tpl.querySelector('.item-type').textContent = typeIcon[item.item_type] || '📌';
  tpl.querySelector('h3').textContent = item.title;
  const meta = tpl.querySelector('.item-meta');
  const parts = [Number(item.budget || 0) ? money(item.budget) : '', item.item_type].filter(Boolean);
  const locLabel = shortLocationLabel(item.location);
  meta.innerHTML = `${item.location ? `<a class="location-link" target="_blank" rel="noopener" title="${escapeHtml(item.location)}" href="${mapsUrl(item.location, 'google')}">📍 ${escapeHtml(locLabel)}</a>${parts.length ? ' • ' : ''}` : ''}${escapeHtml(parts.join(' • '))}`;
  tpl.querySelector('.item-notes').textContent = item.notes || '';
  const overlap = findOverlap(item);
  const warning = tpl.querySelector('.overlap-warning');
  if (overlap) { card.classList.add('has-overlap'); warning.classList.remove('hidden'); warning.textContent = `⚠ Overlaps with ${overlap.title}`; }
  const rainText = tpl.querySelector('.rain-plan-text');
  if (rainText) rainText.textContent = item.rain_plan || 'No rain backup added yet. Tap Edit rain plan to add an indoor option, alternate time, or weather note.';
  if (item.rain_plan) card.classList.add('has-rain-plan');
  const editBtn = tpl.querySelector('.edit'); const delBtn = tpl.querySelector('.delete'); const earlierBtn = tpl.querySelector('.earlier'); const laterBtn = tpl.querySelector('.later'); const rainBtn = tpl.querySelector('.rain-toggle'); const rainClose = tpl.querySelector('.rain-close'); const editRainBtn = tpl.querySelector('.edit-rain');
  editBtn.disabled = delBtn.disabled = earlierBtn.disabled = laterBtn.disabled = !canEdit(); if (editRainBtn) editRainBtn.disabled = !canEdit();
  editBtn.addEventListener('click', () => openItemDialog(item.item_date, item));
  rainBtn?.addEventListener('click', () => card.classList.toggle('rain-flipped'));
  rainClose?.addEventListener('click', () => card.classList.remove('rain-flipped'));
  editRainBtn?.addEventListener('click', () => openItemDialog(item.item_date, item));
  attachRainLongPress(card);
  delBtn.addEventListener('click', () => deleteItem(item.id));
  earlierBtn.addEventListener('click', () => shiftItemBy(item.id, -30));
  laterBtn.addEventListener('click', () => shiftItemBy(item.id, 30));
  if (canEdit()) {
    card.addEventListener('dragstart', () => { draggedId = item.id; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('pointerdown', e => startTimelinePointer(e, item, card));
  }
  return tpl;
}

function attachRainLongPress(card) {
  let timer = null;
  let startX = 0, startY = 0;
  const clear = () => { if (timer) clearTimeout(timer); timer = null; };
  card.addEventListener('touchstart', e => {
    if (isInteractiveTarget(e.target)) return;
    const t = e.touches?.[0]; if (!t) return;
    startX = t.clientX; startY = t.clientY;
    timer = setTimeout(() => {
      card.classList.toggle('rain-flipped');
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
  const item = items.find(i => i.id === id); if (!item || !canEdit()) return;
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
  if (!canEdit() || (!resizeStart && !resizeEnd && isInteractiveTarget(e.target))) return;
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

function exportJson() { const data = { trip: currentTrip(), items }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${currentTrip()?.title || 'trip'}-itinerary.json`; a.click(); URL.revokeObjectURL(a.href); }
async function importJson(file) { if (!canEdit()) return; const parsed = JSON.parse(await file.text()); if (!parsed?.items?.length) return alert('No items found in JSON.'); const newItems = parsed.items.map(i => ({ user_id: session.user.id, trip_id: activeTripId, title: i.title, item_date: i.item_date, start_time: i.start_time, end_time: i.end_time, item_type: i.item_type || 'event', budget: Number(i.budget || 0), location: i.location || '', notes: i.notes || '', sort_order: i.sort_order || Date.now() })); const { error } = await client.from('itinerary_items').insert(newItems); if (error) return showDbError(error); await loadTripData(); }

els.googleBtn.addEventListener('click', loginGoogle); els.emailBtn.addEventListener('click', loginEmail); els.logoutBtn.addEventListener('click', logout);
els.tripSelect.addEventListener('change', async () => { activeTripId = els.tripSelect.value; selectedDay = null; localStorage.setItem('activeTripId', activeTripId); await loadTripData(); });
function openTripDialog() { els.dialogTripTitle.value = ''; els.dialogStartDate.value = todayISO(); els.dialogEndDate.value = addDays(todayISO(), 3); els.tripDialog.showModal(); }
els.newTripBtn.addEventListener('click', openTripDialog); if (els.sidebarNewTripBtn) els.sidebarNewTripBtn.addEventListener('click', openTripDialog); if (els.viewItineraryBtn) els.viewItineraryBtn.addEventListener('click', () => document.getElementById('plannerTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
els.createTripConfirm.addEventListener('click', e => { e.preventDefault(); els.tripDialog.close(); createTrip({ title: els.dialogTripTitle.value, start_date: els.dialogStartDate.value, end_date: els.dialogEndDate.value }); });
els.deleteTripBtn.addEventListener('click', deleteTrip); ['tripTitle','startDate','endDate','destination','tripNotes'].forEach(k => els[k].addEventListener('input', queueTripSave));
els.addAnyItemBtn.addEventListener('click', () => openItemDialog(selectedDay)); els.saveItemBtn.addEventListener('click', saveItemFromDialog);
els.createInviteBtn.addEventListener('click', createInviteLink); els.copyInviteBtn.addEventListener('click', copyInviteLink);
setupLocationAutocomplete(els.destination, els.destinationSuggestions, els.destinationMapLinks);
setupLocationAutocomplete(els.itemLocation, els.itemLocationSuggestions, els.itemLocationMapLinks);
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

if (els.resetPackingBtn) els.resetPackingBtn.addEventListener('click', resetPackingItems);
if (els.snapMode) { els.snapMode.value = localStorage.getItem('timelineSnapMinutes') || '30'; els.snapMode.addEventListener('change', () => { localStorage.setItem('timelineSnapMinutes', els.snapMode.value); renderTimeline(); }); }
if (els.undoBtn) els.undoBtn.addEventListener('click', async () => { if (lastUndo) await lastUndo(); });

init();
