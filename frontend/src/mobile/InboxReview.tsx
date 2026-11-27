import { useEffect, useState } from 'react'
import { BillReview } from '../components/BillReview'
import { QuotationReview } from '../components/QuotationReview'
import { Modal } from '../components/Modal'
import { billPreview } from '../lib/billPrint'
import { billToInput, billsApi, creditNoteApproval, creditNoteInput, type Bill } from '../lib/bills'
import { performaApi, performaToInput, type Performa } from '../lib/performa'
import { quotationsApi, type Quotation } from '../lib/quotations'
import type { ApprovalItem } from './mobileApi'

type Loaded =
  | { kind: 'quotation'; doc: Quotation }
  | { kind: 'bill' | 'credit_note'; doc: Bill }
  | { kind: 'performa'; doc: Performa }

/** Approve from the inbox: what changed, the print preview and Approve / Send back, without opening the whole page */
export function InboxReview({ item, onClose, onDecided, onEdit }: {
  item: ApprovalItem
  onClose: () => void
  /** Approved or sent back: take it off the list */
  onDecided: () => void
  /** "Edit" in the review: the full page of that document */
  onEdit: () => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async (): Promise<Loaded> => {
      if (item.kind === 'quotation') return { kind: 'quotation', doc: (await quotationsApi.get(item.id)).data }
      if (item.kind === 'performa') return { kind: 'performa', doc: (await performaApi.get(item.id)).data }
      return { kind: item.kind as 'bill' | 'credit_note', doc: (await billsApi.get(item.id)).data }
    }
    load().then(setLoaded).catch((e: Error) => setError(e.message))
  }, [item])

  if (error) {
    return <Modal title="Could not open" size="sm" onClose={onClose}><p className="m-error">{error}</p></Modal>
  }
  if (!loaded) {
    return <Modal title={item.title} size="sm" onClose={onClose}><div className="m-skeleton-list"><span /><span /></div></Modal>
  }

  if (loaded.kind === 'quotation') {
    return <QuotationReview quotation={loaded.doc} onClose={onClose} onEdit={onEdit} onDone={onDecided} />
  }

  if (loaded.kind === 'performa') {
    const p = loaded.doc
    return (
      <BillReview kind="performa invoice" subtitle={`${p.invoice_no ?? ''} · ${p.client_name ?? ''}`} approval={p}
        preview={billPreview(performaToInput(p), undefined, true)} onClose={onClose} onEdit={onEdit}
        onDecide={async (action, remark) => {
          await performaApi.decide(p.id, { action, remark, content_hash: p.content_hash ?? '' })
          onDecided()
        }} />
    )
  }

  const bill = loaded.doc
  const cn = loaded.kind === 'credit_note'
  return (
    <BillReview kind={cn ? 'credit note' : 'invoice'}
      subtitle={`${(cn ? bill.credit_note_no : bill.invoice_no) ?? ''} · ${bill.client_name ?? ''}`}
      approval={cn ? creditNoteApproval(bill) : bill}
      preview={cn ? billPreview(creditNoteInput(bill), { no: bill.credit_note_no ?? '', date: bill.credit_note_date ?? '' }) : billPreview(billToInput(bill))}
      onClose={onClose} onEdit={onEdit}
      onDecide={async (action, remark) => {
        await billsApi.decide(bill.id, { action, remark, credit_note: cn, content_hash: (cn ? bill.cn_content_hash : bill.content_hash) ?? '' })
        onDecided()
      }} />
  )
}
