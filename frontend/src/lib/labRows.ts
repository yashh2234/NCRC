/**
 * Adding and deleting rows of the lab report tables. Everything is kept in reports.lab_data:
 *
 *  - Sample rows (cubes, cores, bricks, sieves…) are a list of row ids. "n_cores" is how many there are;
 *    once rows are added or deleted in between, "n_cores_ids" holds the ids in order ("1,3,4"). The values
 *    of a row stay under its own id, so deleting row 2 never moves the results of row 3.
 *  - Fixed test lists (water, cement, mix designs…) keep their Excel rows; "_del_<table>" lists the rows
 *    taken out and "_add_<table>" the rows put in ("number@row it follows").
 */
import type { Block, Cell, LabFormat, Row, Values } from './labFormats'

export interface ListRef { key: string; id: number; fallback: number }
/** What the add / delete icons of a row act on */
export type RowRef = { list: ListRef } | { table: string; token: string }

export const MAX_LIST_ROWS = 40

const range = (n: number) => Array.from({ length: n }, (_, k) => k + 1)
const ints = (s: string | null | undefined) => String(s ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0)

// ---------------------------------------------------------------- sample rows

/** Ids of the rows of a list, in print order */
export function rowIds(v: Values, key: string, fallback: number): number[] {
  const own = ints(v[`${key}_ids`])
  if (own.length) return [...new Set(own)]
  const n = Math.round(Number(String(v[key] ?? '').trim() || fallback))
  return range(Math.min(MAX_LIST_ROWS, Math.max(1, Number.isFinite(n) ? n : fallback)))
}

/** Ids whose defaults a format fills in: the usual rows and any added ones */
export const defaultIds = (v: Values, key: string, n = MAX_LIST_ROWS) => [...new Set([...range(n), ...ints(v[`${key}_ids`])])]

const saveIds = (key: string, ids: number[], last: number): Values => ({ [key]: String(ids.length), [`${key}_ids`]: ids.join(','), [`${key}_last`]: String(last) })

/** A new row never reuses the id of a deleted one, so it always starts empty */
const lastId = (v: Values, key: string, ids: number[], fallback: number) => Math.max(fallback, Number(v[`${key}_last`]) || 0, ...ids)

export function addListRow(v: Values, { key, id, fallback }: ListRef): Values {
  const ids = rowIds(v, key, fallback)
  if (ids.length >= MAX_LIST_ROWS) return {}
  const next = lastId(v, key, ids, fallback) + 1
  const at = ids.indexOf(id) + 1 || ids.length
  return saveIds(key, [...ids.slice(0, at), next, ...ids.slice(at)], next)
}

/** Deleting the only row left puts an empty one in its place */
export function removeListRow(v: Values, { key, id, fallback }: ListRef): Values {
  const ids = rowIds(v, key, fallback)
  const last = lastId(v, key, ids, fallback)
  return ids.length > 1 ? saveIds(key, ids.filter((x) => x !== id), last) : saveIds(key, [last + 1], last + 1)
}

// ---------------------------------------------------------------- fixed tables

const split = (s: string | null | undefined) => String(s ?? '').split('|').filter(Boolean)
const clean = (s: string) => s.replace(/[^A-Za-z0-9.]+/g, '-').slice(0, 40)

/** Name of a row that stays the same when codes or limits change: its first value, else its number and test name */
function rowToken(row: Row): string {
  const value = row.find((c) => 'in' in c || 'calc' in c)
  if (value) return clean('in' in value ? value.in : 'calc' in value ? value.calc : '')
  return clean(`t-${row.slice(0, 2).map((c) => ('text' in c ? c.text : '')).join('-')}`)
}

function unique(names: string[]): string[] {
  const seen: Record<string, number> = {}
  return names.map((n) => { seen[n] = (seen[n] ?? 0) + 1; return seen[n] > 1 ? `${n}.${seen[n]}` : n })
}

interface Added { n: number; after: string }
const parseAdded = (s: string | null | undefined): Added[] => split(s).map((x) => {
  const at = x.indexOf('@')
  return { n: Number(x.slice(0, at)), after: x.slice(at + 1) }
}).filter((a) => a.n > 0)
const saveAdded = (list: Added[]) => list.map((a) => `${a.n}@${a.after}`).join('|')

export function addTableRow(v: Values, table: string, after: string): Values {
  const list = parseAdded(v[`_add_${table}`])
  const n = Math.max(0, Number(v[`_last_${table}`]) || 0, ...list.map((a) => a.n)) + 1
  return { [`_add_${table}`]: saveAdded([{ n, after }, ...list]), [`_last_${table}`]: String(n) }
}

export function removeTableRow(v: Values, table: string, token: string): Values {
  if (!token.startsWith('+')) return { [`_del_${table}`]: [...new Set([...split(v[`_del_${table}`]), token])].join('|') }
  const list = parseAdded(v[`_add_${table}`])
  const gone = list.find((a) => `+${a.n}` === token)
  return { [`_add_${table}`]: saveAdded(list.filter((a) => a !== gone).map((a) => (a.after === token ? { ...a, after: gone?.after ?? '' } : a))) }
}

