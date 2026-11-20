import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

/**
 * Date box that always shows dd-mm-yyyy (numbers only) on every PC, with our own calendar:
 * the header reads "Nov 2026"; the box itself is always numbers (19-11-2026).
 * value / onChange use yyyy-mm-dd (same as <input type="date">), '' when empty.
 */

interface DateInputProps {
  value: string
  onChange: (iso: string) => void
  ariaLabel?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  style?: CSSProperties
  className?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function isoToDmy(iso: string): string {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/** dd-mm-yyyy (also / or .) → yyyy-mm-dd; null when incomplete or not a real date. */
export function dmyToIso(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (!m) return null
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return toIso(y, mo - 1, d)
}

/** Auto-insert dashes while typing digits: 19112026 → 19-11-2026 */
function maskDigits(raw: string): string {
  if (/[^\d]/.test(raw)) return raw
  const d = raw.slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`
}

export function DateInput({ value, onChange, ariaLabel, placeholder = 'dd-mm-yyyy', required, disabled, style, className }: DateInputProps) {
  const [text, setText] = useState(() => isoToDmy(value))
  const [synced, setSynced] = useState(value)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Follow outside changes (e.g. Clear)
  if (value !== synced) {
    setSynced(value)
    if ((dmyToIso(text) ?? '') !== value) setText(isoToDmy(value))
  }

  const today = new Date()
  const selected = value ? new Date(`${value}T00:00:00`) : null
  const [view, setView] = useState(() => {
    const base = selected && !isNaN(selected.getTime()) ? selected : today
    return { y: base.getFullYear(), m: base.getMonth() }
  })

  const openCalendar = () => {
    if (disabled) return
    const base = selected && !isNaN(selected.getTime()) ? selected : today
    setView({ y: base.getFullYear(), m: base.getMonth() })
    setOpen(true)
  }

  // Place the calendar under the box (fixed, so table/scroll containers can't clip it)
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return
    const place = () => {
      const r = wrapRef.current!.getBoundingClientRect()
      const width = 260
      const height = popRef.current?.offsetHeight ?? 300
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
      const below = r.bottom + 4
      const top = below + height > window.innerHeight - 8 && r.top - height - 4 > 8 ? r.top - height - 4 : below
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const handleText = (raw: string) => {
    const next = maskDigits(raw)
    setText(next)
    if (next.trim() === '') { onChange(''); return }
    const iso = dmyToIso(next)
    if (iso) {
      onChange(iso)
      const d = new Date(`${iso}T00:00:00`)
      setView({ y: d.getFullYear(), m: d.getMonth() })
    }
  }

  const pick = (y: number, m: number, d: number) => {
    const iso = toIso(y, m, d)
    onChange(iso)
    setText(isoToDmy(iso))
    setOpen(false)
  }

  const shift = (months: number) => setView((v) => {
    const d = new Date(v.y, v.m + months, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  // Monday-first grid
  const first = new Date(view.y, view.m, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(view.y, view.m + 1, 0).getDate()
  const cells: Array<number | null> = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)

  const isSel = (d: number) => !!selected && selected.getFullYear() === view.y && selected.getMonth() === view.m && selected.getDate() === d
  const isToday = (d: number) => today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d

  return (
    <div ref={wrapRef} className={`date-input${className ? ` ${className}` : ''}`} style={style}>
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={ariaLabel}
        required={required}
        disabled={disabled}
        value={text}
        maxLength={10}
        onChange={(e) => handleText(e.target.value)}
        onBlur={() => { if (text && !dmyToIso(text)) setText(isoToDmy(value)) }}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && e.altKey) openCalendar() }}
      />
      <button type="button" className="date-input__btn" onClick={() => (open ? setOpen(false) : openCalendar())} disabled={disabled} aria-label="Open calendar" title="Open calendar">
        <CalendarDays size={15} />
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          className="date-cal"
          role="dialog"
          aria-label="Choose date"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
        >
          <div className="date-cal__head">
            <button type="button" onClick={() => shift(-12)} aria-label="Previous year" title="Previous year"><ChevronsLeft size={15} /></button>
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month" title="Previous month"><ChevronLeft size={15} /></button>
            <span className="date-cal__title">{MONTHS[view.m]} {view.y}</span>
            <button type="button" onClick={() => shift(1)} aria-label="Next month" title="Next month"><ChevronRight size={15} /></button>
            <button type="button" onClick={() => shift(12)} aria-label="Next year" title="Next year"><ChevronsRight size={15} /></button>
          </div>
          <div className="date-cal__grid">
            {WEEKDAYS.map((w) => <span key={w} className="date-cal__dow">{w}</span>)}
            {cells.map((d, i) => d === null ? <span key={`e${i}`} /> : (
              <button
                key={d}
                type="button"
                className={`date-cal__day${isSel(d) ? ' is-selected' : ''}${isToday(d) ? ' is-today' : ''}`}
                onClick={() => pick(view.y, view.m, d)}
                aria-label={`${pad(d)}-${pad(view.m + 1)}-${view.y}`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="date-cal__foot">
            <button type="button" onClick={() => pick(today.getFullYear(), today.getMonth(), today.getDate())}>Today</button>
            {value ? <button type="button" onClick={() => { onChange(''); setText(''); setOpen(false) }}>Clear</button> : null}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
