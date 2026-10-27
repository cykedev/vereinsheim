// Gegenprobe ([[meyton-printout]]): vergleicht, was ein Meyton-Ausdruck zeigt (`@vereinsheim/meyton-pdf/values`), mit den Rohdaten
// derselben Scheibe. Reine Funktionen ohne Datenbank und ohne PDF; das Werkzeug `printout-check.ts` liest beides und
// fasst die Ergebnisse zusammen. Lagen in µm wie in Spiegel (x nach rechts, y nach oben), Längen im Ergebnis in mm.

import {
  centroid,
  extremeSpread,
  smallestEnclosingCircle,
  type Point,
} from "@vereinsheim/shot-core/geometry"
import type { TargetImage } from "@vereinsheim/shot-core/targets"
import type {
  CenterMm,
  Picture,
  PrintoutValues,
  ShotValue,
  SpreadValue,
  TeilerRef,
} from "@vereinsheim/meyton-pdf/values"

/** ein Schuss der Rohdaten in der Folge des Ausdrucks (Probe oder Wertung) */
export interface RawShot extends Point {
  /** Serie der Rohdaten, 1-basiert; null ohne Angabe */
  series: number | null
  /** ganzer Ring; null ohne Angabe */
  ring: number | null
  decimalTenths: number
  innerTen: boolean
  /** Abstand zur Mitte in 0,1 µm (Meyton `Teiler001`) */
  distanceTenthsUm: number
}

/** Teiler in der Einheit des Ausdrucks (1/100 mm) aus dem Abstand in 0,1 µm */
export const teilerOf = (distanceTenthsUm: number) => distanceTenthsUm / 100

const MM = 1000
/** auf `decimals` Stellen gerundet, die Hälfte vom Null weg (auch bei negativen Werten) */
const roundTo = (value: number, decimals: number) =>
  (Math.sign(value) * Math.round(Math.abs(value) * 10 ** decimals)) / 10 ** decimals
/** auf `decimals` Stellen abgeschnitten, zur Null hin */
const truncTo = (value: number, decimals: number) =>
  Math.trunc(value * 10 ** decimals + 1e-9 * Math.sign(value)) / 10 ** decimals
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9

/** Wie ist ein gedruckter Wert aus dem rohen entstanden: abgeschnitten oder gerundet auf `decimals` Stellen? */
export function howPrinted(
  printed: number,
  raw: number,
  decimals: number
): { truncated: boolean; rounded: boolean } {
  return {
    truncated: same(printed, truncTo(raw, decimals)),
    rounded: same(printed, roundTo(raw, decimals)),
  }
}

// ── Werte je Schuss, Serien, Ergebnis ──────────────────────────────────────────────────────────────────────────────

export interface ShotComparison {
  printed: number
  raw: number
  /** Schüsse, die beide Seiten zeigen (die ersten `compared`) */
  compared: number
  valueEqual: number
  innerTenEqual: number
  /** Teiler je Schuss, wo der Ausdruck ihn druckt, in der gedruckten Genauigkeit abgeschnitten bzw. gerundet gleich */
  teilerCompared: number
  teilerTruncated: number
  teilerRounded: number
  /** 0-basierte Stellen mit abweichendem Wert oder Innenzehner */
  mismatches: number[]
}

/** Wert und Innenzehner Schuss für Schuss in der Folge des Ausdrucks; ein Zwischenausdruck zeigt nur die ersten */
export function compareShots(
  printed: readonly ShotValue[],
  raw: readonly RawShot[]
): ShotComparison {
  const compared = Math.min(printed.length, raw.length)
  let valueEqual = 0
  let innerTenEqual = 0
  let teilerCompared = 0
  let teilerTruncated = 0
  let teilerRounded = 0
  const mismatches: number[] = []
  for (let i = 0; i < compared; i++) {
    const value = printed[i].value === raw[i].decimalTenths
    const inner = printed[i].innerTen === raw[i].innerTen
    if (value) valueEqual++
    if (inner) innerTenEqual++
    if (!value || !inner) mismatches.push(i)
    const teiler = printed[i].teiler
    if (teiler !== null) {
      teilerCompared++
      const how = howPrinted(
        teiler,
        teilerOf(raw[i].distanceTenthsUm),
        Number.isInteger(teiler) ? 0 : 1
      )
      if (how.truncated) teilerTruncated++
      if (how.rounded) teilerRounded++
    }
  }
  return {
    printed: printed.length,
    raw: raw.length,
    compared,
    valueEqual,
    innerTenEqual,
    teilerCompared,
    teilerTruncated,
    teilerRounded,
    mismatches,
  }
}

