import { useEffect, type RefObject } from 'react'

/**
 * Pages made for the computer show wide tables. In the phone app each row of a plain list table
 * becomes a card: every cell gets its column heading as a label (data-label), and CSS stacks them.
 * Tables people type into (lab sheets, item lines) keep their columns and scroll sideways instead.
 */
export function useCardTables(root: RefObject<HTMLElement | null>, key: string): void {
  useEffect(() => {
    const el = root.current
    if (!el) return
    let frame = 0

    const apply = () => {
      frame = 0
      for (const table of Array.from(el.querySelectorAll('table'))) prepare(table)
      compactButtons(el)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply) }

    apply()
    // Pages load their rows later and re-render them: label the new rows too
    const observer = new MutationObserver(schedule)
    observer.observe(el, { childList: true, subtree: true })
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame) }
  }, [root, key])
}

function prepare(table: HTMLTableElement): void {
  if (table.dataset.mKeep === '1' || table.closest('[data-m-keep]')) return
  const headRow = table.tHead?.rows[table.tHead.rows.length - 1]
  const body = table.tBodies[0]
  if (!headRow || !body) {
    table.classList.add('m-scrolltable')
    return
  }
  const typing = body.querySelector('input:not([type="checkbox"]):not([type="radio"]), select, textarea, [contenteditable="true"]')
  const columns = headRow.cells.length
  if (typing || columns < 3) {
    table.classList.remove('m-cardtable')
    table.classList.add('m-scrolltable')
    return
  }
  table.classList.remove('m-scrolltable')
  table.classList.add('m-cardtable')

  // Heading of each column position (colspan in the heading counts)
  const labels: string[] = []
  for (const th of Array.from(headRow.cells)) {
    const text = (th.textContent ?? '').replace(/\s+/g, ' ').trim()
    for (let i = 0; i < th.colSpan; i++) labels.push(text)
  }
  for (const row of Array.from(body.rows)) {
    const cells = Array.from(row.cells)
    // The card's title: the first cell with real text (not a serial number or a tick box)
    const title = cells.find((c) => {
      const text = (c.textContent ?? '').trim()
      return c.colSpan < labels.length && text !== '' && !/^\d{1,4}\.?$/.test(text)
    })
    let index = 0
    for (const cell of cells) {
      const label = cell.colSpan >= labels.length ? '' : labels[index] ?? ''
      if (cell.dataset.label !== label) cell.dataset.label = label
      // A cell over the whole row (empty message, group heading) is shown as it is
      cell.classList.toggle('m-fullcell', cell.colSpan >= labels.length)
      cell.classList.toggle('m-titlecell', cell === title)
      // Serial numbers and empty cells only take room on a phone
      const text = (cell.textContent ?? '').trim()
      cell.classList.toggle('m-emptycell', cell !== title && !cell.querySelector('button, a, input, img, svg, select') && (text === '' || text === '-' || text === '—'))
      index += cell.colSpan
    }
  }
}

/** Actions everybody knows by their icon: on a phone the button shows only the icon (the words stay as its label) */
const ICON_ONLY = /\blucide-(download|printer|mail|refresh-cw|rotate-cw|pencil|square-pen|trash-2|trash|upload|file-up|file-down|history|eye|filter|rotate-ccw|copy|folder-open|send|x|arrow-left|settings|share-2|external-link|sheet|file-spreadsheet)(\s|$)/

/** Buttons with an icon and words: icon only where the icon says enough; the main action (primary) keeps its words */
function compactButtons(root: HTMLElement): void {
  floatingAction(root)
  for (const button of Array.from(root.querySelectorAll<HTMLElement>('button, a.btn'))) {
    if (button.dataset.mIcon) continue
    const svg = button.querySelector('svg')
    const text = (button.textContent ?? '').replace(/\s+/g, ' ').trim()
    const skip = !svg || !text
      || button.classList.contains('btn-primary')
      || button.closest('[role="tablist"], .ui-modal__footer, .m-lab, .tb-app, .date-input, .combo-trigger')
      || !ICON_ONLY.test(svg.getAttribute('class') ?? '')
    button.dataset.mIcon = skip ? 'no' : 'yes'
    if (skip) continue
    button.classList.add('m-iconbtn')
    if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', text)
    if (!button.getAttribute('title')) button.setAttribute('title', text)
  }
}

