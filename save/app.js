import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0)/100);
const dateFmt = d => d ? new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : 'No deadline';

const state={session:null,profile:null,funds:[],fund:null,members:[],ledger:[],requests:[],cards:[]};

function toast(msg,bad=false){
  const el=document.createElement('div');el.className='notice'+(bad?' error':'');el.textContent=msg;
  Object.assign(el.style,{position:'fixed',right:'18px',bottom:'18px',zIndex:90,maxWidth:'360px',boxShadow:'0 14px 40px rgba(0,0,0,.35)'});
  document.body.appendChild(el);setTimeout(()=>el.remove(),3200);
}

async function init(){
  const {data:{session}}=await supabase.auth.getSession();state.session=session;
  supabase.auth.onAuthStateChange((_e,s)=>{state.session=s;if(!s){state.profile=null;state.funds=[];state.fund=null;} boot();});
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  await boot();
}

async function boot(){
  if(!state.session){renderLanding();return;}
  await ensureProfile();
  await loadFunds();
  renderHome();
}

async function ensureProfile(){
  const uid=state.session.user.id;
  const {data}=await supabase.from('profiles').select('*').eq('id',uid).maybeSingle();
  if(data){state.profile=data;return;}
  const name=state.session.user.user_metadata?.full_name || state.session.user.email?.split('@')[0] || 'Saver';
  const {data:created,error}=await supabase.from('profiles').insert({id:uid,display_name:name}).select().single();
  if(error) throw error; state.profile=created;
}

async function loadFunds(){
  const {data,error}=await supabase.from('funds').select('*, fund_members!inner(id,user_id,role,share_cents,spend_limit_cents,status)').eq('fund_members.user_id',state.session.user.id).eq('fund_members.status','active').order('created_at',{ascending:false});
  if(error){toast(error.message,true);state.funds=[];return;} state.funds=data||[];
}

function renderLanding(){
  $('#app').innerHTML=`<main class="shell"><div class="topbar"><div class="brand"><div class="logo">S</div><div><h1>Save</h1><small>Shared money for shared plans</small></div></div></div><div class="wrap"><section class="hero"><div><div class="eyebrow">Trips • Tickets • Events • Goals</div><h2>Save together.<br>Spend fairly.</h2><p>Create a shared fund, automate everyone's contributions, track each person's fair share and vote to unlock more spending when the group needs it.</p><div class="ctaRow"><button class="btn primary" id="showSignup">Create an account</button><button class="btn" id="showLogin">Sign in</button></div><div class="grid"><div class="card stat"><span class="muted">Shared goal</span><strong>$6,000</strong><span class="muted">Everyone sees the same progress.</span></div><div class="card stat"><span class="muted">Fair share</span><strong>$1,200</strong><span class="muted">Personal spend limits protect the group.</span></div><div class="card stat"><span class="muted">Unlock</span><strong>Vote</strong><span class="muted">Approve exceptions together.</span></div></div></div><div class="card authCard" id="authBox"><div class="eyebrow">Sign in</div><h3 style="margin:0">Welcome back</h3><div class="field"><label>Email</label><input id="email" type="email" autocomplete="email"></div><div class="field"><label>Password</label><input id="password" type="password" autocomplete="current-password"></div><button class="btn primary" id="authSubmit">Sign in</button><button class="btn ghost" id="magicLink">Email me a magic link</button><div class="notice">This prototype uses Supabase Auth and Row Level Security. Lithic stays server-side.</div></div></section></div><div class="footer">Sandbox build • No real funds are moved</div></main>`;
  let mode='login';
  $('#showSignup').onclick=()=>{mode='signup';$('#authBox .eyebrow').textContent='Create account';$('#authBox h3').textContent='Start saving together';$('#authSubmit').textContent='Create account';};
  $('#showLogin').onclick=()=>{mode='login';$('#authBox .eyebrow').textContent='Sign in';$('#authBox h3').textContent='Welcome back';$('#authSubmit').textContent='Sign in';};
  $('#authSubmit').onclick=async()=>{const email=$('#email').value.trim(),password=$('#password').value;if(!email||password.length<6)return toast('Enter an email and a password with at least 6 characters.',true);const res=mode==='signup'?await supabase.auth.signUp({email,password,options:{emailRedirectTo:CONFIG.APP_URL}}):await supabase.auth.signInWithPassword({email,password});if(res.error)return toast(res.error.message,true);toast(mode==='signup'?'Account created. Check your email if confirmation is enabled.':'Signed in.');};
  $('#magicLink').onclick=async()=>{const email=$('#email').value.trim();if(!email)return toast('Enter your email first.',true);const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:CONFIG.APP_URL}});error?toast(error.message,true):toast('Magic link sent.');};
}

