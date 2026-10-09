// Belege für die Zahlen in den Hilfetexten (SP-1.12): jede Simulation läuft über die echten Funktionen
// aus @vereinsheim/shot-core, mit festem Seed je Fall (als Zahl ausgeschrieben, damit eine neue
// Beschriftung keine Zahl ändert), Lagen auf ganze µm und Wertung wie Meyton.
// Aufruf: pnpm --filter @vereinsheim/shot-help simulate (nicht im Gate, Laufzeit etwa eine Minute, das
// meiste für den Vergleich zweier Zeiträume B19).
// Die Werte stehen im Katalog unter „Belege aus Simulationen“ (vault/spiegel/spiegel-statistics.md);
// ein Hilfetext nennt nur dort belegte Zahlen. Ändert sich eine Auswertung, läuft das Skript neu.

import {
  cardTrend,
  cardValues,
  comparePeriods,
  directionClock,
  drift,
  fatigue,
  groupShape,
  mpiConfidence,
  mpiPath,
  outliers,
  pauseRecovery,
  periodTrend,
  ringLossSplit,
  sighterZeroed,
  sigmaEstimate,
  type PeriodCard,
} from "@vereinsheim/shot-core/analysis"
import { centroid, covarianceEllipse } from "@vereinsheim/shot-core/geometry"
import { computeMetric, metricByKey, type MetricShot } from "@vereinsheim/shot-core/metrics"
import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { c4, chiSquareQuantileEven, fQuantile2, wilson } from "@vereinsheim/shot-core/stats"
import { LG_10M, LP_10M, type TargetImage } from "@vereinsheim/shot-core/targets"

// ---------- Zufall: mulberry32 und Box-Muller

function random(seed: number) {
  let state = seed >>> 0
  let spare: number | null = null
  const uniform = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const normal = () => {
    if (spare !== null) {
      const value = spare
      spare = null
      return value
    }
    let u = 0
    while (u === 0) u = uniform()
    const radius = Math.sqrt(-2 * Math.log(u))
    const angle = 2 * Math.PI * uniform()
    spare = radius * Math.sin(angle)
    return radius * Math.cos(angle)
  }
  return { uniform, normal }
}
type Random = ReturnType<typeof random>

interface Group {
  n: number
  /** Streuung je Richtung in µm; `sy` für gestreckte Gruppen */
  sx: number
  sy?: number
  mx?: number
  my?: number
  target: TargetImage
  kind?: "match" | "probe"
  firstSeq?: number
  startMs?: number
  /** Faktor auf die Streuung je Schuss, etwa für ein Nachlassen über die Scheibe */
  scale?: (i: number) => number
}

function card(rand: Random, group: Group): MetricShot[] {
  const kind = group.kind ?? "match"
  return Array.from({ length: group.n }, (_, i) => {
    const k = group.scale ? group.scale(i) : 1
    const xUm = Math.round((group.mx ?? 0) + rand.normal() * group.sx * k)
    const yUm = Math.round((group.my ?? 0) + rand.normal() * (group.sy ?? group.sx) * k)
    const score = scoreFromCoordinates(group.target, xUm, yUm)
    return {
      seq: (group.firstSeq ?? 1) + i,
      xUm,
      yUm,
      decimalTenths: score.decimalTenths,
      ring: score.ring,
      innerTen: score.innerTen,
      firedAtMs: (group.startMs ?? 0) + i * 50_000,
      kind,
      series: kind === "match" ? Math.floor(i / 10) + 1 : null,
    }
  })
}

// ---------- Auswertung der Wiederholungen

const quantile = (values: readonly number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  const h = (sorted.length - 1) * p
  const low = Math.floor(h)
  return low === h ? sorted[low] : sorted[low] + (h - low) * (sorted[low + 1] - sorted[low])
}
const mean = (values: readonly number[]) => values.reduce((s, v) => s + v, 0) / values.length
const num = (value: number, digits = 2) => value.toFixed(digits).replace(".", ",")
const share = (hits: number, total: number) => `${num((100 * hits) / total, 1)} %`

