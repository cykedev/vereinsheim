import type { BestOfStandingRow, HeadToHead } from "./bestOfStandingsTypes"

/**
 * Sorts active rows. Criteria, in order (the table columns mirror them left→right):
 *   1. wins desc (Match-Siege)
 *   2. duelDiff desc (Satzdifferenz)
 *   3. duelsWon desc (mehr gewonnene Sätze / Satzverhältnis)
 *   4. direct comparison (head-to-head) within the points-tied group — replaces the old "best value"
 *      (Sportleiter-Entscheid 2026-06-24); uses the MATCH winner, so it is mode-independent
 *   5. lastName localeCompare "de" (deterministic fallback)
 *
 * Also sets `row.directComparison` on every row so table/PDF can show WHY tied rows are ordered:
 *   - null               → row is alone on (wins, duelDiff, duelsWon); placement is visible from the left columns
 *   - decided / record   → head-to-head ordered the group
 *   - open / even        → head-to-head could not decide → alphabetical, with the reason made visible
 */
export function sortStandings(
  rows: BestOfStandingRow[],
  headToHead: HeadToHead
): BestOfStandingRow[] {
  // Criteria 1–3: the column-visible scalar criteria. Stable within an equal triple.
  const base = [...rows].sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins
    if (a.duelDiff !== b.duelDiff) return b.duelDiff - a.duelDiff
    if (a.duelsWon !== b.duelsWon) return b.duelsWon - a.duelsWon
    return 0
  })

  // Partition into maximal runs equal on (wins, duelDiff, duelsWon); resolve each by head-to-head.
  const result: BestOfStandingRow[] = []
  let i = 0
  while (i < base.length) {
    let j = i + 1
    while (
      j < base.length &&
      base[j].wins === base[i].wins &&
      base[j].duelDiff === base[i].duelDiff &&
      base[j].duelsWon === base[i].duelsWon
    ) {
      j++
    }
    const group = base.slice(i, j)
    if (group.length === 1) {
      group[0].directComparison = null
    } else {
      resolveTieGroup(group, headToHead)
    }
    result.push(...group)
    i = j
  }
  return result
}

/**
 * Orders a points-tied group by the direct comparison (Kriterium 4) and annotates each row.
 * Each member's direct balance counts only completed matches against the OTHER group members.
 * Mutates `group` in place (reorders) and sets `directComparison`.
 */
function resolveTieGroup(group: BestOfStandingRow[], headToHead: HeadToHead): void {
  const stat = new Map<string, { wins: number; losses: number; played: number }>()
  for (const m of group) {
    let wins = 0
    let losses = 0
    let played = 0
    const mh = headToHead.get(m.participantId)
    for (const o of group) {
      if (o.participantId === m.participantId) continue
      const res = mh?.get(o.participantId)
      if (!res) continue
      played++
      if (res.won) wins++
      else losses++
    }
    stat.set(m.participantId, { wins, losses, played })
  }

  const balance = (id: string): number => {
    const s = stat.get(id)!
    return s.wins - s.losses
  }

  // Better direct balance first; alphabetical for the rest (deterministic).
  group.sort((a, b) => {
    const d = balance(b.participantId) - balance(a.participantId)
    if (d !== 0) return d
    return a.lastName.localeCompare(b.lastName, "de")
  })

  // 2-way tie (the common case): a single direct match decides — or is still open.
  if (group.length === 2) {
    annotatePair(group[0], group[1], headToHead)
    annotatePair(group[1], group[0], headToHead)
    return
  }

  // 3+-way tie: the within-group balance decides the order; annotate honestly per member.
  // "even" only when the WHOLE group is fully played AND level on one balance (a true wash, e.g. a
  // 3-cycle A→B→C→A). A split group (different balances coexisting) shows each member's real record,
  // so the cross-group order (e.g. +1,+1,−1,−1) stays explicable instead of all reading "ausgeglichen".
  const opponentsInGroup = group.length - 1
  const allPlayed = group.every((m) => stat.get(m.participantId)!.played === opponentsInGroup)
  const firstBalance = balance(group[0].participantId)
  const wholeGroupLevel = allPlayed && group.every((m) => balance(m.participantId) === firstBalance)
  for (const m of group) {
    const s = stat.get(m.participantId)!
    if (s.played < opponentsInGroup) {
      // Not all internal matches played yet → comparison incomplete.
      m.directComparison = { kind: "open", opponent: null }
    } else if (wholeGroupLevel) {
      // Every member level on the direct comparison (cyclic / equal) → alphabetical, shown as such.
      m.directComparison = { kind: "even" }
    } else {
      m.directComparison = { kind: "record", wins: s.wins, losses: s.losses }
    }
  }
}

/** Annotate `row`'s directComparison for a 2-way tie against `other`. */
function annotatePair(
  row: BestOfStandingRow,
  other: BestOfStandingRow,
  headToHead: HeadToHead
): void {
  const res = headToHead.get(row.participantId)?.get(other.participantId)
  if (res) {
    row.directComparison = {
      kind: "decided",
      result: res.won ? "win" : "loss",
      satz: [res.duelsWon, res.duelsLost],
      opponent: other.lastName,
    }
  } else {
    // Direct match not played yet → ordered alphabetically; show why.
    row.directComparison = { kind: "open", opponent: other.lastName }
  }
}
