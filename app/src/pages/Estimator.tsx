import { useMemo, useState } from 'react';
import { Camera, ChevronRight, Mic, Plus, Ruler, Sparkles, WandSparkles } from 'lucide-react';
import type { EstimateRoom } from '../types/domain';

const starterRoom = (): EstimateRoom => ({ id: crypto.randomUUID(), name: 'Living room', doors: 2, windows: 3, widthFt: 14, lengthFt: 18, heightFt: 9, surfaces: [] });

export function Estimator() {
  const [rooms, setRooms] = useState<EstimateRoom[]>([starterRoom()]);
  const [notes, setNotes] = useState<string[]>([]);
  const wallSqFt = useMemo(() => rooms.reduce((t,r)=>t + (r.widthFt && r.lengthFt && r.heightFt ? 2*(r.widthFt+r.lengthFt)*r.heightFt : 0),0),[rooms]);
  return <div className="page estimator-page"><header className="page-header"><div><p className="eyebrow">AI-assisted</p><h1>Smart Estimate</h1><p>Capture the job once. Turn the walkthrough into measurable scope.</p></div><button className="button primary"><Sparkles size={18}/>New walkthrough</button></header>
    <div className="estimator-layout"><section className="capture-panel">
      <div className="capture-hero"><div className="capture-orb"><Ruler size={28}/></div><div><span className="live-dot">Native iOS</span><h2>Spatial walkthrough</h2><p>On supported iPhones and iPads, the native app uses RoomPlan/LiDAR to map room geometry while you narrate conditions, prep, coatings, and exclusions.</p></div></div>
      <div className="capture-actions"><button className="capture-action"><Camera/><span><strong>Scan space</strong><small>Walls, openings, dimensions</small></span><ChevronRight/></button><button className="capture-action"><Mic/><span><strong>Talk while you walk</strong><small>Timestamped field notes</small></span><ChevronRight/></button><button className="capture-action"><WandSparkles/><span><strong>Generate scope</strong><small>Editable summary + line items</small></span><ChevronRight/></button></div>
      <div className="callout"><strong>Measurement confidence stays visible.</strong><span>AI suggestions never silently overwrite captured dimensions. Low-confidence or manually-entered values remain flagged for review.</span></div>
    </section>
    <section className="panel estimate-sheet"><div className="section-title"><div><p className="eyebrow">Draft</p><h2>Hamilton Residence</h2></div><span className="status status-estimating">in progress</span></div>
      <div className="estimate-summary"><div><span>Rooms</span><strong>{rooms.length}</strong></div><div><span>Wall area</span><strong>{wallSqFt.toLocaleString()} ft²</strong></div><div><span>Notes</span><strong>{notes.length}</strong></div></div>
      <div className="room-list">{rooms.map((r,i)=><div className="room-row" key={r.id}><div><strong>{r.name}</strong><span>{r.widthFt}' × {r.lengthFt}' × {r.heightFt}' · {r.windows} windows · {r.doors} doors</span></div><button aria-label="Open room"><ChevronRight/></button></div>)}</div>
      <button className="button secondary full" onClick={()=>setRooms(v=>[...v,{...starterRoom(),id:crypto.randomUUID(),name:`Room ${v.length+1}`}])}><Plus size={17}/>Add room manually</button>
      <button className="button ghost full" onClick={()=>setNotes(v=>[...v,`Field note ${v.length+1}`])}><Mic size={17}/>Add walkthrough note</button>
    </section></div>
  </div>
}
