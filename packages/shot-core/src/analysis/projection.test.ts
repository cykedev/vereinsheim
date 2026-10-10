import { describe, expect, it } from "vitest"

import { card } from "../__fixtures__/period"
import { OWN_SHOTS } from "../__fixtures__/meyton-eigene-scheiben"
import {
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

const DAY = 86_400_000

/** FNV-1a über 32 Bit: ein Fingerabdruck der Ausgabe, ohne Node-Typen im Paket */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/** die echten Scheiben des Users (Lage und Werte, Zeiten erzeugt), ab 20 Schuss */
const own: PeriodCard[] = [...new Set(OWN_SHOTS.map((s) => s.card))].flatMap((n) => {
  const rows = OWN_SHOTS.filter((s) => s.card === n)
  if (rows.length < 20) return []
  const shots: MetricShot[] = rows.map((s, i) => ({
    seq: i + 1,
    xUm: s.xUm,
    yUm: s.yUm,
    decimalTenths: s.decimalTenths,
    ring: Math.floor(s.decimalTenths / 10),
    innerTen: s.innerTen,
    firedAtMs: n * DAY + i * 41_000 + ((((s.xUm * 7 + s.yUm * 13) % 1000) + 1000) % 1000),
    kind: s.stellung === 1 ? "match" : "probe",
    series: s.stellung === 1 ? Math.ceil(s.nr / 10) : null,
  }))
  return [{ id: `own-${n}`, startedAtMs: n * DAY, kind: "training", complete: true, shots }]
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
const CARDS = [...own, ...special]

const PROJECTED: ProjectedCard[] = CARDS.map(projectCard)

describe("Projektion je Scheibe (ADR-031)", () => {
  it("die Testmenge ist reich genug: echte Scheiben und jeder Sonderfall", () => {
    expect(own.length).toBeGreaterThanOrEqual(20)
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
      version: "p2-26104e11",
      output: "57741-0a6c3183",
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

  it("nur Probe zeigt die Probe; an den echten Scheiben höchstens 5 µm neben der Lage", () => {
    expect(cardMarks(special[0].shots)).toHaveLength(10)
    for (const c of own) {
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
      const groups = [CARDS, own.slice(0, 3), special, [special[0]], [special[3], special[5]]]
      for (const group of groups) {
        const shots = group.flatMap((c) => [...asOnPrintout(c.shots)])
        expect(pooledMean(group.map(projectCard), scoring)).toBe(computeMetric(metric, shots))
      }
      expect(pooledMean([], scoring)).toBeNull()
    }
  )
})
