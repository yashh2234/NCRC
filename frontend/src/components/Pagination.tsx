/**
 * Numbered pager used by every table: [Previous] 1 2 3 4 5 … 87 [Next]
 * Always shows the first and last page, the current page and its neighbours.
 */
interface PaginationProps {
  page: number
  lastPage: number
  onChange: (page: number) => void
}

export function pageNumbers(current: number, last: number): Array<number | 'gap'> {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap', last]
  if (current >= last - 3) return [1, 'gap', last - 4, last - 3, last - 2, last - 1, last]
  return [1, 'gap', current - 1, current, current + 1, 'gap', last]
}

export function Pagination({ page, lastPage, onChange }: PaginationProps) {
  const last = Math.max(1, lastPage)
  const current = Math.min(Math.max(1, page), last)
  const go = (p: number) => { if (p >= 1 && p <= last && p !== current) onChange(p) }

  return (
    <nav className="pager" aria-label="Pagination">
      <button type="button" className="pager__btn pager__edge" disabled={current <= 1} onClick={() => go(current - 1)}>
        Previous
      </button>
      {pageNumbers(current, last).map((n, i) => n === 'gap' ? (
        <span key={`gap${i}`} className="pager__btn pager__gap" aria-hidden="true">…</span>
      ) : (
        <button
          key={n}
          type="button"
          className={`pager__btn${n === current ? ' is-active' : ''}`}
          aria-current={n === current ? 'page' : undefined}
          aria-label={`Page ${n}`}
          onClick={() => go(n)}
        >
          {n}
        </button>
      ))}
      <button type="button" className="pager__btn pager__edge" disabled={current >= last} onClick={() => go(current + 1)}>
        Next
      </button>
    </nav>
  )
}
