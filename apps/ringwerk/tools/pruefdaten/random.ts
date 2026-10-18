// Zufall mit festem Startwert (Mulberry32): Derselbe Startwert ergibt in jedem Lauf dieselbe Folge, damit der
// Prüfbestand reproduzierbar ist. Jedes Szenario bekommt einen eigenen Startwert aus seinem Kürzel, so ändert ein neues
// Szenario die Daten der anderen nicht.

export interface Random {
  /** Gleichverteilt in [0, 1). */
  next(): number
  /** Ganze Zahl in [min, max]. */
  int(min: number, max: number): number
  /** Normalverteilt (Box-Muller). */
  normal(mean: number, sd: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Startwert aus einem Text (FNV-1a, 32 bit). */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

export function createRandom(seed: number | string): Random {
  const next = mulberry32(typeof seed === "string" ? seedFrom(seed) : seed)
  const random: Random = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    normal: (mean, sd) => {
      const u = 1 - next()
      const v = next()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const copy = [...items]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    },
  }
  return random
}
