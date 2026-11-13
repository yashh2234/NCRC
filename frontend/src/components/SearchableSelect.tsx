import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SearchableOption {
  value: string
  label: string
}

interface Props {
  value: string
  options: SearchableOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

/** A dropdown you can also type into to filter the options. */
export function SearchableSelect({ value, options, onChange, placeholder = 'Select...', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  const choose = (option: SearchableOption) => {
    onChange(option.value)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { if (open && filtered[highlight]) { e.preventDefault(); choose(filtered[highlight]) } }
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        value={open ? query : selectedLabel}
        placeholder={open ? (selectedLabel || 'Type to search...') : placeholder}
        disabled={disabled}
        onFocus={() => { setOpen(true); setQuery(''); setHighlight(0) }}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0) }}
        onKeyDown={onKeyDown}
        autoComplete="off"
        style={{ paddingRight: 32 }}
      />
      <ChevronDown size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--gray-500)' }} />
      {open && !disabled ? (
        <ul
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: 260, overflowY: 'auto',
            margin: 0, padding: 4, listStyle: 'none', background: '#fff', border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: '8px 10px', color: 'var(--gray-500)', fontSize: '0.82rem' }}>No matches</li>
          ) : filtered.map((option, index) => (
            <li
              key={option.value || '__empty'}
              role="option"
              aria-selected={option.value === value}
              onMouseDown={(e) => { e.preventDefault(); choose(option) }}
              onMouseEnter={() => setHighlight(index)}
              style={{
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
                background: index === highlight ? 'rgba(0,113,227,0.08)' : 'transparent',
                fontWeight: option.value === value ? 700 : 400,
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
