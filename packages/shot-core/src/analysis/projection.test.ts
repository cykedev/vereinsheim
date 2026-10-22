import { describe, expect, it } from "vitest"

import { card } from "../__fixtures__/period"
import {
  FLAG_OVER_TARGET,
  FLAG_SUSPICIOUS,
  METRICS,
  asOnPrintout,
  computeMetric,
  inScoring,
  inShotOrder,
  metricByKey,
  type MetricShot,
} from "../metrics"
import { cardValues, trainingVolume, type PeriodCard } from "./period"
import {
  cardMarks,
  cardProjection,
  markShots,
  pooledMean,
  projectCard,
  projectedRecords,
  projectedValues,
  projectedVolume,
  projectionVersion,
  type ProjectedCard,
} from "./projection"
import { FLAG_COUNTED_AS_MATCH, periodRecords } from "./records"
import { scoreFromCoordinates } from "../scoring"
import { LP_10M } from "../targets"

const DAY = 86_400_000

/** FNV-1a über 32 Bit: ein Fingerabdruck der Ausgabe, ohne Node-Typen im Paket */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/** Mulberry32: klein, schnell, deterministisch */
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

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

/**
 * erfundene Scheiben wie die eines aktiven Schützen: Luftpistole, Probe vor 20 bis 60 Wertungsschüssen, Lage und
 * Streuung schwanken je Scheibe, gelegentlich eine Pause; Werte aus der Lage über den Fachkern
 */
const generated: PeriodCard[] = Array.from({ length: 30 }, (_, n) => {
  const rand = random(1_000 + n)
  const sigma = Math.abs(3_600 + 900 * gaussian(rand))
  const mx = 800 * gaussian(rand)
  const my = 800 * gaussian(rand)
  const probe = 3 + Math.floor(rand() * 10)
  const match = 20 + 10 * Math.floor(rand() * 5)
  let at = n * DAY
  const shots: MetricShot[] = Array.from({ length: probe + match }, (_, i) => {
    const xUm = Math.round((mx + sigma * gaussian(rand)) / 10) * 10
    const yUm = Math.round((my + sigma * gaussian(rand)) / 10) * 10
    const score = scoreFromCoordinates(LP_10M, xUm, yUm)
    const isProbe = i < probe
    at += 35_000 + Math.round(30_000 * rand()) + (rand() < 0.04 ? 180_000 : 0)
    return {
      seq: i + 1,
      xUm,
      yUm,
      decimalTenths: score.decimalTenths,
      ring: score.ring,
      innerTen: score.innerTen,
      firedAtMs: at,
      kind: isProbe ? "probe" : "match",
      series: isProbe ? null : Math.ceil((i - probe + 1) / 10),
    }
  })
  return { id: `gen-${n}`, startedAtMs: n * DAY, kind: "training", complete: true, shots }
})

/** Sonderfälle: nur Probe, verdächtig, unvollständig, Wettkampf, ausgeschlossen, als Wertung gezählt */
const special: PeriodCard[] = [
  card("probe", 100, [101, 99, 104, 97, 100, 102, 98, 103, 96, 100], { probe: true }),
  card("counted", 101, [101, 102, 103, 99, 98, 100, 104, 97, 100, 101], {
    probe: true,
    flags: [FLAG_COUNTED_AS_MATCH],
  }),
  card(
    "suspicious",
    102,
    Array.from({ length: 20 }, (_, i) => 100 + (i % 7)),
    {
      shot: (i) => (i === 4 ? { flags: [FLAG_SUSPICIOUS] } : {}),
    }
  ),
  card("partial", 103, [100, 104, 99], { complete: false }),
  card(
    "match",
    104,
    Array.from({ length: 40 }, (_, i) => 95 + (i % 14)),
    { kind: "competition" }
  ),
  card(
    "excluded",
    105,
    Array.from({ length: 20 }, () => 109),
    { flags: ["ausgenommen"] }
  ),
  // mit Wertung und dem Merkmal: zählt nur mit `includeProbeOnly`, auch wenn der Probe-Filter nicht greift
  card(
    "counted-match",
    106,
    Array.from({ length: 20 }, () => 108),
    {
      flags: [FLAG_COUNTED_AS_MATCH],
    }
  ),
]
const CARDS = [...generated, ...special]

