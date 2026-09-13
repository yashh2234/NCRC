import { useState, useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import { Folder, File, Upload, Search, Trash2, Download, Eye, X, ChevronRight, ChevronDown } from 'lucide-react'
import { request } from '../lib/api'
import { DataTable } from '../components/DataTable'

interface CategoryNode {
  id: number
  name: string
  slug: string
  icon: string
  description: string | null
  documents_count: number
  children: CategoryNode[]
}

interface DocumentRecord {
  id: number
  title: string
  description: string | null
  file_name: string
  file_type: string | null
  file_extension: string | null
  file_size: number
  tags: string | null
  category_id: number | null
  created_at: string | null
  category?: { id: number; name: string } | null
  created_by?: { id: number; name: string } | null
  latest_version?: { version_number: number } | null
}

const FILE_ICONS: Record<string, string> = {
  pdf: '#ef4444', doc: '#3b82f6', docx: '#3b82f6',
  xls: '#10b981', xlsx: '#10b981',
  jpg: '#f59e0b', jpeg: '#f59e0b', png: '#f59e0b', gif: '#f59e0b',
  txt: '#6b7280', csv: '#6b7280',
}

function humanSize(bytes: number) {
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let b = bytes
  while (b > 1024 && i < u.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(1)} ${u[i]}`
}

function extColor(ext: string | null) {
  return FILE_ICONS[ext?.toLowerCase() ?? ''] ?? '#65737d'
}

export function DocumentLibraryPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set())

  // Upload form
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadCategory, setUploadCategory] = useState<number | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [docsData, catsData] = await Promise.all([
        request<{ data: DocumentRecord[] }>(`/documents?per_page=50${selectedCategory ? `&category_id=${selectedCategory}` : ''}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`),
        request<CategoryNode[]>('/documents/categories/tree'),
      ])
      setDocuments(docsData.data)
      setCategories(catsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadAll() }, [selectedCategory])

  const handleSearch = () => { void loadAll() }

  const toggleFolder = (id: number) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const renderTree = (nodes: CategoryNode[], depth = 0): ReactNode => (
    nodes.map((node) => (
      <div key={node.id}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
            cursor: 'pointer', borderRadius: 6, fontSize: '0.82rem', fontWeight: selectedCategory === node.id ? 700 : 500,
            background: selectedCategory === node.id ? '#edf6f4' : 'transparent',
            marginLeft: depth * 16,
          }}
          onClick={() => setSelectedCategory(selectedCategory === node.id ? null : node.id)}
        >
          {node.children.length > 0 ? (
            <span onClick={(e) => { e.stopPropagation(); toggleFolder(node.id) }} style={{ display: 'flex' }}>
              {collapsedCategories.has(node.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </span>
          ) : <span style={{ width: 14 }} />}
          <Folder size={16} fill="#e8eef1" stroke="#65737d" />
          <span style={{ flex: 1 }}>{node.name}</span>
          <span className="sync-pill" style={{ fontSize: '0.68rem', minHeight: 20 }}>{node.documents_count}</span>
        </div>
        {!collapsedCategories.has(node.id) && node.children.length > 0 ? renderTree(node.children, depth + 1) : null}
      </div>
    ))
  )

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('title', uploadTitle || uploadFile.name)
      if (uploadDesc) formData.append('description', uploadDesc)
      if (uploadTags) formData.append('tags', uploadTags)
      if (uploadCategory) formData.append('category_id', String(uploadCategory))

      const token = window.localStorage.getItem('legacy_erp_token')
      const res = await fetch('http://localhost:8000/api/documents', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      setShowUpload(false)
      setUploadFile(null)
      setUploadTitle('')
      setUploadDesc('')
      setUploadTags('')
      setUploadCategory(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally { setUploading(false) }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this document?')) return
    try {
      await request(`/documents/${id}`, { method: 'DELETE' })
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handlePreview = async (doc: DocumentRecord) => {
    setPreviewDoc(doc)
    setPreviewUrl(`http://localhost:8000/api/documents/${doc.id}/preview?t=${Date.now()}`)
  }

  const handleDownload = async (id: number) => {
    const token = window.localStorage.getItem('legacy_erp_token')
    const a = document.createElement('a')
    a.href = `http://localhost:8000/api/documents/${id}/download`
    a.target = '_blank'
    if (token) a.href += `?token=${token}`
    a.click()
  }

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'category', label: 'Folder' },
    { key: 'file', label: 'File' },
    { key: 'size', label: 'Size' },
    { key: 'tags', label: 'Tags' },
    { key: 'uploaded', label: 'Uploaded' },
    { key: 'actions', label: 'Actions', sortable: false },
  ]

  const rows: Array<Record<string, ReactNode>> = documents.map((doc) => ({
    title: <strong style={{ fontSize: '0.88rem' }}>{doc.title}</strong>,
    category: doc.category?.name ? <span className="sync-pill">{doc.category.name}</span> : '-',
    file: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem' }}>
        <File size={14} color={extColor(doc.file_extension)} />
        {doc.file_name}
      </span>
    ),
    size: <span style={{ fontSize: '0.82rem', color: '#65737d' }}>{humanSize(doc.file_size)}</span>,
    tags: doc.tags ? (
      <span style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {doc.tags.split(',').slice(0, 3).map((t) => <span key={t} className="sync-pill" style={{ fontSize: '0.68rem', minHeight: 20 }}>{t.trim()}</span>)}
      </span>
    ) : '-',
    uploaded: <span style={{ fontSize: '0.8rem', color: '#65737d' }}>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '-'}</span>,
    actions: (
      <div className="row-actions">
        <button className="icon-button" onClick={() => void handlePreview(doc)} type="button" title="Preview"><Eye size={15} /></button>
        <button className="icon-button" onClick={() => void handleDownload(doc.id)} type="button" title="Download"><Download size={15} /></button>
        <button className="icon-button" onClick={() => void handleDelete(doc.id)} type="button" title="Delete"><Trash2 size={15} /></button>
      </div>
    ),
  }))

  return (
    <div className="two-column" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Left: Folder tree */}
      <section className="surface" style={{ overflow: 'auto' }}>
        <div className="surface-heading">
          <div>
            <p className="section-label">Document Library</p>
            <h2>Folders</h2>
          </div>
          <Folder size={20} />
        </div>

        <div className="user-toolbar">
          <button className="ghost-button" onClick={() => setSelectedCategory(null)} type="button">All Documents</button>
        </div>

        <div style={{ marginTop: 8 }}>
          {categories.length === 0 ? (
            <p style={{ color: '#65737d', padding: 16, textAlign: 'center', fontSize: '0.82rem' }}>No folders yet. Upload a document to get started.</p>
          ) : renderTree(categories)}
        </div>
      </section>

      {/* Right: Document grid */}
      <section className="surface" style={{ overflow: 'auto' }}>
        <div className="surface-heading">
          <div>
            <p className="section-label">Documents</p>
            <h2>{selectedCategory ? categories.find(c => c.id === selectedCategory)?.name ?? 'Filtered' : 'All Documents'}</h2>
          </div>
          <button className="ghost-button" onClick={() => setShowUpload(true)} type="button"><Upload size={16} /> Upload</button>
        </div>

        <div className="user-toolbar">
          <div className="search-field" style={{ width: 240 }}>
            <input placeholder="Search documents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }} />
          </div>
          <button className="ghost-button" onClick={() => void handleSearch()} type="button"><Search size={16} /></button>
          <span className="sync-pill">{documents.length} files</span>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {loading ? (
          <p style={{ padding: 32, textAlign: 'center', color: '#65737d' }}>Loading...</p>
        ) : (
          <DataTable columns={columns} rows={rows} pageSize={15} filename="documents" />
        )}
      </section>

      {/* Upload modal */}
      {showUpload ? (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <form className="surface" style={{ width: 520 }} onClick={(e) => e.stopPropagation()} onSubmit={handleUpload}>
            <div className="surface-heading">
              <h2>Upload Document</h2>
              <button className="icon-button" onClick={() => setShowUpload(false)} type="button"><X size={18} /></button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); setUploadFile(e.dataTransfer.files[0] ?? null) }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#138a6b' : '#dfe6ea'}`, borderRadius: 8,
                padding: 32, textAlign: 'center', cursor: 'pointer', marginBottom: 12,
                background: dragOver ? '#edf6f4' : '#fbfcfd', transition: 'all 0.15s',
              }}
            >
              <input ref={fileInputRef} type="file" hidden onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
              {uploadFile ? (
                <div>
                  <File size={32} color={extColor(uploadFile.name.split('.').pop() ?? null)} />
                  <p style={{ fontWeight: 600, marginTop: 8 }}>{uploadFile.name}</p>
                  <p style={{ fontSize: '0.78rem', color: '#65737d' }}>{humanSize(uploadFile.size)}</p>
                  <button className="ghost-button" onClick={(e) => { e.stopPropagation(); setUploadFile(null) }} type="button" style={{ marginTop: 8 }}>Remove</button>
                </div>
              ) : (
                <div>
                  <Upload size={32} color="#65737d" />
                  <p style={{ fontWeight: 600, marginTop: 8 }}>Drag & drop a file here, or click to browse</p>
                  <p style={{ fontSize: '0.78rem', color: '#65737d' }}>Max 50MB</p>
                </div>
              )}
            </div>

            <label>Title *<input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder={uploadFile?.name ?? 'Document title'} /></label>
            <label>Description<textarea value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} rows={2} placeholder="Optional description" /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>Folder<select value={uploadCategory ?? ''} onChange={(e) => setUploadCategory(e.target.value ? Number(e.target.value) : null)}>
                <option value="">No folder</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select></label>
              <label>Tags<input value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} placeholder="comma,separated" /></label>
            </div>

            <div className="form-actions">
              <button className="ghost-button" onClick={() => setShowUpload(false)} type="button">Cancel</button>
              <button type="submit" disabled={!uploadFile || uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Preview modal */}
      {previewUrl && previewDoc ? (
        <div className="modal-overlay" onClick={() => { setPreviewUrl(null); setPreviewDoc(null) }}>
          <div className="surface" style={{ width: 800, height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="surface-heading">
              <div>
                <h2>{previewDoc.title}</h2>
                <p style={{ fontSize: '0.78rem', color: '#65737d' }}>{previewDoc.file_name} — {humanSize(previewDoc.file_size)}</p>
              </div>
              <div className="row-actions">
                <button className="icon-button" onClick={() => void handleDownload(previewDoc.id)} type="button" title="Download"><Download size={16} /></button>
                <button className="icon-button" onClick={() => { setPreviewUrl(null); setPreviewDoc(null) }} type="button"><X size={18} /></button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', background: '#f3f4f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewDoc.file_type?.startsWith('image/') ? (
                <img src={previewUrl} alt={previewDoc.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : previewDoc.file_type === 'application/pdf' ? (
                <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={previewDoc.title} />
              ) : (
                <div style={{ textAlign: 'center', color: '#65737d' }}>
                  <File size={64} />
                  <p>Preview not available for this file type.</p>
                  <button className="ghost-button" onClick={() => void handleDownload(previewDoc.id)} type="button" style={{ marginTop: 12 }}><Download size={16} /> Download to view</button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
