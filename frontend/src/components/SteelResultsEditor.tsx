import { CircleMinus, Plus } from 'lucide-react'
import { addListRow, removeListRow, rowIds } from '../lib/labRows'
import {
  DEFAULT_BEND, DEFAULT_REBEND, STEEL_DIAS, STEEL_GRADES, STEEL_MAX_SAMPLES, STEEL_STANDARD,
  evaluateSteel, steelKey, utsRequirementText, type Check,
} from '../lib/steel'

/**
 * TEST RESULTS for the Steel Fe-415 / 415D / 500 / 500D / 550 / 550D formats.
 * Everything is kept in lab_data: steel_count, steel_brand, steel_note and s{n}_* per sample.
 * The "As per IS Code" and "Permissible limit" rows come from the grade + dia (Fe steel software sheet).
 */
export function SteelResultsEditor({ templateKey, labData, updateLabData }: {
  templateKey: string
  labData: Record<string, string>
  updateLabData: (field: string, value: string) => void
}) {
  const grade = STEEL_GRADES[templateKey]
  const ids = rowIds(labData, 'steel_count', 1).slice(0, STEEL_MAX_SAMPLES)
  const count = ids.length
  const patch = (p: Record<string, string>) => Object.entries(p).forEach(([key, value]) => updateLabData(key, value))
  const deleteSample = (id: number) => {
    const typed = Object.entries(labData).some(([k, x]) => k.startsWith(`s${id}_`) && x)
    if (typed && !window.confirm('Delete this sample and the values typed in it?')) return
    patch(removeListRow(labData, { key: 'steel_count', id, fallback: 1 }))
  }
  const brand = labData.steel_brand ?? ''
  const get = (i: number, f: string, fallback = '') => labData[steelKey(i, f)] ?? fallback

  return (
    <section className="lab-results lab-results--steel" style={{ border: '1px solid #e2e8f0' }}>
      <div style={{ background: '#000', color: '#fff', textAlign: 'center', padding: 10, fontWeight: 700, textTransform: 'uppercase' }}>
        Steel {grade.label} — Test Results ({STEEL_STANDARD})
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 12, borderBottom: '1px solid #e2e8f0', alignItems: 'end' }}>
        <label style={{ ...labelCol, flex: '1 1 220px' }}>Brand / make (used in heading)
          <input className="input" value={brand} placeholder="e.g. Kamdhenu" onChange={(e) => updateLabData('steel_brand', e.target.value)} />
        </label>
      </div>

      {ids.map((i, idx) => {
        const dia = get(i, 'dia')
        const ev = evaluateSteel(grade, { dia, weight: get(i, 'weight'), uts: get(i, 'uts'), proof: get(i, 'proof'), elong: get(i, 'elong') })
        const heading = `(${String.fromCharCode(65 + idx)}) ${dia ? `${dia}mm dia ` : ''}${grade.label} ${brand ? `${brand} ` : ''}TMT Steel`
        const input = (f: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
          <input className="input" value={get(i, f)} onChange={(e) => updateLabData(steelKey(i, f), e.target.value)} style={{ minWidth: 90 }} {...extra} />
        )
        return (
          <div key={i} style={{ overflowX: 'auto', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ padding: '8px 12px', fontWeight: 700, background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 4 }}>
              <button type="button" style={iconButton} title="Delete this sample" aria-label="Delete this sample" onClick={() => deleteSample(i)}><CircleMinus size={17} color="#dc2626" /></button>
              <span style={{ marginLeft: 6 }}>{heading}</span>
            </div>
            <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  {['S.No', 'Particulars of Test', 'Weight/mtr. (kg)', 'Ultimate Tensile Stress (MPa)', '0.2% Proof Stress (MPa)', 'Elongation %', 'Bend Test', 'Re-Bend Test'].map((h) => <th key={h} style={headerStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={cellStyle}>1</td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      Sample
                      <select className="input" value={dia} onChange={(e) => updateLabData(steelKey(i, 'dia'), e.target.value)} style={{ width: 100 }}>
                        <option value="">Dia</option>
                        {Object.keys(STEEL_DIAS).map((d) => <option key={d} value={d}>{d} mm</option>)}
                      </select>
                    </div>
                  </td>
                  <td style={cellStyle}>{input('weight', { inputMode: 'decimal' })}<Hint check={ev.weightCheck} text={ev.weightDeviation !== null ? `${ev.weightDeviation >= 0 ? '+' : ''}${ev.weightDeviation.toFixed(2)}%` : ''} /></td>
                  <td style={cellStyle}>{input('uts', { inputMode: 'decimal' })}<Hint check={ev.utsCheck} text={ev.requiredUts !== null ? `min ${ev.requiredUts.toFixed(2)}` : ''} /></td>
                  <td style={cellStyle}>{input('proof', { inputMode: 'decimal' })}<Hint check={ev.proofCheck} text={`min ${grade.proofMin}`} /></td>
                  <td style={cellStyle}>{input('elong', { inputMode: 'decimal' })}<Hint check={ev.elongationCheck} text={`min ${grade.elongationMin}`} /></td>
                  <td style={cellStyle} rowSpan={3}>
                    <textarea className="input" rows={3} value={get(i, 'bend', DEFAULT_BEND)} onChange={(e) => updateLabData(steelKey(i, 'bend'), e.target.value)} style={{ minWidth: 140 }} />
                  </td>
                  <td style={cellStyle} rowSpan={3}>
                    <textarea className="input" rows={3} value={get(i, 'rebend', DEFAULT_REBEND)} onChange={(e) => updateLabData(steelKey(i, 'rebend'), e.target.value)} style={{ minWidth: 140 }} />
                  </td>
                </tr>
                <tr style={{ background: '#f8fafc' }}>
                  <td style={cellStyle}>2</td>
                  <td style={cellStyle}>As per IS Code</td>
                  <td style={cellStyle}>{ev.nominalWeight ?? '—'}</td>
                  <td style={cellStyle} rowSpan={2}>{utsRequirementText(grade)}</td>
                  <td style={cellStyle} rowSpan={2}>Not less than {grade.proofMin}</td>
                  <td style={cellStyle} rowSpan={2}>{grade.elongationMin}</td>
                </tr>
                <tr style={{ background: '#f8fafc' }}>
                  <td style={cellStyle}>3</td>
                  <td style={cellStyle}>Permissible Limit</td>
                  <td style={cellStyle}>{ev.tolerance !== null ? `±${ev.tolerance}%` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}

      {count < STEEL_MAX_SAMPLES ? (
        <button type="button" style={addButton} onClick={() => patch(addListRow(labData, { key: 'steel_count', id: ids[count - 1], fallback: 1 }))}><Plus size={15} /> Add sample</button>
      ) : null}

      <div style={{ padding: 12 }}>
        <label style={labelCol}>Note below results (optional)
          <input className="input" value={labData.steel_note ?? ''} placeholder="e.g. Test Conducted in Presence of Sh ... AEN PWD Sub Div. ..." onChange={(e) => updateLabData('steel_note', e.target.value)} />
        </label>
      </div>
    </section>
  )
}

function Hint({ check, text }: { check: Check; text: string }) {
  if (!text && !check) return null
  const color = check === 'pass' ? '#15803d' : check === 'fail' ? '#dc2626' : '#64748b'
  return (
    <div style={{ marginTop: 4, fontSize: '0.72rem', color, whiteSpace: 'nowrap' }}>
      {check === 'pass' ? '✓ ' : check === 'fail' ? '✗ ' : ''}{text}
    </div>
  )
}

const addButton = { display: 'inline-flex', alignItems: 'center', gap: 5, margin: '10px 12px 0', padding: '9px 16px', border: '1px dashed #86b79a', borderRadius: 6, background: '#f3faf5', color: '#15803d', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }
const iconButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', borderRadius: 4 }
const labelCol = { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: '0.8rem', fontWeight: 600 }
const headerStyle = { background: '#000', color: '#fff', border: '1px solid #333', padding: 8, textTransform: 'uppercase' as const }
const cellStyle = { border: '1px solid #e2e8f0', padding: 8, verticalAlign: 'top' as const }
