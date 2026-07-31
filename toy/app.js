'use strict';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const cfg = window.PULSELINK_CONFIG || {};

const state = {
  clientId: localStorage.pulselinkClientId || randomToken(12),
  name: localStorage.pulselinkName || '',
  relay: '', token: null, ws: null, joined: false, partner: null,
  partnerManual: false, partnerManualCap: 0,
  partnerVideo: false, partnerVideoCap: 0,
  localToy: { connected: false, name: null, battery: null },
  partnerToy: { connected: false, name: null, battery: null },
  localOutput: 0, partnerOutput: 0,
  waveMine: Array(160).fill(0), wavePartner: Array(160).fill(0), waveSampleAt: 0,
  lastSent: -1, lastSentAt: 0, seq: 0, pattern: null, touchActive: false,
  media: false, mode: 'balanced', smooth: 0, stream: null, timer: null,
  audioContext: null, analyser: null, timeData: null, freqData: null,
  previous: null, smMotion: 0, smAudio: 0, lastEnergy: 0
};
localStorage.pulselinkClientId = state.clientId;

function randomToken(n = 24) {
  const a = new Uint8Array(n); crypto.getRandomValues(a); let s = '';
  a.forEach(v => s += String.fromCharCode(v));
  return btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
function toast(text, error = false) {
  const el = $('#toast'); el.textContent = text; el.classList.toggle('error', error); el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 3500);
}
function normalizeRelay(value) {
  try { const u = new URL(String(value || '').trim()); if (u.protocol === 'ws:') u.protocol = 'http:'; if (u.protocol === 'wss:') u.protocol = 'https:'; u.hash='';u.search='';return u.toString().replace(/\/$/,''); } catch { return null; }
}
function wsUrl() {
  const u = new URL(state.relay); u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = u.pathname.replace(/\/$/,'') + '/ws';
  u.search = new URLSearchParams({ session: state.token, client: state.clientId, name: state.name });
  return u;
}
function parseInvite(value) {
  value = String(value || '').trim();
  if (/^[\w-]{24,128}$/.test(value)) return { token:value, relay:null };
  try {
    const u = new URL(value); let token = u.pathname.match(/\/invite\/([\w-]{24,128})/)?.[1] || null; let relay = u.searchParams.get('relay');
    const [hp,hq=''] = u.hash.replace(/^#/,'').split('?'); token ||= hp.match(/^\/invite\/([\w-]{24,128})/)?.[1] || null; relay ||= new URLSearchParams(hq).get('relay');
    return token ? { token, relay:normalizeRelay(relay) } : null;
  } catch { return null; }
}
function hashInvite() {
  const [p,q=''] = location.hash.replace(/^#/,'').split('?'); const token = p.match(/^\/invite\/([\w-]{24,128})/)?.[1];
  const relay = new URLSearchParams(location.search).get('relay') || new URLSearchParams(q).get('relay');
  return token ? { token, relay:normalizeRelay(relay) } : null;
}
function siteBase() { return String(cfg.siteBase || location.origin + location.pathname.replace(/\/$/,'')).replace(/\/$/,''); }
function inviteLink(token) { const relay = encodeURIComponent(state.relay); return `${siteBase()}/?relay=${relay}#/invite/${token}?relay=${relay}`; }
function send(message) { if (state.ws?.readyState === WebSocket.OPEN) { state.ws.send(JSON.stringify(message)); return true; } return false; }

async function relayHealth(relay) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const u = new URL(relay); u.pathname = u.pathname.replace(/\/$/,'') + '/health'; u.search = 'ts=' + Date.now();
    const res = await fetch(u, { cache:'no-store', mode:'cors', signal:ctl.signal }); if (!res.ok) return {ok:false,error:`Relay returned HTTP ${res.status}.`};
    const data = await res.json(); return data?.ok ? {ok:true,data} : {ok:false,error:'Relay health response was invalid.'};
  } catch (e) { return {ok:false,error:e.name === 'AbortError' ? 'Relay health check timed out.' : (e.message || String(e))}; }
  finally { clearTimeout(timer); }
}

