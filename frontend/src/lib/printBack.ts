import { isStandalone } from './pwa'

/** On the phone app a print window has no browser bar: nothing to tap to get back */
const onPhone = (): boolean =>
  isStandalone() || window.matchMedia('(max-width: 900px)').matches || window.matchMedia('(pointer: coarse)').matches

/**
 * Puts a "Back" bar at the top of a print window (phone / installed app only; it does not print).
 * Back closes the window; if the phone will not close it, it goes to the app.
 */
export function addPrintBackBar(w: Window | null): void {
  if (!w || w.closed || !onPhone()) return
  const doc = w.document
  if (!doc.body || doc.getElementById('ncrc-back-bar')) return
  const appUrl = window.location.href
  const style = doc.createElement('style')
  style.textContent = `
    #ncrc-back-bar { position: sticky; top: 0; z-index: 2147483647; display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      background: #fff; border-bottom: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(15,23,42,.08); font: 600 15px system-ui, sans-serif; }
    #ncrc-back-bar button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font: inherit; cursor: pointer;
      border: 1px solid #cbd5e1; background: #fff; color: #0f172a; }
    #ncrc-back-bar button.print { margin-left: auto; background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
    @media print { #ncrc-back-bar { display: none !important; } }`
  doc.head?.appendChild(style)
  const bar = doc.createElement('div')
  bar.id = 'ncrc-back-bar'
  bar.innerHTML = '<button type="button" class="back">&#8592; Back</button><button type="button" class="print">Print / PDF</button>'
  bar.querySelector<HTMLButtonElement>('.back')!.onclick = () => {
    w.close()
    // Still open: the phone did not let it close
    w.setTimeout(() => { if (!w.closed) w.location.href = appUrl }, 300)
  }
  bar.querySelector<HTMLButtonElement>('.print')!.onclick = () => w.print()
  doc.body.insertBefore(bar, doc.body.firstChild)
}
