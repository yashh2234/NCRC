import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft, Inbox, Send, FileText, Archive, AlertOctagon, Trash2, Folder, PenSquare, RefreshCw, UserPlus,
  Search, Reply, ReplyAll, Forward, Paperclip, Download, X, Mail, Star, CheckCircle2, AlertTriangle, Loader2, ChevronDown, ChevronLeft, ChevronRight,
  Columns2, Rows2, Filter, CornerUpLeft, Circle,
} from 'lucide-react'
import { MailAccountDialog, MailAccountMenu } from '../components/MailAccounts'
import { MailCompose, type MailDraft } from '../components/MailCompose'
import { useAuth } from '../lib/auth'
import {
  mailApi, defaultBcc, formatAddress, formatListDate, formatSize, setOpenMailAccount,
  type MailAccount, type MailFilter, type MailFolder, type MailMessage, type MailSummary, type OutboxMail,
} from '../lib/mail'
import { MAIL_COMPOSE } from '../lib/mailTab'
import { draftHtml, forwardHtml, newMailHtml, replyHtml } from '../lib/mailCompose'
import { Select } from '../components/Select'

type Layout = 'classic' | 'vertical'

const FOLDER_ICONS: Record<MailFolder['role'], typeof Inbox> = {
  inbox: Inbox, sent: Send, drafts: FileText, archive: Archive, junk: AlertOctagon, trash: Trash2, other: Folder,
}
const FOLDER_LABELS: Partial<Record<MailFolder['role'], string>> = {
  inbox: 'Inbox', sent: 'Sent', drafts: 'Drafts', archive: 'Archives', junk: 'Junk', trash: 'Trash',
}
const LAYOUT_KEY = 'ncrc_mail_layout'
const AUTO_CHECK_MS = 2 * 60 * 1000

