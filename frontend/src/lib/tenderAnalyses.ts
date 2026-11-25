/** Tender PDFs that the server reads in the background. */
import { createContext, useContext } from 'react'
import { BASE_URL, getToken, request } from './api'
import type { Tender, TenderInput, TenderSummary } from './tenders'

export interface TenderAnalysis {
  id: number
  /** null: a new tender will be made from it */
  tenderId: number | null
  file: string
  status: 'queued' | 'running' | 'done' | 'failed'
  error: string | null
  /** The AI was busy; the server tries again by itself */
  retrying: boolean
  /** Waiting to be started now */
  due: boolean
  canRetry: boolean
  createdAt: string | null
  finishedAt: string | null
}

export interface TenderAnalysisResult extends TenderAnalysis {
  summary: TenderSummary
  fields: Partial<TenderInput>
}

/** A PDF still on its way to the server */
export interface TenderUpload {
  key: number
  file: File
  tenderId: number | null
  progress: number
  error: string
}

export const MAX_PDF_MB = 50

export const tenderAnalysesApi = {
  list: () => request<{ data: TenderAnalysis[] }>('/tender-analyses').then((r) => r.data),
  get: (id: number) => request<{ data: TenderAnalysisResult }>(`/tender-analyses/${id}`).then((r) => r.data),
  run: (id: number) => request<{ data: TenderAnalysis }>(`/tender-analyses/${id}/run`, { method: 'POST' }).then((r) => r.data),
  retry: (id: number) => request<{ data: TenderAnalysis }>(`/tender-analyses/${id}/retry`, { method: 'POST' }).then((r) => r.data),
  attach: (id: number, tenderId: number) => request<{ data: Tender }>(`/tender-analyses/${id}/attach`, { method: 'POST', body: JSON.stringify({ tender_id: tenderId }) }).then((r) => r.data),
  close: (id: number) => request<{ message: string }>(`/tender-analyses/${id}`, { method: 'DELETE' }),
}

/** fetch() cannot tell how much of a big PDF is already sent, so XMLHttpRequest. */
export function uploadTenderPdf(file: File, tenderId: number | null, onProgress: (percent: number) => void): Promise<TenderAnalysis> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('document', file)
    if (tenderId !== null) form.append('tender_id', String(tenderId))
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE_URL}/tender-analyses`)
    xhr.setRequestHeader('Accept', 'application/json')
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onerror = () => reject(new Error('The upload was interrupted. Please check the connection.'))
    xhr.onload = () => {
      let payload: { data?: TenderAnalysis; message?: string } = {}
      try { payload = JSON.parse(xhr.responseText) } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && payload.data) resolve(payload.data)
      else reject(new Error(xhr.status === 413 ? 'The PDF is too large for the server upload limit.' : payload.message || 'Could not upload the PDF'))
    }
    xhr.send(form)
  })
}

export interface TenderAnalysesState {
  analyses: TenderAnalysis[]
  uploads: TenderUpload[]
  /** Uploads the PDF and has it read; returns at once. */
  start: (file: File, tenderId: number | null) => void
  retry: (analysis: TenderAnalysis) => void
  retryUpload: (upload: TenderUpload) => void
  dismiss: (id: number) => void
  dismissUpload: (key: number) => void
  refresh: () => Promise<void>
  /** Shows a finished one on the Tenders page */
  open: (id: number) => void
  /** What the Tenders page should show now */
  openId: number | null
  openHandled: () => void
}

export const TenderAnalysesContext = createContext<TenderAnalysesState | null>(null)

export function useTenderAnalyses(): TenderAnalysesState {
  const state = useContext(TenderAnalysesContext)
  if (!state) throw new Error('TenderAnalysesProvider is missing')
  return state
}
