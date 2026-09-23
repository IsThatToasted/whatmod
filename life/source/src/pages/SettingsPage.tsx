import { Chrome, Copy, Download, Edit3, LocateFixed, LogOut, MapPin, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppData } from '../contexts/AppDataContext'
import { useAuth } from '../contexts/AuthContext'
import { APP_VERSION, SUPABASE_ANON_KEY, SUPABASE_URL, featureFlags } from '../lib/config'
import { requestCurrentPosition } from '../lib/location'
import { supabase } from '../lib/supabase'
import type { BrowserIntegration } from '../types'


type ExtensionBridgeResult = { ok?: boolean; error?: string; version?: string; paired?: boolean; lists?: unknown[] }

function callExtensionBridge(action: 'PING' | 'PAIR' | 'STATUS', payload: Record<string, unknown> = {}, timeoutMs = 900): Promise<ExtensionBridgeResult | null> {
  return new Promise(resolve => {
    const requestId = crypto.randomUUID()
    let settled = false
    const finish = (value: ExtensionBridgeResult | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      resolve(value)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin) return
      const data = event.data
      if (!data || data.channel !== 'JUSTGLANCE_EXTENSION_TO_PAGE' || data.requestId !== requestId) return
      finish((data.result || null) as ExtensionBridgeResult | null)
    }
    const timer = window.setTimeout(() => finish(null), timeoutMs)
    window.addEventListener('message', onMessage)
    window.postMessage({ channel: 'JUSTGLANCE_PAGE_TO_EXTENSION', requestId, action, ...payload }, location.origin)
  })
}