const PROJECTED: ProjectedCard[] = CARDS.map(projectCard)

describe("Projektion je Scheibe (ADR-031)", () => {
  it("die Testmenge ist reich genug: erzeugte Scheiben und jeder Sonderfall", () => {
    expect(generated.length).toBeGreaterThanOrEqual(20)
    expect(CARDS.reduce((sum, c) => sum + c.shots.length, 0)).toBeGreaterThan(900)
  })

  it.each(["decimal", "rings"] as const)(
    "jede Kennzahl der Ebene Scheibe aus der Projektion wie aus den Schüssen (%s)",
    (scoring) => {
      const cardMetrics = METRICS.filter((m) => m.scopes.includes("card"))
      expect(cardMetrics.length).toBeGreaterThan(10)
      for (const metric of cardMetrics)
        for (const includeProbeOnly of [false, true])
          expect(
            projectedValues(PROJECTED, metric, scoring, { includeProbeOnly }),
            `${metric.key} ${includeProbeOnly}`
          ).toEqual(cardValues(CARDS, metric, scoring, { includeProbeOnly }))
    }
  )

  it.each(["decimal", "rings"] as const)(
    "Rekorde aus der Projektion wie aus den Schüssen (%s)",
    (scoring) => {
      for (const kind of [undefined, "training", "competition"] as const)
        for (const includeProbeOnly of [false, true]) {
          const options = { kind, includeProbeOnly }
          expect(projectedRecords(PROJECTED, scoring, options), JSON.stringify(options)).toEqual(
            periodRecords(CARDS, scoring, options)
          )
        }
    }
  )

  it("die Version ändert sich mit jeder Kennzahl-Version", () => {
    const base = projectionVersion(METRICS)
    expect(base).toMatch(/^p\d+-[0-9a-f]{8}$/)
    expect(projectionVersion(METRICS)).toBe(base)
    const bumped = METRICS.map((m, i) => (i === 0 ? { ...m, version: m.version + 1 } : m))
    expect(projectionVersion(bumped)).not.toBe(base)
    expect(cardProjection(CARDS[0]).version).toBe(base)
  })

  it("unabhängig von der Folge, in der die Schüsse kommen (Abgabefolge zählt)", () => {
    for (const c of CARDS) {
      const shuffled = [...c.shots].reverse()
      for (let i = 0; i < shuffled.length; i += 3) shuffled.push(...shuffled.splice(i, 1))
      expect(cardProjection({ ...c, shots: shuffled }), c.id).toEqual(cardProjection(c))
    }
  })

  it("Version und Ausgabe hängen zusammen: Ändert sich die Ausgabe, muss die Version steigen", () => {
    // die Lagen gehören dazu: Sie werden mit derselben Version gespeichert
    const json = JSON.stringify(
      CARDS.map((c) => ({ ...cardProjection(c), version: undefined, marks: cardMarks(c.shots) }))
    )
    const output = `${json.length}-${fnv1a(json)}`
    // Wird dieser Test rot, rechnet die Projektion anders als die gespeicherten: PROJECTION_VERSION (oder die
    // `version` der geänderten Kennzahl) erhöhen, damit `refreshProjections` sie neu rechnet, dann beide Werte setzen.
    expect({ version: projectionVersion(), output }).toEqual({
      version: "p5-3131d8b6",
      output: "86025-092bcce2",
    })
  })

  it("Umfang und Merkmale der Projektion", () => {
    const probe = cardProjection(special[0])
    expect(probe).toMatchObject({ probeOnly: true, suspicious: false, printedShots: 10 })
    expect(cardProjection(special[2]).suspicious).toBe(true)
  })
})

