import { useMemo } from 'react'
import { LAB_FORMATS, effectiveValues, type Cell, type Line, type Values } from '../lib/labFormats'
import { chartSvg } from '../lib/labCharts'

/**
 * TEST RESULTS entry laid out like the lab's Excel format: fixed test names/methods/limits as text,
 * white boxes to type results, grey cells calculated with the Excel formulas.
 * The print (lib/reportPrint.ts) draws the same tables.
 */
export function LabFormatGrid({ formatKey, label, labData, details, updateLabData }: {
  formatKey: string
  label: string
  labData: Values
  details?: Array<Record<string, unknown>>
  updateLabData: (field: string, value: string) => void
}) {
  const format = LAB_FORMATS[formatKey]
  const { values, calc } = useMemo(() => effectiveValues(format, labData, details ?? []), [format, labData, details])
  const set = (key: string) => (e: { target: { value: string } }) => updateLabData(key, e.target.value)

  const renderLines = (lines?: Line[]) => (lines?.length ? (
    <div style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#334155' }}>
      {lines.map((line, k) => <p key={k} style={{ margin: '3px 0' }}>{typeof line === 'function' ? line(values, calc) : line}</p>)}
    </div>
  ) : null)

  const renderCell = (cell: Cell, k: number) => {
    const span = { rowSpan: cell.rs, colSpan: cell.cs }
    if ('text' in cell) {
      return <td key={k} {...span} style={{ ...cellStyle, textAlign: cell.left ? 'left' : 'center', fontWeight: cell.bold ? 600 : 400 }}>{cell.text}</td>
    }
    if ('calc' in cell) {
      return <td key={k} {...span} style={{ ...cellStyle, textAlign: 'center', background: '#f1f5f9', color: '#0f172a', fontWeight: 600 }} title="Calculated">{calc[cell.calc] || '—'}</td>
    }
    return (
      <td key={k} {...span} style={{ ...cellStyle, padding: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {cell.prefix ? <strong style={{ whiteSpace: 'nowrap' }}>{cell.prefix}</strong> : null}
          <input className="input" value={values[cell.in] ?? ''} onChange={set(cell.in)}
            style={{ width: '100%', minWidth: cell.wide ? 240 : 70, padding: '4px 6px', fontSize: '0.8rem', textAlign: cell.left || cell.wide ? 'left' : 'center' }} />
        </div>
      </td>
    )
  }

  return (
    <section style={{ marginTop: 28, border: '1px solid #e2e8f0', background: '#fff' }}>
      <div style={{ background: '#000', color: '#fff', textAlign: 'center', padding: 10, fontWeight: 700, textTransform: 'uppercase' }}>
        {label} — Test Results
      </div>

      {/* Header rows this format prints (environment, cube machine/curing…) and row counts */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: 12, borderBottom: '1px solid #e2e8f0', alignItems: 'end' }}>
        {(format.counts ?? []).map((cnt) => (
          <label key={cnt.key} style={labelCol}>{cnt.label}
            <select className="input" value={values[cnt.key] ?? String(cnt.min)} onChange={set(cnt.key)} style={{ width: 110 }}>
              {Array.from({ length: cnt.max - cnt.min + 1 }, (_, k) => cnt.min + k).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ))}
        {!format.header || format.header.some((h) => h.key === 'environment') ? (
          <>
            <label style={labelCol}>{format.envLabels?.[0] ?? 'Temperature'}
              <input className="input" value={values.h_temperature ?? ''} onChange={set('h_temperature')} style={{ width: 150 }} />
            </label>
            <label style={labelCol}>{format.envLabels?.[1] ?? 'Humidity'}
              <input className="input" value={values.h_humidity ?? ''} onChange={set('h_humidity')} style={{ width: 150 }} />
            </label>
          </>
        ) : null}
        {/* Header rows of this format typed here (mix designs: source, method, materials…) */}
        {[...(format.header ?? []).filter((h) => h.key.startsWith('h_')), ...(format.extras ?? [])].map((x) => (
          <label key={x.key} style={{ ...labelCol, flex: x.key === 'h_machine' || x.key === 'h_materials' ? '1 1 320px' : '0 1 200px' }}>{x.label}
            {'multiline' in x && x.multiline
              ? <textarea className="input" rows={Math.max(4, (values[x.key] ?? '').split(/\r?\n/).length)} value={values[x.key] ?? ''} onChange={set(x.key)} />
              : <input className="input" value={values[x.key] ?? ''} onChange={set(x.key)} />}
          </label>
        ))}
      </div>

      {format.blocks(values).map((block, b) => (
        <div key={b} style={{ overflowX: 'auto', borderBottom: '1px solid #e2e8f0' }}>
          {block.title ? <div style={{ padding: '8px 12px', fontWeight: 700, background: '#f8fafc', textAlign: 'center' }}>{block.title}</div> : null}
          {renderLines(block.before)}
          {block.heading ? <div style={{ padding: '8px 12px', fontWeight: 700 }}>{block.heading}</div> : null}
          {block.rows ? <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            {block.head ? (
              <thead>
                {block.head.map((row, r) => (
                  <tr key={r}>{row.map((cell, k) => (
                    <th key={k} rowSpan={cell.rs} colSpan={cell.cs} style={headerStyle}>{'text' in cell ? cell.text : ''}</th>
                  ))}</tr>
                ))}
              </thead>
            ) : null}
            <tbody>
              {block.rows.map((row, r) => <tr key={r}>{row.map(renderCell)}</tr>)}
            </tbody>
          </table> : null}
          {(() => {
            // Same chart as the print (grading / compaction curve), redrawn as values are typed
            const spec = block.chart?.(values, calc)
            const svg = spec ? chartSvg(spec) : ''
            return svg ? <div style={{ padding: 12, textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: svg }} /> : null
          })()}
          {renderLines(block.after)}
          {block.footKey ? (
            <div style={{ padding: 8 }}>
              <input className="input" value={values[block.footKey] ?? ''} onChange={set(block.footKey)} style={{ width: '100%', fontSize: '0.8rem' }} />
            </div>
          ) : null}
        </div>
      ))}
    </section>
  )
}

const labelCol = { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: '0.78rem', fontWeight: 600 }
const headerStyle = { background: '#000', color: '#fff', border: '1px solid #333', padding: 6, fontSize: '0.72rem', textTransform: 'uppercase' as const, whiteSpace: 'normal' as const, maxWidth: 260, verticalAlign: 'middle' as const }
const cellStyle = { border: '1px solid #e2e8f0', padding: 6, verticalAlign: 'middle' as const }
