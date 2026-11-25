import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw, Sparkles, X } from 'lucide-react'
import {
  TenderAnalysesContext, tenderAnalysesApi, uploadTenderPdf, useTenderAnalyses,
  type TenderAnalysesState, type TenderAnalysis, type TenderUpload,
} from '../lib/tenderAnalyses'

const POLL_MS = 4000
/** Waiting for a busy AI: nothing happens for minutes */
const SLOW_POLL_MS = 20000

/** Uploads tender PDFs and follows them while the server reads them, whatever page is open. */
export function TenderAnalysesProvider({ enabled, onOpen, children }: { enabled: boolean; onOpen: () => void; children: ReactNode }) {
  const [analyses, setAnalyses] = useState<TenderAnalysis[]>([])
  const [uploads, setUploads] = useState<TenderUpload[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const nextKey = useRef(1)
  /** Asked to run from here and not answered yet */
  const asked = useRef(new Set<number>())

  const refresh = useCallback(async () => {
    if (!enabled) return
    try { setAnalyses(await tenderAnalysesApi.list()) } catch { /* try again later */ }
  }, [enabled])

  useEffect(() => { void refresh() }, [refresh])

  const run = useCallback((id: number) => {
    if (asked.current.has(id)) return
    asked.current.add(id)
    // The answer comes when the PDF is read, or never when the line breaks; the list tells what really happened
    tenderAnalysesApi.run(id).catch(() => undefined).finally(() => {
      asked.current.delete(id)
      void refresh()
    })
  }, [refresh])

  const working = analyses.some((a) => a.status === 'running' || (a.status === 'queued' && a.due))
  const waiting = analyses.some((a) => a.status === 'queued')
  useEffect(() => {
    if (!working && !waiting) return
    const timer = window.setInterval(() => void refresh(), working ? POLL_MS : SLOW_POLL_MS)
    return () => window.clearInterval(timer)
  }, [working, waiting, refresh])

  useEffect(() => {
    analyses.filter((a) => a.status === 'queued' && a.due).forEach((a) => run(a.id))
  }, [analyses, run])

  const upload = useCallback(async (item: TenderUpload) => {
    const patch = (changes: Partial<TenderUpload>) => setUploads((list) => list.map((u) => (u.key === item.key ? { ...u, ...changes } : u)))
    patch({ progress: 0, error: '' })
    try {
      const analysis = await uploadTenderPdf(item.file, item.tenderId, (progress) => patch({ progress }))
      setUploads((list) => list.filter((u) => u.key !== item.key))
      setAnalyses((list) => [...list.filter((a) => a.id !== analysis.id), analysis])
    } catch (e) {
      patch({ error: (e as Error).message })
    }
  }, [])

  const start = useCallback((file: File, tenderId: number | null) => {
    const item: TenderUpload = { key: nextKey.current++, file, tenderId, progress: 0, error: '' }
    setUploads((list) => [...list, item])
    void upload(item)
  }, [upload])

  // Only while the PDF itself is being sent; afterwards the server goes on without this tab
  const sending = uploads.some((u) => !u.error)
  useEffect(() => {
    if (!sending) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [sending])

  const retry = useCallback((analysis: TenderAnalysis) => {
    tenderAnalysesApi.retry(analysis.id)
      .then((row) => setAnalyses((list) => list.map((a) => (a.id === row.id ? row : a))))
      .catch((e: Error) => { window.alert(e.message); void refresh() })
  }, [refresh])

  const dismiss = useCallback((id: number) => {
    setAnalyses((list) => list.filter((a) => a.id !== id))
    tenderAnalysesApi.close(id).catch(() => void refresh())
  }, [refresh])

  const open = useCallback((id: number) => {
    setOpenId(id)
    onOpen()
  }, [onOpen])

  const state = useMemo<TenderAnalysesState>(() => ({
    analyses, uploads, start, retry, dismiss, refresh, open, openId,
    retryUpload: (item) => void upload(item),
    dismissUpload: (key) => setUploads((list) => list.filter((u) => u.key !== key)),
    openHandled: () => setOpenId(null),
  }), [analyses, uploads, start, retry, dismiss, refresh, open, openId, upload])

  return <TenderAnalysesContext.Provider value={state}>{children}</TenderAnalysesContext.Provider>
}

/** Floating box at the bottom right with everything that is being read or waits to be looked at. */
export function TenderAnalysesDock() {
  const { analyses, uploads, retry, retryUpload, dismiss, dismissUpload, open } = useTenderAnalyses()
  const [small, setSmall] = useState(false)

  // Something finished: show it even when the box was minimised
  const finished = analyses.filter((a) => a.status === 'done' || a.status === 'failed').map((a) => a.id).join(',')
  const seen = useRef('')
  useEffect(() => {
    const before = new Set(seen.current.split(','))
    if (finished && finished.split(',').some((id) => !before.has(id))) setSmall(false)
    seen.current = finished
  }, [finished])

  const total = analyses.length + uploads.length
  if (total === 0) return null

  const busy = uploads.filter((u) => !u.error).length + analyses.filter((a) => a.status === 'queued' || a.status === 'running').length
  const ready = analyses.filter((a) => a.status === 'done').length
  const headline = busy ? `Analysing ${busy} tender PDF${busy === 1 ? '' : 's'}…` : ready ? `${ready} tender analysis ready` : 'Tender analysis'

  if (small) {
    return (
      <button type="button" className={`ta-pill${!busy && ready ? ' ta-pill--done' : ''}`} onClick={() => setSmall(false)} title="Show tender analysis">
        {busy ? <RefreshCw size={15} className="ts-spin" /> : ready ? <CheckCircle2 size={15} /> : <Sparkles size={15} />} {headline}
      </button>
    )
  }

  const cancel = (a: TenderAnalysis) => {
    if (a.status === 'done' && a.tenderId === null && !window.confirm(`Discard the analysis of ${a.file}? The tender is not saved yet.`)) return
    if ((a.status === 'queued' || a.status === 'running') && !window.confirm(`Stop analysing ${a.file}?`)) return
    dismiss(a.id)
  }

  return (
    <div className="ta-dock" role="status" aria-live="polite">
      <div className="ta-dock__head">
        <Sparkles size={15} /> <strong>{headline}</strong>
        <button type="button" onClick={() => setSmall(true)} title="Minimise" aria-label="Minimise"><ChevronDown size={17} /></button>
      </div>
      <div className="ta-dock__list">
        {uploads.map((u) => (
          <div key={`u${u.key}`} className={`ta-item${u.error ? ' ta-item--failed' : ''}`}>
            {u.error ? <AlertTriangle size={17} /> : <RefreshCw size={17} className="ts-spin" />}
            <div className="ta-item__body">
              <strong title={u.file.name}>{u.file.name}</strong>
              <small>{u.error || (u.progress >= 100 ? 'Saving the file…' : `Uploading… ${u.progress}%`)}</small>
              {u.error ? <span className="ta-item__actions"><button type="button" className="btn btn-outline btn-xs" onClick={() => retryUpload(u)}>Try again</button></span>
                : <span className="ta-bar"><i style={{ width: `${u.progress}%` }} /></span>}
            </div>
            {u.error ? <button type="button" className="ta-item__close" onClick={() => dismissUpload(u.key)} title="Close" aria-label="Close"><X size={15} /></button> : null}
          </div>
        ))}
        {analyses.map((a) => (
          <div key={a.id} className={`ta-item ta-item--${a.status}`}>
            {a.status === 'done' ? <CheckCircle2 size={17} /> : a.status === 'failed' ? <AlertTriangle size={17} /> : <RefreshCw size={17} className={a.status === 'running' || a.due ? 'ts-spin' : undefined} />}
            <div className="ta-item__body">
              <strong title={a.file}>{a.file}</strong>
              <small>
                {a.status === 'done' ? (a.tenderId === null ? 'Ready. Check the details and save the tender.' : 'Summary is ready.')
                  : a.status === 'failed' ? a.error || 'It could not be analysed.'
                    : a.status === 'queued' && a.retrying && !a.due ? `${a.error ?? 'The AI is busy.'} It is tried again automatically.`
                      : 'Reading the document… You can keep working.'}
              </small>
              {a.status === 'done' || a.canRetry ? (
                <span className="ta-item__actions">
                  {a.status === 'done' ? <button type="button" className="btn btn-primary btn-xs" onClick={() => open(a.id)}>{a.tenderId === null ? 'Check & save' : 'Open summary'}</button> : null}
                  {a.canRetry ? <button type="button" className="btn btn-outline btn-xs" onClick={() => retry(a)}>Try again</button> : null}
                </span>
              ) : null}
            </div>
            <button type="button" className="ta-item__close" onClick={() => cancel(a)} title={a.status === 'done' || a.status === 'failed' ? 'Close' : 'Stop'} aria-label="Close"><X size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
