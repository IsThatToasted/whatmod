import type { Mood } from '../types/models';
import { useLife } from '../providers/LifeProvider';
const moods:[Mood,string][]=[['nothing','Nothing'],['quick','Quick win'],['productive','Productive'],['errands','Errands'],['home','Home'],['relax','Relax'],['fun','Fun']];
export function MoodSelector(){const {mood,setMood}=useLife();return <section className="mood-wrap"><div className="section-kicker">What do you feel like doing?</div><div className="chip-row" role="list">{moods.map(([v,l])=><button key={v} className={`chip ${mood===v?'selected':''}`} onClick={()=>setMood(v)}>{l}</button>)}</div></section>}
