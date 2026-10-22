// Rechnung über zwei Ebenen ([[adr-034]]): Schüsse in Scheiben. Das Mittel ist das über alle Schüsse; seine
// Unsicherheit kommt aus der Streuung der Schüsse und, wenn die Abende stärker wandern, als der Zufall der Schüsse
// erklärt, aus dem Wandern der Abende („sometimes pool“ nach Bancroft, Vortest α 0,25). Eine Richtung (Werte je Schuss)
// oder zwei (Lagen in µm). Symmetrische Matrizen als Liste: eine Richtung [v], zwei [xx, yy, xy].

import type { MetricDefinition } from "../metrics"
import { c4, chiSquareSurvival, fSurvival } from "../stats"
import {
  COMPARE_ALPHA,
  compareSamples,
  meaningfulChange,
  MIN_CARDS_PER_SIDE,
  type CardValue,
  type PeriodComparison,
} from "./period"

/** Vortest auf das Wandern der Abende: darunter zählt jeder Abend für sich */
export const WANDER_ALPHA = 0.25

/** eine Scheibe als Gruppe von Schüssen: Zahl, Mittel und Abweichungsquadrate um ihr Mittel */
export interface ShotGroup {
  n: number
  mean: readonly number[]
  scatter: readonly number[]
}

export interface LevelEstimate {
  /** Schüsse aller Scheiben */
  shots: number
  /** Scheiben */
  groups: number
  /** Mittel über alle Schüsse */
  mean: number[]
  /** Kovarianz dieses Mittels */
  cov: number[]
  /** Freiheitsgrade: N − 1 ohne Wandern, k − 1 mit */
  df: number
  /** die Abende wandern über den Zufall der Schüsse hinaus (Vortest p < `WANDER_ALPHA`) */
  wander: boolean
  wanderP: number
}

type Sym = number[]

const add = (a: readonly number[], b: readonly number[]): Sym => a.map((v, i) => v + b[i])
const scale = (a: readonly number[], k: number): Sym => a.map((v) => v * k)
const outer = (v: readonly number[]): Sym =>
  v.length === 1 ? [v[0] * v[0]] : [v[0] * v[0], v[1] * v[1], v[0] * v[1]]
const trace = (a: readonly number[]) => (a.length === 1 ? a[0] : a[0] + a[1])
const det = (a: readonly number[]) => (a.length === 1 ? a[0] : a[0] * a[1] - a[2] * a[2])

function inverse(a: readonly number[]): Sym | null {
  const d = det(a)
  if (!(d > 0) || !(a[0] > 0)) return null
  return a.length === 1 ? [1 / a[0]] : [a[1] / d, a[0] / d, -a[2] / d]
}

/** xᵀ A x */
function quadratic(a: readonly number[], x: readonly number[]): number {
  return a.length === 1
    ? a[0] * x[0] * x[0]
    : a[0] * x[0] * x[0] + a[1] * x[1] * x[1] + 2 * a[2] * x[0] * x[1]
}

/** tr(A B) für symmetrische A, B */
function traceOfProduct(a: readonly number[], b: readonly number[]): number {
  return a.length === 1 ? a[0] * b[0] : a[0] * b[0] + a[1] * b[1] + 2 * a[2] * b[2]
}

/** die nächste positiv semidefinite Matrix: Eigenwerte unter 0 auf 0 */
function nonNegative(a: readonly number[]): Sym {
  if (a.length === 1) return [Math.max(0, a[0])]
  const half = (a[0] + a[1]) / 2
  const spread = Math.hypot((a[0] - a[1]) / 2, a[2])
  const high = half + spread
  const low = half - spread
  if (low >= 0) return [...a]
  if (high <= 0) return [0, 0, 0]
  // nur der große Eigenwert bleibt: λ v vᵀ mit dem Eigenvektor zu λ
  const [vx, vy] =
    spread === 0 ? [1, 0] : a[2] !== 0 ? [high - a[1], a[2]] : a[0] >= a[1] ? [1, 0] : [0, 1]
  const length = Math.hypot(vx, vy)
  const ux = vx / length
  const uy = vy / length
  return [high * ux * ux, high * uy * uy, high * ux * uy]
}

/** eine Scheibe aus den Werten ihrer Schüsse (je Schuss eine oder zwei Zahlen) */
export function shotGroup(values: readonly (readonly number[])[]): ShotGroup {
  const d = values[0]?.length ?? 1
  const n = values.length
  const mean = Array.from({ length: d }, (_, i) => values.reduce((s, v) => s + v[i], 0) / n)
  let scatter: Sym = d === 1 ? [0] : [0, 0, 0]
  for (const v of values) scatter = add(scatter, outer(v.map((x, i) => x - mean[i])))
  return { n, mean, scatter }
}

