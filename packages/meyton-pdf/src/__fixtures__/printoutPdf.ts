// Erfundene Meyton-Ausdrucke mit Werten und Trefferbild nach den zwei gemessenen Layouts ([[meyton-printout]]): Qt mit
// Werten als eigenen Stücken und „Trefferkreis“, Ghostscript mit dem Kopf der Serie samt Summe in einem Stück. Text steht
// an Positionen wie gedruckt, die Trefferbilder sind Kreise (oder Kreuze) mit Rahmen im Inhaltsstrom. Fehlt ein Feld,
// fehlt seine Zeile. Namen und Nummern sind erfunden (ADR-029); echte Ausdrucke gehören nicht ins Repo.

import { buildPdf } from "./buildPdf"

const escape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")

/** ein Textstück an (x, y) in Helvetica, Größe in Punkt */
export const text = (str: string, x: number, y: number, size = 10) =>
  `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escape(str)}) Tj ET`

/** Kreis aus vier Bézier-Bögen; `paint` "S" (Rand), "f" (Füllung) oder "B" (beides) */
export function circle(cx: number, cy: number, d: number, paint = "S"): string {
  const r = d / 2
  const k = 0.5523 * r
  return [
    `${cx + r} ${cy} m`,
    `${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c`,
    `${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c`,
    `${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c`,
    `${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c`,
    `h ${paint}`,
  ].join("\n")
}

export const square = (left: number, bottom: number, size: number) =>
  `${left} ${bottom} ${size} ${size} re S`

/** ein Kreuz aus zwölf Linien um (x, y), `size` breit */
export function cross(x: number, y: number, size: number): string {
  const a = size / 2
  const b = size / 10
  const points = [
    [a, b],
    [b, b],
    [b, a],
    [-b, a],
    [-b, b],
    [-a, b],
    [-a, -b],
    [-b, -b],
    [-b, -a],
    [b, -a],
    [b, -b],
    [a, -b],
  ]
  return `${points.map(([px, py], i) => `${x + px} ${y + py} ${i === 0 ? "m" : "l"}`).join(" ")} h f`
}

/** Ringe der Luftpistole 10 m in mm, dazu die Innenzehn */
export const LP_RINGS_MM = [155.5, 139.5, 123.5, 107.5, 91.5, 75.5, 59.5, 43.5, 27.5, 11.5, 5]

export interface TestPicture {
  /** Mitte in Punkt; fehlt sie, setzt `printoutPdf` das Bild an seinen Platz (ganze Scheibe rechts oben, Serie links) */
  center?: [number, number]
  /** Punkt je mm */
  scale?: number
  /** Breite des Rahmens in Punkt */
  frame?: number
  /** Lagen der Treffer in mm, rechts und hoch positiv, in Schussfolge */
  holes: [number, number][]
  firstShot?: number
  /** jeden Kreis als Füllung und dann als Rand, wie Ghostscript */
  twice?: boolean
  /** Treffer als Kreuz aus Linien (5,1 mm) ohne Nummer, wie ältere Ausdrucke */
  cross?: boolean
  /** Ringe in mm, absteigend; Vorgabe Luftpistole */
  ringsMm?: number[]
  /** Durchmesser der Treffer in mm (Kaliber); Vorgabe 4,5 */
  holeMm?: number
}

/** Rahmen, Ringe, Treffer und Nummern eines Trefferbilds als Operatoren */
export function picture(p: TestPicture & { center: [number, number] }): string[] {
  const [cx, cy] = p.center
  const scale = p.scale ?? 1
  const frame = p.frame ?? 82
  const ops = [square(cx - frame / 2, cy - frame / 2, frame)]
  const draw = (x: number, y: number, d: number) =>
    p.twice ? [circle(x, y, d, "f"), circle(x, y, d, "S")] : [circle(x, y, d, "B")]
  for (const mm of p.ringsMm ?? LP_RINGS_MM) ops.push(...draw(cx, cy, mm * scale))
  p.holes.forEach(([x, y], i) => {
    const hx = cx + x * scale
    const hy = cy + y * scale
    if (p.cross) {
      ops.push(cross(hx, hy, 5.1 * scale))
      return
    }
    ops.push(...draw(hx, hy, (p.holeMm ?? 4.5) * scale))
    const label = String((p.firstShot ?? 1) + i)
    ops.push(text(label, hx - label.length * 1.5, hy - 1.05, 6))
  })
  return ops
}

export interface TestSeries {
  /** Summe wie gedruckt, etwa „97 (101.3)“ */
  sum?: string
  /** Werte je Schuss wie gedruckt, etwa „10.5*“ oder „9.6 912T“, fünf je Zeile */
  values: string[]
  best?: string
  circle?: string
  center?: string
  spread?: string
}

export interface TestPrintout {
  layout: "qt" | "ghostscript"
  /** Vorgabe „LP 40“; null: keine Zeile */
  discipline?: string | null
  stand?: string
  mode?: string
  /** Name vor der #Nummer; Vorgabe erfunden, null: keine Zeile */
  shooter?: string | null
  result?: string
  seriesLine?: string
  counts?: string
  innerTens?: string
  widest?: string
  best?: string
  circle?: string
  center?: string
  spread?: string
  series?: TestSeries[]
  /** `pictures[0]` die ganze Scheibe, danach je Serie eins */
  pictures?: TestPicture[]
  /** ID im Fuß; Vorgabe `ff914420`, null: keine */
  id?: string | null
  /** Erstellzeit im Info-Dict; Vorgabe 2. Oktober 2026, 19:52 */
  printed?: string
  /** „initialisiert“ im Fuß (nur Qt), etwa „02.10.2026 19:21“ */
  initialized?: string
  /** Serien im Strom rückwärts und vor dem Kopf: Die Zuordnung hängt an der Lage, nicht an der Folge */
  reversedStream?: boolean
  /** weitere Operatoren, etwa Kreise außerhalb der Bilder */
  extra?: string[]
}

