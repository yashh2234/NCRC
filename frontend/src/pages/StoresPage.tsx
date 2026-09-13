import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { useTracking } from '../lib/useTracking'

interface Store {
    id: number
    name: string
    active: number
}

export function StoresPage() {
    useTracking('stores')
    const [stores, setStores] = useState<Store[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'list' | 'form'>('list')
    const [editingId, setEditingId] = useState<number | null>(null)
    const [name, setName] = useState('')
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        try { const d = await api.stores(); setStores(d.data) }
        catch { setError('Failed to load') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { void load() }, [load])

    const handleCreate = () => { setEditingId(null); setName(''); setView('form') }
    const handleEdit = (store: Store) => { setEditingId(store.id); setName(store.name); setView('form') }
    const handleDelete = async (id: number) => { if (!confirm('Delete?')) return; try { await api.deleteStore(id); void load() } catch { setError('Failed') } }
    const handleSave = async () => {
        try {
            if (editingId) { await api.updateStore(editingId, { name, active: 1 }) }
            else { await api.createStore({ name }) }
            setView('list'); void load()
        } catch { setError('Failed to save') }
    }

    if (view === 'form') return (
        <div className="surface" style={{ padding: 24 }}>
            <h2 style={{ marginBottom: 16 }}>{editingId ? 'Edit' : 'Create'} Store</h2>
            {error ? <p style={{ color: '#c44a5a' }}>{error}</p> : null}
            <div className="form-grid-2">
                <label className="form-field"><span>Store Name *</span><input value={name} onChange={e => setName(e.target.value)} /></label>
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
                <h2>Stores</h2>
                <button className="primary-button" onClick={handleCreate}><Plus size={16} /> Create Store</button>
            </div>
            <section className="surface">
                {loading ? <p className="empty-state">Loading...</p>
                    : stores.length === 0 ? <p className="empty-state">No stores found.</p>
                        : (
                            <table className="data-table">
                                <thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {stores.map(s => (
                                        <tr key={s.id}>
                                            <td>{s.id}</td>
                                            <td><strong>{s.name}</strong></td>
                                            <td>{s.active ? 'Active' : 'Inactive'}</td>
                                            <td style={{ display: 'flex', gap: 4 }}>
                                                <button className="icon-button" onClick={() => handleEdit(s)}><Pencil size={14} /></button>
                                                <button className="icon-button" onClick={() => void handleDelete(s.id)}><Trash2 size={14} /></button>
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
