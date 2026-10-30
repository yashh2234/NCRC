import { useState, useEffect, useRef, type ReactNode } from 'react'
import { X, User, Building2, Layers } from 'lucide-react'
import { request } from '../lib/api'

// ─── StatusBadge ──────────────────────────────────────────
interface StatusBadgeProps {
  status?: string
  size?: 'sm' | 'md'
  color?: string
  children?: ReactNode
  priority?: string
}

const BADGE_COLORS: Record<string, string> = {
  draft: '#6b7280', pending: '#e8a838', in_progress: '#3b82f6',
  active: '#10b981', completed: '#22c55e', cancelled: '#ef4444',
  approved: '#065f46', locked: '#1e40af', under_review: '#92400e',
  failed: '#9d174d', overdue: '#ef4444',
  low: '#6b7280', normal: '#3b82f6', high: '#f59e0b', urgent: '#ef4444',
}

export function StatusBadge({ status, size = 'md', color, children, priority }: StatusBadgeProps) {
  const finalColor = color ?? (priority ? BADGE_COLORS[priority] : (status ? BADGE_COLORS[status] : '#6b7280'))
  const display = children ?? (status ? status.replace(/_/g, ' ') : (priority ?? ''))
  const fs = size === 'sm' ? '0.7rem' : '0.78rem'
  const py = size === 'sm' ? '2px' : '4px'
  return (
    <span className="sync-pill" style={{ background: `${finalColor}18`, color: finalColor, fontSize: fs, padding: `${py} 10px` }}>
      {display}
    </span>
  )
}

// ─── FormField ────────────────────────────────────────────
interface FormFieldProps {
  label: string
  error?: string
  children: ReactNode
  required?: boolean
  style?: React.CSSProperties
  description?: string
}

export function FormField({ label, error, children, required, style, description }: FormFieldProps) {
  return (
    <label style={{ display: 'block', marginBottom: 14, ...style }}>
      <span style={{ display: 'block', fontWeight: 500, fontSize: '0.8rem', color: 'var(--gray-700)', marginBottom: 6 }}>
        {label} {required ? <span style={{ color: 'var(--color-red)', marginLeft: 2 }}>*</span> : null}
      </span>
      {children}
      {description ? <span style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 4, display: 'block' }}>{description}</span> : null}
      {error ? <span style={{ fontSize: '0.72rem', color: 'var(--color-red-text)', marginTop: 4, display: 'block', fontWeight: 500 }}>{error}</span> : null}
    </label>
  )
}

// ─── Selector base ────────────────────────────────────────
interface SelectorProps {
  value: number | null
  onChange: (id: number | null) => void
  placeholder?: string
  disabled?: boolean
}

// ─── ClientSelector ───────────────────────────────────────
interface ClientItem { id: number; company_name: string; email?: string; mobile?: string }

export function ClientSelector({ value, onChange, placeholder = 'Select client', disabled }: SelectorProps) {
  const [items, setItems] = useState<ClientItem[]>([])
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = items.find(i => i.id === value)

  useEffect(() => {
    request<ClientItem[] | { data: ClientItem[] }>('/clients/list').then(d => setItems(Array.isArray(d) ? d : d.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  const filtered = q ? items.filter(i => i.company_name.toLowerCase().includes(q.toLowerCase())) : items

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => !disabled && setOpen(!open)} className={`combo-trigger${disabled ? ' is-disabled' : ''}${open ? ' is-open' : ''}`}>
        <Building2 size={15} className="combo-icon" />
        <span className={selected ? 'combo-value' : 'combo-value is-placeholder'}>{selected ? selected.company_name : placeholder}</span>
        {value ? <X size={14} className="combo-clear" onClick={(e) => { e.stopPropagation(); onChange(null) }} /> : null}
      </div>
      {open ? (
        <div className="combo-menu">
          <div className="combo-search">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." autoFocus />
          </div>
          {filtered.map(item => (
            <div key={item.id} onClick={() => { onChange(item.id); setOpen(false); setQ('') }} className={item.id === value ? 'combo-option is-selected' : 'combo-option'}>
              <strong>{item.company_name}</strong>
              {item.mobile ? <span className="combo-option__meta">{item.mobile}</span> : null}
            </div>
          ))}
          {filtered.length === 0 ? <p className="combo-empty">No clients found</p> : null}
        </div>
      ) : null}
    </div>
  )
}

// ─── UserSelector ─────────────────────────────────────────
interface UserItem { id: number; name: string; email?: string; groups?: Array<{ group_name: string }> }

export function UserSelector({ value, onChange, placeholder = 'Select user', disabled }: SelectorProps) {
  const [items, setItems] = useState<UserItem[]>([])
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const selected = items.find(i => i.id === value)

  useEffect(() => {
    request<{ data: UserItem[] }>('/users').then(d => setItems(d.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q.toLowerCase())) : items

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => !disabled && setOpen(!open)} className={`combo-trigger${disabled ? ' is-disabled' : ''}${open ? ' is-open' : ''}`}>
        <User size={15} className="combo-icon" />
        <span className={selected ? 'combo-value' : 'combo-value is-placeholder'}>{selected ? selected.name : placeholder}</span>
        {value ? <X size={14} className="combo-clear" onClick={(e) => { e.stopPropagation(); onChange(null) }} /> : null}
      </div>
      {open ? (
        <div className="combo-menu">
          <div className="combo-search">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search..." autoFocus />
          </div>
          {filtered.map(item => (
            <div key={item.id} onClick={() => { onChange(item.id); setOpen(false); setQ('') }} className={item.id === value ? 'combo-option is-selected' : 'combo-option'}>
              <strong>{item.name}</strong>
              {item.groups?.length ? <span className="combo-option__meta">{item.groups[0].group_name}</span> : null}
            </div>
          ))}
          {filtered.length === 0 ? <p className="combo-empty">No users found</p> : null}
        </div>
      ) : null}
    </div>
  )
}

// ─── DepartmentSelector ───────────────────────────────────
interface DeptItem { id: number; name: string; code?: string }

export function DepartmentSelector({ value, onChange, placeholder = 'Select department', disabled }: SelectorProps) {
  const [items, setItems] = useState<DeptItem[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = items.find(i => i.id === value)

  useEffect(() => {
    request<{ data: DeptItem[] }>('/departments/list').then(d => setItems(d.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => !disabled && setOpen(!open)} className={`combo-trigger${disabled ? ' is-disabled' : ''}${open ? ' is-open' : ''}`}>
        <Layers size={15} className="combo-icon" />
        <span className={selected ? 'combo-value' : 'combo-value is-placeholder'}>{selected ? selected.name : placeholder}</span>
      </div>
      {open ? (
        <div className="combo-menu">
          {items.map(item => (
            <div key={item.id} onClick={() => { onChange(item.id); setOpen(false) }} className={item.id === value ? 'combo-option is-selected' : 'combo-option'}>
              {item.name}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ─── DatePicker (standardized) ────────────────────────────
interface DatePickerProps {
  value: string
  onChange: (v: string) => void
  label?: string
  required?: boolean
  style?: React.CSSProperties
}

export function DatePicker({ value, onChange, label, required, style }: DatePickerProps) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      {label ? (
        <span style={{ display: 'block', fontWeight: 500, fontSize: '0.8rem', color: 'var(--gray-700)', marginBottom: 6 }}>
          {label} {required ? <span style={{ color: 'var(--color-red)' }}>*</span> : null}
        </span>
      ) : null}
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