function topbar(){return `<div class="topbar"><div class="brand"><div class="logo">S</div><div><h1>Save</h1><small>Shared money for shared plans</small></div></div><div style="display:flex;gap:8px;align-items:center"><span class="pill">${esc(state.profile?.display_name||'')}</span><button class="btn ghost" id="signOut">Sign out</button></div></div>`}

function renderHome(){
  const total=state.funds.reduce((a,f)=>a+Number(f.current_balance_cents||0),0);
  $('#app').innerHTML=`<main class="shell">${topbar()}<div class="wrap"><section class="card" style="padding:26px"><div class="sectionHead" style="margin:0"><div><div class="eyebrow">Your shared money</div><div class="balance">${money(total)}</div><div class="muted">Across ${state.funds.length} active ${state.funds.length===1?'fund':'funds'}</div></div><div style="display:flex;gap:8px"><button class="btn" id="joinFund">Join with code</button><button class="btn primary" id="newFund">+ New Fund</button></div></div></section><div class="sectionHead"><h3>Your funds</h3><span class="muted">Tap a fund to manage it</span></div><div class="fundGrid">${state.funds.length?state.funds.map(fundCard).join(''):`<div class="card empty" style="grid-column:1/-1">No funds yet. Create your first trip, ticket or event fund.</div>`}</div></div><div class="footer">Save sandbox • balances are ledger-backed demo values</div></main>`;
  bindTop();$('#newFund').onclick=showCreateFund;$('#joinFund').onclick=showJoinFund;document.querySelectorAll('[data-fund]').forEach(el=>el.onclick=()=>openFund(el.dataset.fund));
}

function fundCard(f){const pct=Math.min(100,Math.round((Number(f.current_balance_cents||0)/Math.max(1,Number(f.goal_cents||1)))*100));return `<article class="card fundCard" data-fund="${f.id}"><div class="fundTitle"><div><h4>${esc(f.emoji||'💸')} ${esc(f.name)}</h4><span class="muted">${esc(f.category||'Shared goal')}</span></div><span class="pill">${esc((f.spending_mode||'fair_share').replaceAll('_',' '))}</span></div><div class="money">${money(f.current_balance_cents)}</div><div class="progress"><span style="width:${pct}%"></span></div><div class="fundMeta"><span>${pct}% of ${money(f.goal_cents)}</span><span>${dateFmt(f.goal_date)}</span></div></article>`}
function bindTop(){const b=$('#signOut');if(b)b.onclick=()=>supabase.auth.signOut();}


function showJoinFund(){modal(`<div class="eyebrow">Join a shared fund</div><h3>Enter an invite code</h3><div class="field"><label>Invite code</label><input id="joinCode" maxlength="12" placeholder="A1B2C3D4" style="text-transform:uppercase"></div><div class="ctaRow"><button class="btn primary" id="joinFundNow">Join Fund</button><button class="btn" data-close>Cancel</button></div>`);$('#joinFundNow').onclick=async()=>{const code=$('#joinCode').value.trim();if(!code)return;const {data,error}=await supabase.rpc('join_fund_by_code',{p_code:code});if(error)return toast(error.message,true);closeModal();await loadFunds();toast('You joined the fund.');openFund(data);};}

function showCreateFund(){
  modal(`<div class="eyebrow">Create a shared fund</div><h3>What are we saving for?</h3><div class="row"><div class="field"><label>Name</label><input id="fundName" placeholder="Miami 2027"></div><div class="field"><label>Emoji</label><input id="fundEmoji" value="🌴" maxlength="4"></div></div><div class="row"><div class="field"><label>Goal amount</label><input id="fundGoal" type="number" min="1" step="0.01" placeholder="6000"></div><div class="field"><label>Goal date</label><input id="fundDate" type="date"></div></div><div class="row"><div class="field"><label>Category</label><select id="fundCategory"><option>Trip</option><option>Tickets</option><option>Event</option><option>Wedding</option><option>Festival</option><option>Group Gift</option><option>Other</option></select></div><div class="field"><label>Spending rules</label><select id="fundMode"><option value="fair_share">Fair Share</option><option value="vote_to_unlock">Vote to Unlock</option><option value="organizer">Organizer Controls</option><option value="open_wallet">Open Wallet</option></select></div></div><div class="notice">You become the organizer. Invite codes can be shared with friends after creation.</div><div class="ctaRow"><button class="btn primary" id="createFund">Create Fund</button><button class="btn" data-close>Cancel</button></div>`);
  $('#createFund').onclick=async()=>{const name=$('#fundName').value.trim(),goal=Math.round(Number($('#fundGoal').value)*100);if(!name||!goal)return toast('Add a name and goal amount.',true);const {data,error}=await supabase.rpc('create_fund_with_owner',{p_name:name,p_emoji:$('#fundEmoji').value||'💸',p_category:$('#fundCategory').value,p_goal_cents:goal,p_goal_date:$('#fundDate').value||null,p_spending_mode:$('#fundMode').value});if(error)return toast(error.message,true);closeModal();await loadFunds();toast('Fund created.');openFund(data);};
}

