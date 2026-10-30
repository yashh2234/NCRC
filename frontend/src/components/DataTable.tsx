import { useMemo, useState, type ReactNode } from 'react'
import { Download, Search, ChevronLeft, ChevronRight } from 'lucide-react'

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
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((row) =>
      String(row.searchText ?? '').toLowerCase().includes(q) ||
      columns.some((col) => {
        const val = row[col.key]
        return val != null && String(val).toLowerCase().includes(q)
      }),
    )
  }, [rows, search, columns])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const exportCsv = () => {
    const header = columns.map((c) => c.label).join(',')
    const body = filtered
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

  return (
    <div className="dt">
      {showHeader && (
        <div className="dt-toolbar">
          {searchable ? (
            <div className="search-field dt-search">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search records..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
          ) : <div />}

          <div className="dt-toolbar__meta">
            <span className="sync-pill">
              {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
            </span>

            {exportable ? (
              <button className="btn btn-outline btn-sm" onClick={exportCsv} type="button">
                <Download size={14} /> Export CSV
              </button>
            ) : null}
          </div>
        </div>
      )}

      <div className="table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="dt-empty">
                    No records found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => (
                  <tr
                    key={row.id ? String(row.id) : idx}
                    onClick={() => onRowClick?.(row)}
                    className={onRowClick ? 'dt-row-clickable' : undefined}
                  >
                    {columns.map((col) => (
                      <td key={col.key}>{row[col.key]}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="dt-pagination">
            <span>
              Page {safePage} of {totalPages} · {filtered.length} records
            </span>

            <div className="dt-pagination__buttons">
              <button
                className="btn btn-outline btn-sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} /> <span className="dt-btn-label">Previous</span>
              </button>

              <button
                className="btn btn-outline btn-sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
                aria-label="Next page"
              >
                <span className="dt-btn-label">Next</span> <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
