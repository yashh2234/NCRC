import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { DollarSign, Clock, MessageSquare, Send, Plus, Pencil, Trash2, X, Printer } from 'lucide-react'
import { api } from '../lib/api'
import { DataTable } from '../components/DataTable'
import { WorkflowStatusBadge } from '../components/WorkflowStatusBadge'
import type { BillingItem, BillingRecord, SmsLogEntry } from '../lib/types'

type Tab = 'all' | 'due' | 'due_attached' | 'not_updated' | 'sms'

function money(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
}

interface BillingForm {
  uid_no: string
  bill_no: string
  bill_amount: string
  advance_amount: string
  mode_of_payment: string
  amount_received: string
  amount_received_date: string
  due_amount: string
  discount: string
  payment_followup: string
  remark: string
}

interface RegBillingForm {
  total_payment: string
  advance_payment: string
  balance_dues: string
  payment_followup: string
  financial_remark: string
  mode_of_payment: string
}

const emptyBillingForm: BillingForm = {
  uid_no: '', bill_no: '', bill_amount: '', advance_amount: '',
  mode_of_payment: '', amount_received: '', amount_received_date: '',
  due_amount: '', discount: '', payment_followup: '', remark: '',
}

const emptyRegForm: RegBillingForm = {
  total_payment: '', advance_payment: '', balance_dues: '',
  payment_followup: '', financial_remark: '', mode_of_payment: '',
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Lakh', 'Crore'];
  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
  };
  const intPart = Math.floor(Math.abs(num));
  if (intPart === 0) return 'Zero';
  const parts: string[] = [];
  let remaining = intPart;
  // First chunk: last 3 digits (hundreds)
  parts.push(convert(remaining % 1000));
  remaining = Math.floor(remaining / 1000);
  // Subsequent chunks: 2 digits each (Indian system)
  let scaleIdx = 1;
  while (remaining > 0 && scaleIdx < scales.length) {
    const chunk = remaining % 100;
    if (chunk > 0) parts.push(convert(chunk) + ' ' + scales[scaleIdx]);
    remaining = Math.floor(remaining / 100);
    scaleIdx++;
  }
  return parts.reverse().join(' ').trim() + ' Rupees Only';
}

