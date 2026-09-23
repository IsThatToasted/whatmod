import type { Mood } from '../types'

const opts:[Mood,string][]=[['nothing','Nothing'],['quick','Quick win'],['productive','Productive'],['errands','Errands'],['home','Home'],['relax','Relax'],['fun','Fun']]
const descriptions:Record<Mood,string>={
  nothing:'Keep it light — urgent, easy, and low-energy things only.',
  quick:'Short tasks that fit into about 15 minutes rise to the top.',
  productive:'Important tasks, calls, and higher-energy work rise to the top.',
  errands:'Shopping and out-of-the-house errands rise to the top.',
  home:'Chores, shopping, and home-related items rise to the top.',
  relax:'Low-energy ideas and optional things rise to the top.',
  fun:'Ideas, hobbies, and fun-tagged things rise to the top.',
}
export function MoodSelector({value,onChange}:{value:Mood|null,onChange:(m:Mood|null)=>void}){return <div className="mood-wrap"><p>What do you feel like doing?</p><div className="chip-row">{opts.map(([v,l])=><button key={v} type="button" aria-pressed={value===v} className={`chip ${value===v?'active':''}`} onClick={()=>onChange(value===v?null:v)}>{l}</button>)}</div>{value&&<div className="mood-feedback"><strong>{opts.find(([v])=>v===value)?.[1]} mode</strong><span>{descriptions[value]}</span></div>}</div>}