function sendLocalToyState() {
  // The static mobile page does not own a BLE connection yet. Keeping this as
  // a first-class state message lets the other side show Waiting for user's Toy.
  send({ type:'toy-state', connected:false, name:'', battery:null });
}
function setToyCard(cardId, nameId, metaId, toy, fallback, fallbackMeta) {
  const card=$(cardId); if(!card)return;
  card.classList.toggle('connected',!!toy?.connected); card.classList.toggle('waiting',!toy?.connected);
  $(nameId).textContent = toy?.connected ? (toy.name || 'Connected toy') : fallback;
  $(metaId).textContent = toy?.connected ? (toy.battery == null ? 'Connected' : `Connected · ${toy.battery}% battery`) : fallbackMeta;
}
function renderToyState() {
  setToyCard('#myToyCard','#myToyName','#myToyMeta',state.localToy,'Waiting for your Toy…','Not connected on this page');
  setToyCard('#theirToyCard','#theirToyName','#theirToyMeta',state.partnerToy,"Waiting for user's Toy…",'Not connected');
  const ready = state.partnerToy.connected;
  $('#partnerToyWait').classList.toggle('hidden', ready);
  $('#partnerControlArea').classList.toggle('hidden', !ready);
  $('#startVideo').disabled = !(ready && state.partnerVideo);
  if (!ready) stopPattern(false);
}
function renderPermissions() {
  $('#manualPermission').textContent = state.partnerManual ? `Manual allowed · max ${state.partnerManualCap}` : 'Manual off';
  $('#videoPermission').textContent = state.partnerVideo ? `Video allowed · max ${state.partnerVideoCap}` : 'Video off';
  $('#permissionText').textContent = state.partnerManual || state.partnerVideo ? 'Their local safety limits and permissions always win.' : 'Waiting for your partner to enable control.';
  $('#manual').disabled = !state.partnerManual;
  $('#touchPad').classList.toggle('disabled', !state.partnerManual || !state.partnerToy.connected);
  $$('[data-pattern]').forEach(button => { button.disabled = !state.partnerManual || !state.partnerToy.connected; });
  renderToyState();
}

