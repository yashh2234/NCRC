import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronsUpDown, ChevronUp, Download, Search, Trash2, X } from 'lucide-react'
import { Pagination } from '../components/Pagination'
import { api } from '../lib/api'
import { useTracking } from '../lib/useTracking'
import { Modal } from '../components/Modal'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { Select } from '../components/Select'
import { HistoryButton } from '../components/History'

/**
 * Manage ULR Register. Same features as the old software's ulrlink/ulr_register:
 * every ulr_link row, Start + End date filter, search on all columns, column sorting,
 * "Show N entries", Export, trash = unassign (row kept).
 * Laid out like the Registrations page.
 */

type Row = Awaited<ReturnType<typeof api.ulrRegister>>['data'][number]
type SortCol = 'date' | 'ulr_no' | 'uid_no' | 'name_of_department' | 'name_of_agency' | 'name_of_project' | 'sample_details'

const COLUMNS: Array<[SortCol, string]> = [
  ['date', 'Date'],
  ['ulr_no', 'ULR NO'],
  ['uid_no', 'UID NO'],
  ['name_of_department', 'Name of Department'],
  ['name_of_agency', 'Name of Agency'],
  ['name_of_project', 'Name of Work'],
  ['sample_details', 'Sample Details'],
]


interface Message { type: 'success' | 'error'; text: string }

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function UlrRegisterPage() {
  useTracking('ulr_register')

  const [applied, setApplied] = useState({ start: '', end: '' })

  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [filtered, setFiltered] = useState(0)
  const [loading, setLoading] = useState(true)

  const [perPage, setPerPage] = useState(10)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' } | null>(null)

  const [message, setMessage] = useState<Message | null>(null)
  const [removing, setRemoving] = useState<Row | null>(null)
  const [busy, setBusy] = useState(false)

  // Old DataTable searched as you type.
  useEffect(() => {
    const t = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1) }, 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), per_page: String(perPage) }
      if (applied.start && applied.end) { params.start_date = applied.start; params.end_date = applied.end }
      if (search) params.search = search
      if (sort) { params.sort = sort.col; params.dir = sort.dir }
      const res = await api.ulrRegister(params)
      setRows(res.data)
      setTotal(res.total)
      setFiltered(res.filtered)
    } catch {
      setRows([])
      setMessage({ type: 'error', text: 'Failed to load ULR register' })
    } finally {
      setLoading(false)
    }
  }, [page, perPage, applied, search, sort])

  useEffect(() => { void load() }, [load])

  const flash = (msg: Message) => {
    setMessage(msg)
    if (msg.type === 'success') window.setTimeout(() => setMessage(m => (m === msg ? null : m)), 4000)
  }

  // Old software: both dates are required before GO.
  const applyDates = (start: string, end: string) => {
    setMessage(null)
    setApplied({ start, end })
    setPage(1)
  }

  const exportCsv = async () => {
    try {
      const params: Record<string, string> = {}
      if (applied.start && applied.end) { params.start_date = applied.start; params.end_date = applied.end }
      const res = await api.ulrLinksExport(params)
      const header = 'Date,ULR Number,UID Number,Name of Agency,Name of Work,Sample Details\n'
      const body = res.data
        .map(r => [r.date, r.ulr_no, r.uid_no, r.name_of_agency, r.name_of_project, r.sample_details].map(csvCell).join(','))
        .join('\n')
      const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'ulr.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      flash({ type: 'error', text: 'Export failed' })
    }
  }

  const confirmRemove = async () => {
    if (!removing) return
    setBusy(true)
    try {
      const res = await api.deleteUlrLink(removing.id)
      flash({ type: 'success', text: res.message || 'Successfully removed' })
      setRemoving(null)
      void load()
    } catch {
      flash({ type: 'error', text: 'Error in the database while removing' })
    } finally {
      setBusy(false)
    }
  }

  const toggleSort = (col: SortCol) => {
    setSort(s => (s && s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
    setPage(1)
  }

  const lastPage = Math.max(1, Math.ceil(filtered / perPage))
  const from = filtered === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, filtered)

  return (
    <div className="space-y-4">
      {message && (
        <div
          role="alert"
          style={{
            ...(message.type === 'success'
              ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }
              : { background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }),
            padding: '10px 16px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 12,
          }}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
        </div>
      )}

      {/* One boxed row like Final Reports: search, dates, Export on the right */}
      <div className="dt-toolbar dt-toolbar--box" style={{ marginBottom: 16 }}>
        <div className="dt-toolbar__start">
          <div className="search-field dt-search">
            <Search size={15} />
            <input
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search ULR, UID, agency, work..."
              aria-label="Search ULR register"
            />
          </div>
        </div>
        <div className="dt-toolbar__meta">
          <DateRangeFilter
            start={applied.start}
            end={applied.end}
            requireBoth
            onApply={applyDates}
            onInvalid={(text) => flash({ type: 'error', text })}
          />
          <button className="btn btn-outline btn-sm" onClick={() => void exportCsv()} type="button">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {COLUMNS.map(([col, label]) => {
                  const active = sort?.col === col
                  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown
                  return (
                    <th
                      key={col}
                      onClick={() => toggleSort(col)}
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {label}
                        <Icon size={13} style={{ opacity: active ? 0.9 : 0.35 }} />
                      </span>
                    </th>
                  )
                })}
                <th style={{ textAlign: 'center', width: 70 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={8} className="dt-empty">Loading ULR register...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="dt-empty">{search ? 'No matching records found.' : 'No records found.'}</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} style={loading ? { opacity: 0.6 } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{r.ulr_no}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.uid_no}</td>
                  <td>{r.name_of_department}</td>
                  <td>{r.name_of_agency}</td>
                  <td>{r.name_of_project}</td>
                  <td>{r.sample_details}</td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <HistoryButton type="UlrLink" id={r.id} title={`ULR ${r.ulr_no ?? ''}`} />
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setRemoving(r)}
                      title="Remove"
                      aria-label={`Remove ULR ${r.ulr_no}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dt-pagination">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', margin: 0 }}>
              Show
              <Select
                value={perPage}
                onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }}
                aria-label="Entries per page"
                style={{ width: 'auto', minWidth: 0, minHeight: 0, height: 30, flex: 'none', padding: '2px 26px 2px 8px', backgroundPosition: 'right 6px center', backgroundSize: 14, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.8rem', boxShadow: 'none' }}
              >
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </Select>
              entries
            </label>
            <span>
              Showing {from} to {to} of {filtered} entries
              {filtered !== total ? ` (filtered from ${total} total entries)` : ''}
            </span>
          </span>

          <Pagination page={page} lastPage={lastPage} onChange={setPage} />
        </div>
      </div>

      {removing && (
        <Modal
          title="Remove Report"
          size="sm"
          onClose={() => setRemoving(null)}
          onSave={() => void confirmRemove()}
          saveLabel="Remove"
          cancelLabel="Close"
          saving={busy}
        >
          <p style={{ margin: 0 }}>
            Do you really want to remove? ULR <strong>{removing.ulr_no}</strong>
            {removing.uid_no ? <> will be unassigned from UID <strong>{removing.uid_no}</strong></> : null} and stays in the list to be linked again.
          </p>
        </Modal>
      )}
    </div>
  )
}
