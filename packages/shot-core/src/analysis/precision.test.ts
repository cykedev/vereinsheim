import { describe, expect, it } from "vitest"

import { MATCH, PROBE, SPREAD } from "../__fixtures__/cards"
import { FLAG_SUSPICIOUS, type MetricShot } from "../metrics"
import { centroid } from "../geometry"
import { LG_10M } from "../targets"
import { groupShape, outlierLoss, outliers, ringWidths, sigmaEstimate } from "./precision"

describe("Rayleigh-σ (P5)", () => {
  it("σ̂ mit c4 und 95-%-Bereich über χ², ohne den Wert vor der Korrektur", () => {
    // SPREAD: Σr² = 40 mm², 2(n − 1) = 10 Freiheitsgrade, √(40/10) = 2 mm vor der Korrektur.
    // Meytons „Sa“ (eben dieser Wert) zeigt Spiegel nicht: kein Vorteil gegenüber σ̂ (Oktober 2026).
    const sigma = sigmaEstimate(SPREAD)
    expect(Object.keys(sigma ?? {}).sort()).toEqual(["high", "low", "n", "sigma"])
    expect(sigma?.n).toBe(6)
    expect(sigma?.sigma).toBeCloseTo(2050.5458, 3)
    expect(sigma?.low).toBeCloseTo(1397.4341, 3)
    expect(sigma?.high).toBeCloseTo(3509.8671, 3)
  })

  it("unter drei Schuss kein Wert; verdächtige Schüsse zählen nicht (SF-15)", () => {
    expect(sigmaEstimate(SPREAD.slice(0, 2))).toBeNull()
    const placeholder: MetricShot = { ...SPREAD[0], xUm: 0, yUm: 0, flags: ["verdaechtig"] }
    expect(sigmaEstimate([...SPREAD, placeholder])?.n).toBe(6)
  })
})