function setPartnerOutput(value) { state.partnerOutput = Math.max(0,Math.min(20,Math.round(Number(value)||0))); $('#liveOutput').textContent=state.partnerOutput; $('#touchOutput').textContent=state.partnerOutput; }
function sampleWave() { const now=performance.now(); if(now-state.waveSampleAt<80)return; state.waveSampleAt=now; state.waveMine.push(state.localOutput);state.wavePartner.push(state.partnerOutput);if(state.waveMine.length>160)state.waveMine.shift();if(state.wavePartner.length>160)state.wavePartner.shift(); }
function drawWave(canvas) {
  if(!canvas)return;const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.max(1,Math.min(2,devicePixelRatio||1));const W=Math.round(r.width*dpr),H=Math.round(r.height*dpr);if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}const c=canvas.getContext('2d');c.clearRect(0,0,W,H);c.save();c.scale(dpr,dpr);c.strokeStyle='rgba(255,255,255,.06)';c.lineWidth=1;for(let i=1;i<4;i++){const y=r.height*i/4;c.beginPath();c.moveTo(0,y);c.lineTo(r.width,y);c.stroke()}
  const line=(vals,color,glow)=>{c.save();c.strokeStyle=color;c.lineWidth=2.3;c.shadowColor=glow;c.shadowBlur=9;c.beginPath();vals.forEach((v,i)=>{const x=i/(vals.length-1)*r.width,y=r.height-5-(Math.max(0,Math.min(20,v))/20)*(r.height-10);i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke();c.restore()};
  line(state.waveMine,'rgba(255,90,168,.85)','#ff5aa8');line(state.wavePartner,'rgba(168,121,255,1)','#a879ff');c.restore();
}
function waveLoop(){sampleWave();drawWave($('#vibeCanvas'));requestAnimationFrame(waveLoop)}

function setTouchValue(value, emit=true, force=false){const v=Math.max(0,Math.min(20,Math.round(Number(value)||0)));$('#manual').value=v;$('#manualValue').textContent=v;$('#touchOutput').textContent=v;$('#touchFill').style.height=`${v/20*100}%`;$('#touchThumb').style.bottom=`${v/20*100}%`;$('#touchPad').setAttribute('aria-valuenow',v);if(emit)remote(v,'manual',force)}
function touchIntensity(event){const r=$('#touchPad').getBoundingClientRect();const y=Math.max(0,Math.min(r.height,event.clientY-r.top));return Math.round((1-y/r.height)*20)}

function openRelaySocket(created, attempt=0) {
  const ws = new WebSocket(wsUrl()); state.ws=ws;state.joined=false;let opened=false;
  const timer=setTimeout(()=>{if(!opened&&ws.readyState!==WebSocket.OPEN)try{ws.close()}catch{}},10000);let ackTimer=null;
  ws.onopen=()=>{opened=true;clearTimeout(timer);$('#connectionHint').textContent=`Secure relay connected: ${new URL(state.relay).host} · joining session…`;send({type:'ping',clientTime:Date.now()});sendLocalToyState();send({type:'control-permission',allowed:false,maxIntensity:0,videoAllowed:false,videoMaxIntensity:0});ackTimer=setTimeout(()=>{if(state.ws===ws&&!state.joined){$('#inviteState').textContent='Relay connected · waiting for session acknowledgement…';$('#connectionHint').textContent='The secure WebSocket is open, but the relay has not acknowledged the session yet.'}},4500)};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}handle(m)};
  ws.onerror=()=>{};
  ws.onclose=e=>{clearTimeout(timer);if(ackTimer)clearTimeout(ackTimer);if(state.ws!==ws)return;if(!opened&&attempt<2){$('#connectionHint').textContent=`Relay is warming up; retrying ${attempt+2}/3…`;setTimeout(()=>openRelaySocket(created,attempt+1),1200*(attempt+1));return}state.ws=null;state.joined=false;state.partner=null;state.partnerToy={connected:false,name:null,battery:null};setPartnerOutput(0);$('#sessionPanel').classList.add('hidden');$('#heroTitle').textContent='Session disconnected';stopVideo();stopPattern(false);renderToyState();const detail=e.code===1006?'The tunnel is offline, expired, blocked, or not WebSocket-ready.':'Connection closed'+(e.reason?`: ${e.reason}`:'.');$('#connectionHint').textContent=detail;if(!opened)toast(detail,true)};
}
async function connect(created=false) {
  state.name=$('#name').value.trim().slice(0,40)||'Guest';localStorage.pulselinkName=state.name;state.relay=normalizeRelay($('#relay').value)||state.relay;
  if(!state.relay)return toast('Enter the public relay URL.',true);if(!state.token)return toast('Enter an invite code.',true);localStorage.pulselinkRelay=state.relay;$('#relay').value=state.relay;$('#invitePanel').classList.remove('hidden');$('#inviteState').textContent=created?'Checking relay…':'Checking invitation relay…';$('#connectionHint').textContent=`Checking ${new URL(state.relay).host}…`;
  const health=await relayHealth(state.relay);if(!health.ok){$('#inviteState').textContent=created?'Waiting for partner…':'Joining…';$('#connectionHint').textContent=`HTTP relay check unavailable (${health.error}); trying secure WebSocket directly…`;openRelaySocket(created);return}$('#inviteState').textContent=created?'Waiting for partner…':'Joining…';$('#connectionHint').textContent=`Relay online · v${health.data.version||'unknown'} · opening secure session…`;openRelaySocket(created);
}