function repeat(times: number, seed: number, run: (rand: Random) => void) {
  const rand = random(seed)
  for (let i = 0; i < times; i++) run(rand)
}

const LG = { target: LG_10M, sx: 1500 }
const LP = { target: LP_10M, sx: 15000 }
const metric = (key: string) => {
  const found = metricByKey(key)
  if (!found) throw new Error(`Kennzahl fehlt: ${key}`)
  return found
}
const lines: string[] = []
const out = (id: string, text: string) => lines.push(`${id.padEnd(4)} ${text}`)

// ---------- Belege

// B0: Anteil einer runden Normalgruppe innerhalb von σ und 2σ (Rayleigh, exakt)
out("B0", `innerhalb σ ${share(1 - Math.exp(-0.5), 1)}, innerhalb 2σ ${share(1 - Math.exp(-2), 1)}`)

// B1: ganz normale Scheiben (rund, zentriert, ohne Trend, 5 Probe- + n Wertungsschüsse): mindestens ein
// Befund unter „echt“, „gestreckt“, Ausreißer, Trend klar, Probe echt neben der Mitte
for (const n of [20, 40, 60]) {
  let hits = 0
  const times = 20_000
  repeat(times, 1000 + n, (rand) => {
    const probe = card(rand, { ...LG, n: 5, kind: "probe" })
    const match = card(rand, { ...LG, n, firstSeq: 6, startMs: 300_000 })
    const found =
      mpiConfidence(match)?.real === true ||
      groupShape(match)?.elongated === true ||
      (outliers(match)?.flagged.length ?? 0) > 0 ||
      cardTrend(match, "decimal")?.clear === true ||
      sighterZeroed([...probe, ...match])?.real === true
    if (found) hits++
  })
  out(
    "B1",
    `${n} Schuss: ${share(hits, times)} mit Befund, also etwa jede ${Math.round(times / hits)}.`
  )
}

// B2: Ausreißer-Fehlalarm, rund und a/b 2
for (const [label, sx, sy] of [
  ["rund", 1500, 1500],
  ["a/b 2", 2000, 1000],
] as const) {
  const parts: string[] = []
  for (const n of [10, 20, 40, 60]) {
    let hits = 0
    repeat(5_000, 2000 + n + sx, (rand) => {
      if ((outliers(card(rand, { target: LG_10M, n, sx, sy }))?.flagged.length ?? 0) > 0) hits++
    })
    parts.push(`${n}: ${share(hits, 5_000)}`)
  }
  out("B2", `Ausreißer-Fehlalarm ${label}: ${parts.join(", ")}`)
}

// B3/B4: Streukreis 40 gegen 10 Schuss; R50 bei 10 Schuss gegen den Grenzwert σ √(2 ln 2)
{
  const circle: Record<number, number[]> = { 10: [], 40: [] }
  const r50s: number[] = []
  for (const n of [10, 40]) {
    repeat(5_000, 3000 + n, (rand) => {
      const shots = card(rand, { ...LG, n })
      circle[n].push(computeMetric(metric("group.enclosingDiameter"), shots) as number)
      if (n === 10) r50s.push(computeMetric(metric("group.r50"), shots) as number)
    })
  }
  out(
    "B3",
    `Streukreis 40 gegen 10 Schuss: +${num(100 * (mean(circle[40]) / mean(circle[10]) - 1), 0)} %`
  )
  const limit = 1.5 * Math.sqrt(2 * Math.log(2))
  out("B4", `R50 bei 10 Schuss: ${num(100 * (mean(r50s) / limit - 1), 1)} % gegen den Grenzwert`)
}

