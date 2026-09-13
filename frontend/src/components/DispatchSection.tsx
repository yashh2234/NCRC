import { useState, useEffect } from 'react'
import { Truck, Package, CheckCircle, Clock } from 'lucide-react'
import { request } from '../lib/api'

interface DispatchRecord {
  id: number
  work_order_id: number | null
  dispatch_date: string | null
  dispatch_method: string
  courier_name: string | null
  tracking_number: string | null
  recipient_name: string | null
  recipient_address: string | null
  received_by: string | null
  received_at: string | null
  status: string
  notes: string | null
  work_order?: { work_order_no: string } | null
}

interface DispatchSectionProps { jobId: number }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#f3f4f6', color: '#6b7280' },
  dispatched: { bg: '#fef3c7', color: '#92400e' },
  delivered: { bg: '#d1fae5', color: '#065f46' },
  returned: { bg: '#fce7f3', color: '#9d174d' },
}

export function DispatchSection({ jobId }: DispatchSectionProps) {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    request<{ data: DispatchRecord[] }>(`/jobs/${jobId}/dispatches`)
      .then(d => setDispatches(d.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [jobId])

  if (loading) return <p style={{ color: '#65737d', fontSize: '0.85rem' }}>Loading...</p>

  if (dispatches.length === 0) {
    return <p style={{ color: '#65737d', fontSize: '0.85rem' }}>No dispatch records yet.</p>
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {dispatches.map(d => {
        const st = STATUS_STYLE[d.status] ?? STATUS_STYLE.pending
        return (
          <div key={d.id} style={{ padding: '10px 14px', border: '1px solid #e8eef1', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Package size={16} style={{ color: '#65737d' }} />
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>{d.dispatch_method.replace(/_/g, ' ')}</strong>
                  {d.tracking_number ? <span style={{ fontSize: '0.78rem', color: '#65737d', marginLeft: 8 }}>#{d.tracking_number}</span> : null}
                </div>
              </div>
              <span className="sync-pill" style={{ background: st.bg, color: st.color, fontSize: '0.72rem' }}>{d.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.78rem', color: '#65737d', flexWrap: 'wrap' }}>
              {d.dispatch_date ? <span><Clock size={11} /> {new Date(d.dispatch_date).toLocaleDateString()}</span> : null}
              {d.courier_name ? <span><Truck size={11} /> {d.courier_name}</span> : null}
              {d.recipient_name ? <span>To: {d.recipient_name}</span> : null}
              {d.received_at ? <span><CheckCircle size={11} /> Received {new Date(d.received_at).toLocaleDateString()}</span> : null}
            </div>
            {d.notes ? <p style={{ fontSize: '0.76rem', color: '#4a5b66', marginTop: 4 }}>{d.notes}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
