import type { TableProps } from './CubeTable'
import { formatDateForInput } from '../../lib/utils'

export function FerroCoverTable({ details, updateDetail }: TableProps) {
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
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Cover Type</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Location</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Dia Of Plat (mm)</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Date Of Sample Collection</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Date Of Testing</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Applying Of Load In (KN)</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Observation</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Remark</th>
            </tr>
          </thead>
          <tbody>
            {details.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}>{i + 1}</td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.cover_type || ''} onChange={e => updateDetail(i, 'cover_type', e.target.value)} style={{ width: 100 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.location || ''} onChange={e => updateDetail(i, 'location', e.target.value)} style={{ width: 100 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.dia_of_plat || ''} onChange={e => updateDetail(i, 'dia_of_plat', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="date" className="input" value={formatDateForInput(row.date_of_sample_collection)} onChange={e => updateDetail(i, 'date_of_sample_collection', e.target.value)} style={{ width: 130 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="date" className="input" value={formatDateForInput(row.date_of_testing)} onChange={e => updateDetail(i, 'date_of_testing', e.target.value)} style={{ width: 130 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.applying_of_load || ''} onChange={e => updateDetail(i, 'applying_of_load', e.target.value)} style={{ width: 100 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.observation || ''} onChange={e => updateDetail(i, 'observation', e.target.value)} style={{ width: 120 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.remark || ''} onChange={e => updateDetail(i, 'remark', e.target.value)} style={{ width: 120 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
