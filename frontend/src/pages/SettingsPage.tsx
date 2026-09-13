import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Save, Lock } from 'lucide-react'
import { api, request } from '../lib/api'

interface CompanyData {
  id: number
  company_name: string
  address: string
  corporate_address: string
  gst_no: string
  pan_no: string
  phone: string
  bank_name: string
  account_number: string
  ifsc_code: string
  account_name: string
  currency: string
  message: string
}

export function SettingsPage() {
  const [company, setCompany] = useState<CompanyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', new_password_confirmation: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await request<{ data: CompanyData }>('/settings/company')
      setCompany(data.data)
    } catch {
      setMessage('Unable to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!company) return
    setSaving(true)
    try {
      await request('/settings/company', {
        method: 'PUT',
        body: JSON.stringify(company),
      })
      setMessage('Settings saved')
    } catch {
      setMessage('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPwSaving(true)
    setPwMessage('')
    try {
      await api.changePassword(pwForm)
      setPwMessage('Password changed successfully')
      setPwForm({ current_password: '', new_password: '', new_password_confirmation: '' })
    } catch {
      setPwMessage('Password change failed')
    } finally {
      setPwSaving(false)
    }
  }

  if (loading) return <p className="empty-state">Loading settings...</p>

  const fields: Array<{ key: keyof CompanyData; label: string; type?: string }> = [
    { key: 'company_name', label: 'Company Name' },
    { key: 'address', label: 'Address' },
    { key: 'corporate_address', label: 'Corporate Address' },
    { key: 'gst_no', label: 'GST No' },
    { key: 'pan_no', label: 'PAN No' },
    { key: 'phone', label: 'Phone' },
    { key: 'bank_name', label: 'Bank Name' },
    { key: 'account_number', label: 'Account Number' },
    { key: 'ifsc_code', label: 'IFSC Code' },
    { key: 'account_name', label: 'Account Name' },
    { key: 'currency', label: 'Currency' },
    { key: 'message', label: 'Report Message' },
  ]

  return (
    <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <form className="surface" onSubmit={handleSubmit}>
        <div className="surface-heading">
          <div>
            <p className="section-label">Configuration</p>
            <h2>Company settings</h2>
          </div>
          <button type="submit" disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {message ? <div className="error-banner" style={{ marginBottom: 16 }}>{message}</div> : null}

        {company ? (
          <div className="settings-section">
            {fields.map((f) => (
              <div className="setting-row" key={f.key}>
                <span className="setting-label">{f.label}</span>
                {f.key === 'message' ? (
                  <textarea
                    value={company[f.key] ?? ''}
                    onChange={(e) => setCompany((c) => c ? { ...c, [f.key]: e.target.value } : c)}
                    rows={3}
                  />
                ) : (
                  <input
                    type={f.type ?? 'text'}
                    value={company[f.key] ?? ''}
                    onChange={(e) => setCompany((c) => c ? { ...c, [f.key]: e.target.value } : c)}
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}
      </form>

      <form className="surface" onSubmit={handlePasswordChange}>
        <div className="surface-heading">
          <div>
            <p className="section-label">Security</p>
            <h2>Change password</h2>
          </div>
          <button type="submit" disabled={pwSaving}>
            <Lock size={18} />
            {pwSaving ? 'Changing...' : 'Update'}
          </button>
        </div>

        {pwMessage ? <div className="error-banner" style={{ marginBottom: 16 }}>{pwMessage}</div> : null}

        <div className="settings-section">
          <div className="setting-row">
            <span className="setting-label">Current password</span>
            <input type="password" value={pwForm.current_password} onChange={(e) => setPwForm((c) => ({ ...c, current_password: e.target.value }))} />
          </div>
          <div className="setting-row">
            <span className="setting-label">New password</span>
            <input type="password" value={pwForm.new_password} onChange={(e) => setPwForm((c) => ({ ...c, new_password: e.target.value }))} />
          </div>
          <div className="setting-row">
            <span className="setting-label">Confirm new password</span>
            <input type="password" value={pwForm.new_password_confirmation} onChange={(e) => setPwForm((c) => ({ ...c, new_password_confirmation: e.target.value }))} />
          </div>
        </div>
      </form>
    </div>
  )
}