import type { Mood } from '../types'
const opts:[Mood,string][]=[['nothing','Nothing'],['quick','Quick win'],['productive','Productive'],['errands','Errands'],['home','Home'],['relax','Relax'],['fun','Fun']]
export function MoodSelector({value,onChange}:{value:Mood|null,onChange:(m:Mood|null)=>void}){return <div className="mood-wrap"><p>What do you feel like doing?</p><div className="chip-row">{opts.map(([v,l])=><button key={v} className={`chip ${value===v?'active':''}`} onClick={()=>onChange(value===v?null:v)}>{l}</button>)}</div></div>}
