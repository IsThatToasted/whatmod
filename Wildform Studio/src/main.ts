import './style.css';
import type { AnimationClip, Bone, Transform2D, WildformProject } from './types';
import { createDefaultRig, createProject, uid } from './state';
import { analyzeImage } from './import/ImageAnalyzer';
import { generateRecipe, sampleTransform, type Recipe } from './animation/Recipes';
import { Viewport2D } from './renderer/Viewport2D';
import { Viewport3D } from './renderer/Viewport3D';

let project:WildformProject=createProject();
let selectedBoneId:string|null=project.bones.find(b=>b.name==='Head')?.id||null;
let currentTime=0, playing=false, lastFrame=performance.now(), view:'2d'|'3d'='2d';
const logs:string[]=['Wildform Studio ready. Import a creature image or model to begin.'];

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<div class="app">
<header class="topbar"><div class="brand"><b>WILDFORM</b> STUDIO</div>
<div class="toolbar-group"><button id="newBtn">New</button><button id="openBtn">Open</button><button id="saveBtn">Save Project</button></div>
<div class="toolbar-group"><button class="primary" id="importImageBtn">Import Image / Sheet</button><button id="importModelBtn">Import 3D</button></div>
<div class="spacer"></div><span class="badge">Creature Animation Toolchain</span><button id="exportBtn">Export Animation</button></header>
<section class="workspace"><aside class="panel"><div class="panel-title">CREATURE / ASSETS</div><div id="assetList"></div><div class="panel-title">RIG</div><div id="boneList"></div></aside>
<main class="viewport-wrap"><div class="view-tabs"><button id="tab2d" class="view-tab active">2D Rig</button><button id="tab3d" class="view-tab">3D Preview</button></div><div class="status-chip" id="statusChip">Ready</div><div id="view2d" class="viewport"><canvas id="canvas2d"></canvas></div><div id="view3d" class="viewport hidden"></div></main>
<aside class="panel right"><div id="inspector"></div></aside></section>
<section class="timeline"><div class="timeline-head"><button id="playBtn">▶</button><button id="rewindBtn">⏮</button><span id="timeLabel">0.00s</span><input id="scrubber" class="slider" type="range" min="0" max="1.5" step="0.001" value="0"><select id="clipSelect"></select><button id="addKeyBtn" class="primary">◆ Key</button><button id="addEventBtn">+ Event</button><span class="footer-hint">Space: play/pause • K: key • drag 3D view to orbit</span></div><div id="timelineBody" class="timeline-body"></div></section>
</div>`;

const canvas=document.querySelector<HTMLCanvasElement>('#canvas2d')!;const v2=new Viewport2D(canvas);const v3=new Viewport3D(document.querySelector<HTMLElement>('#view3d')!);
const $=<T extends Element>(s:string)=>document.querySelector<T>(s)!;
const clip=()=>project.clips.find(c=>c.id===project.activeClipId)||project.clips[0];

function log(msg:string){logs.unshift(`${new Date().toLocaleTimeString()}  ${msg}`);logs.splice(8);renderInspector();}
function updateStatus(s:string){$('#statusChip').textContent=s;}
function activeTransforms(){const m=new Map<string,Transform2D>();for(const b of project.bones)m.set(b.id,sampleTransform(clip(),b.id,currentTime,b.transform));return m;}

function render(){renderAssets();renderBones();renderInspector();renderTimeline();renderClipSelect();draw();}
function renderAssets(){const host=$('#assetList');host.innerHTML='';
  if(!project.images.length&&!project.models.length)host.innerHTML='<div class="empty">Import art to begin. Images can be single creatures, separated parts, or transparent sprite sheets.</div>';
  for(const a of project.images){const d=document.createElement('div');d.className='asset-row';d.innerHTML=`<span class="dot"></span><span>${esc(a.name)}</span><span class="badge">${a.regions.length} region${a.regions.length===1?'':'s'}</span>`;host.appendChild(d);}
  for(const a of project.models){const d=document.createElement('div');d.className='asset-row';d.innerHTML=`<span class="dot"></span><span>${esc(a.name)}</span><span class="badge">3D</span>`;host.appendChild(d);}
}
function renderBones(){const host=$('#boneList');host.innerHTML='';for(const b of project.bones){const d=document.createElement('div');d.className='bone-row'+(b.id===selectedBoneId?' active':'');d.innerHTML=`<span class="dot"></span><span>${esc(b.name)}</span>`;d.onclick=()=>{selectedBoneId=b.id;renderBones();renderInspector();draw();};host.appendChild(d);}}
function renderInspector(){const host=$('#inspector');const bone=project.bones.find(b=>b.id===selectedBoneId);const c=clip();
 host.innerHTML=`<div class="panel-title">ANIMATION RECIPES</div><div class="section"><h3>Generate editable motion</h3><div class="recipe-grid">${(['Idle','Walk','Run','Jump','Celebrate','Attack'] as Recipe[]).map(r=>`<button data-recipe="${r}">${r}</button>`).join('')}</div><p class="tiny">Recipes create ordinary keyframes; you can edit them afterward.</p></div>
 <div class="panel-title">BONE INSPECTOR</div><div class="section">${bone?boneInspector(bone):'<div class="empty">Select a bone.</div>'}</div>
 <div class="panel-title">CLIP</div><div class="section"><div class="field"><label>Name</label><input id="clipName" value="${escAttr(c.name)}"></div><div class="field"><label>Duration</label><input id="clipDuration" type="number" min="0.1" step="0.1" value="${c.duration}"></div><div class="field"><label>FPS</label><input id="clipFps" type="number" min="1" max="120" value="${c.fps}"></div><div class="field"><label>Loop</label><input id="clipLoop" type="checkbox" ${c.loop?'checked':''}></div></div>
 <div class="panel-title">PROJECT ASSISTS</div><div class="section"><div class="field"><label>Auto Key</label><input id="autoKey" type="checkbox" ${project.settings.autoKey?'checked':''}></div><div class="field"><label>Foot Lock</label><input id="footLock" type="checkbox" ${project.settings.footLock?'checked':''}></div><div class="field"><label>Ground Y</label><input id="groundY" type="number" value="${project.settings.groundY}"></div><button id="resetRigBtn">Reset Standard Rig</button></div>
 <div class="panel-title">ACTIVITY</div><div class="section"><div class="log">${logs.map(esc).join('<br>')}</div></div>`;
 host.querySelectorAll<HTMLButtonElement>('[data-recipe]').forEach(b=>b.onclick=()=>applyRecipe(b.dataset.recipe as Recipe));
 if(bone)bindBoneInputs(bone); bindClipInputs();
 const reset=$<HTMLButtonElement>('#resetRigBtn');reset.onclick=()=>{project.bones=createDefaultRig();selectedBoneId=project.bones[0].id;log('Standard Wildform biped rig reset.');render();};
 bindCheck('#autoKey',v=>project.settings.autoKey=v);bindCheck('#footLock',v=>project.settings.footLock=v);$('#groundY').addEventListener('change',(e:any)=>{project.settings.groundY=+e.target.value;draw();});
}
function boneInspector(b:Bone){const t=activeTransforms().get(b.id)||b.transform;return `<h3>${esc(b.name)}</h3>${numField('X','boneX',t.x,.5)}${numField('Y','boneY',t.y,.5)}${numField('Rotation°','boneRot',t.rotation*180/Math.PI,.5)}${numField('Scale X','boneSX',t.scaleX,.01)}${numField('Scale Y','boneSY',t.scaleY,.01)}<button id="zeroBoneBtn">Zero transform</button>`;}
function numField(label:string,id:string,val:number,step:number){return `<div class="field"><label>${label}</label><input id="${id}" type="number" step="${step}" value="${Number(val.toFixed(3))}"></div>`;}
function bindBoneInputs(b:Bone){const ids=['boneX','boneY','boneRot','boneSX','boneSY'];ids.forEach(id=>$('#'+id).addEventListener('change',()=>{
 const t=activeTransforms().get(b.id)||{...b.transform};t.x=+($('#boneX') as HTMLInputElement).value;t.y=+($('#boneY') as HTMLInputElement).value;t.rotation=+($('#boneRot') as HTMLInputElement).value*Math.PI/180;t.scaleX=+($('#boneSX') as HTMLInputElement).value;t.scaleY=+($('#boneSY') as HTMLInputElement).value;
 if(project.settings.autoKey)addKeyframe(b.id,t);else b.transform={...t}; draw();renderTimeline();}));
 $('#zeroBoneBtn').addEventListener('click',()=>{const t={x:0,y:0,rotation:0,scaleX:1,scaleY:1};if(project.settings.autoKey)addKeyframe(b.id,t);else b.transform=t;renderInspector();draw();});
}
function bindClipInputs(){($('#clipName') as HTMLInputElement).onchange=e=>{clip().name=(e.target as HTMLInputElement).value;renderClipSelect();};($('#clipDuration') as HTMLInputElement).onchange=e=>{clip().duration=Math.max(.1,+(e.target as HTMLInputElement).value);syncScrubber();renderTimeline();};($('#clipFps') as HTMLInputElement).onchange=e=>clip().fps=Math.max(1,+(e.target as HTMLInputElement).value);($('#clipLoop') as HTMLInputElement).onchange=e=>clip().loop=(e.target as HTMLInputElement).checked;}
function bindCheck(sel:string,fn:(v:boolean)=>void){(document.querySelector(sel) as HTMLInputElement).onchange=e=>fn((e.target as HTMLInputElement).checked);}
function addKeyframe(boneId?:string,t?:Transform2D){const id=boneId||selectedBoneId;if(!id)return;const c=clip(),base=t||activeTransforms().get(id)||project.bones.find(b=>b.id===id)!.transform;const snap=1/c.fps,time=Math.round(currentTime/snap)*snap;const existing=c.keyframes.find(k=>k.boneId===id&&Math.abs(k.time-time)<snap*.2);if(existing)existing.transform={...base};else c.keyframes.push({id:uid('key'),time,boneId:id,transform:{...base},easing:'easeInOut'});updateStatus(`Keyed ${project.bones.find(b=>b.id===id)?.name} @ ${time.toFixed(2)}s`);}
function applyRecipe(r:Recipe){const generated=generateRecipe(r,project.bones);const idx=project.clips.findIndex(c=>c.name===r);if(idx>=0)project.clips[idx]=generated;else project.clips.push(generated);project.activeClipId=generated.id;currentTime=0;syncScrubber();log(`Generated ${r} recipe with ${generated.keyframes.length} keyframes.`);render();}
function renderClipSelect(){const s=$<HTMLSelectElement>('#clipSelect');s.innerHTML=project.clips.map(c=>`<option value="${c.id}" ${c.id===project.activeClipId?'selected':''}>${esc(c.name)}</option>`).join('');s.onchange=()=>{project.activeClipId=s.value;currentTime=0;syncScrubber();render();};}
function renderTimeline(){const host=$('#timelineBody'),c=clip();const scale=650/Math.max(.1,c.duration);let html=`<div class="ruler" style="width:${150+c.duration*scale+80}px">`;
 for(let t=0;t<=c.duration+.001;t+=Math.max(.1,Math.round(c.duration/10*10)/10)){html+=`<span style="position:absolute;left:${150+t*scale}px;top:7px;font-size:10px;color:#71847c">${t.toFixed(1)}</span>`;}html+='</div>';
 for(const b of project.bones){const ks=c.keyframes.filter(k=>k.boneId===b.id);if(!ks.length&&b.id!==selectedBoneId)continue;html+=`<div class="track" style="width:${150+c.duration*scale+80}px"><div class="track-label">${esc(b.name)}</div>${ks.map(k=>`<div class="key" title="${k.time.toFixed(3)}s" style="left:${146+k.time*scale}px"></div>`).join('')}</div>`;}
 for(const e of c.events){html+=`<div class="track" style="width:${150+c.duration*scale+80}px"><div class="track-label">⚡ ${esc(e.name)}</div><div class="key" style="left:${146+e.time*scale}px;background:#ffb86c"></div></div>`;}
 html+=`<div class="playhead" id="playhead" style="left:${150+currentTime*scale}px"></div>`;host.innerHTML=html;}
function syncScrubber(){const s=$<HTMLInputElement>('#scrubber');s.max=String(clip().duration);s.value=String(Math.min(currentTime,clip().duration));$('#timeLabel').textContent=`${currentTime.toFixed(2)}s`;}
function draw(){syncScrubber();if(view==='2d')v2.draw(project.images,project.bones,activeTransforms(),selectedBoneId,project.settings.groundY,currentTime);}
async function importImages(){if(!window.wildformDesktop){log('Desktop bridge unavailable. Run with Electron.');return;}const files=await window.wildformDesktop.openFiles({multiple:true,filters:[{name:'Images',extensions:['png','jpg','jpeg','webp','gif']}]});for(const f of files){updateStatus(`Analyzing ${f.name}…`);const dataUrl=f.dataUrl.replace('data:application/octet-stream','data:image/'+(f.ext==='.jpg'||f.ext==='.jpeg'?'jpeg':f.ext.slice(1)));const result=await analyzeImage(f.name,dataUrl);project.images.push(result.asset);await v2.ensureImage(result.asset);log(`${f.name}: ${result.notes.join(' ')}`);}if(files.length){const first=project.images.at(-1)!;project.bones=createDefaultRig(700,700);selectedBoneId=project.bones.find(b=>b.name==='Head')?.id||project.bones[0].id;updateStatus('Image analysis complete');render();}}
async function importModel(){if(!window.wildformDesktop)return;const files=await window.wildformDesktop.openFiles({multiple:false,filters:[{name:'3D Models',extensions:['glb','gltf','obj']}]});if(!files[0])return;const f=files[0];try{await v3.load(f.name,f.ext,f.dataUrl);project.models.push({id:uid('model'),name:f.name,dataUrl:f.dataUrl,ext:f.ext});view='3d';switchView();log(`Loaded 3D model ${f.name}.`);}catch(e:any){log(`3D import failed: ${e.message}`);}renderAssets();}
async function saveProject(){if(!window.wildformDesktop)return;const path=await window.wildformDesktop.saveText({defaultName:`${safe(project.name)}.wildform.json`,filters:[{name:'Wildform Project',extensions:['json']}],text:JSON.stringify(project,null,2)});if(path)log(`Saved project: ${path}`);}
async function openProject(){if(!window.wildformDesktop)return;const f=await window.wildformDesktop.loadText({filters:[{name:'Wildform Project',extensions:['json']}]});if(!f)return;try{project=JSON.parse(f.text);selectedBoneId=project.bones[0]?.id||null;currentTime=0;for(const a of project.images)await v2.ensureImage(a);log(`Opened ${f.name}.`);render();}catch{log('Could not parse that Wildform project.');}}
async function exportAnimation(){if(!window.wildformDesktop)return;const c=clip();const payload={format:'wildform-animation',version:1,skeleton:project.bones.map(b=>({id:b.id,name:b.name,parentId:b.parentId,start:b.start,end:b.end})),clip:c};const path=await window.wildformDesktop.saveText({defaultName:`${safe(c.name)}.wildanim.json`,filters:[{name:'Wildform Animation',extensions:['json']}],text:JSON.stringify(payload,null,2)});if(path)log(`Exported ${c.name}.`);}
function switchView(){const is2=view==='2d';$('#view2d').classList.toggle('hidden',!is2);$('#view3d').classList.toggle('hidden',is2);$('#tab2d').classList.toggle('active',is2);$('#tab3d').classList.toggle('active',!is2);if(is2)draw();}

$('#newBtn').addEventListener('click',()=>{project=createProject();selectedBoneId=project.bones[0].id;currentTime=0;logs.unshift('New project created.');render();});$('#openBtn').addEventListener('click',openProject);$('#saveBtn').addEventListener('click',saveProject);$('#importImageBtn').addEventListener('click',importImages);$('#importModelBtn').addEventListener('click',importModel);$('#exportBtn').addEventListener('click',exportAnimation);$('#tab2d').addEventListener('click',()=>{view='2d';switchView();});$('#tab3d').addEventListener('click',()=>{view='3d';switchView();});
$('#playBtn').addEventListener('click',()=>{playing=!playing;$('#playBtn').textContent=playing?'⏸':'▶';});$('#rewindBtn').addEventListener('click',()=>{currentTime=0;draw();renderTimeline();});$('#addKeyBtn').addEventListener('click',()=>{addKeyframe();renderTimeline();});$('#addEventBtn').addEventListener('click',()=>{const name=prompt('Event name','footstep');if(name){clip().events.push({id:uid('evt'),time:currentTime,name});renderTimeline();}});$('#scrubber').addEventListener('input',(e:any)=>{currentTime=+e.target.value;draw();renderTimeline();});
window.addEventListener('keydown',e=>{if((e.target as HTMLElement).tagName==='INPUT')return;if(e.code==='Space'){e.preventDefault();($('#playBtn') as HTMLButtonElement).click();}if(e.key.toLowerCase()==='k'){addKeyframe();renderTimeline();}});
function loop(now:number){const dt=(now-lastFrame)/1000;lastFrame=now;if(playing){currentTime+=dt*project.settings.playbackSpeed;const c=clip();if(currentTime>c.duration){if(c.loop)currentTime%=c.duration;else{currentTime=c.duration;playing=false;$('#playBtn').textContent='▶';}}draw();renderTimeline();}requestAnimationFrame(loop);}requestAnimationFrame(loop);
function esc(v:any){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]!));}function escAttr(v:any){return esc(v);}function safe(v:string){return v.replace(/[^a-z0-9_-]+/gi,'_');}
render();
