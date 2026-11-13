import { useMemo, useState } from 'react'
import { Plus, Search, Trash2, ExternalLink, Pencil, CalendarDays } from 'lucide-react'
import {
  type Tender, TENDER_STORAGE_KEY, DATE_FIELDS, URGENCY_STYLES,
  loadTenders, nextSrNo, daysLeft, tenderUrgency, formatDate,
} from '../lib/tenders'

type TenderField = Exclude<keyof Tender, 'id' | 'srNo'>
type ColumnKey = TenderField | 'daysLeft' | 'dates'

const emptyTender: Omit<Tender, 'id' | 'srNo'> = {
  tenderId: '', title: '', department: '', portal: '', location: '', value: '', emd: '-', fee: '-',
  openDate: '', preBidDate: '', queryDate: '', closingDate: '', openingDate: '', eligibility: 'Pending',
  decision: 'Under Review', submissionStatus: 'Not Started', responsible: '', requirements: '',
  tenderLink: '', driveLink: '', remarks: '',
}

// Table column order
const tableColumns: Array<[ColumnKey, string]> = [
  ['tenderId', 'Tender ID / Bid No.'], ['title', 'Tender Title / Work Description'],
  ['department', 'Department / Client'], ['location', 'Location'], ['daysLeft', 'Days Left'],
  ['value', 'Tender Value'], ['emd', 'EMD'], ['fee', 'Tender Fee'],
  ['eligibility', 'Eligibility Checked?'], ['decision', 'Decision'],
  ['tenderLink', 'Tender Link'], ['driveLink', 'Tender Document Drive Link'],
  ['dates', 'Dates'], ['responsible', 'Responsible Person'],
  ['requirements', 'Documents / Requirements'], ['portal', 'Portal'], ['remarks', 'Remarks / Next Action'],
]

const TITLE_PREVIEW_CHARS = 120
const PAST_STATUSES = ['Won', 'Lost']

