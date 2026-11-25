import { type ReactNode } from 'react'
import { LAB_FORMATS, effectiveValues, type HeaderExtra, type Values } from '../lib/labFormats'
import { Select } from './Select'

/**
 * The header rows a lab format adds to the report (Temperature, Humidity, age, machine, brick type…),
 * as ordinary label + box rows of the report form. Formats without temperature / humidity keep the
 * plain Environment Condition row given as `environment`.
 */
export function LabHeaderFields({ formatKey, labData, details, updateLabData, environment, gap = 8 }: {
  formatKey: string
  labData: Values
  details?: Array<Record<string, unknown>>
  updateLabData: (field: string, value: string) => void
  environment?: ReactNode
  /** Space between label and box, as in the form around it */
  gap?: number
}) {
  const format = LAB_FORMATS[formatKey]
  if (!format) return <>{environment}</>
  const { values } = effectiveValues(format, labData, details ?? [])
  const hasEnv = !format.header || format.header.some((h) => h.key === 'environment')

  const input = (key: string, label: string, extra: React.CSSProperties = {}) => (
    <input className="input" aria-label={label} value={values[key] ?? ''} onChange={(e) => updateLabData(key, e.target.value)} style={extra} />
  )
  const row = (key: string, label: string, node: ReactNode) => (
    <div key={key} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 250px) 1fr', alignItems: 'center', gap }}>
      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{label}</span>
      {node}
    </div>
  )
  const select = (key: string, label: string, options: Array<[string, string]>, fallback: string) => row(key, label, (
    <Select className="input" aria-label={label} value={options.some(([o]) => o === (values[key] ?? '')) ? values[key] ?? '' : fallback} onChange={(e) => updateLabData(key, e.target.value)}>
      {options.map(([o, text]) => <option key={o} value={o}>{text}</option>)}
    </Select>
  ))

  type Field = { key: string; label: string; multiline?: boolean; parts?: HeaderExtra['parts'] }
  const fields: Field[] = [...(format.header ?? []).filter((h) => h.key.startsWith('h_')), ...(format.extras ?? [])]

  return (
    <>
      {(format.selects ?? []).map((x) => select(x.key, x.label, x.options, x.options[0][0]))}
      {hasEnv ? (
        <>
          {row('h_temperature', format.envLabels?.[0].replace(/^a\. /, '') ?? 'Temperature', input('h_temperature', 'Temperature'))}
          {row('h_humidity', format.envLabels?.[1].replace(/^b\. /, '') ?? 'Humidity', input('h_humidity', 'Humidity'))}
        </>
      ) : environment}
      {fields.map((x) => row(x.key, x.label, x.parts ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(90px, 1fr) minmax(0, 1.4fr)', gap: 8 }}>
          {x.parts.map((p) => (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {p.prefix ? <span style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{p.prefix.trim()}</span> : null}
              {input(p.key, p.label, { minWidth: 0, flex: 1 })}
            </div>
          ))}
        </div>
      ) : x.multiline ? (
        <textarea className="input" aria-label={x.label} rows={Math.max(4, (values[x.key] ?? '').split(/\r?\n/).length)} value={values[x.key] ?? ''} onChange={(e) => updateLabData(x.key, e.target.value)} />
      ) : input(x.key, x.label)))}
      {(format.counts ?? []).map((n) => select(n.key, n.label, Array.from({ length: n.max - n.min + 1 }, (_, k): [string, string] => [String(n.min + k), String(n.min + k)]), String(n.min)))}
    </>
  )
}
