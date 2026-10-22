// Statistik-Hilfen für die Auswertungen: robuste Lage- und Streumaße, Quoten mit Wilson-Intervall,
// Quantile der χ²- und F-Verteilung in den Fällen mit geschlossener Verteilungsfunktion, eine
// robuste Trendgerade, der Trendtest nach Mann-Kendall und die Ausgleichsgerade. Rein und ohne
// Abhängigkeiten; Werte unter der nötigen Zahl ergeben null statt einer Zahl, nicht endliche Werte
// (NaN, unendlich) sind ein Fehler statt eines stillen Ergebnisses.

/** z für ein zweiseitiges 95-%-Intervall */
export const Z95 = 1.959963984540054

const sorted = (values: readonly number[]) => [...values].sort((a, b) => a - b)

function assertFinite(values: readonly number[]) {
  if (!values.every((v) => Number.isFinite(v))) {
    throw new RangeError("Statistik nur über endliche Werte")
  }
}

/** Quantil nach Typ 7 (linear zwischen den Rängen, wie R und NumPy) */
export function quantile(values: readonly number[], p: number): number | null {
  if (!(p >= 0 && p <= 1)) throw new RangeError(`Quantil ${p} liegt nicht zwischen 0 und 1`)
  if (values.length === 0) return null
  assertFinite(values)
  const xs = sorted(values)
  const h = (xs.length - 1) * p
  const lower = Math.floor(h)
  if (h === lower) return xs[lower]
  return xs[lower] + (h - lower) * (xs[lower + 1] - xs[lower])
}

export const median = (values: readonly number[]) => quantile(values, 0.5)

/** häufigster Wert, bei Gleichstand der größere; ohne Werte null (die Länge voller Serien einer Scheibe) */
export function modalLength(lengths: readonly number[]): number | null {
  const counts = new Map<number, number>()
  for (const length of lengths) counts.set(length, (counts.get(length) ?? 0) + 1)
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  return sorted.length ? sorted[0][0] : null
}

/** Median der absoluten Abweichungen vom Median (MAD), ohne Skalierungsfaktor */
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

const TINY = 1e-300
const SERIES_STEPS = 500
const SERIES_EPS = 1e-15

/** Kettenbruch der unvollständigen Beta-Funktion (Lentz), konvergiert für x < (a + 1)/(a + b + 2) */
function betaFraction(a: number, b: number, x: number): number {
  let c = 1
  let d = 1 - ((a + b) * x) / (a + 1)
  if (Math.abs(d) < TINY) d = TINY
  d = 1 / d
  let h = d
  for (let m = 1; m <= SERIES_STEPS; m++) {
    const m2 = 2 * m
    for (const aa of [
      (m * (b - m) * x) / ((a - 1 + m2) * (a + m2)),
      (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2)),
    ]) {
      d = 1 + aa * d
      if (Math.abs(d) < TINY) d = TINY
      c = 1 + aa / c
      if (Math.abs(c) < TINY) c = TINY
      d = 1 / d
      h *= d * c
    }
    if (Math.abs(d * c - 1) < SERIES_EPS) break
  }
  return h
}

/** regularisierte unvollständige Beta-Funktion I_x(a, b) für a, b > 0 */
export function incompleteBeta(a: number, b: number, x: number): number {
  if (!(a > 0 && b > 0)) throw new RangeError(`Beta braucht a, b > 0, nicht ${a}, ${b}`)
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  )
  return x < (a + 1) / (a + b + 2)
    ? (front * betaFraction(a, b, x)) / a
    : 1 - (front * betaFraction(b, a, 1 - x)) / b
}

/** P(F > f) der F-Verteilung mit d1 und d2 Freiheitsgraden: I_{d2/(d2 + d1 f)}(d2/2, d1/2) */
export function fSurvival(f: number, d1: number, d2: number): number {
  if (!(d1 > 0 && d2 > 0)) throw new RangeError(`F braucht Freiheitsgrade > 0, nicht ${d1}, ${d2}`)
  if (!(f > 0)) return 1
  return incompleteBeta(d2 / 2, d1 / 2, d2 / (d2 + d1 * f))
}

/** regularisierte obere unvollständige Gammafunktion Q(a, x): Reihe unter a + 1, sonst Kettenbruch */
function gammaSurvival(a: number, x: number): number {
  if (x <= 0) return 1
  const front = -x + a * Math.log(x) - logGamma(a)
  if (x < a + 1) {
    let term = 1 / a
    let sum = term
    for (let n = 1; n <= SERIES_STEPS; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * SERIES_EPS) break
    }
    return Math.max(0, 1 - sum * Math.exp(front))
  }
  let b = x + 1 - a
  let c = 1 / TINY
  let d = 1 / b
  let h = d
  for (let i = 1; i <= SERIES_STEPS; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < TINY) d = TINY
    c = b + an / c
    if (Math.abs(c) < TINY) c = TINY
    d = 1 / d
    h *= d * c
    if (Math.abs(d * c - 1) < SERIES_EPS) break
  }
  return Math.min(1, Math.exp(front) * h)
}

