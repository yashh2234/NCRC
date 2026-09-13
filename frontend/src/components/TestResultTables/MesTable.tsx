import type { TableProps } from './CubeTable'

export function MesTable({ details, updateDetail }: TableProps) {
  return (
    <>
      <h5 style={{ background: '#000', color: '#fff', textAlign: 'center', padding: '8px', textTransform: 'uppercase', marginBottom: 0, marginTop: 32, fontSize: '1rem', fontWeight: 600 }}>
        TEST RESULTS
      </h5>
      <div style={{ overflowX: 'auto', border: '1px solid #dfe6ea', borderTop: 'none' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>IS Sieve Size (mm)</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Weight Retained</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>% Weight Retained In</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Cum. % Weight Retained In</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>% Passing</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>IS Grading as per IS Table</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Remarks</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Impact Value</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Los Angles Abrasion</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Crushing Value</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Soundness</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Deleterious</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Organic Impurities</th>
              <th style={{ background: '#000', color: '#fff', border: '1px solid #333', padding: '8px', textTransform: 'uppercase' }}>Specific Gravity</th>
            </tr>
          </thead>
          <tbody>
            {details.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.is_sieve_size || ''} onChange={e => updateDetail(i, 'is_sieve_size', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.weight_retained || ''} onChange={e => updateDetail(i, 'weight_retained', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.weight_retained_in || ''} onChange={e => updateDetail(i, 'weight_retained_in', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.cum_weight_retained_in || ''} onChange={e => updateDetail(i, 'cum_weight_retained_in', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.passing || ''} onChange={e => updateDetail(i, 'passing', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.is_grading_as_per_is_table || ''} onChange={e => updateDetail(i, 'is_grading_as_per_is_table', e.target.value)} style={{ width: 100 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.remarks || ''} onChange={e => updateDetail(i, 'remarks', e.target.value)} style={{ width: 100 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.impact_value || ''} onChange={e => updateDetail(i, 'impact_value', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.los_angles_abrasion_value || ''} onChange={e => updateDetail(i, 'los_angles_abrasion_value', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.crushing_value || ''} onChange={e => updateDetail(i, 'crushing_value', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.soundness || ''} onChange={e => updateDetail(i, 'soundness', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.presence_of_deleterious || ''} onChange={e => updateDetail(i, 'presence_of_deleterious', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.organic_impurities || ''} onChange={e => updateDetail(i, 'organic_impurities', e.target.value)} style={{ width: 80 }} /></td>
                <td style={{ border: '1px solid #dfe6ea', padding: 8 }}><input type="text" className="input" value={row.specific_gravity || ''} onChange={e => updateDetail(i, 'specific_gravity', e.target.value)} style={{ width: 80 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
