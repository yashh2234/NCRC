import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X } from 'lucide-react'
import { keepInside, usePopup } from '../lib/usePopup'

export interface MultiOption { value: string; label?: string; note?: string }

interface Props {
  options: MultiOption[]
  isChosen: (value: string) => boolean
  onToggle: (value: string) => void
  onClear?: () => void
  placeholder: string
  disabled?: boolean
  /** The chosen ones as chips that can be taken away, instead of one line of text */
  chips?: boolean
  emptyText?: string
  ariaLabel?: string
}

const SEARCH_FROM = 9

/** Dropdown with several choices (tick boxes), in the same look as Dropdown. */
export function MultiDropdown({ options, isChosen, onToggle, onClear, placeholder, disabled, chips, emptyText = 'Nothing to choose', ariaLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) boxRef.current?.focus()
  }
  const pos = usePopup(open && !disabled, close, boxRef, popRef, 260)
  const placed = pos !== null

  useEffect(() => {
    if (placed) (popRef.current?.querySelector('input') ?? popRef.current)?.focus({ preventScroll: true })
  }, [placed])

  const q = query.trim().toLowerCase()
  const chosen = options.filter((o) => isChosen(o.value))
  const shown = q ? options.filter((o) => (o.label ?? o.value).toLowerCase().includes(q)) : options

  return (
    <>
      <button ref={boxRef} type="button" disabled={disabled} className={`input dd-box${open ? ' dd-box--open' : ''}${chips ? ' dd-box--chips' : ''}`} aria-haspopup="listbox" aria-expanded={open}
        aria-label={ariaLabel} title={chips ? undefined : chosen.map((o) => o.label ?? o.value).join(', ')}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuery(''); setOpen((o) => !o) }}>
        {chosen.length === 0 ? <span className="dd-box__empty">{placeholder}</span> : chips ? (
          <span className="dd-chips">
            {chosen.map((o) => (
              <span key={o.value} className="dd-chip">
                {o.label ?? o.value}
                <span role="button" aria-label={`Remove ${o.label ?? o.value}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(o.value) }}><X size={12} /></span>
              </span>
            ))}
          </span>
        ) : <span>{chosen.map((o) => o.label ?? o.value).join(', ')}</span>}
        {!chips && chosen.length > 1 ? <span className="dd-count">{chosen.length}</span> : null}
        <ChevronDown size={16} />
      </button>
      {open && !disabled && pos ? createPortal(
        <div ref={popRef} className="dd-pop" style={pos} tabIndex={-1} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') e.preventDefault() }} {...keepInside}>
          {options.length >= SEARCH_FROM ? <div className="dd-search"><Search size={14} /><input className="input" value={query} placeholder="Search…" aria-label="Search" autoComplete="off" onChange={(e) => setQuery(e.target.value)} /></div> : null}
          <ul role="listbox" aria-multiselectable="true">
            {shown.map((o) => {
              const on = isChosen(o.value)
              return (
                <li key={o.value} role="option" aria-selected={on}>
                  <label className="dd-tick"><input type="checkbox" checked={on} onChange={() => onToggle(o.value)} /><span>{o.label ?? o.value}{o.note ? <small> {o.note}</small> : null}</span></label>
                </li>
              )
            })}
            {shown.length === 0 ? <li className="dd-none">{q ? 'No matches' : emptyText}</li> : null}
          </ul>
          {onClear && chosen.length ? <div className="dd-foot"><button type="button" className="hr-link" onClick={onClear}>Clear all</button></div> : null}
        </div>, document.body) : null}
    </>
  )
}
