import { useMemo, useState, type ReactNode } from 'react'

import { Download, Search } from 'lucide-react'
import { Pagination } from './Pagination'

interface DataTableColumn {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  /** Fixed column width in px (keeps short columns like amounts narrow). */
  width?: number
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
  /** Whenever this value changes (e.g. outside filters change), the table jumps back to page 1. */
  resetPageKey?: string | number
  /** Extra filters shown in the same toolbar row, before the search box. */
  toolbarStart?: ReactNode
  /** Page buttons shown at the right end of the toolbar (e.g. Add / Export). */
  toolbarEnd?: ReactNode
  /** Buttons shown after the built-in Export CSV (e.g. a "New …" button). */
  toolbarAfterExport?: ReactNode
  /** An extra row of filters above the search row, inside the same box. */
  toolbarTop?: ReactNode
  /** Heading row shown inside the table box, above the column headers. */
  tableHeader?: ReactNode
  /** Show the "N records" pill (default true). */
  showCount?: boolean
  /** Text when there are no rows (e.g. "Loading..."). */
  emptyText?: string
}

export function DataTable({
  columns,
  rows,
  pageSize = 15,
  exportable = true,
  searchable = true,
  showHeader = true,
  filename = 'export',
  onRowClick,
  resetPageKey,
  toolbarStart,
  toolbarEnd,
  toolbarAfterExport,
  toolbarTop,
  tableHeader,
  showCount = true,
  emptyText = 'No records found.',
}: DataTableProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [lastResetKey, setLastResetKey] = useState(resetPageKey)
  if (resetPageKey !== lastResetKey) {
    setLastResetKey(resetPageKey)
    setPage(1)
  }

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
      {showHeader && (() => {
        const boxed = Boolean(toolbarStart || toolbarEnd || toolbarAfterExport || toolbarTop)
        const row = (
        <div className={`dt-toolbar${boxed && !toolbarTop ? ' dt-toolbar--box' : ''}`}>
          <div className="dt-toolbar__start">
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
            ) : null}
            {toolbarStart}
          </div>

          <div className="dt-toolbar__meta">
            {toolbarEnd}
            {showCount ? (
              <span className="sync-pill">
                {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
              </span>
            ) : null}

            {exportable ? (
              <button className="btn btn-outline btn-sm" onClick={exportCsv} type="button">
                <Download size={14} /> Export CSV
              </button>
            ) : null}
            {toolbarAfterExport}
          </div>
        </div>
        )
        return toolbarTop ? (
          <div className="dt-toolbar--box dt-toolbar-stack">
            <div className="dt-toolbar">{toolbarTop}</div>
            {row}
          </div>
        ) : row
      })()}

      <div className="table-card">
        {tableHeader ? <div className="dt-table-header">{tableHeader}</div> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={col.align || col.width ? { textAlign: col.align, width: col.width, minWidth: col.width, maxWidth: col.width, whiteSpace: col.width ? 'normal' : undefined } : undefined}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="dt-empty">
                    {emptyText}
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
                      <td key={col.key} style={col.align || col.width ? { textAlign: col.align, width: col.width, minWidth: col.width, maxWidth: col.width } : undefined}>{row[col.key]}</td>
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

            <Pagination page={safePage} lastPage={totalPages} onChange={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