async function openFund(id){
  const {data:fund,error}=await supabase.from('funds').select('*').eq('id',id).single();if(error)return toast(error.message,true);state.fund=fund;
  const [m,l,r,c]=await Promise.all([
    supabase.from('fund_members').select('*,profiles(display_name,avatar_url)').eq('fund_id',id).eq('status','active').order('joined_at'),
    supabase.from('ledger_entries').select('*').eq('fund_id',id).order('created_at',{ascending:false}).limit(50),
    supabase.from('unlock_requests').select('*,unlock_votes(*)').eq('fund_id',id).order('created_at',{ascending:false}).limit(10),
    supabase.from('cards').select('*').eq('fund_id',id).eq('user_id',state.session.user.id).order('created_at',{ascending:false})
  ]);
  state.members=m.data||[];state.ledger=l.data||[];state.requests=r.data||[];state.cards=c.data||[];renderFund();
}

function renderFund(){
  const f=state.fund;const me=state.members.find(x=>x.user_id===state.session.user.id);const pct=Math.min(100,Math.round(Number(f.current_balance_cents||0)/Math.max(1,Number(f.goal_cents))*100));
  const mine=Number(me?.spend_limit_cents ?? me?.share_cents ?? 0);const mySpent=state.ledger.filter(x=>x.user_id===state.session.user.id&&x.entry_type==='purchase').reduce((a,x)=>a+Math.abs(Number(x.amount_cents)),0);const available=Math.max(0,mine-mySpent);
  $('#app').innerHTML=`<main class="shell">${topbar()}<div class="wrap"><button class="btn ghost navBack" id="backHome">← All funds</button><div class="dashboard"><div class="stack"><section class="card"><div class="fundTitle"><div><div class="eyebrow">${esc(f.category)}</div><h4 style="font-size:28px;margin:5px 0">${esc(f.emoji)} ${esc(f.name)}</h4></div><span class="pill">${pct}% funded</span></div><div class="balance">${money(f.current_balance_cents)}</div><div class="muted">of ${money(f.goal_cents)} • ${dateFmt(f.goal_date)}</div><div class="progress" style="margin-top:16px"><span style="width:${pct}%"></span></div><div class="grid"><div class="stat"><span class="muted">Your spend power</span><strong>${money(available)}</strong></div><div class="stat"><span class="muted">Your fair share</span><strong>${money(mine)}</strong></div><div class="stat"><span class="muted">Group available</span><strong>${money(f.current_balance_cents)}</strong></div></div><div class="ctaRow"><button class="btn primary" id="addMoney">+ Add money</button><button class="btn" id="unlock">🔓 Unlock Funds</button><button class="btn" id="invite">Invite</button></div></section><section class="card"><div class="sectionHead" style="margin:0 0 6px"><h3>People</h3><span class="pill">${state.members.length} members</span></div>${state.members.map(memberRow).join('')||'<div class="empty">No members</div>'}</section><section class="card"><div class="sectionHead" style="margin:0"><h3>Recent activity</h3></div>${state.ledger.length?state.ledger.map(txRow).join(''):'<div class="empty">Contributions and purchases will appear here.</div>'}</section></div><div class="stack"><section class="card"><div class="eyebrow">Spending rules</div><h3 style="margin:6px 0 14px">Fund Controls</h3><div class="modeBox"><strong>${modeName(f.spending_mode)}</strong><span class="muted">${modeDesc(f.spending_mode)}</span></div>${me?.role==='owner'?'<button class="btn" id="changeMode" style="margin-top:12px;width:100%">Change spending rules</button>':''}</section><section class="card"><div class="eyebrow">Digital card</div><h3 style="margin:6px 0 14px">Your Group Card</h3>${cardBlock()} </section><section class="card"><div class="sectionHead" style="margin:0"><h3>Unlock requests</h3></div>${requestsBlock()}</section></div></div></div><div class="footer">Sandbox only • virtual card actions call Lithic through a Supabase Edge Function</div></main>`;
  bindTop();$('#backHome').onclick=()=>{state.fund=null;renderHome()};$('#addMoney').onclick=showAddMoney;$('#unlock').onclick=showUnlock;$('#invite').onclick=showInvite;if($('#changeMode'))$('#changeMode').onclick=showChangeMode;if($('#createCard'))$('#createCard').onclick=createCard;document.querySelectorAll('[data-vote]').forEach(b=>b.onclick=()=>voteUnlock(b.dataset.vote,b.dataset.choice));
}

