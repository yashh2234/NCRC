import { useMemo, useState, type ReactNode } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface DataTableColumn {
  key: string
  label: string
  sortable?: boolean
}

interface DataTableProps {
  columns: DataTableColumn[]
  rows: Array<Record<string, ReactNode>>
  pageSize?: number
  exportable?: boolean
  searchable?: boolean
  showHeader?: boolean
  filename?: string
  onRowClick?: (row: Record<string, ReactNode>) => void
}

export function DataTable({
  columns,
  rows,
  pageSize = 15,
  exportable = true,
  searchable = true,
  showHeader = true,
  filename = 'export',
  onRowClick
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) =>
      columns.some((col) => {
        const val = row[col.key]
        return val != null && String(val).toLowerCase().includes(q)
      }),
    )
  }, [rows, search, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null) return 1
      if (bVal == null) return -1

      let cmp = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  const exportCsv = () => {
    const header = columns.map((c) => c.label).join(',')
    const body = sorted
      .map((row) => columns.map((col) => `"${String(row[col.key] ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) return <ArrowUpDown size={13} style={{ color: 'var(--gray-300)' }} />
    return sortDir === 'asc'
      ? <ArrowUp size={13} style={{ color: 'var(--color-primary)' }} />
      : <ArrowDown size={13} style={{ color: 'var(--color-primary)' }} />
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Top Filter & Export Bar */}
      {showHeader && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          background: 'var(--color-surface)', padding: '12px 16px', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-xs)',
        }}>
          {searchable ? (
            <div style={{ position: 'relative', width: 280 }}>
              <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-300)' }} />
              <input
                type="text"
                placeholder="Search records..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                style={{
                  width: '100%', paddingLeft: 40, paddingRight: 14,
                  minHeight: 38, borderRadius: 999,
                  border: '1px solid var(--color-border)',
                  background: 'var(--gray-50)', fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>
          ) : <div />}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="sync-pill">
              {sorted.length} {sorted.length === 1 ? 'record' : 'records'}
            </span>

            {exportable ? (
              <button className="btn btn-outline btn-sm" onClick={exportCsv} type="button">
                <Download size={14} /> Export CSV
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={{ padding: '14px 16px' }}>
                    {col.sortable !== false ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, background: 'none',
                          border: 'none', padding: 0, fontWeight: 700, fontSize: 'inherit',
                          color: 'inherit', cursor: 'pointer', textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        <span>{col.label}</span>
                        <SortIcon columnKey={col.key} />
                      </button>
                    ) : (
                      <span>{col.label}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)', fontWeight: 500 }}>
                    No records found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => (
                  <tr
                    key={row.id ? String(row.id) : idx}
                    onClick={() => onRowClick?.(row)}
                    style={{ cursor: onRowClick ? 'pointer' : undefined }}
                  >
                    {columns.map((col) => (
                      <td key={col.key} style={{ padding: '12px 16px' }}>
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        {totalPages > 1 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderTop: '1px solid var(--color-border-light)',
            background: 'var(--gray-50)', fontSize: '0.82rem',
          }}>
            <span style={{ color: 'var(--gray-400)', fontWeight: 500 }}>
              Page {safePage} of {totalPages} ({sorted.length} total records)
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <button
                className="btn btn-outline btn-sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