function handle(m) {
  if(m.type==='welcome'||m.type==='presence'){
    state.joined=true;const list=m.participants||[];state.partner=list.find(x=>x.id!==state.clientId)||null;
    if(state.partner){$('#partnerName').textContent=state.partner.name;$('#sessionPanel').classList.remove('hidden');$('#heroTitle').textContent=`Connected with ${state.partner.name}`;$('#heroText').textContent='Touch control, live vibration feedback, and video sync share one private session.';$('#inviteState').textContent='Connected';$('#connectionHint').textContent=`Session joined securely through ${new URL(state.relay).host}`;sendLocalToyState();renderPermissions()}
    else{$('#inviteState').textContent='Joined · waiting for host…';$('#connectionHint').textContent=`Secure relay joined through ${new URL(state.relay).host}. Waiting for the host application to join this invite.`}
    return;
  }
  if(m.type==='toy-state'){state.partnerToy={connected:!!m.connected,name:m.name?String(m.name).slice(0,80):null,battery:Number.isFinite(Number(m.battery))?Math.max(0,Math.min(100,Number(m.battery))):null};if(!state.partnerToy.connected)setPartnerOutput(0);renderToyState();return}
  if(m.type==='toy-output'){setPartnerOutput(m.intensity);return}
  if(m.type==='control-permission'){state.partnerManual=!!m.allowed;state.partnerManualCap=Math.max(0,Math.min(20,+m.maxIntensity||0));state.partnerVideo=!!m.videoAllowed;state.partnerVideoCap=Math.max(0,Math.min(20,+m.videoMaxIntensity||0));renderPermissions();return}
  if(m.type==='chat'){addMsg(m.text||'',false,m.fromName||'Partner');return}
  if(m.type==='stop-request'){toast('Partner requested STOP.');stopVideo();stopPattern();setTouchValue(0,false);return}
  if(m.type==='pong')return;
  if(m.type==='session-ended'){toast('Session ended.');state.ws?.close();return}
}

function remote(value, source='manual', force=false) {
  let v=Math.max(0,Math.min(20,Math.round(value)));const now=performance.now();if(!force&&v===state.lastSent&&now-state.lastSentAt<150)return;
  if(!state.partnerToy.connected){if(v>0)toast("Waiting for user's Toy…",true);return}
  state.lastSent=v;state.lastSentAt=now;
  if(source==='video'){if(!state.partnerVideo)return;v=Math.min(v,state.partnerVideoCap);send({type:'video-frame',intensity:v,source,sequence:++state.seq,clientTime:Date.now()})}
  else{if(!state.partnerManual)return;v=Math.min(v,state.partnerManualCap);send({type:'control',intensity:v,source,sequence:++state.seq,clientTime:Date.now()})}
  setPartnerOutput(v);
}
function addMsg(text,mine=false,name='System'){const d=document.createElement('div'),a=document.createElement('small'),b=document.createElement('span');d.className='msg'+(mine?' mine':'');a.textContent=name;b.textContent=text;d.append(a,b);$('#messages').append(d);$('#messages').scrollTop=99999}
function stopPattern(sendZero=true){if(state.pattern)clearInterval(state.pattern);state.pattern=null;if(sendZero)remote(0,'manual',true)}
function startPattern(name){if(!state.partnerToy.connected)return toast("Waiting for user's Toy…",true);if(!state.partnerManual)return toast('Your partner has not enabled manual control.',true);stopPattern(false);let i=0;const map={pulse:[0,10,10,0,0],wave:[2,5,8,11,8,5],tease:[1,2,3,5,8,3,1]};state.pattern=setInterval(()=>{const v=name==='random'?Math.floor(Math.random()*13):map[name][i++%map[name].length];setTouchValue(Math.min(v,state.partnerManualCap),false);remote(v,'manual')},280)}

