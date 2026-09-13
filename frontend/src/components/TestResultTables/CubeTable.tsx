import React from 'react'
import { formatDateForInput } from '../../lib/utils'

export interface TableProps {
  details: any[]
  updateDetail: (index: number, field: string, value: string) => void
}

export function CubeTable({ details, updateDetail }: TableProps) {
  return (
    <>
      <h5 style={{ background: '#000', color: '#fff', textAlign: 'center', padding: '8px', textTransform: 'uppercase', marginBottom: 0, marginTop: 32, fontSize: '1rem', fontWeight: 600 }}>
        TEST RESULTS (AS PER IS: 516-1959 REAF 2018)
      </h5>
      <div style={{ overflowX: 'auto', border: '1px solid #dfe6ea', borderTop: 'none' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>S. N</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Location</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Size of cubes mm2</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Date of Casting</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Date of Testing</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Age of Specimen</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Load (KN)</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Comp. Strength (N/mm2)</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Avg. comp. strength (N/mm2)</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>As per IS Code comp. strength (N/mm2)</th>
            </tr>
          </thead>
          <tbody>
            {details.map((row, i) => (
              <React.Fragment key={i}>
                <tr>
                  <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>1</td>
                  <td rowSpan={3} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.location || ''} onChange={e => updateDetail(i, 'location', e.target.value)} style={{ width: 120 }} /></td>
                  <td rowSpan={3} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.size_of_cube || ''} onChange={e => updateDetail(i, 'size_of_cube', e.target.value)} style={{ width: 80 }} /></td>
                  <td rowSpan={3} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="date" className="input" value={formatDateForInput(row.date_of_casting)} onChange={e => updateDetail(i, 'date_of_casting', e.target.value)} style={{ width: 130 }} /></td>
                  <td rowSpan={3} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="date" className="input" value={formatDateForInput(row.date_of_testing)} onChange={e => updateDetail(i, 'date_of_testing', e.target.value)} style={{ width: 130 }} /></td>
                  <td rowSpan={3} style={{ border: '1px solid #dfe6ea', padding: 8 }}>
                    <select className="input" value={row.age_of_specimen || '28 Days'} onChange={e => updateDetail(i, 'age_of_specimen', e.target.value)} style={{ width: 110 }}>
                      <option value="7 Days">7 Days</option>
                      <option value="28 Days">28 Days</option>
                      <option value="After 28 Days">After 28 Days</option>
                    </select>
                  </td>
                  <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.load_1 || ''} onChange={e => updateDetail(i, 'load_1', e.target.value)} style={{ width: 80 }} /></td>
                  <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.comp_strength_1 || ''} onChange={e => updateDetail(i, 'comp_strength_1', e.target.value)} style={{ width: 100 }} /></td>
                  <td rowSpan={3} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.avg_comp_strength || ''} onChange={e => updateDetail(i, 'avg_comp_strength', e.target.value)} style={{ width: 100 }} /></td>
                  <td rowSpan={3} style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.is_code_comp_strength || ''} onChange={e => updateDetail(i, 'is_code_comp_strength', e.target.value)} style={{ width: 120 }} /></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>2</td>
                  <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.load_2 || ''} onChange={e => updateDetail(i, 'load_2', e.target.value)} style={{ width: 80 }} /></td>
                  <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.comp_strength_2 || ''} onChange={e => updateDetail(i, 'comp_strength_2', e.target.value)} style={{ width: 100 }} /></td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>3</td>
                  <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.load_3 || ''} onChange={e => updateDetail(i, 'load_3', e.target.value)} style={{ width: 80 }} /></td>
                  <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.comp_strength_3 || ''} onChange={e => updateDetail(i, 'comp_strength_3', e.target.value)} style={{ width: 100 }} /></td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
