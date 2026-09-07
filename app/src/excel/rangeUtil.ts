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
