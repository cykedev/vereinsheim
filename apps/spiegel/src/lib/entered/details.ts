// Angaben einer Scheibe ohne Brücke prüfen und normalisieren, ohne Datenbank ([[adr-033]]): vom Ausdruck (Parser),
// von Hand und aus Treffsicher. Was hier durchgeht, schreibt `writeEnteredCard`; jede Angabe in jeder Kombination, Ring
// und Zehntel getrennt, die Schusszahl einer Summe gespeichert mit ihr.

import { sumsShots, type CardSums, type SeriesSum } from "@vereinsheim/shot-core/metrics"
import { MAX_DECIMAL_TENTHS } from "@vereinsheim/shot-core/targets"

import type { CardOrigin } from "@/generated/prisma/client"

import type { ShotInput } from "../db/cards"
import { baseShotFlags } from "../ingest/card-checks"

export type EnteredOrigin = "pdf" | "manual" | "treffsicher"

export interface EnteredShot {
  series: number | null
  ring: number | null
  decimalTenths: number | null
  innerTen?: boolean | null
  xUm?: number | null
  yUm?: number | null
  distanceTenthsUm?: number | null
  firedAtMs?: number | null
  probe?: boolean
}

export interface DetailsInput {
  shots?: readonly EnteredShot[]
  series?: readonly {
    series: number
    shots?: number | null
    rings?: number | null
    decimalTenths?: number | null
  }[]
  total?: { shots?: number | null; rings?: number | null; decimalTenths?: number | null } | null
  center?: { xUm: number; yUm: number; shots?: number | null } | null
}

export interface NormalizedDetails {
  shots: ShotInput[]
  sums: CardSums | undefined
}

export type DetailsProblem =
  | "shotValue"
  | "shotRingTenths"
  | "shotSeries"
  | "seriesNumber"
  | "seriesShotsUnknown"
  | "seriesValue"
  | "seriesShots"
  | "seriesSum"
  | "totalShotsUnknown"
  | "totalValue"
  | "totalMismatch"
  | "centerWithoutResult"
  | "centerValue"
  | "place"
  | "importKey"

export const PLACE_MAX = 80
/** so weit von der Mitte liegt keine Trefferlage einer Scheibe (100 mm) */
const CENTER_MAX_UM = 100_000
/** Schlüssel der Übernahme aus Treffsicher: `treffsicher:<id der Einheit>` */
export const IMPORT_KEY = /^treffsicher:[A-Za-z0-9_-]{1,64}$/

type Checked<T> = { ok: true } & T
type Failed = { ok: false; problem: DetailsProblem }
const fail = (problem: DetailsProblem): Failed => ({ ok: false, problem })

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1
const inRange = (value: number | null, max: number) =>
  value === null || (Number.isInteger(value) && value >= 0 && value <= max)

/** Ort als Freitext: getrimmt, Leerraum zusammengefasst, leer heißt keiner; fehlt (`undefined`): nicht anfassen */
export function normalizePlace(
  raw: string | null | undefined
): Checked<{ place: string | null | undefined }> | Failed {
  if (raw === undefined) return { ok: true, place: undefined }
  const place = (raw ?? "").trim().replace(/\s+/g, " ")
  if (place.length > PLACE_MAX) return fail("place")
  return { ok: true, place: place || null }
}

/** ein Schlüssel der Übernahme nur aus Treffsicher und in seiner Form */
export function checkImportKey(
  origin: EnteredOrigin,
  importKey: string | null | undefined
): DetailsProblem | null {
  if (importKey === undefined || importKey === null) return null
  return origin === "treffsicher" && IMPORT_KEY.test(importKey) ? null : "importKey"
}

/** Summe in ganzen Ringen und in Zehnteln zu einer Schusszahl: im Bereich, mindestens eine, beide zueinander passend */
function sumFits(rings: number | null, decimalTenths: number | null, shots: number): boolean {
  if (rings === null && decimalTenths === null) return false
  if (!inRange(rings, 10 * shots) || !inRange(decimalTenths, MAX_DECIMAL_TENTHS * shots))
    return false
  // jeder Schuss liegt in Zehnteln zwischen 10 · Ring und 10 · Ring + 9
  return (
    rings === null ||
    decimalTenths === null ||
    (rings * 10 <= decimalTenths && decimalTenths <= rings * 10 + 9 * shots)
  )
}

