const DAYS = [
  { id:'2026-07-02', short:'Thu', label:'July 2', vibe:'Drive out' },
  { id:'2026-07-03', short:'Fri', label:'July 3', vibe:'Wisconsin day' },
  { id:'2026-07-04', short:'Sat', label:'July 4', vibe:'Holiday / flex' },
  { id:'2026-07-05', short:'Sun', label:'July 5', vibe:'Head home' }
];
const LS_KEY = 'wisconsin-trip-planner-v3';
const OLD_KEYS = ['wisconsin-trip-planner-v2','trip-plan:wisconsin-july-2026'];
const TRIP_ID = () => window.TRIP_CONFIG?.TRIP_ID || 'wisconsin-july-2026';
const HOUR_START = 5;
const HOUR_END = 24;
const SNAP_MINUTES = 15;

const defaultSlots = [
  s('2026-07-02','06:00','07:00','Load up + coffee','700 Fireside Rd, York, PA','Final bags, cooler, chargers, wallet, meds, labels.','prep'),
  s('2026-07-02','07:00','12:00','Drive block: PA → Ohio','','Keep stops short; rotate snacks/water.','drive'),
  s('2026-07-02','12:00','13:00','Lunch + fuel stop','','Pick something quick near the highway.','food'),
  s('2026-07-02','13:00','19:30','Drive block: Ohio/Indiana/Illinois','','Main push toward Wisconsin.','drive'),
  s('2026-07-02','19:30','20:30','Dinner / check-in buffer','','Use this as hotel check-in if splitting the drive.','hotel'),
  s('2026-07-03','09:00','10:00','Slow morning + breakfast','Saukville, WI','Recover from drive.','food'),
  s('2026-07-03','10:00','13:00','Open Wisconsin plans','','Add family visits, shopping, food, or local exploring.','fun'),
  s('2026-07-04','10:00','13:00','Fourth of July flex block','','Parade, cookout, lake, fireworks plans, or rest.','fun'),
  s('2026-07-04','20:00','22:00','Fireworks / night plans','','Add exact location later.','fun'),
  s('2026-07-05','08:00','09:00','Pack + checkout','','Do a room/car sweep before leaving.','prep'),
  s('2026-07-05','09:00','14:00','Drive block: Wisconsin → east','','Start early and keep the route simple.','drive'),
  s('2026-07-05','14:00','15:00','Lunch + fuel','','Stretch legs.','food'),
  s('2026-07-05','15:00','22:00','Final drive home','York, PA','Long drive buffer.','drive')
];

let state = { activeDay:DAYS[0].id, origin:'700 Fireside Rd, York, PA', destination:'Saukville, WI', slots:defaultSlots };
let supa = null, user = null, saveTimer = null, cloudTimer = null, cloudReady = false;
const $ = id => document.getElementById(id);

function s(day,start,end,title,location='',notes='',type='fun'){
  return { id: crypto.randomUUID(), day, start, end, title, location, notes, type };
}

function init(){
  loadLocal();
  bind();
  fillDays();
  fillTimeSelects();
  initSupabase();
  render();
}

function bind(){
  $('mapsBtn').onclick = openMaps;
  $('printBtn').onclick = () => print();
  $('resetBtn').onclick = resetTrip;
  $('addSlotBtn').onclick = addSlot;
  $('exportBtn').onclick = exportJson;
  $('importFile').onchange = importJson;
  $('saveEditBtn').onclick = saveEdit;
  $('deleteSlotBtn').onclick = deleteSlot;
  $('loginBtn').onclick = login;
  $('logoutBtn').onclick = logout;
  $('saveCloudBtn').onclick = saveCloud;
  $('origin').oninput = e => { state.origin=e.target.value; persist(); };
  $('destination').oninput = e => { state.destination=e.target.value; persist(); };
  $('slotStart').onchange = () => autoFixEnd('slotStart','slotEnd');
  $('editStart').onchange = () => autoFixEnd('editStart','editEnd');
}

function fillDays(){
  $('slotDay').innerHTML = DAYS.map(d=>`<option value="${d.id}">${d.short} ${d.label}</option>`).join('');
}

