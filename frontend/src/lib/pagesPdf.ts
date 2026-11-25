/**
 * A printed document as a PDF file, made in the browser: the print is laid out in a hidden frame and each of its
 * A4 pages becomes a picture in the PDF, so it looks exactly like the print.
 */
import { toCanvas } from 'html-to-image'

const A4 = { width: 595.28, height: 841.89 }
/** About 240 dpi */
const SCALE = 2.5

interface PageImage { data: Uint8Array<ArrayBuffer>; width: number; height: number }

/** Put at the end of a document's script: it is laid out and can be turned into pages */
export const READY = "document.documentElement.setAttribute('data-ready', '1')"

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

/** Inter inside the pictures: each font file once (they hold all weights), Latin only. '' = the fallback font */
async function embeddedFonts(fontUrl: string): Promise<string> {
  if (!fontUrl) return ''
  try {
    const css = await (await fetch(fontUrl)).text()
    const faces = new Map<string, { style: string; range: string; weights: number[] }>()
    for (const [, subset, body] of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
      if (subset !== 'latin' && subset !== 'latin-ext') continue
      const url = body.match(/url\(([^)]+)\)/)?.[1].replace(/["']/g, '')
      const weight = Number(body.match(/font-weight:\s*(\d+)/)?.[1])
      if (!url || !weight) continue
      const face = faces.get(url) ?? { style: body.match(/font-style:\s*(\w+)/)?.[1] ?? 'normal', range: body.match(/unicode-range:\s*([^;]+)/)?.[1] ?? '', weights: [] }
      face.weights.push(weight)
      faces.set(url, face)
    }
    const rules = await Promise.all([...faces].map(async ([url, f]) => {
      const data = await blobToDataUrl(await (await fetch(url)).blob())
      const [from, to] = [Math.min(...f.weights), Math.max(...f.weights)]
      return `@font-face{font-family:"Inter";font-style:${f.style};font-weight:${from === to ? from : `${from} ${to}`};src:url(${data}) format("woff2");${f.range ? `unicode-range:${f.range};` : ''}}`
    }))
    return rules.join('')
  } catch {
    return ''
  }
}

/** A PDF with one JPEG per A4 page */
function buildPdf(pages: PageImage[], title: string): Blob {
  const parts: BlobPart[] = []
  const offsets: number[] = []
  let size = 0
  const encoder = new TextEncoder()
  const add = (chunk: string | Uint8Array<ArrayBuffer>) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk
    parts.push(bytes)
    size += bytes.length
  }
  const object = (id: number, write: () => void) => {
    offsets[id] = size
    add(`${id} 0 obj\n`)
    write()
    add('\nendobj\n')
  }
  const hexTitle = `FEFF${Array.from(title, (ch) => Array.from({ length: ch.length }, (_, i) => ch.charCodeAt(i).toString(16).padStart(4, '0')).join('')).join('')}`

  add('%PDF-1.4\n')
  add(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  object(1, () => add('<< /Type /Catalog /Pages 2 0 R >>'))
  object(2, () => add(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ')}] >>`))
  object(3, () => add(`<< /Title <${hexTitle.toUpperCase()}> >>`))
  pages.forEach((page, i) => {
    const id = 4 + i * 3
    const content = `q ${A4.width} 0 0 ${A4.height} 0 0 cm /Im0 Do Q`
    object(id, () => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`))
    object(id + 1, () => add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`))
    object(id + 2, () => {
      add(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.data.length} >>\nstream\n`)
      add(page.data)
      add('\nendstream')
    })
  })
  const start = size
  const count = 4 + pages.length * 3
  add(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (let id = 1; id < count; id += 1) add(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  add(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${start}\n%%EOF\n`)
  return new Blob(parts, { type: 'application/pdf' })
}

async function waitFor(ready: () => boolean): Promise<void> {
  const until = Date.now() + 30000
  while (!ready()) {
    if (Date.now() > until) throw new Error('The PDF could not be made (the page did not load in time).')
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }
}

/**
 * `html` = the whole print page, ending with READY. `pageElements` gives the A4 pages of it one by one, each as it
 * must look at that moment (default: every `selector` element). `fontUrl` = Google font CSS used by it, '' for system fonts.
 */
export async function pagesPdf(html: string, title: string, o: {
  selector?: string
  fontUrl?: string
  /** Shows page n and returns its element, null after the last one */
  showPage?: (doc: Document, n: number) => HTMLElement | null
}): Promise<Blob> {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:230mm;height:320mm;border:0;pointer-events:none'
  document.body.appendChild(frame)
  try {
    const doc = frame.contentDocument
    if (!doc) throw new Error('The PDF could not be made in this browser.')
    doc.open()
    doc.write(html)
    doc.close()
    const fonts = embeddedFonts(o.fontUrl ?? '')
    await waitFor(() => frame.contentDocument?.documentElement?.getAttribute('data-ready') === '1')
    const ready = frame.contentDocument as Document
    await Promise.all(Array.from(ready.images, (img) => img.decode().catch(() => undefined)))

    const fontEmbedCSS = await fonts
    const list = o.showPage ? [] : Array.from(ready.querySelectorAll<HTMLElement>(o.selector ?? '.page'))
    const pages: PageImage[] = []
    for (let n = 0; ; n += 1) {
      const page = o.showPage ? o.showPage(ready, n) : list[n]
      if (!page) break
      const canvas = await toCanvas(page, {
        pixelRatio: SCALE, backgroundColor: '#ffffff', fontEmbedCSS,
        width: page.offsetWidth, height: page.offsetHeight,
        style: { margin: '0', boxShadow: 'none' },
      })
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
      if (!blob) throw new Error('The PDF could not be made in this browser.')
      pages.push({ data: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height })
    }
    if (!pages.length) throw new Error('The PDF could not be made.')
    return buildPdf(pages, title)
  } finally {
    frame.remove()
  }
}
