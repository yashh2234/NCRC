import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Inbox, Send, FileText, Archive, AlertOctagon, Trash2, Folder, PenSquare, RefreshCw, Settings,
  Search, Reply, ReplyAll, Forward, Paperclip, Download, X, Mail, Star, ChevronDown, ChevronLeft, ChevronRight,
  Columns2, Rows2, Filter, CornerUpLeft, Circle,
} from 'lucide-react'
import { Modal } from '../components/Modal'
import { Req } from '../components/ui'
import {
  mailApi, DEFAULT_MAIL_SETTINGS, formatAddress, formatListDate, formatSize,
  type MailFilter, type MailFolder, type MailMessage, type MailSettings, type MailSummary,
} from '../lib/mail'

interface Draft {
  to: string
  cc: string
  bcc: string
  subject: string
  body: string
  replyUid?: number
  replyFolder?: string
  title: string
}

type Layout = 'classic' | 'vertical'

const FOLDER_ICONS: Record<MailFolder['role'], typeof Inbox> = {
  inbox: Inbox, sent: Send, drafts: FileText, archive: Archive, junk: AlertOctagon, trash: Trash2, other: Folder,
}
const FOLDER_LABELS: Partial<Record<MailFolder['role'], string>> = {
  inbox: 'Inbox', sent: 'Sent', drafts: 'Drafts', archive: 'Archives', junk: 'Junk', trash: 'Trash',
}
const LAYOUT_KEY = 'ncrc_mail_layout'
const AUTO_CHECK_MS = 2 * 60 * 1000

function quote(message: MailMessage) {
  const when = message.date ? new Date(message.date).toLocaleString('en-IN') : ''
  const lines = (message.text || '').split('\n').map((line) => `> ${line}`).join('\n')
  return `\n\n\nOn ${when}, ${formatAddress(message.from)} wrote:\n${lines}`
}

