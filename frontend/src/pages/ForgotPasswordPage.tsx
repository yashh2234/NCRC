import { useState, type FormEvent } from 'react'
import { FlaskConical, ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'

interface ForgotPasswordPageProps {
  onBack: () => void
}

export function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [storedToken, setStoredToken] = useState('')

  const handleSendToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      const result = await api.forgotPassword(email)
      setStoredToken(result.token)
      setMessage('Password reset token generated. Copy the token below and use it to reset your password.')
      setStep('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate token')
    }
  }

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await api.resetPassword(email, token, newPassword, confirmPassword)
      setMessage('Password reset successful! You can now sign in with your new password.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    }
  }

  if (step === 'email') {
    return (
      <main className="login-screen">
        <section className="login-art">
          <div className="brand-mark">
            <FlaskConical size={26} />
            <span>NCRC</span>
          </div>
          <h1>Forgot Password</h1>
          <p>Enter your email address to receive a password reset token.</p>
        </section>

        <form className="auth-panel" onSubmit={handleSendToken}>
          <div>
            <p className="section-label">Password reset</p>
            <h2>Request token</h2>
          </div>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {error ? <div className="error-banner">{error}</div> : null}
          {message ? <div className="success-banner">{message}</div> : null}
          <button type="submit">Send Reset Token</button>
          <button type="button" className="ghost-button" onClick={onBack}>
            <ArrowLeft size={16} />
            Back to Login
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="login-screen">
      <section className="login-art">
        <div className="brand-mark">
          <FlaskConical size={26} />
          <span>NCRC</span>
        </div>
        <h1>Reset Password</h1>
        <p>Use the token to set a new password for your account.</p>
      </section>

      <form className="auth-panel" onSubmit={handleResetPassword}>
        <div>
          <p className="section-label">Password reset</p>
          <h2>Set new password</h2>
        </div>
        {storedToken ? (
          <label>
            Your token (copy this)
            <input value={storedToken} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
          </label>
        ) : null}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Token
          <input value={token} onChange={(e) => setToken(e.target.value)} required />
        </label>
        <label>
          New Password
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </label>
        <label>
          Confirm Password
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </label>
        {error ? <div className="error-banner">{error}</div> : null}
        {message ? <div className="success-banner">{message}</div> : null}
        {message && !error ? (
          <button type="button" className="ghost-button" onClick={onBack}>
            <ArrowLeft size={16} />
            Back to Login
          </button>
        ) : (
          <button type="submit">Reset Password</button>
        )}
      </form>
    </main>
  )
}
