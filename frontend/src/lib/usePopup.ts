import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject, type SyntheticEvent } from 'react'

const GAP = 4
const EDGE = 8
const HEIGHT = 340

/**
 * Where the list of a dropdown goes: below its box (above when there is no room), as a layer over the page, so a table
 * or popup with its own scrolling cannot cut it off. Closes on a click elsewhere and on Escape (which then closes
 * nothing else). Null until it is placed.
 */
export function usePopup(open: boolean, close: (refocus: boolean) => void, box: RefObject<HTMLElement | null>, pop: RefObject<HTMLElement | null>, minWidth = 170): CSSProperties | null {
  const [pos, setPos] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const place = (e?: Event) => {
      if (e?.target instanceof Node && pop.current?.contains(e.target)) return
      const r = box.current?.getBoundingClientRect()
      if (!r) return
      if (r.bottom < 0 || r.top > window.innerHeight) { close(false); return }
      const below = window.innerHeight - r.bottom - GAP - EDGE
      const above = r.top - GAP - EDGE
      const up = below < 200 && above > below
      const width = Math.min(Math.max(r.width, minWidth), window.innerWidth - 2 * EDGE)
      setPos({
        left: Math.min(Math.max(EDGE, r.left), window.innerWidth - width - EDGE), width, maxHeight: Math.max(120, Math.min(HEIGHT, up ? above : below)),
        ...(up ? { bottom: window.innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      setPos(null)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => {
      const t = e.target as Node
      if (!box.current?.contains(t) && !pop.current?.contains(t)) close(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close(true)
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', escape, true)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  return pos
}

/** A click inside the list is not one on what the dropdown stands in (a table row, a popup) */
export const keepInside = {
  onClick: (e: SyntheticEvent) => e.stopPropagation(),
  onMouseDown: (e: SyntheticEvent) => e.stopPropagation(),
}
