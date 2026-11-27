import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, ClipboardPaste, Copy, Eye, IndianRupee, Pencil, Plus, Printer, Save, Search, Sparkles, Trash2 } from 'lucide-react'
import { Req } from '../components/ui'
import { useAuth } from '../lib/auth'
import {
  DEFAULT_FEE_NOTE, emptyProposal, feeTotal, formatFee, longDate, parsePastedProposal, proposalApi, rupeesInWords, subHeadings,
  knowledgeApi, type AiQuestion, type ProposalDraft, type ProposalInput, type ProposalSection, type ProposalSummary,
} from '../lib/proposals'
import { openProposalPrint } from '../lib/proposalPrint'
import { HistoryButton } from '../components/History'

const BRIEF_PLACEHOLDER = `Example:
Client: The Secretary, Anukampa Platina, Jaipur (residential society).
Problem: water leakage through the expansion joint into the basement parking; spalling, cracks and exposed / corroded reinforcement in beams and columns.
Scope: visual inspection, Rebound Hammer + UPV at 25 locations, repair recommendations and methodology, one technical report.
Fees: visual inspection ₹15,000; RH + UPV 25 locations @ ₹2,500; technical assessment & repair methodology ₹20,000. GST extra.
Exclusions: monitoring, repair supervision, BOQ, core cutting, chemical tests, half-cell, cover meter.`

const MARKUP_HELP = 'Blank line = new paragraph · ## Sub-heading (numbered 3.1, 3.2…) · **bold** · - bullet · 1. numbered · | a | b | table row (first row is the header)'

/** Each opened editor gets a fresh key, so it starts from the loaded data. */
let editorKey = 0
const nextEditorKey = () => ++editorKey

