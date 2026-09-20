import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function PasswordRecoveryPage() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (password.length < 8) return setMessage('Use at least 8 characters.')
    if (password !== confirm) return setMessage('Those passwords do not match.')
    setBusy(true)
    setMessage('')
    const error = await updatePassword(password)
    if (error) setMessage(error)
    setBusy(false)
  }

  return <div className="auth-page recovery-page">
    <section className="auth-brand-panel">
      <div className="brand-orb xl">J</div>
      <span className="eyebrow">JUSTGLANCE</span>
      <h1>One quick reset.</h1>
      <p>Choose a new password, then you’ll return to your normal glance.</p>
    </section>
    <section className="auth-card">
      <KeyRound size={28}/>
      <div><h2>Choose a new password</h2><p>Your reset link has been verified.</p></div>
      <label>New password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password"/></label>
      <label>Confirm password<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password"/></label>
      {message && <div className="form-message">{message}</div>}
      <button className="primary-button full" onClick={save} disabled={busy || !password || !confirm}>{busy ? 'Updating…' : 'Update password'}</button>
    </section>
  </div>
}