/** "Create Invoice", "+ Add enquiry", "New proposal"… */
const CREATE = /^\+?\s*(create|new|add)\b/i

/**
 * The page's main create button floats at the bottom right, the same place on every page
 * (it stays the same React element: only its position changes).
 */
function floatingAction(root: HTMLElement): void {
  const current = root.querySelector<HTMLElement>('.m-fab')
  // (offsetParent is null for a fixed element: getClientRects tells whether it is shown)
  if (current && current.isConnected && current.getClientRects().length > 0) return
  current?.classList.remove('m-fab')
  const candidate = Array.from(root.querySelectorAll<HTMLElement>('button.btn-primary, a.btn-primary')).find((b) =>
    CREATE.test((b.textContent ?? '').trim())
    && b.getClientRects().length > 0
    && !b.closest('.ui-modal, .modal-overlay, table, form, .m-lab, [role="dialog"], .proposal-editor-head'))
  candidate?.classList.add('m-fab')
}

// ─── Filter rows → "Filters" button + bottom sheet ─────────────────────

/** Not filters of the page itself */
const NOT_A_FILTER = 'label, form, table, .ui-modal, .modal-overlay, .m-lab, [role="dialog"], .history-overlay, .tb-app, .dd-pop, [data-m-keep]'

/**
 * The page's filter rows: the largest block around its dropdowns / date range that is not the list itself.
 * Only rows with two filters or more (or a date range) fold into the Filters sheet; one dropdown stays in place.
 */
export function findFilterBars(root: HTMLElement): HTMLElement[] {
  const controls = Array.from(root.querySelectorAll<HTMLElement>('select, .dd-wrap, button.dd-box, .date-range'))
    .filter((el) => !el.closest(NOT_A_FILTER) && !el.parentElement?.closest('.date-range, .dd-wrap'))
  // Group by the block around them that is not the list itself
  const groups = new Map<HTMLElement, HTMLElement[]>()
  for (const control of controls) {
    let block = control.parentElement
    for (let i = 0; i < 4 && block?.parentElement && block.parentElement !== root && !block.parentElement.querySelector('table, .m-lab, .m-list'); i++) {
      block = block.parentElement
    }
    if (!block || block === root) continue
    groups.set(block, [...(groups.get(block) ?? []), control])
  }
  const bars: HTMLElement[] = []
  for (const [block, list] of groups) {
    if (list.length < 2 && !list.some((c) => c.classList.contains('date-range'))) continue
    if ([...groups.keys()].some((o) => o !== block && o.contains(block))) continue
    // The row is the smallest element holding all of them (and the search box, when it is in the same block)
    const search = block.querySelector<HTMLElement>('input[placeholder^="Search" i]')
    const items = search && !search.closest(NOT_A_FILTER) ? [...list, search] : list
    let bar: HTMLElement | null = items[0].parentElement
    while (bar && bar !== block && !items.every((i) => bar?.contains(i))) bar = bar.parentElement
    if (bar) bars.push(bar)
  }
  return bars
}

/** How many filters are set: chosen dropdowns and typed dates */
export function countActiveFilters(bar: HTMLElement): number {
  let n = 0
  for (const s of Array.from(bar.querySelectorAll('select'))) if (s.selectedIndex > 0) n++
  n += bar.querySelectorAll('.dd-box--set').length
  for (const i of Array.from(bar.querySelectorAll<HTMLInputElement>('.date-range input'))) if (i.value.trim()) n++
  return n
}
