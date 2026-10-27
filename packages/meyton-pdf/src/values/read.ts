// Prototyp: liest die Werte eines Meyton-Ausdrucks samt Trefferbild, für die Gegenprobe gegen die Rohdaten (1c-0).
// Anders als `readPrintout` braucht er das Layout: Zeilen über ihre Beschriftung („Ergebnis:“, „Serie 2:“ …), Werte
// je Schuss unter dem Kopf ihrer Serie, und aus der Zeichnung die Ringe und Treffer als Kreise. Gemessen an zwei
// Druckwegen (Ghostscript mit „Streuwert“, Qt mit „Trefferkreis“). Was nicht dasteht, bleibt null.
//
// Grenzen wie `readPrintout` (DEFAULT_LIMITS); gegen präparierte PDFs schützt auch hier nur ein Kindprozess.

import { getDocumentProxy, getResolvedPDFJS } from "unpdf"

import { MeytonPdfError } from "../errors"
import { hasPdfHeader } from "../header"
import { DEFAULT_LIMITS, type PrintoutLimits } from "../limits"
import type {
  BoxPt,
  CenterMm,
  DrawnHole,
  DrawnLabel,
  Picture,
  PointPt,
  PrintoutValues,
  SeriesValues,
  ShotValue,
  SpreadValue,
  SumValue,
  TeilerRef,
} from "./types"

export type * from "./types"

export interface ReadValuesOptions {
  limits?: Partial<PrintoutLimits>
  /** monotone Uhr in ms; für Tests ersetzbar */
  now?: () => number
}

/** ein Textstück mit Lage: x, y der Grundlinie links, Breite und Schriftgröße in Punkt */
export interface TextPiece {
  str: string
  x: number
  y: number
  width: number
  size: number
}

/** ein Pfad der Zeichnung, achsparallel in Seitenkoordinaten */
export interface PathShape {
  box: BoxPt
  /** enthält Kurven (Kreis) statt nur Linien (Rechteck) */
  curved: boolean
}

const UNREADABLE = "Die PDF-Datei ist beschädigt oder nicht lesbar."

// ── Text ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const NUMBER = String.raw`\d+(?:[.,]\d+)?`
const toNumber = (text: string) => Number(text.replace(",", "."))
/** „92.7“ → 927; null bei mehr als einer Nachkommastelle */
function tenthsOf(text: string): number | null {
  const m = /^(\d+)(?:[.,](\d))?$/.exec(text)
  return m ? Number(m[1]) * 10 + Number(m[2] ?? 0) : null
}

const sameLine = (a: TextPiece, b: TextPiece) => Math.abs(a.y - b.y) < 0.3 * b.size

const LABELS = [
  "Ergebnis:",
  "Serien:",
  "Zähler:",
  "Innenzehner:",
  "Weiteste:",
  "beste Teiler:",
  "Trefferkreis:",
  "Trefferlage:",
  "Streuwert:",
] as const
type Label = (typeof LABELS)[number]

/** Stücke auf derselben Zeile (Grundlinie bis ein knappes Drittel der Schrift daneben) rechts von `from`, links von
 * `until`, nach x verbunden; Qt setzt Werte rund einen Punkt tiefer als ihre Beschriftung */
function lineText(pieces: readonly TextPiece[], from: TextPiece, until = Infinity): string {
  return pieces
    .filter((p) => p !== from && sameLine(p, from) && p.x > from.x && p.x < until)
    .sort((a, b) => a.x - b.x)
    .map((p) => p.str.trim())
    .join(" ")
    .trim()
}

/** „88 (92.7)“, „343“, „(361.9)“ */
export function parseSum(text: string): SumValue | null {
  const m = new RegExp(String.raw`^(\d+)?\s*(?:\((${NUMBER})\))?$`).exec(text.trim())
  if (!m || (m[1] === undefined && m[2] === undefined)) return null
  return {
    rings: m[1] === undefined ? null : Number(m[1]),
    tenths: m[2] === undefined ? null : tenthsOf(m[2]),
  }
}

export function parseTeiler(text: string): TeilerRef[] | null {
  const refs = [...text.matchAll(new RegExp(String.raw`(${NUMBER})\s*\((\d+)\.\)`, "g"))].map(
    (m) => ({ value: toNumber(m[1]), shot: Number(m[2]) })
  )
  return refs.length > 0 ? refs : null
}

export function parseMm(text: string): number | null {
  const m = new RegExp(String.raw`^(${NUMBER})\s*mm$`).exec(text.trim())
  return m ? toNumber(m[1]) : null
}