function printBill(rec: BillingRecord) {
  const billAmount = rec.bill_amount || 0;
  const advanceAmount = rec.advance_amount || 0;
  const discount = rec.discount || 0;
  const cgst = billAmount * 9 / 100;
  const sgst = billAmount * 9 / 100;
  const igst = billAmount * 18 / 100;
  const totalWithGst = billAmount + cgst + sgst;
  const netDue = totalWithGst - advanceAmount - discount;
  const amountWords = numberToWords(Math.round(netDue > 0 ? netDue : totalWithGst));

  const html = `<!DOCTYPE html>
<html><head><title>Tax Invoice - ${rec.bill_no}</title>
<style>
  @media print { body { margin: 0; } @page { margin: 10mm; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 12px; color: #000; }
  .invoice { width: 100%; max-width: 800px; margin: 0 auto; border: 2px solid #000; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #000; padding: 4px 8px; vertical-align: top; }
  .header { text-align: center; font-size: 14px; font-weight: bold; background: #f0f0f0; }
  .company { font-size: 15px; font-weight: bold; }
  .label { font-weight: bold; }
  .right { text-align: right; }
  .center { text-align: center; }
  .no-border { border: none; }
  .amount { text-align: right; font-weight: bold; }
  .footer { font-size: 11px; text-align: center; font-weight: bold; padding: 6px; }
  .items-header { background: #e8e8e8; font-weight: bold; text-align: center; }
  .payment-section td { border: 1px solid #000; padding: 4px 8px; }
  .signature { text-align: center; padding-top: 30px; font-weight: bold; }
</style></head><body>
<div class="invoice">
  <table>
    <tr><td colspan="8" class="header" style="font-size:16px;">TAX INVOICE</td></tr>
    <tr>
      <td colspan="3" rowspan="1" class="company">NAMOTECH CONSULTANCY SERVICES LLP</td>
      <td colspan="3" class="label">Invoice No.</td>
      <td colspan="2"><span class="label">Dated:</span> ${rec.created_date || ''}</td>
    </tr>
    <tr>
      <td colspan="3" style="border-bottom:none;">Address : 57, Chandra Nagar, Near Pooja Tower</td>
      <td colspan="3" rowspan="2" class="label">Letter No</td>
      <td colspan="2" rowspan="2" class="label">Dated</td>
    </tr>
    <tr><td colspan="3" style="border-top:none;">Gopalpura Bypass Jaipur. (Raj) 302015</td></tr>
    <tr>
      <td colspan="3">Phone no. 0141-2763610</td>
      <td colspan="3" class="label">SAC CODE</td>
      <td colspan="2"></td>
    </tr>
    <tr>
      <td colspan="3">Mobile no. 9214507766</td>
      <td colspan="3">Report No</td>
      <td colspan="2" class="label">Dated</td>
    </tr>
    <tr>
      <td colspan="3">E-mail : Info@namotech.in</td>
      <td colspan="3" class="label">UID NO</td>
      <td colspan="2">${rec.uid_no || ''}</td>
    </tr>
    <tr>
      <td colspan="3">Web: www.namotech.in</td>
      <td colspan="3" class="label">Dated</td>
      <td colspan="2">${rec.created_date || ''}</td>
    </tr>
    <tr>
      <td colspan="3" class="label">LLP'S GSTIN :</td>
      <td colspan="5" class="label">Terms of Delivery</td>
    </tr>
    <tr>
      <td colspan="3" class="label">LLP's PAN NO.</td>
      <td colspan="5" rowspan="2">${rec.agency_name || ''}</td>
    </tr>
    <tr><td colspan="3" class="label">GSTIN : </td></tr>

    <!-- Line Items Header -->
    <tr class="items-header">
      <td>Sr. no</td>
      <td colspan="2">Particular</td>
      <td>Quantity (Unit)</td>
      <td>HSN N.</td>
      <td>Rate (Per Unit)</td>
      <td>Dis. %</td>
      <td>Amount</td>
    </tr>
    <!-- Line Item -->
    <tr>
      <td class="center">1</td>
      <td colspan="2">${rec.remark || 'Testing Charges'}</td>
      <td class="center">1</td>
      <td class="center">-</td>
      <td class="right">${money(billAmount)}</td>
      <td class="center">${discount > 0 ? discount + '%' : '-'}</td>
      <td class="amount">${money(billAmount)}</td>
    </tr>

    <!-- Totals -->
    <tr>
      <td></td>
      <td colspan="2" class="label">Total Amount</td>
      <td colspan="4"></td>
      <td class="amount">${money(billAmount)}</td>
    </tr>
    <tr>
      <td></td>
      <td></td>
      <td class="label">CGST @ 9%</td>
      <td colspan="4"></td>
      <td class="amount">${money(cgst)}</td>
    </tr>
    <tr>
      <td></td>
      <td></td>
      <td class="label">SGST @ 9%</td>
      <td colspan="4"></td>
      <td class="amount">${money(sgst)}</td>
    </tr>
    <tr>
      <td></td>
      <td></td>
      <td class="label">IGST @ 18%</td>
      <td colspan="4"></td>
      <td class="amount">-</td>
    </tr>
    <tr>
      <td></td>
      <td colspan="2" class="label">Transportation Exp. &amp; Other Exp. Including</td>
      <td colspan="4"></td>
      <td class="amount">-</td>
    </tr>
    <tr>
      <td></td>
      <td colspan="2" class="label">Total Amount</td>
      <td colspan="4"></td>
      <td class="amount">${money(totalWithGst)}</td>
    </tr>
    <tr>
      <td></td>
      <td colspan="2" class="label">Net Due Amount</td>
      <td colspan="4"></td>
      <td class="amount">${money(netDue > 0 ? netDue : totalWithGst)}</td>
    </tr>

    <!-- Amount in Words -->
    <tr>
      <td colspan="3" class="label">Amount Chargeable (in Words)</td>
      <td colspan="5"></td>
    </tr>
    <tr>
      <td colspan="8" style="font-size:14px; font-weight:bold; padding:8px;">Rs : ${amountWords}</td>
    </tr>

    <!-- Payment Details -->
    <tr>
      <td colspan="4" class="label">PAYMENT DETAIL</td>
      <td colspan="4" class="label" style="text-align:center;">For Namotech Consultancy Services LLP</td>
    </tr>
    <tr>
      <td colspan="2" class="label">BANK NAME</td>
      <td colspan="2" class="label">ICICI BANK</td>
      <td colspan="4" rowspan="4" class="signature">Authorised Signatory</td>
    </tr>
    <tr>
      <td colspan="2" class="label">A/C No.</td>
      <td colspan="2" class="label">675205601861</td>
    </tr>
    <tr>
      <td colspan="2" class="label">IFSC CODE</td>
      <td colspan="2" class="label">ICIC0006752</td>
    </tr>
    <tr>
      <td colspan="2" class="label">BRANCH</td>
      <td colspan="2" class="label">GOPALPURA CIRCLE, POOJA TOWER, JAIPUR</td>
    </tr>
    <tr><td colspan="8" class="footer">This is a Computer Generated Invoice</td></tr>
  </table>
</div>
</body></html>`;

  const printWin = window.open('', '_blank', 'width=900,height=700');
  if (printWin) {
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 500);
  }
}