export default function SettingsPage() {
  const { profile, preferences, updateProfile, updatePreferences, places, createPlace, updatePlace, deletePlace, items, spaces, events, notes } = useAppData()
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
  const [editingPlaceId, setEditingPlaceId] = useState('')
  const [locationMessage, setLocationMessage] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [browserIntegrations, setBrowserIntegrations] = useState<BrowserIntegration[]>([])
  const [browserToken, setBrowserToken] = useState('')
  const [browserMessage, setBrowserMessage] = useState('')
  const [browserBusy, setBrowserBusy] = useState(false)
  const [extensionDetected, setExtensionDetected] = useState(false)
  const [extensionVersion, setExtensionVersion] = useState('')
  const [extensionPaired, setExtensionPaired] = useState(false)

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

  function clearPlaceForm() {
    setEditingPlaceId('')
    setPlaceName('')
    setPlaceAddress('')
    setPlaceCategory('other')
    setPlaceCoords(null)
  }

  function startPlaceEdit(id: string) {
    const place = places.find(candidate => candidate.id === id)
    if (!place) return
    setEditingPlaceId(place.id)
    setPlaceName(place.name)
    setPlaceAddress(place.address || '')
    setPlaceCategory(place.category || 'other')
    setPlaceCoords(place.latitude != null && place.longitude != null ? { latitude: place.latitude, longitude: place.longitude } : null)
  }

  async function savePlace() {
    if (!placeName.trim()) return
    const payload = {
      name: placeName.trim(),
      address: placeAddress.trim() || null,
      category: placeCategory,
      latitude: placeCoords?.latitude ?? null,
      longitude: placeCoords?.longitude ?? null,
      radius_meters: 200,
    }
    if (editingPlaceId) await updatePlace(editingPlaceId, payload)
    else await createPlace(payload)
    clearPlaceForm()
  }

  async function removePlace() {
    if (!editingPlaceId) return
    await deletePlace(editingPlaceId)
    clearPlaceForm()
  }

  async function loadBrowserIntegrations() {
    if (!supabase || demo) return
    const { data, error } = await supabase.from('browser_integrations').select('id,user_id,name,created_at,last_used_at,revoked_at').is('revoked_at', null).order('created_at', { ascending: false })
    if (error) { setBrowserMessage(error.message.includes('browser_integrations') ? 'Run migration 004 to enable the browser extension bridge.' : error.message); return }
    setBrowserIntegrations((data || []) as BrowserIntegration[])
  }

  useEffect(() => { void loadBrowserIntegrations() }, [demo])

  useEffect(() => {
    let active = true
    async function pingExtension() {
      const result = await callExtensionBridge('PING')
      if (!active) return
      setExtensionDetected(Boolean(result?.ok))
      setExtensionVersion(result?.version || '')
      setExtensionPaired(Boolean(result?.paired))
    }
    void pingExtension()
    const onFocus = () => { void pingExtension() }
    window.addEventListener('focus', onFocus)
    return () => { active = false; window.removeEventListener('focus', onFocus) }
  }, [])

  async function pairBrowserToken(token: string) {
    const result = await callExtensionBridge('PAIR', { token, config: { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY } }, 1800)
    if (!result?.ok) return result
    setExtensionDetected(true)
    setExtensionVersion(result.version || extensionVersion)
    setExtensionPaired(true)
    return result
  }

  async function createBrowserPairing() {
    if (!supabase || demo) return
    setBrowserBusy(true); setBrowserMessage(''); setBrowserToken('')
    try {
      const { data, error } = await supabase.rpc('create_browser_integration', { p_name: 'Chrome extension' })
      if (error) throw error
      const token = (data as { token?: string } | null)?.token || ''
      if (!token) throw new Error('Supabase did not return a pairing code.')
      setBrowserToken(token)
      if (extensionDetected) {
        const result = await pairBrowserToken(token)
        if (result?.ok) {
          setBrowserToken('')
          setBrowserMessage(`Extension ${result.version ? `v${result.version} ` : ''}connected. ${Array.isArray(result.lists) ? result.lists.length : 0} shopping destination${Array.isArray(result.lists) && result.lists.length === 1 ? '' : 's'} synced.`)
        } else {
          setBrowserMessage(`Pairing code created, but the installed extension returned: ${result?.error || 'No response.'}`)
        }
      } else {
        setBrowserMessage('Pairing code created. The current JustGlance tab cannot see the extension yet. Load/update extension v1.1.0, then reload this JustGlance page once and use “Pair this code”.')
      }
      await loadBrowserIntegrations()
    } catch (error) { setBrowserMessage(error instanceof Error ? error.message : 'Could not create a pairing code.') }
    finally { setBrowserBusy(false) }
  }

  async function pairExistingBrowserToken() {
    if (!browserToken) return
    setBrowserBusy(true); setBrowserMessage('')
    try {
      const result = await pairBrowserToken(browserToken)
      if (!result?.ok) throw new Error(result?.error || 'The extension did not respond.')
      setBrowserToken('')
      setBrowserMessage(`Extension ${result.version ? `v${result.version} ` : ''}connected. Shopping lists are synced.`)
      await loadBrowserIntegrations()
    } catch (error) { setBrowserMessage(error instanceof Error ? error.message : 'Could not pair the installed extension.') }
    finally { setBrowserBusy(false) }
  }

  async function clearUnusedBrowserPairings() {
    const pending = browserIntegrations.filter(integration => !integration.last_used_at)
    if (!pending.length) return
    setBrowserBusy(true)
    try {
      for (const integration of pending) await revokeBrowserPairing(integration.id, false)
      setBrowserMessage('Unused pairing codes cleared.')
      await loadBrowserIntegrations()
    } finally { setBrowserBusy(false) }
  }

  async function revokeBrowserPairing(id: string, reload = true) {
    if (!supabase || demo) return
    const { error } = await supabase.rpc('revoke_browser_integration', { p_id: id })
    if (error) { setBrowserMessage(error.message); return }
    if (reload) { setBrowserMessage('Browser connection revoked.'); await loadBrowserIntegrations() }
  }

  const connectedBrowserIntegrations = browserIntegrations.filter(integration => !!integration.last_used_at)
  const pendingBrowserIntegrations = browserIntegrations.filter(integration => !integration.last_used_at)

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
        {places.map(place => <div className="place-row editable-row" key={place.id}><MapPin size={17}/><div><strong>{place.name}</strong><span>{place.address || place.category}{place.latitude != null ? ' · location saved' : ''}</span></div><button className="icon-button subtle" onClick={()=>startPlaceEdit(place.id)} aria-label={`Edit ${place.name}`}><Edit3 size={15}/></button></div>)}
        <div className="form-stack settings-place-form">
          {editingPlaceId&&<div className="editing-banner"><strong>Editing saved place</strong><button className="text-button" onClick={clearPlaceForm}>Cancel</button></div>}
          <label>Name<input value={placeName} onChange={e => setPlaceName(e.target.value)} placeholder="Gym, Walmart, Parents’ house"/></label>
          <label>Address (optional)<input value={placeAddress} onChange={e => setPlaceAddress(e.target.value)} placeholder="Manual address"/></label>
          <label>Category<select value={placeCategory} onChange={e => setPlaceCategory(e.target.value)}><option value="other">Other</option><option value="home">Home</option><option value="work">Work</option><option value="store">Store</option><option value="gym">Gym</option><option value="pharmacy">Pharmacy</option></select></label>
          <div className="place-actions"><button className="secondary-button" type="button" onClick={requestLocation} disabled={!featureFlags.LOCATION}><LocateFixed size={17}/>Use current location</button>{editingPlaceId&&<button className="text-button danger-text" type="button" onClick={removePlace}><Trash2 size={15}/>Delete</button>}<button className="primary-button" type="button" onClick={savePlace} disabled={!placeName.trim()}>{editingPlaceId?<><Edit3 size={17}/>Save place</>:<><Plus size={17}/>Add place</>}</button></div>
          {placeCoords && <p className="muted">Coordinates are saved with this place.</p>}
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
        <p className="muted">The extension reads product title, image and price from the page, syncs the shopping lists you can edit, and saves directly into JustGlance.</p>
        <div className={`extension-detection ${extensionDetected?'detected':'missing'}`}><span className="extension-dot"/><div><strong>{extensionDetected?`Extension detected${extensionVersion?` · v${extensionVersion}`:''}`:'Extension not detected on this JustGlance tab'}</strong><small>{extensionDetected?(extensionPaired?'This browser already has a JustGlance token.':'Ready for one-click pairing.'):'After loading/updating the extension, reload this JustGlance page once so Chrome can inject the pairing bridge.'}</small></div></div>
        <div className="browser-extension-actions"><a className="secondary-button" href="./chrome-extension/JustGlance-Chrome-Extension-v1.1.0.zip" download><Download size={17}/>Download v1.1.0</a><button className="primary-button" onClick={createBrowserPairing} disabled={browserBusy||demo}><Chrome size={17}/>{browserBusy?'Working…':extensionDetected?'Create & pair this browser':'Create manual pairing code'}</button></div>
        {browserToken&&<div className="pairing-token-card"><span>ONE-TIME PAIRING CODE</span><code>{browserToken}</code><div className="row-actions"><button className="secondary-button" onClick={async()=>navigator.clipboard.writeText(browserToken)}><Copy size={16}/>Copy code</button>{extensionDetected&&<button className="primary-button" onClick={pairExistingBrowserToken} disabled={browserBusy}><Chrome size={16}/>Pair this code</button>}</div><small>JustGlance stores only a hash. This raw code is shown only in this session.</small></div>}
        {browserMessage&&<div className="form-message">{browserMessage}</div>}
        <div className="integration-list"><div className="section-heading inline"><strong>Connected browsers</strong><button className="icon-button" onClick={loadBrowserIntegrations} aria-label="Refresh browser connections"><RefreshCw size={15}/></button></div>{connectedBrowserIntegrations.length?connectedBrowserIntegrations.map(integration=><div className="integration-row" key={integration.id}><span><b>{integration.name}</b><small>Last used {new Date(integration.last_used_at!).toLocaleString()}</small></span><button className="text-button danger-text" onClick={()=>revokeBrowserPairing(integration.id)}>Revoke</button></div>):<p className="muted">No browser has successfully used a pairing token yet.</p>}</div>
        {pendingBrowserIntegrations.length>0&&<div className="integration-list pending-integrations"><div className="section-heading inline"><div><strong>Unused pairing codes</strong><small>{pendingBrowserIntegrations.length} created but never used by an extension</small></div><button className="text-button" onClick={clearUnusedBrowserPairings} disabled={browserBusy}>Clear unused</button></div>{pendingBrowserIntegrations.slice(0,5).map(integration=><div className="integration-row pending" key={integration.id}><span><b>Pending browser pairing</b><small>Created {new Date(integration.created_at).toLocaleString()}</small></span><button className="text-button danger-text" onClick={()=>revokeBrowserPairing(integration.id)}>Revoke</button></div>)}</div>}
        <p className="muted">Install/update: unzip the download, open <b>chrome://extensions</b>, remove or reload the old Add to JustGlance extension, choose <b>Load unpacked</b>, then reload this JustGlance tab once. Version 1.0.0 is the build that produced the old “production configuration is not available yet” message.</p>
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