const PRODUCER = { qt: "Qt 5.12.8", ghostscript: "GPL Ghostscript 9.55.0" } as const
const HEAD_LINES = [
  ["result", "Ergebnis:", 702, 12],
  ["seriesLine", "Serien:", 686, 12],
  ["counts", "Zähler:", 670, 11],
  ["innerTens", "Innenzehner:", 655, 11],
  ["widest", "Weiteste:", 642, 11],
  ["best", "beste Teiler:", 629, 11],
  ["circle", "Trefferkreis:", 615, 11],
  ["center", "Trefferlage:", 602, 11],
  ["spread", "Streuwert:", 589, 11],
] as const
const SERIES_LINES = [
  ["best", "beste Teiler:"],
  ["circle", "Trefferkreis:"],
  ["center", "Trefferlage:"],
  ["spread", "Streuwert:"],
] as const
const WHOLE = { center: [480, 656] as [number, number], scale: 0.7, frame: 114 }
const SERIES_PICTURE = { scale: 1, frame: 82 }
const FIRST_SERIES_Y = 571

/** ein Ausdruck als PDF; Latin-1 wie WinAnsi, damit „Zähler:“ ankommt */
export async function printoutPdf(spec: TestPrintout): Promise<Uint8Array> {
  const qt = spec.layout === "qt"
  const head: string[] = []
  const discipline = spec.discipline === undefined ? "LP 40" : spec.discipline
  if (discipline !== null) head.push(text(discipline, 57, 782, 15))
  if (qt) head.push(text("Klasse", 268, 782, 15))
  if (spec.stand !== undefined) head.push(text(`StandNr: ${spec.stand}`, 57, 766, 13))
  if (spec.mode !== undefined) head.push(text(spec.mode, qt ? 280 : 273, 766, 13))
  if (qt) head.push(text("02.10.2026 19:52", 436, 766, 13))
  const shooter = spec.shooter === undefined ? "Muster, Max" : spec.shooter
  if (shooter !== null) head.push(text(shooter, 58, 749, 13), text("#12345678", 153, 749, 9))
  for (const [key, label, y, size] of HEAD_LINES) {
    const value = spec[key]
    if (value === undefined) continue
    head.push(text(label, 57, y, size))
    if (value !== "") head.push(text(value, 157, y - (qt ? 1 : 0), size))
  }

  // Serien: Kopf, Werte zu fünft je Zeile, dann die eigenen Zeilen; daneben das Bild der Serie
  const blocks: string[][] = []
  const pictures = spec.pictures ?? []
  let y = FIRST_SERIES_Y
  ;(spec.series ?? []).forEach((series, i) => {
    const ops: string[] = []
    const label = `Serie ${i + 1}:`
    if (qt) {
      ops.push(text(label, 155, y))
      if (series.sum !== undefined) ops.push(text(series.sum, 190, y))
    } else {
      ops.push(text(series.sum === undefined ? label : `${label} ${series.sum}`, 156, y))
    }
    const rows = Math.ceil(series.values.length / 5)
    series.values.forEach((value, at) => {
      const row = Math.floor(at / 5)
      const column = at % 5
      // der erste Wert einer Zeile steht wie bei Ghostscript einen Hauch tiefer als die übrigen
      ops.push(text(value, 205 + column * 77, y - 15 - row * 14 - (column === 0 ? 0.01 : 0)))
    })
    let lineY = y - 15 - rows * 14
    for (const [key, name] of SERIES_LINES) {
      const value = series[key]
      if (value === undefined) continue
      ops.push(text(name, 154, lineY), text(value, 250, lineY))
      lineY -= 12
    }
    const picture = pictures[i + 1]
    if (picture) blocks.push([...ops, ...placed(picture, [98, y - 46], SERIES_PICTURE)])
    else blocks.push(ops)
    y = Math.min(lineY - 8, y - 92)
  })
  // Bilder ohne eigene Serie darunter, wie gezeichnet
  for (const extra of pictures.slice((spec.series ?? []).length + 1)) {
    blocks.push(placed(extra, [98, y - 46], SERIES_PICTURE))
    y -= 92
  }

  const footer: string[] = []
  if (qt && spec.initialized !== undefined)
    footer.push(text(`initialisiert: ${spec.initialized}`, 57, 35, 8))
  const id = spec.id === undefined ? "ff914420" : spec.id
  if (id !== null) footer.push(text(`ID: ${id} - Seite: 1`, 256, 26, 8))

  const whole = pictures[0] ? placed(pictures[0], WHOLE.center, WHOLE) : []
  const series = spec.reversedStream ? [...blocks].reverse().flat() : blocks.flat()
  const ops = spec.reversedStream
    ? [...series, ...head, ...whole, ...footer, ...(spec.extra ?? [])]
    : [...head, ...whole, ...series, ...footer, ...(spec.extra ?? [])]

  return buildPdf({
    pages: [[]],
    rawPages: [Uint8Array.from(ops.join("\n"), (char) => char.charCodeAt(0))],
    info: {
      CreationDate: spec.printed ?? "D:20261002195212+02'00'",
      Producer: PRODUCER[spec.layout],
      ...(qt ? { Creator: "Meyton Elektronik GmbH" } : {}),
    },
  })
}

function placed(
  p: TestPicture,
  center: [number, number],
  defaults: { scale: number; frame: number }
): string[] {
  return picture({
    ...p,
    center: p.center ?? center,
    scale: p.scale ?? defaults.scale,
    frame: p.frame ?? defaults.frame,
  })
}
