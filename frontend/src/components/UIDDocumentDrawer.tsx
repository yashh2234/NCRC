import { useCallback, useEffect, useState } from 'react'
import { X, FileText, Image as ImageIcon, History, Download, Eye, Folder, ShieldCheck } from 'lucide-react'
import { API_ORIGIN, request } from '../lib/api'

interface UIDDocumentDrawerProps {
  uidNo: string
  isOpen: boolean
  onClose: () => void
}

interface DocumentItem {
  id: number | string
  title: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  tags: string
  created_at: string | null
  category?: { name: string }
  latest_version?: { version_number: number }
  versions?: Array<{ id: number; version_number: number; change_notes: string; created_at: string }>
}

interface RegistrationAttachmentSource {
  uid_no: string
  received_date: string | null
  scan_copy?: string | null
  scan_copy_1?: string | null
  scan_copy_2?: string | null
  scan_copy_3?: string | null
  scan_copy_4?: string | null
  report_copy?: string | null
}

function isImagePath(path: string) {
  return /\.(jpe?g|png|gif|webp)$/i.test(path)
}

export function UIDDocumentDrawer({ uidNo, isOpen, onClose }: UIDDocumentDrawerProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [reportVersions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'photos'>('all')

  const loadUidDocuments = useCallback(async () => {
    if (!uidNo) return
    setLoading(true)
    try {
      const [documentResponse, registrationResponse] = await Promise.all([
        request<{ data: DocumentItem[] }>(`/documents?search=${encodeURIComponent(uidNo)}&per_page=100`),
        request<{ data: RegistrationAttachmentSource[] }>(`/registrations?uid_no=${encodeURIComponent(uidNo)}`),
      ])
      const storedDocuments = documentResponse.data ?? []
      const storedPaths = new Set(storedDocuments.map((document) => document.file_path))
      const registration = registrationResponse.data?.find((item) => item.uid_no === uidNo)
      const slots = [
        ['scan_copy', 'Registration document'],
        ['scan_copy_1', 'Registration document'],
        ['scan_copy_2', 'Registration document'],
        ['scan_copy_3', 'Registration document'],
        ['scan_copy_4', 'Registration document'],
        ['report_copy', 'Report copy'],
      ] as const
      const legacyDocuments = slots.flatMap(([field, label]) => {
        const path = registration?.[field]
        if (!path || storedPaths.has(path)) return []
        return [{
          id: `registration-${field}-${path}`,
          title: label,
          file_name: path.split('/').pop() || label,
          file_path: path,
          file_type: isImagePath(path) ? 'image/*' : 'application/octet-stream',
          file_size: 0,
          tags: 'registration',
          created_at: registration?.received_date ?? null,
          category: { name: 'Client Registrations' },
        }]
      })
      setDocuments([...storedDocuments, ...legacyDocuments])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [uidNo])

  useEffect(() => {
    if (isOpen && uidNo) {
      void loadUidDocuments()
    }
  }, [isOpen, uidNo, loadUidDocuments])

  if (!isOpen) return null

  const photos = documents.filter((d) => d.file_type?.startsWith('image/') || d.tags?.includes('sample_photo'))
  const displayedDocuments = activeTab === 'photos' ? photos : documents

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', justifyContent: 'flex-end',
      background: 'rgba(0, 0, 0, 0.25)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'var(--color-surface)', height: '100%',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--gray-50)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              padding: 8, borderRadius: 'var(--radius-sm)',
              background: 'var(--color-primary-tint)', color: 'var(--color-primary)',
            }}>
              <Folder size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--gray-900)' }}>UID Document Repository</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>UID:</span>
                <span className="sync-pill" style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '0.72rem' }}>
                  {uidNo}
                </span>
              </div>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {/* Category Tabs */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--color-border-light)',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--gray-50)',
        }}>
          <button
            className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('all')}
            type="button"
          >
            All Files ({documents.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'photos' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('photos')}
            type="button"
          >
            <ImageIcon size={14} /> Sample Photos ({photos.length})
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--gray-400)', textAlign: 'center', padding: '40px 0' }}>Loading UID repository files...</p>
          ) : documents.length === 0 && reportVersions.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius-lg)', background: 'var(--gray-50)',
            }}>
              <Folder size={36} style={{ margin: '0 auto 8px', color: 'var(--gray-300)' }} />
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--gray-700)' }}>No documents stored for this UID yet.</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--gray-400)', marginTop: 4 }}>Upload work orders, sample intake photos, or test reports.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {/* Report Version History Section */}
              {reportVersions.length > 0 ? (
                <div style={{
                  border: '1px solid var(--color-primary-ring)',
                  background: 'var(--color-primary-tint)',
                  borderRadius: 'var(--radius)',
                  padding: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <History size={15} style={{ color: 'var(--color-primary)' }} />
                    <h4 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Report Revision History (Version Control)
                    </h4>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {reportVersions.map((v) => (
                      <div key={v.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        fontSize: '0.78rem',
                      }}>
                        <div>
                          <strong style={{ fontWeight: 700, color: 'var(--gray-900)' }}>Version {v.version_number}</strong>
                          <span style={{ color: 'var(--gray-400)', marginLeft: 8 }}>({v.change_notes || 'Revision snapshot'})</span>
                          <small style={{ color: 'var(--gray-400)', display: 'block', marginTop: 2 }}>{v.created_at}</small>
                        </div>
                        <span className="badge badge-success">V{v.version_number} Saved</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* General Documents List */}
              <h4 style={{
                fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
              }}>
                <FileText size={14} /> Attached UID Files
              </h4>
              {displayedDocuments.map((doc) => (
                <div key={doc.id} style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  transition: 'border-color 0.15s',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary-ring)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      padding: 8, borderRadius: 'var(--radius-sm)', background: 'var(--gray-100)', flexShrink: 0,
                    }}>
                      {doc.file_type?.startsWith('image/') ? (
                        <ImageIcon size={18} style={{ color: 'var(--color-green)' }} />
                      ) : (
                        <FileText size={18} style={{ color: 'var(--color-primary)' }} />
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gray-900)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file_name}</strong>
                      <small style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{doc.category?.name || 'Document'} | {doc.created_at}</small>
                    </div>
                  </div>

                  <div className="uid-document-actions">
                    <a
                      href={`${API_ORIGIN}/storage/${doc.file_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline btn-sm"
                    >
                      <Eye size={14} /> View
                    </a>
                    <a
                      href={`${API_ORIGIN}/storage/${doc.file_path}`}
                      download={doc.file_name}
                      className="btn btn-outline btn-sm"
                    >
                      <Download size={14} /> Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--color-border-light)',
          background: 'var(--gray-50)',
          fontSize: '0.7rem', color: 'var(--gray-400)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={12} style={{ color: 'var(--color-green)' }} /> Immutable Version Control Enabled
          </span>
          <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Zero Overwriting</span>
        </div>
      </div>
    </div>
  )
}