const fmtUpdated = (iso: string | null) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ProposalsPage() {
  const [list, setList] = useState<ProposalSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  // null = list view; otherwise the proposal being edited (id null = new / not yet saved)
  const [editing, setEditing] = useState<{ id: number | null; form: ProposalInput; key: number } | null>(null)
  const [opening, setOpening] = useState(false)

  const reload = () => proposalApi.list()
    .then(({ data }) => { setList(data); setError('') })
    .catch((e: Error) => setError(e.message || 'Could not load proposals'))
    .finally(() => setLoading(false))
  useEffect(() => { void reload() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? list.filter((p) => `${p.ref_no} ${p.title} ${p.project_name} ${p.submitted_to}`.toLowerCase().includes(q)) : list
  }, [list, search])

  const load = async (id: number) => {
    const { data } = await proposalApi.get(id)
    const blank = emptyProposal()
    // Only the editable fields (not id / total / updated_*)
    const form = Object.fromEntries(Object.keys(blank).map((k) => [k, data[k as keyof ProposalInput] ?? blank[k as keyof ProposalInput]]))
    return form as unknown as ProposalInput
  }

  const openEditor = async (id: number, copy = false) => {
    setOpening(true)
    try {
      const form = await load(id)
      setEditing(copy ? { id: null, form: { ...form, ref_no: '', proposal_date: new Date().toISOString().slice(0, 10) }, key: nextEditorKey() } : { id, form, key: nextEditorKey() })
    } catch (e) {
      window.alert((e as Error).message || 'Could not open the proposal')
    } finally {
      setOpening(false)
    }
  }

  const print = async (id: number) => {
    // Open the window first so the browser does not block it as a pop-up.
    const w = window.open('', '_blank')
    if (!w) { window.alert('Allow pop-ups for this site to print the proposal.'); return }
    w.document.write('<p style="font:14px system-ui;padding:24px">Loading proposal…</p>')
    try {
      openProposalPrint(await load(id), w)
    } catch (e) {
      w.close()
      window.alert((e as Error).message || 'Could not load the proposal')
    }
  }

  const remove = async (p: ProposalSummary) => {
    if (!window.confirm(`Delete proposal ${p.ref_no || p.title}? This cannot be undone.`)) return
    try {
      await proposalApi.remove(p.id)
      setList((items) => items.filter((x) => x.id !== p.id))
    } catch (e) {
      window.alert((e as Error).message || 'Could not delete the proposal')
    }
  }

  if (editing) {
    return (
      <ProposalEditor
        key={editing.key}
        id={editing.id}
        initial={editing.form}
        onClose={() => { setEditing(null); setLoading(true); void reload() }}
        onSaved={(id) => setEditing((cur) => (cur ? { ...cur, id } : cur))}
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: '#82909a' }} />
          <input className="input" style={{ paddingLeft: 32 }} placeholder="Search ref. no., title, project, client..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <section className="surface">
        <div className="surface-heading">
          <div><p className="section-label">Clients</p><h2>Proposals ({filtered.length})</h2></div>
          <button type="button" className="btn btn-primary" onClick={() => setEditing({ id: null, form: emptyProposal(), key: nextEditorKey() })}><Plus size={16} /> New proposal</button>
        </div>
        {error ? <p style={{ color: '#b91c1c', margin: '0 0 12px' }}>{error} <button type="button" className="ghost-button" onClick={() => { setLoading(true); void reload() }}>Retry</button></p> : null}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead><tr><th>Ref. No.</th><th>Date</th><th>Title</th><th>Project / Site</th><th>Submitted To</th><th style={{ textAlign: 'right' }}>Fee</th><th>Last updated</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="empty-state">{loading ? 'Loading proposals…' : list.length === 0 ? 'No proposals yet. Click “New proposal” to write the first one.' : 'No proposals match your search.'}</td></tr>
              ) : filtered.map((p) => (
                <tr key={p.id}>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#2563eb' }}>{p.ref_no || '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{p.proposal_date ? longDate(p.proposal_date) : '-'}</td>
                  <td style={{ minWidth: 260, maxWidth: 380, whiteSpace: 'normal' }}>{p.title}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 220 }}>{p.project_name || '-'}</td>
                  <td style={{ whiteSpace: 'pre-line', maxWidth: 200, fontSize: '0.82rem', color: '#475569' }}>{p.submitted_to || '-'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: '#15803d' }}>{p.total ? formatFee(p.total) : '-'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#64748b' }}>{fmtUpdated(p.updated_at)}{p.updated_by ? <span style={{ display: 'block' }}>{p.updated_by}</span> : null}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <HistoryButton type="Proposal" id={p.id} title={`Proposal ${p.ref_no ?? ''}`} />
                    <button className="icon-button" type="button" title="Edit" disabled={opening} onClick={() => void openEditor(p.id)}><Pencil size={16} /></button>
                    <button className="icon-button" type="button" title="Preview / print" onClick={() => void print(p.id)}><Printer size={16} /></button>
                    <button className="icon-button" type="button" title="Make a copy as a new proposal" disabled={opening} onClick={() => void openEditor(p.id, true)}><Copy size={16} /></button>
                    <button className="icon-button" type="button" title="Delete" onClick={() => void remove(p)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

// ─── Editor ──────────────────────────────────────────────────────────────

function ProposalEditor({ id, initial, onClose, onSaved }: { id: number | null; initial: ProposalInput; onClose: () => void; onSaved: (id: number) => void }) {
  const [form, setForm] = useState<ProposalInput>(initial)
  const [savedJson, setSavedJson] = useState(() => (id ? JSON.stringify(initial) : ''))
  const [saving, setSaving] = useState(false)
  const [fillTab, setFillTab] = useState<'ai' | 'paste'>('ai')
  const [fillOpen, setFillOpen] = useState(initial.sections.length === 0)
  const [pasted, setPasted] = useState('')
  const [generating, setGenerating] = useState<'' | 'asking' | 'writing'>('')
  const [questions, setQuestions] = useState<AiQuestion[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [facts, setFacts] = useState<Array<{ title: string; content: string; state: '' | 'saving' | 'saved' }>>([])
  const { user } = useAuth()
  const [fillError, setFillError] = useState('')
  const [notice, setNotice] = useState('')

  const dirty = JSON.stringify(form) !== savedJson
  const set = <K extends keyof ProposalInput>(key: K, value: ProposalInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setSection = (i: number, patch: Partial<ProposalSection>) => setForm((f) => ({ ...f, sections: f.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  const hasFee = form.sections.some((s) => s.fee)
  const total = feeTotal(form.fee_rows)

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const applyDraft = (draft: ProposalDraft, source: string) => {
    if (!draft.sections.length) {
      setFillError(source === 'paste' ? 'No text found. Paste the proposal text first.' : 'The AI returned no sections. Add more detail to the brief and try again.')
      return
    }
    if (form.sections.some((s) => s.heading || s.body) && !window.confirm('Replace the current sections with the new text? Cover details you already typed are kept where the new text has none.')) return
    setForm((f) => ({
      ...f,
      title: draft.title?.trim() && (f.title.trim() === '' || f.title.trim() === 'PROPOSAL FOR' || source === 'ai') ? draft.title : f.title,
      project_name: draft.project_name?.trim() || f.project_name,
      submitted_to: draft.submitted_to?.trim() || f.submitted_to,
      ref_no: draft.ref_no?.trim() || f.ref_no,
      proposal_date: draft.proposal_date || f.proposal_date,
      sections: draft.sections,
      fee_rows: draft.fee_rows?.length ? draft.fee_rows : f.fee_rows,
      fee_note: draft.fee_note?.trim() || f.fee_note || DEFAULT_FEE_NOTE,
      supporting_info: draft.supporting_info?.trim() || f.supporting_info,
    }))
    setFillError('')
    setFillOpen(false)
    setNotice(`${draft.sections.length} sections filled in. Check the text below, then Save and Preview.`)
  }

  const writeDraft = async (brief: string, open: string[] = []) => {
    setGenerating('writing')
    setFillError('')
    try {
      const { data } = await proposalApi.generate(brief, open)
      applyDraft(data, 'ai')
      setQuestions([])
    } catch (e) {
      setFillError((e as Error).message || 'Could not write the proposal')
    } finally {
      setGenerating('')
    }
  }

  /** First asks for what the brief leaves out; writes at once when nothing is missing */
  const generate = async () => {
    if (form.brief.trim().length < 10) { setFillError('Write in a few words what the proposal is for.'); return }
    setGenerating('asking')
    setFillError('')
    try {
      const list = await proposalApi.questions(form.brief)
      if (list.length) {
        setQuestions(list)
        setAnswers(list.map(() => ''))
        setGenerating('')
        return
      }
    } catch (e) {
      setFillError((e as Error).message || 'Could not read the brief')
      setGenerating('')
      return
    }
    await writeDraft(form.brief)
  }

  /** The answers become part of the brief, so they are saved with the proposal and not asked again */
  const answerAndWrite = async () => {
    const answered = questions.map((q, i) => ({ ...q, answer: answers[i].trim() })).filter((q) => q.answer)
    const open = questions.filter((_, i) => !answers[i].trim()).map((q) => q.question)
    const brief = answered.length ? `${form.brief.trim()}\n\nFurther details:\n${answered.map((q) => `- ${q.question} ${q.answer}`).join('\n')}` : form.brief
    set('brief', brief)
    setFacts(answered.filter((q) => q.company).map((q) => ({ title: q.question.slice(0, 190), content: q.answer, state: '' })))
    // If writing fails, the next try asks only for what is still open
    const rest = questions.filter((_, i) => !answers[i].trim())
    setQuestions(rest)
    setAnswers(rest.map(() => ''))
    await writeDraft(brief, open)
  }

  const saveFact = async (i: number) => {
    const patch = (changes: Partial<(typeof facts)[number]>) => setFacts((list) => list.map((f, j) => (j === i ? { ...f, ...changes } : f)))
    patch({ state: 'saving' })
    try {
      await knowledgeApi.add(facts[i].title, facts[i].content)
      patch({ state: 'saved' })
    } catch (e) {
      patch({ state: '' })
      window.alert((e as Error).message)
    }
  }

  const save = async () => {
    if (!form.title.trim()) { window.alert('Enter the proposal title.'); return false }
    setSaving(true)
    try {
      const { data } = id ? await proposalApi.update(id, form) : await proposalApi.create(form)
      setSavedJson(JSON.stringify(form))
      if (!id) onSaved(data.id)
      setNotice('Saved.')
      return true
    } catch (e) {
      window.alert((e as Error).message || 'Could not save the proposal')
      return false
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
    onClose()
  }

  const move = (i: number, by: number) => setForm((f) => {
    const sections = [...f.sections]
    const j = i + by
    if (j < 0 || j >= sections.length) return f
    ;[sections[i], sections[j]] = [sections[j], sections[i]]
    return { ...f, sections }
  })

  const addSection = (fee = false) => setForm((f) => {
    const section: ProposalSection = fee
      ? { heading: 'Professional Fee', body: 'The proposed professional fee for the above scope is:', fee: true }
      : { heading: '', body: '', fee: false }
    return { ...f, sections: [...f.sections, section], fee_rows: fee && !f.fee_rows.length ? [{ description: '', amount: 0 }] : f.fee_rows }
  })

  const card: React.CSSProperties = { background: '#fff', border: '1px solid rgba(0,0,0,0.09)', borderRadius: 12, padding: 16, marginBottom: 14 }
  const tabBtn = (active: boolean): React.CSSProperties => ({ padding: '7px 14px', borderRadius: 8, border: '1px solid', borderColor: active ? '#2563eb' : '#cbd5e1', background: active ? '#eff6ff' : '#fff', color: active ? '#1d4ed8' : '#334155', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="proposal-editor-head" style={{ position: 'sticky', top: 'var(--topbar-height, 72px)', zIndex: 5, display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, padding: '10px 0 14px', background: 'var(--color-bg, #f4f5f7)' }}>
        <button type="button" onClick={close} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: 'none', padding: 0, color: '#475569', fontWeight: 600, cursor: 'pointer' }}><ArrowLeft size={16} /> Back</button>
        <h2 style={{ margin: 0, fontSize: '1.1rem', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {id ? `Edit proposal ${form.ref_no}` : 'New proposal'}
          {dirty ? <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>● Unsaved</span> : null}
        </h2>
        <div style={{ justifySelf: 'end', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={() => openProposalPrint(form)} title="Open the letterhead layout in a new tab"><Eye size={16} /> Preview / Print</button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}><Save size={16} /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {notice ? <p style={{ margin: '0 0 12px', padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', color: '#166534', fontSize: '0.85rem' }}>{notice}</p> : null}

      {/* Fill from content */}
      <div style={{ ...card, borderColor: '#c7d2fe', background: '#fafbff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong style={{ flex: 1 }}>Fill the proposal text from your content</strong>
          {fillOpen ? (
            <>
              <button type="button" style={tabBtn(fillTab === 'ai')} onClick={() => setFillTab('ai')}><Sparkles size={15} /> Write with AI from a brief</button>
              <button type="button" style={tabBtn(fillTab === 'paste')} onClick={() => setFillTab('paste')}><ClipboardPaste size={15} /> Paste ready text</button>
            </>
          ) : <button type="button" className="ghost-button" onClick={() => setFillOpen(true)}>Show</button>}
        </div>
        {fillOpen ? (
          <div style={{ marginTop: 12 }}>
            {fillTab === 'ai' ? (
              <>
                <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#475569' }}>Write the facts: client and site, the problem, the tests / work with quantities, rates, exclusions, anything special. A short brief is fine: the AI knows the company from namotech.in and earlier proposals, and first asks for what is missing. You can edit everything afterwards.</p>
                <textarea className="input" rows={9} value={form.brief} placeholder={BRIEF_PLACEHOLDER} onChange={(e) => set('brief', e.target.value)} style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                  <button type="button" className="btn btn-primary" disabled={Boolean(generating)} onClick={() => void generate()}><Sparkles size={16} /> {generating === 'asking' ? 'Reading the brief…' : generating ? 'Writing the proposal… (can take 2–4 minutes)' : questions.length ? 'Read the brief again' : 'Generate proposal text'}</button>
                  {!generating && !questions.length && form.brief.trim().length >= 10 ? <button type="button" className="ghost-button" onClick={() => void writeDraft(form.brief)}>Write without questions</button> : null}
                </div>
                {questions.length ? (
                  <div style={{ marginTop: 14, padding: 14, border: '1px solid #c7d2fe', borderRadius: 10, background: '#fff' }}>
                    <strong>A few details would make this proposal better</strong>
                    <p style={{ margin: '4px 0 8px', fontSize: '0.82rem', color: '#475569' }}>Click an answer or type your own. Leave out what you do not know; it is written as [to be confirmed].</p>
                    {questions.map((q, i) => (
                      <div key={q.question} className="ai-q">
                        <label style={{ fontWeight: 600 }} htmlFor={`ai-q-${i}`}>{i + 1}. {q.question}</label>
                        {q.why ? <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748b' }}>{q.why}</span> : null}
                        {q.suggestions.length ? <div className="ai-q__chips">{q.suggestions.map((x) => <button key={x} type="button" className={answers[i] === x ? 'on' : ''} disabled={Boolean(generating)} onClick={() => setAnswers((a) => a.map((v, j) => (j === i ? (v === x ? '' : x) : v)))}>{x}</button>)}</div> : null}
                        <input id={`ai-q-${i}`} className="input" maxLength={1000} disabled={Boolean(generating)} value={answers[i] ?? ''} placeholder="Skip, or type the answer" onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))} />
                      </div>
                    ))}
                    <button type="button" className="btn btn-primary" disabled={Boolean(generating)} onClick={() => void answerAndWrite()}><Sparkles size={16} /> {generating ? 'Writing the proposal… (can take 2–4 minutes)' : answers.some((a) => a.trim()) ? 'Write the proposal' : 'Skip all and write'}</button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#475569' }}>Paste a finished proposal (from Word, a PDF or an email). Numbered UPPER-CASE headings like “1. BACKGROUND” start sections, “3.1 …” lines become sub-headings, • lines become bullets, and fee lines with ₹ amounts go into the fee table.</p>
                <textarea className="input" rows={12} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'1. BACKGROUND\nBased on the preliminary visual observations...\n\n2. OBJECTIVE OF THE ASSIGNMENT\n...'} style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }} />
                <div style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-primary" onClick={() => applyDraft(parsePastedProposal(pasted), 'paste')}><ClipboardPaste size={16} /> Format into proposal</button>
                </div>
              </>
            )}
            {fillError ? <p style={{ margin: '10px 0 0', color: '#b91c1c', fontSize: '0.85rem' }}>{fillError}</p> : null}
          </div>
        ) : null}
      </div>

      {facts.length ? (
        <div style={{ ...card, borderColor: '#bbf7d0', background: '#f7fef9' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}><strong style={{ flex: 1 }}>Remember for later proposals?</strong><button type="button" className="ghost-button" onClick={() => setFacts([])}>No, close</button></div>
          <p style={{ margin: '4px 0 8px', fontSize: '0.82rem', color: '#475569' }}>These answers look like facts about the company, not only this client.{user?.is_admin ? '' : ' The admin approves them before the AI uses them.'}</p>
          {facts.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0' }}>
              <input className="input" style={{ flex: '1 1 220px' }} aria-label="About" disabled={f.state !== ''} maxLength={190} value={f.title} onChange={(e) => setFacts((list) => list.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <input className="input" style={{ flex: '2 1 300px' }} aria-label="Fact" disabled={f.state !== ''} maxLength={3000} value={f.content} onChange={(e) => setFacts((list) => list.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))} />
              <button type="button" className="btn btn-outline btn-sm" disabled={f.state !== '' || !f.title.trim() || !f.content.trim()} onClick={() => void saveFact(i)}>{f.state === 'saved' ? (user?.is_admin ? 'Saved' : 'Sent to admin') : f.state === 'saving' ? 'Saving…' : 'Save to company knowledge'}</button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Cover page */}
      <div style={card}>
        <p className="section-label" style={{ marginTop: 0 }}>Cover page</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <label><span>Ref. No.</span><input className="input" placeholder="NCS/2026/10078" value={form.ref_no} onChange={(e) => set('ref_no', e.target.value)} /></label>
          <label><span>Date</span><input className="input" type="date" value={form.proposal_date} onChange={(e) => set('proposal_date', e.target.value)} /></label>
          <label><span>Signatory name</span><input className="input" value={form.signatory_name} onChange={(e) => set('signatory_name', e.target.value)} /></label>
          <label><span>Signatory designation</span><input className="input" value={form.signatory_designation} onChange={(e) => set('signatory_designation', e.target.value)} /></label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginTop: 12 }}>
          <label><span>Title <Req /></span><textarea className="input" rows={2} value={form.title} onChange={(e) => set('title', e.target.value)} style={{ fontFamily: 'inherit', resize: 'vertical' }} /></label>
          <label><span>Project / site name</span><input className="input" placeholder="ANUKAMPA PLATINA, JAIPUR" value={form.project_name} onChange={(e) => set('project_name', e.target.value)} /></label>
          <label><span>Submitted to (one line each; the first line is bold)</span><textarea className="input" rows={3} placeholder={'The Secretary\nAnukampa Platina\nJaipur, Rajasthan'} value={form.submitted_to} onChange={(e) => set('submitted_to', e.target.value)} style={{ fontFamily: 'inherit', resize: 'vertical' }} /></label>
          <label><span>Supporting information / annexures (shown under the contents)</span><textarea className="input" rows={3} placeholder="**Annexure A:** Existing Site Condition Photographs" value={form.supporting_info} onChange={(e) => set('supporting_info', e.target.value)} style={{ fontFamily: 'inherit', resize: 'vertical' }} /></label>
        </div>
      </div>

      {/* Sections */}
      <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: '#64748b' }}><strong>Formatting:</strong> {MARKUP_HELP}. Sections are numbered automatically, and the table of contents is built from the headings.</p>
      {form.sections.map((s, i) => {
        const subs = subHeadings(s.body)
        return (
          <div key={i} style={{ ...card, borderLeft: s.fee ? '4px solid #16a34a' : '4px solid #2563eb' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: 800, color: '#1e293b', minWidth: 28 }}>{i + 1}.</span>
              <input className="input" style={{ flex: 1, fontWeight: 700 }} placeholder="Section heading, e.g. Background" value={s.heading} onChange={(e) => setSection(i, { heading: e.target.value })} />
              {s.fee ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>Fee table</span> : null}
              <button className="icon-button" type="button" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
              <button className="icon-button" type="button" title="Move down" disabled={i === form.sections.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
              <button className="icon-button" type="button" title="Delete section" onClick={() => { if (window.confirm(`Delete section ${i + 1}${s.heading ? ` (${s.heading})` : ''}?`)) setForm((f) => ({ ...f, sections: f.sections.filter((_, j) => j !== i) })) }}><Trash2 size={16} /></button>
            </div>
            <textarea
              className="input"
              value={s.body}
              rows={Math.min(24, Math.max(s.fee ? 2 : 4, s.body.split('\n').length + 1))}
              placeholder={s.fee ? 'Text before the fee table, e.g. The proposed professional fee for the above scope is:' : 'Section text…'}
              onChange={(e) => setSection(i, { body: e.target.value })}
              style={{ width: '100%', marginTop: 10, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical' }}
            />
            {subs.length ? <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#64748b' }}>Sub-sections: {subs.map((h, k) => `${i + 1}.${k + 1} ${h}`).join(' · ')}</p> : null}

            {s.fee ? (
              <div style={{ marginTop: 12 }}>
                <table className="data-table">
                  <thead><tr><th style={{ width: 60 }}>Sr. No.</th><th>Description</th><th style={{ width: 170, textAlign: 'right' }}>Amount (₹)</th><th style={{ width: 50 }} /></tr></thead>
                  <tbody>
                    {form.fee_rows.map((r, k) => (
                      <tr key={k}>
                        <td style={{ fontWeight: 700 }}>{k + 1}</td>
                        <td><input className="input" value={r.description} placeholder="Rebound Hammer + UPV Testing – 25 locations @ ₹2,500/-" onChange={(e) => set('fee_rows', form.fee_rows.map((x, j) => (j === k ? { ...x, description: e.target.value } : x)))} /></td>
                        <td><input className="input" style={{ textAlign: 'right' }} inputMode="decimal" value={r.amount || ''} placeholder="0" onChange={(e) => set('fee_rows', form.fee_rows.map((x, j) => (j === k ? { ...x, amount: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 } : x)))} /></td>
                        <td><button className="icon-button" type="button" title="Remove row" onClick={() => set('fee_rows', form.fee_rows.filter((_, j) => j !== k))}><Trash2 size={15} /></button></td>
                      </tr>
                    ))}
                    <tr>
                      <td />
                      <td style={{ fontWeight: 800 }}>TOTAL PROFESSIONAL FEE</td>
                      <td style={{ fontWeight: 800, textAlign: 'right', color: '#15803d' }}>{formatFee(total)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                  <button type="button" className="ghost-button" onClick={() => set('fee_rows', [...form.fee_rows, { description: '', amount: 0 }])} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Add fee row</button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{rupeesInWords(total)}</span>
                </div>
                <label style={{ display: 'block', marginTop: 10 }}><span>Note under the fee</span><input className="input" value={form.fee_note} onChange={(e) => set('fee_note', e.target.value)} placeholder={DEFAULT_FEE_NOTE} /></label>
              </div>
            ) : null}
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 30 }}>
        <button type="button" className="ghost-button" onClick={() => addSection(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Add section</button>
        {!hasFee ? <button type="button" className="ghost-button" onClick={() => addSection(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IndianRupee size={16} /> Add fee section</button> : null}
        <span style={{ flex: 1 }} />
        <button type="button" className="ghost-button" onClick={() => openProposalPrint(form)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Eye size={16} /> Preview / Print</button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}><Save size={16} /> {saving ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  )
}
