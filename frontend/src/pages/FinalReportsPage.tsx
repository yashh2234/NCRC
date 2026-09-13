import { useCallback, useEffect, useState } from 'react'
import { FileText, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { DataTable } from '../components/DataTable'

interface FinalReport {
  iReportId: number
  uid_no: string
  create_date: string | null
  agency_name: string
  report_type: string
  report_type_label: string
  status: string
  material_details: string | null
  reference_no: string | null
}

const STATUS_COLORS: Record<string, string> = {
  Complete: '#22c55e',
  Pending: '#e8a838',
  Cancel: '#ef4444',
  Testing: '#3b82f6',
  'Report Generated': '#8b5cf6',
}

export function FinalReportsPage() {
  const [data, setData] = useState<FinalReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      if (statusFilter) params.status = statusFilter
      const res = await api.finalReports(params)
      setData(res.data)
    } catch {
      setError('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, statusFilter])

  useEffect(() => { void load() }, [load])

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return
    try {
      await api.deleteFinalReport(id)
      await load()
    } catch {
      setError('Failed to delete report')
    }
  }

  const columns = [
    { key: 'create_date', label: 'Date' },
    { key: 'uid_no', label: 'UID No' },
    { key: 'agency_name', label: 'Agency' },
    { key: 'report_type_label', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'material_details', label: 'Material' },
    { key: 'actions', label: '', sortable: false },
  ]

  const rows = data.map((r) => ({
    create_date: r.create_date ?? '-',
    uid_no: r.uid_no,
    agency_name: r.agency_name ?? '-',
    report_type_label: (
      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, background: '#edf6f4', fontSize: '0.78rem', fontWeight: 600 }}>
        {r.report_type_label}
      </span>
    ),
    status: (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: 12,
          background: `${STATUS_COLORS[r.status] ?? '#999'}20`,
          color: STATUS_COLORS[r.status] ?? '#999',
          border: `1px solid ${STATUS_COLORS[r.status] ?? '#999'}40`,
          fontSize: '0.78rem',
          fontWeight: 600,
        }}
      >
        {r.status}
      </span>
    ),
    material_details: r.material_details ?? '-',
    actions: (
      <button
        className="icon-button"
        onClick={() => void handleDelete(r.iReportId)}
        type="button"
        title="Delete report"
      >
        <Trash2 size={16} color="#ef4444" />
      </button>
    ),
  }))

  return (
    <section className="surface">
      <div className="surface-heading">
        <div>
          <p className="section-label">All report types</p>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} />
            Final Lab Reports
          </h2>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d0d7de', fontSize: '0.82rem' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d0d7de', fontSize: '0.82rem' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d0d7de', fontSize: '0.82rem' }}
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Testing">Testing</option>
          <option value="Report Generated">Report Generated</option>
          <option value="Complete">Complete</option>
          <option value="Cancel">Cancel</option>
        </select>
        {(startDate || endDate || statusFilter) ? (
          <button
            className="ghost-button"
            onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter('') }}
            type="button"
            style={{ fontSize: '0.78rem' }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      {loading ? (
        <p className="empty-state">Loading reports...</p>
      ) : data.length === 0 ? (
        <p className="empty-state">No reports found.</p>
      ) : (
        <DataTable columns={columns} rows={rows} filename="final-reports" />
      )}
    </section>
  )
}