function memberRow(m){const n=m.profiles?.display_name||'Member';const initial=n.slice(0,1).toUpperCase();return `<div class="member"><div class="avatar">${esc(initial)}</div><div><strong>${esc(n)} ${m.user_id===state.session.user.id?'(you)':''}</strong><small>${esc(m.role)} • share ${money(m.share_cents)}</small></div><strong>${money(m.spend_limit_cents??m.share_cents)}</strong></div>`}
function txRow(x){const pos=Number(x.amount_cents)>=0;return `<div class="tx"><div><strong>${esc(x.description||x.entry_type)}</strong><div class="muted" style="font-size:12px">${new Date(x.created_at).toLocaleString()}</div></div><div class="amt ${pos?'positive':'negative'}">${pos?'+':''}${money(x.amount_cents)}</div></div>`}
function modeName(m){return ({fair_share:'🔒 Fair Share',vote_to_unlock:'👥 Vote to Unlock',organizer:'👑 Organizer Controls',open_wallet:'🔓 Open Wallet'})[m]||m}
function modeDesc(m){return ({fair_share:'Members can spend only up to their assigned limit.',vote_to_unlock:'Members stay within their share unless the group approves an exception.',organizer:'The organizer approves spending exceptions.',open_wallet:'Members may spend from the full available group balance.'})[m]||''}
function cardBlock(){const c=state.cards[0];if(!c)return `<div class="empty" style="padding:20px 0">No sandbox card yet.</div><button class="btn primary" id="createCard" style="width:100%">Create sandbox virtual card</button>`;return `<div class="walletCard"><div><div class="mini">SAVE • ${esc(state.fund.name).toUpperCase()}</div><div style="margin-top:8px;font-size:12px">VIRTUAL GROUP CARD</div></div><div><div class="cardNum">•••• •••• •••• ${esc(c.last_four||'----')}</div><div style="display:flex;justify-content:space-between;margin-top:10px;font-size:12px"><span>${esc(c.state||'OPEN')}</span><span>${money(c.spend_limit_cents||0)} LIMIT</span></div></div></div><div class="walletActions"><button class="btn" disabled> Apple Wallet</button><button class="btn" disabled>G Pay</button></div><div class="muted" style="font-size:12px;margin-top:10px">Wallet provisioning is intentionally disabled until the card program is configured for tokenization.</div>`}
function requestsBlock(){if(!state.requests.length)return '<div class="empty">No unlock requests.</div>';return state.requests.map(r=>{const mine=(r.unlock_votes||[]).find(v=>v.user_id===state.session.user.id);return `<div class="modeBox" style="margin-top:10px"><strong>${money(r.amount_cents)} • ${esc(r.reason)}</strong><span class="muted">${esc(r.status)} • ${esc(r.approval_mode)}</span>${r.status==='pending'&&!mine?`<div class="vote"><button class="btn primary" data-vote="${r.id}" data-choice="approve">Approve</button><button class="btn danger" data-vote="${r.id}" data-choice="deny">Deny</button></div>`:`<div class="muted" style="margin-top:8px">${mine?'You voted '+mine.vote:'Voting closed'}</div>`}</div>`}).join('')}