/**
 * Mittel über alle Schüsse und seine Kovarianz über zwei Ebenen. W = Σ Sᵢ / (N − k), M = Σ nᵢ (x̄ᵢ − x̄)(x̄ᵢ − x̄)ᵀ /
 * (k − 1); Vortest F = tr(W⁻¹M)/d mit F(d(k − 1), d(N − k)). Ohne Wandern zählen alle Schüsse als eine Stichprobe:
 * V = T/N mit T = (Σ Sᵢ + (k − 1)M)/(N − 1), ν = N − 1. Mit Wandern B = (M − W)/n₀ (positiv semidefinit),
 * n₀ = (N − Σ nᵢ²/N)/(k − 1), V = (B Σ nᵢ² + W N)/N², ν = k − 1. Null unter zwei Scheiben, bei N − k ≤ d oder ohne
 * Streuung innerhalb der Scheiben.
 */
export function levelEstimate(groups: readonly ShotGroup[]): LevelEstimate | null {
  const k = groups.length
  if (k < 2) return null
  const d = groups[0].mean.length
  const N = groups.reduce((s, g) => s + g.n, 0)
  if (N - k <= d) return null
  const mean = Array.from(
    { length: d },
    (_, i) => groups.reduce((s, g) => s + g.n * g.mean[i], 0) / N
  )
  let scatter: Sym = d === 1 ? [0] : [0, 0, 0]
  let between: Sym = d === 1 ? [0] : [0, 0, 0]
  let squares = 0
  for (const g of groups) {
    scatter = add(scatter, g.scatter)
    between = add(between, scale(outer(g.mean.map((x, i) => x - mean[i])), g.n))
    squares += g.n * g.n
  }
  const within = scale(scatter, 1 / (N - k))
  const among = scale(between, 1 / (k - 1))
  const withinInverse = inverse(within)
  if (!withinInverse) return null
  const f = traceOfProduct(withinInverse, among) / d
  const wanderP = fSurvival(f, d * (k - 1), d * (N - k))
  const wander = wanderP < WANDER_ALPHA
  const base = { shots: N, groups: k, mean, wander, wanderP }
  if (!wander) {
    const total = scale(add(scatter, between), 1 / (N - 1))
    return { ...base, cov: scale(total, 1 / N), df: N - 1 }
  }
  const n0 = (N - squares / N) / (k - 1)
  const evenings = nonNegative(scale(add(among, scale(within, -1)), 1 / n0))
  const cov = scale(add(scale(evenings, squares), scale(within, N)), 1 / (N * N))
  return { ...base, cov, df: k - 1 }
}

/** F-Test eines Hotelling-T² mit ν Freiheitsgraden der Kovarianz: F = (ν − d + 1)/(d ν) · T² */
function hotellingP(t2: number, d: number, nu: number): number | null {
  const denominator = nu - d + 1
  if (!(denominator > 0)) return null
  return fSurvival((denominator / (d * nu)) * t2, d, denominator)
}

/** Ist das Mittel 0? T² = x̄ᵀ V⁻¹ x̄ mit F(d, ν − d + 1); null ohne Test */
export function levelTestZero(estimate: LevelEstimate): { t2: number; p: number } | null {
  const inv = inverse(estimate.cov)
  if (!inv) return null
  const t2 = quadratic(inv, estimate.mean)
  const p = hotellingP(t2, estimate.mean.length, estimate.df)
  return p === null ? null : { t2, p }
}

/**
 * Zwei Seiten: Δ = Mittel a − Mittel b, V = Vₐ + V_b, ν nach Welch über die Spuren
 * (tr V)² / ((tr Vₐ)²/νₐ + (tr V_b)²/ν_b), T² = Δᵀ V⁻¹ Δ mit F(d, ν − d + 1). Null ohne Test.
 */
export function levelCompare(
  a: LevelEstimate,
  b: LevelEstimate
): { delta: number[]; t2: number; p: number; df: number } | null {
  const delta = a.mean.map((x, i) => x - b.mean[i])
  const cov = add(a.cov, b.cov)
  const inv = inverse(cov)
  if (!inv) return null
  const df = trace(cov) ** 2 / (trace(a.cov) ** 2 / a.df + trace(b.cov) ** 2 / b.df)
  const t2 = quadratic(inv, delta)
  const p = hotellingP(t2, delta.length, df)
  return p === null ? null : { delta, t2, p, df }
}