/** P(X > x) der χ²-Verteilung mit df Freiheitsgraden, auch ungeraden */
export function chiSquareSurvival(x: number, df: number): number {
  if (!(df > 0)) throw new RangeError(`χ² braucht df > 0, nicht ${df}`)
  return gammaSurvival(df / 2, x / 2)
}

/**
 * Robuste Trendgerade nach Theil-Sen: Steigung = Median aller paarweisen Steigungen, Achsenabschnitt =
 * Median von y − Steigung · x. Intervall nach Sen über die Varianz von Kendalls S (ohne Bindungen):
 * die Steigungen mit den Rängen (N − C)/2 und (N + C)/2 + 1, C = z · √(n(n − 1)(2n + 5)/18). Liegt
 * (N − C)/2 unter 1, gibt es keinen solchen Bereich (bei z = 1,96 unter sechs Punkten): dann null.
 */
export function theilSen(
  xs: readonly number[],
  ys: readonly number[],
  z = Z95
): { slope: number; intercept: number; low: number; high: number } | null {
  if (xs.length !== ys.length) throw new RangeError("x und y brauchen gleich viele Werte")
  assertFinite(xs)
  assertFinite(ys)
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
  if ((count - spread) / 2 < 1) return null
  const lowRank = Math.round((count - spread) / 2)
  const highRank = Math.min(count, Math.round((count + spread) / 2) + 1)
  return { slope, intercept, low: ordered[lowRank - 1], high: ordered[highRank - 1] }
}

/**
 * Trendtest nach Mann-Kendall über Werte in ihrer Reihenfolge: S = Σ sign(yⱼ − yᵢ) über alle Paare
 * i < j, Varianz mit Korrektur für gleiche Werte [n(n − 1)(2n + 5) − Σ t(t − 1)(2t + 5)] / 18 (t je
 * Gruppe gleicher Werte), z = (S − sign S) / √Var mit Stetigkeitskorrektur, bei Varianz 0 (alle gleich)
 * z = 0. Anders als das Sen-Intervall kommt er mit vielen gleichen Werten zurecht (ganze Ringe). Unter
 * drei Werten null.
 */
export function mannKendall(
  ys: readonly number[]
): { s: number; variance: number; z: number } | null {
  assertFinite(ys)
  const n = ys.length
  if (n < 3) return null
  let s = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) s += Math.sign(ys[j] - ys[i])
  }
  const groups = new Map<number, number>()
  for (const y of ys) groups.set(y, (groups.get(y) ?? 0) + 1)
  let ties = 0
  for (const t of groups.values()) ties += t * (t - 1) * (2 * t + 5)
  const variance = (n * (n - 1) * (2 * n + 5) - ties) / 18
  const z = variance > 0 && s !== 0 ? (s - Math.sign(s)) / Math.sqrt(variance) : 0
  return { s, variance, z }
}

/**
 * Steigung der Ausgleichsgeraden nach kleinsten Quadraten; ohne Streuung in x (oder unter zwei
 * Punkten) null. Gleiche x erkennt der Vergleich, nicht Σ(x − x̄)²: Bei Werten wie 0,1 bliebe dort
 * ein Rest.
 */
export function leastSquaresSlope(xs: readonly number[], ys: readonly number[]): number | null {
  if (xs.length !== ys.length) throw new RangeError("x und y brauchen gleich viele Werte")
  assertFinite(xs)
  assertFinite(ys)
  const n = xs.length
  if (n < 2 || xs.every((x) => x === xs[0])) return null
  const mx = xs.reduce((sum, x) => sum + x, 0) / n
  const my = ys.reduce((sum, y) => sum + y, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  return sxx > 0 ? sxy / sxx : null
}

/**
 * Komplementäre Fehlerfunktion nach Numerical Recipes (`erfcc`, Chebyshev-Näherung), relativer Fehler unter
 * 1,2 · 10⁻⁷ für alle x.
 */
function erfc(x: number): number {
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    )
  return x >= 0 ? r : 2 - r
}

/** zweiseitiger p-Wert zu z unter der Standardnormalverteilung: P(|Z| ≥ |z|) */
export function normalTwoSided(z: number): number {
  return Math.min(1, erfc(Math.abs(z) / Math.SQRT2))
}

/** bis zu so vielen Werten je Seite zählt `mannWhitney` die Verteilung genau aus */
const MANN_WHITNEY_EXACT = 20

/**
 * Mann-Whitney-U für zwei unabhängige Gruppen, zweiseitig. Gleiche Werte bekommen mittlere
 * Ränge. Bis 20 Werte je Seite genau: Über alle Aufteilungen der gemeinsamen Ränge auf |a| und |b| wird die
 * Rangsumme von `a` ausgezählt (doppelte Ränge als ganze Zahlen, Tabelle über Anzahl und Summe); p ist der
 * Anteil der Aufteilungen, deren Rangsumme mindestens so weit von der Erwartung liegt wie die beobachtete.
 * Darüber Normalnäherung mit Korrektur für gleiche Werte und Stetigkeitskorrektur. `u` ist U von `a`. Unter
 * einem Wert je Seite null.
 */
