const SUPABASE_URL = 'https://cuhbzgeqvgzshwwfkpdm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Qm9pdRATY4QtAEpAJoBNtg_B0TfR1Uo';
const REDIRECT_TO = 'https://whatmod.com/track/';
const APP_URL = 'https://whatmod.com/track/';

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const els = {
  signedOut: document.getElementById('signedOut'), appArea: document.getElementById('appArea'), googleBtn: document.getElementById('googleBtn'),
  emailInput: document.getElementById('emailInput'), emailBtn: document.getElementById('emailBtn'), logoutBtn: document.getElementById('logoutBtn'),
  tripSelect: document.getElementById('tripSelect'), newTripBtn: document.getElementById('newTripBtn'), deleteTripBtn: document.getElementById('deleteTripBtn'), saveStatus: document.getElementById('saveStatus'), roleBadge: document.getElementById('roleBadge'),
  tripTitle: document.getElementById('tripTitle'), startDate: document.getElementById('startDate'), endDate: document.getElementById('endDate'), destination: document.getElementById('destination'), tripNotes: document.getElementById('tripNotes'),
  totalBudget: document.getElementById('totalBudget'), stopCount: document.getElementById('stopCount'), dayCount: document.getElementById('dayCount'), plannerTitle: document.getElementById('plannerTitle'), dayTabs: document.getElementById('dayTabs'), timeline: document.getElementById('timeline'),
  addAnyItemBtn: document.getElementById('addAnyItemBtn'), itemDialog: document.getElementById('itemDialog'), itemDialogTitle: document.getElementById('itemDialogTitle'), editingItemId: document.getElementById('editingItemId'),
  itemTitle: document.getElementById('itemTitle'), itemDate: document.getElementById('itemDate'), itemTime: document.getElementById('itemTime'), itemEndTime: document.getElementById('itemEndTime'), itemType: document.getElementById('itemType'), itemBudget: document.getElementById('itemBudget'), itemLocation: document.getElementById('itemLocation'), itemNotes: document.getElementById('itemNotes'), saveItemBtn: document.getElementById('saveItemBtn'),
  expandAllBtn: document.getElementById('expandAllBtn'), collapseAllBtn: document.getElementById('collapseAllBtn'), exportBtn: document.getElementById('exportBtn'), importInput: document.getElementById('importInput'),
  tripDialog: document.getElementById('tripDialog'), dialogTripTitle: document.getElementById('dialogTripTitle'), dialogStartDate: document.getElementById('dialogStartDate'), dialogEndDate: document.getElementById('dialogEndDate'), createTripConfirm: document.getElementById('createTripConfirm'),
  inviteRole: document.getElementById('inviteRole'), createInviteBtn: document.getElementById('createInviteBtn'), inviteOutput: document.getElementById('inviteOutput'), inviteLink: document.getElementById('inviteLink'), copyInviteBtn: document.getElementById('copyInviteBtn'), collabList: document.getElementById('collabList'),
  destinationSuggestions: document.getElementById('destinationSuggestions'), destinationMapLinks: document.getElementById('destinationMapLinks'), itemLocationSuggestions: document.getElementById('itemLocationSuggestions'), itemLocationMapLinks: document.getElementById('itemLocationMapLinks')
};

const typeIcon = { event: '🎟️', drive: '🚗', food: '🍽️', hotel: '🏨', gas: '⛽', todo: '✅' };
let session = null, trips = [], items = [], members = [], travelerProfiles = [], activeTripId = null, draggedId = null, autosaveTimer = null, selectedDay = null, pendingInviteToken = null;

