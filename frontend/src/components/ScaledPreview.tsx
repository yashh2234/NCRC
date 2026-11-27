import { useEffect, useRef, useState } from 'react'

/** Width the A4 print is laid out at (210 mm plus margins) */
const PAGE_WIDTH = 840

/** A print preview that fits its box: on a phone the whole A4 width shows, scaled down, instead of a cut-off page */
export function ScaledPreview({ title, html, height = 520 }: { title: string; html: string; height?: number }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const fit = () => setScale(Math.min(1, box.clientWidth / PAGE_WIDTH))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])

  // Full width: just the frame as before
  if (scale >= 1) {
    return <div ref={boxRef}><iframe title={title} srcDoc={html} style={{ width: '100%', height, border: '1px solid #e2e8f0', borderRadius: 8, background: '#e5e7eb' }} /></div>
  }
  // Scaled: the frame keeps the page width; the box shows a taller part of the page for the same space
  const inner = Math.round(height / scale)
  return (
    <div ref={boxRef} style={{ height, overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: 8, background: '#e5e7eb' }}>
      <iframe title={title} srcDoc={html} style={{ width: PAGE_WIDTH, height: inner, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', display: 'block' }} />
    </div>
  )
}
