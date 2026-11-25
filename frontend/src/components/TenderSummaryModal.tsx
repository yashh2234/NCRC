import { useEffect, useRef, useState } from 'react'
import { AlertOctagon, AlertTriangle, CalendarDays, CheckSquare, FileText, Printer, RefreshCw, Sparkles, Upload } from 'lucide-react'
import { Modal } from './Modal'
import { MAX_PDF_MB, useTenderAnalyses } from '../lib/tenderAnalyses'
import {
  checkTenderDocument, daysLeft, fetchTenderSummary, formatDate, formatTime,
  type DocumentCheck, type SavedTenderSummary, type Tender, type TenderSummary,
} from '../lib/tenders'
import { printTenderSummary } from '../lib/tenderSummaryPrint'

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

/** Choose a PDF and start the analysis in the background. */
export function TenderPdfPicker({ title, text, onStart, onCancel }: { title: string; text: string; onStart: (file: File) => void; onCancel?: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const choose = (chosen: File | null) => {
    setError('')
    if (chosen && !/\.pdf$/i.test(chosen.name)) return setError('Choose a PDF file.')
    if (chosen && chosen.size > MAX_PDF_MB * 1024 * 1024) return setError(`The PDF is larger than ${MAX_PDF_MB} MB.`)
    setFile(chosen)
  }

  return (
    <div className="ts-upload">
      <Sparkles size={28} />
      <h3>{title}</h3>
      <p className="ts-muted">{text}</p>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { choose(e.target.files?.[0] ?? null); e.target.value = '' }} />
      <div className="ts-upload__row">
        <button type="button" className="btn btn-outline" onClick={() => input.current?.click()}>
          <Upload size={15} /> {file ? 'Change PDF' : 'Choose PDF'}
        </button>
        {file ? <span className="ts-file"><FileText size={14} /> {file.name} <small>({(file.size / 1024 / 1024).toFixed(1)} MB)</small></span> : null}
      </div>
      {error ? <p className="ts-error">{error}</p> : null}
      <div className="ts-upload__row">
        <button type="button" className="btn btn-primary" onClick={() => { if (file) onStart(file) }} disabled={!file}><Sparkles size={15} /> Analyse</button>
        {onCancel ? <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button> : null}
      </div>
      <p className="ts-muted">It is read in the background. You can close this window and keep working; a box at the bottom right tells you when it is ready.</p>
    </div>
  )
}

interface SummaryProps {
  summary: TenderSummary
  /** Who ticked each document; without it (tender not saved yet) the list cannot be ticked */
  checks?: Array<DocumentCheck | null>
  onCheck?: (document: string, checked: boolean) => void
}

