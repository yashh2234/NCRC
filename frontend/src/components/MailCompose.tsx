import { useEffect, useRef, useState } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'
import { formatSize, mailApi, type MailAttachment, type OutboxMail } from '../lib/mail'
import { MailEditor, type MailEditorHandle } from './MailEditor'
import { Modal } from './Modal'
import { Req } from './ui'

/** An attachment that stays on the mail server: carried over from a forwarded mail or a saved draft */
export interface KeptAttachment extends MailAttachment { folder: string; uid: number }

export interface MailDraft {
  title: string
  to: string
  cc: string
  bcc: string
  subject: string
  html: string
  kept: KeptAttachment[]
  /** New files already attached, e.g. the PDF of a quotation */
  files?: File[]
  /** This quotation becomes Sent when the mail is out */
  quotationId?: number
  replyUid?: number
  replyFolder?: string
  /** Set when it was opened from the Drafts folder */
  draftUid?: number
}

interface MailComposeProps {
  draft: MailDraft
  from: string
  onClose: () => void
  /** The mail is in the outbox and goes out in the background */
  onQueued: (mail: OutboxMail) => void
  /** The Drafts folder changed */
  onDraftSaved: () => void
}

const MAX_FILE = 20 * 1024 * 1024
/** New files per save; the server refuses a bigger upload */
const MAX_UPLOAD = 22 * 1024 * 1024
const MAX_REQUEST = 24 * 1024 * 1024

