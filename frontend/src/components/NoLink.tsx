import type { ReactNode } from 'react'

/** A record number in a list (quotation no., invoice no., UID…): click it to open that record */
export function NoLink({ onClick, children, title = 'Open', strike = false }: { onClick: () => void; children: ReactNode; title?: string; strike?: boolean }) {
  return (
    <button type="button" className={`no-link${strike ? ' no-link--strike' : ''}`} title={title}
      onClick={(e) => { e.stopPropagation(); onClick() }}>
      {children}
    </button>
  )
}
