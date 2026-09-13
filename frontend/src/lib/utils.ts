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
