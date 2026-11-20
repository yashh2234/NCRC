import { api, BASE_URL, getToken, request } from './api'

export interface Tender {
  id: number
  srNo: string
  tenderId: string
  title: string
  department: string
  portal: string
  location: string
  value: string
  /** Our bid: an amount, or a percentage of the tender value when bidType is 'percent'. */
  bidValue: string
  bidType: string
  emd: string
  emdDeposited: string
  emdMode: string
  fee: string
  openDate: string
  preBidDate: string
  queryDate: string
  closingDate: string
  openingDate: string
  eligibility: string
  decision: string
  submissionStatus: string
  responsible: string
  requirements: string
  tenderLink: string
  driveLink: string
  remarks: string
  /** Set by the server when an AI summary of the tender document is saved. */
  hasSummary?: boolean
}

export type TenderInput = Omit<Tender, 'id' | 'srNo' | 'hasSummary'>

/** Where tenders used to live before they were stored on the server. */
const LEGACY_STORAGE_KEY = 'ncrc_tender_tracker'
const SR_PREFIX = 'NCS/TENDER'

export const DATE_FIELDS: Array<[keyof TenderInput, string]> = [
  ['openDate', 'Published / Open Date'],
  ['preBidDate', 'Pre-bid Meeting Date'],
  ['queryDate', 'Query Submission Deadline'],
  ['closingDate', 'Bid Submission Closing Date'],
  ['openingDate', 'Technical Bid Opening Date'],
]

const CLOSED_STATUSES = ['Submitted', 'Won', 'Lost', 'Not Participated']

function srNumber(srNo: string, year: number) {
  const match = srNo.match(/^NCS\/TENDER\/(\d{4})\/(\d+)$/)
  return match && Number(match[1]) === year ? Number(match[2]) : 0
}

export function nextSrNo(tenders: Array<Pick<Tender, 'srNo'>>, year = new Date().getFullYear()) {
  const max = tenders.reduce((highest, tender) => Math.max(highest, srNumber(tender.srNo || '', year)), 0)
  return `${SR_PREFIX}/${year}/${String(max + 1).padStart(3, '0')}`
}

let legacyUpload: Promise<void> | null = null

/**
 * Tenders used to be saved only in this browser's localStorage. Upload any that are
 * still here to the server once, then keep the old copy under a backup key.
 */
function uploadLegacyTenders(): Promise<void> {
  legacyUpload ??= (async () => {
    let list: Array<Partial<Tender>> = []
    try { list = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '[]') } catch { return }
    if (!Array.isArray(list) || list.length === 0) return
    await api.importTenders(list.map(({ id: _id, ...rest }) => rest))
    try {
      localStorage.setItem(`${LEGACY_STORAGE_KEY}_uploaded`, JSON.stringify(list))
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch { /* ignore */ }
  })().catch((error) => {
    legacyUpload = null // retry on the next load
    console.error('Could not upload locally saved tenders', error)
  })
  return legacyUpload
}

/** Loads the shared tender list from the server. */
export async function fetchTenders(): Promise<Tender[]> {
  await uploadLegacyTenders()
  const { data } = await api.tenders()
  return data
}

export function daysLeft(date: string): number | null {
  if (!date) return null
  return Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
}

export type Urgency = 'red' | 'yellow' | null

/** Red when 0–4 days left, yellow when 5–7 days left. Submitted / closed tenders are not flagged. */
export function tenderUrgency(tender: Tender): Urgency {
  if (CLOSED_STATUSES.includes(tender.submissionStatus)) return null
  const days = daysLeft(tender.closingDate)
  if (days === null || days < 0) return null
  if (days <= 4) return 'red'
  if (days <= 7) return 'yellow'
  return null
}

export const URGENCY_STYLES = {
  red: { background: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  yellow: { background: '#fef9c3', color: '#a16207', border: '#fde047' },
} as const

export function formatDate(date: string) {
  if (!date) return '-'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * Reads a rupee figure typed in free text: "Rs. 12,50,000", "12.5 Lakh", "1.2 Cr".
 * Returns null when there is no number in it.
 */
export function parseAmount(text: string): number | null {
  const t = (text || '').toLowerCase().replace(/,/g, '')
  const match = t.match(/\d+(?:\.\d+)?/)
  if (!match) return null
  let amount = parseFloat(match[0])
  if (/\b(cr|crs|crore|crores)\b/.test(t)) amount *= 1e7
  else if (/\b(l|lac|lacs|lakh|lakhs)\b/.test(t)) amount *= 1e5
  return amount
}

/** Our bid in rupees: the amount entered, or that percentage of the tender value. */
export function bidAmount(tender: Pick<Tender, 'value' | 'bidValue' | 'bidType'>): number | null {
  if (!tender.bidValue?.trim()) return null
  if (tender.bidType === 'percent') {
    const percent = parseFloat(tender.bidValue)
    const value = parseAmount(tender.value)
    return Number.isFinite(percent) && value !== null ? (value * percent) / 100 : null
  }
  return parseAmount(tender.bidValue)
}

export function formatRupees(amount: number) {
  return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

// ---------------------------------------------------------------- AI summary of the tender document

export interface TenderSummary {
  overview: string
  tender_id: string
  title: string
  department: string
  location: string
  portal: string
  tender_value: string
  emd: string
  emd_exemption: string
  tender_fee: string
  contract_period: string
  bid_validity: string
  contact: string
  dates: Array<{ label: string; date: string; time: string }>
  scope_of_work: string[]
  eligibility: string[]
  documents_required: string[]
  technical_requirements: string[]
  payment_terms: string[]
  penalties: string[]
  points_to_watch: string[]
  /** Places where the document contradicts itself (missing on summaries made before this was added). */
  conflicts?: string[]
}

export interface SavedTenderSummary {
  summary: TenderSummary
  file: string | null
  model: string | null
  analysed_at: string | null
  analysed_by: string | null
}

export function fetchTenderSummary(id: number) {
  return request<{ data: SavedTenderSummary | null }>(`/tenders/${id}/summary`).then((r) => r.data)
}

/** Uploads the tender PDF for analysis (multipart, so not the JSON request helper). */
export async function analyseTenderDocument(id: number, file: File): Promise<SavedTenderSummary> {
  const form = new FormData()
  form.append('document', file)
  const token = getToken()
  const response = await fetch(`${BASE_URL}/tenders/${id}/analyze`, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 413) throw new Error('The PDF is too large for the server upload limit.')
    throw new Error(payload.message ?? 'Could not analyse the document')
  }
  return payload.data as SavedTenderSummary
}
