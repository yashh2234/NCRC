import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Download } from 'lucide-react'
import { api } from '../lib/api'
import { WorkflowStatusBadge } from '../components/WorkflowStatusBadge'

interface DueReport {
  iClientId: number
  uid_no: string
  received_date: string | null
  agency_name: string
  reporting_address: string
  mobile_no: string
  name_of_work: string
  sample_details: string
  total_payment: number
  advance_payment: number
  balance_dues: number
  scan_copy: string | null
  report_copy: string | null
}

function money(v: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v)
}

function balanceColor(total: number, advance: number) {
  const balance = total - advance
  if (balance <= 0) return '#22c55e'
  if (balance < total * 0.5) return '#e8a838'
  return '#ef4444'
}

export function DueReportsPage() {
  const [data, setData] = useState<DueReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (startDate && endDate) { params.start_date = startDate; params.end_date = endDate }
      const res = await api.dueReports(params)
      setData(res.data)
    } catch {
      setError('Failed to load due reports')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { void load() }, [load])

  const handleFilter = () => { void load() }
  const handleClearFilter = () => { setStartDate(''); setEndDate('') }

  const handleExport = () => {
    const header = 'UID No,Date,Agency,Address,Mobile,Work,Sample,Total,Advance,Balance\n'
    const rows = data.map(r => {
      const balance = r.total_payment - r.advance_payment
      return `"${r.uid_no}","${r.received_date ?? ''}","${r.agency_name}","${r.reporting_address}","${r.mobile_no}","${r.name_of_work}","${r.sample_details}",${r.total_payment},${r.advance_payment},${balance}`
    }).join('\n')
    const csv = header + rows
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `due_reports_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="surface">
      <div className="surface-heading">
        <div>
          <p className="section-label">Overdue</p>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={20} color="#e8a838" />
            Due Reports
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #dfe6ea', borderRadius: 6, fontSize: '0.85rem' }} />
            <span style={{ color: '#65737d' }}>to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #dfe6ea', borderRadius: 6, fontSize: '0.85rem' }} />
            <button className="ghost-button" onClick={handleFilter}>Go</button>
            {(startDate || endDate) && <button className="ghost-button" onClick={handleClearFilter}>Clear</button>}
          </div>
          <button className="ghost-button" onClick={handleExport}><Download size={14} /> Export CSV</button>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <p className="empty-state">Loading due reports...</p>
      ) : data.length === 0 ? (
        <p className="empty-state">No overdue reports found. All samples have reports assigned.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>UID No</th>
                <th>Workflow</th>
                <th>Date</th>
                <th>Agency</th>
                <th>Mobile</th>
                <th>Work</th>
                <th>Sample</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Advance</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => {
                const balance = r.total_payment - r.advance_payment
                return (
                  <tr key={r.iClientId}>
                    <td><strong>{r.uid_no}</strong></td>
                    <td><WorkflowStatusBadge uidNo={r.uid_no} compact /></td>
                    <td>{r.received_date ?? '-'}</td>
                    <td>{r.agency_name ?? '-'}</td>
                    <td>{r.mobile_no ?? '-'}</td>
                    <td>{r.name_of_work ?? '-'}</td>
                    <td>{r.sample_details ?? '-'}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.total_payment)}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.advance_payment)}</td>
                    <td style={{ textAlign: 'right', color: balanceColor(r.total_payment, r.advance_payment), fontWeight: 600 }}>
                      {money(balance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
