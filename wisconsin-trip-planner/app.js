const cfg = window.TRIP_CONFIG || {};
const hasSupabase = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
const sb = hasSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
const PLAN_ID = cfg.PLAN_ID || 'wisconsin-july-2026';
const storeKey = `trip-plan:${PLAN_ID}`;
const days = [
  { id:'2026-07-02', label:'Thu Jul 2', subtitle:'Departure / Drive Day' },
  { id:'2026-07-03', label:'Fri Jul 3', subtitle:'Drive / Arrival Buffer' },
  { id:'2026-07-04', label:'Sat Jul 4', subtitle:'Saukville / July 4' },
  { id:'2026-07-05', label:'Sun Jul 5', subtitle:'Return / Wrap-up' }
];
let activeDay = days[0].id;
let user = null;
let plan = defaultPlan();
function defaultPlan(){return {origin:'700 Fireside Rd, York, PA',destination:'Saukville, WI',updatedAt:new Date().toISOString(),slots:[
 {id:uid(),day:'2026-07-02',start:'07:00',end:'08:00',title:'Load car + final house check',location:'700 Fireside Rd, York, PA',notes:'Cooler, chargers, meds, wallet, sunglasses, road snacks.'},
 {id:uid(),day:'2026-07-02',start:'08:00',end:'12:00',title:'Drive block 1',location:'York, PA → westbound',notes:'Add fuel/food stops after checking live traffic.'},
 {id:uid(),day:'2026-07-02',start:'12:00',end:'13:00',title:'Lunch + gas stop',location:'Along route',notes:'Keep this flexible.'},
 {id:uid(),day:'2026-07-02',start:'13:00',end:'18:00',title:'Drive block 2',location:'Toward overnight stop',notes:'Pick a hotel based on how far you want to push.'},
 {id:uid(),day:'2026-07-02',start:'18:00',end:'20:00',title:'Hotel check-in + dinner',location:'Overnight city TBD',notes:'Use the route link, traffic, and energy level to choose the stop.'},
 {id:uid(),day:'2026-07-03',start:'08:00',end:'12:00',title:'Drive block 3',location:'Overnight stop → Wisconsin',notes:'Start early to leave room for Chicago/Milwaukee traffic.'},
 {id:uid(),day:'2026-07-03',start:'12:00',end:'13:00',title:'Lunch / rest stop',location:'Along route',notes:'Stretch, fuel, check ETA.'},
 {id:uid(),day:'2026-07-03',start:'13:00',end:'17:00',title:'Final drive into Saukville',location:'Saukville, WI',notes:'Confirm lodging check-in window.'},
 {id:uid(),day:'2026-07-03',start:'17:00',end:'19:00',title:'Check in + unpack',location:'Saukville, WI',notes:'Save exact hotel/Airbnb address here.'},
 {id:uid(),day:'2026-07-04',start:'09:00',end:'10:00',title:'Breakfast + plan July 4 events',location:'Saukville / nearby',notes:'Add fireworks/parade times once confirmed.'},
 {id:uid(),day:'2026-07-04',start:'11:00',end:'15:00',title:'Open activity block',location:'Saukville / Port Washington / Milwaukee area',notes:'Use for family visit, beach, shopping, or local event.'},
 {id:uid(),day:'2026-07-04',start:'18:00',end:'22:00',title:'Dinner + fireworks block',location:'TBD',notes:'Add parking notes and backup location.'},
 {id:uid(),day:'2026-07-05',start:'08:00',end:'09:00',title:'Pack + checkout',location:'Saukville, WI',notes:'Check under seats, chargers, cooler, hotel room.'},
 {id:uid(),day:'2026-07-05',start:'09:00',end:'18:00',title:'Return drive / optional overnight split',location:'Saukville, WI → York, PA',notes:'Use this as a placeholder; split into smaller blocks if returning over two days.'}
]};}
function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function $(id){return document.getElementById(id)}
function saveLocal(){plan.updatedAt=new Date().toISOString(); localStorage.setItem(storeKey, JSON.stringify(plan));}
function loadLocal(){try{const raw=localStorage.getItem(storeKey); if(raw) plan=JSON.parse(raw);}catch{}}
async function init(){loadLocal(); bind(); renderDays(); render(); if(sb) await authInit();}
function bind(){ $('origin').addEventListener('input',e=>{plan.origin=e.target.value;saveLocal();renderRoute();}); $('destination').addEventListener('input',e=>{plan.destination=e.target.value;saveLocal();renderRoute();}); $('mapsBtn').onclick=()=>{const u=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(plan.origin)}&destination=${encodeURIComponent(plan.destination)}&travelmode=driving`; window.open(u,'_blank')}; $('resetBtn').onclick=()=>{if(confirm('Reset this planner to the starter Wisconsin trip template?')){plan=defaultPlan();saveLocal();render();}}; $('printBtn').onclick=()=>print(); $('addSlotBtn').onclick=addSlot; $('exportBtn').onclick=exportJson; $('importFile').onchange=importJson; $('loginBtn').onclick=login; $('logoutBtn').onclick=logout; $('saveCloudBtn').onclick=saveCloud; $('saveEditBtn').onclick=saveEdit; $('deleteSlotBtn').onclick=deleteSlot;}
function renderDays(){ $('slotDay').innerHTML=days.map(d=>`<option value="${d.id}">${d.label} — ${d.subtitle}</option>`).join(''); $('dayTabs').innerHTML=days.map(d=>`<button class="tab ${d.id===activeDay?'active':''}" data-day="${d.id}">${d.label}<br><small>${d.subtitle}</small></button>`).join(''); document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{activeDay=b.dataset.day;render();});}
function render(){ $('origin').value=plan.origin; $('destination').value=plan.destination; renderDays(); renderRoute(); renderPlanner(); }
function renderRoute(){ $('routeSummary').innerHTML=`<div class="metric"><span>Origin</span><strong>${esc(plan.origin)}</strong></div><div class="metric"><span>Destination</span><strong>${esc(plan.destination)}</strong></div><div class="metric"><span>Trip Dates</span><strong>July 2–5, 2026</strong></div><div class="metric"><span>Mode</span><strong>${user?'Cloud sync':'Local storage'}</strong></div>`;}
function renderPlanner(){ const slots=plan.slots.filter(s=>s.day===activeDay).sort((a,b)=>a.start.localeCompare(b.start)); let html=''; for(let h=5;h<=23;h++){const label=`${String(h).padStart(2,'0')}:00`; const hourSlots=slots.filter(s=>parseInt(s.start.slice(0,2))===h); html+=`<div class="hour-row"><div class="hour-label">${formatHour(h)}</div><div class="hour-content" data-hour="${label}">${hourSlots.map(slotHtml).join('')}</div></div>`;} $('planner').innerHTML=html; document.querySelectorAll('.slot').forEach(el=>el.onclick=()=>openEdit(el.dataset.id));}
function slotHtml(s){return `<article class="slot" data-id="${s.id}"><p class="time">${s.start}–${s.end}</p><h3>${esc(s.title)}</h3>${s.location?`<p>📍 ${esc(s.location)}</p>`:''}${s.notes?`<p>${esc(s.notes)}</p>`:''}</article>`}
function addSlot(){ const s={id:uid(),day:$('slotDay').value,start:$('slotStart').value,end:$('slotEnd').value,title:$('slotTitle').value||'Untitled block',location:$('slotLocation').value,notes:$('slotNotes').value}; plan.slots.push(s); activeDay=s.day; ['slotTitle','slotLocation','slotNotes'].forEach(id=>$(id).value=''); saveLocal(); render(); saveCloud(false);}
function openEdit(id){const s=plan.slots.find(x=>x.id===id); if(!s)return; $('editId').value=s.id; $('editTitle').value=s.title; $('editStart').value=s.start; $('editEnd').value=s.end; $('editLocation').value=s.location||''; $('editNotes').value=s.notes||''; $('editDialog').showModal();}
function saveEdit(e){e.preventDefault();const s=plan.slots.find(x=>x.id===$('editId').value); if(s){s.title=$('editTitle').value;s.start=$('editStart').value;s.end=$('editEnd').value;s.location=$('editLocation').value;s.notes=$('editNotes').value;saveLocal();render();saveCloud(false);} $('editDialog').close();}
function deleteSlot(){const id=$('editId').value; plan.slots=plan.slots.filter(s=>s.id!==id); saveLocal(); render(); saveCloud(false); $('editDialog').close();}
async function authInit(){ const {data:{session}}=await sb.auth.getSession(); user=session?.user||null; updateAuth(); if(user) await loadCloud(); sb.auth.onAuthStateChange(async(_event,session)=>{user=session?.user||null; updateAuth(); if(user) await loadCloud();});}
function updateAuth(){ $('authStatus').textContent=user?`Signed in as ${user.email}`:'Supabase ready. Sign in to sync.'; $('loginBtn').classList.toggle('hidden',!!user); $('logoutBtn').classList.toggle('hidden',!user); renderRoute();}
async function login(){ if(!sb){alert('Add config.js with Supabase URL and anon key first.');return;} await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href.split('#')[0]}});}
async function logout(){ if(sb) await sb.auth.signOut(); user=null; updateAuth();}
async function loadCloud(){ if(!sb||!user)return; const {data,error}=await sb.from('trip_plans').select('plan').eq('plan_id',PLAN_ID).eq('user_id',user.id).maybeSingle(); if(!error && data?.plan){ plan=data.plan; saveLocal(); render(); }}
async function saveCloud(noisy=true){ saveLocal(); if(!sb||!user){ if(noisy) alert('Saved locally. Login with Google to sync to Supabase.'); return; } const payload={user_id:user.id, plan_id:PLAN_ID, plan, updated_at:new Date().toISOString()}; const {error}=await sb.from('trip_plans').upsert(payload,{onConflict:'user_id,plan_id'}); if(noisy) alert(error?`Cloud save failed: ${error.message}`:'Saved to Supabase.');}
function exportJson(){const blob=new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='wisconsin-trip-plan.json'; a.click(); URL.revokeObjectURL(a.href);}
function importJson(e){const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{try{plan=JSON.parse(r.result);saveLocal();render();}catch{alert('Invalid JSON file.')}}; r.readAsText(f);}
function formatHour(h){const ampm=h>=12?'PM':'AM'; const hr=h%12||12; return `${hr}:00 ${ampm}`}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
init();