export function BillingPage() {
  const [tab, setTab] = useState<Tab>('all')
  const [billings, setBillings] = useState<BillingRecord[]>([])
  const [dueItems, setDueItems] = useState<BillingItem[]>([])
  const [smsLogs, setSmsLogs] = useState<SmsLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [localError, setLocalError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [showBillingForm, setShowBillingForm] = useState(false)
  const [editingBillingId, setEditingBillingId] = useState<number | null>(null)
  const [billingForm, setBillingForm] = useState<BillingForm>(emptyBillingForm)

  const [showRegForm, setShowRegForm] = useState(false)
  const [editingRegId, setEditingRegId] = useState<number | null>(null)
  const [regForm, setRegForm] = useState<RegBillingForm>(emptyRegForm)

  const [sendingIds, setSendingIds] = useState<Set<number>>(new Set())
  const [sendingAll, setSendingAll] = useState(false)

  const loadBillings = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      const data = await api.billingList(params)
      setBillings(data.data ?? [])
    } catch {
      setLocalError('Unable to load billing records')
    }
  }, [startDate, endDate])

  const loadDue = useCallback(async () => {
    try {
      const data = await api.billingDue()
      setDueItems(data.data ?? [])
    } catch {
      setLocalError('Unable to load due payments')
    }
  }, [])

  const loadDueAttached = useCallback(async () => {
    try {
      const data = await api.billingDueAttached()
      setDueItems(data.data ?? [])
    } catch {
      setLocalError('Unable to load due attached reports')
    }
  }, [])

  const loadNotUpdated = useCallback(async () => {
    try {
      const data = await api.billingNotUpdated()
      setDueItems(data.data ?? [])
    } catch {
      setLocalError('Unable to load not updated bills')
    }
  }, [])

  const loadSmsLog = useCallback(async () => {
    try {
      const data = await api.smsLog()
      setSmsLogs(data.data ?? [])
    } catch {
      setLocalError('Unable to load SMS log')
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLocalError('')
    setSuccessMsg('')
    try {
      await Promise.all([loadBillings(), loadDue(), loadSmsLog()])
    } finally {
      setLoading(false)
    }
  }, [loadBillings, loadDue, loadSmsLog])

  useEffect(() => { void loadAll() }, [loadAll])

  useEffect(() => { if (tab === 'all') void loadBillings() }, [tab, loadBillings])
  useEffect(() => { if (tab === 'due') void loadDue() }, [tab, loadDue])
  useEffect(() => { if (tab === 'due_attached') void loadDueAttached() }, [tab, loadDueAttached])
  useEffect(() => { if (tab === 'not_updated') void loadNotUpdated() }, [tab, loadNotUpdated])
  useEffect(() => { if (tab === 'sms') void loadSmsLog() }, [tab, loadSmsLog])

  const beginCreateBilling = () => {
    setEditingBillingId(null)
    setBillingForm(emptyBillingForm)
    setLocalError('')
    setShowBillingForm(true)
  }

  const beginEditBilling = (record: BillingRecord) => {
    setEditingBillingId(record.id)
    setBillingForm({
      uid_no: record.uid_no,
      bill_no: record.bill_no,
      bill_amount: String(record.bill_amount ?? ''),
      advance_amount: String(record.advance_amount ?? ''),
      mode_of_payment: record.mode_of_payment ?? '',
      amount_received: String(record.amount_received ?? ''),
      amount_received_date: record.amount_received_date ?? '',
      due_amount: String(record.due_amount ?? ''),
      discount: String(record.discount ?? ''),
      payment_followup: record.payment_followup ?? '',
      remark: record.remark ?? '',
    })
    setLocalError('')
    setShowBillingForm(true)
  }

  const handleBillingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError('')
    setSuccessMsg('')
    try {
      const payload = {
        ...billingForm,
        bill_amount: parseFloat(billingForm.bill_amount) || 0,
        advance_amount: parseFloat(billingForm.advance_amount) || 0,
        amount_received: parseFloat(billingForm.amount_received) || 0,
        due_amount: parseFloat(billingForm.due_amount) || 0,
        discount: parseFloat(billingForm.discount) || 0,
      }

      if (editingBillingId) {
        await api.updateBilling(editingBillingId, payload)
        setSuccessMsg('Billing record updated')
      } else {
        await api.createBilling(payload)
        setSuccessMsg('Billing record created')
      }

      setShowBillingForm(false)
      setEditingBillingId(null)
      setBillingForm(emptyBillingForm)
      await loadBillings()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to save billing record')
    }
  }

  const handleDeleteBilling = async (record: BillingRecord) => {
    if (!window.confirm(`Delete billing record for ${record.bill_no}?`)) return
    setLocalError('')
    setSuccessMsg('')
    try {
      await api.deleteBilling(record.id)
      setSuccessMsg('Billing record deleted')
      await loadBillings()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to delete billing record')
    }
  }

  const beginEditRegistration = (item: BillingItem) => {
    setEditingRegId(item.id)
    setRegForm({
      total_payment: String(item.total_payment ?? ''),
      advance_payment: String(item.advance_payment ?? ''),
      balance_dues: String(item.balance_dues ?? ''),
      payment_followup: item.payment_followup ?? '',
      financial_remark: item.financial_remark ?? '',
      mode_of_payment: item.mode_of_payment ?? '',
    })
    setLocalError('')
    setShowRegForm(true)
  }

  const handleRegSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingRegId) return
    setLocalError('')
    setSuccessMsg('')
    try {
      const payload = {
        ...regForm,
        total_payment: parseFloat(regForm.total_payment) || 0,
        advance_payment: parseFloat(regForm.advance_payment) || 0,
        balance_dues: parseFloat(regForm.balance_dues) || 0,
      }

      await api.updateRegistrationBilling(editingRegId, payload)
      setSuccessMsg('Registration billing fields updated')
      setShowRegForm(false)
      setEditingRegId(null)
      setRegForm(emptyRegForm)
      await loadDue()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to update registration billing')
    }
  }

  const handleSendSms = async (id: number) => {
    setSendingIds((prev) => new Set(prev).add(id))
    setLocalError('')
    setSuccessMsg('')
    try {
      const res = await api.sendSms(id)
      setSuccessMsg(res.message)
      await loadSmsLog()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to send SMS')
    } finally {
      setSendingIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  const handleSendAllSms = async () => {
    if (!window.confirm('Send SMS reminders to all clients with balance dues?')) return
    setSendingAll(true)
    setLocalError('')
    setSuccessMsg('')
    try {
      const res = await api.sendAllSms()
      setSuccessMsg(res.message)
      await loadSmsLog()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to send all SMS')
    } finally {
      setSendingAll(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All Bills', icon: <DollarSign size={16} /> },
    { key: 'due', label: 'Due Bills', icon: <Clock size={16} /> },
    { key: 'due_attached', label: 'Due Bills Attached Report', icon: <Clock size={16} /> },
    { key: 'not_updated', label: 'Not Update Bills', icon: <Clock size={16} /> },
    { key: 'sms', label: 'SMS Log', icon: <MessageSquare size={16} /> },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            className="ghost-button"
            onClick={() => { setTab(t.key); setLocalError(''); setSuccessMsg('') }}
            style={{
              background: tab === t.key ? 'var(--color-primary-dark)' : undefined,
              color: tab === t.key ? '#fff' : undefined,
              borderColor: tab === t.key ? 'var(--color-primary-dark)' : undefined,
            }}
            type="button"
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {successMsg ? <div className="success-banner" style={{ marginBottom: 12 }}>{successMsg}</div> : null}
      {localError ? <div className="error-banner" style={{ marginBottom: 12 }}>{localError}</div> : null}

      {tab === 'all' && (
        <section className="surface">
          <div className="surface-heading">
            <div>
              <p className="section-label">Billing</p>
              <h2>All Billing Records</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--color-input-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }} />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--color-input-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }} />
            </div>
          </div>

          <div className="user-toolbar" style={{ marginBottom: 12 }}>
            <button className="ghost-button" onClick={beginCreateBilling} type="button">
              <Plus size={18} />
              New Billing Entry
            </button>
            <span className="sync-pill">{billings.length} records</span>
          </div>

          {loading ? (
            <p className="empty-state">Loading...</p>
          ) : (
            <DataTable
              columns={[
                { key: 'created_date', label: 'Date' },
                { key: 'uid_no', label: 'UID' },
                { key: 'workflow', label: 'Workflow' },
                { key: 'agency_name', label: 'Agency' },
                { key: 'mobile_no', label: 'Mobile' },
                { key: 'bill_no', label: 'Bill No' },
                { key: 'bill_amount', label: 'Bill Amount' },
                { key: 'amount_received', label: 'Amount Received' },
                { key: 'due_amount', label: 'Due Amount' },
                { key: 'payment_followup', label: 'Payment Followup' },
                { key: 'actions', label: 'Actions', sortable: false },
              ]}
              rows={billings.map((rec) => ({
                created_date: rec.created_date ?? '-',
                uid_no: rec.uid_no,
                workflow: <WorkflowStatusBadge uidNo={rec.uid_no} compact />,
                agency_name: rec.agency_name ?? '-',
                mobile_no: rec.mobile_no ?? '-',
                bill_no: rec.bill_no,
                bill_amount: money(rec.bill_amount),
                amount_received: money(rec.amount_received),
                due_amount: money(rec.due_amount),
                payment_followup: rec.payment_followup ?? '-',
                actions: (
                  <div className="row-actions user-actions">
                    <button className="icon-button" onClick={() => printBill(rec)} type="button" title="Print Bill">
                      <Printer size={17} />
                    </button>
                    <button className="icon-button" onClick={() => beginEditBilling(rec)} type="button" title="Edit">
                      <Pencil size={17} />
                    </button>
                    <button className="icon-button" onClick={() => void handleDeleteBilling(rec)} type="button" title="Delete">
                      <Trash2 size={17} />
                    </button>
                  </div>
                ),
              }))}
              exportable={true}
              filename="billing"
            />
          )}
        </section>
      )}

      {tab === 'due' && (
        <section className="surface">
          <div className="surface-heading">
            <div>
              <p className="section-label">Receivables</p>
              <h2>Due Payments Queue</h2>
            </div>
            <strong style={{ color: 'var(--color-accent)' }}>
              {money(dueItems.reduce((total, item) => total + item.balance_dues, 0))}
            </strong>
          </div>

          <div className="user-toolbar" style={{ marginBottom: 12 }}>
            <button className="ghost-button" onClick={handleSendAllSms} disabled={sendingAll} type="button">
              <Send size={18} />
              {sendingAll ? 'Sending...' : 'Send All Reminders'}
            </button>
            <span className="sync-pill">{dueItems.length} clients</span>
          </div>

          {loading ? (
            <p className="empty-state">Loading...</p>
          ) : (
            <DataTable
              columns={[
                { key: 'uid_no', label: 'UID' },
                { key: 'workflow', label: 'Workflow' },
                { key: 'agency_name', label: 'Agency' },
                { key: 'mobile_no', label: 'Mobile' },
                { key: 'total_payment', label: 'Total' },
                { key: 'advance_payment', label: 'Advance' },
                { key: 'balance_dues', label: 'Balance' },
                { key: 'payment_followup', label: 'Followup' },
                { key: 'actions', label: 'Actions', sortable: false },
              ]}
              rows={dueItems.map((item) => ({
                uid_no: item.uid_no,
                workflow: <WorkflowStatusBadge uidNo={item.uid_no} compact />,
                agency_name: (
                  <span style={{
                    color: item.color === 'red' ? '#d32f2f' : item.color === 'yellow' ? '#f9a825' : '#2e7d32',
                    fontWeight: 700,
                  }}>
                    {item.agency_name}
                  </span>
                ),
                mobile_no: item.mobile_no ?? '-',
                total_payment: money(item.total_payment),
                advance_payment: money(item.advance_payment),
                balance_dues: money(item.balance_dues),
                payment_followup: item.payment_followup ?? '-',
                actions: (
                  <div className="row-actions user-actions">
                    <button className="icon-button" onClick={() => beginEditRegistration(item)} type="button" title="Edit Payment">
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => void handleSendSms(item.id)}
                      disabled={sendingIds.has(item.id)}
                      type="button"
                      title="Send SMS Reminder"
                    >
                      <MessageSquare size={17} />
                    </button>
                  </div>
                ),
              }))}
              exportable={true}
              filename="due-payments"
            />
          )}
        </section>
      )}

      {tab === 'sms' && (
        <section className="surface">
          <div className="surface-heading">
            <div>
              <p className="section-label">Messages</p>
              <h2>SMS Reminder Log</h2>
            </div>
          </div>

          {loading ? (
            <p className="empty-state">Loading...</p>
          ) : (
            <DataTable
              columns={[
                { key: 'sent_date', label: 'Sent Date' },
                { key: 'uid_no', label: 'UID' },
                { key: 'agency_name', label: 'Agency' },
                { key: 'mobile_no', label: 'Mobile' },
                { key: 'total_amount', label: 'Total Amount' },
                { key: 'advance_amount', label: 'Advance' },
                { key: 'balance_amount', label: 'Balance' },
              ]}
              rows={smsLogs.map((log) => ({
                sent_date: log.sent_date ?? '-',
                uid_no: log.uid_no ?? '-',
                agency_name: log.agency_name ?? '-',
                mobile_no: log.mobile_no ?? '-',
                total_amount: money(log.total_amount),
                advance_amount: money(log.advance_amount),
                balance_amount: money(log.balance_amount),
              }))}
              exportable={true}
              filename="sms-log"
            />
          )}
        </section>
      )}

      {showBillingForm ? (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <form className="surface" onSubmit={handleBillingSubmit} style={{
            width: 'min(90vw, 600px)', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div className="surface-heading">
              <div>
                <p className="section-label">{editingBillingId ? 'Update' : 'Create'}</p>
                <h2>{editingBillingId ? 'Edit Billing' : 'New Billing Entry'}</h2>
              </div>
              <button className="icon-button" onClick={() => { setShowBillingForm(false); setEditingBillingId(null) }} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="field-row">
              <label>
                UID No
                <input value={billingForm.uid_no} onChange={(e) => setBillingForm({ ...billingForm, uid_no: e.target.value })} required />
              </label>
              <label>
                Bill No
                <input value={billingForm.bill_no} onChange={(e) => setBillingForm({ ...billingForm, bill_no: e.target.value })} required />
              </label>
            </div>

            <div className="field-row">
              <label>
                Bill Amount
                <input type="number" step="0.01" value={billingForm.bill_amount} onChange={(e) => setBillingForm({ ...billingForm, bill_amount: e.target.value })} required />
              </label>
              <label>
                Advance Amount
                <input type="number" step="0.01" value={billingForm.advance_amount} onChange={(e) => setBillingForm({ ...billingForm, advance_amount: e.target.value })} />
              </label>
            </div>

            <div className="field-row">
              <label>
                Mode of Payment
                <input value={billingForm.mode_of_payment} onChange={(e) => setBillingForm({ ...billingForm, mode_of_payment: e.target.value })} />
              </label>
              <label>
                Amount Received
                <input type="number" step="0.01" value={billingForm.amount_received} onChange={(e) => setBillingForm({ ...billingForm, amount_received: e.target.value })} />
              </label>
            </div>

            <div className="field-row">
              <label>
                Amount Received Date
                <input type="date" value={billingForm.amount_received_date} onChange={(e) => setBillingForm({ ...billingForm, amount_received_date: e.target.value })} />
              </label>
              <label>
                Due Amount
                <input type="number" step="0.01" value={billingForm.due_amount} onChange={(e) => setBillingForm({ ...billingForm, due_amount: e.target.value })} />
              </label>
            </div>

            <div className="field-row">
              <label>
                Discount
                <input type="number" step="0.01" value={billingForm.discount} onChange={(e) => setBillingForm({ ...billingForm, discount: e.target.value })} />
              </label>
              <label>
                Payment Followup
                <input value={billingForm.payment_followup} onChange={(e) => setBillingForm({ ...billingForm, payment_followup: e.target.value })} />
              </label>
            </div>

            <label>
              Remark
              <textarea value={billingForm.remark} onChange={(e) => setBillingForm({ ...billingForm, remark: e.target.value })} rows={2} />
            </label>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="ghost-button" onClick={() => { setShowBillingForm(false); setEditingBillingId(null) }} type="button">Cancel</button>
              <button type="submit">{editingBillingId ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {showRegForm ? (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <form className="surface" onSubmit={handleRegSubmit} style={{
            width: 'min(90vw, 500px)', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div className="surface-heading">
              <div>
                <p className="section-label">Update</p>
                <h2>Edit Registration Billing</h2>
              </div>
              <button className="icon-button" onClick={() => { setShowRegForm(false); setEditingRegId(null) }} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="field-row">
              <label>
                Total Payment
                <input type="number" step="0.01" value={regForm.total_payment} onChange={(e) => setRegForm({ ...regForm, total_payment: e.target.value })} />
              </label>
              <label>
                Advance Payment
                <input type="number" step="0.01" value={regForm.advance_payment} onChange={(e) => setRegForm({ ...regForm, advance_payment: e.target.value })} />
              </label>
            </div>

            <div className="field-row">
              <label>
                Balance Dues
                <input type="number" step="0.01" value={regForm.balance_dues} onChange={(e) => setRegForm({ ...regForm, balance_dues: e.target.value })} />
              </label>
              <label>
                Mode of Payment
                <input value={regForm.mode_of_payment} onChange={(e) => setRegForm({ ...regForm, mode_of_payment: e.target.value })} />
              </label>
            </div>

            <label>
              Payment Followup
              <input value={regForm.payment_followup} onChange={(e) => setRegForm({ ...regForm, payment_followup: e.target.value })} />
            </label>

            <label>
              Financial Remark
              <textarea value={regForm.financial_remark} onChange={(e) => setRegForm({ ...regForm, financial_remark: e.target.value })} rows={2} />
            </label>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="ghost-button" onClick={() => { setShowRegForm(false); setEditingRegId(null) }} type="button">Cancel</button>
              <button type="submit">Update</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