// B5: Lage-Verlust (Leave-one-out) ohne Versatz; mit Versatz 0,5σ angezeigt gegen den Gewinn auf einer
// neuen Scheibe nach der Korrektur um den gemessenen Schwerpunkt
{
  for (const [label, base, seed] of [
    ["LG σ 1,5 mm", LG, 550],
    ["LP σ 15 mm", LP, 500],
  ] as const) {
    const losses: number[] = []
    repeat(5_000, seed, (rand) => {
      losses.push(
        ringLossSplit(card(rand, { ...base, n: 40 }), base.target)?.positionLoss.decimal ?? 0
      )
    })
    out(
      "B5",
      `${label}, 40 Schuss, ohne Versatz: Lage-Verlust im Mittel ${num(mean(losses))} Ringe`
    )
  }
  const shown: number[] = []
  const gained: number[] = []
  repeat(5_000, 5050, (rand) => {
    const first = card(rand, { ...LG, n: 40, mx: 750 })
    shown.push(ringLossSplit(first, LG_10M)?.positionLoss.decimal ?? 0)
    const center = centroid(first.map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number })))
    const next = card(rand, { ...LG, n: 40, mx: 750 })
    let gain = 0
    for (const s of next) {
      const after = scoreFromCoordinates(
        LG_10M,
        Math.round((s.xUm as number) - (center?.xUm ?? 0)),
        Math.round((s.yUm as number) - (center?.yUm ?? 0))
      )
      gain += (after.decimalTenths - (s.decimalTenths as number)) / 10
    }
    gained.push(gain)
  })
  out(
    "B5",
    `LG, Versatz 0,5σ, 40 Schuss: angezeigt ${num(mean(shown))}, Gewinn auf neuer Scheibe ${num(mean(gained))}`
  )
}

// B6: Trend (Mann-Kendall): Fehlalarm ohne Trend, Trennschärfe bei Nachlassen (σ wächst um 60 %)
for (const [label, base, seed] of [
  ["LG σ 1,5 mm", LG, 6011],
  ["LP σ 15 mm", LP, 6010],
] as const) {
  for (const n of [20, 40]) {
    const counts = { decimal: [0, 0], rings: [0, 0] }
    repeat(5_000, seed + n, (rand) => {
      const steady = card(rand, { ...base, n })
      const tiring = card(rand, { ...base, n, scale: (i) => 1 + (0.6 * i) / (n - 1) })
      for (const scoring of ["decimal", "rings"] as const) {
        if (cardTrend(steady, scoring)?.clear) counts[scoring][0]++
        if (cardTrend(tiring, scoring)?.direction === "down") counts[scoring][1]++
      }
    })
    out(
      "B6",
      `${label}, ${n} Schuss: Fehlalarm Zehntel ${share(counts.decimal[0], 5_000)}, ganze Ringe ` +
        `${share(counts.rings[0], 5_000)}; Nachlassen erkannt Zehntel ${share(counts.decimal[1], 5_000)}, ` +
        `ganze Ringe ${share(counts.rings[1], 5_000)}`
    )
  }
}

// B7: „Eingeschossen?“ mit 5 Probeschüssen, Versatz 1σ und 2σ
for (const factor of [1, 2]) {
  let hits = 0
  repeat(5_000, 7000 + factor, (rand) => {
    const probe = card(rand, { ...LG, n: 5, kind: "probe", mx: factor * 1500 })
    const match = card(rand, { ...LG, n: 20, firstSeq: 6, startMs: 300_000 })
    if (sighterZeroed([...probe, ...match])?.real) hits++
  })
  out("B7", `5 Probeschüsse, Versatz ${factor}σ: echt in ${share(hits, 5_000)}`)
}

// B8: von Neumann ohne Wandern, 95-%-Spanne
for (const n of [10, 40]) {
  const values: number[] = []
  repeat(5_000, 8000 + n, (rand) => values.push(drift(card(rand, { ...LG, n }))?.vonNeumann ?? 2))
  out(
    "B8",
    `von Neumann, ${n} Schuss: ${num(quantile(values, 0.025))} bis ${num(quantile(values, 0.975))}`
  )
}