/** Summe der Ringe bzw. Zehntel, wenn jeder Eintrag sie trägt; sonst null */
function sumOf(values: readonly (number | null)[]): number | null {
  return values.every((v) => v !== null)
    ? values.reduce((total: number, v) => total + (v as number), 0)
    : null
}

/** zwei Summen widersprechen sich nur, wenn beide bekannt sind */
const differs = (a: number | null, b: number | null) => a !== null && b !== null && a !== b

function normalizeShots(shots: readonly EnteredShot[]): Checked<{ shots: ShotInput[] }> | Failed {
  const next = new Map<number, number>()
  const out: ShotInput[] = []
  for (const [i, shot] of shots.entries()) {
    const { decimalTenths } = shot
    if (!inRange(shot.ring, 10) || !inRange(decimalTenths, MAX_DECIMAL_TENTHS))
      return fail("shotValue")
    if (shot.ring === null && decimalTenths === null) return fail("shotValue")
    // aus den Zehnteln folgt der Ring eindeutig, umgekehrt nicht
    const fromTenths = decimalTenths === null ? null : Math.min(10, Math.floor(decimalTenths / 10))
    if (shot.ring !== null && fromTenths !== null && shot.ring !== fromTenths)
      return fail("shotRingTenths")
    if (shot.series !== null && !isCount(shot.series)) return fail("shotSeries")
    const stellung = shot.probe ? 0 : 1
    const treffer = (next.get(stellung) ?? 0) + 1
    next.set(stellung, treffer)
    const xUm = shot.xUm ?? null
    const yUm = shot.yUm ?? null
    const distanceTenthsUm = shot.distanceTenthsUm ?? null
    out.push({
      seq: i + 1,
      stellung,
      treffer,
      series: shot.series,
      xUm,
      yUm,
      ring: shot.ring ?? fromTenths,
      decimalTenths,
      distanceTenthsUm,
      innerTen: shot.innerTen ?? null,
      displayMode: null,
      firedAtMs: shot.firedAtMs ?? null,
      // ohne Gegenprobe: die macht der Writer mit dem Scheibenbild der Disziplin
      flags: baseShotFlags({ xUm, yUm, distanceTenthsUm, decimalTenths, overTarget: false }),
    })
  }
  return { ok: true, shots: out }
}

/**
 * Angaben prüfen und normalisieren. Vorgaben: eine Serie ohne Schusszahl ist eine volle Serie (`seriesShots` der
 * Disziplin), ein Gesamtergebnis ohne Schusszahl hat die der Serien, sonst die der Schüsse, sonst die der Disziplin, eine
 * Trefferlage ohne Schusszahl die der Scheibe. Widersprechen sich Schüsse, Serien und Gesamtergebnis, ist das ein Problem.
 */
