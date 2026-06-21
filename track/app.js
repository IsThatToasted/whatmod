const SUPABASE_URL = 'https://cuhbzgeqvgzshwwfkpdm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Qm9pdRATY4QtAEpAJoBNtg_B0TfR1Uo';
const REDIRECT_TO = 'https://whatmod.com/track/';

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const els = {
  signedOut: document.getElementById('signedOut'),
  appArea: document.getElementById('appArea'),
  googleBtn: document.getElementById('googleBtn'),
  emailInput: document.getElementById('emailInput'),
  emailBtn: document.getElementById('emailBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  tripSelect: document.getElementById('tripSelect'),
  newTripBtn: document.getElementById('newTripBtn'),
  deleteTripBtn: document.getElementById('deleteTripBtn'),
  saveStatus: document.getElementById('saveStatus'),
  tripTitle: document.getElementById('tripTitle'),
  startDate: document.getElementById('startDate'),
  endDate: document.getElementById('endDate'),
  destination: document.getElementById('destination'),
  tripNotes: document.getElementById('tripNotes'),
  totalBudget: document.getElementById('totalBudget'),
  stopCount: document.getElementById('stopCount'),
  dayCount: document.getElementById('dayCount'),
  itemTitle: document.getElementById('itemTitle'),
  itemDate: document.getElementById('itemDate'),
  itemTime: document.getElementById('itemTime'),
  itemEndTime: document.getElementById('itemEndTime'),
  itemType: document.getElementById('itemType'),
  itemBudget: document.getElementById('itemBudget'),
  itemLocation: document.getElementById('itemLocation'),
  itemNotes: document.getElementById('itemNotes'),
  addItemBtn: document.getElementById('addItemBtn'),
  timeline: document.getElementById('timeline'),
  expandAllBtn: document.getElementById('expandAllBtn'),
  collapseAllBtn: document.getElementById('collapseAllBtn'),
  exportBtn: document.getElementById('exportBtn'),
  importInput: document.getElementById('importInput'),
  tripDialog: document.getElementById('tripDialog'),
  dialogTripTitle: document.getElementById('dialogTripTitle'),
  dialogStartDate: document.getElementById('dialogStartDate'),
  dialogEndDate: document.getElementById('dialogEndDate'),
  createTripConfirm: document.getElementById('createTripConfirm'),
};

const typeIcon = { event: '🎟️', drive: '🚗', food: '🍽️', hotel: '🏨', gas: '⛽', todo: '✅' };
let session = null;
let trips = [];
let items = [];
let activeTripId = null;
let draggedId = null;
let autosaveTimer = null;

function setStatus(message) { els.saveStatus.textContent = message; }
function money(n) { return Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' }); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDays(dateString, days) {
  const d = new Date(`${dateString}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function dateRange(start, end) {
  if (!start || !end) return [];
  const out = [];
  let current = start;
  while (current <= end && out.length < 60) { out.push(current); current = addDays(current, 1); }
  return out;
}
function fmtDate(dateString) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date(); d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

async function init() {
  const { data } = await client.auth.getSession();
  session = data.session;
  client.auth.onAuthStateChange((_event, newSession) => { session = newSession; refreshAuthUI(); if (session) loadTrips(); });
  refreshAuthUI();
  if (session) await loadTrips();
}

function refreshAuthUI() {
  const signedIn = !!session?.user;
  els.signedOut.classList.toggle('hidden', signedIn);
  els.appArea.classList.toggle('hidden', !signedIn);
  els.googleBtn.classList.toggle('hidden', signedIn);
  document.querySelector('.email-login').classList.toggle('hidden', signedIn);
  els.logoutBtn.classList.toggle('hidden', !signedIn);
}

async function loginGoogle() {
  await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: REDIRECT_TO } });
}
async function loginEmail() {
  const email = els.emailInput.value.trim();
  if (!email) return alert('Enter your email first.');
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: REDIRECT_TO } });
  if (error) return alert(error.message);
  alert('Magic link sent. Check your email.');
}
async function logout() { await client.auth.signOut(); trips = []; items = []; activeTripId = null; render(); }

async function loadTrips() {
  setStatus('Loading...');
  const { data, error } = await client.from('itinerary_trips').select('*').order('start_date', { ascending: true });
  if (error) return showDbError(error);
  trips = data || [];
  if (!trips.length) await createTrip({ title: 'My Trip', start_date: todayISO(), end_date: addDays(todayISO(), 3) });
  activeTripId = localStorage.getItem('activeTripId') || trips[0]?.id;
  if (!trips.find(t => t.id === activeTripId)) activeTripId = trips[0]?.id;
  await loadItems();
}
async function loadItems() {
  if (!activeTripId) return;
  const { data, error } = await client.from('itinerary_items').select('*').eq('trip_id', activeTripId).order('item_date').order('start_time');
  if (error) return showDbError(error);
  items = data || [];
  setStatus('Ready');
  render();
}
function showDbError(error) {
  console.error(error);
  alert(`${error.message}\n\nIf this is your first install, run schema.sql in Supabase SQL Editor first.`);
  setStatus('Database setup needed');
}

async function createTrip(input) {
  const payload = { user_id: session.user.id, title: input.title || 'New trip', start_date: input.start_date || todayISO(), end_date: input.end_date || input.start_date || todayISO(), destination: '', notes: '' };
  const { data, error } = await client.from('itinerary_trips').insert(payload).select().single();
  if (error) return showDbError(error);
  trips.push(data); activeTripId = data.id; localStorage.setItem('activeTripId', activeTripId); await loadItems();
}
async function deleteTrip() {
  if (!activeTripId || !confirm('Delete this entire trip and all itinerary items?')) return;
  const { error } = await client.from('itinerary_trips').delete().eq('id', activeTripId);
  if (error) return showDbError(error);
  trips = trips.filter(t => t.id !== activeTripId);
  activeTripId = trips[0]?.id || null;
  if (!activeTripId) await createTrip({ title: 'My Trip', start_date: todayISO(), end_date: addDays(todayISO(), 3) });
  else await loadItems();
}

function queueTripSave() {
  clearTimeout(autosaveTimer);
  setStatus('Saving...');
  autosaveTimer = setTimeout(saveTrip, 550);
}
async function saveTrip() {
  const trip = currentTrip(); if (!trip) return;
  const patch = { title: els.tripTitle.value.trim() || 'Untitled trip', start_date: els.startDate.value, end_date: els.endDate.value, destination: els.destination.value.trim(), notes: els.tripNotes.value.trim(), updated_at: new Date().toISOString() };
  const { data, error } = await client.from('itinerary_trips').update(patch).eq('id', trip.id).select().single();
  if (error) return showDbError(error);
  trips = trips.map(t => t.id === data.id ? data : t);
  setStatus('Saved');
  renderTripSelect(); renderSummary();
}

async function addItem() {
  if (!activeTripId) return;
  const title = els.itemTitle.value.trim();
  if (!title) return alert('Add a title first.');
  const payload = {
    user_id: session.user.id,
    trip_id: activeTripId,
    title,
    item_date: els.itemDate.value || currentTrip()?.start_date || todayISO(),
    start_time: els.itemTime.value || null,
    end_time: els.itemEndTime.value || null,
    item_type: els.itemType.value,
    budget: Number(els.itemBudget.value || 0),
    location: els.itemLocation.value.trim(),
    notes: els.itemNotes.value.trim(),
    sort_order: Date.now()
  };
  const { data, error } = await client.from('itinerary_items').insert(payload).select().single();
  if (error) return showDbError(error);
  items.push(data);
  clearComposer(); render();
}
async function updateItem(id, patch) {
  const { data, error } = await client.from('itinerary_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) return showDbError(error);
  items = items.map(i => i.id === id ? data : i); render();
}
async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  const { error } = await client.from('itinerary_items').delete().eq('id', id);
  if (error) return showDbError(error);
  items = items.filter(i => i.id !== id); render();
}
function editItem(item) {
  const title = prompt('Title', item.title); if (title === null) return;
  const date = prompt('Date YYYY-MM-DD', item.item_date); if (date === null) return;
  const start_time = prompt('Start time HH:MM, blank for none', item.start_time || ''); if (start_time === null) return;
  const end_time = prompt('End time HH:MM, blank for none', item.end_time || ''); if (end_time === null) return;
  const budget = prompt('Budget', item.budget || 0); if (budget === null) return;
  const location = prompt('Location', item.location || ''); if (location === null) return;
  const notes = prompt('Notes', item.notes || ''); if (notes === null) return;
  updateItem(item.id, { title, item_date: date, start_time: start_time || null, end_time: end_time || null, budget: Number(budget || 0), location, notes });
}
function clearComposer() { ['itemTitle','itemTime','itemEndTime','itemBudget','itemLocation','itemNotes'].forEach(k => els[k].value = ''); }

function currentTrip() { return trips.find(t => t.id === activeTripId); }
function render() { renderTripSelect(); renderTripEditor(); renderSummary(); renderTimeline(); }
function renderTripSelect() {
  els.tripSelect.innerHTML = trips.map(t => `<option value="${t.id}">${escapeHtml(t.title || 'Untitled trip')}</option>`).join('');
  els.tripSelect.value = activeTripId || '';
}
function renderTripEditor() {
  const t = currentTrip(); if (!t) return;
  els.tripTitle.value = t.title || '';
  els.startDate.value = t.start_date || '';
  els.endDate.value = t.end_date || '';
  els.destination.value = t.destination || '';
  els.tripNotes.value = t.notes || '';
  els.itemDate.value ||= t.start_date || todayISO();
}
function renderSummary() {
  const t = currentTrip();
  els.totalBudget.textContent = money(items.reduce((sum, i) => sum + Number(i.budget || 0), 0));
  els.stopCount.textContent = items.length;
  els.dayCount.textContent = t ? dateRange(t.start_date, t.end_date).length : 0;
}
function renderTimeline() {
  const t = currentTrip();
  if (!t) { els.timeline.innerHTML = ''; return; }
  const days = dateRange(t.start_date, t.end_date);
  els.timeline.innerHTML = '';
  days.forEach(day => {
    const dayItems = items.filter(i => i.item_date === day).sort((a,b) => `${a.start_time || '99:99'}-${a.sort_order}`.localeCompare(`${b.start_time || '99:99'}-${b.sort_order}`));
    const card = document.createElement('section');
    card.className = 'day-card glass';
    card.dataset.date = day;
    card.innerHTML = `<button class="day-header"><strong>${fmtDate(day)}</strong><span>${dayItems.length} item${dayItems.length === 1 ? '' : 's'}</span></button><div class="day-body"></div>`;
    const body = card.querySelector('.day-body');
    dayItems.forEach(item => body.appendChild(renderItem(item)));
    body.addEventListener('dragover', e => { e.preventDefault(); body.classList.add('drag-over'); });
    body.addEventListener('drop', async e => { e.preventDefault(); if (draggedId) await updateItem(draggedId, { item_date: day, sort_order: Date.now() }); draggedId = null; });
    card.querySelector('.day-header').addEventListener('click', () => card.classList.toggle('collapsed'));
    els.timeline.appendChild(card);
  });
}
function renderItem(item) {
  const tpl = document.getElementById('itemTemplate').content.cloneNode(true);
  const card = tpl.querySelector('.item-card');
  card.dataset.id = item.id;
  tpl.querySelector('.item-type').textContent = typeIcon[item.item_type] || '📌';
  tpl.querySelector('h3').textContent = item.title;
  const time = [fmtTime(item.start_time), fmtTime(item.end_time)].filter(Boolean).join(' - ');
  const parts = [time, item.location, Number(item.budget || 0) ? money(item.budget) : '', item.item_type].filter(Boolean);
  tpl.querySelector('.item-meta').textContent = parts.join(' • ');
  tpl.querySelector('.item-notes').textContent = item.notes || '';
  tpl.querySelector('.edit').addEventListener('click', () => editItem(item));
  tpl.querySelector('.delete').addEventListener('click', () => deleteItem(item.id));
  card.addEventListener('dragstart', () => { draggedId = item.id; card.classList.add('dragging'); });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  return tpl;
}
function escapeHtml(str) { return String(str).replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[s])); }

function exportJson() {
  const data = { trip: currentTrip(), items };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${currentTrip()?.title || 'trip'}-itinerary.json`; a.click(); URL.revokeObjectURL(a.href);
}
async function importJson(file) {
  const parsed = JSON.parse(await file.text());
  if (!parsed?.items?.length) return alert('No items found in JSON.');
  const newItems = parsed.items.map(i => ({ user_id: session.user.id, trip_id: activeTripId, title: i.title, item_date: i.item_date, start_time: i.start_time, end_time: i.end_time, item_type: i.item_type || 'event', budget: Number(i.budget || 0), location: i.location || '', notes: i.notes || '', sort_order: i.sort_order || Date.now() }));
  const { error } = await client.from('itinerary_items').insert(newItems);
  if (error) return showDbError(error);
  await loadItems();
}

els.googleBtn.addEventListener('click', loginGoogle);
els.emailBtn.addEventListener('click', loginEmail);
els.logoutBtn.addEventListener('click', logout);
els.tripSelect.addEventListener('change', async () => { activeTripId = els.tripSelect.value; localStorage.setItem('activeTripId', activeTripId); await loadItems(); });
els.newTripBtn.addEventListener('click', () => { els.dialogTripTitle.value = ''; els.dialogStartDate.value = todayISO(); els.dialogEndDate.value = addDays(todayISO(), 3); els.tripDialog.showModal(); });
els.createTripConfirm.addEventListener('click', e => { e.preventDefault(); els.tripDialog.close(); createTrip({ title: els.dialogTripTitle.value, start_date: els.dialogStartDate.value, end_date: els.dialogEndDate.value }); });
els.deleteTripBtn.addEventListener('click', deleteTrip);
['tripTitle','startDate','endDate','destination','tripNotes'].forEach(k => els[k].addEventListener('input', queueTripSave));
els.addItemBtn.addEventListener('click', addItem);
els.expandAllBtn.addEventListener('click', () => document.querySelectorAll('.day-card').forEach(c => c.classList.remove('collapsed')));
els.collapseAllBtn.addEventListener('click', () => document.querySelectorAll('.day-card').forEach(c => c.classList.add('collapsed')));
els.exportBtn.addEventListener('click', exportJson);
els.importInput.addEventListener('change', e => e.target.files[0] && importJson(e.target.files[0]));

init();