/** Raster der Werte je Schuss in einer Wertung: Zehntel und ganze Ringe, damit ein Mittel genau bleibt */
const RASTER: Record<string, number> = { decimal: 10, rings: 1 }

/** Freiheitsgrade und Varianz einer Streuung je Scheibe: Richtung ν = n − 1, Rayleigh-σ ν = 2(n − 1), s = σ̂ · c4 */
function spreadOf(value: CardValue, pooling: "spreadAxis" | "spreadRadial") {
  const nu = pooling === "spreadAxis" ? value.n - 1 : 2 * (value.n - 1)
  const s = pooling === "spreadAxis" || nu < 1 ? value.value : value.value * c4(nu + 1)
  return { nu, variance: s * s }
}

/**
 * Der Wert eines Zeitraums über alle Schüsse ([[adr-034]]): bei `pooling: "mean"` Σ vᵢnᵢ / Σ nᵢ (in einer Wertung
 * auf ihrem Raster, wie `pooledMean`), bei Streuungen √(Σ νᵢsᵢ² / Σ νᵢ) (Rayleigh-σ geteilt durch c4(Σ νᵢ + 1)), ohne
 * `pooling` das Mittel der Werte je Scheibe. Null ohne Werte.
 */
export function pooledValue(values: readonly CardValue[], metric: MetricDefinition): number | null {
  if (!values.length) return null
  if (metric.pooling === "mean") {
    const shots = values.reduce((sum, v) => sum + v.n, 0)
    if (!shots) return null
    const step = metric.scoring ? RASTER[metric.scoring] : undefined
    if (step === undefined) return values.reduce((sum, v) => sum + v.value * v.n, 0) / shots
    const units = values.reduce((sum, v) => sum + Math.round(v.value * v.n * step), 0)
    return units / step / shots
  }
  if (metric.pooling === "spreadAxis" || metric.pooling === "spreadRadial") {
    const pooling = metric.pooling
    const parts = values.map((v) => spreadOf(v, pooling)).filter((p) => p.nu > 0)
    const nu = parts.reduce((sum, p) => sum + p.nu, 0)
    if (!nu) return null
    const s = Math.sqrt(parts.reduce((sum, p) => sum + p.nu * p.variance, 0) / nu)
    return pooling === "spreadAxis" ? s : s / c4(nu + 1)
  }
  return values.reduce((sum, v) => sum + v.value, 0) / values.length
}

/** die Gruppen eines Mittels über Schüsse, wenn jede Scheibe die Streuung ihrer Schusswerte kennt */
function meanGroups(values: readonly CardValue[]): ShotGroup[] | null {
  if (values.some((v) => v.sd === undefined)) return null
  return values.map((v) => ({ n: v.n, mean: [v.value], scatter: [(v.n - 1) * (v.sd ?? 0) ** 2] }))
}

/** Urteil aus p und der Richtung von Δ */
const verdictOf = (p: number, delta: number): PeriodComparison["verdict"] =>
  p < COMPARE_ALPHA && delta > 0 ? "higher" : p < COMPARE_ALPHA && delta < 0 ? "lower" : "unclear"

/**
 * Streuung zweier Zeiträume: je Seite Vortest auf wandernde Präzision (Q = Σ (νᵢ/2)(ln sᵢ² − ȳ)² mit χ²(k − 1),
 * Wandern bei p < 0,25). Ohne Wandern der F-Test der gepoolten Varianzen, zweiseitig; sonst Welch-t über ln sᵢ².
 * Ein Urteil nur, wenn der Test in die Richtung der gepoolten Werte zeigt.
 */
