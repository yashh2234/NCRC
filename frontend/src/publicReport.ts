/**
 * Public report page on reports.namotech.in (built separately, see vite.public.config.ts).
 * Opened from the QR code on an approved report: /r/{token} → the full report, as printed.
 * Talks only to /api/public/reports/{token} on its own domain; nothing else of the software is reachable.
 */
import { buildReportHtml } from './lib/reportPrint'

type Rec = Record<string, unknown>

function showMessage(title: string, body: string): void {
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = ''
  const box = document.createElement('div')
  box.className = 'msg'
  const h = document.createElement('h1')
  h.textContent = title
  const p = document.createElement('p')
  p.textContent = body
  box.append(h, p)
  root.append(box)
}

async function main(): Promise<void> {
  const token = window.location.pathname.match(/^\/r\/([A-Za-z0-9]{16,40})\/?$/)?.[1]
  if (!token) {
    showMessage('Namotech Consultancy Services LLP', 'Scan the QR code on a test report to view it.')
    return
  }
  try {
    const res = await fetch(`/api/public/reports/${token}`, { headers: { Accept: 'application/json' } })
    if (res.status === 404) {
      showMessage('Report not found', 'This report link is not valid, or the report is no longer approved. Please contact Namotech Consultancy Services LLP.')
      return
    }
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { type: string; report: Rec; details: Rec[] }
    // The report page replaces this one (same layout as the print)
    document.open()
    // A4-wide viewport: phones show the whole sheet scaled to the screen (pinch to zoom)
    const html = buildReportHtml(data.type, data.report, data.details, { qr: false })
      .replace('<head>', '<head><meta name="viewport" content="width=840"><meta name="robots" content="noindex, nofollow">')
    document.write(html)
    document.close()
  } catch {
    showMessage('Could not load the report', 'Please check your internet connection and scan again.')
  }
}

void main()
