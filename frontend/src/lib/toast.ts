/** A short message in a box at the top centre of the screen, e.g. "Saved" after a form is saved */
export type ToastKind = 'success' | 'error'
export interface ToastMessage { id: number; text: string; kind: ToastKind }

const listeners = new Set<(t: ToastMessage) => void>()
let next = 1

export function showToast(text: string, kind: ToastKind = 'success'): void {
  const t = { id: next++, text, kind }
  listeners.forEach((fn) => fn(t))
}

/** After a save: the form closes, the list shows, and this says it went through */
export const showSaved = (text = 'Saved') => showToast(text)

export function onToast(fn: (t: ToastMessage) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
