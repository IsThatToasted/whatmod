const PREF_KEY = "whatmod_trivia_experience_v13";
const defaults = { sfx: true, volume: 0.38, motion: true, haptics: true };
let prefs = loadPrefs();
let ctx = null;
let noiseBuffer = null;
let lastHoverAt = 0;
let bound = false;

function loadPrefs(){
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(PREF_KEY)||"{}")||{}) }; }
  catch { return { ...defaults }; }
}
function save(){ try{ localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }catch{} }
export function getExperiencePrefs(){ return { ...prefs }; }
export function setExperiencePrefs(patch={}){
  prefs = { ...prefs, ...patch };
  prefs.volume = Math.max(0, Math.min(1, Number(prefs.volume ?? defaults.volume)));
  save(); applyExperiencePrefs();
  return getExperiencePrefs();
}
export function applyExperiencePrefs(){
  document.documentElement.dataset.motion = prefs.motion ? "full" : "reduced";
  document.documentElement.dataset.sfx = prefs.sfx ? "on" : "off";
}
applyExperiencePrefs();

function audio(){
  if(!prefs.sfx) return null;
  try{
    ctx ||= new (window.AudioContext||window.webkitAudioContext)();
    if(ctx.state === "suspended") ctx.resume().catch(()=>{});
    return ctx;
  }catch{return null}
}
function tone(freq=440,duration=.08,{type="sine",gain=.12,detune=0,when=0,slide=0}={}){
  const c=audio(); if(!c) return;
  const t=c.currentTime+when, o=c.createOscillator(), g=c.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t); o.detune.setValueAtTime(detune,t);
  if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),t+duration);
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(Math.max(.0001,gain*prefs.volume),t+.008); g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t+duration+.02);
}
function noise(duration=.09,{gain=.08,when=0,highpass=1000}={}){
  const c=audio(); if(!c) return;
  if(!noiseBuffer){
    noiseBuffer=c.createBuffer(1,Math.floor(c.sampleRate*.45),c.sampleRate);
    const d=noiseBuffer.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  }
  const s=c.createBufferSource(), f=c.createBiquadFilter(), g=c.createGain(), t=c.currentTime+when;
  s.buffer=noiseBuffer; f.type="highpass"; f.frequency.value=highpass;
  g.gain.setValueAtTime(Math.max(.0001,gain*prefs.volume),t); g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t+duration+.01);
}
export function playSfx(name="click"){
  if(!prefs.sfx) return;
  if(name==="hover"){ tone(880,.025,{type:"sine",gain:.035,slide:90}); return; }
  if(name==="nav"){ tone(320,.055,{type:"triangle",gain:.08,slide:160}); tone(640,.04,{type:"sine",gain:.04,when:.03}); return; }
  if(name==="click"){ tone(180,.04,{type:"square",gain:.045,slide:80}); return; }
  if(name==="select"){ tone(510,.045,{type:"triangle",gain:.07}); tone(760,.055,{type:"sine",gain:.05,when:.035}); return; }
  if(name==="lock"){ noise(.07,{gain:.08,highpass:1800}); tone(210,.08,{type:"square",gain:.07,slide:230}); tone(720,.12,{type:"triangle",gain:.08,when:.045,slide:220}); return; }
  if(name==="reveal"){ noise(.16,{gain:.06,highpass:650}); tone(120,.18,{type:"sawtooth",gain:.055,slide:240}); tone(520,.17,{type:"triangle",gain:.07,when:.08,slide:180}); return; }
  if(name==="success"){ [523,659,784,1046].forEach((f,i)=>tone(f,.16,{type:"triangle",gain:.075,when:i*.055})); return; }
  if(name==="win"){ noise(.25,{gain:.07,highpass:1200}); [392,523,659,784,1046].forEach((f,i)=>tone(f,.23,{type:"triangle",gain:.085,when:i*.07})); return; }
  if(name==="error"){ tone(180,.11,{type:"sawtooth",gain:.08,slide:-70}); tone(130,.13,{type:"square",gain:.05,when:.06}); }
}
function haptic(ms=12){ if(prefs.haptics && navigator.vibrate) navigator.vibrate(ms); }

export function bindGameFeel(){
  if(bound) return; bound=true;
  document.addEventListener("pointerdown",e=>{
    const el=e.target.closest("button,[data-nav],.choice,.theme-choice"); if(!el) return;
    audio();
    const action=el.dataset.action||"";
    if(el.matches(".lock-btn,[type=submit]")||action.includes("submit")||action.includes("answer")) playSfx("lock");
    else if(el.matches("[data-nav]")) playSfx("nav"); else playSfx("click");
    haptic(el.matches(".lock-btn,.play-btn")?18:8);
    if(document.documentElement.dataset.uiTheme==="v2") ripple(el,e.clientX,e.clientY);
  },{passive:true});
  document.addEventListener("pointerover",e=>{
    if(document.documentElement.dataset.uiTheme!=="v2"||!prefs.motion) return;
    const el=e.target.closest("button,.v2-mode-card,.play-card,.choice"); if(!el) return;
    const now=performance.now(); if(now-lastHoverAt<90) return; lastHoverAt=now; playSfx("hover");
  },{passive:true});
}
function ripple(el,x,y){
  if(!prefs.motion||!el?.getBoundingClientRect) return;
  const r=el.getBoundingClientRect(), s=document.createElement("i");
  s.className="v2-ripple"; s.style.left=`${x-r.left}px`; s.style.top=`${y-r.top}px`; el.appendChild(s); setTimeout(()=>s.remove(),620);
}

export function enhanceV2(root=document){
  if(document.documentElement.dataset.uiTheme!=="v2"||!prefs.motion) return;
  root.querySelectorAll(".v2-tilt,.v2-mode-card,.champ-card").forEach(el=>{
    if(el.dataset.tiltBound==="1") return; el.dataset.tiltBound="1";
    el.addEventListener("pointermove",ev=>{
      if(ev.pointerType==="touch") return;
      const r=el.getBoundingClientRect(), px=(ev.clientX-r.left)/r.width-.5, py=(ev.clientY-r.top)/r.height-.5;
      el.style.setProperty("--rx",`${(-py*5).toFixed(2)}deg`); el.style.setProperty("--ry",`${(px*7).toFixed(2)}deg`); el.style.setProperty("--mx",`${((px+.5)*100).toFixed(1)}%`); el.style.setProperty("--my",`${((py+.5)*100).toFixed(1)}%`);
    });
    el.addEventListener("pointerleave",()=>{el.style.setProperty("--rx","0deg");el.style.setProperty("--ry","0deg")});
  });
}

let lastCelebration="";
export function celebrate(key="default",power=1){
  if(!prefs.motion||lastCelebration===key) return; lastCelebration=key;
  const layer=document.createElement("div"); layer.className="v2-celebration";
  const count=Math.round(24+power*18);
  for(let i=0;i<count;i++){
    const p=document.createElement("i"); p.style.setProperty("--x",`${Math.random()*100}%`); p.style.setProperty("--d",`${(Math.random()*.45).toFixed(2)}s`); p.style.setProperty("--r",`${Math.round(Math.random()*420-210)}deg`); p.style.setProperty("--s",`${(.55+Math.random()*.9).toFixed(2)}`); layer.appendChild(p);
  }
  document.body.appendChild(layer); setTimeout(()=>layer.remove(),2600);
}