export interface SumCheck {
  what: string
  printed: number
  raw: number
}

/** Summen, die der Ausdruck nennt, gegen die Summen der Rohdaten; nur, was beide Seiten haben */
export function compareSums(values: PrintoutValues, raw: readonly RawShot[]): SumCheck[] {
  const shown = raw.slice(0, values.shots.length || raw.length)
  const checks: SumCheck[] = []
  const rings = (shots: readonly RawShot[]) =>
    shots.every((s) => s.ring !== null) ? shots.reduce((sum, s) => sum + s.ring!, 0) : null
  const tenths = (shots: readonly RawShot[]) => shots.reduce((sum, s) => sum + s.decimalTenths, 0)
  const push = (what: string, printed: number | null | undefined, rawValue: number | null) => {
    if (printed !== null && printed !== undefined && rawValue !== null)
      checks.push({ what, printed, raw: rawValue })
  }

  push("Ergebnis Ringe", values.result?.rings, rings(shown))
  push("Ergebnis Zehntel", values.result?.tenths, tenths(shown))
  let offset = 0
  for (const series of values.series) {
    const count = series.shots.length
    const part = shown.slice(offset, offset + count)
    offset += count
    if (part.length !== count || count === 0) continue
    push(`Serie ${series.number} Ringe`, series.sum?.rings, rings(part))
    push(`Serie ${series.number} Zehntel`, series.sum?.tenths, tenths(part))
  }
  values.seriesRings?.forEach((printed, i) => {
    const count = values.series[i]?.shots.length ?? 0
    const start = values.series.slice(0, i).reduce((sum, s) => sum + s.shots.length, 0)
    const part = shown.slice(start, start + count)
    if (count > 0 && part.length === count) push(`Serien ${i + 1}`, printed, rings(part))
  })
  if (values.innerTens !== null)
    push("Innenzehner", values.innerTens, shown.filter((s) => s.innerTen).length)
  // Zähler: Anzahl je Ring von 10 abwärts bis 0
  values.counts?.forEach((printed, i) => {
    const ring = 10 - i
    if (shown.some((s) => s.ring === null)) return
    push(`Zähler ${ring}`, printed, shown.filter((s) => s.ring === ring).length)
  })
  return checks
}

// ── Teiler ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TeilerCheck {
  shot: number
  printed: number
  /** Teiler der Rohdaten am genannten Schuss, 1/100 mm */
  raw: number | null
  /** gedruckt − roh */
  diff: number | null
  /** der genannte Schuss steht in der Rangfolge der Rohdaten an dieser Stelle (bei gleichem Teiler jeder davon) */
  rankOk: boolean
  /** auf die gedruckte Genauigkeit abgeschnitten bzw. gerundet gleich (beste eine Nachkommastelle, weiteste ganz) */
  truncated: boolean
  rounded: boolean
}

/**
 * genannte Teiler (beste oder weiteste) am jeweiligen Schuss der Rohdaten; `shots` sind die Schüsse, unter denen der
 * Ausdruck rangiert (ganze Scheibe oder eine Serie), `numbers` deren Schussnummern auf dem Ausdruck
 */
export function compareTeiler(
  refs: readonly TeilerRef[],
  raw: readonly RawShot[],
  kind: "best" | "widest",
  numbers: readonly number[] = raw.map((_, i) => i + 1)
): TeilerCheck[] {
  const ranked = numbers
    .map((n, i) => ({ n, teiler: teilerOf(raw[i].distanceTenthsUm) }))
    .sort((a, b) => (kind === "best" ? a.teiler - b.teiler : b.teiler - a.teiler))
  return refs.map((ref, rank) => {
    const at = numbers.indexOf(ref.shot)
    const rawTeiler = at === -1 ? null : teilerOf(raw[at].distanceTenthsUm)
    const how =
      rawTeiler === null
        ? { truncated: false, rounded: false }
        : howPrinted(ref.value, rawTeiler, kind === "best" ? 1 : 0)
    return {
      shot: ref.shot,
      printed: ref.value,
      raw: rawTeiler,
      diff: rawTeiler === null ? null : ref.value - rawTeiler,
      rankOk:
        rawTeiler !== null && ranked[rank] !== undefined && same(ranked[rank].teiler, rawTeiler),
      ...how,
    }
  })
}

// ── Trefferlage, Trefferkreis, Streuwert ─────────────────────────────────────────────────────────────────────────