async function startVideo(){if(!state.partnerToy.connected)return toast("Waiting for user's Toy…",true);if(!state.partnerVideo)return toast('Your partner has not enabled video control.',true);stopVideo(false);try{state.stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:15,max:30}},audio:true,preferCurrentTab:true,selfBrowserSurface:'exclude',surfaceSwitching:'include',systemAudio:'include'});const video=$('#captureVideo');video.srcObject=state.stream;await video.play();const tracks=state.stream.getAudioTracks();if(tracks.length){state.audioContext=new AudioContext();const source=state.audioContext.createMediaStreamSource(new MediaStream(tracks));state.analyser=state.audioContext.createAnalyser();state.analyser.fftSize=1024;state.analyser.smoothingTimeConstant=.35;state.timeData=new Uint8Array(state.analyser.fftSize);state.freqData=new Uint8Array(state.analyser.frequencyBinCount);source.connect(state.analyser)}state.stream.getTracks().forEach(t=>t.addEventListener('ended',()=>stopVideo(),{once:true}));state.media=true;state.timer=setInterval(analyze,90);$('#mediaBadge').textContent='ON';$('#mediaBadge').classList.remove('off');$('#videoStatus').textContent=tracks.length?'Video sync running with shared audio.':'Video sync running without an audio track.';send({type:'video-state',enabled:true})}catch(e){stopVideo(false);toast(e.message||String(e),true)}}
function stopVideo(sendZero=true){if(state.timer)clearInterval(state.timer);state.timer=null;if(state.stream)state.stream.getTracks().forEach(t=>t.stop());state.stream=null;if(state.audioContext)state.audioContext.close().catch(()=>{});state.audioContext=null;state.analyser=null;state.previous=null;state.smMotion=state.smAudio=state.lastEnergy=state.smooth=0;state.media=false;$('#captureVideo').srcObject=null;$('#mediaBadge').textContent='OFF';$('#mediaBadge').classList.add('off');$('#videoStatus').textContent='Select a browser tab and enable Share tab audio for full audio response.';if(sendZero)remote(0,'video',true);send({type:'video-state',enabled:false})}
function analyze(){const video=$('#captureVideo'),canvas=$('#captureCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});if(!state.stream||video.readyState<2)return;ctx.drawImage(video,0,0,canvas.width,canvas.height);const px=ctx.getImageData(0,0,canvas.width,canvas.height).data,g=new Uint8Array(canvas.width*canvas.height);let d=0;for(let i=0,p=0;i<px.length;i+=4,p++){const x=(px[i]*.299+px[i+1]*.587+px[i+2]*.114)|0;g[p]=x;if(state.previous)d+=Math.abs(x-state.previous[p])}state.previous=g;const motion=Math.min(1,d/(g.length*34));state.smMotion=state.smMotion*.65+motion*.35;let rms=0,bass=0;if(state.analyser){state.analyser.getByteTimeDomainData(state.timeData);state.analyser.getByteFrequencyData(state.freqData);for(const x of state.timeData){const n=(x-128)/128;rms+=n*n}rms=Math.min(1,Math.sqrt(rms/state.timeData.length)*3.6);const bins=Math.max(1,Math.floor(state.freqData.length*.12));for(let i=0;i<bins;i++)bass+=state.freqData[i]/255;bass/=bins}state.smAudio=state.smAudio*.7+rms*.3;const energy=Math.min(1,state.smAudio*.65+bass*.5),beat=Math.max(0,Math.min(1,(energy-state.lastEnergy*.82)*2.4));state.lastEnergy=energy;let raw=state.mode==='motion'?state.smMotion:state.mode==='audio'?state.smAudio:state.mode==='beat'?Math.min(1,beat*1.9):Math.min(1,state.smMotion*.52+state.smAudio*.28+beat*.55);raw=Math.min(1,raw*(+$('#sensitivity').value/100));const sm=+$('#smoothing').value/100;state.smooth=state.smooth*sm+raw*(1-sm);const v=Math.round(state.smooth*Math.min(+$('#videoMax').value,state.partnerVideoCap));$('#motionValue').textContent=Math.round(state.smMotion*100)+'%';$('#audioValue').textContent=Math.round(state.smAudio*100)+'%';$('#beatValue').textContent=Math.round(beat*100)+'%';$('#outputValue').textContent=v;$('#motionMeter').style.width=state.smMotion*100+'%';$('#audioMeter').style.width=state.smAudio*100+'%';$('#beatMeter').style.width=beat*100+'%';$('#outputMeter').style.width=v/20*100+'%';remote(v,'video')}

function bind(){
  $('#name').value=state.name;const initial=hashInvite();if(initial){state.token=initial.token;state.relay=initial.relay||normalizeRelay(cfg.relayBase)||normalizeRelay(localStorage.pulselinkRelay)||'';$('#invite').value=state.token;$('#relay').value=state.relay;$('#connectionHint').textContent='Invitation loaded. Enter your display name and join.'}else{$('#relay').value=normalizeRelay(cfg.relayBase)||normalizeRelay(localStorage.pulselinkRelay)||''}
  $('#join').onclick=()=>{const inv=parseInvite($('#invite').value)||{token:state.token,relay:null};if(!inv?.token)return toast('Paste a valid invite.',true);state.token=inv.token;if(inv.relay)$('#relay').value=inv.relay;connect(false)};
  $('#create').onclick=()=>{state.relay=normalizeRelay($('#relay').value);if(!state.relay)return toast('Enter a public relay URL first.',true);state.token=randomToken(32);$('#invite').value=state.token;$('#inviteLink').value=inviteLink(state.token);connect(true)};
  $('#copy').onclick=async()=>{await navigator.clipboard.writeText($('#inviteLink').value);toast('Invite copied.')};
  $('#manual').oninput=e=>{stopPattern(false);setTouchValue(+e.target.value,true)};
  const pad=$('#touchPad');pad.addEventListener('pointerdown',e=>{if(!state.partnerToy.connected||!state.partnerManual)return;e.preventDefault();state.touchActive=true;pad.classList.add('active');try{pad.setPointerCapture(e.pointerId)}catch{}setTouchValue(touchIntensity(e),true,true)});pad.addEventListener('pointermove',e=>{if(!state.touchActive)return;e.preventDefault();setTouchValue(touchIntensity(e),true)});const end=e=>{if(!state.touchActive)return;state.touchActive=false;pad.classList.remove('active');try{pad.releasePointerCapture(e.pointerId)}catch{}setTouchValue(0,true,true)};pad.addEventListener('pointerup',end);pad.addEventListener('pointercancel',end);
  $$('[data-pattern]').forEach(b=>b.onclick=()=>startPattern(b.dataset.pattern));$('#stopPattern').onclick=()=>{stopPattern(false);setTouchValue(0,true,true)};
  $('#mode').onclick=e=>{const b=e.target.closest('button');if(!b)return;state.mode=b.dataset.value;$$('#mode button').forEach(x=>x.classList.toggle('active',x===b))};
  ['sensitivity','smoothing','videoMax'].forEach(id=>$('#'+id).oninput=()=>$('#'+id+'Value').textContent=$('#'+id).value+(id==='sensitivity'||id==='smoothing'?'%':''));
  $('#startVideo').onclick=startVideo;$('#stopVideo').onclick=()=>stopVideo();
  $('#panic').onclick=()=>{stopVideo();stopPattern(false);send({type:'stop-request'});remote(0,'manual',true);setTouchValue(0,false);toast('STOP sent.')};
  $('#chatForm').onsubmit=e=>{e.preventDefault();const t=$('#chatInput').value.trim();if(t&&send({type:'chat',text:t})){addMsg(t,true,state.name||'You');$('#chatInput').value=''}};
  $('#end').onclick=()=>{send({type:'session-end'});state.ws?.close();stopVideo();stopPattern(false)};
  renderPermissions();renderToyState();setTouchValue(0,false);requestAnimationFrame(waveLoop);
}
bind();