function fillTimeSelects(){
  const opts = timeOptions().map(v=>`<option value="${v}">${toNice(v)}</option>`).join('');
  document.querySelectorAll('select.timeSelect').forEach(sel => sel.innerHTML = opts);
  $('slotStart').value = '09:00';
  $('slotEnd').value = '10:00';
}

function render(){
  $('origin').value = state.origin;
  $('destination').value = state.destination;
  $('slotDay').value = state.activeDay;
  $('dayTabs').innerHTML = DAYS.map(d=>`<button class="tab ${state.activeDay===d.id?'active':''}" data-day="${d.id}"><strong>${d.short} ${d.label}</strong><span>${d.vibe}</span></button>`).join('');
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{ state.activeDay=b.dataset.day; persist(); render(); });
  $('totalSlots').textContent = state.slots.length;
  const daySlots = state.slots.filter(x=>x.day===state.activeDay).sort((a,b)=>a.start.localeCompare(b.start));
  const hours = Array.from({length:HOUR_END-HOUR_START},(_,i)=>`${String(i+HOUR_START).padStart(2,'0')}:00`);
  $('planner').innerHTML = hours.map(h=>renderHour(h, daySlots)).join('');
  attachPlannerEvents();
}

function renderHour(hour, slots){
  const prefix = hour.slice(0,2);
  const matches = slots.filter(x=>x.start.slice(0,2)===prefix);
  return `<div class="time-row" data-hour="${hour}">
    <div class="hour">${toNice(hour)}</div>
    <div class="lane" data-hour="${hour}" title="Double-click to add a plan at ${toNice(hour)}">
      ${matches.length ? matches.map(renderSlot).join('') : '<div class="empty">Double-click here to add a plan, or drop one here.</div>'}
    </div>
  </div>`;
}

function renderSlot(x){
  const loc = x.location ? `<a class="chip" href="${mapLink(x.location)}" target="_blank" rel="noreferrer" title="Open address/location">📍 ${escapeHtml(x.location)}</a>` : '';
  const duration = minutesBetween(x.start, x.end);
  return `<article class="slot ${x.type||''}" data-id="${x.id}" draggable="true" style="--dur:${Math.max(1,duration/60)}">
    <div class="slot-head"><h3>${escapeHtml(x.title)}</h3><time>${toNice(x.start)}–${toNice(x.end)}</time></div>
    ${x.notes?`<p>${escapeHtml(x.notes)}</p>`:''}${loc}
  </article>`;
}

