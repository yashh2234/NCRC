/**
 * An approved lab report as a PDF file. The print flows over A4 pages by itself (margins 12 / 10 mm); here the same
 * layout is cut into pages at row and block edges, so a row is never split.
 */
import { READY, pagesPdf } from './pagesPdf'
import { buildReportHtml } from './reportPrint'

type Rec = Record<string, unknown>

const PX = 96 / 25.4
const BODY_HEIGHT = Math.floor((297 - 24) * PX)

/** What print does to the page, for the screen layout in the hidden frame */
const SHEET_CSS = `<style>
body{background:#fff!important;padding:0!important}
.sheet{width:190mm!important;max-width:none!important;margin:0!important;padding:0!important;box-shadow:none!important}
.pg-break{border-top:0!important;margin-top:0!important}
#pdf-page{width:210mm;height:297mm;padding:12mm 10mm;background:#fff;overflow:hidden}
#pdf-clip{width:190mm;overflow:hidden}
</style></head>`

/** Where each page starts and ends, in px from the top of the sheet */
export function pageCuts(sheet: HTMLElement, height: number): Array<[number, number]> {
  const top = sheet.getBoundingClientRect().top
  const y = (el: Element) => el.getBoundingClientRect().top - top
  const total = Math.ceil(sheet.getBoundingClientRect().height)
  const forced = Array.from(sheet.querySelectorAll('.pg-break'), y)
  // A page may end before any of these, but not between a heading and its table
  const edges = Array.from(sheet.querySelectorAll('.info tr, .res tr, .blk-title, .blk-head, .para, .chart, .foot'))
    .filter((el) => {
      const before = el.tagName === 'TR' && !el.previousElementSibling ? el.closest('table')?.previousElementSibling : el.previousElementSibling
      return !before || !/\bblk-(title|head)\b/.test(before.className)
    })
    .map(y).sort((a, b) => a - b)

  const cuts: Array<[number, number]> = []
  let start = 0
  while (start < total - 1) {
    const limit = start + height
    const must = forced.find((f) => f > start + 1 && f <= limit)
    let end = must ?? (total <= limit ? total : undefined)
    if (end === undefined) end = edges.filter((e) => e > start + 1 && e <= limit).at(-1) ?? limit
    cuts.push([start, end])
    start = end
  }
  return cuts
}

export function reportPdf(type: string, report: Rec, details: Rec[], title: string): Promise<Blob> {
  const html = buildReportHtml(type, report, details)
    .replace('</head>', SHEET_CSS)
    .replace('</body>', `<script>window.addEventListener('load', function () { ${READY} })</script></body>`)
  let cuts: Array<[number, number]> = []
  return pagesPdf(html, title, {
    showPage: (doc, n) => {
      const sheet = doc.querySelector('.sheet') as HTMLElement
      if (n === 0) {
        cuts = pageCuts(sheet, BODY_HEIGHT)
        const page = doc.createElement('div')
        page.id = 'pdf-page'
        page.innerHTML = '<div id="pdf-clip"></div>'
        doc.body.appendChild(page)
        page.firstElementChild?.appendChild(sheet)
      }
      const cut = cuts[n]
      if (!cut) return null
      const clip = doc.getElementById('pdf-clip') as HTMLElement
      clip.style.height = `${cut[1] - cut[0]}px`
      sheet.style.setProperty('margin-top', `-${cut[0]}px`, 'important')
      return doc.getElementById('pdf-page')
    },
  })
}