// B9: Ermüdung ohne Effekt (40 Schuss), 95-%-Spanne von Δ Ø und Δ R50 (relativ zum Grenzwert von R50)
for (const [label, base, seed] of [
  ["LG σ 1,5 mm", LG, 9011],
  ["LP σ 15 mm", LP, 9010],
] as const) {
  const delta: number[] = []
  const deltaRings: number[] = []
  const r50: number[] = []
  repeat(5_000, seed, (rand) => {
    const shots = card(rand, { ...base, n: 40 })
    const result = fatigue(shots, "decimal")
    if (!result) return
    delta.push(result.deltaRings)
    // dieselben Karten in ganzen Ringen (Prüfung, 9. Oktober 2026): zieht keine Zufallszahl
    const rings = fatigue(shots, "rings")
    if (rings) deltaRings.push(rings.deltaRings)
    if (result.deltaR50Um !== null)
      r50.push(result.deltaR50Um / (base.sx * Math.sqrt(2 * Math.log(2))))
  })
  out(
    "B9",
    `Ermüdung ${label}: Δ Ø ${num(quantile(delta, 0.025))} bis ${num(quantile(delta, 0.975))} Ringe, ` +
      `Δ R50 ${num(100 * quantile(r50, 0.025), 0)} bis ${num(100 * quantile(r50, 0.975), 0)} %`
  )
  out(
    "B9",
    `Ermüdung ${label}, ganze Ringe: Δ Ø ${num(quantile(deltaRings, 0.025))} bis ${num(quantile(deltaRings, 0.975))} Ringe`
  )
}

// B10: Wiedereinstieg ohne Effekt: 40 Schuss, Pause von fünf Minuten nach Schuss 20
for (const [label, base, seed] of [
  ["LG σ 1,5 mm", LG, 10_011],
  ["LP σ 15 mm", LP, 10_010],
] as const) {
  const deltas: number[] = []
  repeat(5_000, seed, (rand) => {
    const shots = card(rand, { ...base, n: 40 }).map((s, i) =>
      i >= 20 ? { ...s, firedAtMs: (s.firedAtMs as number) + 300_000 } : s
    )
    const delta = pauseRecovery(shots, "decimal")?.effects[0]?.deltaRings
    if (typeof delta === "number") deltas.push(delta)
  })
  out(
    "B10",
    `Wiedereinstieg ${label}: ${num(quantile(deltas, 0.025))} bis ${num(quantile(deltas, 0.975))} Ringe`
  )
}

// B11: σ aus 5 Probe- gegen 40 Wertungsschüsse bei gleicher Präzision, 95-%-Spanne des Verhältnisses
{
  const ratios: number[] = []
  repeat(5_000, 11_000, (rand) => {
    const probe = sigmaEstimate(card(rand, { ...LG, n: 5 }))
    const match = sigmaEstimate(card(rand, { ...LG, n: 40 }))
    if (probe && match) ratios.push(probe.sigma / match.sigma)
  })
  out(
    "B11",
    `σ Probe/Wertung (5 gegen 40): ${num(quantile(ratios, 0.025))} bis ${num(quantile(ratios, 0.975))}`
  )
}

// B12: Versatz des Schwerpunkts einer Zehnerserie zum Scheiben-Schwerpunkt (40 Schuss, ohne Drift)
{
  const offsets: number[] = []
  repeat(5_000, 12_000, (rand) => {
    for (const series of mpiPath(card(rand, { ...LG, n: 40 }))) offsets.push(series.offsetUm / 1500)
  })
  out("B12", `Serien-Versatz zur Scheibe: im Mittel ${num(mean(offsets))} σ`)
}

// B13: Richtungsuhr um den Schwerpunkt, 30 Schuss: stärkster Keil gegen den Schnitt (Median)
{
  const ratios: number[] = []
  repeat(5_000, 13_000, (rand) => {
    const shots = card(rand, { ...LG, n: 30 })
    const center = centroid(shots.map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number })))
    const clock = directionClock(shots, center ?? { xUm: 0, yUm: 0 })
    ratios.push(Math.max(...clock.counts) / (clock.n / 12))
  })
  out("B13", `Richtungsuhr, 30 Schuss: stärkster Keil im Median ×${num(quantile(ratios, 0.5), 1)}`)
}