/** „1.09 mm links, 5.26 mm hoch“ → { x: -1.09, y: 5.26 }; rechts und hoch positiv */
export function parseCenter(text: string): CenterMm | null {
  const side = new RegExp(String.raw`(${NUMBER})\s*mm\s*(links|rechts)`).exec(text)
  const height = new RegExp(String.raw`(${NUMBER})\s*mm\s*(hoch|tief)`).exec(text)
  if (!side || !height) return null
  return {
    x: toNumber(side[1]) * (side[2] === "links" ? -1 : 1),
    y: toNumber(height[1]) * (height[2] === "tief" ? -1 : 1),
  }
}

export function parseSpread(text: string): SpreadValue | null {
  const m = new RegExp(
    String.raw`^(${NUMBER})(?:,\s*horizontal:\s*(${NUMBER}))?(?:,\s*vertikal:\s*(${NUMBER}))?$`
  ).exec(text.trim())
  if (!m) return null
  return {
    overall: toNumber(m[1]),
    horizontal: m[2] === undefined ? null : toNumber(m[2]),
    vertical: m[3] === undefined ? null : toNumber(m[3]),
  }
}

function parseInts(text: string): number[] | null {
  if (!/^[\d\s]+$/.test(text)) return null
  const values = text.trim().split(/\s+/).map(Number)
  return values.length > 0 ? values : null
}

/** „10.4*“, mit Teiler je Schuss in manchen Layouts „10.0 766T“ */
const SHOT_VALUE = new RegExp(String.raw`^(\d{1,2})[.,](\d)(\*?)(?:\s+(${NUMBER})T)?$`)
const SERIES_HEAD = /^Serie (\d+):$/

const inside = (box: BoxPt, x: number, y: number, margin = 0) =>
  x >= box.left - margin &&
  x <= box.right + margin &&
  y >= box.bottom - margin &&
  y <= box.top + margin

interface TextValues {
  discipline: string | null
  mode: string | null
  head: Partial<Record<Label, string>>
  series: SeriesValues[]
  layout: string[]
}

function seriesValues(
  number: number,
  head: string,
  rows: readonly TextPiece[],
  below: readonly TextPiece[],
  pieces: readonly TextPiece[]
): SeriesValues {
  const shots: ShotValue[] = []
  for (const piece of rows) {
    const m = SHOT_VALUE.exec(piece.str.trim())
    if (m)
      shots.push({
        series: number,
        value: tenthsOf(`${m[1]}.${m[2]}`)!,
        innerTen: m[3] === "*",
        teiler: m[4] === undefined ? null : toNumber(m[4]),
      })
  }
  const text = (label: string) => {
    const at = below.find((p) => p.str.trim() === label)
    return at ? lineText(pieces, at) : null
  }
  const teiler = text("beste Teiler:")
  const circle = text("Trefferkreis:")
  const center = text("Trefferlage:")
  const spread = text("Streuwert:")
  return {
    number,
    sum: parseSum(head),
    shots,
    bestTeiler: teiler === null ? null : parseTeiler(teiler),
    hitCircleMm: circle === null ? null : parseMm(circle),
    centerMm: center === null ? null : parseCenter(center),
    spread: spread === null ? null : parseSpread(spread),
  }
}

