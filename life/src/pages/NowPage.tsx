import { CheckCircle2, Clock3, Home, ShoppingBasket, Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { formatDate, formatTime, getTimePeriod, greeting, minutesUntilEvent, todayISO } from '../lib/time'
import { rankItems } from '../lib/relevance'
import type { AppContextSnapshot, Mood } from '../types'
import { ItemCard } from '../components/ItemCard'
import { MoodSelector } from '../components/MoodSelector'
import { featureFlags } from '../lib/config'
import { MorningBrief } from '../components/MorningBrief'
import { DailyReset } from '../components/DailyReset'
import { useNearbyPlace } from '../hooks/useNearbyPlace'

export default function NowPage() {
  const { profile, preferences, items, events, activity, places } = useAppData()
  const [mood, setMood] = useState<Mood | null>(null)
  const now = new Date()
  const period = getTimePeriod(now)
  const today = todayISO(now)
  const todaysEvents = events.filter(e => e.event_date === today).sort((a, b) => a.start_time.localeCompare(b.start_time))
  const next = todaysEvents.find(e => {
    const [h, m] = e.start_time.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d > now
  }) || null
  const minutes = next ? minutesUntilEvent(next, now) : null
  const locationEnabled = featureFlags.LOCATION && preferences?.location_reminders_enabled === true && profile?.location_permission_state === 'granted'
  const currentPlaceName = useNearbyPlace(places, locationEnabled)
  const context: AppContextSnapshot = { now, period, mood, minutesUntilNextEvent: minutes, nextEvent: next, currentPlaceName }
  const ranked = useMemo(() => rankItems(items, context), [items, mood, period, minutes, currentPlaceName])
  const useful = ranked.slice(0, 5)
  const completed = items.filter(i => i.status === 'completed' && i.completed_at?.startsWith(today)).length
  const openToday = items.filter(i => i.status === 'open' && i.due_date === today).length
  const evening = period === 'evening' || period === 'night'
  const morning = period === 'early-morning' || period === 'morning'
  const hero = minutes != null && minutes > 0
    ? `You have about ${minutes} minute${minutes === 1 ? '' : 's'} before ${next?.title}.`
    : openToday
      ? `${openToday} thing${openToday === 1 ? '' : 's'} worth a glance today.`
      : 'Nothing urgent is asking for you.'

  return <div className="page now-page">
    <section className="now-hero">
      <div className="eyebrow-row"><span>{formatDate(now)}</span>{currentPlaceName && <span className="location-pill">Near {currentPlaceName}</span>}</div>
      <h1>{greeting(period)}, {profile?.greeting_name || profile?.display_name || 'there'}.</h1>
      <p className="hero-line">{hero}</p>
    </section>

    {featureFlags.MORNING_BRIEF && morning && <MorningBrief />}
    <MoodSelector value={mood} onChange={setMood}/>

    <section className="now-grid">
      <div className="feed">
        <div className="section-heading"><div><span className="eyebrow">WORTH DOING NOW</span><h2>{useful.length ? 'Useful right now' : 'You’re clear'}</h2></div><Sparkles size={20}/></div>
        {useful.length ? useful.map(scored => <div key={scored.item.id} className="recommendation"><ItemCard item={scored.item}/>{import.meta.env.DEV && <small className="score-debug">score {scored.score} · {scored.reasons.slice(0, 2).join(', ')}</small>}</div>) : <div className="empty-card"><CheckCircle2/><strong>Nothing urgent.</strong><span>Enjoy the open space, or capture something if it’s on your mind.</span></div>}
        {evening && featureFlags.DAILY_RESET && <DailyReset />}
      </div>

      <aside className="context-panel">
        <div className="context-card"><div className="context-title"><Clock3 size={18}/><strong>Up next</strong></div>{next ? <><h3>{next.title}</h3><p>{formatTime(next.start_time)}{next.location ? ` · ${next.location}` : ''}</p></> : <><h3>Open runway</h3><p>No more scheduled events today.</p></>}</div>
        <div className="context-card"><div className="context-title"><Home size={18}/><strong>Shared</strong></div><p>{items.filter(i => i.space_id && i.status === 'open').length} shared item(s) waiting.</p></div>
        {preferences?.shared_activity_enabled !== false && activity[0] && <div className="context-card"><div className="context-title"><Users size={18}/><strong>Recent</strong></div><p>{activity[0].actor_name || 'Someone'} {activity[0].action} {activity[0].entity_title}.</p></div>}
        <div className="context-card"><div className="context-title"><ShoppingBasket size={18}/><strong>Shopping</strong></div><p>{items.filter(i => i.type === 'shopping' && i.status === 'open').length} item(s) on your lists.</p></div>
        <div className="context-card"><div className="context-title"><CheckCircle2 size={18}/><strong>Today</strong></div><p>{completed} completed so far.</p></div>
      </aside>
    </section>
  </div>
}
