import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { keepInside, usePopup } from '../lib/usePopup'

const OTHER = 'Other (type)'

interface Props {
  value: string
  options: string[]
  onChange: (v: string) => void
  ariaLabel?: string
  placeholder?: string
  required?: boolean
  /** The list ends with "Other (type)", which empties the box */
  other?: boolean
  onBlur?: () => void
  style?: CSSProperties
  inputStyle?: CSSProperties
}

/** A box you can type into or pick from; the list looks like the one of Dropdown. */
export function ComboInput({ value, options, onChange, ariaLabel, placeholder = 'Type here', required, other = true, onBlur, style, inputStyle }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState(false)
  const [at, setAt] = useState(-1)

  const q = value.trim().toLowerCase()
  const found = typed && q ? options.filter((o) => o.toLowerCase().includes(q)) : options
  // While typing a value of your own the list stays away; otherwise "Other" ends it
  const match = typed || !other ? found : [...found, OTHER]
  const visible = open && match.length > 0

  const close = () => setOpen(false)
  const pos = usePopup(visible, close, box, pop, 230)
  const show = () => {
    setTyped(false)
    setAt(options.indexOf(value))
    setOpen(true)
  }

  const placed = pos !== null
  useEffect(() => {
    if (placed) (list.current?.children[at] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' })
  }, [at, placed])

  const choose = (o: string) => {
    onChange(o === OTHER ? '' : o)
    close()
    if (o === OTHER) input.current?.focus()
  }

  return (
    <div ref={box} className="dd-combo" style={style}>
      <input
        ref={input} className="input" role="combobox" aria-expanded={visible} aria-label={ariaLabel} autoComplete="off" required={required}
        value={value} title={value} placeholder={placeholder} style={inputStyle}
        onClick={() => { if (!open) show() }}
        onChange={(e) => { setOpen(true); onChange(e.target.value); setTyped(true); setAt(-1) }}
        onBlur={() => { close(); onBlur?.() }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) show()
            else setAt((k) => Math.max(0, Math.min(match.length - 1, k + (e.key === 'ArrowDown' ? 1 : -1))))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (visible && match[at]) choose(match[at])
            else close()
          }
        }}
      />
      <ChevronDown size={16} />
      {visible && pos ? createPortal(
        <div ref={pop} className="dd-pop" style={pos} onClick={keepInside.onClick} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}>
          <ul ref={list} role="listbox">
            {match.map((o, k) => (
              <li key={o} role="option" aria-selected={o === value} className={k === at ? 'on' : undefined}
                // Before the box loses the focus
                onMouseDown={(e) => { e.preventDefault(); choose(o) }} onMouseMove={() => { if (k !== at) setAt(k) }}>
                <span>{o}</span>{o === value ? <Check size={15} /> : null}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