function folderLabel(f: MailFolder) {
  return (f.depth === 0 || f.role !== 'other') && FOLDER_LABELS[f.role] ? FOLDER_LABELS[f.role]! : f.name
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

export function MailPage({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<{ configured: boolean; email: string | null; can_configure: boolean } | null>(null)
  const [statusError, setStatusError] = useState('')
  const [folders, setFolders] = useState<MailFolder[]>([])
  const [folder, setFolder] = useState('INBOX')
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MailFilter>('')
  const [onlyAttachments, setOnlyAttachments] = useState(false)
  const [list, setList] = useState<MailSummary[]>([])
  const [total, setTotal] = useState(0)
  const [perPage, setPerPage] = useState(25)
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [selectedUid, setSelectedUid] = useState<number | null>(null)
  const [message, setMessage] = useState<MailMessage | null>(null)
  const [messageLoading, setMessageLoading] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [checking, setChecking] = useState(false)
  const [layout, setLayout] = useState<Layout>(() => {
    try { return localStorage.getItem(LAYOUT_KEY) === 'vertical' ? 'vertical' : 'classic' } catch { return 'classic' }
  })

  const changeLayout = (next: Layout) => {
    setLayout(next)
    try { localStorage.setItem(LAYOUT_KEY, next) } catch { /* ignore */ }
  }

  const loadStatus = useCallback(() => {
    mailApi.status().then((s) => { setStatus(s); setStatusError('') }).catch((e: Error) => setStatusError(e.message))
  }, [])
  useEffect(loadStatus, [loadStatus])

  const loadFolders = useCallback(() => mailApi.folders().then(({ data }) => setFolders(data)).catch(() => undefined), [])

  const loadList = useCallback((quiet = false) => {
    if (!quiet) setListLoading(true)
    setListError('')
    return mailApi.messages(folder, page, search, filter)
      .then((res) => { setList(res.data); setTotal(res.total); setPerPage(res.per_page) })
      .catch((e: Error) => { if (!quiet) { setList([]); setTotal(0) } setListError(e.message) })
      .finally(() => setListLoading(false))
  }, [folder, page, search, filter])

  useEffect(() => { if (status?.configured) void loadFolders() }, [status?.configured, loadFolders])
  useEffect(() => { if (status?.configured) void loadList() }, [status?.configured, loadList])

  const getMessages = useCallback(async () => {
    setChecking(true)
    await Promise.all([loadFolders(), loadList(true)])
    setChecking(false)
  }, [loadFolders, loadList])

  // Check for new mail every couple of minutes while the page is visible, like Thunderbird's auto-check
  useEffect(() => {
    if (!status?.configured) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void getMessages()
    }, AUTO_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [status?.configured, getMessages])

  const visibleList = useMemo(() => onlyAttachments ? list.filter((m) => m.has_attachment) : list, [list, onlyAttachments])
  const currentFolder = folders.find((f) => f.path === folder)
  const isSentLike = currentFolder?.role === 'sent' || currentFolder?.role === 'drafts'

  const adjustUnread = (path: string, delta: number) => {
    setFolders((all) => all.map((f) => f.path === path && f.unread !== null ? { ...f, unread: Math.max(0, f.unread + delta) } : f))
  }

  const openMessage = (uid: number) => {
    setSelectedUid(uid)
    setMessage(null)
    setMessageLoading(true)
    const wasUnread = list.find((m) => m.uid === uid)?.seen === false
    mailApi.message(folder, uid)
      .then(({ data }) => {
        setMessage(data)
        if (wasUnread) {
          setList((items) => items.map((m) => m.uid === uid ? { ...m, seen: true } : m))
          adjustUnread(folder, -1)
        }
      })
      .catch((e: Error) => window.alert(e.message))
      .finally(() => setMessageLoading(false))
  }

  const changeFolder = (path: string) => {
    setFolder(path)
    setPage(1)
    setSelectedUid(null)
    setMessage(null)
  }

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  /** Drop a mail from the list after it was moved/deleted and select the next one, as Thunderbird does. */
  const removeFromList = (uid: number) => {
    const index = visibleList.findIndex((m) => m.uid === uid)
    const next = visibleList[index + 1] ?? visibleList[index - 1]
    const removed = list.find((m) => m.uid === uid)
    if (removed && !removed.seen) adjustUnread(folder, -1)
    setList((items) => items.filter((m) => m.uid !== uid))
    setTotal((t) => Math.max(0, t - 1))
    if (next) openMessage(next.uid)
    else { setSelectedUid(null); setMessage(null) }
  }

  const deleteSelected = async () => {
    if (!selectedUid) return
    try {
      await mailApi.remove(folder, selectedUid)
      removeFromList(selectedUid)
      void loadFolders()
    } catch (e) { window.alert((e as Error).message) }
  }

  const moveSelected = async (to: 'archive' | 'junk') => {
    if (!selectedUid) return
    try {
      await mailApi.move(folder, selectedUid, to)
      removeFromList(selectedUid)
      void loadFolders()
    } catch (e) { window.alert((e as Error).message) }
  }

  const toggleFlag = async (uid: number, key: 'seen' | 'flagged') => {
    const item = list.find((m) => m.uid === uid)
    if (!item) return
    const value = !item[key]
    setList((items) => items.map((m) => m.uid === uid ? { ...m, [key]: value } : m))
    if (message?.uid === uid) setMessage({ ...message, [key]: value })
    if (key === 'seen') adjustUnread(folder, value ? -1 : 1)
    try {
      await mailApi.setFlags(folder, uid, { [key]: value })
    } catch (e) {
      setList((items) => items.map((m) => m.uid === uid ? { ...m, [key]: !value } : m))
      if (key === 'seen') adjustUnread(folder, value ? 1 : -1)
      window.alert((e as Error).message)
    }
  }

  const ownEmail = (status?.email || '').toLowerCase()
  const newMail = () => setDraft({ title: 'Write', to: '', cc: '', bcc: '', subject: '', body: '' })
  const reply = (all: boolean) => {
    if (!message) return
    const primary = message.reply_to[0] ?? message.from
    const others = all
      ? [...message.to, ...message.cc].filter((a) => a.email.toLowerCase() !== ownEmail && a.email !== primary?.email)
      : []
    setDraft({
      title: all ? 'Reply All' : 'Reply',
      to: formatAddress(primary),
      cc: others.map(formatAddress).join(', '),
      bcc: '',
      subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
      body: quote(message),
      replyUid: message.uid,
      replyFolder: folder,
    })
  }
  const forward = () => {
    if (!message) return
    const header = [
      '', '', '-------- Forwarded Message --------',
      `Subject: ${message.subject}`,
      `Date: ${message.date ? new Date(message.date).toLocaleString('en-IN') : ''}`,
      `From: ${formatAddress(message.from)}`,
      `To: ${message.to.map(formatAddress).join(', ')}`, '', '',
    ].join('\n')
    setDraft({ title: 'Forward', to: '', cc: '', bcc: '', subject: /^fwd?:/i.test(message.subject) ? message.subject : `Fwd: ${message.subject}`, body: header + (message.text || '') })
  }

  // Thunderbird keyboard shortcuts
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => undefined)
  keyHandler.current = (e: KeyboardEvent) => {
    if (!status?.configured || draft || showSettings || isTyping(e.target)) return
    const ctrl = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()
    const index = visibleList.findIndex((m) => m.uid === selectedUid)
    const handled = () => e.preventDefault()

    if (e.key === 'ArrowDown' && !ctrl) { handled(); const next = visibleList[index + 1] ?? (index < 0 ? visibleList[0] : null); if (next) openMessage(next.uid) }
    else if (e.key === 'ArrowUp' && !ctrl) { handled(); const prev = visibleList[index - 1]; if (prev) openMessage(prev.uid) }
    else if (e.key === 'Delete') { handled(); void deleteSelected() }
    else if (e.key === 'F5') { handled(); void getMessages() }
    else if (ctrl && e.shiftKey && key === 'r') { handled(); reply(true) }
    else if (ctrl && key === 'r') { handled(); reply(false) }
    else if (ctrl && key === 'l') { handled(); forward() }
    else if (ctrl && key === 'm') { handled(); newMail() }
    else if (!ctrl && !e.altKey && key === 'a' && selectedUid) { handled(); void moveSelected('archive') }
    else if (!ctrl && !e.altKey && key === 'j' && selectedUid) { handled(); void moveSelected('junk') }
    else if (!ctrl && !e.altKey && key === 's' && selectedUid) { handled(); void toggleFlag(selectedUid, 'flagged') }
    else if (!ctrl && !e.altKey && key === 'm' && selectedUid) { handled(); void toggleFlag(selectedUid, 'seen') }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Keep the selected row in view when moving with the arrow keys
  useEffect(() => {
    if (selectedUid) document.querySelector(`[data-mail-uid="${selectedUid}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [selectedUid])

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const firstShown = total === 0 ? 0 : (page - 1) * perPage + 1
  const lastShown = Math.min(page * perPage, total)
  const totalUnread = folders.reduce((sum, f) => sum + (f.role === 'inbox' ? f.unread ?? 0 : 0), 0)

  // ---------------------------------------------------------------- render

  const appbar = (
    <header className="tb-appbar">
      <button type="button" className="tb-back" onClick={onBack}>
        <ArrowLeft size={16} /> Back to NCRC
      </button>
      <div className="tb-brand">
        <img className="tb-logo" src={`${import.meta.env.BASE_URL}ncrc-logo.png`} alt="NCRC" />
        <span className="tb-appname"><Mail size={16} /> Mail</span>
      </div>
      <div className="tb-appbar__end">
        {status?.can_configure ? (
          <button type="button" className="tb-tool" title="Account settings" onClick={() => setShowSettings(true)}>
            <Settings size={16} /> <span>Account Settings</span>
          </button>
        ) : null}
      </div>
    </header>
  )

  if (statusError || !status || !status.configured) {
    return (
      <div className="tb-app">
        {appbar}
        <div className="tb-setup">
          <Mail size={40} />
          {statusError ? <p>{statusError}</p> : !status ? <p>Loading…</p> : (
            <>
              <h2>Office mailbox not connected</h2>
              {status.can_configure ? (
                <>
                  <p>Connect info@namotech.in once and everyone with Mail access can read and send from it here.</p>
                  <button type="button" className="btn btn-primary" onClick={() => setShowSettings(true)}><Settings size={15} /> Set up mailbox</button>
                </>
              ) : <p>Ask an administrator to connect the office mailbox.</p>}
            </>
          )}
        </div>
        {showSettings ? <SettingsModal onClose={() => setShowSettings(false)} onSaved={() => { setShowSettings(false); loadStatus() }} /> : null}
      </div>
    )
  }

  return (
    <div className="tb-app">
      {appbar}

      <div className="tb-toolbar" role="toolbar" aria-label="Mail toolbar">
        <button type="button" className="tb-tool" onClick={() => void getMessages()} title="Get Messages (F5)" disabled={checking}>
          <RefreshCw size={16} className={checking ? 'tb-spin' : undefined} /> <span>Get Messages</span>
        </button>
        <button type="button" className="tb-tool tb-tool--primary" onClick={newMail} title="Write a new message (Ctrl+M)">
          <PenSquare size={16} /> <span>Write</span>
        </button>
        <span className="tb-spacer" />
        <form className="tb-search" onSubmit={runSearch} role="search">
          <Search size={15} />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search messages…" aria-label="Search messages" />
          {search ? <button type="button" aria-label="Clear search" onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}><X size={14} /></button> : null}
        </form>
        <div className="tb-layout" role="group" aria-label="Message pane layout">
          <button type="button" className={layout === 'classic' ? 'active' : ''} onClick={() => changeLayout('classic')} title="Classic view: message below the list"><Rows2 size={16} /></button>
          <button type="button" className={layout === 'vertical' ? 'active' : ''} onClick={() => changeLayout('vertical')} title="Vertical view: message beside the list"><Columns2 size={16} /></button>
        </div>
      </div>

      <div className={`tb-main${selectedUid ? ' has-selection' : ''}`}>
        <aside className="tb-folders" aria-label="Folders">
          <div className="tb-account"><ChevronDown size={14} /> <Mail size={15} /> <span title={status.email ?? ''}>{status.email}</span></div>
          {(folders.length ? folders : [{ path: 'INBOX', name: 'Inbox', depth: 0, role: 'inbox', unread: null, total: null } as MailFolder]).map((f) => {
            const Icon = FOLDER_ICONS[f.role]
            return (
              <button
                key={f.path}
                type="button"
                className={`tb-folder${f.path === folder ? ' active' : ''}${f.unread ? ' has-unread' : ''}`}
                style={{ paddingLeft: 22 + Math.min(f.depth, 3) * 14 }}
                onClick={() => changeFolder(f.path)}
                title={f.path}
              >
                <Icon size={15} /> <span className="tb-folder__name">{folderLabel(f)}</span>
                {f.unread ? <span className="tb-folder__count">{f.unread}</span> : null}
              </button>
            )
          })}
          <select className="tb-folder-select" value={folder} onChange={(e) => changeFolder(e.target.value)} aria-label="Folder">
            {(folders.length ? folders : [{ path: 'INBOX', name: 'Inbox', role: 'inbox' } as MailFolder]).map((f) => (
              <option key={f.path} value={f.path}>{folderLabel(f)}{f.unread ? ` (${f.unread})` : ''}</option>
            ))}
          </select>
        </aside>

        <div className={`tb-content tb-content--${layout}`}>
          <section className="tb-threads" aria-label="Messages">
            <div className="tb-quickfilter">
              <Filter size={14} className="tb-muted" />
              <button type="button" className={filter === 'unread' ? 'active' : ''} onClick={() => { setFilter(filter === 'unread' ? '' : 'unread'); setPage(1) }}><Circle size={10} /> Unread</button>
              <button type="button" className={filter === 'starred' ? 'active' : ''} onClick={() => { setFilter(filter === 'starred' ? '' : 'starred'); setPage(1) }}><Star size={12} /> Starred</button>
              <button type="button" className={onlyAttachments ? 'active' : ''} onClick={() => setOnlyAttachments(!onlyAttachments)}><Paperclip size={12} /> Attachment</button>
              <span className="tb-spacer" />
              <span className="tb-muted">{search ? `Search: “${search}” · ` : ''}{total} {total === 1 ? 'message' : 'messages'}</span>
            </div>

            <div className="tb-threadtable" role="grid" aria-rowcount={visibleList.length}>
              <div className="tb-row tb-row--head" role="row">
                <span className="tb-col tb-col--icon" title="Read status"><Circle size={9} /></span>
                <span className="tb-col tb-col--icon" title="Starred"><Star size={13} /></span>
                <span className="tb-col tb-col--icon" title="Attachments"><Paperclip size={13} /></span>
                <span className="tb-col tb-col--subject">Subject</span>
                <span className="tb-col tb-col--corr">{isSentLike ? 'Recipient' : 'Correspondents'}</span>
                <span className="tb-col tb-col--date">Date</span>
              </div>
              <div className="tb-rows">
                {listLoading ? <p className="tb-note">Loading…</p>
                  : listError ? <p className="tb-note tb-error">{listError}</p>
                    : visibleList.length === 0 ? <p className="tb-note">{filter || onlyAttachments || search ? 'No messages match.' : 'This folder is empty.'}</p>
                      : visibleList.map((m) => {
                        const who = isSentLike ? m.to_first : m.from
                        return (
                          <div
                            key={m.uid}
                            data-mail-uid={m.uid}
                            role="row"
                            aria-selected={m.uid === selectedUid}
                            tabIndex={-1}
                            className={`tb-row${m.seen ? '' : ' unread'}${m.uid === selectedUid ? ' selected' : ''}`}
                            onClick={() => openMessage(m.uid)}
                          >
                            <button type="button" className="tb-col tb-col--icon tb-readdot" onClick={(e) => { e.stopPropagation(); void toggleFlag(m.uid, 'seen') }} title={m.seen ? 'Mark as unread (M)' : 'Mark as read (M)'} aria-label={m.seen ? 'Mark as unread' : 'Mark as read'}>
                              <Circle size={9} fill={m.seen ? 'none' : 'currentColor'} />
                            </button>
                            <button type="button" className={`tb-col tb-col--icon tb-star${m.flagged ? ' on' : ''}`} onClick={(e) => { e.stopPropagation(); void toggleFlag(m.uid, 'flagged') }} title={m.flagged ? 'Remove star (S)' : 'Star (S)'} aria-label={m.flagged ? 'Remove star' : 'Star'}>
                              <Star size={14} fill={m.flagged ? 'currentColor' : 'none'} />
                            </button>
                            <span className="tb-col tb-col--icon">{m.has_attachment ? <Paperclip size={13} aria-label="Has attachments" /> : null}</span>
                            <span className="tb-col tb-col--subject" title={m.subject}>
                              {m.answered ? <CornerUpLeft size={12} className="tb-answered" aria-label="Replied" /> : null}
                              {m.subject}
                            </span>
                            <span className="tb-col tb-col--corr" title={who?.email}>{who?.name || who?.email || '(unknown)'}</span>
                            <span className="tb-col tb-col--date">{formatListDate(m.date)}</span>
                          </div>
                        )
                      })}
              </div>
            </div>
          </section>

          <section className="tb-messagepane" aria-label="Message">
            {!selectedUid ? (
              <div className="tb-placeholder">
                <Mail size={36} />
                <p>{total ? 'Select a message to read it.' : 'No messages.'}</p>
                <small>Tip: ↑ ↓ to move, Ctrl+R reply, Ctrl+L forward, A archive, Delete to delete.</small>
              </div>
            ) : messageLoading || !message ? (
              <div className="tb-placeholder"><p>Loading…</p></div>
            ) : (
              <>
                <div className="tb-msghead">
                  <div className="tb-msghead__top">
                    <button type="button" className="tb-msghead__back" onClick={() => { setSelectedUid(null); setMessage(null) }} aria-label="Back to message list"><ChevronLeft size={18} /></button>
                    <span className="tb-avatar">{(message.from?.name || message.from?.email || '?').charAt(0).toUpperCase()}</span>
                    <div className="tb-msghead__from">
                      <strong>{message.from?.name || message.from?.email}</strong>
                      {message.from?.name ? <span className="tb-muted"> &lt;{message.from.email}&gt;</span> : null}
                    </div>
                    <div className="tb-msgactions">
                      <button type="button" onClick={() => reply(false)} title="Reply (Ctrl+R)"><Reply size={15} /> <span>Reply</span></button>
                      <button type="button" onClick={() => reply(true)} title="Reply All (Ctrl+Shift+R)"><ReplyAll size={15} /> <span>Reply All</span></button>
                      <button type="button" onClick={forward} title="Forward (Ctrl+L)"><Forward size={15} /> <span>Forward</span></button>
                      <button type="button" onClick={() => void moveSelected('archive')} title="Archive (A)"><Archive size={15} /> <span>Archive</span></button>
                      <button type="button" onClick={() => void moveSelected('junk')} title="Junk (J)"><AlertOctagon size={15} /> <span>Junk</span></button>
                      <button type="button" onClick={() => void deleteSelected()} title="Delete (Del)"><Trash2 size={15} /> <span>Delete</span></button>
                      <button type="button" className={message.flagged ? 'tb-star on' : 'tb-star'} onClick={() => void toggleFlag(message.uid, 'flagged')} title={message.flagged ? 'Remove star (S)' : 'Star (S)'} aria-label="Star"><Star size={15} fill={message.flagged ? 'currentColor' : 'none'} /></button>
                      <button type="button" onClick={() => void toggleFlag(message.uid, 'seen')} title="Mark as unread (M)" aria-label="Mark as unread"><Circle size={12} /></button>
                    </div>
                  </div>
                  <div className="tb-msghead__fields">
                    <div><span className="tb-label">To</span> {message.to.map(formatAddress).join(', ') || '-'}</div>
                    {message.cc.length ? <div><span className="tb-label">Cc</span> {message.cc.map(formatAddress).join(', ')}</div> : null}
                    <div className="tb-msghead__subject">
                      <span className="tb-label">Subject</span> <strong>{message.subject}</strong>
                      <span className="tb-msghead__date">{message.date ? new Date(message.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
                    </div>
                  </div>
                </div>

                <div className="tb-msgbody">
                  <MessageBody message={message} />
                </div>

                {message.attachments.length ? (
                  <div className="tb-attachbar">
                    <div className="tb-attachbar__head">
                      <Paperclip size={14} /> <strong>{message.attachments.length} {message.attachments.length === 1 ? 'attachment' : 'attachments'}</strong>
                      <span className="tb-muted">{formatSize(message.attachments.reduce((s, a) => s + a.size, 0))}</span>
                      <span className="tb-spacer" />
                      {message.attachments.length > 1 ? (
                        <button type="button" className="tb-tool" onClick={() => message.attachments.forEach((a) => void mailApi.downloadAttachment(folder, message.uid, a.index, a.name).catch(() => undefined))}>
                          <Download size={14} /> <span>Save All</span>
                        </button>
                      ) : null}
                    </div>
                    <div className="tb-attachbar__list">
                      {message.attachments.map((a) => (
                        <button key={a.index} type="button" className="tb-attachment" onClick={() => void mailApi.downloadAttachment(folder, message.uid, a.index, a.name).catch((e: Error) => window.alert(e.message))} title={`Save ${a.name}`}>
                          <Paperclip size={13} /> <span>{a.name}</span> <small>{formatSize(a.size)}</small> <Download size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>

      <footer className="tb-statusbar">
        <span>{checking ? 'Checking for new messages…' : listError ? 'Not connected' : `Connected · ${status.email}`}</span>
        <span className="tb-spacer" />
        {totalPages > 1 ? (
          <span className="tb-pager">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Newer messages"><ChevronLeft size={14} /></button>
            {firstShown}–{lastShown} of {total}
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Older messages"><ChevronRight size={14} /></button>
          </span>
        ) : null}
        <span>Unread: <strong>{currentFolder?.unread ?? (folder === 'INBOX' ? totalUnread : 0)}</strong></span>
        <span>Total: <strong>{currentFolder?.total ?? total}</strong></span>
      </footer>

      {draft ? <ComposeModal draft={draft} from={status.email ?? ''} onClose={() => setDraft(null)} onSent={() => { setDraft(null); void getMessages() }} /> : null}
      {showSettings ? <SettingsModal onClose={() => setShowSettings(false)} onSaved={() => { setShowSettings(false); loadStatus(); void getMessages() }} /> : null}
    </div>
  )
}

/** HTML mail is shown in a sandboxed frame: no scripts, links open in a new tab. */
function MessageBody({ message }: { message: MailMessage }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(400)
  const srcDoc = useMemo(() => message.html
    ? `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0;padding:4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1e293b;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${message.html}</body></html>`
    : null, [message.html])

  if (!srcDoc) return <pre className="tb-text">{message.text || '(empty message)'}</pre>

  return (
    <iframe
      ref={frameRef}
      className="tb-frame"
      title="Message content"
      sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      srcDoc={srcDoc}
      style={{ height }}
      onLoad={() => {
        const doc = frameRef.current?.contentDocument
        if (doc) setHeight(Math.max(200, doc.documentElement.scrollHeight + 16))
      }}
    />
  )
}

function ComposeModal({ draft, from, onClose, onSent }: { draft: Draft; from: string; onClose: () => void; onSent: () => void }) {
  const [form, setForm] = useState(draft)
  const [showCc, setShowCc] = useState(Boolean(draft.cc))
  const [showBcc, setShowBcc] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject.trim() && !window.confirm('Send this message without a subject?')) return
    setSending(true)
    try {
      const data = new FormData()
      data.append('to', form.to)
      data.append('cc', showCc ? form.cc : '')
      data.append('bcc', showBcc ? form.bcc : '')
      data.append('subject', form.subject)
      data.append('body', form.body)
      if (form.replyUid) {
        data.append('reply_uid', String(form.replyUid))
        data.append('reply_folder', form.replyFolder ?? 'INBOX')
      }
      files.forEach((file) => data.append('attachments[]', file))
      await mailApi.send(data)
      onSent()
    } catch (err) {
      window.alert((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title={form.subject ? `${form.title}: ${form.subject}` : form.title}
      subtitle="Mail"
      onClose={onClose}
      size="lg"
      onSubmit={send}
      saving={sending}
      saveLabel="Send"
      footerLeft={(
        <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
          <Paperclip size={14} /> Attach
          <input type="file" multiple hidden onChange={(e) => { setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]); e.target.value = '' }} />
        </label>
      )}
    >
      <div className="tb-compose">
        <div className="tb-compose__row"><span className="tb-label">From</span><span className="tb-compose__from">{from}</span></div>
        <div className="tb-compose__row">
          <label className="tb-label" htmlFor="tb-to">To<Req /></label>
          <input id="tb-to" className="input" required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="name@example.com, another@example.com" autoFocus={!form.to} />
          <span className="tb-compose__toggles">
            {!showCc ? <button type="button" onClick={() => setShowCc(true)}>Cc</button> : null}
            {!showBcc ? <button type="button" onClick={() => setShowBcc(true)}>Bcc</button> : null}
          </span>
        </div>
        {showCc ? <div className="tb-compose__row"><label className="tb-label" htmlFor="tb-cc">Cc</label><input id="tb-cc" className="input" value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} /></div> : null}
        {showBcc ? <div className="tb-compose__row"><label className="tb-label" htmlFor="tb-bcc">Bcc</label><input id="tb-bcc" className="input" value={form.bcc} onChange={(e) => setForm({ ...form, bcc: e.target.value })} /></div> : null}
        <div className="tb-compose__row"><label className="tb-label" htmlFor="tb-subject">Subject</label><input id="tb-subject" className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
        <textarea className="input tb-compose__body" rows={16} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} autoFocus={Boolean(form.to)} aria-label="Message" />
        {files.length ? (
          <div className="tb-attachbar__list">
            {files.map((file, i) => (
              <span key={`${file.name}-${i}`} className="tb-attachment">
                <Paperclip size={13} /> <span>{file.name}</span> <small>{formatSize(file.size)}</small>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X size={13} /></button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function SettingsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<MailSettings>(DEFAULT_MAIL_SETTINGS)
  const [hasPassword, setHasPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    mailApi.settings().then(({ data }) => {
      if (data) { setForm({ ...DEFAULT_MAIL_SETTINGS, ...data, password: '' }); setHasPassword(true) }
    }).catch((e: Error) => setError(e.message))
  }, [])

  const set = <K extends keyof MailSettings>(key: K, value: MailSettings[K]) => setForm((f) => ({ ...f, [key]: value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      // cPanel mailboxes log in with the full email address as the username
      await mailApi.saveSettings({ ...form, username: form.email.trim() })
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const encryption = (key: 'imap_encryption' | 'smtp_encryption') => (
    <select className="input" value={form[key]} onChange={(e) => set(key, e.target.value as MailSettings[typeof key])}>
      <option value="ssl">SSL/TLS</option>
      <option value="tls">STARTTLS</option>
      <option value="none">None</option>
    </select>
  )

  return (
    <Modal title="Account Settings" subtitle="Office mailbox" onClose={onClose} size="lg" onSubmit={save} saving={saving} saveLabel="Test & save">
      <p className="tb-muted" style={{ margin: '0 0 14px' }}>
        Same details as Thunderbird (cPanel → Email Accounts → Connect Devices). NCRC logs in to check them before saving; the password is stored encrypted.
      </p>
      {error ? <p className="tb-error" style={{ margin: '0 0 12px' }}>{error}</p> : null}
      <div className="tb-settings-grid">
        <label><span>Email address<Req /></span><input className="input" type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
        <label><span>Password{hasPassword ? null : <Req />}</span><input className="input" type="password" autoComplete="new-password" required={!hasPassword} value={form.password ?? ''} onChange={(e) => set('password', e.target.value)} placeholder={hasPassword ? 'Leave blank to keep the saved password' : ''} /></label>
        <label><span>Incoming (IMAP) server<Req /></span><input className="input" required value={form.imap_host} onChange={(e) => set('imap_host', e.target.value)} /></label>
        <div className="tb-settings-pair">
          <label><span>Port<Req /></span><input className="input" type="number" required value={form.imap_port} onChange={(e) => set('imap_port', Number(e.target.value))} /></label>
          <label><span>Security</span>{encryption('imap_encryption')}</label>
        </div>
        <label><span>Outgoing (SMTP) server<Req /></span><input className="input" required value={form.smtp_host} onChange={(e) => set('smtp_host', e.target.value)} /></label>
        <div className="tb-settings-pair">
          <label><span>Port<Req /></span><input className="input" type="number" required value={form.smtp_port} onChange={(e) => set('smtp_port', Number(e.target.value))} /></label>
          <label><span>Security</span>{encryption('smtp_encryption')}</label>
        </div>
      </div>
    </Modal>
  )
}
