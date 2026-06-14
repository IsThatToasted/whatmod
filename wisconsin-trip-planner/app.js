const DAYS = [
  { id:'2026-07-02', short:'Thu', label:'July 2', vibe:'Drive out' },
  { id:'2026-07-03', short:'Fri', label:'July 3', vibe:'Wisconsin day' },
  { id:'2026-07-04', short:'Sat', label:'July 4', vibe:'Holiday / flex' },
  { id:'2026-07-05', short:'Sun', label:'July 5', vibe:'Head home' }
];
const LS_KEY = 'wisconsin-trip-planner-v2';
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
let supa = null, user = null;
function s(day,start,end,title,location='',notes='',type='fun'){ return { id: crypto.randomUUID(), day,start,end,title,location,notes,type }; }
const $ = id => document.getElementById(id);
function init(){ loadLocal(); bind(); fillDays(); initSupabase(); render(); }
function bind(){
  $('mapsBtn').onclick = openMaps; $('printBtn').onclick = () => print(); $('resetBtn').onclick = resetTrip;
  $('addSlotBtn').onclick = addSlot; $('exportBtn').onclick = exportJson; $('importFile').onchange = importJson;
  $('saveEditBtn').onclick = saveEdit; $('deleteSlotBtn').onclick = deleteSlot;
  $('loginBtn').onclick = login; $('logoutBtn').onclick = logout; $('saveCloudBtn').onclick = saveCloud;
  $('origin').oninput = e => { state.origin=e.target.value; saveLocal(); };
  $('destination').oninput = e => { state.destination=e.target.value; saveLocal(); };
}
function fillDays(){ $('slotDay').innerHTML = DAYS.map(d=>`<option value="${d.id}">${d.short} ${d.label}</option>`).join(''); }
function render(){
  $('origin').value=state.origin; $('destination').value=state.destination; $('slotDay').value=state.activeDay;
  $('dayTabs').innerHTML = DAYS.map(d=>`<button class="tab ${state.activeDay===d.id?'active':''}" data-day="${d.id}"><strong>${d.short} ${d.label}</strong><span>${d.vibe}</span></button>`).join('');
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{state.activeDay=b.dataset.day; saveLocal(); render();});
  $('totalSlots').textContent = state.slots.length;
  const daySlots = state.slots.filter(x=>x.day===state.activeDay).sort((a,b)=>a.start.localeCompare(b.start));
  const hours = Array.from({length:18},(_,i)=>`${String(i+5).padStart(2,'0')}:00`);
  $('planner').innerHTML = hours.map(h=>renderHour(h, daySlots)).join('');
  document.querySelectorAll('.slot').forEach(el=>el.onclick=()=>openEdit(el.dataset.id));
}
function renderHour(hour, slots){
  const prefix = hour.slice(0,2); const matches = slots.filter(x=>x.start.slice(0,2)===prefix);
  return `<div class="time-row"><div class="hour">${toNice(hour)}</div><div class="lane">${matches.length?matches.map(renderSlot).join(''):'<div class="empty">Drop a plan here when you need it.</div>'}</div></div>`;
}
function renderSlot(x){
  const loc = x.location ? `<span class="chip">📍 ${escapeHtml(x.location)}</span>` : '';
  return `<article class="slot ${x.type||''}" data-id="${x.id}"><div class="slot-head"><h3>${escapeHtml(x.title)}</h3><time>${toNice(x.start)}–${toNice(x.end)}</time></div>${x.notes?`<p>${escapeHtml(x.notes)}</p>`:''}${loc}</article>`;
}
function guessType(title){ const t=title.toLowerCase(); if(/drive|route|road|fuel|gas/.test(t))return'drive'; if(/food|lunch|dinner|breakfast|coffee/.test(t))return'food'; if(/hotel|check-in|checkout|sleep/.test(t))return'hotel'; if(/pack|load/.test(t))return'prep'; return'fun'; }
function addSlot(){
  const title=$('slotTitle').value.trim(); if(!title) return alert('Add a title first.');
  state.slots.push(s($('slotDay').value,$('slotStart').value,$('slotEnd').value,title,$('slotLocation').value.trim(),'',guessType(title)));
  $('slotTitle').value=''; $('slotLocation').value=''; state.activeDay=$('slotDay').value; saveLocal(); render();
}
function openEdit(id){ const x=state.slots.find(x=>x.id===id); if(!x)return; $('editId').value=id; $('editTitle').value=x.title; $('editStart').value=x.start; $('editEnd').value=x.end; $('editLocation').value=x.location||''; $('editNotes').value=x.notes||''; $('editDialog').showModal(); }
function saveEdit(e){ e.preventDefault(); const x=state.slots.find(x=>x.id===$('editId').value); if(x){ x.title=$('editTitle').value.trim(); x.start=$('editStart').value; x.end=$('editEnd').value; x.location=$('editLocation').value.trim(); x.notes=$('editNotes').value.trim(); x.type=guessType(x.title+' '+x.notes); saveLocal(); render(); } $('editDialog').close(); }
function deleteSlot(){ state.slots = state.slots.filter(x=>x.id!==$('editId').value); saveLocal(); render(); $('editDialog').close(); }
function openMaps(){ const url=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(state.origin)}&destination=${encodeURIComponent(state.destination)}&travelmode=driving`; open(url,'_blank'); }
function saveLocal(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadLocal(){ try{ const raw=localStorage.getItem(LS_KEY); if(raw) state={...state,...JSON.parse(raw)}; }catch{} }
function resetTrip(){ if(confirm('Reset back to the starter Wisconsin trip plan?')){ localStorage.removeItem(LS_KEY); state={activeDay:DAYS[0].id,origin:'700 Fireside Rd, York, PA',destination:'Saukville, WI',slots:defaultSlots.map(x=>({...x,id:crypto.randomUUID()}))}; saveLocal(); render(); }}
function exportJson(){ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='wisconsin-trip-plan.json'; a.click(); URL.revokeObjectURL(a.href); }
function importJson(e){ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ state=JSON.parse(r.result); saveLocal(); render(); }catch{ alert('That JSON did not import correctly.'); } }; r.readAsText(f); }
function initSupabase(){
  const cfg=window.TRIP_CONFIG||{};
  if(!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY || !window.supabase){ updateAuth('Local mode. Supabase config missing.'); return; }
  supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  supa.auth.getSession().then(({data})=>{ user=data.session?.user||null; updateAuth(); if(user) loadCloud(); });
  supa.auth.onAuthStateChange((_event, session)=>{ user=session?.user||null; updateAuth(); if(user) loadCloud(); });
}
function updateAuth(msg){ if(msg){$('authStatus').textContent=msg;return;} if(user){ $('authStatus').textContent=`Signed in as ${user.email}. Cloud sync ready.`; $('loginBtn').classList.add('hidden'); $('logoutBtn').classList.remove('hidden'); } else { $('authStatus').textContent='Local save active. Click Google Login for cloud sync.'; $('loginBtn').classList.remove('hidden'); $('logoutBtn').classList.add('hidden'); } }
async function login(){ if(!supa)return alert('Supabase is not loaded. Check config.js.'); const redirectTo = location.origin + location.pathname; const {error}=await supa.auth.signInWithOAuth({provider:'google',options:{redirectTo}}); if(error) alert(error.message); }
async function logout(){ if(supa) await supa.auth.signOut(); }
async function saveCloud(){ if(!supa || !user) return alert('Login with Google first.'); const row={user_id:user.id,trip_id:(window.TRIP_CONFIG?.TRIP_ID||'wisconsin-july-2026'),data:state,updated_at:new Date().toISOString()}; const {error}=await supa.from('trip_plans').upsert(row,{onConflict:'user_id,trip_id'}); if(error) alert('Cloud save failed: '+error.message); else alert('Saved to Supabase.'); }
async function loadCloud(){ const {data,error}=await supa.from('trip_plans').select('data,updated_at').eq('user_id',user.id).eq('trip_id',window.TRIP_CONFIG?.TRIP_ID||'wisconsin-july-2026').maybeSingle(); if(!error && data?.data){ state={...state,...data.data}; saveLocal(); render(); } }
function toNice(t){ let [h,m]=t.split(':').map(Number); const ap=h>=12?'PM':'AM'; h=h%12||12; return `${h}:${String(m).padStart(2,'0')} ${ap}`; }
function escapeHtml(str=''){ return str.replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' }[c])); }
init();