function attachPlannerEvents(){
  document.querySelectorAll('.slot').forEach(el=>{
    el.addEventListener('click', e=>{
      if(e.target.closest('a')) return;
      openEdit(el.dataset.id);
    });
    el.addEventListener('dragstart', e=>{
      e.dataTransfer.setData('text/plain', el.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
  });
  document.querySelectorAll('.lane').forEach(lane=>{
    lane.addEventListener('dragover', e=>{ e.preventDefault(); lane.classList.add('drop-ready'); });
    lane.addEventListener('dragleave', () => lane.classList.remove('drop-ready'));
    lane.addEventListener('drop', e=>{
      e.preventDefault();
      lane.classList.remove('drop-ready');
      const id = e.dataTransfer.getData('text/plain');
      moveSlotToHour(id, lane.dataset.hour, e);
    });
    lane.addEventListener('dblclick', e=>{
      if(e.target.closest('.slot')) return;
      openNewAt(lane.dataset.hour);
    });
  });
}

function moveSlotToHour(id, hour, evt){
  const x = state.slots.find(x=>x.id===id);
  if(!x) return;
  const oldDuration = Math.max(15, minutesBetween(x.start, x.end));
  const start = snappedTimeFromDrop(hour, evt);
  x.day = state.activeDay;
  x.start = start;
  x.end = addMinutes(start, oldDuration);
  persist();
  render();
}

function snappedTimeFromDrop(hour, evt){
  const lane = evt.currentTarget;
  const rect = lane.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (evt.clientY - rect.top) / Math.max(1, rect.height)));
  const offset = Math.round((ratio * 60) / SNAP_MINUTES) * SNAP_MINUTES;
  return addMinutes(hour, Math.min(45, Math.max(0, offset)));
}

function openNewAt(start){
  const end = addMinutes(start, 60);
  $('editId').value = '';
  $('editTitle').value = '';
  $('editStart').value = start;
  $('editEnd').value = end;
  $('editLocation').value = '';
  $('editNotes').value = '';
  $('editDialog').showModal();
  setTimeout(()=>$('editTitle').focus(), 60);
}

function guessType(title){
  const t = title.toLowerCase();
  if(/drive|route|road|fuel|gas/.test(t)) return 'drive';
  if(/food|lunch|dinner|breakfast|coffee|restaurant/.test(t)) return 'food';
  if(/hotel|check-in|checkout|sleep|stay/.test(t)) return 'hotel';
  if(/pack|load|prep/.test(t)) return 'prep';
  return 'fun';
}

function addSlot(){
  const title = $('slotTitle').value.trim();
  if(!title) return alert('Add a title first.');
  autoFixEnd('slotStart','slotEnd');
  state.slots.push(s($('slotDay').value, $('slotStart').value, $('slotEnd').value, title, $('slotLocation').value.trim(), '', guessType(title)));
  $('slotTitle').value = '';
  $('slotLocation').value = '';
  state.activeDay = $('slotDay').value;
  persist();
  render();
}

function openEdit(id){
  const x = state.slots.find(x=>x.id===id);
  if(!x) return;
  $('editId').value = id;
  $('editTitle').value = x.title;
  $('editStart').value = x.start;
  $('editEnd').value = x.end;
  $('editLocation').value = x.location || '';
  $('editNotes').value = x.notes || '';
  $('editDialog').showModal();
}

function saveEdit(e){
  e.preventDefault();
  const title = $('editTitle').value.trim() || 'Untitled plan';
  autoFixEnd('editStart','editEnd');
  const id = $('editId').value;
  if(id){
    const x = state.slots.find(x=>x.id===id);
    if(x){
      x.title = title;
      x.start = $('editStart').value;
      x.end = $('editEnd').value;
      x.location = $('editLocation').value.trim();
      x.notes = $('editNotes').value.trim();
      x.type = guessType(`${x.title} ${x.notes}`);
    }
  } else {
    state.slots.push(s(state.activeDay, $('editStart').value, $('editEnd').value, title, $('editLocation').value.trim(), $('editNotes').value.trim(), guessType(title + ' ' + $('editNotes').value)));
  }
  persist();
  render();
  $('editDialog').close();
}

function deleteSlot(){
  const id = $('editId').value;
  if(!id){ $('editDialog').close(); return; }
  state.slots = state.slots.filter(x=>x.id!==id);
  persist();
  render();
  $('editDialog').close();
}

function openMaps(){
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(state.origin)}&destination=${encodeURIComponent(state.destination)}&travelmode=driving`;
  open(url,'_blank');
}

function persist(){
  saveLocal();
  debouncedCloudSave();
}
function saveLocal(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>localStorage.setItem(LS_KEY, JSON.stringify(state)), 100);
}
function saveLocalNow(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadLocal(){
  try{
    let raw = localStorage.getItem(LS_KEY);
    if(!raw){
      for(const key of OLD_KEYS){ raw = localStorage.getItem(key); if(raw) break; }
    }
    if(raw){
      const parsed = JSON.parse(raw);
      state = {...state, ...parsed, slots: normalizeSlots(parsed.slots || state.slots)};
      saveLocalNow();
    }
  }catch(err){ console.warn('Local load failed', err); }
}
function normalizeSlots(slots){
  return slots.map(x=>({
    id: x.id || crypto.randomUUID(),
    day: x.day || state.activeDay,
    start: normalizeTime(x.start || '09:00'),
    end: normalizeTime(x.end || addMinutes(normalizeTime(x.start || '09:00'), 60)),
    title: x.title || 'Untitled plan',
    location: x.location || x.address || '',
    notes: x.notes || '',
    type: x.type || guessType(`${x.title||''} ${x.notes||''}`)
  }));
}

function resetTrip(){
  if(confirm('Reset back to the starter Wisconsin trip plan?')){
    localStorage.removeItem(LS_KEY);
    state = {activeDay:DAYS[0].id,origin:'700 Fireside Rd, York, PA',destination:'Saukville, WI',slots:defaultSlots.map(x=>({...x,id:crypto.randomUUID()}))};
    persist();
    render();
  }
}
function exportJson(){
  saveLocalNow();
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'wisconsin-trip-plan.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importJson(e){
  const f = e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const imported = JSON.parse(r.result);
      state = {...state, ...imported, slots: normalizeSlots(imported.slots || [])};
      persist();
      render();
    }catch{ alert('That JSON did not import correctly.'); }
  };
  r.readAsText(f);
}

function initSupabase(){
  const cfg = window.TRIP_CONFIG || {};
  if(!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY || !window.supabase){ updateAuth('Local mode. Supabase config missing.'); return; }
  supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });
  window.tripSupabase = supa;
  supa.auth.getSession().then(({data})=>{
    user = data.session?.user || null;
    cloudReady = !!user;
    updateAuth();
    if(user) loadCloud();
  });
  supa.auth.onAuthStateChange((_event, session)=>{
    user = session?.user || null;
    cloudReady = !!user;
    updateAuth();
    if(user) loadCloud();
  });
}
function updateAuth(msg){
  if(msg){ $('authStatus').textContent=msg; return; }
  if(user){
    $('authStatus').textContent = `Signed in as ${user.email}. Every change auto-saves to your Supabase account.`;
    $('loginBtn').classList.add('hidden');
    $('logoutBtn').classList.remove('hidden');
  } else {
    $('authStatus').textContent = 'Local save active. Click Google Login for cloud sync.';
    $('loginBtn').classList.remove('hidden');
    $('logoutBtn').classList.add('hidden');
  }
}
async function login(){
  if(!supa) return alert('Supabase is not loaded. Check config.js.');
  const redirectTo = location.origin + location.pathname;
  const {error} = await supa.auth.signInWithOAuth({provider:'google', options:{redirectTo}});
  if(error) alert(error.message);
}
async function logout(){ if(supa) await supa.auth.signOut(); }
function debouncedCloudSave(){
  if(!supa || !user || !cloudReady) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(()=>saveCloud(false), 900);
}
async function saveCloud(showAlert=true){
  saveLocalNow();
  if(!supa || !user) return showAlert && alert('Login with Google first.');
  const row = { user_id:user.id, trip_id:TRIP_ID(), data:state, updated_at:new Date().toISOString() };
  const {error} = await supa.from('trip_plans').upsert(row,{onConflict:'user_id,trip_id'});
  if(error){
    console.error('Cloud save failed', error);
    if(showAlert) alert('Cloud save failed: '+error.message);
  } else if(showAlert) alert('Saved to Supabase.');
}
async function loadCloud(){
  const {data,error} = await supa.from('trip_plans').select('data,updated_at').eq('user_id',user.id).eq('trip_id',TRIP_ID()).maybeSingle();
  if(error){ console.warn('Cloud load failed', error); return; }
  if(data?.data){
    state = {...state, ...data.data, slots: normalizeSlots(data.data.slots || state.slots)};
    saveLocalNow();
    render();
  } else {
    await saveCloud(false);
  }
}

function timeOptions(){
  const out = [];
  for(let m=HOUR_START*60; m<=23*60+45; m+=15) out.push(minutesToTime(m));
  return out;
}
function autoFixEnd(startId,endId){
  const start = $(startId).value;
  const end = $(endId).value;
  if(minutesFromTime(end) <= minutesFromTime(start)) $(endId).value = addMinutes(start, 60);
}
function normalizeTime(t){
  if(/^\d{1,2}:\d{2}$/.test(t)){
    const [h,m] = t.split(':').map(Number);
    return `${String(Math.min(23,Math.max(0,h))).padStart(2,'0')}:${String(Math.min(59,Math.max(0,m))).padStart(2,'0')}`;
  }
  return '09:00';
}
function minutesFromTime(t){ const [h,m] = normalizeTime(t).split(':').map(Number); return h*60+m; }
function minutesToTime(mins){
  mins = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
}
function addMinutes(t, mins){ return minutesToTime(minutesFromTime(t)+mins); }
function minutesBetween(start,end){
  let diff = minutesFromTime(end)-minutesFromTime(start);
  if(diff <= 0) diff += 1440;
  return diff;
}
function toNice(t){
  let [h,m] = normalizeTime(t).split(':').map(Number);
  const ap = h>=12 ? 'PM' : 'AM';
  h = h%12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}
function mapLink(location){ return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`; }
function escapeHtml(str=''){
  return String(str).replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' }[c]));
}

init();
