import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, SlidersHorizontal } from 'lucide-react'
import { countActiveFilters } from './useCardTables'

/**
 * Put into a page's filter row: closed, only the search and this button show; open, the row itself
 * becomes a bottom sheet with every filter (the page's own controls, still working as before).
 */
export function FilterToggle({ bar, open, onToggle }: { bar: HTMLElement; open: boolean; onToggle: () => void }) {
  const [count, setCount] = useState(() => countActiveFilters(bar))

  useEffect(() => {
    const calc = () => setCount(countActiveFilters(bar))
    const observer = new MutationObserver(calc)
    observer.observe(bar, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] })
    bar.addEventListener('input', calc)
    bar.addEventListener('change', calc)
    return () => { observer.disconnect(); bar.removeEventListener('input', calc); bar.removeEventListener('change', calc) }
  }, [bar])

  useEffect(() => {
    bar.setAttribute('data-m-filters', open ? 'open' : 'closed')
  }, [bar, open])
  useEffect(() => () => bar.removeAttribute('data-m-filters'), [bar])

  return createPortal(
    <button type="button" className={`m-filter-toggle${open ? ' is-open' : ''}${count ? ' is-set' : ''}`} onClick={onToggle}
      aria-expanded={open} aria-label={open ? 'Show results' : `Filters${count ? `, ${count} set` : ''}`}>
      {open ? <><Check size={18} /> <span>Show results</span></> : <><SlidersHorizontal size={18} /> <span>Filters</span>{count ? <b>{count}</b> : null}</>}
    </button>,
    bar,
  )
}
