// Statistik-Hilfen für die Auswertungen: robuste Lage- und Streumaße, Quoten mit Wilson-Intervall,
// Quantile der χ²- und F-Verteilung in den Fällen mit geschlossener Verteilungsfunktion und eine robuste
// Trendgerade. Rein und ohne Abhängigkeiten; Werte unter der nötigen Zahl ergeben null statt einer Zahl.

/** z für ein zweiseitiges 95-%-Intervall */
export const Z95 = 1.959963984540054

const sorted = (values: readonly number[]) => [...values].sort((a, b) => a - b)

/** Quantil nach Typ 7 (linear zwischen den Rängen, wie R und NumPy) */
export function quantile(values: readonly number[], p: number): number | null {
  if (!(p >= 0 && p <= 1)) throw new RangeError(`Quantil ${p} liegt nicht zwischen 0 und 1`)
  if (values.length === 0) return null
  const xs = sorted(values)
  const h = (xs.length - 1) * p
  const lower = Math.floor(h)
  const upper = Math.min(lower + 1, xs.length - 1)
  return xs[lower] + (h - lower) * (xs[upper] - xs[lower])
}

export const median = (values: readonly number[]) => quantile(values, 0.5)

/** mittlere absolute Abweichung vom Median, ungewichtet */
export function mad(values: readonly number[]): number | null {
  const center = median(values)
  return center === null ? null : median(values.map((v) => Math.abs(v - center)))
}

export function iqr(values: readonly number[]): number | null {
  const q1 = quantile(values, 0.25)
  const q3 = quantile(values, 0.75)
  return q1 === null || q3 === null ? null : q3 - q1
}

/** Wilson-Intervall einer Quote; auch bei 0 oder n Treffern sinnvoll, anders als die Normalnäherung */
export function wilson(
  successes: number,
  n: number,
  z = Z95
): { low: number; high: number } | null {
  if (!Number.isInteger(n) || n <= 0) return null
  if (!Number.isInteger(successes) || successes < 0 || successes > n) return null
  const p = successes / n
  const z2 = z * z
  const denominator = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denominator
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator
  // Bei 0 oder n Treffern liegt die Grenze exakt bei 0 bzw. 1; die Formel träfe sie nur bis auf Rundung.
  return {
    low: successes === 0 ? 0 : Math.max(0, center - half),
    high: successes === n ? 1 : Math.min(1, center + half),
  }
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
]

/** ln Γ(x) für x > 0 (Lanczos, g = 7) */
export function logGamma(x: number): number {
  if (!(x > 0)) throw new RangeError(`lnΓ nur für x > 0, nicht für ${x}`)
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  const shifted = x - 1
  let sum = LANCZOS[0]
  for (let i = 1; i < LANCZOS.length; i++) sum += LANCZOS[i] / (shifted + i)
  const t = shifted + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum)
}

/** Korrekturfaktor c4(n): E[s] = c4(n) · σ für die Standardabweichung aus n Werten */
export function c4(n: number): number {
  if (!(n >= 2)) throw new RangeError(`c4 braucht n ≥ 2, nicht ${n}`)
  return Math.sqrt(2 / (n - 1)) * Math.exp(logGamma(n / 2) - logGamma((n - 1) / 2))
}

function assertEvenDf(df: number) {
  if (!Number.isInteger(df) || df < 2 || df % 2 !== 0) {
    throw new RangeError(`χ² hier nur mit geraden Freiheitsgraden ab 2, nicht ${df}`)
  }
}

/**
 * Verteilungsfunktion der χ²-Verteilung bei geraden Freiheitsgraden, geschlossen:
 * P(X ≤ x) = 1 − e^(−x/2) · Σ_{j<df/2} (x/2)^j / j!, im Logarithmus gerechnet gegen Überlauf.
 */
export function chiSquareCdfEven(x: number, df: number): number {
  assertEvenDf(df)
  if (x <= 0) return 0
  const half = x / 2
  const logs: number[] = []
  for (let j = 0; j < df / 2; j++) logs.push(j * Math.log(half) - logGamma(j + 1))
  const top = Math.max(...logs)
  const sum = logs.reduce((acc, l) => acc + Math.exp(l - top), 0)
  const upper = Math.exp(-half + top + Math.log(sum))
  return Math.min(1, Math.max(0, 1 - upper))
}

/** Quantil der χ²-Verteilung bei geraden Freiheitsgraden, per Bisektion auf der geschlossenen Form */
export function chiSquareQuantileEven(p: number, df: number): number {
  assertEvenDf(df)
  if (!(p > 0 && p < 1)) throw new RangeError(`Quantil ${p} liegt nicht strikt zwischen 0 und 1`)
  let low = 0
  let high = Math.max(2, df)
  while (chiSquareCdfEven(high, df) < p) high *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2
    if (chiSquareCdfEven(mid, df) < p) low = mid
    else high = mid
  }
  return (low + high) / 2
}

/** Quantil der F-Verteilung mit 2 Zählerfreiheitsgraden: x = ν/2 · ((1 − p)^(−2/ν) − 1) */
export function fQuantile2(p: number, nu: number): number {
  if (!(p > 0 && p < 1)) throw new RangeError(`Quantil ${p} liegt nicht strikt zwischen 0 und 1`)
  if (!(nu > 0)) throw new RangeError(`F braucht ν > 0, nicht ${nu}`)
  return (nu / 2) * ((1 - p) ** (-2 / nu) - 1)
}

/**
 * Robuste Trendgerade nach Theil-Sen: Steigung = Median aller paarweisen Steigungen, Achsenabschnitt =
 * Median von y − Steigung · x. Intervall nach Sen über die Varianz von Kendalls S (ohne Bindungen):
 * die Steigungen mit den Rängen (N − C)/2 und (N + C)/2 + 1, C = z · √(n(n − 1)(2n + 5)/18).
 */
export function theilSen(
  xs: readonly number[],
  ys: readonly number[],
  z = Z95
): { slope: number; intercept: number; low: number; high: number } | null {
  if (xs.length !== ys.length) throw new RangeError("x und y brauchen gleich viele Werte")
  const n = xs.length
  if (n < 3) return null
  const slopes: number[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]))
    }
  }
  if (slopes.length === 0) return null
  const ordered = sorted(slopes)
  const slope = median(ordered) as number
  const intercept = median(ys.map((y, i) => y - slope * xs[i])) as number
  const spread = z * Math.sqrt((n * (n - 1) * (2 * n + 5)) / 18)
  const count = ordered.length
  const lowRank = Math.min(count, Math.max(1, Math.round((count - spread) / 2)))
  const highRank = Math.min(count, Math.max(1, Math.round((count + spread) / 2) + 1))
  return { slope, intercept, low: ordered[lowRank - 1], high: ordered[highRank - 1] }
}