describe("projectCard", () => {
  it("Merkmale der Scheibe und ihre Projektion; die amtliche Wertung nur, wenn sie bekannt ist", () => {
    const official = { ...special[4], official: "rings" as const, flags: ["x"] }
    expect(projectCard(official)).toEqual({
      id: "match",
      startedAtMs: official.startedAtMs,
      kind: "competition",
      complete: true,
      flags: ["x"],
      official: "rings",
      projection: cardProjection(official),
    })
    expect(projectCard(special[0])).not.toHaveProperty("official")
    expect(projectCard(special[0]).flags).toEqual([])
  })
})

describe("Lagen für die kleinen Scheiben", () => {
  const shot = (over: Partial<MetricShot>): MetricShot => ({
    seq: 1,
    xUm: 0,
    yUm: 0,
    decimalTenths: 100,
    ring: 10,
    innerTen: false,
    firedAtMs: 0,
    kind: "match",
    series: 1,
    ...over,
  })

  it("wie am Ausdruck, in Abgabefolge, auf 10 µm, ohne Lage weg, ohne Wert ohne Ring", () => {
    const marks = cardMarks([
      shot({ seq: 3, xUm: 1234, yUm: -5675, ring: 9 }),
      shot({ seq: 1, xUm: -4, yUm: 6, ring: 10 }),
      shot({ seq: 2, xUm: null, yUm: null }),
      shot({ seq: 4, xUm: 100, yUm: 200, ring: null, decimalTenths: null }),
      shot({ seq: 5, xUm: 999, yUm: 999, kind: "probe", series: null }),
    ])
    expect(marks).toEqual([
      [0, 1, 10],
      [123, -567, 9],
      [10, 20, null],
    ])
    expect(markShots(marks)).toEqual([
      { xUm: 0, yUm: 10, ring: 10 },
      { xUm: 1230, yUm: -5670, ring: 9 },
      { xUm: 100, yUm: 200, ring: null },
    ])
  })

  it("ohne verdächtige Schüsse; Schüsse über der Soll-Zahl bleiben (SF-15, SF-08)", () => {
    const marks = cardMarks([
      shot({ seq: 1, xUm: 1000, yUm: 0, ring: 10 }),
      shot({ seq: 2, xUm: 0, yUm: 0, ring: 9, decimalTenths: 95, flags: [FLAG_SUSPICIOUS] }),
      shot({ seq: 3, xUm: 2000, yUm: 0, ring: 10 }),
      shot({ seq: 4, xUm: 300, yUm: 300, ring: 0, decimalTenths: 0, flags: [FLAG_OVER_TARGET] }),
    ])
    expect(marks).toEqual([
      [100, 0, 10],
      [200, 0, 10],
      [30, 30, 0],
    ])
  })

  it("nur Probe zeigt die Probe; an den erzeugten Scheiben höchstens 5 µm neben der Lage", () => {
    expect(cardMarks(special[0].shots)).toHaveLength(10)
    for (const c of generated) {
      const shown = inShotOrder(asOnPrintout(c.shots))
      const drawn = markShots(cardMarks(c.shots))
      expect(drawn).toHaveLength(shown.length)
      drawn.forEach((mark, i) => {
        expect(Math.abs(mark.xUm - (shown[i].xUm as number))).toBeLessThanOrEqual(5)
        expect(Math.abs(mark.yUm - (shown[i].yUm as number))).toBeLessThanOrEqual(5)
        expect(mark.ring).toBe(shown[i].ring)
      })
    }
  })
})

