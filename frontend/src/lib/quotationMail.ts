/** A mail ready to check and send, with the quotation as PDF. */
import type { MailDraft } from '../components/MailCompose'
import { dotDate, COMPANIES } from './bills'
import { SIGNATURE } from './mailCompose'
import { quotationPdf } from './quotationPdf'
import { esc } from './billPrint'
import { quotationFileName } from './quotationPrint'
import { quotationToInput, quotationsApi } from './quotations'

export async function quotationDraft(id: number, withSign: boolean): Promise<MailDraft> {
  const { data } = await quotationsApi.get(id)
  const q = quotationToInput(data)
  const name = quotationFileName(q)
  const file = new File([await quotationPdf(q, withSign && Boolean(COMPANIES[q.company].seal), name)], `${name}.pdf`, { type: 'application/pdf' })

  const subject = q.subject.trim().replace(/\s+/g, ' ')
  const place = q.location.trim().replace(/\s+/g, ' ')
  const about = [subject && `for <b>${esc(subject)}</b>`, place && `at ${esc(place)}`].filter(Boolean).join(' ')
  const line = (html: string) => `<div>${html}</div>`
  const gap = '<div><br></div>'
  const html = [
    line('Dear Sir / Madam,'), gap,
    line(`Please find attached our quotation <b>${esc(q.quotation_no)}</b> dated ${esc(dotDate(q.date))}${about ? ` ${about}` : ''}.`),
    q.valid_until ? line(`It is valid till ${esc(dotDate(q.valid_until))}.`) : '', gap,
    line('Kindly go through it and let us know if you need anything further.'), gap,
    SIGNATURE,
  ].join('')

  return {
    title: 'Write', to: q.email, cc: '', bcc: '', html, kept: [], files: [file], quotationId: id,
    subject: `Quotation ${q.quotation_no}${subject ? ` - ${subject}` : ''}`.slice(0, 480),
  }
}
