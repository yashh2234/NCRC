import React from 'react'
import type { TableProps } from './CubeTable'
import { formatDateForInput } from '../../lib/utils'

export function InterlockingTilesTable({ details, updateDetail }: TableProps) {
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
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Location</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Size</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Date of Testing</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Age of Specimen</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Crushing Load</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Corrected Comp. Strength</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Avg Comp. Strength</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>IS Code Comp. Strength</th>
            </tr>
          </thead>
          <tbody>
            {details.map((row, i) => (
              <React.Fragment key={i}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                  <tr key={`${i}-${num}`}>
                    {num === 1 && <td rowSpan={8} style={{ border: '1px solid #dfe6ea', padding: 8 }}>{i + 1}</td>}
                    {num === 1 && <td rowSpan={8} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.location || ''} onChange={e => updateDetail(i, 'location', e.target.value)} style={{ width: 100 }} /></td>}
                    {num === 1 && <td rowSpan={8} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.size || ''} onChange={e => updateDetail(i, 'size', e.target.value)} style={{ width: 100 }} /></td>}
                    {num === 1 && <td rowSpan={8} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="date" className="input" value={formatDateForInput(row.date_of_testing)} onChange={e => updateDetail(i, 'date_of_testing', e.target.value)} style={{ width: 130 }} /></td>}
                    {num === 1 && <td rowSpan={8} style={{ border: '1px solid #dfe6ea', padding: 8 }}>
                      <select className="input" value={row.age_of_specimen || '28 Days'} onChange={e => updateDetail(i, 'age_of_specimen', e.target.value)} style={{ width: 110 }}>
                        <option value="7 Days">7 Days</option>
                        <option value="28 Days">28 Days</option>
                        <option value="After 28 Days">After 28 Days</option>
                      </select>
                    </td>}
                    
                    <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row[`crushing_load_${num}`] || ''} onChange={e => updateDetail(i, `crushing_load_${num}`, e.target.value)} style={{ width: 80 }} /></td>
                    <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row[`currected_comp_strength_${num}`] || ''} onChange={e => updateDetail(i, `currected_comp_strength_${num}`, e.target.value)} style={{ width: 80 }} /></td>
                    
                    {num === 1 && <td rowSpan={8} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.avg_comp_strength || ''} onChange={e => updateDetail(i, 'avg_comp_strength', e.target.value)} style={{ width: 100 }} /></td>}
                    {num === 1 && <td rowSpan={8} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.is_code_comp_strength || ''} onChange={e => updateDetail(i, 'is_code_comp_strength', e.target.value)} style={{ width: 100 }} /></td>}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
