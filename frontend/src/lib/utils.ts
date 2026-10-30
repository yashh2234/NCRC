export function formatDateForInput(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  const str = String(dateStr).trim()
  if (!str) return ''

  // ISO or YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str)) {
    const parts = str.substring(0, 10).split(/[-/.]/)
    if (parts.length === 3) {
      const [y, m, d] = parts
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(str)) {
    const parts = str.substring(0, 10).split(/[-/.]/)
    if (parts.length === 3) {
      const [d, m, y] = parts
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }

  // Generic Date parsing fallback
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const d = String(parsed.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return ''
}

/** Human-readable DD/MM/YYYY for tables; passes through values it can't parse. */
export function formatDisplayDate(dateStr: string | undefined | null): string {
  const iso = formatDateForInput(dateStr)
  if (!iso) return dateStr ? String(dateStr) : '-'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Tinted badge/button colours from one hex: light background, coloured text. */
export function softTone(color: string): { backgroundColor: string; color: string; borderColor: string } {
  const hex = /^#[0-9a-f]{3}$/i.test(color)
    ? '#' + color.slice(1).split('').map((c) => c + c).join('')
    : color
  return { backgroundColor: `${hex}1a`, color: hex, borderColor: `${hex}33` }
}
