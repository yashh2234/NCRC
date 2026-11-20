import { useEffect, useRef, useState } from 'react'
import { AlertOctagon, AlertTriangle, CalendarDays, CheckSquare, FileText, Printer, RefreshCw, Sparkles, Upload } from 'lucide-react'
import { Modal } from './Modal'
import {
  analyseTenderDocument, daysLeft, fetchTenderSummary, formatDate,
  type SavedTenderSummary, type Tender, type TenderSummary,
} from '../lib/tenders'

const LIST_SECTIONS: Array<{ key: keyof TenderSummary; title: string; checklist?: boolean }> = [
  { key: 'eligibility', title: 'Eligibility criteria' },
  { key: 'documents_required', title: 'Documents required', checklist: true },
  { key: 'scope_of_work', title: 'Scope of work' },
  { key: 'technical_requirements', title: 'Technical requirements' },
  { key: 'payment_terms', title: 'Payment terms' },
  { key: 'penalties', title: 'Penalties & securities' },
]

const FACTS: Array<[keyof TenderSummary, string]> = [
  ['tender_id', 'Tender ID'], ['department', 'Department / Client'], ['location', 'Location'], ['portal', 'Portal'],
  ['tender_value', 'Tender value'], ['emd', 'EMD'], ['emd_exemption', 'EMD exemption'], ['tender_fee', 'Tender fee'],
  ['contract_period', 'Contract period'], ['bid_validity', 'Bid validity'], ['contact', 'Contact'],
]

/** "2026-12-05" → "05 Dec 2026"; anything else is shown as written. */
function showDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : value || '-'
}

export function TenderSummaryModal({ tender, onClose, onSaved }: { tender: Tender; onClose: () => void; onSaved: () => void }) {
  const [saved, setSaved] = useState<SavedTenderSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchTenderSummary(tender.id)
      .then((data) => { setSaved(data); setShowUpload(!data) })
      .catch((e: Error) => { setError(e.message); setShowUpload(true) })
      .finally(() => setLoading(false))
  }, [tender.id])

  useEffect(() => {
    if (!analysing) return
    setElapsed(0)
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [analysing])

  const analyse = async () => {
    if (!file) return
    setAnalysing(true)
    setError('')
    try {
      const data = await analyseTenderDocument(tender.id, file)
      setSaved(data)
      setShowUpload(false)
      setFile(null)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAnalysing(false)
    }
  }

  const s = saved?.summary

  return (
    <Modal title="Tender summary" subtitle={`${tender.srNo} · ${tender.tenderId || tender.title.slice(0, 60)}`} onClose={analysing ? () => undefined : onClose} size={920}>
      <div className="ts">
        {loading ? <p className="ts-muted">Loading…</p> : null}

        {!loading && showUpload ? (
          <div className="ts-upload">
            <Sparkles size={28} />
            <h3>{saved ? 'Analyse a new version of the tender document' : 'Summarise the tender document'}</h3>
            <p className="ts-muted">Upload the tender PDF (NIT, RFP or bid document). The AI reads every page — scanned pages too — and lists the key dates, EMD, eligibility, documents required and points to watch.</p>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError('') }} />
            <div className="ts-upload__row">
              <button type="button" className="btn btn-outline" onClick={() => fileInput.current?.click()} disabled={analysing}>
                <Upload size={15} /> {file ? 'Change PDF' : 'Choose PDF'}
              </button>
              {file ? <span className="ts-file"><FileText size={14} /> {file.name} <small>({(file.size / 1024 / 1024).toFixed(1)} MB)</small></span> : null}
            </div>
            <div className="ts-upload__row">
              <button type="button" className="btn btn-primary" onClick={() => void analyse()} disabled={!file || analysing}>
                {analysing ? <><RefreshCw size={15} className="ts-spin" /> Reading the document… {elapsed}s</> : <><Sparkles size={15} /> Analyse</>}
              </button>
              {saved && !analysing ? <button type="button" className="btn btn-outline" onClick={() => { setShowUpload(false); setError('') }}>Cancel</button> : null}
            </div>
            {analysing ? <p className="ts-muted">Usually under a minute; up to 3–4 minutes when the AI model is busy. Keep this window open.</p> : null}
          </div>
        ) : null}

        {error ? <p className="ts-error">{error}</p> : null}

        {!loading && s && !showUpload ? (
          <>
            <div className="ts-meta">
              <span>
                From <strong>{saved?.file || 'tender document'}</strong>
                {saved?.analysed_at ? ` · ${new Date(saved.analysed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                {saved?.analysed_by ? ` · by ${saved.analysed_by}` : ''}
              </span>
              <span className="ts-meta__actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}><Printer size={14} /> Print</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowUpload(true)}><RefreshCw size={14} /> Re-analyse</button>
              </span>
            </div>
            <p className="ts-disclaimer">AI-generated summary — check important figures and conditions against the tender document before bidding.</p>

            {s.title ? <h3 className="ts-title">{s.title}</h3> : null}
            {s.overview ? <p className="ts-overview">{s.overview}</p> : null}

            {s.conflicts?.length ? (
              <section className="ts-conflicts">
                <h4><AlertOctagon size={15} /> Conflicts in the document <small>({s.conflicts.length})</small></h4>
                <p>The tender says different things in different places — get these clarified (pre-bid query) before bidding.</p>
                <ul>{s.conflicts.map((item, i) => <li key={i}>{item}</li>)}</ul>
              </section>
            ) : null}

            {s.points_to_watch.length ? (
              <section className="ts-watch">
                <h4><AlertTriangle size={15} /> Points to watch</h4>
                <ul>{s.points_to_watch.map((item, i) => <li key={i}>{item}</li>)}</ul>
              </section>
            ) : null}

            <div className="ts-facts">
              {FACTS.filter(([key]) => s[key]).map(([key, label]) => (
                <div key={key} className="ts-fact"><span>{label}</span><strong>{s[key] as string}</strong></div>
              ))}
            </div>

            {s.dates.length ? (
              <section className="ts-section">
                <h4><CalendarDays size={15} /> Key dates</h4>
                <table className="ts-dates">
                  <tbody>
                    {s.dates.map((d, i) => {
                      const left = /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? daysLeft(d.date) : null
                      return (
                        <tr key={i}>
                          <td>{d.label || '-'}</td>
                          <td className="ts-dates__when">{showDate(d.date)}{d.time ? `, ${d.time}` : ''}</td>
                          <td className={`ts-dates__left${left !== null && left >= 0 && left <= 4 ? ' urgent' : ''}`}>
                            {left === null ? '' : left < 0 ? 'passed' : left === 0 ? 'today' : `${left} day${left === 1 ? '' : 's'} left`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            ) : null}

            {LIST_SECTIONS.map(({ key, title, checklist }) => {
              const items = s[key] as string[]
              if (!items.length) return null
              return (
                <section key={key} className="ts-section">
                  <h4>{checklist ? <CheckSquare size={15} /> : null}{title} <small>({items.length})</small></h4>
                  <ul className={checklist ? 'ts-checklist' : undefined}>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </section>
              )
            })}

            <p className="ts-muted ts-foot">Summary generated by AI</p>
          </>
        ) : null}
      </div>
    </Modal>
  )
}
