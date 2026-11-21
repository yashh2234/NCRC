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
  const count = Math.min(STEEL_MAX_SAMPLES, Math.max(1, Number(labData.steel_count) || 1))
  const brand = labData.steel_brand ?? ''
  const get = (i: number, f: string, fallback = '') => labData[steelKey(i, f)] ?? fallback

  return (
    <section style={{ marginTop: 28, border: '1px solid #e2e8f0', background: '#fff' }}>
      <div style={{ background: '#000', color: '#fff', textAlign: 'center', padding: 10, fontWeight: 700, textTransform: 'uppercase' }}>
        Steel {grade.label} — Test Results ({STEEL_STANDARD})
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 12, borderBottom: '1px solid #e2e8f0', alignItems: 'end' }}>
        <label style={labelCol}>Number of samples
          <select className="input" value={String(count)} onChange={(e) => updateLabData('steel_count', e.target.value)} style={{ width: 120 }}>
            {Array.from({ length: STEEL_MAX_SAMPLES }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
          </select>
        </label>
        <label style={{ ...labelCol, flex: '1 1 220px' }}>Brand / make (used in heading)
          <input className="input" value={brand} placeholder="e.g. Kamdhenu" onChange={(e) => updateLabData('steel_brand', e.target.value)} />
        </label>
      </div>

      {Array.from({ length: count }, (_, idx) => {
        const i = idx + 1
        const dia = get(i, 'dia')
        const ev = evaluateSteel(grade, { dia, weight: get(i, 'weight'), uts: get(i, 'uts'), proof: get(i, 'proof'), elong: get(i, 'elong') })
        const heading = `(${String.fromCharCode(64 + i)}) ${dia ? `${dia}mm dia ` : ''}${grade.label} ${brand ? `${brand} ` : ''}TMT Steel`
        const input = (f: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
          <input className="input" value={get(i, f)} onChange={(e) => updateLabData(steelKey(i, f), e.target.value)} style={{ minWidth: 90 }} {...extra} />
        )
        return (
          <div key={i} style={{ overflowX: 'auto', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ padding: '8px 12px', fontWeight: 700, background: '#f8fafc' }}>{heading}</div>
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

const labelCol = { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: '0.8rem', fontWeight: 600 }
const headerStyle = { background: '#000', color: '#fff', border: '1px solid #333', padding: 8, textTransform: 'uppercase' as const }
const cellStyle = { border: '1px solid #e2e8f0', padding: 8, verticalAlign: 'top' as const }
