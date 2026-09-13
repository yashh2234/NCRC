import type { TableProps } from './CubeTable'
import { formatDateForInput } from '../../lib/utils'

export function BitumenLooseTable({ details, updateDetail }: TableProps) {
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
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Name of Test</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Method of Test</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Date of Sampling</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {details.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>{i + 1}</td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.name_of_test || ''} onChange={e => updateDetail(i, 'name_of_test', e.target.value)} style={{ width: 160 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.mathod_of_test || ''} onChange={e => updateDetail(i, 'mathod_of_test', e.target.value)} style={{ width: 160 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="date" className="input" value={formatDateForInput(row.date_of_sampling)} onChange={e => updateDetail(i, 'date_of_sampling', e.target.value)} style={{ width: 130 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.result || ''} onChange={e => updateDetail(i, 'result', e.target.value)} style={{ width: 100 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