export interface CenterCheck {
  printed: CenterMm
  raw: CenterMm
  /** Abstand der beiden Lagen in mm */
  distanceMm: number
  /** gedruckt = roh, auf 1/100 mm abgeschnitten (je Achse) */
  truncated: boolean
  /** gedruckt = roh, auf 1/100 mm gerundet (je Achse) */
  rounded: boolean
}

/** gedruckte Trefferlage gegen den Schwerpunkt der Rohdaten */
export function compareCenter(printed: CenterMm, shots: readonly Point[]): CenterCheck | null {
  const c = centroid(shots)
  if (!c) return null
  const raw = { x: c.xUm / MM, y: c.yUm / MM }
  const x = howPrinted(printed.x, raw.x, 2)
  const y = howPrinted(printed.y, raw.y, 2)
  return {
    printed,
    raw,
    distanceMm: Math.hypot(printed.x - raw.x, printed.y - raw.y),
    truncated: x.truncated && y.truncated,
    rounded: x.rounded && y.rounded,
  }
}

export const HIT_CIRCLE_CANDIDATES = [
  "enclosing",
  "enclosingPlusCaliber",
  "extremeSpread",
  "twiceMaxRadius",
] as const
export type HitCircleCandidate = (typeof HIT_CIRCLE_CANDIDATES)[number]

/**
 * die Kandidaten für Meytons Trefferkreis in mm: Durchmesser des kleinsten Kreises um die Trefferzentren, derselbe plus
 * Kaliber, größter Abstand zweier Zentren, doppelter größter Abstand zum Schwerpunkt
 */
export function hitCircleCandidates(
  shots: readonly Point[],
  caliberMm: number
): Record<HitCircleCandidate, number> | null {
  const circle = smallestEnclosingCircle(shots)
  const spread = extremeSpread(shots)
  const c = centroid(shots)
  if (!circle || spread === null || !c) return null
  const enclosing = (2 * circle.radiusUm) / MM
  return {
    enclosing,
    enclosingPlusCaliber: enclosing + caliberMm,
    extremeSpread: spread / MM,
    twiceMaxRadius:
      (2 * Math.max(...shots.map((s) => Math.hypot(s.xUm - c.xUm, s.yUm - c.yUm)))) / MM,
  }
}

export const SPREAD_CANDIDATES = ["population", "sample"] as const
export type SpreadCandidate = (typeof SPREAD_CANDIDATES)[number]

/**
 * Kandidaten für den „Streuwert“ (Layout mit Ghostscript), in mm: Standardabweichung je Achse mit n (Grundgesamtheit)
 * oder n − 1 (Stichprobe), gesamt als Wurzel aus dem Mittel der beiden Quadrate
 */
export function spreadCandidates(
  shots: readonly Point[]
): Record<SpreadCandidate, SpreadValue> | null {
  const c = centroid(shots)
  if (!c || shots.length < 2) return null
  const sx = shots.reduce((sum, s) => sum + (s.xUm - c.xUm) ** 2, 0)
  const sy = shots.reduce((sum, s) => sum + (s.yUm - c.yUm) ** 2, 0)
  const of = (n: number): SpreadValue => {
    const horizontal = Math.sqrt(sx / n) / MM
    const vertical = Math.sqrt(sy / n) / MM
    return { overall: Math.sqrt((horizontal ** 2 + vertical ** 2) / 2), horizontal, vertical }
  }
  return { population: of(shots.length), sample: of(shots.length - 1) }
}

/** welcher Kandidat am nächsten liegt, mit Abstand; bei Gleichstand der erste */
export function nearestCandidate<K extends string>(
  printed: number,
  candidates: Readonly<Record<K, number>>
): { candidate: K; diff: number } {
  let best: { candidate: K; diff: number } | null = null
  for (const [candidate, value] of Object.entries(candidates) as [K, number][]) {
    const diff = printed - value
    if (best === null || Math.abs(diff) < Math.abs(best.diff)) best = { candidate, diff }
  }
  return best!
}

// ── Trefferbild ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Durchmesser der Ringe der Scheibe in mm, absteigend: Ring 1 bis 10, dann der Innenzehner */
export function ringDiametersMm(target: TargetImage): number[] {
  return [...target.ringRadiiUm.map((r) => (2 * r) / MM), target.innerTen.diameterMm]
}

/** Punkt je mm aus den gezeichneten Ringen (Median der Verhältnisse); null, wenn die Zahl der Ringe nicht passt */
export function scaleFromRings(
  ringPt: readonly number[],
  ringMm: readonly number[]
): number | null {
  if (ringPt.length !== ringMm.length || ringPt.length === 0) return null
  const ratios = ringPt.map((pt, i) => pt / ringMm[i]).sort((a, b) => a - b)
  return median(ratios)
}