export function TenderSummaryView({ summary: s, checks, onCheck }: SummaryProps) {
  const done = (checks ?? []).filter(Boolean).length

  return (
    <>
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
                    <td className="ts-dates__when">{showDate(d.date)}{d.time ? `, ${formatTime(d.time)}` : ''}</td>
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
        const canTick = checklist && checks && onCheck
        return (
          <section key={key} className="ts-section">
            <h4>
              {checklist ? <CheckSquare size={15} /> : null}{title}{' '}
              {canTick ? <small className={`ts-count${done === items.length ? ' ts-count--all' : ''}`}>{done} / {items.length} ready</small> : <small>({items.length})</small>}
            </h4>
            {canTick ? (
              <ul className="ts-ticks">
                {items.map((item, i) => {
                  const check = checks[i]
                  return (
                    <li key={i} className={check ? 'done' : undefined}>
                      <label>
                        <input type="checkbox" checked={Boolean(check)} onChange={(e) => onCheck(item, e.target.checked)} />
                        <span>
                          {item}
                          {check ? <small>{check.by ?? 'Ticked'}{check.at ? ` · ${new Date(check.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}</small> : null}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            ) : <ul className={checklist ? 'ts-checklist' : undefined}>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>}
          </section>
        )
      })}
    </>
  )
}

export function TenderSummaryModal({ tender, onClose, onChanged }: { tender: Tender; onClose: () => void; onChanged: (tender: Tender) => void }) {
  const { analyses, uploads, start, retry, dismiss } = useTenderAnalyses()
  const [saved, setSaved] = useState<SavedTenderSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  const mine = analyses.filter((a) => a.tenderId === tender.id)
  const uploading = uploads.some((u) => u.tenderId === tender.id)
  const reading = mine.find((a) => a.status === 'queued' || a.status === 'running')
  const failed = mine.find((a) => a.status === 'failed')
  const done = mine.find((a) => a.status === 'done')

  useEffect(() => {
    let current = true
    fetchTenderSummary(tender.id)
      .then((data) => { if (current) { setSaved(data); setError('') } })
      .catch((e: Error) => { if (current) setError(e.message) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [tender.id, done?.id])

  // It is looked at here, so it need not stay in the floating box
  useEffect(() => {
    if (done) dismiss(done.id)
  }, [done, dismiss])

  const tick = async (document: string, checked: boolean) => {
    if (!saved) return
    const before = saved
    setSaved({ ...saved, checks: saved.summary.documents_required.map((d, i) => (d === document ? (checked ? { by: null, at: null } : null) : saved.checks[i] ?? null)) })
    setError('')
    try {
      const { data, tender: changed } = await checkTenderDocument(tender.id, document, checked)
      setSaved(data)
      onChanged(changed)
    } catch (e) {
      setSaved(before)
      setError((e as Error).message)
    }
  }

  const begin = (file: File) => {
    start(file, tender.id)
    setShowUpload(false)
  }

  return (
    <Modal title="Tender summary" subtitle={`${tender.srNo} · ${tender.tenderId || tender.title.slice(0, 60)}`} onClose={onClose} size={920}>
      <div className="ts">
        {loading ? <p className="ts-muted">Loading…</p> : null}
        {error ? <p className="ts-error">{error}</p> : null}

        {uploading || reading ? (
          <div className="ts-reading">
            <RefreshCw size={16} className="ts-spin" />
            <span>{uploading ? 'Uploading the document…' : reading?.retrying && !reading.due ? `${reading.error ?? 'The AI is busy.'} It is tried again automatically.` : 'Reading the document… usually under a minute.'}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Minimise</button>
          </div>
        ) : null}
        {failed && !reading && !uploading ? (
          <div className="ts-error ts-failed">
            <span>{failed.file}: {failed.error}</span>
            {failed.canRetry ? <button type="button" className="btn btn-outline btn-sm" onClick={() => retry(failed)}>Try again</button> : null}
          </div>
        ) : null}

        {!loading && !uploading && !reading && (showUpload || !saved) ? (
          <TenderPdfPicker
            title={saved ? 'Analyse a new version of the tender document' : 'Summarise the tender document'}
            text={`Upload the tender PDF (NIT, RFP or bid document). The AI reads every page — scanned pages too — and lists the key dates, EMD, eligibility, documents required and points to watch.${saved ? ' The new summary replaces this one; ticks stay on documents that are worded the same.' : ''}`}
            onStart={begin}
            onCancel={saved ? () => setShowUpload(false) : undefined}
          />
        ) : null}

        {!loading && saved && !showUpload ? (
          <>
            <div className="ts-meta">
              <span>
                From <strong>{saved.file || 'tender document'}</strong>
                {saved.analysed_at ? ` · ${new Date(saved.analysed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                {saved.analysed_by ? ` · by ${saved.analysed_by}` : ''}
              </span>
              <span className="ts-meta__actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => printTenderSummary(tender, saved)}><Printer size={14} /> Print</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowUpload(true)} disabled={uploading || Boolean(reading)}><RefreshCw size={14} /> Re-analyse</button>
              </span>
            </div>
            <TenderSummaryView summary={saved.summary} checks={saved.checks} onCheck={(document, checked) => void tick(document, checked)} />
          </>
        ) : null}
      </div>
    </Modal>
  )
}