function folderLabel(f: MailFolder) {
  return (f.depth === 0 || f.role !== 'other') && FOLDER_LABELS[f.role] ? FOLDER_LABELS[f.role]! : f.name
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

interface MailboxProps {
  account: MailAccount
  appbar: React.ReactNode
  /** A dialog of the account menu is open: no keyboard shortcuts */
  blocked: boolean
  /** Grows when a mail has gone out, so the open folder is loaded again */
  sentCount: number
  onQueued: (mail: OutboxMail) => void
  /** A mail made ready elsewhere (quotation), to be checked and sent */
  prepared: MailDraft | null
  onPreparedOpened: () => void
}

/** One account: folders, messages, reading and writing */
function Mailbox({ account, appbar, blocked, sentCount, onQueued, prepared, onPreparedOpened }: MailboxProps) {
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
  const [draft, setDraft] = useState<MailDraft | null>(null)
  const [checking, setChecking] = useState(false)
  const [layout, setLayout] = useState<Layout>(() => {
    try { return localStorage.getItem(LAYOUT_KEY) === 'vertical' ? 'vertical' : 'classic' } catch { return 'classic' }
  })

  useEffect(() => {
    if (!prepared) return
    setDraft((open) => open ?? { ...prepared, bcc: defaultBcc(account, prepared.to) })
    onPreparedOpened()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared])

  const changeLayout = (next: Layout) => {
    setLayout(next)
    try { localStorage.setItem(LAYOUT_KEY, next) } catch { /* ignore */ }
  }

  const loadFolders = useCallback(() => mailApi.folders().then(({ data }) => setFolders(data)).catch(() => undefined), [])

  const loadList = useCallback((quiet = false) => {
    if (!quiet) setListLoading(true)
    setListError('')
    return mailApi.messages(folder, page, search, filter)
      .then((res) => { setList(res.data); setTotal(res.total); setPerPage(res.per_page) })
      .catch((e: Error) => { if (!quiet) { setList([]); setTotal(0) } setListError(e.message) })
      .finally(() => setListLoading(false))
  }, [folder, page, search, filter])

  useEffect(() => { void loadFolders() }, [loadFolders])
  useEffect(() => { void loadList() }, [loadList])

  const getMessages = useCallback(async () => {
    setChecking(true)
    await Promise.all([loadFolders(), loadList(true)])
    setChecking(false)
  }, [loadFolders, loadList])

  // Check for new mail every couple of minutes while the page is visible, like Thunderbird's auto-check
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void getMessages()
    }, AUTO_CHECK_MS)
    return () => window.clearInterval(timer)
  }, [getMessages])

  // A mail went out: Sent and the counts have changed
  const refresh = useRef(getMessages)
  useEffect(() => { refresh.current = getMessages }, [getMessages])
  useEffect(() => { if (sentCount > 0) void refresh.current() }, [sentCount])

  const visibleList = useMemo(() => onlyAttachments ? list.filter((m) => m.has_attachment) : list, [list, onlyAttachments])
  const currentFolder = folders.find((f) => f.path === folder)
  const isDrafts = currentFolder?.role === 'drafts'
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

  const ownEmail = account.email.toLowerCase()
  const newMail = () => setDraft({ title: 'Write', to: '', cc: '', bcc: defaultBcc(account), subject: '', html: newMailHtml(), kept: [] })
  const reply = (all: boolean) => {
    if (!message) return
    const primary = message.reply_to[0] ?? message.from
    const others = all
      ? [...message.to, ...message.cc].filter((a) => a.email.toLowerCase() !== ownEmail && a.email !== primary?.email)
      : []
    const to = formatAddress(primary)
    const cc = others.map(formatAddress).join(', ')
    setDraft({
      title: all ? 'Reply All' : 'Reply',
      to,
      cc,
      bcc: defaultBcc(account, to, cc),
      subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`,
      html: replyHtml(message),
      kept: [],
      replyUid: message.uid,
      replyFolder: folder,
    })
  }
  const forward = () => {
    if (!message) return
    setDraft({
      title: 'Forward', to: '', cc: '', bcc: defaultBcc(account),
      subject: /^fwd?:/i.test(message.subject) ? message.subject : `Fwd: ${message.subject}`,
      html: forwardHtml(message),
      kept: message.attachments.map((a) => ({ ...a, folder, uid: message.uid })),
    })
  }
  const editDraft = () => {
    if (!message) return
    setDraft({
      title: 'Draft',
      to: message.to.map(formatAddress).join(', '),
      cc: message.cc.map(formatAddress).join(', '),
      bcc: message.bcc.map(formatAddress).join(', '),
      subject: message.subject === '(no subject)' ? '' : message.subject,
      html: draftHtml(message),
      kept: message.attachments.map((a) => ({ ...a, folder, uid: message.uid })),
      draftUid: message.uid,
    })
  }
  /** A draft gets a new number every time it is saved, and is gone once sent */
  const draftsChanged = () => {
    if (isDrafts) { setSelectedUid(null); setMessage(null) }
    void getMessages()
  }

  // Thunderbird keyboard shortcuts
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => undefined)
  keyHandler.current = (e: KeyboardEvent) => {
    if (blocked || draft || isTyping(e.target)) return
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
          <div className="tb-account"><ChevronDown size={14} /> <Mail size={15} /> <span title={account.email}>{account.email}</span></div>
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
          <Select className="tb-folder-select" value={folder} onChange={(e) => changeFolder(e.target.value)} aria-label="Folder">
            {(folders.length ? folders : [{ path: 'INBOX', name: 'Inbox', role: 'inbox' } as MailFolder]).map((f) => (
              <option key={f.path} value={f.path}>{folderLabel(f)}{f.unread ? ` (${f.unread})` : ''}</option>
            ))}
          </Select>
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
                      {isDrafts ? <button type="button" onClick={editDraft} title="Continue writing this draft"><PenSquare size={15} /> <span>Edit draft</span></button> : null}
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
                    {message.bcc.length ? <div><span className="tb-label">Bcc</span> {message.bcc.map(formatAddress).join(', ')}</div> : null}
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
                        <button type="button" className="tb-tool" onClick={() => message.attachments.forEach((a) => void mailApi.downloadAttachment(folder, message.uid, a.part, a.name).catch(() => undefined))}>
                          <Download size={14} /> <span>Save All</span>
                        </button>
                      ) : null}
                    </div>
                    <div className="tb-attachbar__list">
                      {message.attachments.map((a) => (
                        <button key={a.part} type="button" className="tb-attachment" onClick={() => void mailApi.downloadAttachment(folder, message.uid, a.part, a.name).catch((e: Error) => window.alert(e.message))} title={`Save ${a.name}`}>
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
        <span>{checking ? 'Checking for new messages…' : listError ? 'Not connected' : `Connected · ${account.email}`}</span>
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

      {draft ? (
        <MailCompose
          draft={draft}
          from={account.email}
          onClose={() => setDraft(null)}
          onQueued={(mail) => { setDraft(null); if (isDrafts) { setSelectedUid(null); setMessage(null) } onQueued(mail) }}
          onDraftSaved={draftsChanged}
        />
      ) : null}
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

const ACCOUNT_KEY = 'ncrc_mail_account'
/** How long the page watches a mail that is still on its way; the server goes on without it */
const WATCH_MS = 15 * 60 * 1000

/** Mail: the account menu on top, the chosen account below, and what is being sent in the background */
export function MailPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const storageKey = `${ACCOUNT_KEY}_${user?.id ?? ''}`
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null)
  const [canShare, setCanShare] = useState(false)
  const [newBcc, setNewBcc] = useState('')
  const [loadError, setLoadError] = useState('')
  const [currentId, setCurrentId] = useState<number | null>(() => {
    try { return Number(localStorage.getItem(storageKey)) || null } catch { return null }
  })
  /** Account dialog: 'new', or the id to change */
  const [dialog, setDialog] = useState<'new' | number | null>(null)
  const [sends, setSends] = useState<OutboxMail[]>([])
  const [sentCount, setSentCount] = useState(0)

  const loadAccounts = useCallback(() => mailApi.accounts()
    .then((res) => {
      setAccounts(res.data)
      setCanShare(res.can_share)
      setNewBcc(res.default_bcc)
      setLoadError('')
    })
    .catch((e: Error) => setLoadError(e.message)), [])
  useEffect(() => { void loadAccounts() }, [loadAccounts])

  const current = accounts?.find((a) => a.id === currentId) ?? accounts?.[0] ?? null
  // Before the mailbox below loads anything: every request goes to this account
  setOpenMailAccount(current?.id ?? null)

  const open = (id: number) => {
    setCurrentId(id)
    try { localStorage.setItem(storageKey, String(id)) } catch { /* ignore */ }
  }

  // #mail?quotation=… / ?doc=…: a mail with that document as PDF
  const [prepared, setPrepared] = useState<MailDraft | null>(null)
  const [preparing, setPreparing] = useState(Boolean(MAIL_COMPOSE))
  const [prepareError, setPrepareError] = useState('')
  useEffect(() => {
    if (!MAIL_COMPOSE) return
    const compose = MAIL_COMPOSE
    let wanted = true
    const ready = 'quotationId' in compose
      ? import('../lib/quotationMail').then((m) => m.quotationDraft(compose.quotationId, compose.sign))
      : import('../lib/documentMail').then((m) => m.documentDraft(compose))
    ready
      .then((ready) => { if (wanted) setPrepared(ready) })
      .catch((e: Error) => { if (wanted) setPrepareError(e.message || 'The document could not be prepared.') })
      .finally(() => { if (wanted) setPreparing(false) })
    return () => { wanted = false }
  }, [])
  const preparedOpened = () => {
    setPrepared(null)
    // Reloading this tab must not write the same mail again
    window.history.replaceState(null, '', '#mail')
  }

  const updateSend = (mail: OutboxMail) => setSends((list) => list.map((m) => (m.id === mail.id ? mail : m)))
  const dropSend = (id: number) => setSends((list) => list.filter((m) => m.id !== id))

  const sendNow = async (queued: OutboxMail) => {
    setSends((list) => [...list, queued])
    const started = Date.now()
    let mail = queued
    // The answer may be lost on the way; what counts is what the server says about the mail
    try { mail = await mailApi.runOutbox(queued.id) } catch { /* ask below */ }
    while ((mail.status === 'queued' || mail.status === 'sending') && Date.now() - started < WATCH_MS) {
      updateSend(mail)
      await new Promise((resolve) => window.setTimeout(resolve, 5000))
      try { mail = await mailApi.outbox(queued.id) } catch { /* try again */ }
    }
    updateSend(mail)
    setSentCount((n) => n + 1)
    if (mail.status === 'sent') window.setTimeout(() => dropSend(mail.id), 6000)
  }

  // Leaving the site while a mail is still being handed over: the server sends it, but the result would not be seen
  const sending = sends.some((m) => m.status === 'queued' || m.status === 'sending')

  const appbar = (
    <header className="tb-appbar">
      <button type="button" className="tb-back" onClick={onBack}>
        <ArrowLeft size={16} /> Back to NCRC
      </button>
      <div className="tb-brand">
        <img className="tb-logo" src={`${import.meta.env.BASE_URL}namotech-logo.png`} alt="Namotech Consultancy" />
        <span className="tb-appname"><Mail size={16} /> Mail</span>
      </div>
      <div className="tb-appbar__end">
        {accounts && current ? (
          <MailAccountMenu accounts={accounts} current={current} onSwitch={open} onAdd={() => setDialog('new')} onSettings={() => setDialog(current.id)} />
        ) : null}
      </div>
    </header>
  )

  return (
    <>
      {current ? (
        <Mailbox key={current.id} account={current} appbar={appbar} blocked={dialog !== null} sentCount={sentCount} onQueued={(mail) => void sendNow(mail)} prepared={prepared} onPreparedOpened={preparedOpened} />
      ) : (
        <div className="tb-app">
          {appbar}
          <div className="tb-setup">
            <Mail size={40} />
            {loadError ? <p>{loadError}</p> : !accounts ? <p>Loading…</p> : (
              <>
                <h2>No mail account yet</h2>
                <p>{canShare ? 'Add the office mailbox once; everyone with Mail access can then read and send from it here.' : 'Add your own mail account, or ask an administrator to add the office mailbox.'}</p>
                <button type="button" className="btn btn-primary" onClick={() => setDialog('new')}><UserPlus size={15} /> Add account</button>
              </>
            )}
          </div>
        </div>
      )}

      {sends.length || preparing || prepareError ? (
        <div className="tb-sends" role="status">
          {preparing ? <div className="tb-send"><Loader2 size={16} className="tb-spin" /><span><strong>Preparing the PDF…</strong></span></div> : null}
          {prepareError ? (
            <div className="tb-send tb-send--failed">
              <AlertTriangle size={16} /><span><strong>The document could not be attached.</strong><small>{prepareError}</small></span>
              <button type="button" aria-label="Close" onClick={() => setPrepareError('')}><X size={14} /></button>
            </div>
          ) : null}
          {sends.map((m) => (
            <div key={m.id} className={`tb-send tb-send--${m.status}`}>
              {m.status === 'sent' ? <CheckCircle2 size={16} /> : m.status === 'failed' ? <AlertTriangle size={16} /> : <Loader2 size={16} className="tb-spin" />}
              <span>
                <strong>{m.status === 'sent' ? 'Sent' : m.status === 'failed' ? 'Not sent' : m.error ? 'Trying again…' : 'Sending…'}</strong> {m.subject || '(no subject)'}
                {m.status === 'failed' ? <small>{m.error}{m.in_drafts ? ' The mail is in Drafts.' : ' The mail is kept and will be put in Drafts.'}</small> : null}
                {m.status === 'sent' && !m.in_sent ? <small>A copy could not be saved in the Sent folder.</small> : null}
              </span>
              {m.status === 'failed' || m.status === 'sent' ? <button type="button" aria-label="Close" onClick={() => dropSend(m.id)}><X size={14} /></button> : null}
            </div>
          ))}
          {sending ? <p className="tb-sends__hint">You can go on working.</p> : null}
        </div>
      ) : null}

      {dialog !== null ? (
        <MailAccountDialog
          key={String(dialog)}
          id={dialog === 'new' ? null : dialog}
          canShare={canShare}
          first={!accounts?.length}
          defaultBcc={newBcc}
          onClose={() => setDialog(null)}
          onSaved={(id) => { setDialog(null); void loadAccounts().then(() => open(id)) }}
          onRemoved={() => { setDialog(null); void loadAccounts() }}
        />
      ) : null}
    </>
  )
}