const STATUS_BADGE: Record<string, { background: string; color: string }> = {
  'Not Started': { background: '#f1f5f9', color: '#475569' },
  'In Progress': { background: '#dbeafe', color: '#1d4ed8' },
  Submitted: { background: '#ede9fe', color: '#6d28d9' },
  Won: { background: '#dcfce7', color: '#15803d' },
  Lost: { background: '#fee2e2', color: '#b91c1c' },
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_BADGE[status] ?? STATUS_BADGE['Not Started']
  return <span style={{ ...style, display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{status || 'Not Started'}</span>
}

function cellStyle(key: ColumnKey): React.CSSProperties {
  if (key === 'dates' || key === 'tenderId') return { whiteSpace: 'nowrap', minWidth: key === 'dates' ? 150 : undefined, paddingRight: key === 'tenderId' ? 24 : undefined }
  if (key === 'title') return { maxWidth: 280, minWidth: 240, whiteSpace: 'normal', paddingLeft: 16 }
  return { maxWidth: key === 'requirements' || key === 'remarks' ? 280 : 160, whiteSpace: 'normal' }
}

function withRs(value: string) {
  const trimmed = (value || '').trim()
  if (!trimmed || trimmed === '-') return '-'
  return /^(rs\.?|₹)/i.test(trimmed) ? trimmed : `Rs. ${trimmed}`
}

// Form field order
const formFields: Array<[TenderField, string]> = [
  ['tenderId', 'Tender ID / Bid No.'], ['title', 'Tender Title / Work Description'],
  ['department', 'Department / Client'], ['portal', 'Portal'], ['location', 'Location'],
  ['value', 'Tender Value (₹)'], ['emd', 'EMD (₹)'], ['fee', 'Tender Fee (₹)'],
  ...(DATE_FIELDS as Array<[TenderField, string]>),
  ['eligibility', 'Eligibility Checked?'], ['decision', 'Decision'], ['submissionStatus', 'Submission Status'],
  ['responsible', 'Responsible Person'], ['requirements', 'Documents / Requirements'], ['remarks', 'Remarks / Next Action'],
]

export function TenderPage() {
  const [tenders, setTenders] = useState<Tender[]>(loadTenders)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyTender)
  const [datesFor, setDatesFor] = useState<Tender | null>(null)
  const [titleFor, setTitleFor] = useState<Tender | null>(null)

  const save = (next: Tender[]) => {
    setTenders(next)
    localStorage.setItem(TENDER_STORAGE_KEY, JSON.stringify(next))
  }
  const searched = useMemo(() => tenders.filter((tender) => {
    const text = `${tender.srNo} ${tender.tenderId} ${tender.title} ${tender.department} ${tender.portal}`.toLowerCase()
    return !search || text.includes(search.toLowerCase())
  }), [tenders, search])
  const activeTenders = searched.filter((t) => !PAST_STATUSES.includes(t.submissionStatus) && (!status || t.submissionStatus === status))
  const pastTenders = searched.filter((t) => PAST_STATUSES.includes(t.submissionStatus))
  const today = new Date().setHours(0, 0, 0, 0)
  const upcoming = tenders.filter((tender) => tender.closingDate && new Date(`${tender.closingDate}T00:00:00`).getTime() >= today && tender.submissionStatus !== 'Submitted').length
  const yellowCount = tenders.filter((t) => tenderUrgency(t) === 'yellow').length
  const redCount = tenders.filter((t) => tenderUrgency(t) === 'red').length

  const update = (key: TenderField, value: string) => setForm((previous) => ({ ...previous, [key]: value }))
  const openAddForm = () => {
    setEditingId(null)
    setForm(emptyTender)
    setShowForm(true)
  }

  const openEditForm = (tender: Tender) => {
    const { id, srNo: _srNo, ...values } = tender
    setEditingId(id)
    setForm({ ...emptyTender, ...values })
    setShowForm(true)
  }

  const saveTender = (event: React.FormEvent) => {
    event.preventDefault()
    if (editingId) {
      save(tenders.map((tender) => tender.id === editingId ? { ...tender, ...form } : tender))
    } else {
      save([...tenders, { ...form, id: crypto.randomUUID(), srNo: nextSrNo(tenders) }])
    }
    setForm(emptyTender)
    setEditingId(null)
    setShowForm(false)
  }

  const metricCards: Array<{ label: string; value: number; tone?: 'red' | 'yellow' }> = [
    { label: 'Total tenders logged', value: tenders.length },
    { label: 'Open / upcoming tenders', value: upcoming },
    { label: 'Closing in 5–7 days', value: yellowCount, tone: 'yellow' },
    { label: 'Closing in ≤ 4 days', value: redCount, tone: 'red' },
    { label: 'Submitted', value: tenders.filter((t) => t.submissionStatus === 'Submitted').length },
    { label: 'Won', value: tenders.filter((t) => t.submissionStatus === 'Won').length },
    { label: 'Under review', value: tenders.filter((t) => t.decision === 'Under Review').length },
  ]

  const renderCell = (tender: Tender, key: ColumnKey) => {
    if (key === 'daysLeft') {
      const days = daysLeft(tender.closingDate)
      const urgency = tenderUrgency(tender)
      if (days === null) return '-'
      return <span style={{ fontWeight: 700, color: urgency ? URGENCY_STYLES[urgency].color : days < 0 ? '#dc2626' : '#475569' }}>{days < 0 ? `Closed (${Math.abs(days)}d ago)` : days}</span>
    }
    if (key === 'dates') {
      return (
        <button type="button" className="ghost-button" onClick={() => setDatesFor(tender)} title="View all dates" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', padding: '6px 10px', fontSize: '0.8rem' }}>
          <CalendarDays size={14} style={{ flexShrink: 0 }} /> {tender.closingDate ? formatDate(tender.closingDate) : 'View dates'}
        </button>
      )
    }
    if (key === 'title') {
      const long = tender.title.length > TITLE_PREVIEW_CHARS
      return (
        <div>
          <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tender.title || '-'}</span>
          {long ? <button type="button" onClick={() => setTitleFor(tender)} style={{ background: 'none', border: 'none', padding: 0, marginTop: 4, color: '#2563eb', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>Read more</button> : null}
        </div>
      )
    }
    if (key === 'tenderLink' || key === 'driveLink') {
      return tender[key] ? <a href={tender[key]} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a> : '-'
    }
    const isMoney = key === 'value' || key === 'emd' || key === 'fee'
    const isIdentifier = key === 'tenderId'
    return <span style={{ color: isIdentifier ? '#2563eb' : isMoney ? '#15803d' : undefined, fontWeight: isIdentifier || isMoney ? 700 : undefined, whiteSpace: isMoney ? 'nowrap' : undefined }}>{isMoney ? withRs(tender[key]) : tender[key] || '-'}</span>
  }

  // statusAt: 'start' puts the status column before Sr. No. (past tenders), 'end' puts it before Actions (active tenders)
  const renderTable = (list: Tender[], emptyMessage: string, statusAt: 'start' | 'end') => (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ minWidth: 1800 }}>
        <thead><tr>{statusAt === 'start' ? <th>Result</th> : null}<th>Tender Sr. No.</th>{tableColumns.map(([key, label]) => <th key={label} style={key === 'title' ? { paddingLeft: 16 } : undefined}>{label}</th>)}{statusAt === 'end' ? <th>Submission Status</th> : null}<th>Actions</th></tr></thead>
        <tbody>{list.length === 0 ? <tr><td colSpan={tableColumns.length + 3} className="empty-state">{emptyMessage}</td></tr> : list.map((tender) => {
          const urgency = tenderUrgency(tender)
          return (
            <tr key={tender.id} className={urgency ? `tender-row--${urgency}` : undefined}>
              {statusAt === 'start' ? <td><StatusBadge status={tender.submissionStatus} /></td> : null}
              <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{tender.srNo}</td>
              {tableColumns.map(([key]) => <td key={key} style={cellStyle(key)}>{renderCell(tender, key)}</td>)}
              {statusAt === 'end' ? <td><StatusBadge status={tender.submissionStatus} /></td> : null}
              <td style={{ whiteSpace: 'nowrap' }}><button className="icon-button" type="button" title="Edit tender" onClick={() => openEditForm(tender)}><Pencil size={16} /></button><button className="icon-button" type="button" title="Delete tender" onClick={() => save(tenders.filter((item) => item.id !== tender.id))}><Trash2 size={16} /></button></td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )

  return (
    <div>
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        {metricCards.map(({ label, value, tone }) => {
          const toneStyle = tone && value > 0 ? URGENCY_STYLES[tone] : null
          return (
            <div
              className="metric-card"
              key={label}
              style={{
                minHeight: 104,
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 12,
                background: toneStyle ? toneStyle.background : '#fff',
                border: `1px solid ${toneStyle ? toneStyle.border : 'rgba(0, 0, 0, 0.08)'}`,
                borderRadius: 14,
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.03)',
              }}
            >
              <span className="metric-label" style={{ color: toneStyle ? toneStyle.color : '#737373', fontSize: '0.78rem', lineHeight: 1.3 }}>{label}</span>
              <strong className="metric-value" style={{ color: toneStyle ? toneStyle.color : '#171717', fontSize: '1.65rem', lineHeight: 1, fontWeight: 750 }}>{value}</strong>
            </div>
          )
        })}
      </div>
      <style>{`
        @media (max-width: 1100px) {
          .metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 620px) {
          .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        .tender-row--red > td { background: ${URGENCY_STYLES.red.background} !important; }
        .tender-row--yellow > td { background: ${URGENCY_STYLES.yellow.background} !important; }
      `}</style>

      <section className="surface">
        <div className="surface-heading">
          <div><p className="section-label">Tender Tracker</p><h2>Active tenders ({activeTenders.length})</h2></div>
          <button type="button" className="btn btn-primary" onClick={openAddForm}><Plus size={16} /> Add tender</button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 280px' }}><Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#82909a' }} /><input className="input" style={{ paddingLeft: 32 }} placeholder="Search Sr. No., tender ID, title, client..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="input" style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All submission statuses</option><option>Not Started</option><option>In Progress</option><option>Submitted</option></select>
          <span style={{ display: 'inline-flex', gap: 12, fontSize: '0.75rem', color: '#475569' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: URGENCY_STYLES.yellow.background, border: `1px solid ${URGENCY_STYLES.yellow.border}`, marginRight: 4 }} />5–7 days left</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: URGENCY_STYLES.red.background, border: `1px solid ${URGENCY_STYLES.red.border}`, marginRight: 4 }} />≤ 4 days left</span>
          </span>
        </div>
        {renderTable(activeTenders, tenders.length === 0 ? 'No tenders logged. Add the first tender to start the pipeline.' : 'No active tenders match your filters.', 'end')}
      </section>

      <section className="surface" style={{ marginTop: 16 }}>
        <div className="surface-heading">
          <div><p className="section-label">Tender Tracker</p><h2>Past tenders ({pastTenders.length})</h2></div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Won: <strong style={{ color: '#15803d' }}>{pastTenders.filter((t) => t.submissionStatus === 'Won').length}</strong> · Lost: <strong style={{ color: '#b91c1c' }}>{pastTenders.filter((t) => t.submissionStatus === 'Lost').length}</strong></span>
        </div>
        {renderTable(pastTenders, 'No past tenders yet. Tenders marked Won or Lost will appear here.', 'start')}
      </section>

      {datesFor ? <div onClick={() => setDatesFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="surface" onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '100%' }}>
          <div className="surface-heading">
            <div><p className="section-label">{datesFor.srNo} · {datesFor.tenderId}</p><h2>Tender dates</h2></div>
            <button type="button" className="ghost-button" onClick={() => setDatesFor(null)}>Close</button>
          </div>
          <p style={{ margin: '0 0 12px', color: '#475569', fontSize: '0.85rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{datesFor.title}</p>
          <div>
            {DATE_FIELDS.map(([key, label]) => {
              const isClosing = key === 'closingDate'
              const days = isClosing ? daysLeft(datesFor.closingDate) : null
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#64748b' }}>{label}</span>
                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: isClosing ? 700 : 500, color: '#0f172a' }}>
                    {formatDate(datesFor[key])}
                    {days !== null ? <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>{days < 0 ? 'Closed' : `${days} days left`}</span> : null}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div> : null}

      {titleFor ? <div onClick={() => setTitleFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="surface" onClick={(e) => e.stopPropagation()} style={{ width: 600, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
          <div className="surface-heading">
            <div><p className="section-label">{titleFor.srNo} · {titleFor.tenderId}</p><h2>Tender title / work description</h2></div>
            <button type="button" className="ghost-button" onClick={() => setTitleFor(null)}>Close</button>
          </div>
          <p style={{ margin: 0, color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{titleFor.title}</p>
        </div>
      </div> : null}

      {showForm ? <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <form className="surface" onClick={(e) => e.stopPropagation()} onSubmit={saveTender} style={{ width: 900, maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="surface-heading"><div><p className="section-label">Tender Tracker · {editingId ? tenders.find((t) => t.id === editingId)?.srNo : nextSrNo(tenders)}</p><h2>{editingId ? 'Edit tender' : 'Add tender'}</h2></div><button type="button" className="ghost-button" onClick={() => setShowForm(false)}>Close</button></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>{formFields.map(([key, label]) => <label key={key}>{label}{key.endsWith('Date') ? <input className="input" type="date" value={form[key]} onChange={(e) => update(key, e.target.value)} /> : key === 'eligibility' ? <select className="input" value={form[key]} onChange={(e) => update(key, e.target.value)}><option>Pending</option><option>Yes</option><option>No</option></select> : key === 'decision' ? <select className="input" value={form[key]} onChange={(e) => update(key, e.target.value)}><option>Bid</option><option>No Bid</option><option>Under Review</option></select> : key === 'submissionStatus' ? <select className="input" value={form[key]} onChange={(e) => update(key, e.target.value)}><option>Not Started</option><option>In Progress</option><option>Submitted</option><option>Won</option><option>Lost</option></select> : <input className="input" required={key === 'tenderId' || key === 'title'} value={form[key]} onChange={(e) => update(key, e.target.value)} />}</label>)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}><label>Tender Link<input className="input" type="url" value={form.tenderLink} onChange={(e) => update('tenderLink', e.target.value)} /></label><label>Tender Document Drive Link<input className="input" type="url" value={form.driveLink} onChange={(e) => update('driveLink', e.target.value)} /></label></div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }}>{editingId ? 'Update tender' : 'Save tender'}</button>
        </form>
      </div> : null}
    </div>
  )
}
