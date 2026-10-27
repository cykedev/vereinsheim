// Erfundene Meyton-Ausdrucke mit Werten, in sich stimmig wie von der Anlage ([[meyton-printout]] „Werte auf dem Ausdruck,
// gemessen“): Werte aus der Lage über den Fachkern, Summen, Zähler und Innenzehner aus den Werten, Teiler abgeschnitten
// (beste auf 0,1, weiteste ganz), Trefferlage als Schwerpunkt abgeschnitten, Trefferkreis als kleinster Kreis plus
// Kaliber bzw. Streuwert (σ mit n − 1) gerundet, Bilder mit den Ringen des Scheibenbilds. Gebaut über `printoutPdf`;
// Namen und Nummern sind erfunden (ADR-029).

import {
  printoutPdf,
  type TestPicture,
  type TestPrintout,
  type TestSeries,
} from "@vereinsheim/meyton-pdf/test-printout"
import {
  centroid,
  smallestEnclosingCircle,
  standardDeviation,
} from "@vereinsheim/shot-core/geometry"
import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { TARGETS, type TargetId, type TargetImage } from "@vereinsheim/shot-core/targets"

/** Ringe des Scheibenbilds in mm, außen zuerst, dazu die Innenzehn */
const ringDiametersMm = (target: TargetImage) => [
  ...target.ringRadiiUm.map((r) => (2 * r) / 1000),
  target.innerTen.diameterMm,
]

export interface ValuedPrintoutSpec {
  layout?: "qt" | "ghostscript"
  mode?: string
  targetId?: TargetId
  /** Lagen in mm (rechts und hoch positiv), auf 0,01 mm; Vorgabe 40 Schüsse um die Mitte */
  shotsMm?: [number, number][]
  /** Schüsse je Serie; Vorgabe 10 */
  perSeries?: number
  /** Treffer als Kreuz statt Kreis */
  cross?: boolean
  /** ohne Bilder je Serie, nur die ganze Scheibe */
  wholeOnly?: boolean
  id?: string
  /** Erstellzeit im Info-Dict */
  printed?: string
  stand?: string
  discipline?: string
  /** Zeilen weglassen */
  omit?: (keyof TestPrintout)[]
  /** verfälscht den fertigen Ausdruck, etwa genau eine Zahl */
  tamper?: (spec: TestPrintout) => void
}

/** Mulberry32 mit festem Seed */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** `n` Lagen in mm auf dem Raster der Rohdaten (0,01 mm), Streuung `sdMm` je Achse */
export function shotsAround(n: number, seed = 7, sdMm = 9): [number, number][] {
  const rand = random(seed)
  const gauss = () =>
    Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand())
  return Array.from({ length: n }, () => [
    Math.round(gauss() * sdMm * 100) / 100,
    Math.round(gauss() * sdMm * 100) / 100,
  ])
}

const truncate = (value: number, digits: number) => {
  const f = 10 ** digits
  return (Math.sign(value) * Math.floor(Math.abs(value) * f + 1e-9)) / f
}
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits

interface Hit {
  nr: number
  xMm: number
  yMm: number
  decimalTenths: number
  ring: number
  innerTen: boolean
  /** Teiler in 1/100 mm */
  teiler: number
}

const sumText = (hits: readonly Hit[]) =>
  `${hits.reduce((s, h) => s + h.ring, 0)} (${(hits.reduce((s, h) => s + h.decimalTenths, 0) / 10).toFixed(1)})`
const best = (hits: readonly Hit[]) =>
  [...hits]
    .sort((a, b) => a.teiler - b.teiler)
    .slice(0, 3)
    .map((h) => `${truncate(h.teiler, 1).toFixed(1)} (${h.nr}.)`)
    .join(", ")
const widest = (hits: readonly Hit[]) =>
  [...hits]
    .sort((a, b) => b.teiler - a.teiler)
    .slice(0, 3)
    .map((h) => `${truncate(h.teiler, 0).toFixed(0)} (${h.nr}.)`)
    .join(", ")
