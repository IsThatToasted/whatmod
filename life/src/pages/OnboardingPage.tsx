import { ArrowRight, Check, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { lifeIntentParser } from '../lib/parser'

const helpOptions = ['Tasks', 'Shopping', 'Appointments', 'Household', 'Errands', 'Everything']

export default function OnboardingPage() {
  const { profile, updateProfile, createItem } = useAppData()
  const [step, setStep] = useState(1)
  const [name, setName] = useState(profile?.greeting_name || profile?.display_name || '')
  const [areas, setAreas] = useState<string[]>(profile?.help_areas || ['Everything'])
  const [wake, setWake] = useState(profile?.wake_time || '07:00')
  const [sleep, setSleep] = useState(profile?.sleep_time || '23:00')
  const [workStart, setWorkStart] = useState(profile?.work_start || '')
  const [workEnd, setWorkEnd] = useState(profile?.work_end || '')
  const [first, setFirst] = useState('')
  const [busy, setBusy] = useState(false)

  function toggleArea(area: string) {
    setAreas(current => area === 'Everything' ? ['Everything'] : current.includes(area) ? current.filter(x => x !== area) : [...current.filter(x => x !== 'Everything'), area])
  }

  async function finish() {
    if (busy) return
    setBusy(true)
    try {
      if (first.trim()) await createItem(lifeIntentParser.parse(first), first)
      await updateProfile({
        greeting_name: name.trim() || 'there',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        help_areas: areas.length ? areas : ['Everything'],
        wake_time: wake,
        sleep_time: sleep,
        work_start: workStart || null,
        work_end: workEnd || null,
        onboarding_complete: true,
      })
      location.hash = '/now'
    } finally { setBusy(false) }
  }

  return <div className="onboarding">
    <div className="onboarding-progress" aria-label={`Onboarding step ${step} of 5`}>{[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= step ? 'active' : ''}/>)}</div>
    {step === 1 && <section><div className="brand-orb xl">J</div><span className="eyebrow">WELCOME TO JUSTGLANCE</span><h1>Your life, at a glance.</h1><p>Capture something once. We’ll help surface it when it’s useful.</p><button className="primary-button" onClick={() => setStep(2)}>Get started <ArrowRight/></button></section>}
    {step === 2 && <section><Sparkles/><span className="eyebrow">A LITTLE PERSONAL</span><h1>What should we call you?</h1><input className="onboarding-input" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Brian"/><button className="primary-button" onClick={() => setStep(3)} disabled={!name.trim()}>Continue <ArrowRight/></button></section>}
    {step === 3 && <section><span className="eyebrow">WHAT SHOULD WE CATCH?</span><h1>What would you like help remembering?</h1><p>This keeps early suggestions relevant. It never hides the rest of the app.</p><div className="onboarding-options">{helpOptions.map(option => <button key={option} className={`choice-card ${areas.includes(option) ? 'selected' : ''}`} onClick={() => toggleArea(option)}>{areas.includes(option) && <Check size={17}/>}<span>{option}</span></button>)}</div><button className="primary-button" onClick={() => setStep(4)} disabled={!areas.length}>Continue <ArrowRight/></button></section>}
    {step === 4 && <section><span className="eyebrow">YOUR RHYTHM</span><h1>When does your day usually run?</h1><p>Wake and sleep are enough. Work hours are optional and can be changed later.</p><div className="two-col onboarding-times"><label>Wake<input type="time" value={wake} onChange={e => setWake(e.target.value)}/></label><label>Sleep<input type="time" value={sleep} onChange={e => setSleep(e.target.value)}/></label></div><div className="two-col onboarding-times"><label>Work starts (optional)<input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)}/></label><label>Work ends (optional)<input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)}/></label></div><button className="primary-button" onClick={() => setStep(5)}>Continue <ArrowRight/></button></section>}
    {step === 5 && <section><Check/><span className="eyebrow">ONE LAST THING</span><h1>Capture your first thought.</h1><p>Try something natural. JustGlance will do the organizing.</p><textarea className="onboarding-input" value={first} onChange={e => setFirst(e.target.value)} placeholder="I need to call the dentist this week" rows={3}/><button className="primary-button" onClick={finish} disabled={busy}>{busy ? 'Saving…' : <>Show me Now <ArrowRight/></>}</button></section>}
  </div>
}
