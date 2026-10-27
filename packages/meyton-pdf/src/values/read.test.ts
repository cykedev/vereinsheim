import { describe, expect, it } from "vitest"

import { buildPdf } from "../__fixtures__/buildPdf"
import { MeytonPdfError } from "../errors"
import {
  parseCenter,
  parseMm,
  parseSpread,
  parseSum,
  parseTeiler,
  readPrintoutValues,
} from "./read"

// Erfundene Ausdrucke nach den zwei gemessenen Layouts (ohne Namen, ADR-029): Text an Positionen wie gedruckt, dazu
// Trefferbilder aus Kreisen und Rahmen als Inhaltsstrom.

const escape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
const text = (str: string, x: number, y: number, size = 10) =>
  `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escape(str)}) Tj ET`

/** Kreis aus vier Bézier-Bögen; `paint` "S" (Rand), "f" (Füllung) oder "B" (beides) */
function circle(cx: number, cy: number, d: number, paint = "S"): string {
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
const square = (left: number, bottom: number, size: number) =>
  `${left} ${bottom} ${size} ${size} re S`

interface TestPicture {
  center: [number, number]
  /** Punkt je mm */
  scale: number
  frame: number
  /** Lagen der Treffer in mm, in Schussfolge */
  holes: [number, number][]
  firstShot?: number
  /** jeden Kreis als Füllung und dann als Rand, wie Ghostscript */
  twice?: boolean
  /** Treffer als Kreuz aus Linien (5,1 mm, fast wie die Innenzehn) ohne Nummer, wie ältere Ausdrucke */
  cross?: boolean
}

/** ein Kreuz aus zwölf Linien um (x, y), `size` breit */
function cross(x: number, y: number, size: number): string {
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

/** Scheibe der Luftpistole: Ringe 10 bis 1, Innenzehn, Treffer mit Nummer in der Mitte */
function picture(p: TestPicture): string[] {
  const [cx, cy] = p.center
  const ops = [square(cx - p.frame / 2, cy - p.frame / 2, p.frame)]
  const draw = (x: number, y: number, d: number) =>
    p.twice ? [circle(x, y, d, "f"), circle(x, y, d, "S")] : [circle(x, y, d, "B")]
  for (const mm of [155.5, 139.5, 123.5, 107.5, 91.5, 75.5, 59.5, 43.5, 27.5, 11.5, 5])
    ops.push(...draw(cx, cy, mm * p.scale))
  p.holes.forEach(([x, y], i) => {
    const hx = cx + x * p.scale
    const hy = cy + y * p.scale
    if (p.cross) {
      ops.push(cross(hx, hy, 5.1 * p.scale))
      return
    }
    ops.push(...draw(hx, hy, 4.5 * p.scale))
    const label = String((p.firstShot ?? 1) + i)
    ops.push(text(label, hx - label.length * 1.5, hy - 1.05, 6))
  })
  return ops
}

async function printout(ops: string[]): Promise<Uint8Array> {
  return buildPdf({
    pages: [[]],
    // Latin-1 wie WinAnsi, damit „Zähler:“ ankommt
    rawPages: [Uint8Array.from(ops.join("\n"), (char) => char.charCodeAt(0))],
    info: { CreationDate: "D:20261002195212+02'00'", Producer: "GPL Ghostscript 9.55.0" },
  })
}

/** Kopf und Zeilen wie im Layout mit „Trefferkreis“ (Qt): Werte als eigene Stücke */
const qtHead = [
  text("LP 40", 57, 782, 15),
  text("Klasse", 268, 782, 15),
  text("StandNr: 4", 57, 766, 13),
  text("Probe", 280, 766, 13),
  text("02.10.2026 19:52", 436, 766, 13),
  text("Muster, Max", 58, 749, 13),
  text("#12345678", 153, 749, 9),
  text("Ergebnis:", 57, 702, 12),
  text("97", 157, 701, 12),
  text("(101.3)", 181, 701, 12),
  text("Serien:", 57, 686, 12),
  text("97", 157, 686, 12),
  text("Zähler:", 57, 670, 11),
  text("4 4 1 1 0 0 0 0 0 0 0", 157, 670, 11),
  text("Innenzehner:", 57, 655, 11),
  text("2", 157, 655, 11),
  text("Weiteste:", 57, 642, 11),
  text("1520 (9.), 990 (4.), 610 (2.)", 156, 642, 11),
  text("beste Teiler:", 57, 629, 11),
  text("88.1 (1.), 201.7 (6.), 255.0 (3.)", 156, 629, 11),
  text("Trefferkreis:", 57, 615, 11),
  text("21.36 mm", 156, 615, 11),
  text("Trefferlage:", 57, 602, 11),
  text("1.09 mm links, 0.40 mm tief", 156, 602, 11),
  text("Serie 1:", 155, 571),
  text("97", 190, 571),
  text("(101.3)", 206, 571),
  // der erste Wert einer Zeile steht wie bei Ghostscript einen Hauch tiefer als die übrigen
  ...["10.5*", "9.8", "10.1", "9.4", "8.9"].map((v, i) =>
    text(v, 205 + i * 77, i === 0 ? 556.99 : 557)
  ),
  ...["10.6*", "10.2", "9.9", "8.2", "9.0"].map((v, i) => text(v, 205 + i * 77, 543)),
  text("beste Teiler:", 154, 529),
  text("88.1 (1.), 201.7 (6.), 255.0 (3.)", 250, 529),
  text("Trefferkreis:", 154, 517),
  text("21.36 mm", 250, 517),
  text("Trefferlage:", 154, 505),
  text("1.09 mm links, 0.40 mm tief", 250, 505),
  text("ID: ff914420 - Seite: 1", 256, 26, 8),
]

/** Kopf im Layout mit „Streuwert“ (Ghostscript): Kopf der Serie samt Summe in einem Stück */
const gsHead = [
  text("LP 40", 57, 782, 15),
  text("StandNr: 3", 57, 764, 13),
  text("Wertung", 273, 764, 13),
  text("Ergebnis:", 57, 697, 12),
  text("18", 156, 697, 12),
  text("(19.4)", 241, 697, 12),
  text("Trefferlage:", 57, 612, 12),
  text("0.50 mm rechts, 1.30 mm hoch", 156, 612, 12),
  text("Streuwert:", 57, 598, 12),
  text("10.88, horizontal: 11.90, vertikal: 9.77", 156, 598, 12),
  text("Serie 1: 18 (19.4)", 156, 570),
  text("9.2", 180, 556),
  text("10.2", 260, 556),
  text("Trefferlage:", 156, 515),
  text("0.98 mm rechts, 3.66 mm tief", 227, 515),
  text("Streuwert:", 156, 504),
  text("10.16, horizontal: 12.00, vertikal: 7.89", 227, 504),
  text("Serie 2: 0 (0.0)", 156, 479),
]

describe("einzelne Zeilen", () => {
  it("liest Summen in Ringen und Zehnteln", () => {
    expect(parseSum("88 (92.7)")).toEqual({ rings: 88, tenths: 927 })
    expect(parseSum("343")).toEqual({ rings: 343, tenths: null })
    expect(parseSum("(361.9)")).toEqual({ rings: null, tenths: 3619 })
    expect(parseSum("(361,9)")).toEqual({ rings: null, tenths: 3619 })
    expect(parseSum("")).toBeNull()
    expect(parseSum("88 (92.75)")).toEqual({ rings: 88, tenths: null })
  })

  it("liest Teiler mit Schussnummer", () => {
    expect(parseTeiler("171.4 (10.), 347.5 (32.)")).toEqual([
      { value: 171.4, shot: 10 },
      { value: 347.5, shot: 32 },
    ])
    expect(parseTeiler("4920 (26.)")).toEqual([{ value: 4920, shot: 26 }])
    expect(parseTeiler("–")).toBeNull()
  })

  it("liest die Trefferlage mit rechts und hoch positiv", () => {
    expect(parseCenter("1.09 mm links, 5.26 mm hoch")).toEqual({ x: -1.09, y: 5.26 })
    expect(parseCenter("6.49 mm rechts, 2.74 mm tief")).toEqual({ x: 6.49, y: -2.74 })
    expect(parseCenter("6.49 mm rechts")).toBeNull()
  })

  it("liest Trefferkreis und Streuwert", () => {
    expect(parseMm("75.59 mm")).toBe(75.59)
    expect(parseMm("75.59")).toBeNull()
    expect(parseSpread("10.88, horizontal: 11.90, vertikal: 9.77")).toEqual({
      overall: 10.88,
      horizontal: 11.9,
      vertical: 9.77,
    })
    expect(parseSpread("10.88")).toEqual({ overall: 10.88, horizontal: null, vertical: null })
  })
})

describe("readPrintoutValues", () => {
  it("liest Kopf, Zeilen und Serie im Layout mit Trefferkreis", async () => {
    const values = await readPrintoutValues(await printout(qtHead))
    expect(values.discipline).toBe("LP 40")
    expect(values.mode).toBe("Probe")
    expect(values.shooter).toBe("Muster, Max")
    expect(values.result).toEqual({ rings: 97, tenths: 1013 })
    expect(values.seriesRings).toEqual([97])
    expect(values.counts).toEqual([4, 4, 1, 1, 0, 0, 0, 0, 0, 0, 0])
    expect(values.innerTens).toBe(2)
    expect(values.widestTeiler).toEqual([
      { value: 1520, shot: 9 },
      { value: 990, shot: 4 },
      { value: 610, shot: 2 },
    ])
    expect(values.bestTeiler?.[0]).toEqual({ value: 88.1, shot: 1 })
    expect(values.hitCircleMm).toBe(21.36)
    expect(values.centerMm).toEqual({ x: -1.09, y: -0.4 })
    expect(values.spread).toBeNull()
    expect(values.layout).toEqual([
      "Ergebnis:",
      "Serien:",
      "Zähler:",
      "Innenzehner:",
      "Weiteste:",
      "beste Teiler:",
      "Trefferkreis:",
      "Trefferlage:",
      "Serie 1:",
    ])
    const [series] = values.series
    expect(series.sum).toEqual({ rings: 97, tenths: 1013 })
    expect(series.hitCircleMm).toBe(21.36)
    expect(series.centerMm).toEqual({ x: -1.09, y: -0.4 })
    expect(values.shots.map((s) => s.value)).toEqual([105, 98, 101, 94, 89, 106, 102, 99, 82, 90])
    expect(values.shots.filter((s) => s.innerTen).map((s) => s.value)).toEqual([105, 106])
    expect(values.shots.every((s) => s.series === 1)).toBe(true)
  })

  it("liest das Layout mit Streuwert und die Summe im Kopf der Serie", async () => {
    const values = await readPrintoutValues(await printout(gsHead))
    expect(values.mode).toBe("Wertung")
    expect(values.result).toEqual({ rings: 18, tenths: 194 })
    expect(values.hitCircleMm).toBeNull()
    expect(values.spread).toEqual({ overall: 10.88, horizontal: 11.9, vertical: 9.77 })
    expect(values.series.map((s) => s.sum)).toEqual([
      { rings: 18, tenths: 194 },
      { rings: 0, tenths: 0 },
    ])
    expect(values.series[0].centerMm).toEqual({ x: 0.98, y: -3.66 })
    expect(values.series[0].spread?.vertical).toBe(7.89)
    expect(values.series[1].shots).toEqual([])
    expect(values.shots.map((s) => s.value)).toEqual([92, 102])
  })

  it("lässt fehlende Felder null und findet ohne Zeichnung kein Trefferbild", async () => {
    const values = await readPrintoutValues(
      await printout([text("LP 40", 57, 782, 15), text("Ergebnis:", 57, 702, 12)])
    )
    expect(values.result).toBeNull()
    expect(values.mode).toBeNull()
    expect(values.shooter).toBeNull()
    expect(values.counts).toBeNull()
    expect(values.bestTeiler).toBeNull()
    expect(values.centerMm).toBeNull()
    expect(values.series).toEqual([])
    expect(values.shots).toEqual([])
    expect(values.pictures).toEqual([])
    expect(values.layout).toEqual(["Ergebnis:"])
  })

  it("findet Ringe, Treffer in Schussfolge und Nummern je Bild", async () => {
    const whole: [number, number][] = [
      [0, 0],
      [3, -2],
      [-10, 4],
    ]
    const ops = [
      ...qtHead,
      ...picture({ center: [480, 656], scale: 1.5, frame: 114, holes: whole }),
      ...picture({ center: [98, 540], scale: 1.2, frame: 82, holes: whole.slice(0, 2) }),
      ...picture({
        center: [98, 452],
        scale: 1.0,
        frame: 82,
        holes: whole.slice(2),
        firstShot: 3,
        twice: true,
      }),
    ]
    const values = await readPrintoutValues(await printout(ops))
    expect(values.pictures).toHaveLength(3)
    const [big, first, second] = values.pictures
    expect(big.center.x).toBeCloseTo(480, 3)
    expect(big.center.y).toBeCloseTo(656, 3)
    expect(big.ringDiametersPt).toHaveLength(11)
    expect(big.ringDiametersPt[0]).toBeCloseTo(155.5 * 1.5, 1)
    expect(big.holeDiameterPt).toBeCloseTo(4.5 * 1.5, 1)
    expect(big.frame?.left).toBeCloseTo(480 - 57, 1)
    // der erste Treffer liegt genau in der Mitte und zählt trotzdem als Treffer
    expect(big.holes.map((h) => [h.index, h.x - 480, h.y - 656])).toEqual([
      [0, 0, 0],
      [1, expect.closeTo(4.5, 3), expect.closeTo(-3, 3)],
      [2, expect.closeTo(-15, 3), expect.closeTo(6, 3)],
    ])
    expect(big.labels.map((l) => l.shot)).toEqual([1, 2, 3])
    expect(first.holes).toHaveLength(2)
    expect(first.holes[1].x - 98).toBeCloseTo(3.6, 3)
    // Füllung und Rand desselben Kreises zählen einmal
    expect(second.holes).toHaveLength(1)
    expect(second.ringDiametersPt).toHaveLength(11)
    expect(second.labels.map((l) => l.shot)).toEqual([3])
    // Nummern im Bild stören die Zeilen daneben nicht
    expect(values.result).toEqual({ rings: 97, tenths: 1013 })
  })

  it("nimmt Kreuze als Treffer, hält die Innenzehn für einen Ring und lässt ferne Kreise weg", async () => {
    const ops = [
      ...picture({
        center: [480, 656],
        scale: 1.25,
        frame: 128,
        holes: [
          [2, 1],
          [-6, 3],
          [0, 0],
        ],
        cross: true,
      }),
      // gleich groß wie die Kreuze, aber weit außerhalb der Scheibe
      circle(150, 300, 5.1 * 1.25, "B"),
    ]
    const [only] = (await readPrintoutValues(await printout(ops))).pictures
    expect(only.holeShape).toBe("cross")
    expect(only.holeDiameterPt).toBeCloseTo(5.1 * 1.25, 1)
    expect(only.ringDiametersPt).toHaveLength(11)
    expect(only.holes.map((h) => [h.x - 480, h.y - 656])).toEqual([
      [expect.closeTo(2.5, 3), expect.closeTo(1.25, 3)],
      [expect.closeTo(-7.5, 3), expect.closeTo(3.75, 3)],
      [expect.closeTo(0, 3), expect.closeTo(0, 3)],
    ])
    expect(only.labels).toEqual([])
  })

  it("liest den Teiler je Schuss, wo das Layout ihn druckt", async () => {
    const values = await readPrintoutValues(
      await printout([
        text("Serie 1: 18 (17.8)", 156, 587),
        text("10.0 766T", 149, 573),
        text("7.8* 2555.5T", 229, 573),
      ])
    )
    expect(values.shots).toEqual([
      { series: 1, value: 100, innerTen: false, teiler: 766 },
      { series: 1, value: 78, innerTen: true, teiler: 2555.5 },
    ])
  })

  it("weist Dateien ab, die keine PDFs oder zu groß sind", async () => {
    await expect(readPrintoutValues(new TextEncoder().encode("hallo"))).rejects.toMatchObject({
      code: "notPdf",
    })
    const pdf = await printout(qtHead)
    const error = await readPrintoutValues(pdf, { limits: { maxBytes: 10 } }).catch(
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(MeytonPdfError)
    expect(error).toMatchObject({ code: "tooLarge" })
  })

  it("bricht nach der Zeitgrenze ab", async () => {
    let clock = 0
    const pdf = await printout(qtHead)
    await expect(
      readPrintoutValues(pdf, { limits: { maxParseMs: 5 }, now: () => (clock += 10) })
    ).rejects.toMatchObject({ code: "timeout" })
  })
})
