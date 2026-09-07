// Parses an A1-style range reference (as produced by the detectors, e.g.
// "B10:B45", "E4:Q65", "A1") into 0-based row/col bounds, for the mapping
// screen's sheet preview to highlight. Anything that isn't a plain cell/range
// reference (a sheet name chosen from a dropdown, "(未検出)", "(複数シート)")
// returns null, which the UI treats as "nothing to highlight".

export interface CellRange {
  r0: number
  c0: number
  r1: number
  c1: number
}

const CELL_RE = /^([A-Za-z]+)(\d+)$/

function colToIndex(col: string): number {
  let n = 0
  for (const ch of col.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

export type MergeInfo = { rowSpan: number; colSpan: number } | 'skip'

/** Maps "r:c" (0-based) to merge info, so a preview table can render the sheet's
 *  actual merged cells (colSpan/rowSpan on the anchor, nothing at all for the
 *  cells the merge covers) instead of one uniform box per cell - which looks
 *  nothing like the source spreadsheet once headers span multiple columns. */
export function buildMergeMap(merges: string[]): Map<string, MergeInfo> {
  const map = new Map<string, MergeInfo>()
  for (const m of merges) {
    const range = parseRangeRef(m)
    if (!range) continue
    const { r0, c0, r1, c1 } = range
    if (r0 === r1 && c0 === c1) continue // a 1x1 "merge" needs no special handling
    map.set(`${r0}:${c0}`, { rowSpan: r1 - r0 + 1, colSpan: c1 - c0 + 1 })
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (r === r0 && c === c0) continue
        map.set(`${r}:${c}`, 'skip')
      }
    }
  }
  return map
}

export function parseRangeRef(ref: string): CellRange | null {
  const trimmed = ref.trim()
  if (!trimmed) return null
  const parts = trimmed.split(':')
  if (parts.length > 2) return null

  const m0 = CELL_RE.exec(parts[0])
  if (!m0) return null
  const c0 = colToIndex(m0[1])
  const r0 = Number(m0[2]) - 1

  if (parts.length === 1) return { r0, c0, r1: r0, c1: c0 }

  const m1 = CELL_RE.exec(parts[1])
  if (!m1) return null
  const c1 = colToIndex(m1[1])
  const r1 = Number(m1[2]) - 1

  return {
    r0: Math.min(r0, r1),
    c0: Math.min(c0, c1),
    r1: Math.max(r0, r1),
    c1: Math.max(c0, c1),
  }
}