function showAddMoney(){modal(`<div class="eyebrow">Contribution</div><h3>Add money to ${esc(state.fund.name)}</h3><div class="field"><label>Amount</label><input id="amount" type="number" min="1" step="0.01" placeholder="100"></div><div class="notice">Prototype behavior: this posts a sandbox ledger contribution only. ACH/debit funding should be enabled only after the banking program and account-holder flow are approved.</div><div class="ctaRow"><button class="btn primary" id="postContribution">Post sandbox contribution</button><button class="btn" data-close>Cancel</button></div>`);$('#postContribution').onclick=async()=>{const cents=Math.round(Number($('#amount').value)*100);if(cents<1)return;const {error}=await supabase.rpc('post_demo_contribution',{p_fund_id:state.fund.id,p_amount_cents:cents});if(error)return toast(error.message,true);closeModal();toast('Contribution posted.');openFund(state.fund.id);};}
function showUnlock(){modal(`<div class="eyebrow">Unlock Funds</div><h3>Request more spending power</h3><div class="field"><label>Extra amount needed</label><input id="unlockAmt" type="number" min="1" step="0.01"></div><div class="field"><label>What is it for?</label><input id="unlockReason" placeholder="Hotel deposit"></div><div class="field"><label>Approval</label><select id="unlockApproval"><option value="majority">Majority</option><option value="unanimous">Everyone must approve</option><option value="owner">Organizer approval</option></select></div><div class="ctaRow"><button class="btn primary" id="sendUnlock">Request unlock</button><button class="btn" data-close>Cancel</button></div>`);$('#sendUnlock').onclick=async()=>{const cents=Math.round(Number($('#unlockAmt').value)*100),reason=$('#unlockReason').value.trim();if(!cents||!reason)return toast('Add an amount and reason.',true);const {error}=await supabase.from('unlock_requests').insert({fund_id:state.fund.id,requester_id:state.session.user.id,amount_cents:cents,reason,approval_mode:$('#unlockApproval').value});if(error)return toast(error.message,true);closeModal();toast('Unlock request sent.');openFund(state.fund.id);};}
function showInvite(){modal(`<div class="eyebrow">Invite people</div><h3>Share this code</h3><div class="walletCard" style="aspect-ratio:auto"><div class="mini">FUND INVITE CODE</div><div style="font-size:34px;font-weight:900;letter-spacing:.12em;margin-top:12px">${esc(state.fund.invite_code)}</div></div><div class="notice" style="margin-top:12px">New members can join with this code after signing in. A join-by-code screen is included in the schema and can be surfaced next.</div><div class="ctaRow"><button class="btn primary" id="copyInvite">Copy code</button><button class="btn" data-close>Done</button></div>`);$('#copyInvite').onclick=()=>navigator.clipboard.writeText(state.fund.invite_code).then(()=>toast('Invite code copied.'));}
function showChangeMode(){modal(`<div class="eyebrow">Fund Controls</div><h3>Choose how the group spends</h3><div class="field"><label>Mode</label><select id="newMode"><option value="fair_share" ${state.fund.spending_mode==='fair_share'?'selected':''}>Fair Share</option><option value="vote_to_unlock" ${state.fund.spending_mode==='vote_to_unlock'?'selected':''}>Vote to Unlock</option><option value="organizer" ${state.fund.spending_mode==='organizer'?'selected':''}>Organizer Controls</option><option value="open_wallet" ${state.fund.spending_mode==='open_wallet'?'selected':''}>Open Wallet</option></select></div><div class="ctaRow"><button class="btn primary" id="saveMode">Save rules</button><button class="btn" data-close>Cancel</button></div>`);$('#saveMode').onclick=async()=>{const {error}=await supabase.from('funds').update({spending_mode:$('#newMode').value}).eq('id',state.fund.id);if(error)return toast(error.message,true);closeModal();openFund(state.fund.id);};}

async function createCard(){const btn=$('#createCard');btn.disabled=true;btn.textContent='Creating…';const {data,error}=await supabase.functions.invoke('lithic-card',{body:{action:'create',fund_id:state.fund.id}});if(error){btn.disabled=false;btn.textContent='Create sandbox virtual card';return toast(error.message,true)}if(data?.error)return toast(data.error,true);toast('Sandbox card created.');openFund(state.fund.id);}
async function voteUnlock(id,choice){const {error}=await supabase.rpc('vote_on_unlock',{p_request_id:id,p_vote:choice});if(error)return toast(error.message,true);toast(`Vote recorded: ${choice}`);openFund(state.fund.id);}
function modal(html){const b=document.createElement('div');b.className='modalBack';b.id='modalBack';b.innerHTML=`<div class="modal">${html}</div>`;document.body.appendChild(b);b.onclick=e=>{if(e.target===b||e.target.matches('[data-close]'))closeModal();};}
function closeModal(){document.querySelector('#modalBack')?.remove()}

init().catch(e=>{console.error(e);toast(e.message||'Startup failed',true)});
