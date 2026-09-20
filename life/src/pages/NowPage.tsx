import { CalendarClock, CheckCircle2, ChevronRight, CloudSun, RotateCcw, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { calculateRelevanceScore, getDayPeriod, greeting } from '../lib/contextEngine';
import { ItemCard } from '../components/ItemCard';
import { MoodSelector } from '../components/MoodSelector';
import { useLife } from '../providers/LifeProvider';

export function NowPage(){
  const {profile,items,events,mood,activity}=useLife();
  const period=getDayPeriod();
  const ranked=items.filter(i=>i.status!=='completed'&&i.status!=='snoozed').map(i=>({i,score:calculateRelevanceScore(i,mood)})).sort((a,b)=>b.score-a.score).slice(0,5);
  const today=new Date().toISOString().slice(0,10);
  const todayEvents=events.filter(e=>e.start_at.startsWith(today));
  const completed=items.filter(i=>i.status==='completed'&&i.completed_at?.startsWith(today)).length;
  const next=todayEvents.find(e=>new Date(e.start_at)>new Date())??todayEvents[0];
  const h=new Date().getHours();
  const isEvening=h>=18;
  return <div className="page now-page">
    <header className="hero"><span className="eyebrow">{format(new Date(),'EEEE, MMMM d')}</span><h1>{greeting(period)}, {profile?.greeting_name||profile?.name||'there'}.</h1><p>{isEvening?"You're nearly through the day. Here's what still matters.":ranked.length?"Here’s what looks useful right now.":"Nothing urgent. Enjoy the breathing room."}</p></header>

    <div className="glance-strip">
      <div><CloudSun size={20}/><span><b>68°</b><small>Weather demo</small></span></div>
      <div><CalendarClock size={20}/><span><b>{next?new Date(next.start_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):'Open'}</b><small>{next?.title??'No event next'}</small></span></div>
      <div><CheckCircle2 size={20}/><span><b>{completed}</b><small>done today</small></span></div>
    </div>

    <MoodSelector/>

    {ranked.length>0&&<section><div className="section-head"><div><span className="section-kicker">Worth doing now</span><h2>{mood==='quick'?'Quick wins':mood==='errands'?'While you’re out':'A few useful things'}</h2></div><Sparkles size={20}/></div><div className="stack">{ranked.map(({i})=><ItemCard key={i.id} item={i}/>)}</div></section>}

    {next&&<section className="soft-card timeline-card"><span className="section-kicker">Up next</span><div className="timeline-row"><div className="time-badge">{new Date(next.start_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</div><div><b>{next.title}</b><span>{next.location||'No location'}</span></div><ChevronRight size={18}/></div></section>}

    {isEvening&&<section className="reset-card"><div className="reset-icon"><RotateCcw/></div><div><span className="section-kicker">Daily reset</span><h2>Wrap today in under 30 seconds.</h2><p>{completed} completed · unfinished items can roll forward without fuss.</p></div><button className="secondary">Review day</button></section>}

    {activity.length>0&&<section><div className="section-head"><div><span className="section-kicker">Shared activity</span><h2>Home, quietly updated</h2></div></div><div className="activity-list">{activity.slice(0,2).map(a=><div key={a.id}><span className="activity-dot"/><span>{a.text}</span></div>)}</div></section>}
  </div>
}