export const deletedCount = (v: Values, table: string) => split(v[`_del_${table}`]).length
export const restoreTable = (table: string): Values => ({ [`_del_${table}`]: '' })

type Owner = { cell: Cell; cs: number; row: number }

/** Which cell covers each row / column of a table with spans */
function expand(rows: Row[]): Owner[][] {
  const grid: Owner[][] = rows.map(() => [])
  rows.forEach((row, r) => {
    let col = 0
    for (const cell of row) {
      while (grid[r][col]) col++
      const owner = { cell, cs: cell.cs ?? 1, row: r }
      for (let y = r; y < Math.min(rows.length, r + (cell.rs ?? 1)); y++) for (let x = 0; x < owner.cs; x++) grid[y][col + x] = owner
      col += owner.cs
    }
  })
  return grid
}

function editTable(block: Block, table: string, v: Values): Block {
  const rows = block.rows ?? []
  const tokens = unique(rows.map(rowToken))
  const deleted = new Set(split(v[`_del_${table}`]))
  const added = parseAdded(v[`_add_${table}`])
  if (!deleted.size && !added.length) return { ...block, table, refs: tokens.map((token) => ({ table, token })) }

  const grid = expand(rows)
  const width = Math.max(...grid.map((g) => g.length))
  const numbered = grid.some((g) => g[0] && 'text' in g[0].cell && /^\d+$/.test(g[0].cell.text))

  // Rows in their new order; an added row sits after base row `base`
  type Entry = { token: string; base: number; cells: Owner[] }
  const order: Entry[] = []
  const placed = new Set<number>()
  const putAdded = (after: string, base: number) => {
    for (const a of added) {
      if (a.after !== after || placed.has(a.n)) continue
      placed.add(a.n)
      const here = grid[base], next = grid[base + 1]
      const cells = range(width).map((_, c): Owner => {
        // Inside a spanning cell (method, remarks…): that cell grows
        if (here?.[c] && here[c] === next?.[c]) return here[c]
        const first = next?.[0]
        if (c === 0 && numbered) return { cell: { text: first && 'text' in first.cell && first.cell.text === '' ? '' : '#' }, cs: 1, row: -a.n }
        const above = here?.[c]?.cell
        return { cell: { in: `x_${table}_${a.n}_${c}`, left: !!above && 'left' in above && above.left }, cs: 1, row: -a.n }
      })
      order.push({ token: `+${a.n}`, base, cells })
      putAdded(`+${a.n}`, base)
    }
  }
  rows.forEach((_, r) => {
    if (!deleted.has(tokens[r])) order.push({ token: tokens[r], base: r, cells: grid[r] })
    putAdded(tokens[r], r)
  })
  for (const a of added) if (!placed.has(a.n)) putAdded(a.after, rows.length - 1)

  // S.No. runs on without gaps; a table with two lists (1…5, 1…9) starts again
  const numbers = new Map<Owner, string>()
  let n = 0, original = 0
  for (const e of order) {
    const o = e.cells[0]
    if (!o || numbers.has(o) || !('text' in o.cell)) continue
    if (o.cell.text === '#') numbers.set(o, String(++n))
    else if (/^\d+$/.test(o.cell.text)) {
      const k = Number(o.cell.text)
      if (k <= original) n = 0
      original = k
      numbers.set(o, String(++n))
    }
  }

  const done = new Set<Owner>()
  const out = order.map((e, r): Row => {
    const row: Row = []
    e.cells.forEach((o, c) => {
      if (done.has(o)) return
      done.add(o)
      let rs = 1
      while (order[r + rs]?.cells[c] === o) rs++
      row.push({ ...o.cell, ...(numbers.has(o) ? { text: numbers.get(o) } : {}), rs: rs > 1 ? rs : undefined, cs: o.cs > 1 ? o.cs : undefined } as Cell)
    })
    return row
  })
  return { ...block, table, rows: out, refs: order.map((e) => ({ table, token: e.token })) }
}

/** The tables of a report with the rows the lab added and deleted: drawn on the screen and on the print */
export function layoutBlocks(format: LabFormat, v: Values): Block[] {
  const blocks = format.blocks(v)
  // A table is named after its first value, so it keeps its edits when tables are put before it
  const names = unique(blocks.map((b) => (b.rows?.length && !b.refs ? rowToken(b.rows.find((r) => r.some((c) => !('text' in c))) ?? b.rows[0]) : '')))
  return blocks.map((b, k) => (b.rows?.length && !b.refs ? editTable(b, names[k], v) : b))
}

/** Row counts as shown, saved with a new report: its empty legacy row must not set the number of rows */
export function shownCounts(format: LabFormat, v: Values): Values {
  const out: Values = {}
  for (const b of format.blocks(v)) for (const ref of b.refs ?? []) if (ref && 'list' in ref) out[ref.list.key] = String(rowIds(v, ref.list.key, ref.list.fallback).length)
  return out
}
