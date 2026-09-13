import { useState, useEffect, useRef } from 'react'
import { Upload, FileText, Download, Trash2 } from 'lucide-react'
import { request } from '../lib/api'

interface DocItem {
  id: number
  title: string
  file_name: string
  file_type: string
  file_size: number
  tags: string | null
  created_at: string | null
  category?: { id: number; name: string } | null
  createdBy?: { id: number; name: string } | null
}

interface DocumentManagerProps { jobId: number }

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '#ef4444',
  'image/': '#3b82f6',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '#22c55e',
  'application/vnd.ms-excel': '#22c55e',
  'text/': '#6b7280',
}

export function DocumentManager({ jobId }: DocumentManagerProps) {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadDocs() }, [jobId])

  const loadDocs = async () => {
    setLoading(true)
    try {
      const d = await request<{ data: DocItem[] }>(`/documents?linked_job_id=${jobId}`)
      setDocs(d.data)
    } catch {} finally { setLoading(false) }
  }

  const upload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file || !title) { alert('Select a file and enter a title'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title)
      fd.append('linked_job_id', String(jobId))
      if (tags) fd.append('tags', tags)
      await request('/documents', { method: 'POST', body: fd } as any)
      setTitle('')
      setTags('')
      if (fileRef.current) fileRef.current.value = ''
      await loadDocs()
    } catch (e) { alert(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  const remove = async (doc: DocItem) => {
    if (!window.confirm('Delete this document?')) return
    await request(`/documents/${doc.id}`, { method: 'DELETE' })
    await loadDocs()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const getIconColor = (mime: string) => {
    for (const [prefix, color] of Object.entries(FILE_ICONS)) {
      if (mime.startsWith(prefix)) return color
    }
    return '#65737d'
  }

  return (
    <div>
      {/* Upload form */}
      <div style={{ padding: 12, border: '1px solid #e8eef1', borderRadius: 8, marginBottom: 12, background: '#fbfcfd' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Document title" style={{ flex: 1, fontSize: '0.82rem' }} />
          <input ref={fileRef} type="file" style={{ flex: 1, fontSize: '0.82rem' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags (comma separated)" style={{ flex: 1, fontSize: '0.82rem' }} />
          <button className="ghost-button" onClick={() => void upload()} type="button" disabled={uploading}>
            <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      {loading ? <p style={{ color: '#65737d', fontSize: '0.85rem' }}>Loading...</p> : null}

      {!loading && docs.length === 0 ? (
        <p style={{ color: '#65737d', fontSize: '0.85rem' }}>No documents uploaded yet.</p>
      ) : null}

      <div style={{ display: 'grid', gap: 6 }}>
        {docs.map(doc => (
          <div key={doc.id} style={{ padding: '8px 12px', border: '1px solid #e8eef1', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} style={{ color: getIconColor(doc.file_type) }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: '0.82rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</strong>
              <span style={{ fontSize: '0.72rem', color: '#65737d' }}>
                {doc.file_name} &middot; {formatSize(doc.file_size)}
                {doc.tags ? ` &middot; ${doc.tags}` : ''}
              </span>
            </div>
            <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="icon-button" type="button" title="Download"><Download size={14} /></button>
            </a>
            <button className="icon-button" onClick={() => void remove(doc)} type="button" title="Delete" style={{ color: '#ef4444' }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