export function mannWhitney(
  a: readonly number[],
  b: readonly number[]
): { u: number; p: number; exact: boolean } | null {
  if (a.length < 1 || b.length < 1) return null
  assertFinite(a)
  assertFinite(b)
  const na = a.length
  const nb = b.length
  const n = na + nb
  // gemeinsame Ränge, gleiche Werte mit dem mittleren Rang; doppelt als ganze Zahl
  const pooled = [...a.map((v) => ({ v, inA: true })), ...b.map((v) => ({ v, inA: false }))].sort(
    (x, y) => x.v - y.v
  )
  const doubled: number[] = new Array(n)
  const ties: number[] = []
  for (let i = 0; i < n; ) {
    let j = i
    while (j + 1 < n && pooled[j + 1].v === pooled[i].v) j++
    // Ränge i + 1 … j + 1, ihr Mittel doppelt: (i + 1) + (j + 1)
    for (let k = i; k <= j; k++) doubled[k] = i + j + 2
    ties.push(j - i + 1)
    i = j + 1
  }
  const observed2 = pooled.reduce((sum, item, k) => (item.inA ? sum + doubled[k] : sum), 0)
  const u = observed2 / 2 - (na * (na + 1)) / 2
  // Erwartung der doppelten Rangsumme von a: na · (n + 1)
  const expected2 = na * (n + 1)
  const distance2 = Math.abs(observed2 - expected2)

  if (na <= MANN_WHITNEY_EXACT && nb <= MANN_WHITNEY_EXACT) {
    const maxSum = doubled.reduce((sum, r) => sum + r, 0)
    // count[k][s]: Zahl der Auswahlen von k Werten mit doppelter Rangsumme s
    const count = Array.from({ length: na + 1 }, () => new Float64Array(maxSum + 1))
    count[0][0] = 1
    for (const r of doubled) {
      for (let k = na; k >= 1; k--) {
        const row = count[k]
        const prev = count[k - 1]
        for (let s = maxSum; s >= r; s--) if (prev[s - r]) row[s] += prev[s - r]
      }
    }
    let far = 0
    let all = 0
    count[na].forEach((ways, s) => {
      if (!ways) return
      all += ways
      if (Math.abs(s - expected2) >= distance2) far += ways
    })
    return { u, p: Math.min(1, far / all), exact: true }
  }

  const mean = (na * nb) / 2
  const tieTerm = ties.reduce((sum, t) => sum + (t * t * t - t), 0)
  const variance = ((na * nb) / 12) * (n + 1 - tieTerm / (n * (n - 1)))
  if (!(variance > 0)) return { u, p: 1, exact: false }
  const z = Math.max(0, Math.abs(u - mean) - 0.5) / Math.sqrt(variance)
  return { u, p: normalTwoSided(z), exact: false }
}

/** bis zu so vielen Werten in der kleinen Gruppe zählt `permutationMeanTest` alle Auswahlen aus */
const PERMUTATION_MAX = 3

/**
 * Exakter Permutationstest auf den Unterschied der Mittel, zweiseitig: Anteil aller Auswahlen von |a| Werten aus a und
 * b zusammen, deren Mittel mindestens so weit vom Mittel der übrigen liegt wie das von a. Bei festem n und k ist das
 * |n · Σauswahl − k · Σalle|, ganzzahlig gerechnet: Die Werte sind ganze Zahlen (etwa Zehntel), damit Gleichstände genau
 * zählen. Nur für eine kleine Gruppe (|a| bis 3), sonst Fehler; unter einem Wert je Seite null.
 */
export function permutationMeanTest(
  a: readonly number[],
  b: readonly number[]
): { p: number } | null {
  if (a.length > PERMUTATION_MAX) {
    throw new RangeError(
      `Permutationstest nur für bis zu ${PERMUTATION_MAX} Werte, nicht ${a.length}`
    )
  }
  if (![...a, ...b].every((v) => Number.isInteger(v))) {
    throw new RangeError("Permutationstest nur über ganze Zahlen")
  }
  if (a.length < 1 || b.length < 1) return null
  const all = [...a, ...b]
  const n = all.length
  const k = a.length
  const total = all.reduce((sum, v) => sum + v, 0)
  const distance = (sum: number) => Math.abs(n * sum - k * total)
  const observed = distance(a.reduce((sum, v) => sum + v, 0))
  let far = 0
  let count = 0
  // alle Auswahlen von k Werten über ihre Positionen (gleiche Werte zählen einzeln)
  const choose = (start: number, left: number, sum: number) => {
    if (left === 0) {
      count++
      if (distance(sum) >= observed) far++
      return
    }
    for (let i = start; i <= n - left; i++) choose(i + 1, left - 1, sum + all[i])
  }
  choose(0, k, 0)
  return { p: far / count }
}
