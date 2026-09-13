import type { TableProps } from './CubeTable'
import { formatDateForInput } from '../../lib/utils'

export function BeamTable({ details, updateDetail }: TableProps) {
  return (
    <>
      <h5 style={{ background: '#000', color: '#fff', textAlign: 'center', padding: '8px', textTransform: 'uppercase', marginBottom: 0, marginTop: 32, fontSize: '1rem', fontWeight: 600 }}>
        TEST RESULTS
      </h5>
      <div style={{ overflowX: 'auto', border: '1px solid #dfe6ea', borderTop: 'none' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>S. N</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>
                Size of Specimen (L x B x D)
              </th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Span Length (mm)</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Date of Casting</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Date of Testing</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Age Of Specimen</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Distance from fracture (a)</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Max Load (KN)</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Formula</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Flexural Strength</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Avg Flexural Strength</th>
            </tr>
          </thead>
          <tbody>
            {details.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>{i + 1}</td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input type="text" className="input" value={row.size_l || ''} onChange={e => updateDetail(i, 'size_l', e.target.value)} style={{ width: 45 }} placeholder="L" />
                    <input type="text" className="input" value={row.size_b || ''} onChange={e => updateDetail(i, 'size_b', e.target.value)} style={{ width: 45 }} placeholder="B" />
                    <input type="text" className="input" value={row.size_d || ''} onChange={e => updateDetail(i, 'size_d', e.target.value)} style={{ width: 45 }} placeholder="D" />
                  </div>
                </td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.span_length || ''} onChange={e => updateDetail(i, 'span_length', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="date" className="input" value={formatDateForInput(row.date_of_casting)} onChange={e => updateDetail(i, 'date_of_casting', e.target.value)} style={{ width: 130 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="date" className="input" value={formatDateForInput(row.date_of_testing)} onChange={e => updateDetail(i, 'date_of_testing', e.target.value)} style={{ width: 130 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>
                  <select className="input" value={row.age_of_specimen || '28 Days'} onChange={e => updateDetail(i, 'age_of_specimen', e.target.value)} style={{ width: 110 }}>
                    <option value="7 Days">7 Days</option>
                    <option value="28 Days">28 Days</option>
                    <option value="After 28 Days">After 28 Days</option>
                  </select>
                </td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.fracture_value || ''} onChange={e => updateDetail(i, 'fracture_value', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.observe_load || ''} onChange={e => updateDetail(i, 'observe_load', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.formula || ''} onChange={e => updateDetail(i, 'formula', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.flexural_strength || ''} onChange={e => updateDetail(i, 'flexural_strength', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.avg_flexural_strength || ''} onChange={e => updateDetail(i, 'avg_flexural_strength', e.target.value)} style={{ width: 80 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