describe("Form und Ringbreiten (P8, P9)", () => {
  it("Form: Halbachsen, Verhältnis, Winkel; den Winkel erst ab zehn Schuss zeigen", () => {
    const shape = groupShape(SPREAD)
    expect(shape?.majorUm).toBeCloseTo(Math.sqrt(5.2e6), 6)
    expect(shape?.minorUm).toBeCloseTo(Math.sqrt(2.8e6), 6)
    expect(shape?.ratio).toBeCloseTo(Math.sqrt(5.2 / 2.8), 9)
    expect(shape?.angleRad).toBeCloseTo(0, 9)
    // Mauchly: W = 4 · 5,2 · 2,8 / 8² = 0,91, Grenze bei n = 6: 0,05^(1/2) = 0,2236
    expect(shape?.sphericity).toBeCloseTo(0.91, 9)
    expect(shape?.elongated).toBe(false)
    expect(shape?.showAngle).toBe(false)
    const stretched = Array.from({ length: 10 }, (_, i) => ({
      ...SPREAD[0],
      xUm: (i - 4.5) * 1000,
      yUm: i % 2 === 0 ? 300 : -300,
    }))
    expect(groupShape(stretched)?.showAngle).toBe(true)
  })

  it("SPREAD: ohne Ausreißer nichts herausgenommen, die Mitte ist der Schwerpunkt", () => {
    const shape = groupShape(SPREAD)
    expect(shape?.without).toEqual([])
    expect(shape?.n).toBe(6)
    const center = centroid(SPREAD.map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number })))
    expect(shape?.centerUm).toEqual(center)
  })

  it("Abreißer zählen für die Form nicht", () => {
    // acht im Kreis von 1 mm (wie im Ausreißer-Block), dazu zwei Abreißer, die V6 als 9 und 10 markiert
    const ring = [0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => ({
      ...MATCH[0],
      xUm: Math.round(1000 * Math.cos((deg * Math.PI) / 180)),
      yUm: Math.round(1000 * Math.sin((deg * Math.PI) / 180)),
      firedAtMs: i * 1000,
    }))
    const flyers = [
      { ...MATCH[0], xUm: 4000, yUm: 0, firedAtMs: 9000 },
      { ...MATCH[0], xUm: 4000, yUm: 400, firedAtMs: 10_000 },
    ]
    const shape = groupShape([...ring, ...flyers])
    expect(shape?.n).toBe(8)
    expect(shape?.without).toEqual([9, 10])
    // die acht sind rund: Σdx² = Σdy² = 2 · 1000² + 4 · 707² über 7, Σdxdy = 0
    const half = Math.sqrt(ring.reduce((sum, s) => sum + (s.xUm as number) ** 2, 0) / 7)
    expect(shape?.majorUm).toBeCloseTo(half, 0)
    expect(shape?.minorUm).toBeCloseTo(half, 0)
    expect(shape?.ratio).toBeLessThan(1.01)
    expect(shape?.elongated).toBe(false)
    expect(Math.hypot(shape!.centerUm.xUm, shape!.centerUm.yUm)).toBeLessThan(1)
    // mit den Abreißern wäre sie gestreckt (Gegenprobe im Plan, Task 2)
  })

  it("unter fünf Schuss kein Urteil über Ausreißer: alle zählen", () => {
    const shape = groupShape(SPREAD.slice(0, 4))
    expect(shape?.without).toEqual([])
    expect(shape?.n).toBe(4)
  })

  it("gestreckt nur, wenn Mauchly es mit 95 % zeigt, nicht schon ab a/b 1,3", () => {
    const ellipse = (a: number, b: number) =>
      Array.from({ length: 12 }, (_, k) => ({
        ...SPREAD[0],
        xUm: Math.round(a * Math.cos((k * Math.PI) / 6)),
        yUm: Math.round(b * Math.sin((k * Math.PI) / 6)),
      }))
    // a/b = 3: W = 4 · 9 · 1 / 10² = 0,36 unter der Grenze 0,05^(2/10) = 0,5493
    const long = groupShape(ellipse(3000, 1000))
    expect(long?.sphericity).toBeCloseTo(0.36, 6)
    expect(long?.elongated).toBe(true)
    expect(long?.showAngle).toBe(true)
    // a/b = 1,4: W = 0,8949, rund im Rahmen des Zufalls, obwohl a/b über 1,3 liegt
    const round = groupShape(ellipse(1400, 1000))
    expect(round?.sphericity).toBeCloseTo(0.8949, 4)
    expect(round?.elongated).toBe(false)
    expect(round?.showAngle).toBe(false)
  })

  it("gestreckt, aber unter zehn Schuss: kein Winkel", () => {
    // acht Schuss, a/b = 6: W = 4 · 36 / 37² = 0,105 unter der Grenze 0,05^(1/3) = 0,368
    const eight = Array.from({ length: 8 }, (_, k) => ({
      ...SPREAD[0],
      xUm: Math.round(3000 * Math.cos((k * Math.PI) / 4)),
      yUm: Math.round(500 * Math.sin((k * Math.PI) / 4)),
    }))
    const shape = groupShape(eight)
    expect(shape?.elongated).toBe(true)
    expect(shape?.showAngle).toBe(false)
  })

  it("nennt das a/b, ab dem die Gruppe bei dieser Schusszahl als gestreckt gilt", () => {
    // W(r) = 4r²/(1 + r²)² = 0,05^(2/(n − 2)) nach r aufgelöst: n = 12 → 2,2551, n = 40 → 1,4953
    const ring = (n: number, a: number, b: number) =>
      Array.from({ length: n }, (_, k) => ({
        ...SPREAD[0],
        xUm: Math.round(a * Math.cos((2 * k * Math.PI) / n)),
        yUm: Math.round(b * Math.sin((2 * k * Math.PI) / n)),
      }))
    expect(groupShape(ring(12, 1500, 1000))?.ratioLimit).toBeCloseTo(2.255133, 5)
    expect(groupShape(ring(40, 1500, 1000))?.ratioLimit).toBeCloseTo(1.495281, 5)
    // gestreckt heißt genau: a/b über dieser Grenze
    for (const [n, a] of [
      [12, 2300],
      [12, 2200],
      [40, 1520],
      [40, 1470],
    ]) {
      const shape = groupShape(ring(n, a, 1000))
      expect(shape?.elongated, `${n} ${a}`).toBe(
        (shape?.ratio as number) > (shape?.ratioLimit as number)
      )
    }
  })

  it("die Mauchly-Grenze ist 0,05^(2/(n − 2)), nicht strenger und nicht weiter", () => {
    const ellipse = (a: number, b: number) =>
      Array.from({ length: 12 }, (_, k) => ({
        ...SPREAD[0],
        xUm: Math.round(a * Math.cos((k * Math.PI) / 6)),
        yUm: Math.round(b * Math.sin((k * Math.PI) / 6)),
      }))
    // W = 0,565 knapp über der Grenze 0,5493 (mit 2/(n − 1) läge sie bei 0,5806)
    expect(groupShape(ellipse(2208, 1000))?.elongated).toBe(false)
    // W = 0,449 unter der Grenze (mit α = 0,01 läge sie bei 0,398)
    expect(groupShape(ellipse(2600, 1000))?.elongated).toBe(true)
  })

  it("auf einer Linie maximal gestreckt; ohne Ausdehnung keine Form", () => {
    const line = Array.from({ length: 10 }, (_, i) => ({
      ...SPREAD[0],
      xUm: i * 100,
      yUm: i * 100,
    }))
    const shape = groupShape(line)
    expect(shape?.ratio).toBe(Number.POSITIVE_INFINITY)
    expect(shape?.sphericity).toBe(0)
    expect(shape?.showAngle).toBe(true)
    const same = Array.from({ length: 10 }, () => ({ ...SPREAD[0], xUm: 500, yUm: -500 }))
    expect(groupShape(same)).toBeNull()
  })

  it("Streuung in Ringbreiten", () => {
    expect(ringWidths(14000 / 6, LG_10M)).toBeCloseTo(14000 / 6 / 2500, 9)
  })
})

