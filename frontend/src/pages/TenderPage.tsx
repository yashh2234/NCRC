import { useMemo, useState } from 'react'
import { Plus, Search, Trash2, ExternalLink, Pencil } from 'lucide-react'

interface Tender {
  id: string
  tenderId: string
  title: string
  department: string
  portal: string
  location: string
  value: string
  emd: string
  fee: string
  openDate: string
  preBidDate: string
  queryDate: string
  closingDate: string
  openingDate: string
  eligibility: string
  decision: string
  submissionStatus: string
  responsible: string
  requirements: string
  tenderLink: string
  driveLink: string
  remarks: string
}

type TenderField = Exclude<keyof Tender, 'id'>

const STORAGE_KEY = 'ncrc_tender_tracker'
const emptyTender: Omit<Tender, 'id'> = {
  tenderId: '', title: '', department: '', portal: '', location: '', value: '', emd: '-', fee: '-',
  openDate: '', preBidDate: '', queryDate: '', closingDate: '', openingDate: '', eligibility: 'Pending',
  decision: 'Under Review', submissionStatus: 'Not Started', responsible: '', requirements: '',
  tenderLink: '', driveLink: '', remarks: '',
}

const columns: Array<[TenderField, string]> = [
  ['tenderId', 'Tender ID / Bid No.'], ['title', 'Tender Title / Work Description'],
  ['department', 'Department / Client'], ['portal', 'Portal'], ['location', 'Location'],
  ['value', 'Tender Value (₹)'], ['emd', 'EMD (₹)'], ['fee', 'Tender Fee (₹)'],
  ['openDate', 'Published / Open Date'], ['preBidDate', 'Pre-bid Meeting Date'],
  ['queryDate', 'Query Submission Deadline'], ['closingDate', 'Bid Submission Closing Date'],
  ['openingDate', 'Technical Bid Opening Date'], ['eligibility', 'Eligibility Checked?'],
  ['decision', 'Decision'], ['submissionStatus', 'Submission Status'], ['responsible', 'Responsible Person'],
  ['requirements', 'Documents / Requirements'], ['tenderLink', 'Tender Link'],
  ['driveLink', 'Tender Document Drive Link'], ['remarks', 'Remarks / Next Action'],
]

function daysLeft(date: string) {
  if (!date) return ''
  return String(Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000))
}

