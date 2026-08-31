import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, ClipboardList, Clock3, FileText, ShieldCheck, Plus, Upload, X, Check, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthGate';

type ProjectRow={id:string;name:string};
type Kind='photo_progress'|'daily_log'|'punch'|'document'|'safety';
type FieldRecord={
 id:string;project_id:string;record_type:Kind;title:string;notes:string|null;status:string;occurred_at:string;due_at:string|null;
 assignee_name:string|null;weather:string|null;manpower:number|null;work_completed:string|null;blockers:string|null;revision:string|null;
 safety_type:string|null;severity:string|null;acknowledged:boolean;attachment_path:string|null;attachment_name:string|null;
};

const tools=[
 {kind:'photo_progress' as Kind,Icon:Camera,title:'Photos & Progress',copy:'Capture progress, issues and before/after evidence.'},
 {kind:'daily_log' as Kind,Icon:ClipboardList,title:'Daily Log',copy:'Weather, manpower, completed work and blockers.'},
 {kind:'punch' as Kind,Icon:CheckCircle2,title:'Punch & Quality',copy:'Assign deficiencies and close them with a clean record.'},
 {kind:'document' as Kind,Icon:FileText,title:'Plans & Documents',copy:'Keep current scopes, plans, PDFs and revisions with the job.'},
 {kind:'safety' as Kind,Icon:ShieldCheck,title:'Safety',copy:'Toolbox talks, observations, incidents and acknowledgements.'}
];

export function Field(){
 const {user,membership}=useAuth();
 const [projects,setProjects]=useState<ProjectRow[]>([]); const [project,setProject]=useState(''); const [records,setRecords]=useState<FieldRecord[]>([]);
 const [active,setActive]=useState<Kind|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 const selectedProject=projects.find(p=>p.id===project);
 const byKind=(kind:Kind)=>records.filter(r=>r.record_type===kind);

 const refresh=async()=>{
  if(!supabase||!membership||!user)return;
  const {data:p,error:pe}=await supabase.from('projects').select('id,name').eq('organization_id',membership.organization_id).order('updated_at',{ascending:false});
  if(pe){setError('Projects could not be loaded. Reference: AF-FIELD-201');return}
  const rows=(p??[]) as ProjectRow[]; setProjects(rows); const selected=project||rows[0]?.id||''; if(!project&&selected)setProject(selected);
  if(!selected){setRecords([]);return}
  const {data,error:e}=await supabase.from('field_records').select('*').eq('organization_id',membership.organization_id).eq('project_id',selected).order('occurred_at',{ascending:false}).limit(200);
  if(e){setError('Field records could not be loaded. Reference: AF-FIELD-202');return} setRecords((data??[]) as FieldRecord[]);
 };
 useEffect(()=>{void refresh()},[membership?.organization_id,user?.id]);
 useEffect(()=>{if(project)void loadProjectRecords(project)},[project]);
 const loadProjectRecords=async(id:string)=>{if(!supabase||!membership)return;const {data,error:e}=await supabase.from('field_records').select('*').eq('organization_id',membership.organization_id).eq('project_id',id).order('occurred_at',{ascending:false}).limit(200);if(e)setError('Field records could not be loaded. Reference: AF-FIELD-202');else setRecords((data??[]) as FieldRecord[])};
 const closeRecord=async(record:FieldRecord)=>{if(!supabase)return;const {error:e}=await supabase.from('field_records').update({status:'closed',acknowledged:record.record_type==='safety'?true:record.acknowledged,updated_at:new Date().toISOString()}).eq('id',record.id);if(e)setError('Field item could not be updated. Reference: AF-FIELD-203');else await loadProjectRecords(project)};

 return <div className="page field-page">
  <header className="page-header"><div><p className="eyebrow">Field</p><h1>Today on site</h1><p>Fast, project-scoped tools for documenting work without dashboard clutter.</p></div><div className="field-project-picker"><span>Working on</span><select value={project} onChange={e=>setProject(e.target.value)}><option value="">Select project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div></header>
  {!project?<div className="panel empty-state"><strong>Select a project to open Field tools.</strong><p>Photos, logs, punch items, documents and safety records stay associated with the selected job.</p></div>:<>
   <div className="feature-grid field-tool-grid">
    {tools.map(({kind,Icon,title,copy})=><button className="feature-tile field-tool" key={kind} onClick={()=>setActive(kind)}><div className="field-tool-top"><Icon/><span className="field-count">{kind==='punch'?byKind(kind).filter(r=>r.status!=='closed').length:kind==='safety'?byKind(kind).filter(r=>!r.acknowledged).length:byKind(kind).length}</span></div><strong>{title}</strong><span>{copy}</span></button>)}
    <Link className="feature-tile field-tool field-time-link" to="/team"><div className="field-tool-top"><Clock3/><span className="field-count">Open</span></div><strong>Time & Cost Codes</strong><span>Clock in, choose a job/cost code and review your timesheet.</span></Link>
   </div>
   <div className="panel field-activity-panel"><div className="section-title"><div><p className="eyebrow">Project field activity</p><h2>{selectedProject?.name}</h2></div><span className="muted">{records.length} records</span></div>{records.length===0?<div className="compact-empty"><strong>No field activity yet</strong><span>Start with a photo, daily log, punch item, document or safety record.</span></div>:<div className="field-feed">{records.slice(0,18).map(r=><div className="field-feed-row" key={r.id}><div className={`field-feed-icon type-${r.record_type}`}>{iconFor(r.record_type)}</div><div><strong>{r.title||labelFor(r.record_type)}</strong><span>{labelFor(r.record_type)} · {new Date(r.occurred_at).toLocaleString()}</span>{r.work_completed&&<p>{r.work_completed}</p>}{r.notes&&<p>{r.notes}</p>}</div><b className={`status ${r.status==='closed'?'status-active':''}`}>{r.status}</b></div>)}</div>}</div>
  </>}
  {active&&project&&<FieldToolModal kind={active} projectID={project} records={byKind(active)} busy={busy} setBusy={setBusy} onClose={()=>setActive(null)} onChanged={()=>loadProjectRecords(project)} onError={setError} closeRecord={closeRecord}/>} 
  {error&&<div className="error-banner field-error"><button onClick={()=>setError('')}><X size={16}/></button>{error}</div>}
 </div>
}

