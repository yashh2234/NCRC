import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Standard popup used across the app:
 *  - title (and optional small subtitle) top-left, ✕ close button top-right
 *  - body scrolls; header and footer stay fixed
 *  - footer bottom-right: [Cancel] [Save]  (only when onSubmit / onSave is given, or a custom footer)
 *  - closes with ✕, Cancel or Esc — clicking the dark background does NOT close (avoids losing typed data)
 */
interface ModalProps {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  /** sm = 480, md = 640 (default), lg = 900, xl = 1100, or a pixel width */
  size?: 'sm' | 'md' | 'lg' | 'xl' | number
  /** Renders the body as a <form>; the Save button submits it (so browser `required` checks run). */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
  /** Save without a form (Save button calls this). */
  onSave?: () => void
  saveLabel?: string
  saving?: boolean
  saveDisabled?: boolean
  cancelLabel?: string
  /** Extra content on the left side of the footer (e.g. a Delete button or a total). */
  footerLeft?: ReactNode
  /** Replace the default footer completely; pass null for no footer. */
  footer?: ReactNode | null
}

const SIZES = { sm: 480, md: 640, lg: 900, xl: 1100 }

export function Modal({
  title, subtitle, onClose, children, size = 'md', onSubmit, onSave,
  saveLabel = 'Save', saving = false, saveDisabled = false, cancelLabel = 'Cancel', footerLeft, footer,
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const width = typeof size === 'number' ? size : SIZES[size]
  const hasSave = Boolean(onSubmit || onSave)

  const footerContent = footer !== undefined ? footer : hasSave || footerLeft ? (
    <>
      {footerLeft ? <div className="ui-modal__footer-left">{footerLeft}</div> : null}
      <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>{cancelLabel}</button>
      {hasSave ? (
        <button type={onSubmit ? 'submit' : 'button'} className="btn btn-primary" onClick={onSubmit ? undefined : onSave} disabled={saving || saveDisabled}>
          {saving ? 'Saving…' : saveLabel}
        </button>
      ) : null}
    </>
  ) : null

  const inner = (
    <>
      <div className="ui-modal__header">
        <div className="ui-modal__title">
          {subtitle ? <p className="ui-modal__subtitle">{subtitle}</p> : null}
          <h2>{title}</h2>
        </div>
        <button type="button" className="ui-modal__close" onClick={onClose} title="Close" aria-label="Close"><X size={20} /></button>
      </div>
      <div className="ui-modal__body">{children}</div>
      {footerContent ? <div className="ui-modal__footer">{footerContent}</div> : null}
    </>
  )

  return (
    <div className="ui-modal-overlay">
      {onSubmit ? (
        <form className="ui-modal" role="dialog" aria-modal="true" style={{ maxWidth: width }} onSubmit={onSubmit}>{inner}</form>
      ) : (
        <div className="ui-modal" role="dialog" aria-modal="true" style={{ maxWidth: width }}>{inner}</div>
      )}
    </div>
  )
}
