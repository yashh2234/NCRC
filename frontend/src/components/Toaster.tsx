import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { onToast, type ToastMessage } from '../lib/toast'

/** Shows toasts at the top centre; each goes away by itself */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => onToast((t) => {
    setToasts((all) => [...all.slice(-2), t])
    window.setTimeout(() => setToasts((all) => all.filter((x) => x.id !== t.id)), 2600)
  }), [])

  if (!toasts.length) return null
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.kind === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
