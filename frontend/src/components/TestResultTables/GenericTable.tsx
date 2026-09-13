
export function GenericTable({ type, details }: { type: string, details: any[] }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', background: '#f8f9fa', border: '1px dashed #ccc' }}>
      <h4>Test Results Table for {type}</h4>
      <p>This table is currently using a generic fallback or is under construction.</p>
      {/* We can render a generic flex grid here similar to TestingScreen, or just a placeholder */}
      <pre style={{ textAlign: 'left', fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
        {JSON.stringify(details, null, 2)}
      </pre>
    </div>
  )
}