/** liest Kopf, Zeilen und Serien aus den Textstücken einer Seite; Stücke in Bildern zählen nicht */
export function readText(pieces: readonly TextPiece[], frames: readonly BoxPt[] = []): TextValues {
  const text = pieces.filter((p) => p.str.trim() !== "")
  const outside = text.filter((p) => !frames.some((f) => inside(f, p.x, p.y)))
  // Werte des Kopfs stehen links der Bilder; rechts davon beginnt die Zeichnung.
  const left = Math.min(Infinity, ...frames.filter((f) => f.left > 200).map((f) => f.left))

  const top = [...outside].sort((a, b) => b.y - a.y || a.x - b.x)
  const discipline = top[0]?.str.trim() ?? null
  const stand = outside.find((p) => /^StandNr:/.test(p.str.trim()))
  const mode = stand
    ? (outside
        .filter((p) => p !== stand && sameLine(p, stand))
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str.trim())
        .find((s) => !/\d/.test(s)) ?? null)
    : null

  // Zeilen der Serien: der Kopf „Serie n:“ (bei Ghostscript samt Summe in einem Stück), darunter die Werte, dann die
  // eigenen Zeilen bis zum nächsten Kopf.
  const heads = outside
    .map((p) => {
      const m = /^Serie (\d+):\s*(.*)$/.exec(p.str.trim())
      return m ? { piece: p, number: Number(m[1]), rest: m[2] } : null
    })
    .filter((h) => h !== null)
    .sort((a, b) => b.piece.y - a.piece.y)
  const firstHead = heads[0]?.piece.y ?? -Infinity

  const head: Partial<Record<Label, string>> = {}
  const layout: string[] = []
  for (const piece of [...outside].sort((a, b) => b.y - a.y)) {
    const label = LABELS.find((l) => piece.str.trim() === l)
    if (!label || piece.y <= firstHead || head[label] !== undefined) continue
    head[label] = lineText(outside, piece, left)
    layout.push(label)
  }

  const series = heads.map((h, i) => {
    const lower = heads[i + 1]?.piece.y ?? -Infinity
    const block = outside.filter((p) => p.y < h.piece.y - 1 && p.y > lower + 1)
    const firstLabel = Math.max(
      -Infinity,
      ...block.filter((p) => p.str.trim().endsWith(":")).map((p) => p.y)
    )
    const rows = block.filter((p) => p.y > firstLabel + 1).sort((a, b) => b.y - a.y || a.x - b.x)
    const below = block.filter((p) => p.y <= firstLabel + 1)
    const sumText = SERIES_HEAD.test(h.piece.str.trim()) ? lineText(outside, h.piece) : h.rest
    layout.push(`Serie ${h.number}:`)
    return seriesValues(h.number, sumText, rows, below, outside)
  })

  return { discipline, mode, head, series, layout }
}

// ── Zeichnung ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** ein Kreuz als Treffer ist kleiner als das, ein Rahmen größer */
const MAX_CROSS_PT = 20
const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance
const centerOf = (box: BoxPt): PointPt => ({
  x: (box.left + box.right) / 2,
  y: (box.bottom + box.top) / 2,
})
const sizeOf = (box: BoxPt) => box.right - box.left
const isSquare = (box: BoxPt) =>
  near(box.right - box.left, box.top - box.bottom, 0.02 * (box.right - box.left) + 0.05)

/**
 * findet die Trefferbilder: Kreise mit gemeinsamer Mitte (mindestens vier Durchmesser) sind die Ringe einer Scheibe,
 * die übrigen Kreise und kleine Kreuze ihre Treffer, zugeordnet in der Reihenfolge der Zeichnung (Treffer folgen den
 * Ringen ihres Bilds). Die Nummern sind ganze Zahlen im Rahmen des Bilds.
 */