function FieldToolModal({kind,projectID,records,busy,setBusy,onClose,onChanged,onError,closeRecord}:{kind:Kind;projectID:string;records:FieldRecord[];busy:boolean;setBusy:(v:boolean)=>void;onClose:()=>void;onChanged:()=>Promise<void>;onError:(v:string)=>void;closeRecord:(r:FieldRecord)=>Promise<void>}){
 const {user,membership}=useAuth(); const [title,setTitle]=useState('');const [notes,setNotes]=useState('');const [weather,setWeather]=useState('Clear');const [manpower,setManpower]=useState(1);const [work,setWork]=useState('');const [blockers,setBlockers]=useState('');const [assignee,setAssignee]=useState('');const [due,setDue]=useState('');const [revision,setRevision]=useState('');const [safetyType,setSafetyType]=useState('Observation');const [severity,setSeverity]=useState('Low');const [file,setFile]=useState<File|null>(null);
 const tool=tools.find(t=>t.kind===kind)!;
 const submit=async()=>{if(!supabase||!membership||!user)return;setBusy(true);onError('');try{
  let attachment_path:string|null=null,attachment_name:string|null=null,attachment_content_type:string|null=null;
  if(file){const safe=`${crypto.randomUUID()}-${file.name.replace(/\s+/g,'-')}`;attachment_path=`${membership.organization_id}/${projectID}/${user.id}/${safe}`;const {error:ue}=await supabase.storage.from('field-files').upload(attachment_path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(ue)throw ue;attachment_name=file.name;attachment_content_type=file.type||'application/octet-stream'}
  const payload:any={organization_id:membership.organization_id,project_id:projectID,created_by:user.id,record_type:kind,title:(title||defaultTitle(kind,file)).trim(),notes:notes||null,status:'open',occurred_at:new Date().toISOString(),attachment_path,attachment_name,attachment_content_type};
  if(kind==='daily_log')Object.assign(payload,{weather,manpower,work_completed:work||null,blockers:blockers||null});
  if(kind==='punch')Object.assign(payload,{assignee_name:assignee||null,due_at:due?new Date(`${due}T12:00:00`).toISOString():null});
  if(kind==='document')Object.assign(payload,{revision:revision||null});
  if(kind==='safety')Object.assign(payload,{safety_type:safetyType,severity,acknowledged:false});
  const {error}=await supabase.from('field_records').insert(payload);if(error)throw error;setTitle('');setNotes('');setWork('');setBlockers('');setAssignee('');setDue('');setRevision('');setFile(null);await onChanged();
 }catch{onError('The field record could not be saved. Reference: AF-FIELD-204')}finally{setBusy(false)}};
 return <div className="modal-backdrop"><div className="modal-card field-modal"><div className="modal-head"><div><p className="eyebrow">Field tool</p><h2>{tool.title}</h2></div><button className="icon-button" onClick={onClose}><X/></button></div>
  <div className="field-modal-grid"><div className="field-entry-form">
   {kind==='daily_log'?<><label>Weather<select value={weather} onChange={e=>setWeather(e.target.value)}>{['Clear','Cloudy','Rain','Snow','Wind','Other'].map(v=><option key={v}>{v}</option>)}</select></label><label>Manpower<input type="number" min="0" value={manpower} onChange={e=>setManpower(Number(e.target.value)||0)}/></label><label>Work completed<textarea value={work} onChange={e=>setWork(e.target.value)} rows={4}/></label><label>Blockers / delays<textarea value={blockers} onChange={e=>setBlockers(e.target.value)} rows={3}/></label><label>Additional notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}/></label></>:
   <><label>{kind==='punch'?'Issue / deficiency':kind==='safety'?'Title':kind==='document'?'Document title':'Caption'}<input value={title} onChange={e=>setTitle(e.target.value)}/></label>
   {kind==='punch'&&<><label>Assigned to<input value={assignee} onChange={e=>setAssignee(e.target.value)}/></label><label>Due date<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label></>}
   {kind==='document'&&<label>Revision<input value={revision} onChange={e=>setRevision(e.target.value)}/></label>}
   {kind==='safety'&&<div className="form-grid"><label>Type<select value={safetyType} onChange={e=>setSafetyType(e.target.value)}>{['Observation','Toolbox Talk','Inspection','Incident','Near Miss'].map(v=><option key={v}>{v}</option>)}</select></label><label>Severity<select value={severity} onChange={e=>setSeverity(e.target.value)}>{['Low','Medium','High','Critical'].map(v=><option key={v}>{v}</option>)}</select></label></div>}
   {(kind==='photo_progress'||kind==='document')&&<label className="field-file-picker"><Upload size={18}/><span>{file?file.name:kind==='photo_progress'?'Choose image':'Choose PDF / file'}</span><input type="file" accept={kind==='photo_progress'?'image/*':'.pdf,application/pdf,*/*'} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>}
   {kind!=='photo_progress'&&<label>Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4}/></label>}</>}
   <button className="button primary" disabled={busy||!canSave(kind,{title,work,file})} onClick={submit}><Plus size={17}/>{busy?'Saving…':'Save record'}</button>
  </div><div className="field-record-list"><h3>Recent</h3>{records.length===0?<div className="compact-empty"><strong>Nothing here yet</strong><span>Your first record will appear here.</span></div>:records.map(r=><div className="field-record-card" key={r.id}><div><strong>{r.title||labelFor(kind)}</strong><span>{new Date(r.occurred_at).toLocaleString()}</span></div>{r.weather&&<small>{r.weather}{r.manpower!=null?` · ${r.manpower} crew`:''}</small>}{r.work_completed&&<p>{r.work_completed}</p>}{r.assignee_name&&<small>Assigned to {r.assignee_name}</small>}{r.revision&&<small>Revision {r.revision}</small>}{r.attachment_name&&<small><FileText size={13}/>{r.attachment_name}</small>}{r.severity&&<small className={r.severity==='High'||r.severity==='Critical'?'severity-high':''}><AlertTriangle size={13}/>{r.safety_type} · {r.severity}</small>}{(kind==='punch'||kind==='safety')&&r.status!=='closed'&&<button className="button secondary field-close-button" onClick={()=>void closeRecord(r)}><Check size={15}/>Close</button>}</div>)}</div></div>
 </div></div>
}

function canSave(kind:Kind,v:{title:string;work:string;file:File|null}){if(kind==='daily_log')return v.work.trim().length>0;if(kind==='photo_progress'||kind==='document')return !!v.file;return v.title.trim().length>0}
function defaultTitle(kind:Kind,file:File|null){if(kind==='photo_progress')return 'Progress photo';if(kind==='document')return file?.name||'Document';if(kind==='daily_log')return 'Daily Log';return labelFor(kind)}
function labelFor(kind:Kind){return tools.find(t=>t.kind===kind)?.title??'Field'}
function iconFor(kind:Kind){const T=tools.find(t=>t.kind===kind)?.Icon??ClipboardList;return <T size={17}/>}
