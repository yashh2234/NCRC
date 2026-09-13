import { useState, useEffect } from 'react'
import { Plus, X, Save, FlaskConical, CheckCircle, XCircle, Clock } from 'lucide-react'
import { request } from '../lib/api'

interface TestResult {
  id: number
  job_id: number
  job_assignment_id: number | null
  test_id: number
  test_name: string | null
  result_value: string | null
  unit: string | null
  specification_limit: string | null
  standard_name: string | null
  method_name: string | null
  status: string
  remarks: string | null
  tested_by: number | null
  tested_at: string | null
  test?: { id: number; name: string; code: string } | null
  category?: { id: number; name: string } | null
  tester?: { id: number; name: string } | null
}

interface TestMaster {
  id: number
  name: string
  code: string
  unit: string | null
  specification_limit: string | null
  category_id?: number
  category?: { id: number; name: string }
}

interface TestResultManagerProps { jobId: number }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#f3f4f6', color: '#6b7280' },
  in_progress: { bg: '#fef3c7', color: '#92400e' },
  completed: { bg: '#d1fae5', color: '#065f46' },
  failed: { bg: '#fce7f3', color: '#9d174d' },
}

export function TestResultManager({ jobId }: TestResultManagerProps) {
  const [results, setResults] = useState<TestResult[]>([])
  const [tests, setTests] = useState<TestMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [selectedTests, setSelectedTests] = useState<number[]>([])
  const [batchValues, setBatchValues] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadResults(); loadTests() }, [jobId])

  const loadResults = async () => {
    setLoading(true)
    try {
      const d = await request<TestResult[] | { data: TestResult[] }>(`/jobs/${jobId}/test-results`)
      setResults(Array.isArray(d) ? d : d.data)
    } catch {} finally { setLoading(false) }
  }

  const loadTests = async () => {
    try {
      const d = await request<{ data: TestMaster[] } | TestMaster[]>('/tests/list')
      setTests(Array.isArray(d) ? d : d.data)
    } catch {}
  }

  const toggleTest = (testId: number) => {
    setSelectedTests(prev =>
      prev.includes(testId) ? prev.filter(id => id !== testId) : [...prev, testId]
    )
  }

  const saveBatch = async () => {
    const resultsToSave = selectedTests
      .filter(id => batchValues[id])
      .map(id => {
        const test = tests.find(t => t.id === id)
        return {
          test_id: id,
          test_name: test?.name ?? '',
          result_value: batchValues[id] ?? '',
          unit: test?.unit ?? '',
          specification_limit: test?.specification_limit ?? '',
        }
      })
    if (resultsToSave.length === 0) { alert('Select at least one test with a value'); return }
    setSaving(true)
    try {
      await request(`/jobs/${jobId}/test-results/batch`, {
        method: 'POST',
        body: JSON.stringify({ results: resultsToSave }),
      })
      setShowBatchForm(false)
      setSelectedTests([])
      setBatchValues({})
      await loadResults()
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  const updateStatus = async (r: TestResult, status: string) => {
    await request(`/test-results/${r.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, result_value: r.result_value }),
    })
    await loadResults()
  }

  const deleteResult = async (r: TestResult) => {
    if (!window.confirm('Delete this test result?')) return
    await request(`/test-results/${r.id}`, { method: 'DELETE' })
    await loadResults()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.85rem', color: '#65737d' }}>{results.length} result(s)</span>
        {!showBatchForm ? (
          <button className="ghost-button" onClick={() => setShowBatchForm(true)} type="button">
            <Plus size={14} /> Record Tests
          </button>
        ) : null}
      </div>

      {showBatchForm ? (
        <div style={{ padding: 12, border: '1px solid #e8eef1', borderRadius: 8, marginBottom: 12, background: '#fbfcfd' }}>
          <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 8 }}>Select Tests & Enter Values</strong>
          <div style={{ maxHeight: 300, overflow: 'auto', marginBottom: 8 }}>
            {tests.map(t => (
              <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: selectedTests.includes(t.id) ? '#e8f4fd' : 'transparent' }}>
                <input type="checkbox" checked={selectedTests.includes(t.id)} onChange={() => toggleTest(t.id)} />
                <span style={{ flex: 1, fontSize: '0.82rem' }}>{t.name} <span style={{ color: '#65737d', fontSize: '0.72rem' }}>{t.code}</span></span>
                {t.unit ? <span style={{ fontSize: '0.72rem', color: '#65737d' }}>({t.unit})</span> : null}
                {selectedTests.includes(t.id) ? (
                  <input
                    value={batchValues[t.id] ?? ''}
                    onChange={e => setBatchValues(v => ({ ...v, [t.id]: e.target.value }))}
                    placeholder="Value"
                    style={{ width: 100, fontSize: '0.78rem', padding: '3px 6px' }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : null}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ghost-button" onClick={() => void saveBatch()} type="button" disabled={saving}>
              <Save size={14} /> {saving ? 'Saving...' : 'Save All'}
            </button>
            <button className="ghost-button" onClick={() => { setShowBatchForm(false); setSelectedTests([]); setBatchValues({}) }} type="button">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? <p style={{ color: '#65737d', fontSize: '0.85rem' }}>Loading...</p> : null}

      {!loading && results.length === 0 && !showBatchForm ? (
        <p style={{ color: '#65737d', fontSize: '0.85rem' }}>No test results recorded yet.</p>
      ) : null}

      <div style={{ display: 'grid', gap: 8 }}>
        {results.map(r => {
          const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending
          return (
            <div key={r.id} style={{ padding: '10px 14px', border: '1px solid #e8eef1', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FlaskConical size={14} style={{ color: '#65737d' }} />
                  <strong style={{ fontSize: '0.85rem' }}>{r.test_name || r.test?.name || 'Test #' + r.test_id}</strong>
                  {r.result_value !== null ? <span style={{ fontSize: '0.9rem', fontWeight: 700 }}> = {r.result_value} {r.unit}</span> : null}
                </div>
                <span className="sync-pill" style={{ background: st.bg, color: st.color, fontSize: '0.72rem' }}>{r.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.78rem', color: '#65737d', flexWrap: 'wrap' }}>
                {r.specification_limit ? <span>Spec: {r.specification_limit}</span> : null}
                {r.standard_name ? <span>Std: {r.standard_name}</span> : null}
                {r.method_name ? <span>Method: {r.method_name}</span> : null}
                {r.tester ? <span>By: {r.tester.name}</span> : null}
                {r.tested_at ? <span>{new Date(r.tested_at).toLocaleString()}</span> : null}
              </div>
              {r.remarks ? <p style={{ fontSize: '0.76rem', color: '#4a5b66', marginTop: 4 }}>{r.remarks}</p> : null}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {r.status === 'pending' ? (
                  <button className="ghost-button" onClick={() => void updateStatus(r, 'in_progress')} type="button" style={{ fontSize: '0.72rem' }}>
                    <Clock size={11} /> Start
                  </button>
                ) : null}
                {r.status === 'in_progress' ? (
                  <>
                    <button className="ghost-button" onClick={() => void updateStatus(r, 'completed')} type="button" style={{ fontSize: '0.72rem', color: '#065f46' }}>
                      <CheckCircle size={11} /> Pass
                    </button>
                    <button className="ghost-button" onClick={() => void updateStatus(r, 'failed')} type="button" style={{ fontSize: '0.72rem', color: '#9d174d' }}>
                      <XCircle size={11} /> Fail
                    </button>
                  </>
                ) : null}
                <button className="ghost-button" onClick={() => void deleteResult(r)} type="button" style={{ fontSize: '0.72rem', color: '#ef4444', marginLeft: 'auto' }}>
                  <X size={11} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
