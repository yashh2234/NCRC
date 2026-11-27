import { useMemo } from 'react'
import { CircleMinus, Plus, RotateCcw } from 'lucide-react'
import { LAB_FORMATS, effectiveValues, type Block, type Cell, type Line, type Row, type Values } from '../lib/labFormats'
import { addListRow, addTableRow, deletedCount, layoutBlocks, removeListRow, removeTableRow, restoreTable, type RowRef } from '../lib/labRows'
import { ComboInput } from './ComboInput'
import { chartSvg } from '../lib/labCharts'
import { useMobileLayout } from '../mobile/useMobile'

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
  // Phone app: each row of the sheet is a card with labelled boxes
  const [phone] = useMobileLayout()
  const set = (key: string) => (e: { target: { value: string } }) => updateLabData(key, e.target.value)

  const patch = (p: Values) => Object.entries(p).forEach(([key, value]) => updateLabData(key, value))

  const addRow = (ref: RowRef) => patch('list' in ref ? addListRow(values, ref.list) : addTableRow(labData, ref.table, ref.token))
  const deleteRow = (ref: RowRef, row: Cell[]) => {
    // Values of the whole set / sample / sieve, or the boxes of this row only (not shared ones like Age)
    const own = !('list' in ref) ? '' : ref.list.key === 'n_sets' || ref.list.key === 'n_samples' ? `s${ref.list.id}_` : ref.list.key.endsWith('_sieves') ? `${ref.list.key.slice(0, -7)}${ref.list.id}_` : ''
    const typed = own
      ? Object.entries(labData).some(([k, x]) => k.startsWith(own) && x)
      : row.some((c) => 'in' in c && !(c.rs && c.rs > 1) && labData[c.in])
    if (typed && !window.confirm('Delete this row and the values typed in it?')) return
    patch('list' in ref ? removeListRow(values, ref.list) : removeTableRow(labData, ref.table, ref.token))
  }
  /** "+ Add" below a table: a new row after its last one (cubes: a new set; cubes have their own buttons) */
  const addBelow = (block: Block) => {
    const refs = (block.refs ?? []).filter((r): r is RowRef => !!r)
    const sets = refs.filter((r) => isSet(r))
    const last = (sets.length ? sets : refs).at(-1)
    if (last) return addRow(last)
    if (block.table) patch(addTableRow(labData, block.table, ''))
  }
  /** The last cube row of each set, for the "Add cube" buttons */
  const lastCubes = (block: Block): RowRef[] => (block.refs ?? []).filter((ref, r): ref is RowRef => {
    const next = block.refs?.[r + 1]
    return !!ref && 'list' in ref && /^s\d+_n$/.test(ref.list.key) && !(next && 'list' in next && next.list.key === ref.list.key)
  })

  const renderLines = (lines?: Line[]) => (lines?.length ? (
    <div style={{ marginLeft: GUTTER, padding: '6px 12px', fontSize: '0.8rem', color: '#334155' }}>
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
      <td key={k} {...span} style={cellStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {cell.prefix ? <strong style={{ whiteSpace: 'nowrap' }}>{cell.prefix}</strong> : null}
          {cell.options ? <ComboInput options={cell.options} value={values[cell.in] ?? ''} onChange={(x) => updateLabData(cell.in, x)} /> : <input className="input" value={showDate(values[cell.in])} onChange={set(cell.in)}
            style={{ width: '100%', minWidth: cell.wide ? 240 : /_(cast|test|collect|date)$|^(test|collect)$/.test(cell.in) ? 112 : /^loc$|_(loc|name)$/.test(cell.in) ? 190 : 72, padding: '8px 10px', fontSize: '0.84rem', textAlign: cell.left || cell.wide ? 'left' : 'center' }} />}
        </div>
      </td>
    )
  }

  if (phone) {
    return (
      <section className="lab-results m-lab">
        <div className="m-lab__title">{format.name?.(values) ?? label} — Test Results</div>
        {layoutBlocks(format, values).map((block, b) => {
          const labels = columnLabels(block.head)
          return (
            <div key={b} className="m-lab__block">
              {block.title ? <h3 className="m-lab__heading">{block.title}</h3> : null}
              {renderLines(block.before)}
              {block.heading ? <h3 className="m-lab__heading">{block.heading}</h3> : null}
              {block.rows ? rowItems(block.rows).map((items, r) => {
                const ref = block.refs?.[r]
                const own = items.filter((x) => x.own && !('text' in x.cell))
                const titles = [...new Set(items.filter((x) => 'text' in x.cell).map((x) => (x.cell as { text: string }).text.trim()).filter(Boolean))]
                if (!own.length) {
                  // Fixed lines (limits, "As per IS Code"): read only
                  return titles.length ? <p key={r} className="m-lab__info">{titles.join(' · ')}</p> : null
                }
                return (
                  <div key={r} className="m-lab__row">
                    <div className="m-lab__rowhead">
                      <strong>{titles.join(' · ') || `Row ${r + 1}`}</strong>
                      {ref ? <button type="button" className="m-lab__del" onClick={() => deleteRow(ref, block.rows?.[r] ?? [])} aria-label={isSet(ref) ? 'Delete this set' : 'Delete this row'}><CircleMinus size={18} color="#dc2626" /></button> : null}
                    </div>
                    <div className="m-lab__fields">
                      {own.map(({ cell, col }, k) => {
                        const name = labels[col] || items.filter((x) => x.col < col && 'text' in x.cell).map((x) => (x.cell as { text: string }).text).at(-1) || ''
                        if ('calc' in cell) {
                          return <div key={k} className="m-lab__field m-lab__field--calc"><span>{name}</span><output>{calc[cell.calc] || '—'}</output></div>
                        }
                        if (!('in' in cell)) return null
                        return (
                          <label key={k} className={`m-lab__field${cell.wide ? ' m-lab__field--wide' : ''}`}>
                            <span>{cell.prefix ? `${cell.prefix} ` : ''}{name}</span>
                            {cell.options
                              ? <ComboInput options={cell.options} value={values[cell.in] ?? ''} onChange={(x) => updateLabData(cell.in, x)} />
                              : <input className="input" inputMode={/_(cast|test|collect|date|loc|name)$|^(test|collect|loc)$/.test(cell.in) || cell.wide ? 'text' : 'decimal'} value={showDate(values[cell.in])} onChange={set(cell.in)} />}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              }) : null}
              {block.refs ? (
                <div className="m-lab__add">
                  {lastCubes(block).map((ref, k, all) => (
                    <button key={k} type="button" style={addButton} onClick={() => addRow(ref)}><Plus size={15} /> Add cube{all.length > 1 ? ` (${String.fromCharCode(65 + k)})` : ''}</button>
                  ))}
                  <button type="button" style={addButton} onClick={() => addBelow(block)}><Plus size={15} /> {block.refs.some((r) => isSet(r)) ? 'Add set' : 'Add row'}</button>
                  {block.table && deletedCount(labData, block.table) ? (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => patch(restoreTable(block.table as string))}><RotateCcw size={13} /> Restore deleted rows ({deletedCount(labData, block.table)})</button>
                  ) : null}
                </div>
              ) : null}
              {(() => {
                const spec = block.chart?.(values, calc)
                const svg = spec ? chartSvg(spec) : ''
                return svg ? <div className="m-lab__chart" dangerouslySetInnerHTML={{ __html: svg }} /> : null
              })()}
              {renderLines(block.after)}
              {block.footKey ? <input className="input" value={values[block.footKey] ?? ''} onChange={set(block.footKey)} style={{ width: '100%', marginTop: 10 }} /> : null}
            </div>
          )
        })}
      </section>
    )
  }

  return (
    <section className="lab-results">
      <div style={{ marginLeft: GUTTER, background: '#000', color: '#fff', textAlign: 'center', padding: '14px 12px', fontWeight: 700, textTransform: 'uppercase' }}>
        {format.name?.(values) ?? label} — Test Results
      </div>

      {layoutBlocks(format, values).map((block, b) => (
        <div key={b} style={{ overflowX: 'auto', marginTop: b ? 28 : 0 }}>
          {block.title ? <div style={{ marginLeft: GUTTER, padding: '14px 12px', fontWeight: 700, textAlign: 'center' }}>{block.title}</div> : null}
          {renderLines(block.before)}
          {block.heading ? <div style={{ marginLeft: GUTTER, padding: '14px 2px 10px', fontWeight: 700 }}>{block.heading}</div> : null}
          {block.rows ? <table style={{ width: '100%', minWidth: Math.max(820, 110 * (block.head?.[0] ?? block.rows[0] ?? []).reduce((n, c) => n + (c.cs ?? 1), 0)), borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            {block.head ? (
              <thead>
                {block.head.map((row, r) => (
                  <tr key={r}>{block.refs && r === 0 ? <th rowSpan={block.head?.length} style={gutterCell} aria-label="Row options" /> : null}{row.map((cell, k) => (
                    <th key={k} rowSpan={cell.rs} colSpan={cell.cs} style={headerStyle}>{'text' in cell ? cell.text : ''}</th>
                  ))}</tr>
                ))}
              </thead>
            ) : null}
            <tbody>
              {block.rows.map((row, r) => {
                const ref = block.refs?.[r]
                return (
                  <tr key={r}>
                      {block.refs ? (
                        <td style={gutterCell}>
                          {ref ? (
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <button type="button" style={iconButton} title={isSet(ref) ? 'Delete this set' : 'Delete this row'} aria-label={isSet(ref) ? 'Delete this set' : 'Delete this row'} onClick={() => deleteRow(ref, row)}><CircleMinus size={17} color="#dc2626" /></button>
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                      {row.map(renderCell)}
                    </tr>
                )
              })}
            </tbody>
          </table> : null}
          {block.refs ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: `16px 0 4px ${GUTTER}px` }}>
              {lastCubes(block).map((ref, k, all) => (
                <button key={k} type="button" style={addButton} onClick={() => addRow(ref)}><Plus size={15} /> Add cube{all.length > 1 ? ` (${String.fromCharCode(65 + k)})` : ''}</button>
              ))}
              <button type="button" style={addButton} onClick={() => addBelow(block)}><Plus size={15} /> {block.refs.some((r) => isSet(r)) ? 'Add set' : 'Add row'}</button>
              {block.table && deletedCount(labData, block.table) ? (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => patch(restoreTable(block.table as string))}><RotateCcw size={13} /> Restore deleted rows ({deletedCount(labData, block.table)})</button>
              ) : null}
            </div>
          ) : null}
          {(() => {
            // Same chart as the print (grading / compaction curve), redrawn as values are typed
            const spec = block.chart?.(values, calc)
            const svg = spec ? chartSvg(spec) : ''
            return svg ? <div style={{ padding: 12, textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: svg }} /> : null
          })()}
          {renderLines(block.after)}
          {block.footKey ? (
            <div style={{ padding: '16px 0 0', marginLeft: GUTTER }}>
              <input className="input" value={values[block.footKey] ?? ''} onChange={set(block.footKey)} style={{ width: '100%', fontSize: '0.8rem' }} />
            </div>
          ) : null}
        </div>
      ))}
    </section>
  )
}

/** 2026-02-17 → 17/02/2026, other text as typed */
const showDate = (v: string | null | undefined) => String(v ?? '').replace(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/, '$3/$2/$1')
const isSet = (ref: RowRef | null | undefined) => !!ref && 'list' in ref && ref.list.key === 'n_sets'
const iconButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', borderRadius: 4 }
/** Room left of the table for the row icons */
const GUTTER = 36
const gutterCell = { width: GUTTER, minWidth: GUTTER, padding: 0, border: 0, background: '#fff', verticalAlign: 'middle' as const, position: 'sticky' as const, left: 0, zIndex: 1 }
const addButton = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 16px', border: '1px dashed #86b79a', borderRadius: 6, background: '#f3faf5', color: '#15803d', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }
const headerStyle = { background: '#000', color: '#fff', border: '1px solid #475569', padding: '12px 10px', fontSize: '0.74rem', lineHeight: 1.45, textTransform: 'uppercase' as const, textAlign: 'center' as const, whiteSpace: 'normal' as const, maxWidth: 260, verticalAlign: 'middle' as const }
const cellStyle = { border: '1px solid #cbd5e1', padding: '9px 10px', verticalAlign: 'middle' as const, background: '#fff' }

/** Heading of each column, from the head rows (spans resolved): "Weight / Mtr. – Observed" */
function columnLabels(head: Row[] | undefined): string[] {
  const grid: string[][] = []
  head?.forEach((row, r) => {
    grid[r] ??= []
    let c = 0
    for (const cell of row) {
      while (grid[r][c] !== undefined) c++
      const text = 'text' in cell ? cell.text.trim() : ''
      for (let i = 0; i < (cell.rs ?? 1); i++) for (let j = 0; j < (cell.cs ?? 1); j++) (grid[r + i] ??= [])[c + j] = text
      c += cell.cs ?? 1
    }
  })
  const width = Math.max(0, ...grid.map((r) => r.length))
  return Array.from({ length: width }, (_, c) => [...new Set(grid.map((r) => r[c]).filter(Boolean))].join(' – '))
}

/** The cells of each body row with their column; text spanning down from rows above is carried (own: false) */
function rowItems(rows: Row[]): Array<Array<{ col: number; cell: Cell; own: boolean }>> {
  const carry: Array<{ cell: Cell; left: number } | undefined> = []
  return rows.map((row) => {
    const items: Array<{ col: number; cell: Cell; own: boolean }> = []
    carry.forEach((x, col) => { if (x && x.left > 0 && 'text' in x.cell) items.push({ col, cell: x.cell, own: false }) })
    const taken = (col: number) => (carry[col]?.left ?? 0) > 0
    let c = 0
    const started: Array<[number, Cell]> = []
    for (const cell of row) {
      while (taken(c)) c++
      items.push({ col: c, cell, own: true })
      if ((cell.rs ?? 1) > 1) started.push([c, cell])
      c += cell.cs ?? 1
    }
    carry.forEach((x) => { if (x) x.left -= 1 })
    for (const [col, cell] of started) for (let j = 0; j < (cell.cs ?? 1); j++) carry[col + j] = { cell, left: (cell.rs ?? 1) - 1 }
    return items.sort((a, b) => a.col - b.col)
  })
}
