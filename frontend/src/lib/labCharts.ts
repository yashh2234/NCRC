/**
 * Line charts of the Excel reports (grading curves, compaction curve), drawn as inline SVG so the
 * same chart shows on the report screen and prints with the report.
 */

export interface ChartSeries { name: string; color: string; points: Array<number | null> }

export interface ChartSpec {
  title: string
  yLabel: string
  xLabel?: string
  /** Category axis (sieve sizes) … */
  categories?: string[]
  /** … or numeric x values (compaction: moisture %) */
  xValues?: Array<number | null>
  series: ChartSeries[]
  /** Fixed y range (grading: 0–120); otherwise fitted to the data */
  yMin?: number
  yMax?: number
}

export const GRADING_COLORS = { lower: '#2563eb', upper: '#dc2626', combined: '#65a30d' }

const W = 640, H = 270, L = 56, R = 150, T = 34, B = 44

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const nice = (n: number) => Number(n.toFixed(3)).toString()

export function chartSvg(spec: ChartSpec): string {
  const values = spec.series.flatMap((s) => s.points).filter((p): p is number => p !== null && Number.isFinite(p))
  if (!values.length) return ''
  let yMin = spec.yMin ?? Math.min(...values)
  let yMax = spec.yMax ?? Math.max(...values)
  let dp = 0
  if (spec.yMin === undefined || spec.yMax === undefined) {
    // Round the fitted range to an even step (e.g. 2.080 … 2.200 by 0.020), like Excel's axis
    const raw = ((yMax - yMin) || Math.abs(yMax) || 1) * 1.3 / 6
    const mag = 10 ** Math.floor(Math.log10(raw))
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? raw
    yMin = Math.floor(yMin / step) * step
    yMax = yMin + step * 6
    while (yMax < Math.max(...values)) yMax += step
    dp = Math.max(0, -Math.floor(Math.log10(step)) + (step / mag === 2.5 ? 1 : 0))
  }
  const plotW = W - L - R, plotH = H - T - B
  const y = (v: number) => T + plotH - ((v - yMin) / (yMax - yMin)) * plotH

  // x positions: evenly spaced categories, or a numeric axis
  const n = spec.categories?.length ?? spec.xValues?.length ?? 0
  let xs: Array<number | null>
  let xTicks: Array<[number, string]>
  if (spec.categories) {
    const step = plotW / Math.max(1, n)
    xs = spec.categories.map((_, k) => L + step * (k + 0.5))
    xTicks = spec.categories.map((c, k) => [xs[k] as number, c])
  } else {
    const xv = (spec.xValues ?? []).filter((v): v is number => v !== null)
    if (!xv.length) return ''
    const xMin = Math.floor(Math.min(...xv)) - 1, xMax = Math.ceil(Math.max(...xv)) + 1
    const x = (v: number) => L + ((v - xMin) / (xMax - xMin)) * plotW
    xs = (spec.xValues ?? []).map((v) => (v === null ? null : x(v)))
    xTicks = Array.from({ length: xMax - xMin + 1 }, (_, k) => [x(xMin + k), (xMin + k).toFixed(2)])
  }

  const yTicks = Array.from({ length: 7 }, (_, k) => yMin + ((yMax - yMin) * k) / 6)
  const yText = (v: number) => (dp ? v.toFixed(dp) : nice(v))
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;font-family:Arial,sans-serif" role="img" aria-label="${esc(spec.title)}">`
  svg += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#fff" stroke="#999"/>`
  svg += `<text x="${L + plotW / 2}" y="20" text-anchor="middle" font-size="14" font-weight="bold">${esc(spec.title)}</text>`
  for (const v of yTicks) {
    svg += `<line x1="${L}" x2="${L + plotW}" y1="${y(v)}" y2="${y(v)}" stroke="#ddd"/>`
    svg += `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10">${yText(v)}</text>`
  }
  for (const [x, label] of xTicks) svg += `<text x="${x}" y="${T + plotH + 16}" text-anchor="middle" font-size="10">${esc(label)}</text>`
  svg += `<line x1="${L}" x2="${L + plotW}" y1="${T + plotH}" y2="${T + plotH}" stroke="#555"/><line x1="${L}" x2="${L}" y1="${T}" y2="${T + plotH}" stroke="#555"/>`
  svg += `<text transform="translate(14 ${T + plotH / 2}) rotate(-90)" text-anchor="middle" font-size="11" font-weight="bold">${esc(spec.yLabel)}</text>`
  if (spec.xLabel) svg += `<text x="${L + plotW / 2}" y="${H - 8}" text-anchor="middle" font-size="11" font-weight="bold">${esc(spec.xLabel)}</text>`

  spec.series.forEach((s, k) => {
    // Numeric axis: draw in x order (compaction points can be typed in any order)
    const pts = s.points
      .map((p, j) => (p !== null && Number.isFinite(p) && xs[j] !== null ? [xs[j] as number, y(p)] : null))
      .filter((p): p is number[] => p !== null)
      .sort((a, b) => (spec.categories ? 0 : a[0] - b[0]))
    if (pts.length) {
      svg += `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')}"/>`
      for (const [px, py] of pts) svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="${s.color}"/>`
    }
    const ly = T + 20 + k * 22
    svg += `<line x1="${L + plotW + 14}" x2="${L + plotW + 36}" y1="${ly}" y2="${ly}" stroke="${s.color}" stroke-width="2"/><circle cx="${L + plotW + 25}" cy="${ly}" r="3.5" fill="${s.color}"/>`
    svg += `<text x="${L + plotW + 42}" y="${ly + 4}" font-size="11">${esc(s.name)}</text>`
  })
  return svg + '</svg>'
}