describe("Umfang und Ø über mehrere Scheiben aus der Projektion", () => {
  it("projectedVolume wie trainingVolume", () => {
    const week = (ms: number) => String(Math.floor(ms / (7 * DAY)))
    const day = (ms: number) => String(Math.floor(ms / DAY))
    expect(projectedVolume(PROJECTED, week, day)).toEqual(trainingVolume(CARDS, week, day))
  })

  it.each(["decimal", "rings"] as const)(
    "pooledMean wie computeMetric über die Schüsse zusammen (%s)",
    (scoring) => {
      const metric = inScoring(metricByKey("result.decimalMean")!, scoring)
      const groups = [CARDS, generated.slice(0, 3), special, [special[0]], [special[3], special[5]]]
      for (const group of groups) {
        const shots = group.flatMap((c) => [...asOnPrintout(c.shots)])
        expect(pooledMean(group.map(projectCard), scoring)).toBe(computeMetric(metric, shots))
      }
      expect(pooledMean([], scoring)).toBeNull()
    }
  )
})

describe("Grenzfälle der Projektion", () => {
  // eigene Liste, nicht in `special`: Der Fingerabdruck der Ausgabe soll sich nicht ändern, nur weil Fälle dazukommen
  const base = card("rand", 110, [100, 101, 99, 102])
  const EDGE: PeriodCard[] = [
    { ...base, id: "leer", shots: [] },
    {
      ...base,
      id: "ohne-wert",
      shots: base.shots.map((s, i) => (i === 1 ? { ...s, decimalTenths: null, ring: null } : s)),
    },
    {
      ...base,
      id: "ohne-lage",
      shots: base.shots.map((s, i) => (i === 2 ? { ...s, xUm: null, yUm: null } : s)),
    },
    {
      ...base,
      id: "nur-ringe",
      shots: base.shots.map((s) => ({ ...s, decimalTenths: null })),
    },
    {
      ...base,
      id: "probe-ohne-wert",
      shots: base.shots.map((s, i) => ({
        ...s,
        kind: "probe" as const,
        series: null,
        ...(i === 0 ? { decimalTenths: null, ring: null } : {}),
      })),
    },
  ]
  const projected = EDGE.map(projectCard)

  it.each(["decimal", "rings"] as const)(
    "Werte, Rekorde und Ø wie aus den Schüssen (%s)",
    (scoring) => {
      for (const metric of METRICS.filter((m) => m.scopes.includes("card")))
        for (const includeProbeOnly of [false, true])
          expect(
            projectedValues(projected, metric, scoring, { includeProbeOnly }),
            `${metric.key} ${includeProbeOnly}`
          ).toEqual(cardValues(EDGE, metric, scoring, { includeProbeOnly }))
      expect(projectedRecords(projected, scoring, { includeProbeOnly: true })).toEqual(
        periodRecords(EDGE, scoring, { includeProbeOnly: true })
      )
      const metric = inScoring(metricByKey("result.decimalMean")!, scoring)
      for (const c of EDGE)
        expect(pooledMean([projectCard(c)], scoring), c.id).toBe(
          computeMetric(metric, [...asOnPrintout(c.shots)])
        )
      expect(pooledMean(projected, scoring)).toBe(
        computeMetric(
          metric,
          EDGE.flatMap((c) => [...asOnPrintout(c.shots)])
        )
      )
    }
  )

  it("Schusszahl, Umfang und Lagen", () => {
    for (const [i, c] of EDGE.entries()) {
      expect(projected[i].projection.printedShots, c.id).toBe(asOnPrintout(c.shots).length)
      const placed = asOnPrintout(c.shots).filter((s) => s.xUm !== null && s.yUm !== null)
      expect(cardMarks(c.shots), c.id).toHaveLength(placed.length)
    }
    expect(projected.map((c) => c.projection.probeOnly)).toEqual([true, false, false, false, true])
    const week = (ms: number) => String(Math.floor(ms / (7 * DAY)))
    const day = (ms: number) => String(Math.floor(ms / DAY))
    expect(projectedVolume(projected, week, day)).toEqual(trainingVolume(EDGE, week, day))
    expect(cardMarks(EDGE[1].shots)[1]).toEqual([10, 0, null])
  })
})
