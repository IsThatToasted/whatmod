import { FolderKanban, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppData } from '../contexts/AppDataContext'
import { useOrganizer } from '../contexts/OrganizerContext'
import { ItemCard } from '../components/ItemCard'

export default function SearchPage() {
  const { items, notes, events, spaces, places, activity } = useAppData()
  const { projects } = useOrganizer()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const results = useMemo(() => ({
    items: term ? items.filter(i => `${i.title} ${i.description || ''} ${i.source_text || ''} ${i.place_name || ''}`.toLowerCase().includes(term)).slice(0, 20) : [],
    projects: term ? projects.filter(p => `${p.name} ${p.description || ''}`.toLowerCase().includes(term)).slice(0, 12) : [],
    notes: term ? notes.filter(n => `${n.title} ${n.body} ${n.source_text || ''}`.toLowerCase().includes(term)).slice(0, 10) : [],
    events: term ? events.filter(e => `${e.title} ${e.location || ''} ${e.notes || ''}`.toLowerCase().includes(term)).slice(0, 10) : [],
    spaces: term ? spaces.filter(s => s.name.toLowerCase().includes(term)) : [],
    places: term ? places.filter(p => `${p.name} ${p.address || ''} ${p.notes || ''}`.toLowerCase().includes(term)).slice(0, 10) : [],
    activity: term ? activity.filter(a => `${a.actor_name || ''} ${a.action} ${a.entity_title}`.toLowerCase().includes(term)).slice(0, 10) : [],
  }), [term, items, projects, notes, events, spaces, places, activity])
  const count = Object.values(results).reduce((sum, value) => sum + value.length, 0)

  return <div className="page search-page">
    <header className="page-header compact"><div><span className="eyebrow">SEARCH</span><h1>Find anything you saved.</h1></div></header>
    <div className="search-box"><Search/><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Dentist, paint color, groceries, project…"/></div>
    {!term ? <div className="large-empty"><Search/><h2>Search your life.</h2><p>Tasks, projects, thoughts, appointments, spaces, places, shopping, and recent activity.</p></div> : count === 0 ? <div className="large-empty"><h2>No matches.</h2><p>Try a shorter phrase.</p></div> : <div className="search-results">
      {results.items.length > 0 && <section><h2>Items</h2>{results.items.map(item => <ItemCard key={item.id} item={item}/>)}</section>}
      {results.projects.length > 0 && <section><h2>Projects</h2>{results.projects.map(project => <button type="button" className="result-card result-card-button" key={project.id} onClick={() => navigate(`/projects/${project.id}`)}><FolderKanban/><span><strong>{project.name}</strong><p>{project.description || `${project.status} project`}</p></span></button>)}</section>}
      {results.notes.length > 0 && <section><h2>Thoughts & notes</h2>{results.notes.map(note => <article className="result-card" key={note.id}><strong>{note.title}</strong><p>{note.body}</p></article>)}</section>}
      {results.events.length > 0 && <section><h2>Appointments & events</h2>{results.events.map(event => <article className="result-card" key={event.id}><strong>{event.title}</strong><p>{event.event_date} · {event.start_time}{event.location ? ` · ${event.location}` : ''}</p></article>)}</section>}
      {results.places.length > 0 && <section><h2>Places</h2>{results.places.map(place => <article className="result-card" key={place.id}><strong>{place.name}</strong><p>{place.address || place.category}</p></article>)}</section>}
      {results.spaces.length > 0 && <section><h2>Spaces</h2>{results.spaces.map(space => <article className="result-card" key={space.id}><strong>{space.name}</strong></article>)}</section>}
      {results.activity.length > 0 && <section><h2>History</h2>{results.activity.map(entry => <article className="result-card" key={entry.id}><strong>{entry.entity_title}</strong><p>{entry.actor_name || 'Someone'} {entry.action} this · {new Date(entry.created_at).toLocaleDateString()}</p></article>)}</section>}
    </div>}
  </div>
}
