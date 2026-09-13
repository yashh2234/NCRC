import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Calendar, Download, X } from 'lucide-react'
import { request } from '../lib/api'
import { DataTable } from '../components/DataTable'

interface ExpenseItem {
  id: number; date: string; opening_balance: number; total_income: number; total_expenses: number
  closing_balance: number; category: string; remark: string; payment_mode: string; person_name: string
}
interface ExpenseSummary { total_income: number; total_expenses: number }

const EXPENSE_CATEGORIES = [
  'Site Exp', 'Corier and Speed Post', 'Convence and Transportation',
  'Survey Exp', 'DD and tendor Exp', 'Omendra Gupta Current ac',
  'Office Maintenance', 'Refreshment', 'stationary',
  'Machine and Car Repairing', 'Lab Testing Exp', 'Audit Expenses',
  'Telephone/Water/Electricity Exp', 'Printor and Computer Repairing exp',
  'Printing Exp', 'Cash advance', 'Salary', 'Other Exp',
]
const PAYMENT_MODES = ['', 'Cash', 'UPI', 'Bank Transfer', 'Card', 'Cheque']

export function ExpensesPage() {
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [summary, setSummary] = useState<ExpenseSummary>({ total_income: 0, total_expenses: 0 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState('')
  const [totalIncome, setTotalIncome] = useState('')
  const [totalExpenses, setTotalExpenses] = useState('')
  const [paymentMode, setPaymentMode] = useState('')
  const [remark, setRemark] = useState('')
  const [personName, setPersonName] = useState('')
  const [localError, setLocalError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      if (categoryFilter) params.category = categoryFilter
      const qs = new URLSearchParams(params).toString()
      const data = await request<{ data: ExpenseItem[]; summary: ExpenseSummary }>(`/expenses${qs ? '?' + qs : ''}`)
      setItems(data.data); setSummary(data.summary)
    } catch { setLocalError('Unable to load expenses') }
    finally { setLoading(false) }
  }, [startDate, endDate, categoryFilter])

  useEffect(() => { void load() }, [load])

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10)); setCategory(''); setTotalIncome('')
    setTotalExpenses(''); setPaymentMode(''); setRemark(''); setPersonName(''); setEditingId(null)
  }

  const beginEdit = (item: ExpenseItem) => {
    setEditingId(item.id); setDate(item.date); setCategory(item.category)
    setTotalIncome(String(item.total_income || '')); setTotalExpenses(String(item.total_expenses || ''))
    setPaymentMode(item.payment_mode); setRemark(item.remark); setPersonName(item.person_name); setShowForm(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const payload = { date, category, total_income: totalIncome || '0', total_expenses: totalExpenses || '0', payment_mode: paymentMode, remark, person_name: personName }
      if (editingId) { await request(`/expenses/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) }) }
      else { await request('/expenses', { method: 'POST', body: JSON.stringify(payload) }) }
      setShowForm(false); resetForm(); await load()
    } catch { setLocalError(editingId ? 'Failed to update' : 'Failed to save') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this expense?')) return
    try { await request(`/expenses/${id}`, { method: 'DELETE' }); await load() }
    catch { setLocalError('Failed to delete') }
  }

  const handleExport = () => {
    const headers = ['Date', 'Category', 'Income', 'Expenses', 'Payment Mode', 'Person', 'Remark']
    const rows = items.map((item) => [item.date, item.category, item.total_income, item.total_expenses, item.payment_mode, item.person_name, item.remark])
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`; link.click()
  }

  function money(v: number) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v) }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="section-label">Finance</p>
          <h1>Daily Expenses</h1>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true) }} type="button"><Plus size={16} /> Add Entry</button>
          <button className="btn btn-outline" onClick={handleExport} type="button"><Download size={16} /> Export</button>
        </div>
      </div>

      <div className="filter-bar">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="sync-pill">Income: {money(summary.total_income)}</span>
          <span className="sync-pill">Expenses: {money(summary.total_expenses)}</span>
        </div>
        <div className="date-filter" style={{ marginLeft: 'auto' }}>
          <Calendar size={14} />
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <span>to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="record-count">{items.length} entries</span>
        </div>
      </div>

      {localError && <div className="error-banner">{localError}</div>}

      <div className="table-card">
        {loading ? <p className="empty-state">Loading...</p> : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date' }, { key: 'category', label: 'Category' },
              { key: 'income', label: 'Income' }, { key: 'expenses', label: 'Expenses' },
              { key: 'closing', label: 'Closing Bal' }, { key: 'payment', label: 'Payment' },
              { key: 'person', label: 'Person' }, { key: 'remark', label: 'Remark' },
              { key: 'actions', label: '', sortable: false },
            ]}
            rows={items.map((item) => ({
              date: <span className="mono">{item.date}</span>,
              category: item.category,
              income: <span className="mono">{money(item.total_income)}</span>,
              expenses: <span className="mono">{money(item.total_expenses)}</span>,
              closing: <span className="mono">{money(item.closing_balance)}</span>,
              payment: item.payment_mode,
              person: item.person_name,
              remark: <span className="text-muted">{item.remark}</span>,
              actions: <div className="row-actions-inline">
                <button className="icon-btn" onClick={() => beginEdit(item)} type="button" title="Edit"><Pencil size={15} /></button>
                <button className="icon-btn" onClick={() => void handleDelete(item.id)} type="button" title="Delete"><Trash2 size={15} /></button>
              </div>,
            }))}
          />
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); resetForm() }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowForm(false); resetForm() }} type="button"><X size={20} /></button>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <p className="section-label">{editingId ? 'Update' : 'Record'}</p>
                <h2>{editingId ? 'Edit expense' : 'New expense entry'}</h2>
              </div>
              <div className="form-grid-2">
                <label className="form-field"><span>Date *</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
                <label className="form-field"><span>Category *</span>
                  <input list="expense-categories" value={category} onChange={(e) => setCategory(e.target.value)} required placeholder="Select or type" />
                  <datalist id="expense-categories">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</datalist>
                </label>
                <label className="form-field"><span>Income</span><input type="number" value={totalIncome} onChange={(e) => setTotalIncome(e.target.value)} /></label>
                <label className="form-field"><span>Expense amount</span><input type="number" value={totalExpenses} onChange={(e) => setTotalExpenses(e.target.value)} /></label>
                <label className="form-field"><span>Payment mode</span>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>{PAYMENT_MODES.map((m) => <option key={m} value={m}>{m || 'Select Mode'}</option>)}</select>
                </label>
                <label className="form-field"><span>Person name</span><input value={personName} onChange={(e) => setPersonName(e.target.value)} /></label>
              </div>
              <label className="form-field" style={{ marginTop: 12 }}><span>Remark</span><input value={remark} onChange={(e) => setRemark(e.target.value)} /></label>
              <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => { setShowForm(false); resetForm() }} type="button">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
