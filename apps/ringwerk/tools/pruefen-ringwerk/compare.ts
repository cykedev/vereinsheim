// Vergleich einer Aufnahme mit dem Ausgangsstand. Streng (Fehler) sind: welche Seite und welches PDF erreichbar ist,
// die Datenfolge jeder Seite (Zahlen und Namen in Lesereihenfolge), der Aufbau der Brackets und der Text jedes PDFs.
// Nur ein Hinweis ist der übrige Text einer Seite: Beschriftungen dürfen sich mit Design 2 ändern, Daten nicht.

import { dataTokenizer, type KnownNames } from "./normalize"

/** Eine Paarung im Bracket, wie die Seite sie zeigt */
export interface BracketPairing {
  a: string
  b: string
  /** Siege als „a:b“, leer bei einem Platz ohne Paarung */
  stand: string
}

export interface BracketRound {
  name: string
  pairings: BracketPairing[]
}

/** Aufnahme eines Wettbewerbs (oder der Seiten über alle Wettbewerbe) */
export interface Recording {
  name: string
  /** Seite oder PDF je Rolle → Ziel nach Umleitungen bzw. HTTP-Status */
  reach: Record<string, string>
  /** `<seite>@<rolle>@<breite>` → Zeilen des Texts unter `main` */
  pages: Record<string, string[]>
  /** Runden des Brackets, falls die Seite eines zeigt */
  bracket?: BracketRound[]
  /** PDF-Name → normalisierte Zeilen */
  pdfs: Record<string, string[]>
}

export type Severity = "fehler" | "hinweis"

export interface Finding {
  severity: Severity
  where: string
  what: string
  /** Ausschnitt: vorher, nachher */
  detail?: string
}

/** Zeilen-Diff (LCS); `-` nur vorher, `+` nur nachher, höchstens `limit` Zeilen mit Nachbarn */
export function lineDiff(before: readonly string[], after: readonly string[], limit = 12): string {
  const n = before.length
  const m = after.length
  // bei sehr langen Texten nur die erste abweichende Stelle, damit der Diff nicht quadratisch wächst
  if (n * m > 4_000_000) {
    let i = 0
    while (i < n && i < m && before[i] === after[i]) i++
    return [`@ Zeile ${i + 1}`, `- ${before[i] ?? "(Ende)"}`, `+ ${after[i] ?? "(Ende)"}`].join(
      "\n"
    )
  }
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] =
        before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const out: string[] = []
  let i = 0
  let j = 0
  while ((i < n || j < m) && out.length < limit) {
    if (i < n && j < m && before[i] === after[j]) {
      i++
      j++
    } else if (i < n && (j === m || lcs[i + 1][j] >= lcs[i][j + 1])) {
      out.push(`- ${before[i]}  (Zeile ${i + 1})`)
      i++
    } else {
      out.push(`+ ${after[j]}  (Zeile ${j + 1})`)
      j++
    }
  }
  return out.join("\n")
}

const bracketLines = (rounds: readonly BracketRound[] | undefined) =>
  (rounds ?? []).flatMap((r) => r.pairings.map((p) => `${r.name}: ${p.a} – ${p.b} ${p.stand}`))

function compareRecording(
  before: Recording,
  after: Recording,
  tokens: (lines: readonly string[]) => string[]
): Finding[] {
  const findings: Finding[] = []
  const where = before.name

  for (const key of new Set([...Object.keys(before.reach), ...Object.keys(after.reach)])) {
    if (before.reach[key] !== after.reach[key])
      findings.push({
        severity: "fehler",
        where,
        what: `${key}: erreichbar anders`,
        detail: `vorher ${before.reach[key] ?? "(nicht aufgenommen)"}, nachher ${after.reach[key] ?? "(nicht aufgenommen)"}`,
      })
  }

  for (const key of new Set([...Object.keys(before.pages), ...Object.keys(after.pages)])) {
    const a = before.pages[key]
    const b = after.pages[key]
    if (!a || !b) {
      findings.push({
        severity: "fehler",
        where,
        what: `${key}: Seite ${a ? "fehlt nachher" : "neu"}`,
      })
      continue
    }
    const ta = tokens(a)
    const tb = tokens(b)
    if (ta.join("\u0000") !== tb.join("\u0000"))
      findings.push({
        severity: "fehler",
        where,
        what: `${key}: Zahlen, Namen oder Reihenfolge anders`,
        detail: lineDiff(ta, tb),
      })
    else if (a.join("\n") !== b.join("\n"))
      findings.push({
        severity: "hinweis",
        where,
        what: `${key}: Beschriftung anders, Daten gleich`,
        detail: lineDiff(a, b),
      })
  }

  const ba = bracketLines(before.bracket)
  const bb = bracketLines(after.bracket)
  if (ba.join("\n") !== bb.join("\n"))
    findings.push({
      severity: "fehler",
      where,
      what: "Bracket anders",
      detail: lineDiff(ba, bb),
    })

  for (const key of new Set([...Object.keys(before.pdfs), ...Object.keys(after.pdfs)])) {
    const a = before.pdfs[key]
    const b = after.pdfs[key]
    if (!a || !b) {
      findings.push({
        severity: "fehler",
        where,
        what: `PDF ${key}: ${a ? "fehlt nachher" : "neu"}`,
      })
    } else if (a.join("\n") !== b.join("\n"))
      findings.push({
        severity: "fehler",
        where,
        what: `PDF ${key}: Text anders`,
        detail: lineDiff(a, b),
      })
  }
  return findings
}

/** Vergleicht alle Aufnahmen nach Schlüssel; ein fehlender oder neuer Wettbewerb ist ein Fehler */
export function compareAll(
  before: ReadonlyMap<string, Recording>,
  after: ReadonlyMap<string, Recording>,
  names: KnownNames
): Finding[] {
  const tokens = dataTokenizer(names)
  const findings: Finding[] = []
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(key)
    const b = after.get(key)
    if (!a || !b)
      findings.push({
        severity: "fehler",
        where: key,
        what: a ? "Wettbewerb fehlt nachher" : "Wettbewerb neu, nicht im Ausgangsstand",
      })
    else findings.push(...compareRecording(a, b, tokens))
  }
  return findings
}

/**
 * Gegenprobe: tauscht in der ersten Seite mit einer Tabelle zwei Datenzeilen (die ersten beiden mit „ | “ und
 * unterschiedlichem Inhalt). Der Vergleich danach muss einen Fehler melden; sonst sähe er vertauschte Plätze nicht.
 */
export function swapTableRows(
  recordings: Map<string, Recording>
): { key: string; page: string } | null {
  for (const [key, rec] of recordings) {
    for (const [page, lines] of Object.entries(rec.pages)) {
      const rows = lines
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => line.includes(" | ") && /\d/.test(line))
      for (let r = 1; r < rows.length; r++) {
        if (rows[r].line !== rows[r - 1].line && rows[r].i === rows[r - 1].i + 1) {
          const copy = [...lines]
          ;[copy[rows[r - 1].i], copy[rows[r].i]] = [copy[rows[r].i], copy[rows[r - 1].i]]
          recordings.set(key, { ...rec, pages: { ...rec.pages, [page]: copy } })
          return { key, page }
        }
      }
    }
  }
  return null
}
