import { useState } from 'react'
import { X } from 'lucide-react'
import { DateInput } from './DateInput'

/**
 * The one date-range filter used on every page:  From [dd-mm-yyyy] To [dd-mm-yyyy] [✕ Clear]
 * Applies automatically as soon as a date is picked or a full date is typed — no Apply button.
 * Clear shows once a range is applied. Values are yyyy-mm-dd ('' = not set).
 */
interface DateRangeFilterProps {
  start: string
  end: string
  onApply: (start: string, end: string) => void
  onClear?: () => void
  /** Only filter once both dates are filled (ULR Register / Due Reports, like the old software). */
  requireBoth?: boolean
  /** Kept for compatibility; nothing to report now that there is no Apply button. */
  onInvalid?: (message: string) => void
  className?: string
}

export function DateRangeFilter({ start, end, onApply, onClear, requireBoth, className }: DateRangeFilterProps) {
  const [from, setFrom] = useState(start)
  const [to, setTo] = useState(end)
  const [applied, setApplied] = useState({ start, end })

  // Follow changes made by the page itself (e.g. a page-wide "Clear all")
  if (applied.start !== start || applied.end !== end) {
    setApplied({ start, end })
    setFrom(start)
    setTo(end)
  }

  const update = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom)
    setTo(nextTo)
    // Both boxes emptied: show everything again
    if (!nextFrom && !nextTo) {
      if (start || end) onApply('', '')
      return
    }
    // ULR Register / Due Reports wait for both dates
    if (requireBoth && (!nextFrom || !nextTo)) return
    // Picked the wrong way round: swap instead of showing nothing
    const [s, e] = nextFrom && nextTo && nextFrom > nextTo ? [nextTo, nextFrom] : [nextFrom, nextTo]
    if (s === start && e === end) return
    setFrom(s)
    setTo(e)
    onApply(s, e)
  }

  const clear = () => {
    setFrom('')
    setTo('')
    if (onClear) onClear()
    else onApply('', '')
  }

  const isApplied = Boolean(start || end)

  return (
    <div className={`date-range${className ? ` ${className}` : ''}`}>
      <span className="date-range__label">From</span>
      <DateInput value={from} onChange={(v) => update(v, to)} ariaLabel="From date" />
      <span className="date-range__label">To</span>
      <DateInput value={to} onChange={(v) => update(from, v)} ariaLabel="To date" />
      {isApplied ? (
        <button type="button" className="ghost-button date-range__clear" onClick={clear}>
          <X size={14} /> Clear
        </button>
      ) : null}
    </div>
  )
}
