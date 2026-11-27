import { fullUlr } from '../lib/labFormats'
import { useCallback, useEffect, useState } from 'react'
import { Trash2, Printer, Pencil, ArrowLeft, Mail } from 'lucide-react'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { documentMailUrl, openMailWindow } from '../lib/mailTab'
import { canUserAccess } from '../lib/roleConfig'
import { DataTable } from '../components/DataTable'
import { ReportEditPage } from './ReportEditPage'
import { HistoryButton } from '../components/History'

interface FinalReport {
  iReportId: number
  uid_no: string
  ulr_no?: string | null
  customer_details?: string | null
  create_date: string | null
  raw_date?: string | null
  agency_name: string
  report_type: string
  report_type_label: string
  status: string
  material_details: string | null
  reference_no: string | null
  source_location?: string | null
  work_order_no?: string | null
  sample_date?: string | null
  sample_tested_date?: string | null
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Complete: { bg: '#eefdf3', color: '#16a34a', border: '#bbf7d0' },
  Approved: { bg: '#eefdf3', color: '#16a34a', border: '#bbf7d0' },
  Pending: { bg: '#fffbeb', color: '#d97706', border: '#fef3c7' },
  Testing: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  'Report Generated': { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  Cancel: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
}

export function FinalReportsPage() {
  const [data, setData] = useState<FinalReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const { user } = useAuth()
  const canMail = canUserAccess(user, 'mail')
  const [printingId, setPrintingId] = useState<number | null>(null)
  const [editingReport, setEditingReport] = useState<{ type: string; id: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const res = await api.finalReports(params)
      setData(res.data as FinalReport[])
    } catch {
      setError('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { void load() }, [load])

  const handleDelete = async (id: number) => {
    if (!confirm('Do you really want to remove this report?')) return
    try {
      await api.deleteFinalReport(id)
      await load()
    } catch {
      setError('Failed to delete report')
    }
  }

  const handlePrint = async (r: FinalReport) => {
    setPrintingId(r.iReportId)
    try {
      await api.printLabReport(r.report_type, r.iReportId)
    } catch {
      setError(`Failed to download report print for ${r.uid_no}`)
    } finally {
      setPrintingId(null)
    }
  }

  if (editingReport) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => { setEditingReport(null); void load() }}
            className="ghost-button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} /> Back to Manage Reports
          </button>
        </div>
        <ReportEditPage
          type={editingReport.type}
          reportId={editingReport.id}
          onBack={() => { setEditingReport(null); void load() }}
        />
      </div>
    )
  }

  // Follow the exact columns and flow of Old Finallabreports
  // Date, UID No, ULR No, Name & Address, Agency Name, Reference No., Material Details, Location, Work Order No., Sample Date, Sample Tested Date, Status, Action
  const columns = [
    { key: 'create_date', label: 'Date' },
    { key: 'uid_no', label: 'UID No' },
    { key: 'ulr_no', label: 'ULR No' },
    { key: 'customer_details', label: 'Name & Address' },
    { key: 'agency_name', label: 'Agency Name' },
    { key: 'reference_no', label: 'Reference No.' },
    { key: 'material_details', label: 'Material Details' },
    { key: 'source_location', label: 'Location' },
    { key: 'work_order_no', label: 'Work Order No.' },
    { key: 'sample_date', label: 'Sample Date' },
    { key: 'sample_tested_date', label: 'Sample Tested Date' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Action', sortable: false },
  ]

  const rows = data.map((r) => {
    const sc = STATUS_COLORS[r.status] ?? { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' }
    return {
      searchText: [
        r.create_date,
        r.uid_no,
        r.ulr_no,
        r.customer_details,
        r.agency_name,
        r.reference_no,
        r.material_details,
        r.source_location,
        r.work_order_no,
        r.sample_date,
        r.sample_tested_date,
        r.status === 'Complete' ? 'Approved' : r.status,
      ].filter(Boolean).join(' '),
      create_date: (
        <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: '#334155' }}>
          {r.create_date ?? '-'}
        </span>
      ),
      uid_no: (
        <button
          type="button"
          onClick={() => setEditingReport({ type: r.report_type, id: r.iReportId })}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: '#2563eb',
            fontWeight: 700,
            cursor: 'pointer',
            textAlign: 'left',
            textDecoration: 'underline',
            fontSize: '0.84rem'
          }}
          title="Click to view/update report"
        >
          {r.uid_no}
        </button>
      ),
      ulr_no: (
        <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 600, color: r.ulr_no ? '#0f766e' : '#94a3b8' }}>
          {fullUlr(r.ulr_no, r.create_date) || '-'}
        </span>
      ),
      customer_details: (
        <div style={{ maxWidth: 180, whiteSpace: 'normal', fontSize: '0.8rem', lineHeight: 1.3, color: '#475569' }}>
          {r.customer_details || '-'}
        </div>
      ),
      agency_name: (
        <div style={{ maxWidth: 180, whiteSpace: 'normal', fontSize: '0.82rem', fontWeight: 500, color: '#1e293b' }}>
          {r.agency_name || '-'}
        </div>
      ),
      reference_no: (
        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
          {r.reference_no || '-'}
        </span>
      ),
      material_details: (
        <div style={{ maxWidth: 180, whiteSpace: 'normal', fontSize: '0.8rem', color: '#334155' }}>
          {r.material_details || '-'}
        </div>
      ),
      source_location: (
        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
          {r.source_location || '-'}
        </span>
      ),
      work_order_no: (
        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
          {r.work_order_no || '-'}
        </span>
      ),
      sample_date: (
        <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: '#64748b' }}>
          {r.sample_date || '-'}
        </span>
      ),
      sample_tested_date: (
        <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: '#64748b' }}>
          {r.sample_tested_date || '-'}
        </span>
      ),
      status: (
        <span
          style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 999,
            background: sc.bg,
            color: sc.color,
            border: `1px solid ${sc.border}`,
            fontSize: '0.75rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {r.status === 'Complete' ? 'Approved' : r.status}
        </span>
      ),
      actions: (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="icon-button" type="button" title="Print / PDF" disabled={printingId === r.iReportId} onClick={() => void handlePrint(r)}><Printer size={16} /></button>
          {canMail ? <button className="icon-button" type="button" title="Mail the PDF" onClick={() => openMailWindow(documentMailUrl('report', r.iReportId, false, r.report_type))}><Mail size={16} /></button> : null}
          <HistoryButton type="Report" id={r.iReportId} title={`Report ${r.uid_no ?? ''}`} />
          <button className="icon-button" type="button" title="Edit report" onClick={() => setEditingReport({ type: r.report_type, id: r.iReportId })}><Pencil size={16} /></button>
          <button className="icon-button" type="button" title="Delete report" onClick={() => void handleDelete(r.iReportId)}><Trash2 size={16} /></button>
        </div>
      ),
    }
  })

  return (
    <div>

      {error ? <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div> : null}

      <DataTable
        columns={columns}
        rows={loading ? [] : rows}
        filename="final-reports"
        showCount={false}
        emptyText={loading ? 'Loading reports...' : 'No approved reports found.'}
        toolbarEnd={<DateRangeFilter start={startDate} end={endDate} onApply={(start, end) => { setStartDate(start); setEndDate(end) }} />}
      />
    </div>
  )
}