export function readPictures(
  shapes: readonly PathShape[],
  pieces: readonly TextPiece[]
): Picture[] {
  // Ghostscript zeichnet einen Kreis als Füllung und dann als Rand: derselbe Kreis direkt hintereinander zählt einmal.
  // Ältere Ausdrucke zeichnen Treffer als Kreuz aus Linien, kleiner als jeder Rahmen.
  const circles: { x: number; y: number; d: number; cross: boolean }[] = []
  for (const s of shapes) {
    if (!isSquare(s.box) || (!s.curved && sizeOf(s.box) >= MAX_CROSS_PT)) continue
    const c = { ...centerOf(s.box), d: sizeOf(s.box), cross: !s.curved }
    const last = circles.at(-1)
    if (last && near(last.x, c.x, 0.01) && near(last.y, c.y, 0.01) && near(last.d, c.d, 0.01))
      continue
    circles.push(c)
  }

  // Mitten mit mindestens vier verschiedenen Durchmessern
  const centers: { x: number; y: number; diameters: number[] }[] = []
  for (const c of circles) {
    if (c.cross) continue
    let group = centers.find((g) => near(g.x, c.x, 0.3) && near(g.y, c.y, 0.3))
    if (!group) centers.push((group = { x: c.x, y: c.y, diameters: [] }))
    if (!group.diameters.some((d) => near(d, c.d, 0.05))) group.diameters.push(c.d)
  }
  const targets = centers.filter((g) => g.diameters.length >= 4)
  if (targets.length === 0) return []

  // Treffer: Kreise oder Kreuze außerhalb der Ringmitten, dem Bild zugeordnet, dessen Ringe zuletzt gezeichnet wurden.
  // Ihre häufigste Form und Größe ist die Marke des Bilds. Was weiter als der äußere Ring von der Mitte liegt, gehört
  // nicht zum Bild.
  const targetAt = (c: PointPt) =>
    targets.findIndex((t) => near(t.x, c.x, 0.3) && near(t.y, c.y, 0.3))
  const onTarget = (c: { x: number; y: number; d: number }, at: number) =>
    Math.hypot(c.x - targets[at].x, c.y - targets[at].y) <=
    Math.max(...targets[at].diameters) / 2 + c.d
  const counts = targets.map(() => new Map<string, number>())
  let current = -1
  for (const c of circles) {
    const at = c.cross ? -1 : targetAt(c)
    if (at !== -1) current = at
    else if (current !== -1 && onTarget(c, current)) {
      const key = `${c.cross ? "x" : "o"}${Math.round(c.d * 20) / 20}`
      counts[current].set(key, (counts[current].get(key) ?? 0) + 1)
    }
  }
  const markOf = counts.map((sizes) => {
    const key = [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0]
    return key === undefined ? null : { cross: key.startsWith("x"), d: Number(key.slice(1)) }
  })
  const isHole = (c: { d: number; cross: boolean }, at: number) => {
    const mark = markOf[at]
    return mark !== null && mark.cross === c.cross && near(c.d, mark.d, 0.03 * mark.d)
  }

  // zweiter Durchgang in der Reihenfolge der Zeichnung; ein Treffer genau in der Mitte hat die Marke, kein Ring
  const holes: { x: number; y: number }[][] = targets.map(() => [])
  current = -1
  for (const c of circles) {
    const at = c.cross ? -1 : targetAt(c)
    if (at !== -1 && !isHole(c, at)) current = at
    else if (current !== -1 && isHole(c, current) && onTarget(c, current)) holes[current].push(c)
  }

  const frames = shapes
    .filter((s) => !s.curved && isSquare(s.box) && sizeOf(s.box) >= MAX_CROSS_PT)
    .map((s) => s.box)

  return targets.map((target, at) => {
    const mark = markOf[at]
    const ringDiametersPt = target.diameters
      .filter((d) => !isHole({ d, cross: false }, at))
      .sort((a, b) => b - a)
    const drawn: DrawnHole[] = holes[at].map((h, index) => ({ index, x: h.x, y: h.y }))
    const frame =
      frames
        .filter((f) => inside(f, target.x, target.y))
        .sort((a, b) => sizeOf(a) - sizeOf(b))[0] ?? null
    const labels: DrawnLabel[] = frame
      ? pieces
          .filter((p) => /^\d{1,3}$/.test(p.str.trim()) && inside(frame, p.x, p.y, 1))
          .map((p) => ({
            shot: Number(p.str.trim()),
            x: p.x + p.width / 2,
            y: p.y + p.size * 0.35,
          }))
      : []
    return {
      frame,
      center: { x: target.x, y: target.y },
      ringDiametersPt,
      holeDiameterPt: mark?.d ?? null,
      holeShape: mark === null ? null : mark.cross ? "cross" : "circle",
      holes: drawn,
      labels,
    }
  })
}

// ── Zusammen ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** fügt Text und Zeichnung einer Seite zu den Werten des Ausdrucks zusammen */
export function valuesOf(
  pieces: readonly TextPiece[],
  shapes: readonly PathShape[]
): PrintoutValues {
  const pictures = readPictures(shapes, pieces)
  const text = readText(
    pieces,
    pictures.map((p) => p.frame).filter((f) => f !== null)
  )
  const h = text.head
  const parsed = <T>(label: Label, parse: (s: string) => T | null): T | null =>
    h[label] === undefined || h[label] === "" ? null : parse(h[label])
  return {
    discipline: text.discipline,
    mode: text.mode,
    result: parsed("Ergebnis:", parseSum),
    seriesRings: parsed("Serien:", parseInts),
    counts: parsed("Zähler:", parseInts),
    innerTens: parsed("Innenzehner:", (s) => (/^\d+$/.test(s) ? Number(s) : null)),
    bestTeiler: parsed("beste Teiler:", parseTeiler),
    widestTeiler: parsed("Weiteste:", parseTeiler),
    hitCircleMm: parsed("Trefferkreis:", parseMm),
    centerMm: parsed("Trefferlage:", parseCenter),
    spread: parsed("Streuwert:", parseSpread),
    series: text.series,
    shots: text.series.flatMap((s) => s.shots),
    pictures,
    layout: text.layout,
  }
}

// ── pdf.js ──────────────────────────────────────────────────────────────────────────────────────────────────────────