export interface DrawnFit {
  /** Abweichung je Schuss in mm, Maßstab und Mitte aus den Ringen */
  fromRings: number[] | null
  /** Abweichung je Schuss in mm nach bester Ausrichtung (Maßstab und Verschiebung, kleinste Quadrate) */
  fitted: number[]
  /** Maßstab der besten Ausrichtung in Punkt je mm */
  fittedScale: number
}

/**
 * Wie genau sitzen die gezeichneten Treffer an der Lage der Rohdaten? `drawn` und `raw` paarweise in derselben
 * Folge; das Bild hat y nach oben wie die Rohdaten.
 */
export function fitDrawn(
  drawn: readonly { x: number; y: number }[],
  raw: readonly Point[],
  rings: { center: { x: number; y: number }; ptPerMm: number } | null
): DrawnFit | null {
  const n = Math.min(drawn.length, raw.length)
  if (n < 2) return null
  const p = drawn.slice(0, n)
  const q = raw.slice(0, n).map((s) => ({ x: s.xUm / MM, y: s.yUm / MM }))

  // p ≈ s·q + t: s aus den zentrierten Größen, t aus den Mitten
  const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length
  const px = mean(p.map((v) => v.x))
  const py = mean(p.map((v) => v.y))
  const qx = mean(q.map((v) => v.x))
  const qy = mean(q.map((v) => v.y))
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (p[i].x - px) * (q[i].x - qx) + (p[i].y - py) * (q[i].y - qy)
    den += (q[i].x - qx) ** 2 + (q[i].y - qy) ** 2
  }
  if (den === 0) return null
  const s = num / den
  const tx = px - s * qx
  const ty = py - s * qy
  const fitted = p.map(
    (v, i) => Math.hypot(v.x - (s * q[i].x + tx), v.y - (s * q[i].y + ty)) / Math.abs(s)
  )

  const fromRings = rings
    ? p.map((v, i) =>
        Math.hypot(
          (v.x - rings.center.x) / rings.ptPerMm - q[i].x,
          (v.y - rings.center.y) / rings.ptPerMm - q[i].y
        )
      )
    : null
  return { fromRings, fitted, fittedScale: s }
}

export interface LabelCheck {
  /** Schüsse ohne ihre Nummer im Bild */
  missing: number
  /** Schüsse, deren Marke eine andere überdeckt (Abstand der Mitten kleiner als die Marke) */
  covered: number
  /** Abstand der Nummer zur Mitte ihrer Marke in mm, je gefundener Nummer */
  offsetsMm: number[]
}

/** Nummern im Bild: fehlen sie, sitzen sie auf ihrer Marke, überdecken sich Marken? */
export function checkLabels(picture: Picture, firstShot: number, ptPerMm: number): LabelCheck {
  const size = picture.holeDiameterPt ?? 0
  let missing = 0
  let covered = 0
  const offsetsMm: number[] = []
  picture.holes.forEach((hole, i) => {
    const shot = firstShot + i
    const own = picture.labels
      .filter((l) => l.shot === shot)
      .map((l) => Math.hypot(l.x - hole.x, l.y - hole.y))
      .sort((a, b) => a - b)[0]
    if (own === undefined) missing++
    else offsetsMm.push(own / ptPerMm)
    if (
      picture.holes.some(
        (other, j) => j !== i && Math.hypot(other.x - hole.x, other.y - hole.y) < size
      )
    )
      covered++
  })
  return { missing, covered, offsetsMm }
}

/** Lage einer Marke in mm, Mitte und Maßstab aus den Ringen; y nach oben wie die Rohdaten */
export function drawnMm(
  point: { x: number; y: number },
  rings: { center: { x: number; y: number }; ptPerMm: number }
): { x: number; y: number } {
  return {
    x: (point.x - rings.center.x) / rings.ptPerMm,
    y: (point.y - rings.center.y) / rings.ptPerMm,
  }
}

/** Teiler in 1/100 mm aus einer Lage in mm (Abstand zur Mitte) */
export const teilerFromMm = (point: { x: number; y: number }) => Math.hypot(point.x, point.y) * 100

/**
 * Abweichung der Nummern von der Lage der Rohdaten in mm: Nummer n gegen den n-ten Schuss des Bilds (ab `firstShot`),
 * die nächste Nummer mit diesem Wert, wenn sie mehrfach dasteht (Ringzahlen im Bild)
 */