const setStatus = m => els.saveStatus.textContent = m;
const money = n => Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const todayISO = () => new Date().toISOString().slice(0, 10);
function addDays(dateString, days) { const d = new Date(`${dateString}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function dateRange(start, end) { if (!start || !end) return []; if (end < start) end = start; const out = []; let cur = start; while (cur <= end && out.length < 90) { out.push(cur); cur = addDays(cur, 1); } return out; }
function fmtDate(d) { return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }); }
function fmtShortDate(d) { return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function fmtTime(t) { if (!t) return ''; const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m || 0, 0, 0); return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
function escapeHtml(str) { return String(str || '').replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }
function currentTrip() { return trips.find(t => t.id === activeTripId); }
function currentMembership() { return members.find(m => m.trip_id === activeTripId && m.user_id === session?.user?.id); }
function canEdit() { return ['owner', 'editor'].includes(currentMembership()?.role); }
function canDeleteTrip() { return currentMembership()?.role === 'owner'; }
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
  updateGreeting();
  const signedIn = !!session?.user;
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
async function loadTripData() { await Promise.all([loadItems(), loadMembers(), loadTravelerProfiles()]); setStatus('Ready'); render(); }
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
async function loadTravelerProfiles() {
  travelerProfiles = [];
  if (!activeTripId || !session?.user?.id) return;
  try {
    const { data, error } = await client.from('itinerary_user_profiles').select('*').eq('trip_id', activeTripId).order('updated_at', { ascending: false });
    if (error) throw error;
    travelerProfiles = data || [];
  } catch (err) {
    console.warn('Shared profile table unavailable; using local-only profile fallback.', err);
    const local = getLocalUserProfile();
    travelerProfiles = local ? [local] : [];
  }
}
async function upsertMyTravelerProfile(profile) {
  if (!activeTripId || !session?.user?.id) return;
  const payload = { ...profile, trip_id: activeTripId, user_id: session.user.id, updated_at: new Date().toISOString() };
  try {
    const { data, error } = await client.from('itinerary_user_profiles').upsert(payload, { onConflict: 'trip_id,user_id' }).select().single();
    if (error) throw error;
    travelerProfiles = [data, ...travelerProfiles.filter(p => p.user_id !== session.user.id)];
  } catch (err) {
    console.warn('Could not save shared profile; saving local-only fallback.', err);
    saveLocalUserProfile(payload);
    travelerProfiles = [payload, ...travelerProfiles.filter(p => p.user_id !== session.user.id)];
  }
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
  els.itemTime.value = item?.start_time || ''; els.itemEndTime.value = item?.end_time || ''; els.itemType.value = item?.item_type || 'event'; els.itemBudget.value = item?.budget || ''; els.itemLocation.value = item?.location || ''; els.itemNotes.value = item?.notes || '';
  renderMapLinks(els.itemLocationMapLinks, els.itemLocation.value);
  els.itemDialog.showModal(); setTimeout(() => els.itemTitle.focus(), 50);
}
async function saveItemFromDialog(e) {
  e.preventDefault(); if (!activeTripId || !canEdit()) return;
  const title = els.itemTitle.value.trim(); if (!title) return alert('Add a title first.');
  const payload = { title, item_date: els.itemDate.value || currentTrip()?.start_date || todayISO(), start_time: els.itemTime.value || null, end_time: els.itemEndTime.value || null, item_type: els.itemType.value, budget: Number(els.itemBudget.value || 0), location: els.itemLocation.value.trim(), notes: els.itemNotes.value.trim(), sort_order: Date.now(), updated_at: new Date().toISOString() };
  const id = els.editingItemId.value;
  if (id) {
    const { data, error } = await client.from('itinerary_items').update(payload).eq('id', id).select().single(); if (error) return showDbError(error); items = items.map(i => i.id === id ? data : i);
  } else {
    const { data, error } = await client.from('itinerary_items').insert({ ...payload, user_id: session.user.id, trip_id: activeTripId }).select().single(); if (error) return showDbError(error); items.push(data);
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

function render() { renderTripSelect(); renderTripEditor(); renderSummary(); renderSharePanel(); renderDayTabs(); renderTimeline(); }
function renderTripSelect() { els.tripSelect.innerHTML = trips.map(t => `<option value="${t.id}">${escapeHtml(t.title || 'Untitled trip')}</option>`).join(''); els.tripSelect.value = activeTripId || ''; }
function renderTripEditor() {
  const t = currentTrip(); if (!t) return; els.tripTitle.value = t.title || ''; els.startDate.value = t.start_date || ''; els.endDate.value = t.end_date || ''; els.destination.value = t.destination || ''; els.tripNotes.value = t.notes || ''; renderMapLinks(els.destinationMapLinks, t.destination || ''); selectedDay ||= t.start_date;
  const editable = canEdit();
  [els.tripTitle, els.startDate, els.endDate, els.destination, els.tripNotes, els.addAnyItemBtn, els.exportBtn, els.importInput].forEach(el => { if (el) el.disabled = !editable && el !== els.exportBtn; });
  els.deleteTripBtn.disabled = !canDeleteTrip();
}
function renderSummary() { const t = currentTrip(); const days = t ? dateRange(t.start_date, t.end_date) : []; els.totalBudget.textContent = money(items.reduce((sum, i) => sum + Number(i.budget || 0), 0)); els.stopCount.textContent = items.length; els.dayCount.textContent = days.length; els.plannerTitle.textContent = t ? `${t.title || 'Trip'} • ${days.length} day${days.length === 1 ? '' : 's'}` : 'Your itinerary'; const leftEl=document.getElementById('daysLeftHero'); if(leftEl && t){ const today=todayISO(); const left=Math.max(0, dateRange(today, t.end_date).length); leftEl.textContent=left; } }
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
    const card = document.createElement('section'); card.className = 'day-card glass'; card.dataset.date = day;
    card.innerHTML = `<div class="day-header"><div><p>Day ${days.indexOf(day) + 1}</p><strong>${fmtDate(day)}</strong></div><span>${dayItems.length} planned</span></div><div class="day-body"></div><button class="quick-add ghost-btn">+ Add to this day</button>`;
    const body = card.querySelector('.day-body');
    if (!dayItems.length) body.innerHTML = `<div class="empty-day"><strong>No plans yet</strong><p>Add a stop, drive block, hotel, food idea, or reminder for this day.</p></div>`;
    dayItems.forEach(item => body.appendChild(renderItem(item)));
    const quick = card.querySelector('.quick-add'); quick.disabled = !canEdit(); quick.addEventListener('click', () => openItemDialog(day));
    if (canEdit()) {
      body.addEventListener('dragover', e => { e.preventDefault(); body.classList.add('drag-over'); }); body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
      body.addEventListener('drop', async e => { e.preventDefault(); body.classList.remove('drag-over'); if (draggedId) await updateItem(draggedId, { item_date: day, sort_order: Date.now() }); draggedId = null; });
    }
    els.timeline.appendChild(card);
  });
}
function renderItem(item) {
  const tpl = document.getElementById('itemTemplate').content.cloneNode(true); const card = tpl.querySelector('.item-card'); card.dataset.id = item.id; card.draggable = canEdit();
  const time = [fmtTime(item.start_time), fmtTime(item.end_time)].filter(Boolean).join(' - ');
  tpl.querySelector('.time-chip').textContent = time || 'Anytime'; tpl.querySelector('.item-type').textContent = typeIcon[item.item_type] || '📌'; tpl.querySelector('h3').textContent = item.title;
  const meta = tpl.querySelector('.item-meta');
  const parts = [Number(item.budget || 0) ? money(item.budget) : '', item.item_type].filter(Boolean);
  meta.innerHTML = `${item.location ? `<a class="location-link" target="_blank" rel="noopener" href="${mapsUrl(item.location, 'google')}">📍 ${escapeHtml(item.location)}</a>${parts.length ? ' • ' : ''}` : ''}${escapeHtml(parts.join(' • '))}`; tpl.querySelector('.item-notes').textContent = item.notes || '';
  const editBtn = tpl.querySelector('.edit'); const delBtn = tpl.querySelector('.delete'); editBtn.disabled = delBtn.disabled = !canEdit();
  editBtn.addEventListener('click', () => openItemDialog(item.item_date, item)); delBtn.addEventListener('click', () => deleteItem(item.id));
  if (canEdit()) { card.addEventListener('dragstart', () => { draggedId = item.id; card.classList.add('dragging'); }); card.addEventListener('dragend', () => card.classList.remove('dragging')); }
  return tpl;
}
function exportJson() { const data = { trip: currentTrip(), items }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${currentTrip()?.title || 'trip'}-itinerary.json`; a.click(); URL.revokeObjectURL(a.href); }
async function importJson(file) { if (!canEdit()) return; const parsed = JSON.parse(await file.text()); if (!parsed?.items?.length) return alert('No items found in JSON.'); const newItems = parsed.items.map(i => ({ user_id: session.user.id, trip_id: activeTripId, title: i.title, item_date: i.item_date, start_time: i.start_time, end_time: i.end_time, item_type: i.item_type || 'event', budget: Number(i.budget || 0), location: i.location || '', notes: i.notes || '', sort_order: i.sort_order || Date.now() })); const { error } = await client.from('itinerary_items').insert(newItems); if (error) return showDbError(error); await loadTripData(); }

els.googleBtn.addEventListener('click', loginGoogle); els.emailBtn.addEventListener('click', loginEmail); els.logoutBtn.addEventListener('click', logout);
els.tripSelect.addEventListener('change', async () => { activeTripId = els.tripSelect.value; selectedDay = null; localStorage.setItem('activeTripId', activeTripId); await loadTripData(); });
els.newTripBtn.addEventListener('click', () => { els.dialogTripTitle.value = ''; els.dialogStartDate.value = todayISO(); els.dialogEndDate.value = addDays(todayISO(), 3); els.tripDialog.showModal(); });
els.createTripConfirm.addEventListener('click', e => { e.preventDefault(); els.tripDialog.close(); createTrip({ title: els.dialogTripTitle.value, start_date: els.dialogStartDate.value, end_date: els.dialogEndDate.value }); });
els.deleteTripBtn.addEventListener('click', deleteTrip); ['tripTitle','startDate','endDate','destination','tripNotes'].forEach(k => els[k].addEventListener('input', queueTripSave));
els.addAnyItemBtn.addEventListener('click', () => openItemDialog(selectedDay)); els.saveItemBtn.addEventListener('click', saveItemFromDialog);
els.createInviteBtn.addEventListener('click', createInviteLink); els.copyInviteBtn.addEventListener('click', copyInviteLink);
setupLocationAutocomplete(els.destination, els.destinationSuggestions, els.destinationMapLinks);
setupLocationAutocomplete(els.itemLocation, els.itemLocationSuggestions, els.itemLocationMapLinks);
els.expandAllBtn.addEventListener('click', () => { document.body.classList.add('show-all-days'); renderTimeline(); }); els.collapseAllBtn.addEventListener('click', () => { document.body.classList.remove('show-all-days'); renderTimeline(); });
els.exportBtn.addEventListener('click', exportJson); els.importInput.addEventListener('change', e => e.target.files[0] && importJson(e.target.files[0]));
// --- Adventure Suite: cache-busted feature layer (local, non-breaking Supabase-safe storage) ---
const ADVENTURE_VERSION = '20260622-profile-v4';
const restaurantOptions = [
  { name: 'Waterfront brunch', tags: ['brunch','waterfront','casual','family friendly','coffee','cute casual'], price: '$$' },
  { name: 'Lakefront dinner', tags: ['romantic','waterfront','steak','seafood','fancy','date night'], price: '$$$' },
  { name: 'Ice cream walk', tags: ['dessert','casual','kid friendly','cheap','walk','cute casual'], price: '$' },
  { name: 'Cozy coffee date', tags: ['coffee','quiet','casual','dessert','conversation'], price: '$' },
  { name: 'Italian date night', tags: ['italian','romantic','quiet','dinner','pasta'], price: '$$' },
  { name: 'Burger + fries stop', tags: ['burgers','casual','kid friendly','cheap'], price: '$$' },
  { name: 'Breakfast at a local diner', tags: ['breakfast','brunch','coffee','casual','cheap','family friendly'], price: '$$' },
  { name: 'Sushi or Asian dinner', tags: ['asian','sushi','dinner','adventurous','date night'], price: '$$' },
  { name: 'Pizza and movie night', tags: ['pizza','casual','comfort','quiet','low key'], price: '$$' },
  { name: 'Dessert-only date stop', tags: ['dessert','sweet','cute casual','cheap','romantic'], price: '$' },
  { name: 'Outdoor patio lunch', tags: ['outdoor','patio','casual','waterfront','lunch'], price: '$$' },
  { name: 'Family-friendly quick bite', tags: ['family friendly','kid friendly','quick','casual','toddler'], price: '$$' }
];
const baseChallenges = [
  'Selfie near water','Ice cream photo','Funny candid','Sunset picture','Local food pic','One cute photo together','Toddler day memory','Random hidden gem',
  'Coffee toast photo','Matching smiles photo','Lake view photo','Outfit check','A tiny souvenir photo','Best meal photo','Something purple','Sweetest moment of the day'
];
function adventureKey() { return `itinAdventure:${activeTripId || 'no-trip'}:${session?.user?.id || 'guest'}:${ADVENTURE_VERSION}`; }
function defaultAdventureState() {
  return { toddler: false, weather: 'sunny', moods: [], memories: [], challenges: baseChallenges.map((title,i)=>({id:`c${i}`,title,done:false})) };
}
function getAdventureState() { try { return { ...defaultAdventureState(), ...(JSON.parse(localStorage.getItem(adventureKey())) || {}) }; } catch { return defaultAdventureState(); } }
function saveAdventureState(s) { localStorage.setItem(adventureKey(), JSON.stringify(s)); }
function profileStorageKey() { return `itinUserProfile:${activeTripId || 'no-trip'}:${session?.user?.id || 'guest'}:${ADVENTURE_VERSION}`; }
function getLocalUserProfile() { try { return JSON.parse(localStorage.getItem(profileStorageKey()) || 'null'); } catch { return null; } }
function saveLocalUserProfile(p) { localStorage.setItem(profileStorageKey(), JSON.stringify(p)); }
function defaultMyProfile() {
  return { display_name: displayNameFromSession(), photo_url: userPhotoFromSession(), likes: '', avoids: '', budget: '$$', vibe: 'cute casual', interests: '' };
}
function myProfile() {
  return travelerProfiles.find(p => p.user_id === session?.user?.id) || getLocalUserProfile() || defaultMyProfile();
}
function sharedProfiles() {
  const byUser = new Map();
  travelerProfiles.forEach(p => { if (p?.user_id) byUser.set(p.user_id, p); });
  const mine = myProfile();
  if (mine?.user_id || session?.user?.id) byUser.set(mine.user_id || session.user.id, { ...mine, user_id: mine.user_id || session.user.id });
  return [...byUser.values()];
}
function combinedProfileForScoring() {
  const profiles = sharedProfiles();
  return {
    likes: profiles.flatMap(p => words(`${p.likes || ''},${p.interests || ''}`)),
    avoids: profiles.flatMap(p => words(p.avoids || '')),
    budget: myProfile().budget || '$$',
    vibe: profiles.map(p => p.vibe).filter(Boolean).join(', ')
  };
}
function words(v) { return String(v || '').toLowerCase().split(/[,\n]/).map(x=>x.trim()).filter(Boolean); }
function scoreRestaurant(r, _p) {
  const p = combinedProfileForScoring();
  const likes = p.likes || [];
  const avoids = p.avoids || [];
  let score = 62;
  r.tags.forEach(t => { if (likes.some(l => t.includes(l) || l.includes(t))) score += 8; if (avoids.some(a => t.includes(a) || a.includes(t))) score -= 18; });
  if (r.price === p.budget) score += 8;
  if (p.vibe && r.tags.some(t => p.vibe.toLowerCase().includes(t) || t.includes(p.vibe.toLowerCase()))) score += 10;
  return Math.max(15, Math.min(99, score));
}

function displayNameFromSession() {
  const meta = session?.user?.user_metadata || {};
  return meta.full_name || meta.name || meta.preferred_username || session?.user?.email?.split('@')[0] || '';
}
function updateGreeting() {
  const el = document.getElementById('greetingLine');
  if (!el) return;
  const firstName = String(displayNameFromSession()).trim().split(/\s+/)[0];
  const t = currentTrip();
  const destination = (t?.destination || '').split(',')[0].trim();
  if (firstName && destination) el.textContent = `Good morning, ${firstName}! ☀️ Ready for your ${destination} adventure?`;
  else if (firstName) el.textContent = `Good morning, ${firstName}! ☀️ Ready for your next adventure?`;
  else el.textContent = 'Good morning! ☀️ Ready for your next adventure?';
}
function migrateProfiles(st) { return st; }
function updateProfileLabels(p={}) { }

function renderAdventure() {
  updateGreeting();
  if (!document.getElementById('weatherSuggestions') || !activeTripId) return;
  const s = getAdventureState(); renderSharedProfileSummary();
  const mood = document.getElementById('weatherMood'); const toddler = document.getElementById('toddlerToggle');
  if (mood) mood.value = s.weather; if (toddler) toddler.checked = !!s.toddler;
  renderWeatherIdeas(s); renderRestaurantMatches(s); renderMoods(s); renderChallenges(s); renderMemories(s); updateProfilePreview();
}
function renderWeatherIdeas(s) {
  const pool = {
    sunny: ['Pewaukee Lake walk','Beach / splash time','Outdoor brunch','Sunset photo challenge','Patio lunch','Mini adventure walk','Golden hour photos','Lakefront picnic'],
    rainy: ['Cozy coffee date','Indoor lunch','Shopping stop','Movie / low-key reset','Dessert cafe','Bookstore or boutique browse','Hotel reset + snacks','Board/card game break'],
    cold: ['Warm dessert stop','Scenic drive','Coffee + deep conversation','Indoor toddler play','Soup or comfort food','Cute souvenir stop','Indoor photo challenge','Early cozy dinner'],
    hot: ['Ice cream break','Splash pad / beach','Early dinner','Evening lake walk','Shaded park stop','Cold drinks + snack','Morning activity then nap','Sunset-only outing']
  };
  let ideas = [...(pool[s.weather] || pool.sunny)];
  if (s.toddler) ideas = ['Nap window reminder','Stroller-friendly walk','Playground stop','Diaper bag check','Snack + water reset','Short activity under 60 minutes', ...ideas.filter(x=>!/(bar|brewery|late)/i.test(x))];
  document.getElementById('weatherSuggestions').innerHTML = ideas.slice(0,10).map(x=>`<button class="chip-action" data-add="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join('');
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>openItemDialog(selectedDay, { title:b.dataset.add, item_type:s.toddler?'todo':'event', item_date:selectedDay, notes:s.toddler?'Toddler-friendly suggestion.':'Weather-aware suggestion.' }));
}
function renderRestaurantMatches(s) {
  const list = restaurantOptions.map(r=>({ ...r, score:scoreRestaurant(r) })).sort((a,b)=>b.score-a.score).slice(0,4);
  document.getElementById('restaurantMatches').innerHTML = list.map(r=>`<div class="match-row"><strong>${escapeHtml(r.name)}</strong><span>${r.score}% Match • ${r.price}</span><button class="ghost-btn tiny" data-food="${escapeHtml(r.name)}">Plan</button></div>`).join('');
  document.querySelectorAll('[data-food]').forEach(b=>b.onclick=()=>openItemDialog(selectedDay,{title:b.dataset.food,item_type:'food',item_date:selectedDay,notes:'Added from restaurant match score.'}));
}
function renderMoods(s) { document.getElementById('moodList').innerHTML = s.moods.slice(-4).reverse().map(m=>`<div class="mini-row"><strong>${escapeHtml(m.rating)}</strong><span>${escapeHtml(m.title)} • ${fmtShortDate(m.date)}</span></div>`).join('') || '<p class="helper-text">No mood check-ins yet.</p>'; }
function renderChallenges(s) {
  const done = s.challenges.filter(c=>c.done).length; const xp = done * 120;
  document.getElementById('challengeStats').innerHTML = `<strong>${xp} XP</strong><span>${done}/${s.challenges.length} complete</span>`;
  document.getElementById('challengeList').innerHTML = s.challenges.map(c=>`<label class="challenge-row"><input type="checkbox" data-challenge="${c.id}" ${c.done?'checked':''}/> ${escapeHtml(c.title)}</label>`).join('');
  document.querySelectorAll('[data-challenge]').forEach(cb=>cb.onchange=()=>{ const st=getAdventureState(); const ch=st.challenges.find(x=>x.id===cb.dataset.challenge); if(ch) ch.done=cb.checked; saveAdventureState(st); renderAdventure(); });
}
function renderMemories(s) { document.getElementById('memoryList').innerHTML = s.memories.slice(-5).reverse().map(m=>`<div class="memory-row"><strong>${escapeHtml(m.title)}</strong><span>${escapeHtml(m.rating)} • ${fmtShortDate(m.date)}</span><p>${escapeHtml(m.details || '')}</p></div>`).join('') || '<p class="helper-text">Add favorite moments as they happen.</p>'; }
function openQuickDialog(type) {
  const titleMap = { mood:'Add Mood Check-In', memory:'Add Shared Memory', challenge:'Add Photo Challenge' };
  document.getElementById('quickDialogTitle').textContent = titleMap[type] || 'Add';
  document.getElementById('quickFeatureType').value = type;
  document.getElementById('quickTitle').value = type === 'mood' ? 'Today felt...' : '';
  document.getElementById('quickDetails').value = '';
  document.getElementById('quickDate').value = selectedDay || todayISO();
  document.getElementById('quickFeatureDialog').showModal();
}
function saveQuickFeature(e) {
  e.preventDefault(); const st=getAdventureState(); const type=document.getElementById('quickFeatureType').value;
  const entry={ id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title:document.getElementById('quickTitle').value.trim() || 'Untitled', details:document.getElementById('quickDetails').value.trim(), date:document.getElementById('quickDate').value || todayISO(), rating:document.getElementById('quickRating').value };
  if (type === 'mood') st.moods.push(entry); else if (type === 'memory') st.memories.push(entry); else if (type === 'challenge') st.challenges.push({ id:entry.id, title:entry.title, done:false });
  saveAdventureState(st); document.getElementById('quickFeatureDialog').close(); renderAdventure();
}
function openProfileDialog() { const s=getAdventureState(); migrateProfiles(s); ['profileOneName','profileTwoName','profileOneLikes','profileTwoLikes','profileOneAvoids','profileTwoAvoids'].forEach(k=>{ const el=document.getElementById(k); if(el) el.value=s.profiles[k]||''; }); updateProfileLabels(s.profiles); document.getElementById('budgetComfort').value=s.profiles.budget||'$$'; const vibe=document.getElementById('profileVibe'); if(vibe) vibe.value=s.profiles.vibe||'cute casual'; document.getElementById('profileDialog').showModal(); }
function saveProfiles(e) { e.preventDefault(); const st=getAdventureState(); st.profiles={ profileOneName:profileOneName.value.trim(), profileTwoName:profileTwoName.value.trim(), profileOneLikes:profileOneLikes.value, profileTwoLikes:profileTwoLikes.value, profileOneAvoids:profileOneAvoids.value, profileTwoAvoids:profileTwoAvoids.value, budget:budgetComfort.value, vibe:(document.getElementById('profileVibe')?.value||'cute casual') }; saveAdventureState(st); profileDialog.close(); renderAdventure(); updateGreeting(); }
function spinSurprise() {
  const st=getAdventureState();
  const weatherPools = {
    sunny:['Walk by Pewaukee Lake','Find a lakefront bench','Take golden-hour photos','Grab ice cream and wander','Do a mini photo challenge','Pick a random park nearby'],
    rainy:['Coffee and conversation','Dessert somewhere cozy','Drive to a cute shop','Movie or hotel snack reset','Indoor lunch roulette','Make a tiny memory note'],
    cold:['Warm drinks stop','Scenic drive with music','Comfort food date','Indoor browsing stop','Early cozy dinner'],
    hot:['Cold drink run','Splash pad or shaded park','Ice cream break','Sunset-only walk','Quick lunch somewhere cool']
  };
  const toddlerIdeas = ['Toddler-friendly playground stop','Snack + stroller walk','Nap-window reset','Find a splash pad','Short 45-minute outing','Diaper bag and water check','Simple picnic with shade'];
  const dateIdeas = ['Ask one fun question each','Pick dessert before dinner','Take a cute selfie together','Find a random local shop','Choose the prettiest view nearby','Tiny souvenir hunt','Slow walk and no phones for 20 minutes'];
  const foodIdeas = restaurantOptions.map(r=>r.name);
  const plannedIdeas = items.map(i=>i.title).filter(Boolean);
  let ideas = [...(weatherPools[st.weather] || weatherPools.sunny), ...dateIdeas, ...foodIdeas, ...plannedIdeas];
  if (st.toddler) ideas = [...toddlerIdeas, ...ideas.filter(x=>!/(late|bar|brewery|cocktail)/i.test(x))];
  ideas = [...new Set(ideas.filter(Boolean))];
  const last = st.lastSurprise || '';
  let pick = ideas[Math.floor(Math.random()*ideas.length)] || 'Go make a memory';
  if (ideas.length > 1) while (pick === last) pick = ideas[Math.floor(Math.random()*ideas.length)];
  st.lastSurprise = pick; saveAdventureState(st);
  document.getElementById('surpriseResult').innerHTML = `<strong>🎉 ${escapeHtml(pick)}</strong><small>Based on your profile, trip plans, weather mode, and toddler setting.</small>`;
}
function generateRecap() {
  const st=getAdventureState(); const t=currentTrip(); const days=t?dateRange(t.start_date,t.end_date).length:0; const done=st.challenges.filter(c=>c.done).length;
  const fav=st.memories[st.memories.length-1]?.title || items[0]?.title || 'Your favorite moment is waiting to happen';
  const text=`${(t?.title || 'PEWAUKEE 2026').toUpperCase()}\n\n${days} Days\n${items.length} Planned Activities\n${money(items.reduce((a,i)=>a+Number(i.budget||0),0))} Budgeted\n${st.memories.length} Shared Memories\n${st.moods.length} Mood Check-Ins\n${done}/${st.challenges.length} Photo Challenges Complete\nAdventure Score: ${done*120} XP\n\nTop Memory:\n${fav}\n\nBuilt for your shared adventure ✨`;
  const out=document.getElementById('recapOutput'); out.textContent=text; out.classList.remove('hidden');
}

function userPhotoFromSession() { return session?.user?.user_metadata?.avatar_url || session?.user?.user_metadata?.picture || ''; }
function initialsFromName(name) { const clean=String(name||'').trim(); if(!clean) return '?'; return clean.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join(''); }
function updateProfilePreview() {
  const p = myProfile();
  const name = p.display_name || displayNameFromSession() || 'Profile';
  const img = document.getElementById('userAvatarImg');
  const initials = document.getElementById('userAvatarInitials');
  const label = document.getElementById('profileNameChip');
  const photo = userPhotoFromSession();
  if (label) label.textContent = String(name).trim().split(/\s+/)[0] || 'Profile';
  if (initials) initials.textContent = initialsFromName(name);
  if (img) {
    if (photo) { img.src = photo; img.classList.remove('hidden'); initials?.classList.add('hidden'); }
    else { img.removeAttribute('src'); img.classList.add('hidden'); initials?.classList.remove('hidden'); }
  }
  const tc = document.getElementById('travelerCount'); if (tc) tc.textContent = Math.max(1, members.length || 1);
}
function toggleProfileDropdown(force) {
  const menu = document.getElementById('profileDropdown'); if (!menu) return;
  menu.classList.toggle('hidden', typeof force === 'boolean' ? !force : !menu.classList.contains('hidden'));
}

const originalRender = render;
render = function(){ originalRender(); renderAdventure(); };
document.getElementById('weatherMood')?.addEventListener('change', e=>{ const s=getAdventureState(); s.weather=e.target.value; saveAdventureState(s); renderAdventure(); });
document.getElementById('toddlerToggle')?.addEventListener('change', e=>{ const s=getAdventureState(); s.toddler=e.target.checked; saveAdventureState(s); renderAdventure(); });
document.getElementById('weatherRefreshBtn')?.addEventListener('click', renderAdventure);
document.getElementById('surpriseBtn')?.addEventListener('click', spinSurprise);
document.getElementById('profileBtn')?.addEventListener('click', openProfileDialog);
document.getElementById('userAvatarBtn')?.addEventListener('click', (e)=>{ e.stopPropagation(); toggleProfileDropdown(); });
document.getElementById('profileMenuBtn')?.addEventListener('click', ()=>{ toggleProfileDropdown(false); openProfileDialog(); });
document.getElementById('profileMenuStyleBtn')?.addEventListener('click', ()=>{ toggleProfileDropdown(false); openProfileDialog(); });
document.getElementById('profileMenuLogoutBtn')?.addEventListener('click', logout);
document.addEventListener('click', e=>{ const menu=document.getElementById('profileDropdown'); const btn=document.getElementById('userAvatarBtn'); if(menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hidden'); });
document.getElementById('newTripBtnSidebar')?.addEventListener('click', ()=>els.newTripBtn?.click());
document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfiles);
document.getElementById('moodBtn')?.addEventListener('click', ()=>openQuickDialog('mood'));
document.getElementById('memoryBtn')?.addEventListener('click', ()=>openQuickDialog('memory'));
document.getElementById('challengeAddBtn')?.addEventListener('click', ()=>openQuickDialog('challenge'));
document.getElementById('saveQuickBtn')?.addEventListener('click', saveQuickFeature);
document.getElementById('recapBtn')?.addEventListener('click', generateRecap);

init();