function compareSpreads(
  a: readonly CardValue[],
  b: readonly CardValue[],
  pooling: "spreadAxis" | "spreadRadial",
  delta: number
): { p: number; basis: "shots" | "evenings"; agrees: boolean } | null {
  const side = (values: readonly CardValue[]) => {
    const parts = values.map((v) => spreadOf(v, pooling)).filter((p) => p.nu > 0 && p.variance > 0)
    const nu = parts.reduce((sum, p) => sum + p.nu, 0)
    const ys = parts.map((p) => Math.log(p.variance))
    const weighted = parts.reduce((sum, p, i) => sum + (p.nu / 2) * ys[i], 0) / (nu / 2)
    const q = parts.reduce((sum, p, i) => sum + (p.nu / 2) * (ys[i] - weighted) ** 2, 0)
    const wander = parts.length > 1 && chiSquareSurvival(q, parts.length - 1) < WANDER_ALPHA
    const variance = parts.reduce((sum, p) => sum + p.nu * p.variance, 0) / nu
    return { parts, nu, ys, wander, variance }
  }
  const sa = side(a)
  const sb = side(b)
  if (sa.parts.length < 2 || sb.parts.length < 2) return null
  if (!sa.wander && !sb.wander) {
    const upper = fSurvival(sb.variance / sa.variance, sb.nu, sa.nu)
    return { p: Math.min(1, 2 * Math.min(upper, 1 - upper)), basis: "shots", agrees: true }
  }
  const mean = (ys: readonly number[]) => ys.reduce((sum, y) => sum + y, 0) / ys.length
  const share = (ys: readonly number[]) =>
    ys.reduce((sum, y) => sum + (y - mean(ys)) ** 2, 0) / (ys.length - 1) / ys.length
  const va = share(sa.ys)
  const vb = share(sb.ys)
  const diff = mean(sb.ys) - mean(sa.ys)
  const v = va + vb
  if (!(v > 0)) return null
  const df = (v * v) / ((va * va) / (sa.ys.length - 1) + (vb * vb) / (sb.ys.length - 1))
  const p = fSurvival((diff * diff) / v, 1, df)
  return { p, basis: "evenings", agrees: Math.sign(diff) === Math.sign(delta) }
}

/**
 * Vergleich zweier Zeiträume über die Schüsse ([[adr-034]]), in der Form von `comparePeriods` (Δ = b − a): die Werte
 * über alle Schüsse (`pooledValue`), das Urteil über zwei Ebenen (`levelCompare` bei Mitteln mit Streuung der
 * Schusswerte, sonst die Streuungen über ihre Varianzen). Fehlt die Streuung der Schusswerte oder hat die Kennzahl kein
 * Pooling, der Rangtest über die Werte je Scheibe (`compareSamples`). Ein Urteil ab fünf Scheiben je Seite; „bedeutsam“
 * (T3) aus den Werten je Scheibe. Ohne Werte auf einer Seite null.
 */
export function compareValues(
  a: readonly CardValue[],
  b: readonly CardValue[],
  metric: MetricDefinition
): PeriodComparison | null {
  const ma = pooledValue(a, metric)
  const mb = pooledValue(b, metric)
  if (ma === null || mb === null) return null
  const xa = a.map((v) => v.value)
  const xb = b.map((v) => v.value)
  const delta = mb - ma
  const summary = { a: { n: a.length, mean: ma }, b: { n: b.length, mean: mb }, delta }
  const few = a.length < MIN_CARDS_PER_SIDE || b.length < MIN_CARDS_PER_SIDE
  const undecided = (basis: PeriodComparison["basis"]): PeriodComparison => ({
    ...summary,
    basis,
    test: null,
    verdict: "unclear",
    meaningful: null,
  })
  const byCards = (): PeriodComparison | null => {
    const ranked = compareSamples(xa, xb)
    if (!ranked) return null
    // der Rangtest urteilt nur, wenn das Mittel über die Schüsse in dieselbe Richtung zeigt
    const agrees = Math.sign(ranked.delta) === Math.sign(delta)
    return { ...ranked, ...summary, verdict: agrees ? ranked.verdict : "unclear" }
  }
  if (metric.pooling === "mean") {
    const ga = meanGroups(a)
    const gb = meanGroups(b)
    const ea = ga && levelEstimate(ga)
    const eb = gb && levelEstimate(gb)
    if (!ea || !eb) return byCards()
    const basis = ea.wander || eb.wander ? "evenings" : "shots"
    const compared = few ? null : levelCompare(eb, ea)
    if (!compared) return undecided(basis)
    return {
      ...summary,
      basis,
      test: { p: compared.p, exact: false },
      verdict: verdictOf(compared.p, delta),
      meaningful: meaningfulChange(xa, xb, delta),
    }
  }
  if (metric.pooling === "spreadAxis" || metric.pooling === "spreadRadial") {
    const spreads = compareSpreads(a, b, metric.pooling, delta)
    if (!spreads) return byCards()
    if (few) return undecided(spreads.basis)
    return {
      ...summary,
      basis: spreads.basis,
      test: { p: spreads.p, exact: false },
      verdict: spreads.agrees ? verdictOf(spreads.p, delta) : "unclear",
      meaningful: meaningfulChange(xa, xb, delta),
    }
  }
  return byCards()
}
