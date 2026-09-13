import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Download } from 'lucide-react'
import { api } from '../lib/api'
import { useTracking } from '../lib/useTracking'

interface UlrLink {
    id: number; uid_no: string; ulr_no: string; date: string
    name_of_department: string; name_of_agency: string; name_of_project: string
    sample_details: string; qty: string; parameters: string; testing_period: string
    sample_received_date: string | null; report_dispatch_date: string | null; bill_details: string; signature_remark: string
}

const emptyForm = { uid_no: '', date: new Date().toISOString().slice(0, 10), name_of_department: '', name_of_agency: '', name_of_project: '', sample_details: '', qty: '', parameters: '', testing_period: '', sample_received_date: '', report_dispatch_date: '', bill_details: '', signature_remark: '' }

export function UlrLinkPage() {
    useTracking('ulr_links')
    const [links, setLinks] = useState<UlrLink[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'list' | 'form'>('list')
    const [editingId, setEditingId] = useState<number | null>(null)
    const [form, setForm] = useState(emptyForm)
    const [error, setError] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const params: Record<string, string> = {}
            if (startDate && endDate) { params.start_date = startDate; params.end_date = endDate }
            const d = Object.keys(params).length > 0 ? await api.ulrLinksFiltered(params) : await api.ulrLinks()
            setLinks(d.data)
        } catch { setError('Failed to load') }
        finally { setLoading(false) }
    }, [startDate, endDate])

    useEffect(() => { void load() }, [load])

    const handleFilter = () => { void load() }
    const handleClearFilter = () => { setStartDate(''); setEndDate('') }

    const handleExport = async () => {
        try {
            const params: Record<string, string> = {}
            if (startDate && endDate) { params.start_date = startDate; params.end_date = endDate }
            const d = await api.ulrLinksExport(params)
            const rows = d.data
            const header = 'Date,ULR No,UID No,Agency,Project,Sample Details\n'
            const csv = header + rows.map(r => `"${r.date}","${r.ulr_no}","${r.uid_no}","${r.name_of_agency}","${r.name_of_project}","${r.sample_details}"`).join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `ulr_links_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
            URL.revokeObjectURL(url)
        } catch { setError('Failed to export') }
    }

    const handleCreate = () => { setEditingId(null); setForm(emptyForm); setView('form') }
    const handleEdit = (link: UlrLink) => { setEditingId(link.id); setForm({ uid_no: link.uid_no, date: link.date?.slice(0, 10) ?? '', name_of_department: link.name_of_department ?? '', name_of_agency: link.name_of_agency ?? '', name_of_project: link.name_of_project ?? '', sample_details: link.sample_details ?? '', qty: link.qty ?? '', parameters: link.parameters ?? '', testing_period: link.testing_period ?? '', sample_received_date: link.sample_received_date?.slice(0, 10) ?? '', report_dispatch_date: link.report_dispatch_date?.slice(0, 10) ?? '', bill_details: link.bill_details ?? '', signature_remark: link.signature_remark ?? '' }); setView('form') }
    const handleDelete = async (id: number) => { if (!confirm('Delete?')) return; try { await api.deleteUlrLink(id); void load() } catch { setError('Failed') } }
    const handleSave = async () => {
        try {
            if (editingId) { await api.updateUlrLink(editingId, form) }
            else { await api.createUlrLink(form) }
            setView('list'); void load()
        } catch { setError('Failed to save') }
    }
    const handleClientLookup = async () => {
        if (!form.uid_no.trim()) return
        try {
            const d = await api.ulrClientDetails(form.uid_no)
            if (d.data) setForm(f => ({ ...f, name_of_agency: d.data!.agency_name ?? f.name_of_agency, name_of_project: d.data!.name_of_work ?? f.name_of_project, sample_details: d.data!.sample_details ?? f.sample_details }))
        } catch { /* ignore */ }
    }
    const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

    if (view === 'form') return (
        <div className="surface" style={{ padding: 24 }}>
            <h2 style={{ marginBottom: 16 }}>{editingId ? 'Edit' : 'Create'} ULR Link</h2>
            {error ? <p style={{ color: '#c44a5a' }}>{error}</p> : null}
            <div className="form-grid-2">
                <label className="form-field"><span>UID No *</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input value={form.uid_no} onChange={e => update('uid_no', e.target.value)} />
                        <button className="ghost-button" onClick={() => void handleClientLookup()} type="button">Lookup</button>
                    </div>
                </label>
                <label className="form-field"><span>Date *</span><input type="date" value={form.date} onChange={e => update('date', e.target.value)} /></label>
                <label className="form-field"><span>Department</span><input value={form.name_of_department} onChange={e => update('name_of_department', e.target.value)} /></label>
                <label className="form-field"><span>Agency *</span><input value={form.name_of_agency} onChange={e => update('name_of_agency', e.target.value)} /></label>
                <label className="form-field"><span>Project</span><input value={form.name_of_project} onChange={e => update('name_of_project', e.target.value)} /></label>
                <label className="form-field"><span>Sample Details</span><input value={form.sample_details} onChange={e => update('sample_details', e.target.value)} /></label>
                <label className="form-field"><span>Qty</span><input value={form.qty} onChange={e => update('qty', e.target.value)} /></label>
                <label className="form-field"><span>Parameters</span><input value={form.parameters} onChange={e => update('parameters', e.target.value)} /></label>
                <label className="form-field"><span>Testing Period</span><input value={form.testing_period} onChange={e => update('testing_period', e.target.value)} /></label>
                <label className="form-field"><span>Sample Received Date</span><input type="date" value={form.sample_received_date} onChange={e => update('sample_received_date', e.target.value)} /></label>
                <label className="form-field"><span>Report Dispatch Date</span><input type="date" value={form.report_dispatch_date} onChange={e => update('report_dispatch_date', e.target.value)} /></label>
                <label className="form-field"><span>Bill Details</span><input value={form.bill_details} onChange={e => update('bill_details', e.target.value)} /></label>
                <label className="form-field" style={{ gridColumn: '1 / -1' }}><span>Signature Remark</span><input value={form.signature_remark} onChange={e => update('signature_remark', e.target.value)} /></label>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button className="primary-button" onClick={() => void handleSave()}>{editingId ? 'Update' : 'Create'}</button>
                <button className="ghost-button" onClick={() => setView('list')}>Cancel</button>
            </div>
        </div>
    )

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2>ULR Link Register</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #dfe6ea', borderRadius: 6, fontSize: '0.85rem' }} />
                        <span style={{ color: '#65737d' }}>to</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #dfe6ea', borderRadius: 6, fontSize: '0.85rem' }} />
                        <button className="ghost-button" onClick={handleFilter}>Go</button>
                        {(startDate || endDate) && <button className="ghost-button" onClick={handleClearFilter}>Clear</button>}
                    </div>
                    <button className="ghost-button" onClick={() => void handleExport()}><Download size={14} /> Export CSV</button>
                    <button className="primary-button" onClick={handleCreate}><Plus size={16} /> Create ULR</button>
                </div>
            </div>
            <section className="surface">
                {loading ? <p className="empty-state">Loading...</p>
                    : links.length === 0 ? <p className="empty-state">No ULR links found.</p>
                        : (
                            <table className="data-table">
                                <thead><tr><th>ULR No</th><th>UID No</th><th>Date</th><th>Agency</th><th>Project</th><th>Sample</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {links.map(l => (
                                        <tr key={l.id}>
                                            <td><strong>{l.ulr_no}</strong></td>
                                            <td>{l.uid_no}</td>
                                            <td>{l.date}</td>
                                            <td>{l.name_of_agency}</td>
                                            <td>{l.name_of_project}</td>
                                            <td>{l.sample_details}</td>
                                            <td style={{ display: 'flex', gap: 4 }}>
                                                <button className="icon-button" onClick={() => handleEdit(l)}><Pencil size={14} /></button>
                                                <button className="icon-button" onClick={() => void handleDelete(l.id)}><Trash2 size={14} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
            </section>
        </>
    )
}
