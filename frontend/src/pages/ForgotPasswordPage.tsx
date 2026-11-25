import { useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'

interface ForgotPasswordPageProps {
  onBack: () => void
}

/** A 6-digit code is mailed to the user; with it a new password is set. */
export function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>) => {
    setError('')
    setMessage('')
    setBusy(true)
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.') } finally { setBusy(false) }
  }

  const send = () => run(async () => {
    const result = await api.forgotPassword(email.trim())
    setCode('')
    setMessage(result.message)
    setStep('reset')
  })

  const reset = (event: FormEvent) => {
    event.preventDefault()
    if (password !== confirm) { setError('The two passwords are not the same.'); return }
    void run(async () => {
      const result = await api.resetPassword(email.trim(), code, password, confirm)
      setMessage(result.message)
      setStep('done')
    })
  }

  const back = <button type="button" className="ghost-button" onClick={onBack}><ArrowLeft size={16} /> Back to login</button>

  return (
    <main className="login-screen">
      <section className="login-art">
        <img className="login-logo" src={`${import.meta.env.BASE_URL}namotech-logo.png`} alt="Namotech Consultancy" />
        <div className="login-art__body">
          <h1>Forgot password</h1>
          <p>A 6-digit code is sent to your work email. With it you set a new password.</p>
        </div>
        <span className="login-art__foot">Internal software · Authorized personnel only</span>
      </section>

      {step === 'email' ? (
        <form className="auth-panel" onSubmit={(e) => { e.preventDefault(); void send() }}>
          <div><h2>Get a code</h2><p className="auth-panel__sub">Enter the email you sign in with.</p></div>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {error ? <div className="error-banner" role="alert">{error}</div> : null}
          <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
          {back}
        </form>
      ) : step === 'reset' ? (
        <form className="auth-panel" onSubmit={reset}>
          <div><h2>Set a new password</h2><p className="auth-panel__sub">{email}</p></div>
          {message ? <div className="success-banner">{message}</div> : null}
          <label>Code from the mail<input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" title="6 digits" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required /></label>
          <label>New password (at least 8 characters)<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <label>New password again<input type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></label>
          {error ? <div className="error-banner" role="alert">{error}</div> : null}
          <button type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Set password'}</button>
          <button type="button" className="ghost-button" disabled={busy} onClick={() => void send()}>Send a new code</button>
          {back}
        </form>
      ) : (
        <div className="auth-panel">
          <div><h2>Done</h2></div>
          <div className="success-banner">{message}</div>
          {back}
        </div>
      )}
    </main>
  )
}