// B14: Ausreißer bei 10 Schuss: ein Schuss bei 5σ; zwei bei 5σ, zufällig verteilt oder nah beieinander
for (const [far, near, seed] of [
  [1, false, 14_001],
  [2, false, 14_002],
  [2, true, 14_102],
] as const) {
  let one = 0
  let all = 0
  repeat(5_000, seed, (rand) => {
    // nur im Fall „nah beieinander“ ziehen, sonst bleibt der Zufallsstrom der übrigen Fälle wie vorher
    const base = near ? 2 * Math.PI * rand.uniform() : 0
    const shots = card(rand, { ...LG, n: 10 }).map((s, i) => {
      if (i < 10 - far) return s
      const angle = near ? base + 0.15 * (i - (10 - far)) : 2 * Math.PI * rand.uniform()
      const xUm = Math.round(5 * 1500 * Math.cos(angle))
      const yUm = Math.round(5 * 1500 * Math.sin(angle))
      const score = scoreFromCoordinates(LG_10M, xUm, yUm)
      return { ...s, xUm, yUm, decimalTenths: score.decimalTenths, ring: score.ring }
    })
    const flagged = new Set(outliers(shots)?.flagged.map((f) => f.shot) ?? [])
    const found = shots.slice(10 - far).filter((s) => flagged.has(s)).length
    if (found > 0) one++
    if (found === far) all++
  })
  out(
    "B14",
    `10 Schuss, ${far} bei 5σ${near ? " nah beieinander" : ""}: mindestens einer erkannt in ${share(one, 5_000)}${far > 1 ? `, beide in ${share(all, 5_000)}` : ""}`
  )
}

// B15: deterministisch: Wilson 20/40; Bereich von σ relativ zu σ̂ bei 10, 30 und 120 Schuss
{
  const w = wilson(20, 40)
  if (w) out("B15", `Wilson 20/40: ${num(100 * w.low, 1)} bis ${num(100 * w.high, 1)} %`)
  for (const n of [10, 30, 120]) {
    const df = 2 * (n - 1)
    const low = c4(2 * n - 1) * Math.sqrt(df / chiSquareQuantileEven(0.975, df))
    const high = c4(2 * n - 1) * Math.sqrt(df / chiSquareQuantileEven(0.025, df))
    const at = n === 30 ? `, bei σ̂ 1,12 mm: ${num(1.12 * low)} bis ${num(1.12 * high)} mm` : ""
    out(
      "B15",
      `σ-Bereich ${n} Schuss: ${num(100 * (low - 1), 1)} % bis +${num(100 * (high - 1), 1)} %${at}`
    )
  }
}

// B16: deterministisch: Halbachse der Vertrauensellipse relativ zur Streuung je Richtung
{
  const parts = [5, 10, 20, 40, 60].map((n) => {
    const critical = ((2 * (n - 1)) / (n - 2)) * fQuantile2(0.95, n - 2)
    return `${n}: ${num(Math.sqrt(critical / n))}`
  })
  out("B16", `Halbachse der Vertrauensellipse in σ: ${parts.join(", ")}`)
}

// B17: Form der Gruppe: Median von a/b einer runden Gruppe (auch sie ist selten rund) und wie oft
// Mauchlys Test eine echte Streckung a/b 1,3 als „gestreckt“ erkennt
{
  const round = [20, 40].map((n) => {
    const ratios: number[] = []
    repeat(5_000, 17_000 + n, (rand) => {
      const shape = groupShape(card(rand, { ...LG, n }))
      if (shape) ratios.push(shape.ratio)
    })
    return `${n} Schuss ${num(quantile(ratios, 0.5))}`
  })
  out("B17", `runde Gruppe, Median a/b: ${round.join(", ")}`)
  const found = [40, 120].map((n) => {
    let hits = 0
    repeat(5_000, 17_500 + n, (rand) => {
      if (groupShape(card(rand, { target: LG_10M, n, sx: 1950, sy: 1500 }))?.elongated) hits++
    })
    return `${n} Schuss ${share(hits, 5_000)}`
  })
  out("B17", `echte Streckung a/b 1,3 als gestreckt erkannt: ${found.join(", ")}`)
}