export function checkDetails(
  input: DetailsInput,
  discipline: { plannedShots: number | null; seriesShots: number | null }
): Checked<{ details: NormalizedDetails }> | Failed {
  const normalized = normalizeShots(input.shots ?? [])
  if (!normalized.ok) return normalized
  const { shots } = normalized
  const match = shots.filter((shot) => shot.stellung !== 0)

  const series: SeriesSum[] = []
  for (const entry of input.series ?? []) {
    if (!isCount(entry.series) || series.some((s) => s.series === entry.series))
      return fail("seriesNumber")
    const count = entry.shots ?? discipline.seriesShots
    if (count === null) return fail("seriesShotsUnknown")
    const rings = entry.rings ?? null
    const decimalTenths = entry.decimalTenths ?? null
    if (!isCount(count) || !sumFits(rings, decimalTenths, count)) return fail("seriesValue")
    series.push({ series: entry.series, shots: count, rings, decimalTenths })
  }
  series.sort((a, b) => a.series - b.series)

  if (series.length && match.length) {
    const numbers = new Set(series.map((s) => s.series))
    if (match.some((shot) => shot.series === null || !numbers.has(shot.series)))
      return fail("shotSeries")
    for (const sum of series) {
      const own = match.filter((shot) => shot.series === sum.series)
      if (!own.length) return fail("shotSeries")
      if (own.length !== sum.shots) return fail("seriesShots")
      if (
        differs(sum.rings, sumOf(own.map((s) => s.ring))) ||
        differs(sum.decimalTenths, sumOf(own.map((s) => s.decimalTenths)))
      )
        return fail("seriesSum")
    }
  }

  let total: CardSums["total"] = null
  if (input.total) {
    const fromSeries = series.length ? sumsShots({ series, total: null, center: null }) : null
    const count = input.total.shots ?? fromSeries ?? (match.length || discipline.plannedShots)
    if (count === null) return fail("totalShotsUnknown")
    const rings = input.total.rings ?? null
    const decimalTenths = input.total.decimalTenths ?? null
    if (!isCount(count) || !sumFits(rings, decimalTenths, count)) return fail("totalValue")
    if (
      fromSeries !== null &&
      (count !== fromSeries ||
        differs(rings, sumOf(series.map((s) => s.rings))) ||
        differs(decimalTenths, sumOf(series.map((s) => s.decimalTenths))))
    )
      return fail("totalMismatch")
    if (
      match.length &&
      (count !== match.length ||
        differs(rings, sumOf(match.map((s) => s.ring))) ||
        differs(decimalTenths, sumOf(match.map((s) => s.decimalTenths))))
    )
      return fail("totalMismatch")
    total = { shots: count, rings, decimalTenths }
  }

  let center: CardSums["center"] = null
  if (input.center) {
    if (!shots.length && !series.length && !total) return fail("centerWithoutResult")
    const { xUm, yUm } = input.center
    const placed = (v: number) => Number.isInteger(v) && Math.abs(v) <= CENTER_MAX_UM
    // Schusszahl der Scheibe wie am Ausdruck: die Wertung, bei nur Probe die Probe, ohne Schüsse die der Summen
    const count =
      input.center.shots ??
      (match.length || shots.length || sumsShots({ series, total, center: null }))
    if (!placed(xUm) || !placed(yUm) || !isCount(count)) return fail("centerValue")
    center = { xUm, yUm, shots: count }
  }

  const sums = series.length || total || center ? { series, total, center } : undefined
  return { ok: true, details: { shots, sums } }
}

/**
 * die Wertung „wie eingetragen“ als `standScoring`: Zehntel, wenn alle Werte Zehntel tragen, sonst ganze Ringe, wenn
 * alle sie tragen; erst die Wertungsschüsse, dann die Serien, dann das Gesamtergebnis; ohne Werte null. So stimmt
 * `cardScoring` auch ohne Wertung an der Disziplin
 */
export function enteredScoring(details: NormalizedDetails): "decimal" | "rings" | null {
  const levels: { rings: number | null; decimalTenths: number | null }[][] = [
    details.shots
      .filter((shot) => shot.stellung !== 0)
      .map((shot) => ({ rings: shot.ring, decimalTenths: shot.decimalTenths })),
    [...(details.sums?.series ?? [])],
    details.sums?.total ? [details.sums.total] : [],
  ]
  for (const level of levels) {
    if (!level.length) continue
    if (level.every((v) => v.decimalTenths !== null)) return "decimal"
    if (level.every((v) => v.rings !== null)) return "rings"
  }
  return null
}

/**
 * Wer die Angaben einer Scheibe ändern darf, und ihre Herkunft danach ([[adr-033]] „nur Eingetragenes ist änderbar“):
 * Rohdaten nie, eine Scheibe vom Ausdruck nur vom Ausdruck (Parser), gemessen und gescannt nie von Hand. Eingetragene
 * nur von Hand; eine aus Treffsicher auch von Hand (dann eingetragen) oder von der Übernahme. Null: nicht änderbar
 */
export function detailsWriter(existing: CardOrigin, writer: EnteredOrigin): CardOrigin | null {
  switch (existing) {
    case "raw":
      return null
    case "pdf":
      return writer === "pdf" ? "pdf" : null
    case "manual":
      return writer === "manual" ? "manual" : null
    case "treffsicher":
      return writer === "treffsicher" ? "treffsicher" : writer === "manual" ? "manual" : null
  }
}
