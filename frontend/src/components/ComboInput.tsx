import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

const LIST_HEIGHT = 240

const OTHER = 'Other (type)'

/**
 * A box you can type into or pick from: a short scrolling list right below it (above when there is no room).
 * The list is drawn over the page, so a scrolling table around the box never cuts it off.
 */
export function ComboInput({ value, options, onChange, ariaLabel }: { value: string; options: string[]; onChange: (v: string) => void; ariaLabel?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)
  const [typed, setTyped] = useState(false)
  const [at, setAt] = useState(-1)

  const shown = place !== null
  const found = typed && value.trim() ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase())) : options
  // While typing a value of your own the list stays away; otherwise "Other" ends it
  const match = typed ? found : [...found, OTHER]

  /** Under the box, also while the page scrolls; gone when the box is out of view */
  const locate = () => {
    const r = box.current?.getBoundingClientRect()
    if (!r || r.bottom < 0 || r.top > window.innerHeight) { setPlace(null); return }
    const below = window.innerHeight - r.bottom
    const width = Math.max(r.width, 230)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    setPlace(below >= LIST_HEIGHT + 12 || below >= r.top ? { left, width, top: r.bottom + 4 } : { left, width, bottom: window.innerHeight - r.top + 4 })
  }
  const open = () => {
    locate()
    setTyped(false)
    setAt(options.indexOf(value))
  }
  const close = () => setPlace(null)

  useEffect(() => {
    if (!place) return
    const outside = (e: Event) => {
      const n = e.target as Node
      if (!box.current?.contains(n) && !list.current?.contains(n)) setPlace(null)
    }
    document.addEventListener('mousedown', outside)
    const scrolled = (e: Event) => { if (e.target !== list.current) locate() }
    document.addEventListener('scroll', scrolled, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('scroll', scrolled, true)
      window.removeEventListener('resize', close)
    }
  }, [place])

  useEffect(() => {
    (list.current?.children[at] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' })
  }, [at, shown])

  /** "Other" empties the box to type in it */
  const choose = (o: string) => {
    onChange(o === OTHER ? '' : o)
    close()
    if (o === OTHER) box.current?.querySelector('input')?.focus()
  }

  return (
    <div ref={box} style={{ position: 'relative', width: '100%', minWidth: 170 }}>
      <input
        className="input" role="combobox" aria-expanded={!!place} aria-label={ariaLabel} autoComplete="off"
        value={value} title={value} placeholder="Type here"
        onClick={() => { if (!place) open() }}
        onChange={(e) => { if (!place) open(); onChange(e.target.value); setTyped(true); setAt(-1) }}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!place) open()
            else setAt((k) => Math.max(0, Math.min(match.length - 1, k + (e.key === 'ArrowDown' ? 1 : -1))))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (place && match[at]) choose(match[at])
            else close()
          } else if (e.key === 'Escape') close()
        }}
        style={{ width: '100%', padding: '8px 28px 8px 10px', fontSize: '0.84rem', textAlign: 'left' }}
      />
      <ChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
      {place && match.length ? createPortal(
        <ul
          ref={list} role="listbox"
          style={{ position: 'fixed', zIndex: 400, left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: LIST_HEIGHT, overflowY: 'auto', margin: 0, padding: 4, listStyle: 'none', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}
        >
          {match.map((o, k) => (
            <li key={o} role="option" aria-selected={o === value} onMouseDown={(e) => { e.preventDefault(); choose(o) }} onMouseEnter={() => setAt(k)}
              style={{ padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', color: '#0f172a', background: k === at ? '#eff4ff' : 'transparent', fontWeight: o === value ? 700 : 400 }}>
              {o}
            </li>
          ))}
        </ul>,
        document.body,
      ) : null}
    </div>
  )
}