// B18: Form mit und ohne Ausreißer. „Alt“ ist Mauchly über alle Schüsse wie bis Oktober 2026 (dieselbe
// Kovarianz aus shot-core, dieselbe Grenze), „neu“ ist `groupShape` ohne die markierten Ausreißer
{
  const elongatedAll = (shots: readonly MetricShot[]) => {
    const points = shots.map((s) => ({ xUm: s.xUm as number, yUm: s.yUm as number }))
    const ellipse = covarianceEllipse(points)
    if (!ellipse || !(ellipse.majorUm > 0)) return false
    const a2 = ellipse.majorUm ** 2
    const b2 = ellipse.minorUm ** 2
    return (4 * a2 * b2) / (a2 + b2) ** 2 < 0.05 ** (2 / (points.length - 2))
  }
  // ein Zehntel der Schüsse (mindestens einer) als Abreißer bei 4σ in zufälliger Richtung
  const withFlyers = (rand: Random, n: number) =>
    card(rand, { ...LG, n }).map((s, i) => {
      if (i < n - Math.max(1, Math.floor(n / 10))) return s
      const angle = 2 * Math.PI * rand.uniform()
      const xUm = Math.round(4 * 1500 * Math.cos(angle))
      const yUm = Math.round(4 * 1500 * Math.sin(angle))
      const score = scoreFromCoordinates(LG_10M, xUm, yUm)
      return { ...s, xUm, yUm, decimalTenths: score.decimalTenths, ring: score.ring }
    })
  const cases = [
    ["rund", [10, 20, 40, 60], 1500, (rand: Random, n: number) => card(rand, { ...LG, n })],
    [
      "a/b 2",
      [10, 20, 40],
      2120,
      (rand: Random, n: number) => card(rand, { target: LG_10M, n, sx: 2120, sy: 1060 }),
    ],
    [
      "a/b 3",
      [10, 20],
      2600,
      (rand: Random, n: number) => card(rand, { target: LG_10M, n, sx: 2600, sy: 867 }),
    ],
    ["rund mit Abreißern", [10, 20, 40], 4, withFlyers],
  ] as const
  for (const [label, sizes, seedPart, make] of cases) {
    const parts = sizes.map((n) => {
      let before = 0
      let after = 0
      repeat(5_000, 18_000 + seedPart + n, (rand) => {
        const shots = make(rand, n)
        if (elongatedAll(shots)) before++
        if (groupShape(shots)?.elongated) after++
      })
      return `${n}: ${share(before, 5_000)} → ${share(after, 5_000)}`
    })
    out("B18", `als gestreckt gemeldet, ${label} (alt → ohne Ausreißer): ${parts.join(", ")}`)
  }
}

// Scheiben eines Zeitraums: je Scheibe 40 Schuss Luftgewehr mit der Streuung `sx`, eine Scheibe am Tag
const periodCards = (rand: Random, count: number, sx: number, firstDay = 0): PeriodCard[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(firstDay + i),
    startedAtMs: (firstDay + i) * 86_400_000,
    kind: "training" as const,
    complete: true,
    shots: card(rand, { target: LG_10M, n: 40, sx }),
  }))
const perShot = metric("result.decimalMean")

