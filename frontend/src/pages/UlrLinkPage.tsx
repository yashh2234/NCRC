import { useCallback, useEffect, useRef, useState } from 'react'
import { Link2, CheckCircle2, AlertCircle, X, Upload } from 'lucide-react'
import { api } from '../lib/api'
import { useTracking } from '../lib/useTracking'
import { Req } from '../components/ui'
import { Select } from '../components/Select'

interface DropdownItem {
  id?: number
  ulr_no: string
  uid_no?: string | null
  is_assigned: boolean
  label: string
}

export function UlrLinkPage() {
  useTracking('ulr_add')

  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Quick link table form states (exact flow as Old software Ulrlink/index.php)
  const todayStr = new Date().toISOString().slice(0, 10)
  const [quickDate, setQuickDate] = useState(todayStr)
  const [quickUid, setQuickUid] = useState('')
  const [quickUlr, setQuickUlr] = useState('')
  const [newUlrInput, setNewUlrInput] = useState('')
  const [quickDept, setQuickDept] = useState('')
  const [quickAgency, setQuickAgency] = useState('')
  const [quickWork, setQuickWork] = useState('')
  const [quickSample, setQuickSample] = useState('')
  const [dropdownUlrList, setDropdownUlrList] = useState<DropdownItem[]>([])
  const [uidSuggestions, setUidSuggestions] = useState<Array<{ uid_no: string; agency_name: string; reporting_address?: string; name_of_work: string; sample_details: string }>>([])
  const [isLinking, setIsLinking] = useState(false)
  const pickedUidRef = useRef('')
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const lookupSeqRef = useRef(0)

  // Load ULR list for active date
  const loadDateDropdown = useCallback(async (date: string) => {
    try {
      const res = await api.ulrDropdown(date)
      setDropdownUlrList(res.data)
    } catch {
      // fallback
    }
  }, [])

  useEffect(() => {
    // Don't reopen the list right after a UID was picked from it.
    if (quickUid.trim().length < 2 || quickUid === pickedUidRef.current) {
      setUidSuggestions([])
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.searchRegistrationUids(quickUid.trim())
        setUidSuggestions(res.data)
      } catch {
        setUidSuggestions([])
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [quickUid])

  useEffect(() => {
    void loadDateDropdown(quickDate)
  }, [quickDate, loadDateDropdown])

  // Lookup UID automatically or on blur (like Old getuiddetails)
  const handleUidLookup = async (uidToLookup?: string) => {
    const uid = (uidToLookup ?? quickUid).trim()
    if (!uid) return
    const seq = ++lookupSeqRef.current
    try {
      const res = await api.ulrClientDetails(uid)
      // Ignore an older lookup that finishes after a newer one.
      if (seq !== lookupSeqRef.current || !res.data) return
      setQuickAgency(res.data.agency_name || '')
      setQuickDept(res.data.reporting_address || '')
      setQuickWork(res.data.name_of_work || '')
      // Only the test category names, e.g. "Bricks, Cement"
      setQuickSample(res.data.test_categories ?? res.data.sample_details ?? '')
    } catch {
      // leave the fields for manual entry
    }
  }

  const pickUid = (uid: string) => {
    pickedUidRef.current = uid
    setQuickUid(uid)
    setUidSuggestions([])
    void handleUidLookup(uid)
  }

  // Submit linking (Old formsubmit flow)
  const handleQuickLinkSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!quickUid.trim()) {
      setError('Please enter UID No.')
      return
    }
    if (!quickAgency.trim()) {
      setError('Please enter Agency Name')
      return
    }
    if (!quickUlr) {
      setError('Please select or create ULR No.')
      return
    }
    if (quickUlr === 'new' && !newUlrInput.trim()) {
      setError('Please enter the New ULR No.')
      return
    }
    const typedUlr = newUlrInput.trim().toLowerCase()
    const alreadyAssigned = quickUlr === 'new'
      ? dropdownUlrList.find(item => item.is_assigned && item.ulr_no.toLowerCase() === typedUlr)
      : dropdownUlrList.find(item => item.is_assigned && item.ulr_no === quickUlr)
    if (alreadyAssigned) {
      setError(`ULR ${alreadyAssigned.ulr_no} is already assigned to UID ${alreadyAssigned.uid_no}.`)
      return
    }

    setIsLinking(true)
    setError('')
    try {
      await api.createUlrLink({
        date: quickDate,
        uid_no: quickUid,
        ulr_no: quickUlr,
        new_ulr_no: quickUlr === 'new' ? newUlrInput.trim() : undefined,
        name_of_department: quickDept,
        name_of_agency: quickAgency,
        name_of_project: quickWork,
        sample_details: quickSample,
      })
      setSuccessMsg(`ULR ${quickUlr === 'new' ? newUlrInput.trim() : quickUlr} linked to UID ${quickUid.trim()}`)
      setQuickUid('')
      setQuickAgency('')
      setQuickDept('')
      setQuickWork('')
      setQuickSample('')
      setQuickUlr('')
      setNewUlrInput('')
      pickedUidRef.current = ''
      void loadDateDropdown(quickDate)
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Failed to link ULR. Please check inputs.')
      void loadDateDropdown(quickDate)
    } finally {
      setIsLinking(false)
    }
  }

  // Year's ULR list (NCS 2026.xlsx): each ULR No. on its Excel date, offered when that date is picked
  const handleImport = async (file: File | undefined) => {
    if (!file) return
    setImporting(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await api.importUlrList(file)
      setSuccessMsg(res.message)
      await loadDateDropdown(quickDate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <input ref={importInputRef} type="file" accept=".xlsx" hidden onChange={(e) => void handleImport(e.target.files?.[0])} />
        <button type="button" className="btn btn-outline btn-sm" disabled={importing} onClick={() => importInputRef.current?.click()}
          title="Excel with ULR No. and Date columns, e.g. NCS 2026.xlsx. Linked ULRs are not changed.">
          <Upload size={14} /> {importing ? 'Importing…' : 'Import ULR list (Excel)'}
        </button>
      </div>
      {/* Notifications */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <AlertCircle size={16} />
          {error}
          <button type="button" onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: '#b91c1c' }}><X size={14} /></button>
        </div>
      )}
      {successMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      <section className="surface" style={{ padding: 20, borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff' }}>
        <form onSubmit={handleQuickLinkSubmit} style={{ overflow: 'visible' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, overflow: 'visible' }}>
                  <label className="form-field" style={{ overflow: 'visible' }}>
                    <span>Date<Req /></span>
                    <input
                      type="date"
                      value={quickDate}
                      onChange={e => {
                        setQuickDate(e.target.value)
                        void loadDateDropdown(e.target.value)
                      }}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                    />
                  </label>

                  <label className="form-field" style={{ overflow: 'visible' }}>
                    <span>UID No<Req /></span>
                    <div style={{ position: 'relative', display: 'flex', zIndex: uidSuggestions.length > 0 ? 30 : 1 }}>
                      <input
                        type="text"
                        placeholder="Enter UID number"
                        value={quickUid}
                        onChange={e => setQuickUid(e.target.value)}
                        onBlur={() => { setUidSuggestions([]); void handleUidLookup() }}
                        style={{ minWidth: 0, flex: 1, padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                      />
                      {uidSuggestions.length > 0 && (
                        <div className="dd-sugg" style={{ minWidth: 260 }}>
                          {uidSuggestions.map(suggestion => (
                            <button
                              key={suggestion.uid_no}
                              type="button"
                              // mousedown + preventDefault: fill on the first click, before the input blurs
                              onMouseDown={e => { e.preventDefault(); pickUid(suggestion.uid_no) }}
                            >
                              <strong>{suggestion.uid_no}</strong>
                              <span style={{ display: 'block', marginTop: 2, fontSize: '0.75rem', color: '#64748b' }}>{suggestion.agency_name || suggestion.name_of_work || 'Registration'}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>

                  <label className="form-field">
                    <span>ULR No<Req /></span>
                    <Select
                      value={quickUlr}
                      onChange={e => setQuickUlr(e.target.value)}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.86rem', background: '#fff' }}
                    >
                      <option value="">Select ULR No.</option>
                      {dropdownUlrList.map(item => (
                        <option key={item.id ?? item.ulr_no} value={item.ulr_no} disabled={item.is_assigned}>
                          {item.label}
                        </option>
                      ))}
                      <option value="new">+ New Create</option>
                    </Select>

                    {quickUlr === 'new' && (
                      <input
                        type="text"
                        placeholder="Enter New ULR No. (e.g. 107343A)"
                        value={newUlrInput}
                        onChange={e => setNewUlrInput(e.target.value)}
                        style={{ width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 6, border: '1px solid #93c5fd', fontSize: '0.84rem', background: '#eff6ff' }}
                      />
                    )}
                  </label>

                  <label className="form-field">
                    <span>Name of Department</span>
                    <input
                      type="text"
                      placeholder="Department"
                      value={quickDept}
                      onChange={e => setQuickDept(e.target.value)}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                    />
                  </label>

                  <label className="form-field">
                    <span>Name of Agency<Req /></span>
                    <input
                      type="text"
                      placeholder="Agency name"
                      value={quickAgency}
                      onChange={e => setQuickAgency(e.target.value)}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                    />
                  </label>

                  <label className="form-field">
                    <span>Name of Work</span>
                    <input
                      type="text"
                      placeholder="Name of work"
                      value={quickWork}
                      onChange={e => setQuickWork(e.target.value)}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                    />
                  </label>

                  <label className="form-field">
                    <span>Sample Details</span>
                    <input
                      type="text"
                      placeholder="Sample details"
                      value={quickSample}
                      onChange={e => setQuickSample(e.target.value)}
                      style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.86rem' }}
                    />
                  </label>

                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={isLinking}
                      className="primary-button"
                      style={{ width: '100%', minHeight: 40, padding: '9px 12px', fontSize: '0.86rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <Link2 size={14} /> {isLinking ? 'Linking...' : 'Link'}
                    </button>
                  </div>
          </div>
        </form>
      </section>
    </div>
  )
}
