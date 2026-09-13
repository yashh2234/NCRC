import type { TableProps } from './CubeTable'

export function CoreTable({ details, updateDetail }: TableProps) {
  return (
    <>
      <h5 style={{ background: '#000', color: '#fff', textAlign: 'center', padding: '8px', textTransform: 'uppercase', marginBottom: 0, marginTop: 32, fontSize: '1rem', fontWeight: 600 }}>
        TEST RESULTS (As per IS : 516-1959 Reaf 2018)
      </h5>
      <div style={{ overflowX: 'auto', border: '1px solid #dfe6ea', borderTop: 'none' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Core. N</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Ht. of Core Before Facing (mm)</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>
                Dimension Of Core After Facing
                <table style={{ width: '100%', marginTop: 4 }}>
                  <tbody>
                    <tr>
                      <td style={{ color: '#fff', padding: 0, paddingRight: 4, border: 'none' }}>Dia(mm)</td>
                      <td style={{ color: '#fff', padding: 0, border: 'none' }}>Height(mm)</td>
                    </tr>
                  </tbody>
                </table>
              </th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Cross Sectional Area mm2</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Correction Factor</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Age Of Specimen</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Crushing Load In KN</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Measured Comp. Strength</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Corrected Comp. Strength</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Equivalent Cube Strength</th>
            </tr>
          </thead>
          <tbody>
            {details.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>{i + 1}</td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.ht_core_before_facing || ''} onChange={e => updateDetail(i, 'ht_core_before_facing', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="text" className="input" value={row.dimension_core_facing_dia || ''} onChange={e => updateDetail(i, 'dimension_core_facing_dia', e.target.value)} style={{ width: 60 }} placeholder="Dia" />
                    <input type="text" className="input" value={row.dimension_core_facing_height || ''} onChange={e => updateDetail(i, 'dimension_core_facing_height', e.target.value)} style={{ width: 60 }} placeholder="Ht" />
                  </div>
                </td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.core_sectional_area || ''} onChange={e => updateDetail(i, 'core_sectional_area', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.correction_factor || ''} onChange={e => updateDetail(i, 'correction_factor', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>
                  <select className="input" value={row.age_of_specimen || '28 Days'} onChange={e => updateDetail(i, 'age_of_specimen', e.target.value)} style={{ width: 110 }}>
                    <option value="7 Days">7 Days</option>
                    <option value="28 Days">28 Days</option>
                    <option value="After 28 Days">After 28 Days</option>
                  </select>
                </td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.crushing_load || ''} onChange={e => updateDetail(i, 'crushing_load', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.measured_comp_strength || ''} onChange={e => updateDetail(i, 'measured_comp_strength', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.corrected_comp_strength || ''} onChange={e => updateDetail(i, 'corrected_comp_strength', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.equivalent_cube_strength || ''} onChange={e => updateDetail(i, 'equivalent_cube_strength', e.target.value)} style={{ width: 80 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
