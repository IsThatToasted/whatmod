import { Chrome, Copy, Download, LocateFixed, LogOut, MapPin, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { useAuth } from '../contexts/AuthContext'
import { APP_VERSION, featureFlags } from '../lib/config'
import { requestCurrentPosition } from '../lib/location'
import { supabase } from '../lib/supabase'
import type { BrowserIntegration } from '../types'

export default function SettingsPage() {
  const { profile, preferences, updateProfile, updatePreferences, places, createPlace, items, spaces, events, notes } = useAppData()
  const { signOut, deleteAccount, demo } = useAuth()
  const [name, setName] = useState(profile?.greeting_name || '')
  const [wake, setWake] = useState(profile?.wake_time || '07:00')
  const [sleep, setSleep] = useState(profile?.sleep_time || '23:00')
  const [workStart, setWorkStart] = useState(profile?.work_start || '')
  const [workEnd, setWorkEnd] = useState(profile?.work_end || '')
  const [theme, setTheme] = useState(profile?.theme || 'system')
  const [timeFormat, setTimeFormat] = useState(profile?.time_format || '12h')
  const [weekStart, setWeekStart] = useState(String(profile?.week_starts_on ?? 0))
  const [placeName, setPlaceName] = useState('')
  const [placeAddress, setPlaceAddress] = useState('')
  const [placeCategory, setPlaceCategory] = useState('other')
  const [placeCoords, setPlaceCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationMessage, setLocationMessage] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [browserIntegrations, setBrowserIntegrations] = useState<BrowserIntegration[]>([])
  const [browserToken, setBrowserToken] = useState('')
  const [browserMessage, setBrowserMessage] = useState('')
  const [browserBusy, setBrowserBusy] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
  }, [theme])

  async function saveProfile() {
    await updateProfile({
      greeting_name: name.trim() || 'there',
      wake_time: wake,
      sleep_time: sleep,
      work_start: workStart || null,
      work_end: workEnd || null,
      theme,
      time_format: timeFormat as '12h' | '24h',
      week_starts_on: Number(weekStart),
    })
  }

  function exportData() {
    const data = { exported_at: new Date().toISOString(), profile, preferences, items, spaces, places, events, notes }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'justglance-export.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function requestLocation() {
    setLocationMessage('')
    try {
      const position = await requestCurrentPosition()
      setPlaceCoords(position)
      await updateProfile({ location_permission_state: 'granted' })
      await updatePreferences({ location_reminders_enabled: true })
      setLocationMessage('Location is enabled. Nearby suggestions stay on-device unless you explicitly save a place.')
    } catch (error) {
      const unsupported = !('geolocation' in navigator)
      await updateProfile({ location_permission_state: unsupported ? 'unsupported' : 'denied' })
      setLocationMessage(error instanceof Error ? error.message : 'Location could not be enabled.')
    }
  }

  async function addPlace() {
    if (!placeName.trim()) return
    await createPlace({
      name: placeName.trim(),
      address: placeAddress.trim() || null,
      category: placeCategory,
      latitude: placeCoords?.latitude ?? null,
      longitude: placeCoords?.longitude ?? null,
      radius_meters: 200,
    })
    setPlaceName('')
    setPlaceAddress('')
    setPlaceCategory('other')
    setPlaceCoords(null)
  }

  async function loadBrowserIntegrations() {
    if (!supabase || demo) return
    const { data, error } = await supabase.from('browser_integrations').select('id,user_id,name,created_at,last_used_at,revoked_at').is('revoked_at', null).order('created_at', { ascending: false })
    if (error) { setBrowserMessage(error.message.includes('browser_integrations') ? 'Run migration 004 to enable the browser extension bridge.' : error.message); return }
    setBrowserIntegrations((data || []) as BrowserIntegration[])
  }

  useEffect(() => { void loadBrowserIntegrations() }, [demo])

  async function createBrowserPairing() {
    if (!supabase || demo) return
    setBrowserBusy(true); setBrowserMessage(''); setBrowserToken('')
    try {
      const { data, error } = await supabase.rpc('create_browser_integration', { p_name: 'Chrome extension' })
      if (error) throw error
      const token = (data as { token?: string } | null)?.token || ''
      if (!token) throw new Error('Supabase did not return a pairing code.')
      setBrowserToken(token)
      setBrowserMessage('Pairing code created. Paste it into the JustGlance browser panel once; it can be revoked at any time.')
      await loadBrowserIntegrations()
    } catch (error) { setBrowserMessage(error instanceof Error ? error.message : 'Could not create a pairing code.') }
    finally { setBrowserBusy(false) }
  }

  async function revokeBrowserPairing(id: string) {
    if (!supabase || demo) return
    const { error } = await supabase.rpc('revoke_browser_integration', { p_id: id })
    if (error) { setBrowserMessage(error.message); return }
    setBrowserMessage('Browser connection revoked.')
    await loadBrowserIntegrations()
  }

  return <div className="page">
    <header className="page-header"><div><span className="eyebrow">SETTINGS</span><h1>Keep the system out of your way.</h1><p>Most defaults are designed to work without tuning.</p></div></header>
    <div className="settings-grid">
      <section className="settings-section">
        <span className="eyebrow">PROFILE</span><h2>Profile</h2>
        <label>Greeting name<input value={name} onChange={e => setName(e.target.value)}/></label>
        <label>Timezone<input value={profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} readOnly/></label>
      </section>

      <section className="settings-section">
        <span className="eyebrow">SCHEDULE</span><h2>Your usual rhythm</h2>
        <div className="two-col"><label>Wake time<input type="time" value={wake} onChange={e => setWake(e.target.value)}/></label><label>Sleep time<input type="time" value={sleep} onChange={e => setSleep(e.target.value)}/></label></div>
        <div className="two-col"><label>Work starts<input type="time" value={workStart} onChange={e => setWorkStart(e.target.value)}/></label><label>Work ends<input type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)}/></label></div>
        <div className="two-col"><label>Week starts<select value={weekStart} onChange={e => setWeekStart(e.target.value)}><option value="0">Sunday</option><option value="1">Monday</option></select></label><label>Time format<select value={timeFormat} onChange={e => setTimeFormat(e.target.value as '12h' | '24h')}><option value="12h">12 hour</option><option value="24h">24 hour</option></select></label></div>
        <button className="secondary-button" onClick={saveProfile}>Save profile & schedule</button>
      </section>

      <section className="settings-section">
        <span className="eyebrow">APPEARANCE</span><h2>Theme</h2>
        <label>Theme<select value={theme} onChange={e => setTheme(e.target.value as 'light' | 'dark' | 'system')}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <p className="muted">Changes preview immediately. Save profile & schedule to keep the preference on your account.</p>
      </section>

      <section className="settings-section">
        <span className="eyebrow">PLACES</span><h2>Places & location</h2>
        {places.map(place => <div className="place-row" key={place.id}><MapPin size={17}/><div><strong>{place.name}</strong><span>{place.address || place.category}{place.latitude != null ? ' · location saved' : ''}</span></div></div>)}
        <div className="form-stack settings-place-form">
          <label>Name<input value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="Gym, Walmart, Parents’ house"/></label>
          <label>Address (optional)<input value={placeAddress} onChange={e => setPlaceAddress(e.target.value)} placeholder="Manual address"/></label>
          <label>Category<select value={placeCategory} onChange={e => setPlaceCategory(e.target.value)}><option value="other">Other</option><option value="home">Home</option><option value="work">Work</option><option value="store">Store</option><option value="gym">Gym</option><option value="pharmacy">Pharmacy</option></select></label>
          <div className="place-actions"><button className="secondary-button" type="button" onClick={requestLocation} disabled={!featureFlags.LOCATION}><LocateFixed size={17}/>Use current location</button><button className="primary-button" type="button" onClick={addPlace} disabled={!placeName.trim()}><Plus size={17}/>Add place</button></div>
          {placeCoords && <p className="muted">Current coordinates will be saved with this place when you add it.</p>}
          {locationMessage && <div className="form-message">{locationMessage}</div>}
        </div>
      </section>

      <section className="settings-section">
        <span className="eyebrow">NOTIFICATIONS</span><h2>What may interrupt you</h2>
        <Toggle label="Urgent reminders" value={preferences?.urgent_reminders_enabled ?? true} onChange={value => updatePreferences({ urgent_reminders_enabled: value })}/>
        <Toggle label="Upcoming tasks" value={preferences?.upcoming_tasks_enabled ?? true} onChange={value => updatePreferences({ upcoming_tasks_enabled: value })}/>
        <Toggle label="Morning brief" value={preferences?.morning_brief_enabled ?? true} onChange={value => updatePreferences({ morning_brief_enabled: value })}/>
        <Toggle label="Daily reset" value={preferences?.daily_reset_enabled ?? true} onChange={value => updatePreferences({ daily_reset_enabled: value })}/>
        <Toggle label="Shared activity" value={preferences?.shared_activity_enabled ?? true} onChange={value => updatePreferences({ shared_activity_enabled: value })}/>
        <Toggle label="Location reminders" value={preferences?.location_reminders_enabled ?? false} onChange={value => updatePreferences({ location_reminders_enabled: value })}/>
        <Toggle label="Routine reminders" value={preferences?.routine_reminders_enabled ?? true} onChange={value => updatePreferences({ routine_reminders_enabled: value })}/>
        <p className="muted">These preferences are stored now. Actual push delivery remains disabled until a push provider is configured.</p>
      </section>


      <section className="settings-section browser-extension-settings">
        <span className="eyebrow">BROWSER</span><h2><Chrome size={20}/> Add to JustGlance</h2>
        <p className="muted">The Chrome extension adds a small button to shopping pages, reads product title/image/price from the page, syncs your named shopping lists, and saves directly to the list you choose.</p>
        <div className="browser-extension-actions"><a className="secondary-button" href="./chrome-extension/JustGlance-Chrome-Extension-v1.0.0.zip" download><Download size={17}/>Download extension</a><button className="primary-button" onClick={createBrowserPairing} disabled={browserBusy||demo}><Chrome size={17}/>{browserBusy?'Creating…':'Create pairing code'}</button></div>
        {browserToken&&<div className="pairing-token-card"><span>ONE-TIME PAIRING CODE</span><code>{browserToken}</code><button className="secondary-button" onClick={async()=>navigator.clipboard.writeText(browserToken)}><Copy size={16}/>Copy code</button><small>JustGlance stores only a hash. This raw code is shown only in this session.</small></div>}
        {browserMessage&&<div className="form-message">{browserMessage}</div>}
        <div className="integration-list"><div className="section-heading inline"><strong>Connected browsers</strong><button className="icon-button" onClick={loadBrowserIntegrations} aria-label="Refresh browser connections"><RefreshCw size={15}/></button></div>{browserIntegrations.length?browserIntegrations.map(integration=><div className="integration-row" key={integration.id}><span><b>{integration.name}</b><small>{integration.last_used_at?`Last used ${new Date(integration.last_used_at).toLocaleString()}`:`Connected ${new Date(integration.created_at).toLocaleString()}`}</small></span><button className="text-button danger-text" onClick={()=>revokeBrowserPairing(integration.id)}>Revoke</button></div>):<p className="muted">No browser connections yet.</p>}</div>
        <p className="muted">Install: unzip the download, open <b>chrome://extensions</b>, enable Developer mode, choose <b>Load unpacked</b>, and select the extracted extension folder. Then paste the pairing code into the bottom-left JustGlance button on any normal website.</p>
      </section>

      <section className="settings-section">
        <span className="eyebrow">PRIVACY & DATA</span><h2>Your data</h2>
        <button className="secondary-button" onClick={exportData}><Download size={17}/>Export my data</button>
        <p className="muted">Exports stay on your device. Task and note text is never sent to analytics by this app.</p>
        <p className="muted">Privacy Policy and Terms URLs should be published before public launch; no dead links are exposed in this build.</p>
      </section>

      <section className="settings-section danger-zone">
        <span className="eyebrow">ACCOUNT</span><h2>Account</h2>
        <button className="secondary-button" onClick={signOut} disabled={demo}><LogOut size={17}/>{demo ? 'Sign out unavailable in demo' : 'Sign out'}</button>
        <button className="danger-button" disabled={demo} onClick={async () => { if (!confirm('Permanently delete your JustGlance account and all owned data? This cannot be undone.')) return; const err = await deleteAccount(); if (err) setAccountMessage(err) }}><Trash2 size={17}/>{demo ? 'Delete account unavailable in demo' : 'Delete account'}</button>
        {accountMessage && <div className="form-message">{accountMessage}</div>}
        <p className="muted">Version {APP_VERSION}</p>
      </section>
    </div>
  </div>
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => Promise<void> | void }) {
  const [busy, setBusy] = useState(false)
  async function toggle() {
    setBusy(true)
    try { await onChange(!value) } finally { setBusy(false) }
  }
  return <div className="toggle-row"><span>{label}</span><button type="button" className={`switch ${value ? 'on' : ''}`} onClick={toggle} aria-pressed={value} disabled={busy}><span/></button></div>
}
