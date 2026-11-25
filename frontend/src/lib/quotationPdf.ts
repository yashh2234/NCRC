/** The printed quotation as a PDF file. */
import { READY, pagesPdf } from './pagesPdf'
import { FONT_URL, quotationDocument } from './quotationPrint'
import type { QuotationInput } from './quotations'

export const quotationPdf = (q: QuotationInput, withSign: boolean, title: string): Promise<Blob> =>
  pagesPdf(quotationDocument(q, withSign, READY), title, { selector: '#out > .page', fontUrl: FONT_URL })