describe("Ausreißer (V6, V7)", () => {
  // Acht Schuss im Kreis von 1 mm um die Mitte, dazu ein Testschuss auf der x-Achse. Gegen die übrigen
  // acht: S² = Σr²/14, T = D² / (2 S² · 9/8) ≈ D²/1 285 520 (Kreispunkte auf ganze µm, Σr² = 7 998 792),
  // Grenze F(2, 14) beim Quantil 1 − 0,04/9 = 8,1748
  // (F(2, ν) beim Quantil 1 − q: (ν/2)·(q^(−2/ν) − 1)).
  const ring8 = [0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => ({
    ...MATCH[0],
    xUm: Math.round(1000 * Math.cos((deg * Math.PI) / 180)),
    yUm: Math.round(1000 * Math.sin((deg * Math.PI) / 180)),
    firedAtMs: i * 1000,
  }))
  const withTest = (d: number) => [...ring8, { ...MATCH[0], xUm: d, yUm: 0, firedAtMs: 9000 }]

  it("SPREAD hat keine; kein Verhältnis Ø Abstand durch R50 mehr", () => {
    const result = outliers(SPREAD)
    expect(result?.flagged).toEqual([])
    expect(Object.keys(result ?? {}).sort()).toEqual(["flagged", "n"])
  })

  it("der weiteste gegen die übrigen mit F(2, 2(m − 2)), Bonferroni und α 0,04", () => {
    // 2,8 mm: T 6,10; ohne Bonferroni (Grenze 4,09) wäre es ein Ausreißer
    expect(outliers(withTest(2800))?.flagged).toEqual([])
    // 3,2 mm: T 7,97 unter der Grenze; mit α 0,05 (Grenze 7,70), mit 2(n − 1) Freiheitsgraden (7,74) oder
    // ohne (1 + 1/(n − 1)) (T 8,96) wäre er drüber
    expect(outliers(withTest(3200))?.flagged).toEqual([])
    // 3,3 mm: T 8,47 über der Grenze, und nur er
    const result = outliers(withTest(3300))
    expect(result?.flagged.map((f) => f.number)).toEqual([9])
    expect(result?.flagged[0].shot.xUm).toBe(3300)
  })

  // zwei Abreißer nah beieinander, 4 mm von der Mitte
  const pair = [
    { ...MATCH[0], xUm: 4000, yUm: 0, firedAtMs: 9000 },
    { ...MATCH[0], xUm: 4000, yUm: 400, firedAtMs: 10_000 },
  ]

  it("zwei nahe Abreißer verdecken sich nicht mehr: Schritt 2 zählt, auch wenn Schritt 1 darunter bleibt", () => {
    // Einzeln gegen die übrigen T 4,07 und 4,15 (bis Oktober 2026 keiner, Grenze 7,51). Schritt 1 (m = 10):
    // T 4,148 bei Grenze 7,9526; Schritt 2 gegen die acht im Kreis (m = 9): T 12,446 bei Grenze 8,1748
    expect(outliers([...ring8, ...pair])?.flagged.map((f) => f.number)).toEqual([9, 10])
  })

  it("unter 10 Schuss nur ein Schritt", () => {
    const ring7 = [0, 1, 2, 3, 4, 5, 6].map((k, i) => ({
      ...MATCH[0],
      xUm: Math.round(1000 * Math.cos((2 * Math.PI * k) / 7)),
      yUm: Math.round(1000 * Math.sin((2 * Math.PI * k) / 7)),
      firedAtMs: i * 1000,
    }))
    // n = 9: T 3,61 und 3,68 bei Grenze 8,17; einen zweiten Schritt gibt es nicht
    expect(outliers([...ring7, ...pair])?.flagged).toEqual([])
  })

  it("die Grenze gilt für die übrigen m, nicht für alle n", () => {
    const card = [
      ...ring8,
      { ...MATCH[0], xUm: 3220, yUm: 0, firedAtMs: 9000 },
      { ...MATCH[0], xUm: 20_000, yUm: 0, firedAtMs: 10_000 },
    ]
    // Schritt 1 (m = 10): T 161,4; Schritt 2 (m = 9): T 8,066 bei Grenze 8,1748. Mit n = 10 läge sie bei
    // 7,9526, dann käme auch Schuss 9 dazu; ebenso mit F(2, 2(n − 2)) statt F(2, 2(m − 2))
    expect(outliers(card)?.flagged.map((f) => f.number)).toEqual([10])
  })

  it("der letzte Schritt über der Grenze zählt, nicht der erste", () => {
    const card = [
      ...ring8,
      { ...MATCH[0], xUm: 0, yUm: 6000, firedAtMs: 9000 },
      { ...MATCH[0], xUm: 0, yUm: -6000, firedAtMs: 10_000 },
    ]
    // Schritt 1: T 8,00 bei Grenze 7,95; Schritt 2: T 28,0 bei Grenze 8,17; beide Schritte über der Grenze
    expect(outliers(card)?.flagged.map((f) => f.number)).toEqual([9, 10])
  })

  it("ab 30 Schuss bis zu jedem zehnten", () => {
    // 27 in drei Kreisen (1, 2 und 3 mm, je neun, je Kreis um 0,3 rad gedreht), dazu drei Abreißer
    const rings = [1, 2, 3].flatMap((radius, s) =>
      Array.from({ length: 9 }, (_, k) => {
        const angle = (2 * Math.PI * k) / 9 + s * 0.3
        return {
          ...MATCH[0],
          xUm: Math.round(radius * 1000 * Math.cos(angle)),
          yUm: Math.round(radius * 1000 * Math.sin(angle)),
          firedAtMs: (s * 9 + k) * 1000,
        }
      })
    )
    const flyers = [
      [12_000, 0],
      [-6000, 10_400],
      [-6000, -10_400],
    ].map(([xUm, yUm], i) => ({ ...MATCH[0], xUm, yUm, firedAtMs: (27 + i) * 1000 }))
    // Schritte: T 10,2, 14,7 und 28,7 gegen Grenzen um 7,46; mit nur zwei Schritten blieben es 29 und 30
    expect(outliers([...rings, ...flyers])?.flagged.map((f) => f.number)).toEqual([28, 29, 30])
  })

  it("die Markierten in Abgabefolge, auch wenn die Eingabe es nicht ist", () => {
    expect(outliers([...ring8, pair[1], pair[0]])?.flagged.map((f) => f.number)).toEqual([9, 10])
  })

  it("ein weiter Schuss reißt keinen normalen mit", () => {
    const card = [
      ...ring8,
      { ...MATCH[0], xUm: 0, yUm: 0, firedAtMs: 9000 },
      { ...MATCH[0], xUm: 4000, yUm: 0, firedAtMs: 10_000 },
    ]
    // Schritt 1 (m = 10): T 14,4 bei Grenze 7,95; Schritt 2 (m = 9): T 1,15 bei Grenze 8,17
    expect(outliers(card)?.flagged.map((f) => f.number)).toEqual([10])
  })

  it("sind die übrigen alle an einer Stelle, ist jeder Abstand auffällig", () => {
    const same = Array.from({ length: 4 }, (_, i) => ({
      ...MATCH[0],
      xUm: 0,
      yUm: 0,
      firedAtMs: i * 1000,
    }))
    const card = [...same, { ...MATCH[0], xUm: 1000, yUm: 0, firedAtMs: 9000 }]
    expect(outliers(card)?.flagged.map((f) => f.number)).toEqual([5])
  })

  it("die Nummer zählt alle Schüsse der Art, auch Platzhalter ohne Lage", () => {
    const placeholder: MetricShot = {
      ...MATCH[0],
      xUm: null,
      yUm: null,
      firedAtMs: 500,
      flags: [FLAG_SUSPICIOUS],
    }
    // der Platzhalter ist Schuss 2, der Testschuss damit Schuss 10
    expect(outliers([...withTest(3300), placeholder])?.flagged.map((f) => f.number)).toEqual([10])
  })

  it("ein weiter Schuss fällt auf; unter fünf Schuss kein Urteil", () => {
    const far: MetricShot = { ...PROBE[0], xUm: 9000, yUm: 9000, firedAtMs: 300_000 }
    expect(outliers([...PROBE, far])?.flagged.map((f) => f.number)).toEqual([6])
    expect(outliers(PROBE.slice(0, 4))).toBeNull()
  })

  // Werte unabhängig von der Lage: der Kreis mit 10,4, der Testschuss mit eigenem Wert
  const valued = (shot: MetricShot, decimalTenths: number): MetricShot => ({
    ...shot,
    decimalTenths,
    ring: Math.floor(decimalTenths / 10),
  })
  const priced = (d: number, testTenths: number, dx = 0) =>
    withTest(d).map((shot, i) => ({
      ...valued(shot, i < 8 ? 104 : testTenths),
      xUm: (shot.xUm as number) + dx,
    }))

  it("Kosten der markierten Ausreißer gegen den Median der übrigen", () => {
    // 3,3 mm weit draußen mit 9,2: 10,4 − 9,2 = 1,2 Ringe, in ganzen Ringen 10 − 9 = 1
    expect(outlierLoss(priced(3300, 92), "decimal")).toEqual({ n: 9, count: 1, loss: 1.2 })
    expect(outlierLoss(priced(3300, 92), "rings")).toEqual({ n: 9, count: 1, loss: 1 })
  })

  it("ohne markierten Schuss kosten Ausreißer nichts, auch wenn ein Schuss schwach ist", () => {
    // 2,8 mm ist kein Ausreißer; sein schwacher Wert zählt hier nicht (früher: schwächste 10 %)
    expect(outlierLoss(priced(2800, 80), "decimal")).toEqual({ n: 9, count: 0, loss: 0 })
  })

  it("ein Ausreißer zur Mitte hin bringt Ringe: die Kosten sind negativ", () => {
    // Gruppe 5 mm rechts mit 10,4, der markierte Schuss liegt 3,3 mm links von ihr und hat 10,7
    expect(outlierLoss(priced(-3300, 107, 5000), "decimal")?.loss).toBeCloseTo(-0.3, 9)
  })

  it("nur Wertungsschüsse; unter fünf Schuss mit Lage kein Urteil", () => {
    // Zählte der weite Probeschuss mit, wäre er der Ausreißer, und der Wertungsschuss bei 3,3 mm fiele in
    // der breiteren Gruppe nicht mehr auf
    const far: MetricShot = { ...valued(PROBE[0], 60), xUm: 9000, yUm: 9000, firedAtMs: 300_000 }
    expect(outlierLoss([...priced(3300, 92), far], "decimal")).toEqual({
      n: 9,
      count: 1,
      loss: 1.2,
    })
    expect(outlierLoss(priced(3300, 92).slice(0, 4), "decimal")).toBeNull()
  })

  it("fehlt einem markierten Schuss der Wert, sind die Kosten unbekannt", () => {
    // Der Ausreißer hat nur einen ganzen Ring: in Zehnteln kein Ergebnis (SF-07), in Ringen 10 − 9 = 1
    const noTenths = priced(3300, 92).map((shot, i) =>
      i === 8 ? { ...shot, decimalTenths: null } : shot
    )
    expect(outlierLoss(noTenths, "decimal")).toBeNull()
    expect(outlierLoss(noTenths, "rings")).toEqual({ n: 9, count: 1, loss: 1 })
  })

  it("ohne einen Wert in der gewählten Wertung keine Kosten, auch ohne Ausreißer", () => {
    const ringsOnly = priced(2800, 104).map((shot) => ({ ...shot, decimalTenths: null }))
    expect(outlierLoss(ringsOnly, "decimal")).toBeNull()
    expect(outlierLoss(ringsOnly, "rings")).toEqual({ n: 9, count: 0, loss: 0 })
  })

  it("hat nur der markierte Schuss einen Wert, fehlt der Vergleich", () => {
    const onlyOutlier = priced(3300, 92).map((shot, i) =>
      i < 8 ? { ...shot, decimalTenths: null } : shot
    )
    expect(outlierLoss(onlyOutlier, "decimal")).toBeNull()
  })
})