// B19: Vergleich zweier Zeiträume über Ø je Schuss (Mann-Whitney über die Scheiben, D5): Fehlalarm bei
// gleicher Streuung, Trennschärfe bei σ 1,5 → 1,3 mm und bei einer kleinen Veränderung σ 1,5 → 1,45 mm auf
// Seite b (seit der Prüfung vom 9. Oktober 2026); dazu der Anteil „bedeutsam“ und der Unterschied des Ø je
// Schuss im Mittel (über die Fälle 30/30), damit ein Text sagen kann, wie groß die Veränderung ist
{
  const cases = [
    ["gleich", 1500, 19_000],
    ["σ 1,5 → 1,3 mm", 1300, 19_500],
    ["σ 1,5 → 1,45 mm", 1450, 19_700],
  ] as const
  for (const [label, sxB, seed] of cases) {
    let deltaSum = 0
    let deltaCount = 0
    const parts = [5, 10, 20, 30].map((n) => {
      let judged = 0
      let higher = 0
      let meaningful = 0
      repeat(2_000, seed + n, (rand) => {
        const a = cardValues(periodCards(rand, n, 1500), perShot, "decimal")
        const b = cardValues(periodCards(rand, n, sxB, n), perShot, "decimal")
        const result = comparePeriods(a, b)
        if (result?.verdict !== "unclear") judged++
        if (result?.verdict === "higher") higher++
        if (result?.meaningful) meaningful++
        if (n === 30 && result) {
          deltaSum += result.delta
          deltaCount++
        }
      })
      const verdict = sxB === 1500 ? share(judged, 2_000) : share(higher, 2_000)
      return `${n}/${n} ${verdict} (bedeutsam ${share(meaningful, 2_000)})`
    })
    const what = sxB === 1500 ? "Urteil trotz gleicher Streuung" : "„höher“ erkannt"
    // ohne Veränderung liegt das Mittel bei 0: kein „-0,000“
    const mean = deltaSum / deltaCount
    const delta = num(Math.abs(mean) < 0.0005 ? 0 : mean, 3)
    out("B19", `${label}, ${what}: ${parts.join(", ")}; Δ Ø je Schuss im Mittel ${delta}`)
  }
}

// B20: Formband eines gleichbleibenden Schützen über 60 Scheiben: Anteil der Scheiben ab der zehnten im
// Band (Median und 95-%-Spanne über die Wiederholungen)
{
  const inside: number[] = []
  repeat(2_000, 20_000, (rand) => {
    const { points } = periodTrend(cardValues(periodCards(rand, 60, 1500), perShot, "decimal"))
    const checked = points.slice(9).filter((p) => p.band !== null)
    const hits = checked.filter((p) => p.value >= p.band!.low && p.value <= p.band!.high).length
    inside.push(hits / checked.length)
  })
  const pct = (v: number) => `${num(100 * v, 1)} %`
  out(
    "B20",
    `Scheiben im Formband (60 Scheiben, ab der zehnten): Median ${pct(quantile(inside, 0.5))}, 95 % zwischen ${pct(quantile(inside, 0.025))} und ${pct(quantile(inside, 0.975))}`
  )
}

// B21: Versatz Probe → Wertung ohne jede Verschiebung (D3, Prüfung 9. Oktober 2026): n Probe- und
// 40 Wertungsschüsse um dieselbe Mitte, Abstand der Schwerpunkte in σ
for (const n of [5, 3]) {
  const offsets: number[] = []
  repeat(5_000, 21_000 + n, (rand) => {
    const probe = card(rand, { ...LG, n, kind: "probe" })
    const match = card(rand, { ...LG, n: 40, firstSeq: n + 1, startMs: 300_000 })
    const zeroed = sighterZeroed([...probe, ...match])
    if (zeroed?.matchOffsetUm != null) offsets.push(zeroed.matchOffsetUm / LG.sx)
  })
  out(
    "B21",
    `Versatz Probe → Wertung ohne Verschiebung, ${n} Probe- und 40 Wertungsschüsse: Median ${num(quantile(offsets, 0.5))} σ, 95. Perzentil ${num(quantile(offsets, 0.95))} σ (${offsets.length} Läufe)`
  )
}

console.log(lines.join("\n"))
