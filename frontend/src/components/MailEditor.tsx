import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Bold, Italic, Link2, List, ListOrdered, Redo2, RemoveFormatting, Underline, Undo2 } from 'lucide-react'
import { cleanHtml } from '../lib/mailCompose'
import { mailImage } from '../lib/mailImage'

export interface MailEditorHandle {
  getHtml: () => string
  focus: () => void
}

interface MailEditorProps {
  /** Starting text; must already be safe (built by lib/mailCompose) */
  initialHtml: string
  autoFocus?: boolean
  onChange: () => void
}

/**
 * Formatted text box. The text lives in its own frame, so the app's styles do not change how the mail
 * looks (what is typed is what is sent) and nothing in a quoted mail can run or reach the app.
 */
const FRAME = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'">
<style>html{height:100%}body{min-height:100%;box-sizing:border-box;margin:0;padding:12px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1a;overflow-wrap:break-word;outline:none}img{max-width:100%}</style>
</head><body></body></html>`

const MAX_IMAGE = 20 * 1024 * 1024

export const MailEditor = forwardRef<MailEditorHandle, MailEditorProps>(function MailEditor({ initialHtml, autoFocus = false, onChange }, ref) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [active, setActive] = useState<Record<string, boolean>>({})
  const changed = useRef(onChange)
  useEffect(() => { changed.current = onChange }, [onChange])
  // The frame is filled once; later renders must not replace what has been typed
  const start = useMemo(() => ({ html: initialHtml, autoFocus }), []) // eslint-disable-line react-hooks/exhaustive-deps

  const doc = () => frameRef.current?.contentDocument ?? null

  const focus = useCallback(() => {
    frameRef.current?.contentWindow?.focus()
    doc()?.body.focus()
  }, [])

  useImperativeHandle(ref, () => ({ getHtml: () => doc()?.body.innerHTML ?? '', focus }), [focus])

  const refreshButtons = useCallback(() => {
    const d = doc()
    if (!d) return
    setActive(Object.fromEntries(['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'].map((c) => [c, d.queryCommandState(c)])))
  }, [])

  const run = (command: string, value?: string) => {
    const d = doc()
    if (!d) return
    focus()
    d.execCommand(command, false, value)
    refreshButtons()
    changed.current()
  }

  const insertImages = (files: File[]) => {
    files.forEach((file) => {
      if (file.size > MAX_IMAGE) { window.alert(`${file.name || 'The picture'} is larger than 20 MB. Attach it instead.`); return }
      mailImage(file).then((src) => {
        doc()?.execCommand('insertHTML', false, cleanHtml(`<img src="${src}" alt="" style="max-width:100%">`))
        changed.current()
      }).catch((e: Error) => window.alert(e.message))
    })
  }

  const onLoad = () => {
    const d = doc()
    if (!d || d.body.isContentEditable) return
    d.body.innerHTML = start.html
    d.body.contentEditable = 'true'
    d.body.setAttribute('role', 'textbox')
    d.body.setAttribute('aria-multiline', 'true')
    d.body.setAttribute('aria-label', 'Message')
    d.execCommand('defaultParagraphSeparator', false, 'div')
    d.addEventListener('input', () => changed.current())
    d.addEventListener('selectionchange', refreshButtons)
    // Links in the text are only text here: opening them would replace the frame
    d.addEventListener('click', (e) => { if ((e.target as Element | null)?.closest?.('a')) e.preventDefault() })
    d.addEventListener('paste', (e) => {
      const data = e.clipboardData
      if (!data) return
      const html = data.getData('text/html')
      const images = Array.from(data.files).filter((f) => /^image\/(png|jpeg|gif|webp)$/.test(f.type))
      if (images.length && !html) {
        e.preventDefault()
        insertImages(images)
      } else if (html) {
        e.preventDefault()
        d.execCommand('insertHTML', false, cleanHtml(html))
      }
    })
    d.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer?.files ?? [])
      const html = e.dataTransfer?.getData('text/html')
      if (!files.length && !html) return
      e.preventDefault()
      const images = files.filter((f) => /^image\/(png|jpeg|gif|webp)$/.test(f.type))
      if (images.length) insertImages(images)
      else if (html) d.execCommand('insertHTML', false, cleanHtml(html))
    })
    if (start.autoFocus) {
      focus()
      d.getSelection()?.collapse(d.body.firstElementChild ?? d.body, 0)
    }
  }

  const addLink = () => {
    const d = doc()
    if (!d) return
    const selection = d.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
    const typed = window.prompt('Link address', 'https://')?.trim()
    if (!typed || typed === 'https://') return
    const href = /^(https?:|mailto:|tel:)/i.test(typed) ? typed : typed.includes('@') && !typed.includes('/') ? `mailto:${typed}` : `https://${typed.replace(/^[a-z]+:/i, '')}`
    focus()
    if (range) { selection?.removeAllRanges(); selection?.addRange(range) }
    if (!range || range.collapsed) {
      const a = d.createElement('a')
      a.href = href
      a.textContent = typed
      run('insertHTML', cleanHtml(a.outerHTML))
    } else run('createLink', href)
  }

  const button = (command: string, label: string, Icon: typeof Bold, action?: () => void) => (
    <button key={command} type="button" title={label} aria-label={label} aria-pressed={active[command] ?? undefined} className={active[command] ? 'active' : ''}
      onMouseDown={(e) => e.preventDefault()} onClick={() => (action ? action() : run(command))}>
      <Icon size={15} />
    </button>
  )

  return (
    <div className="tb-editor">
      <div className="tb-editor__bar" role="toolbar" aria-label="Formatting">
        {button('bold', 'Bold (Ctrl+B)', Bold)}
        {button('italic', 'Italic (Ctrl+I)', Italic)}
        {button('underline', 'Underline (Ctrl+U)', Underline)}
        <span className="tb-editor__sep" />
        {button('insertUnorderedList', 'Bullet list', List)}
        {button('insertOrderedList', 'Numbered list', ListOrdered)}
        {button('link', 'Add link', Link2, addLink)}
        <span className="tb-editor__sep" />
        {button('removeFormat', 'Clear formatting', RemoveFormatting)}
        {button('undo', 'Undo (Ctrl+Z)', Undo2)}
        {button('redo', 'Redo (Ctrl+Y)', Redo2)}
      </div>
      <iframe ref={frameRef} className="tb-editor__frame" title="Message" srcDoc={FRAME} onLoad={onLoad} />
    </div>
  )
})