function center(hits: readonly Hit[]): string {
  const c = centroid(hits.map((h) => ({ xUm: h.xMm, yUm: h.yMm })))!
  const x = truncate(c.xUm, 2)
  const y = truncate(c.yUm, 2)
  return `${Math.abs(x).toFixed(2)} mm ${x < 0 ? "links" : "rechts"}, ${Math.abs(y).toFixed(2)} mm ${y < 0 ? "tief" : "hoch"}`
}
function circle(hits: readonly Hit[], caliberMm: number): string {
  const c = smallestEnclosingCircle(hits.map((h) => ({ xUm: h.xMm, yUm: h.yMm })))!
  return `${round(2 * c.radiusUm + caliberMm, 2).toFixed(2)} mm`
}
function spread(hits: readonly Hit[]): string | undefined {
  const sx = standardDeviation(hits.map((h) => h.xMm))
  const sy = standardDeviation(hits.map((h) => h.yMm))
  if (sx === null || sy === null) return undefined
  const overall = Math.sqrt((sx * sx + sy * sy) / 2)
  return `${round(overall, 2).toFixed(2)}, horizontal: ${round(sx, 2).toFixed(2)}, vertikal: ${round(sy, 2).toFixed(2)}`
}

/** die Schüsse eines erfundenen Ausdrucks samt Werten, für Erwartungen in Tests */
export function valuedHits(spec: ValuedPrintoutSpec = {}): Hit[] {
  const target = TARGETS[spec.targetId ?? "lp-10m"]
  return (spec.shotsMm ?? shotsAround(40)).map(([xMm, yMm], i) => {
    const xUm = Math.round(xMm * 1000)
    const yUm = Math.round(yMm * 1000)
    const score = scoreFromCoordinates(target, xUm, yUm)
    return {
      nr: i + 1,
      xMm: xUm / 1000,
      yMm: yUm / 1000,
      decimalTenths: score.decimalTenths,
      ring: score.ring,
      innerTen: score.innerTen,
      teiler: Math.hypot(xUm, yUm) / 10,
    }
  })
}

/** der Ausdruck als Angaben für `printoutPdf` */
export function valuedSpec(spec: ValuedPrintoutSpec = {}): TestPrintout {
  const layout = spec.layout ?? "qt"
  const target = TARGETS[spec.targetId ?? "lp-10m"]
  const hits = valuedHits(spec)
  const perSeries = spec.perSeries ?? 10
  const series: Hit[][] = []
  for (let i = 0; i < hits.length; i += perSeries) series.push(hits.slice(i, i + perSeries))
  const counts = Array.from({ length: 11 }, (_, i) => hits.filter((h) => h.ring === 10 - i).length)
  const groupLines = (group: readonly Hit[]) =>
    layout === "qt"
      ? { circle: circle(group, target.caliberMm), center: center(group) }
      : { center: center(group), spread: spread(group) }
  const holes = (group: readonly Hit[]): [number, number][] => group.map((h) => [h.xMm, h.yMm])
  const picture = (group: readonly Hit[]): TestPicture => ({
    holes: holes(group),
    firstShot: group[0]?.nr ?? 1,
    cross: spec.cross,
    ringsMm: ringDiametersMm(target),
    holeMm: target.caliberMm,
  })

  const printout: TestPrintout = {
    layout,
    discipline: spec.discipline ?? (spec.targetId === "lg-10m" ? "LG 40" : "LP 40"),
    stand: spec.stand ?? "7",
    mode: spec.mode ?? "Wertung",
    result: sumText(hits),
    seriesLine: series.map((group) => sumText(group).split(" ")[0]).join(" "),
    counts: counts.join(" "),
    innerTens: String(hits.filter((h) => h.innerTen).length),
    widest: widest(hits),
    best: best(hits),
    ...groupLines(hits),
    series: series.map((group): TestSeries => ({
      sum: sumText(group),
      values: group.map((h) => `${(h.decimalTenths / 10).toFixed(1)}${h.innerTen ? "*" : ""}`),
      best: best(group),
      ...groupLines(group),
    })),
    pictures: [picture(hits), ...(spec.wholeOnly ? [] : series.map(picture))],
    id: spec.id,
    printed: spec.printed,
  }
  for (const key of spec.omit ?? []) delete printout[key]
  spec.tamper?.(printout)
  return printout
}

/** ein in sich stimmiger Ausdruck als PDF */
export async function valuedPrintout(spec: ValuedPrintoutSpec = {}): Promise<Uint8Array> {
  return printoutPdf(valuedSpec(spec))
}
