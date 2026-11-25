import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Download } from 'lucide-react'
import { DateRangeFilter } from '../components/DateRangeFilter'
import { request } from '../lib/api'
import { DataTable } from '../components/DataTable'
import { Req } from '../components/ui'
import { Modal } from '../components/Modal'
import { Select } from '../components/Select'
import { ComboInput } from '../components/ComboInput'

interface ExpenseItem {
  id: number; date: string; date_iso?: string; opening_balance: number; total_income: number; total_expenses: number
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
  const [, setSummary] = useState<ExpenseSummary>({ total_income: 0, total_expenses: 0 })
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

  const load = useCallback(async () => {
    setLoading(true)
    setLocalError('')
    try {
      const params: Record<string, string> = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const qs = new URLSearchParams(params).toString()
      const data = await request<{ data: ExpenseItem[]; summary: ExpenseSummary }>(`/expenses${qs ? '?' + qs : ''}`)
      setItems(data.data); setSummary(data.summary)
    } catch { setLocalError('Unable to load expenses') }
    finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { void load() }, [load])

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10)); setCategory(''); setTotalIncome('')
    setTotalExpenses(''); setPaymentMode(''); setRemark(''); setPersonName(''); setEditingId(null)
  }

  const beginEdit = (item: ExpenseItem) => {
    setEditingId(item.id); setDate(item.date_iso ?? item.date); setCategory(item.category)
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
        </div>

      </div>

      {localError && <div className="error-banner">{localError}</div>}

      <DataTable
            filename="expenses"
            columns={[
              { key: 'date', label: 'Date' }, { key: 'category', label: 'Category' },
              { key: 'income', label: 'Income' }, { key: 'expenses', label: 'Expenses' },
              { key: 'closing', label: 'Closing Bal' }, { key: 'payment', label: 'Payment' },
              { key: 'person', label: 'Person' }, { key: 'remark', label: 'Remark' },
              { key: 'actions', label: '', sortable: false },
            ]}
            rows={loading ? [] : items.map((item) => ({
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
            exportable={false}
            showCount={false}
            emptyText={loading ? 'Loading...' : 'No records found.'}
            toolbarTop={
              <>
                <div className="dt-toolbar__start">
                  <DateRangeFilter start={startDate} end={endDate} onApply={(start, end) => { setStartDate(start); setEndDate(end) }} />
                </div>
                <div className="dt-toolbar__meta">
                  <button className="btn btn-outline btn-sm" onClick={handleExport} type="button" style={{ minWidth: 132, justifyContent: 'center' }}><Download size={14} /> Export</button>
                </div>
              </>
            }
            toolbarEnd={<button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setShowForm(true) }} type="button" style={{ minWidth: 132, justifyContent: 'center' }}><Plus size={14} /> Add Entry</button>}
          />

      {showForm && (
        <Modal title={editingId ? 'Edit expense' : 'New expense entry'} subtitle={editingId ? 'Update' : 'Record'} onClose={() => { setShowForm(false); resetForm() }} onSubmit={handleSubmit} saveLabel={editingId ? 'Update' : 'Save'}>
              <div className="form-grid-2">
                <label className="form-field"><span>Date<Req /></span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
                <label className="form-field"><span>Category<Req /></span>
                  <ComboInput other={false} options={EXPENSE_CATEGORIES} value={category} onChange={setCategory} required placeholder="Select or type" />
                </label>
                <label className="form-field"><span>Income</span><input type="number" value={totalIncome} onChange={(e) => setTotalIncome(e.target.value)} /></label>
                <label className="form-field"><span>Expense amount</span><input type="number" value={totalExpenses} onChange={(e) => setTotalExpenses(e.target.value)} /></label>
                <label className="form-field"><span>Payment mode</span>
                  <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>{PAYMENT_MODES.map((m) => <option key={m} value={m}>{m || 'Select Mode'}</option>)}</Select>
                </label>
                <label className="form-field"><span>Person name</span><input value={personName} onChange={(e) => setPersonName(e.target.value)} /></label>
              </div>
              <label className="form-field" style={{ marginTop: 12 }}><span>Remark</span><input value={remark} onChange={(e) => setRemark(e.target.value)} /></label>
        </Modal>
      )}
    </>
  )
}
