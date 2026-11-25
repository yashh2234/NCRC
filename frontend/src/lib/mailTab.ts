/** Mail has its own browser tab: the same app, opened at #mail. */

const appUrl = () => `${window.location.origin}${import.meta.env.BASE_URL}`

/** This tab is the Mail tab */
export const IS_MAIL_TAB = window.location.hash.startsWith('#mail')

export interface ComposeQuotation { quotationId: number; sign: boolean }
export type DocumentType = 'report' | 'bill' | 'credit_note' | 'performa'
export interface ComposeDocument { type: DocumentType; id: number; sign: boolean; /** Report type of a lab report (cc_cube…) */ reportType: string }
const DOCUMENT_TYPES: DocumentType[] = ['report', 'bill', 'credit_note', 'performa']

/** #mail?quotation=12&sign=1, #mail?doc=bill&id=3&sign=1: write a mail with this document attached */
export const MAIL_COMPOSE: ComposeQuotation | ComposeDocument | null = (() => {
  if (!IS_MAIL_TAB) return null
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
  const type = DOCUMENT_TYPES.find((t) => t === params.get('doc'))
  const id = Number(params.get('id'))
  if (type && id > 0) return { type, id, sign: params.get('sign') === '1', reportType: params.get('report') ?? '' }
  const quotationId = Number(params.get('quotation'))
  return quotationId > 0 ? { quotationId, sign: params.get('sign') === '1' } : null
})()

export const quotationMailUrl = (id: number, sign: boolean) => `${appUrl()}#mail?quotation=${id}&sign=${sign ? 1 : 0}`

export const documentMailUrl = (type: DocumentType, id: number, sign = false, reportType = '') =>
  `${appUrl()}#mail?${new URLSearchParams({ doc: type, id: String(id), sign: sign ? '1' : '0', ...(reportType ? { report: reportType } : {}) })}`

/** Opens the Mail tab, or goes to it when it is open already. Call it straight from the click (pop-up blockers). */
export function openMailTab(): void {
  const w = window.open(`${appUrl()}#mail`, 'ncrc_mail')
  if (w) w.focus()
  else window.alert('Allow pop-ups for this site to open Mail in a new tab.')
}

/** Every mail with a document gets a tab of its own, so a mail being written in another tab is not touched */
export function openMailWindow(url = ''): Window | null {
  const w = window.open(url, '_blank')
  if (!w) window.alert('Allow pop-ups for this site to open Mail in a new tab.')
  return w
}

export function leaveMailTab(): void {
  window.close()
  // A tab the user opened by typing the address cannot close itself
  window.setTimeout(() => { window.location.href = appUrl() }, 150)
}