export function labelDeviations(
  picture: Picture,
  firstShot: number,
  raw: readonly Point[],
  rings: { center: { x: number; y: number }; ptPerMm: number }
): number[] {
  const out: number[] = []
  raw.forEach((shot, i) => {
    const q = { x: shot.xUm / MM, y: shot.yUm / MM }
    const nearest = picture.labels
      .filter((l) => l.shot === firstShot + i)
      .map((l) => drawnMm(l, rings))
      .map((p) => Math.hypot(p.x - q.x, p.y - q.y))
      .sort((a, b) => a - b)[0]
    if (nearest !== undefined) out.push(nearest)
  })
  return out
}

export interface SelfCheck {
  what: string
  printed: number
  /** aus den gedruckten Werten je Schuss gerechnet */
  fromShots: number
}

/**
 * Stimmen die gedruckten Summen mit den gedruckten Werten je Schuss? Ring = ganze Zahl des Werts (10,4 → 10), wie
 * Meyton bei der Luftpistole; ohne Werte je Schuss nichts.
 */
export function selfCheck(values: PrintoutValues): SelfCheck[] {
  const shots = values.shots
  if (shots.length === 0) return []
  const ring = (s: ShotValue) => Math.floor(s.value / 10)
  const checks: SelfCheck[] = []
  const push = (what: string, printed: number | null | undefined, fromShots: number) => {
    if (printed !== null && printed !== undefined) checks.push({ what, printed, fromShots })
  }
  const sum = (list: readonly ShotValue[], f: (s: ShotValue) => number) =>
    list.reduce((total, s) => total + f(s), 0)
  push("Ergebnis Ringe", values.result?.rings, sum(shots, ring))
  push(
    "Ergebnis Zehntel",
    values.result?.tenths,
    sum(shots, (s) => s.value)
  )
  for (const series of values.series) {
    if (series.shots.length === 0) continue
    push("Serie Ringe", series.sum?.rings, sum(series.shots, ring))
    push(
      "Serie Zehntel",
      series.sum?.tenths,
      sum(series.shots, (s) => s.value)
    )
  }
  values.seriesRings?.forEach((printed, i) => {
    const series = values.series[i]
    if (series && series.shots.length > 0) push("Serien", printed, sum(series.shots, ring))
  })
  push("Innenzehner", values.innerTens, shots.filter((s) => s.innerTen).length)
  values.counts?.forEach((printed, i) =>
    push("Zähler", printed, shots.filter((s) => ring(s) === 10 - i).length)
  )
  return checks
}

/** für den Vergleich von Disziplinnamen: klein, Leerraum zusammengefasst, Minuszeichen als Bindestrich */
const normalizeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[\u2212\u2013]/g, "-")
    .replace(/\s+/g, " ")
    .trim()

export type NameMatch =
  { kind: "exact" | "normalized"; index: number } | { kind: "ambiguous" | "none" }

/** Der Name im Kopf gegen die Disziplinen der Anlage: genau ein Treffer, wörtlich oder nach Normalisieren */
export function matchDiscipline(printed: string, names: readonly string[]): NameMatch {
  const exact = names.flatMap((n, i) => (n === printed ? [i] : []))
  if (exact.length === 1) return { kind: "exact", index: exact[0] }
  if (exact.length > 1) return { kind: "ambiguous" }
  const loose = names.flatMap((n, i) => (normalizeName(n) === normalizeName(printed) ? [i] : []))
  if (loose.length === 1) return { kind: "normalized", index: loose[0] }
  return { kind: loose.length > 1 ? "ambiguous" : "none" }
}

// ── Zusammenfassen ───────────────────────────────────────────────────────────────────────────────────────────────

function median(sorted: readonly number[]): number {
  const mid = sorted.length / 2
  return sorted.length % 2 === 1 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
}

export interface Summary {
  n: number
  median: number | null
  p95: number | null
  max: number | null
  /** Anteil der Werte, deren Betrag höchstens `equalBelow` ist */
  shareEqual: number | null
}

/** Median, 95. Perzentil (nächster Rang) und Maximum der Beträge, dazu der Anteil „gleich“ */
export function summarize(values: readonly number[], equalBelow = 1e-9): Summary {
  if (values.length === 0) return { n: 0, median: null, p95: null, max: null, shareEqual: null }
  const sorted = values.map(Math.abs).sort((a, b) => a - b)
  return {
    n: sorted.length,
    median: median(sorted),
    p95: sorted[Math.ceil(0.95 * sorted.length) - 1],
    max: sorted[sorted.length - 1],
    shareEqual: sorted.filter((v) => v <= equalBelow).length / sorted.length,
  }
}