export function TenderPage() {
  const [tenders, setTenders] = useState<Tender[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Tender[] } catch { return [] }
  })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyTender)

  const save = (next: Tender[]) => {
    setTenders(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  const filtered = useMemo(() => tenders.filter((tender) => {
    const text = `${tender.tenderId} ${tender.title} ${tender.department} ${tender.portal}`.toLowerCase()
    return (!search || text.includes(search.toLowerCase())) && (!status || tender.submissionStatus === status)
  }), [tenders, search, status])
  const today = new Date().setHours(0, 0, 0, 0)
  const upcoming = tenders.filter((tender) => tender.closingDate && new Date(`${tender.closingDate}T00:00:00`).getTime() >= today && tender.submissionStatus !== 'Submitted').length
  const nextSeven = tenders.filter((tender) => {
    const date = tender.closingDate ? new Date(`${tender.closingDate}T00:00:00`).getTime() : 0
    return date >= today && date <= today + 7 * 86400000
  }).length

  const update = (key: TenderField, value: string) => setForm((previous) => ({ ...previous, [key]: value }))
  const openAddForm = () => {
    setEditingId(null)
    setForm(emptyTender)
    setShowForm(true)
  }

  const openEditForm = (tender: Tender) => {
    const { id, ...values } = tender
    setEditingId(id)
    setForm(values)
    setShowForm(true)
  }

  const saveTender = (event: React.FormEvent) => {
    event.preventDefault()
    if (editingId) {
      save(tenders.map((tender) => tender.id === editingId ? { ...form, id: editingId } : tender))
    } else {
      save([...tenders, { ...form, id: crypto.randomUUID() }])
    }
    setForm(emptyTender)
    setEditingId(null)
    setShowForm(false)
  }

  return (
    <div>
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          ['Total tenders logged', tenders.length], ['Open / upcoming tenders', upcoming],
          ['Closing in next 7 days', nextSeven], ['Submitted', tenders.filter((t) => t.submissionStatus === 'Submitted').length],
          ['Won', tenders.filter((t) => t.submissionStatus === 'Won').length], ['Under review', tenders.filter((t) => t.decision === 'Under Review').length],
        ].map(([label, value]) => (
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
              background: '#fff',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 14,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.03)',
            }}
          >
            <span className="metric-label" style={{ color: '#737373', fontSize: '0.78rem', lineHeight: 1.3 }}>{label}</span>
            <strong className="metric-value" style={{ color: '#171717', fontSize: '1.65rem', lineHeight: 1, fontWeight: 750 }}>{value}</strong>
          </div>
        ))}
      </div>
      <style>{`
        @media (max-width: 1100px) {
          .metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 620px) {
          .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>

      <section className="surface">
        <div className="surface-heading">
          <div><p className="section-label">Tender Tracker</p><h2>All tenders</h2></div>
          <button type="button" className="btn btn-primary" onClick={openAddForm}><Plus size={16} /> Add tender</button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 280px' }}><Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#82909a' }} /><input className="input" style={{ paddingLeft: 32 }} placeholder="Search tender ID, title, client..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="input" style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All submission statuses</option><option>Not Started</option><option>In Progress</option><option>Submitted</option><option>Won</option><option>Lost</option></select>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1800 }}>
            <thead><tr><th>Sr. No.</th>{columns.map(([, label]) => <th key={label}>{label}</th>)}<th>Days Left</th><th>Actions</th></tr></thead>
            <tbody>{filtered.length === 0 ? <tr><td colSpan={columns.length + 3} className="empty-state">No tenders logged. Add the first tender to start the pipeline.</td></tr> : filtered.map((tender, index) => <tr key={tender.id}><td>{index + 1}</td>{columns.map(([key]) => {
              const isMoney = key === 'value' || key === 'emd' || key === 'fee'
              const isIdentifier = key === 'tenderId'
              return <td key={key} style={{ maxWidth: key === 'title' || key === 'requirements' || key === 'remarks' ? 280 : 160, whiteSpace: 'normal' }}>{key === 'tenderLink' || key === 'driveLink' ? tender[key] ? <a href={tender[key]} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a> : '-' : <span style={{ color: isIdentifier ? '#2563eb' : isMoney ? '#15803d' : undefined, fontWeight: isIdentifier || isMoney ? 700 : undefined }}>{tender[key] || '-'}</span>}</td>
            })}<td style={{ color: daysLeft(tender.closingDate) && Number(daysLeft(tender.closingDate)) < 0 ? '#dc2626' : '#b45309', fontWeight: 700 }}>{daysLeft(tender.closingDate)}</td><td><button className="icon-button" type="button" title="Edit tender" onClick={() => openEditForm(tender)}><Pencil size={16} /></button><button className="icon-button" type="button" title="Delete tender" onClick={() => save(tenders.filter((item) => item.id !== tender.id))}><Trash2 size={16} /></button></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {showForm ? <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <form className="surface" onClick={(e) => e.stopPropagation()} onSubmit={saveTender} style={{ width: 900, maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="surface-heading"><div><p className="section-label">Tender Tracker</p><h2>{editingId ? 'Edit tender' : 'Add tender'}</h2></div><button type="button" className="ghost-button" onClick={() => setShowForm(false)}>Close</button></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>{columns.filter(([key]) => !['tenderLink', 'driveLink'].includes(key)).map(([key, label]) => <label key={key}>{label}{key.endsWith('Date') || key === 'openDate' ? <input className="input" type="date" value={form[key]} onChange={(e) => update(key, e.target.value)} /> : key === 'eligibility' ? <select className="input" value={form[key]} onChange={(e) => update(key, e.target.value)}><option>Pending</option><option>Yes</option><option>No</option></select> : key === 'decision' ? <select className="input" value={form[key]} onChange={(e) => update(key, e.target.value)}><option>Bid</option><option>No Bid</option><option>Under Review</option></select> : key === 'submissionStatus' ? <select className="input" value={form[key]} onChange={(e) => update(key, e.target.value)}><option>Not Started</option><option>In Progress</option><option>Submitted</option><option>Won</option><option>Lost</option></select> : <input className="input" required={key === 'tenderId' || key === 'title'} value={form[key]} onChange={(e) => update(key, e.target.value)} />}</label>)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}><label>Tender Link<input className="input" type="url" value={form.tenderLink} onChange={(e) => update('tenderLink', e.target.value)} /></label><label>Tender Document Drive Link<input className="input" type="url" value={form.driveLink} onChange={(e) => update('driveLink', e.target.value)} /></label></div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }}>{editingId ? 'Update tender' : 'Save tender'}</button>
        </form>
      </div> : null}
    </div>
  )
}