export function MailCompose({ draft, from, onClose, onQueued, onDraftSaved }: MailComposeProps) {
  const [form, setForm] = useState({ to: draft.to, cc: draft.cc, bcc: draft.bcc, subject: draft.subject })
  const [showCc, setShowCc] = useState(Boolean(draft.cc))
  const [showBcc, setShowBcc] = useState(Boolean(draft.bcc))
  const [files, setFiles] = useState<File[]>(draft.files ?? [])
  const [kept, setKept] = useState(draft.kept)
  const [draftUid, setDraftUid] = useState(draft.draftUid)
  const [busy, setBusy] = useState<'' | 'send' | 'draft'>('')
  const [progress, setProgress] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const editor = useRef<MailEditorHandle>(null)

  // Mail has its own browser tab: closing it must not lose what was written
  useEffect(() => {
    if (!dirty && !busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, busy])

  const touch = () => { setDirty(true); setNotice('') }
  const set = (key: keyof typeof form, value: string) => { setForm((f) => ({ ...f, [key]: value })); touch() }

  const addFiles = (added: File[]) => {
    const big = added.filter((f) => f.size > MAX_FILE)
    if (big.length) window.alert(`Maximum 20 MB per file. Not added: ${big.map((f) => f.name).join(', ')}`)
    const next = [...files, ...added.filter((f) => f.size <= MAX_FILE)]
    if (next.reduce((s, f) => s + f.size, 0) > MAX_UPLOAD) {
      window.alert('The new files are more than 22 MB together. Save the draft first and then add the rest, or share a link.')
      return
    }
    setFiles(next)
    touch()
  }

  const payload = () => {
    const data = new FormData()
    data.append('to', form.to)
    data.append('cc', form.cc)
    data.append('bcc', form.bcc)
    data.append('subject', form.subject)
    data.append('html', editor.current?.getHtml() ?? '')
    if (draft.replyUid) {
      data.append('reply_uid', String(draft.replyUid))
      data.append('reply_folder', draft.replyFolder ?? 'INBOX')
    }
    if (draftUid) data.append('draft_uid', String(draftUid))
    if (draft.quotationId) data.append('quotation_id', String(draft.quotationId))
    files.forEach((file) => data.append('attachments[]', file))
    kept.forEach((a, i) => {
      data.append(`keep[${i}][folder]`, a.folder)
      data.append(`keep[${i}][uid]`, String(a.uid))
      data.append(`keep[${i}][part]`, a.part)
    })
    return data
  }

  /** Files and the text with its pictures travel together */
  const tooLarge = () => {
    const bytes = files.reduce((sum, f) => sum + f.size, 0) + (editor.current?.getHtml().length ?? 0)
    return bytes > MAX_REQUEST ? `The new files and the pictures in the text are ${formatSize(bytes)} together; ${formatSize(MAX_REQUEST)} can be uploaded at once.` : ''
  }

  const saveDraft = async (): Promise<boolean> => {
    const problem = tooLarge()
    if (problem) { setError(`${problem} Remove some files, save the draft, then add them.`); return false }
    setBusy('draft')
    setProgress(0)
    setError('')
    try {
      const saved = await mailApi.saveDraft(payload(), setProgress)
      // Everything attached now lives in the saved draft
      if (saved.uid) {
        const uid = saved.uid
        setDraftUid(uid)
        setKept(saved.attachments.map((a) => ({ ...a, folder: saved.folder, uid })))
        setFiles([])
      }
      setDirty(false)
      setNotice('Draft saved.')
      onDraftSaved()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      setBusy('')
    }
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!form.subject.trim() && !window.confirm('Send this message without a subject?')) return
    const problem = tooLarge()
    if (problem) { setError(`${problem} Remove some files, save the draft, add them and then send.`); return }
    setBusy('send')
    setProgress(0)
    setError('')
    try {
      onQueued(await mailApi.send(payload(), setProgress))
    } catch (err) {
      setError((err as Error).message)
      setBusy('')
    }
  }

  const close = () => {
    if (busy) return
    if (dirty) setAsking(true)
    else onClose()
  }

  const footer = asking ? (
    <>
      <div className="ui-modal__footer-left"><strong>Save this mail as a draft?</strong></div>
      <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={Boolean(busy)}>Keep writing</button>
      <button type="button" className="btn btn-outline" style={{ color: '#b91c1c' }} onClick={onClose} disabled={Boolean(busy)}>Discard</button>
      <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => void saveDraft().then((ok) => { if (ok) onClose(); else setAsking(false) })}>{busy === 'draft' ? 'Saving…' : 'Save draft'}</button>
    </>
  ) : (
    <>
      <div className="ui-modal__footer-left" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
          <Paperclip size={14} /> Attach
          <input type="file" multiple hidden onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
        </label>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void saveDraft()} disabled={Boolean(busy)}><FileText size={14} /> {busy === 'draft' ? `Saving… ${progress < 100 ? `${progress}%` : ''}` : 'Save draft'}</button>
        {notice ? <span className="tb-muted">{notice}</span> : null}
      </div>
      <button type="button" className="btn btn-outline" onClick={close} disabled={Boolean(busy)}>Cancel</button>
      <button type="submit" className="btn btn-primary" disabled={Boolean(busy)}>{busy === 'send' ? (progress < 100 ? `Uploading ${progress}%` : 'Almost done…') : 'Send'}</button>
    </>
  )

  const row = (id: 'to' | 'cc' | 'bcc' | 'subject', label: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement> = {}, after?: React.ReactNode) => (
    <div className="tb-compose__row">
      <label className="tb-label" htmlFor={`tb-${id}`}>{label}</label>
      <input id={`tb-${id}`} className="input" value={form[id]} onChange={(e) => set(id, e.target.value)} {...props} />
      {after}
    </div>
  )

  return (
    <Modal title={form.subject ? `${draft.title}: ${form.subject}` : draft.title} subtitle="Mail" onClose={close} size="lg" onSubmit={send} footer={footer}>
      <div className="tb-compose">
        {error ? <p className="tb-error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
        <div className="tb-compose__row"><span className="tb-label">From</span><span className="tb-compose__from">{from}</span></div>
        {row('to', <>To<Req /></>, { required: true, placeholder: 'name@example.com, another@example.com', autoFocus: !draft.to }, (
          <span className="tb-compose__toggles">
            {!showCc ? <button type="button" onClick={() => setShowCc(true)}>Cc</button> : null}
            {!showBcc ? <button type="button" onClick={() => setShowBcc(true)}>Bcc</button> : null}
          </span>
        ))}
        {showCc ? row('cc', 'Cc') : null}
        {showBcc ? row('bcc', 'Bcc') : null}
        {row('subject', 'Subject')}
        <MailEditor ref={editor} initialHtml={draft.html} autoFocus={Boolean(draft.to)} onChange={touch} />
        {files.length || kept.length ? (
          <div className="tb-attachbar__list">
            {kept.map((a) => (
              <span key={`${a.uid}-${a.part}`} className="tb-attachment">
                <Paperclip size={13} /> <span>{a.name}</span> <small>{formatSize(a.size)}</small>
                <button type="button" aria-label={`Remove ${a.name}`} onClick={() => { setKept(kept.filter((k) => k !== a)); touch() }}><X size={13} /></button>
              </span>
            ))}
            {files.map((file, i) => (
              <span key={`${file.name}-${i}`} className="tb-attachment">
                <Paperclip size={13} /> <span>{file.name}</span> <small>{formatSize(file.size)}</small>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => { setFiles(files.filter((_, j) => j !== i)); touch() }}><X size={13} /></button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