type Matrix = [number, number, number, number, number, number]
const multiply = (m: Matrix, n: readonly number[]): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]

/** Kurven im Pfad (pdf.js 5: Befehle 0 moveTo, 1 lineTo, 2 curveTo, 3 quadraticCurveTo, 4 closePath) */
function hasCurve(data: ArrayLike<number>): boolean {
  const width = [2, 2, 6, 4, 0]
  for (let i = 0; i < data.length;) {
    const op = data[i]
    if (op === 2 || op === 3) return true
    const w = width[op]
    if (w === undefined) return false
    i += 1 + w
  }
  return false
}

/**
 * Liest die Werte eines Ausdrucks (nur Seite 1, dort steht bei allen gemessenen alles). Grenzen und Fehler wie
 * `readPrintout`.
 */
export async function readPrintoutValues(
  bytes: Uint8Array,
  options: ReadValuesOptions = {}
): Promise<PrintoutValues> {
  const limits: PrintoutLimits = { ...DEFAULT_LIMITS, ...options.limits }
  const now = options.now ?? (() => performance.now())
  const startedAt = now()
  const checkTime = () => {
    if (now() - startedAt > limits.maxParseMs)
      throw new MeytonPdfError("Zeitüberschreitung beim Lesen der PDF-Datei.", { code: "timeout" })
  }
  if (bytes.length > limits.maxBytes)
    throw new MeytonPdfError("Die PDF-Datei ist zu groß.", { code: "tooLarge" })
  if (!hasPdfHeader(bytes)) throw new MeytonPdfError("Das ist keine PDF-Datei.", { code: "notPdf" })

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes), {
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: false,
      maxImageSize: 1024 * 1024,
      verbosity: 0,
    })
  } catch (error) {
    throw new MeytonPdfError(UNREADABLE, { cause: error })
  }
  try {
    checkTime()
    if (pdf.numPages > limits.maxPages)
      throw new MeytonPdfError(`Die PDF-Datei hat mehr als ${limits.maxPages} Seiten.`, {
        code: "tooManyPages",
      })
    const page = await pdf.getPage(1)
    checkTime()

    const pieces: TextPiece[] = []
    let chars = 0
    const reader = page.streamTextContent().getReader()
    while (true) {
      checkTime()
      const { done, value } = await reader.read()
      if (done) break
      for (const item of value?.items ?? []) {
        if (!("str" in item) || typeof item.str !== "string") continue
        chars += item.str.length
        if (pieces.length >= limits.maxTextItems || chars > limits.maxChars)
          throw new MeytonPdfError("Die PDF-Datei enthält zu viel Text.", { code: "tooMuchText" })
        const [a, , , d, x, y] = item.transform as number[]
        pieces.push({ str: item.str, x, y, width: item.width, size: Math.max(a, d) })
      }
    }

    const { OPS } = await getResolvedPDFJS()
    const list = await page.getOperatorList()
    checkTime()
    const shapes: PathShape[] = []
    let ctm: Matrix = [1, 0, 0, 1, 0, 0]
    const stack: Matrix[] = []
    list.fnArray.forEach((fn, i) => {
      const args = list.argsArray[i] as unknown[]
      if (fn === OPS.save) stack.push(ctm)
      else if (fn === OPS.restore) ctm = stack.pop() ?? ctm
      else if (fn === OPS.transform) ctm = multiply(ctm, args as number[])
      else if (fn === OPS.constructPath) {
        const [, paths, minMax] = args as [number, ArrayLike<number>[], ArrayLike<number> | null]
        if (!minMax || minMax.length < 4 || !Number.isFinite(minMax[0])) return
        const corner = (x: number, y: number) => [
          ctm[0] * x + ctm[2] * y + ctm[4],
          ctm[1] * x + ctm[3] * y + ctm[5],
        ]
        const [x0, y0] = corner(minMax[0], minMax[1])
        const [x1, y1] = corner(minMax[2], minMax[3])
        shapes.push({
          box: {
            left: Math.min(x0, x1),
            bottom: Math.min(y0, y1),
            right: Math.max(x0, x1),
            top: Math.max(y0, y1),
          },
          curved: (paths ?? []).some((data) => hasCurve(data)),
        })
      }
    })
    checkTime()
    return valuesOf(pieces, shapes)
  } catch (error) {
    if (error instanceof MeytonPdfError) throw error
    throw new MeytonPdfError(UNREADABLE, { cause: error })
  } finally {
    await pdf.loadingTask.destroy().catch(() => {})
  }
}
