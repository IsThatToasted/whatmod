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
  inviteRole: document.getElementById('inviteRole'), createInviteBtn: document.getElementById('createInviteBtn'), inviteOutput: document.getElementById('inviteOutput'), inviteLink: document.getElementById('inviteLink'), copyInviteBtn: document.getElementById('copyInviteBtn'), collabList: document.getElementById('collabList')
};

const typeIcon = { event: '🎟️', drive: '🚗', food: '🍽️', hotel: '🏨', gas: '⛽', todo: '✅' };
let session = null, trips = [], items = [], members = [], activeTripId = null, draggedId = null, autosaveTimer = null, selectedDay = null, pendingInviteToken = null;

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
async function loadTripData() { await Promise.all([loadItems(), loadMembers()]); setStatus('Ready'); render(); }
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
  const t = currentTrip(); if (!t) return; els.tripTitle.value = t.title || ''; els.startDate.value = t.start_date || ''; els.endDate.value = t.end_date || ''; els.destination.value = t.destination || ''; els.tripNotes.value = t.notes || ''; selectedDay ||= t.start_date;
  const editable = canEdit();
  [els.tripTitle, els.startDate, els.endDate, els.destination, els.tripNotes, els.addAnyItemBtn, els.exportBtn, els.importInput].forEach(el => { if (el) el.disabled = !editable && el !== els.exportBtn; });
  els.deleteTripBtn.disabled = !canDeleteTrip();
}
function renderSummary() { const t = currentTrip(); const days = t ? dateRange(t.start_date, t.end_date) : []; els.totalBudget.textContent = money(items.reduce((sum, i) => sum + Number(i.budget || 0), 0)); els.stopCount.textContent = items.length; els.dayCount.textContent = days.length; els.plannerTitle.textContent = t ? `${t.title || 'Trip'} • ${days.length} day${days.length === 1 ? '' : 's'}` : 'Your itinerary'; }
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
  const parts = [item.location, Number(item.budget || 0) ? money(item.budget) : '', item.item_type].filter(Boolean); tpl.querySelector('.item-meta').textContent = parts.join(' • '); tpl.querySelector('.item-notes').textContent = item.notes || '';
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
els.expandAllBtn.addEventListener('click', () => { document.body.classList.add('show-all-days'); renderTimeline(); }); els.collapseAllBtn.addEventListener('click', () => { document.body.classList.remove('show-all-days'); renderTimeline(); });
els.exportBtn.addEventListener('click', exportJson); els.importInput.addEventListener('change', e => e.target.files[0] && importJson(e.target.files[0]));
init();
