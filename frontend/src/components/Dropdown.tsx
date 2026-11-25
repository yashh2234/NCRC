import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { keepInside, usePopup } from '../lib/usePopup'

export interface DropdownOption {
  value: string
  label: string
  disabled?: boolean
  /** Heading above the options of one group */
  group?: string
}

interface Props {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  ariaLabel?: string
  /** Shown in grey while the value is empty; without it the empty option's label is shown like any other */
  placeholder?: string
  /** A filter that is set is shown in blue */
  filter?: boolean
  disabled?: boolean
  /** The form cannot be sent while the value is empty */
  required?: boolean
  /** A search box also above a short list */
  searchable?: boolean
  className?: string
  style?: CSSProperties
  title?: string
  id?: string
}

/** Lists this long get a search box */
const SEARCH_FROM = 9

/** Next option that can be chosen, from `at` in steps of `by`; `at - by` when there is none */
function nextEnabled(options: DropdownOption[], at: number, by: 1 | -1): number {
  for (let i = at; i >= 0 && i < options.length; i += by) if (!options[i].disabled) return i
  return at - by
}

/** The dropdown of the software. `Select` takes the same children as a <select>. */
export function Dropdown({ value, options, onChange, ariaLabel, placeholder, filter, disabled, required, searchable, className, style, title, id }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })

  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  const selected = options.find((o) => o.value === value)
  const search = searchable ?? options.length >= SEARCH_FROM

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) boxRef.current?.focus()
  }
  const pos = usePopup(open, close, boxRef, popRef)
  const placed = pos !== null

  const show = () => {
    if (disabled) return
    setQuery('')
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const choose = (o: DropdownOption | undefined) => {
    if (!o || o.disabled) return
    close(true)
    if (o.value !== value) onChange(o.value)
  }

  useEffect(() => {
    if (placed) (popRef.current?.querySelector('input') ?? popRef.current)?.focus({ preventScroll: true })
  }, [placed])
  useEffect(() => {
    if (placed) listRef.current?.querySelector('li.on')?.scrollIntoView({ block: 'nearest' })
  }, [active, placed])

  /** Typing letters goes to the option that starts with them, like in a browser's own list */
  const jump = (key: string): number => {
    const now = Date.now()
    typed.current = { text: now - typed.current.at < 800 ? typed.current.text + key.toLowerCase() : key.toLowerCase(), at: now }
    return options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text))
  }
  const isLetter = (e: KeyboardEvent) => e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey

  const listKeys = (e: KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => nextEnabled(shown, a + 1, 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, nextEnabled(shown, a - 1, -1))) }
    else if (e.key === 'Enter' || (e.key === ' ' && !search)) { e.preventDefault(); choose(shown[active]) }
    else if (e.key === 'Tab') close(true)
    else if (!search && isLetter(e)) { const i = jump(e.key); if (i >= 0) setActive(i) }
  }
  const boxKeys = (e: KeyboardEvent) => {
    if (open) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); show() }
    else if (isLetter(e)) {
      const i = jump(e.key)
      if (i < 0) return
      e.preventDefault()
      e.stopPropagation()
      if (options[i].value !== value) onChange(options[i].value)
    }
  }

  // An id that is not in the list (not loaded yet, deleted) says nothing; a text of earlier days is shown as it is
  const unknownId = !selected && /^\d+$/.test(value) && (value === '0' || options.length === 0 || options.some((o) => o.label !== o.value))
  const text = selected?.label || (unknownId ? '' : value) || placeholder || 'Select…'
  const grey = (!selected && (!value || unknownId)) || (!value && placeholder !== undefined)

  const box = (
    <button ref={boxRef} type="button" id={id} disabled={disabled} style={required ? undefined : style}
      className={`${className || 'input'} dd-box${open ? ' dd-box--open' : ''}${filter && value ? ' dd-box--set' : ''}`}
      title={title ?? selected?.label} aria-label={ariaLabel ? `${ariaLabel}: ${text}` : undefined} aria-haspopup="listbox" aria-expanded={open}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (open) close(true); else show() }} onKeyDown={boxKeys}>
      <span className={grey ? 'dd-box__empty' : undefined}>{!value && placeholder ? placeholder : text}</span>
      <ChevronDown size={16} />
    </button>
  )

  return (
    <>
      {required ? (
        <span className="dd-wrap" style={style}>
          {box}
          {/* Lets the browser say that the choice is missing when the form is sent */}
          <input className="dd-required" tabIndex={-1} aria-hidden="true" value={value} onChange={() => undefined} disabled={disabled}
            ref={(el) => { el?.setCustomValidity(value ? '' : 'Please choose an option.') }} onFocus={() => boxRef.current?.focus()} />
        </span>
      ) : box}
      {open && pos ? createPortal(
        <div ref={popRef} className="dd-pop" style={pos} tabIndex={-1} onKeyDown={listKeys} {...keepInside}>
          {search ? (
            <div className="dd-search"><Search size={14} /><input className="input" value={query} placeholder="Search…" aria-label="Search" autoComplete="off"
              onChange={(e) => { setQuery(e.target.value); setActive(0) }} /></div>
          ) : null}
          <ul ref={listRef} role="listbox" aria-label={ariaLabel}>
            {shown.map((o, i) => [
              o.group && o.group !== shown[i - 1]?.group ? <li key={`g-${o.group}`} role="presentation" className="dd-group">{o.group}</li> : null,
              <li key={`${o.value}-${i}`} role="option" aria-selected={o.value === value} aria-disabled={o.disabled || undefined} className={i === active ? 'on' : undefined}
                onMouseMove={() => { if (!o.disabled && i !== active) setActive(i) }} onClick={() => choose(o)}>
                <span>{o.label || '—'}</span>{o.value === value ? <Check size={15} /> : null}
              </li>,
            ])}
            {shown.length === 0 ? <li className="dd-none">No matches</li> : null}
          </ul>
        </div>, document.body) : null}
    </>
  )
}
