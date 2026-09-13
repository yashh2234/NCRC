import type { TableProps } from './CubeTable'

export function WaterTable({ details, updateDetail }: TableProps) {
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
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Result</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Unit</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Specification As Per IS</th>
            </tr>
          </thead>
          <tbody>
            {details.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>{i + 1}</td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.name_of_test || ''} onChange={e => updateDetail(i, 'name_of_test', e.target.value)} style={{ width: 140 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.mathod_of_test || ''} onChange={e => updateDetail(i, 'mathod_of_test', e.target.value)} style={{ width: 140 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.result || ''} onChange={e => updateDetail(i, 'result', e.target.value)} style={{ width: 100 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.unit || ''} onChange={e => updateDetail(i, 'unit', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.specification || ''} onChange={e => updateDetail(i, 'specification', e.target.value)} style={{ width: 200 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
