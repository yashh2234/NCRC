/** A mail ready to check and send, with a lab report, invoice, performa invoice or credit note as PDF. */
import type { MailDraft } from '../components/MailCompose'
import { api } from './api'
import { FONT_URL_BILL, billDocument, billFileName, esc, performaFileName } from './billPrint'
import { COMPANIES, billToInput, billsApi, creditNoteInput, dotDate, money2, type BillInput } from './bills'
import { fullUlr } from './labFormats'
import { SIGNATURE } from './mailCompose'
import type { ComposeDocument } from './mailTab'
import { READY, pagesPdf } from './pagesPdf'
import { performaApi, performaToInput } from './performa'
import { reportPdf } from './reportPdf'

const line = (html: string) => `<div>${html}</div>`
const gap = '<div><br></div>'
const letter = (...lines: string[]) => [line('Dear Sir / Madam,'), gap, ...lines.filter(Boolean).map(line), gap, line('Kindly let us know if you need anything further.'), gap, SIGNATURE].join('')
const oneLine = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ')
const fileOf = (blob: Blob, name: string) => new File([blob], `${name.replace(/[\\/:*?"<>|]+/g, '-')}.pdf`, { type: 'application/pdf' })

/** Email of the client of this UID's registration, when there is one */
async function clientEmail(uid: string | null | undefined): Promise<string> {
  if (!uid?.trim()) return ''
  try {
    return (await billsApi.fromRegistration(uid.trim())).data.email
  } catch {
    return ''
  }
}

async function reportDraft(id: number, type: string): Promise<Partial<MailDraft>> {
  const { report, details } = (await api.reportDetail(type, id)) as unknown as { report: Record<string, unknown>; details: Record<string, unknown>[] }
  if (report.status !== 'Complete') throw new Error('This report is not approved, so it cannot be mailed.')
  const ulr = fullUlr(report.ulr_no, report.create_date)
  const name = ['Test Report', ulr || oneLine(report.uid_no)].join(' ')
  const work = oneLine(report.source_location)
  return {
    to: await clientEmail(String(report.uid_no ?? '')),
    subject: [name, oneLine(report.material_details)].filter(Boolean).join(' - '),
    html: letter(
      `Please find attached the test report <b>${esc(ulr || report.uid_no)}</b>${oneLine(report.material_details) ? ` of <b>${esc(oneLine(report.material_details))}</b>` : ''}${work ? ` for ${esc(work)}` : ''}.`,
      oneLine(report.reference_no) ? `Your reference: ${esc(oneLine(report.reference_no))}` : '',
    ),
    files: [fileOf(await reportPdf(type, report, details, name), name)],
  }
}

const billPdf = (b: BillInput, withSign: boolean, title: string, kind: { cn?: { no: string; date: string }; performa?: boolean } = {}) =>
  pagesPdf(billDocument(b, withSign && Boolean(COMPANIES[b.company].seal), READY, kind.cn, kind.performa), title, { fontUrl: FONT_URL_BILL })

async function billDraft(id: number, sign: boolean, asCreditNote: boolean): Promise<Partial<MailDraft>> {
  const { data } = await billsApi.get(id)
  if ((asCreditNote ? data.cn_approval : data.approval) !== 'approved') throw new Error(`${asCreditNote ? `Credit note ${data.credit_note_no ?? ''}` : `Invoice ${data.invoice_no}`} is not approved, so it cannot be mailed.`)
  const to = await clientEmail(data.uid_no)
  if (asCreditNote) {
    if (!data.credit_note_no) throw new Error('This invoice has no credit note.')
    const cn = { no: data.credit_note_no, date: data.credit_note_date ?? '' }
    const b = creditNoteInput(data)
    const name = billFileName(b, cn)
    return {
      to, subject: `Credit Note ${cn.no} against invoice ${data.invoice_no}`,
      html: letter(`Please find attached our credit note <b>${esc(cn.no)}</b> dated ${esc(dotDate(cn.date))} against invoice ${esc(data.invoice_no)} dated ${esc(dotDate(data.invoice_date))}, for ₹${money2(data.credit_amount)}.`),
      files: [fileOf(await billPdf(b, sign, name, { cn }), name)],
    }
  }
  const b = billToInput(data)
  const name = billFileName(b)
  return {
    to, subject: `Invoice ${data.invoice_no}${oneLine(data.client_name) ? ` - ${oneLine(data.client_name)}` : ''}`,
    html: letter(`Please find attached our invoice <b>${esc(data.invoice_no)}</b> dated ${esc(dotDate(data.invoice_date))} for ₹${money2(data.net_amount)}.`, 'Kindly arrange the payment; our bank details are on the invoice.'),
    files: [fileOf(await billPdf(b, sign, name), name)],
  }
}

async function performaDraft(id: number, sign: boolean): Promise<Partial<MailDraft>> {
  const { data } = await performaApi.get(id)
  if (data.approval !== 'approved') throw new Error(`Performa invoice ${data.invoice_no ?? ''} is not approved, so it cannot be mailed.`)
  const b = performaToInput(data)
  const name = performaFileName(b)
  return {
    to: await clientEmail(data.uid_no),
    subject: `Performa Invoice ${data.invoice_no ?? ''}${oneLine(data.client_name) ? ` - ${oneLine(data.client_name)}` : ''}`,
    html: letter(`Please find attached our performa invoice <b>${esc(data.invoice_no)}</b> dated ${esc(dotDate(data.invoice_date))} for ₹${money2(data.net_amount)}.`, 'Kindly arrange the payment; our bank details are on it.'),
    files: [fileOf(await billPdf(b, sign, name, { performa: true }), name)],
  }
}

export async function documentDraft(doc: ComposeDocument): Promise<MailDraft> {
  const draft = doc.type === 'report' ? await reportDraft(doc.id, doc.reportType)
    : doc.type === 'performa' ? await performaDraft(doc.id, doc.sign)
      : await billDraft(doc.id, doc.sign, doc.type === 'credit_note')
  return { title: 'Write', to: '', cc: '', bcc: '', subject: '', html: '', kept: [], ...draft, doc: { type: doc.type, id: doc.id } }
}
