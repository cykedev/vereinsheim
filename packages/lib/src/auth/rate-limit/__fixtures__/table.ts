// Eine Tabelle `LoginRateLimitBucket` im Speicher für die Tests von Store und Admin-Auswertung. Sie wertet jede Abfrage
// so aus wie Prisma auf Postgres: Bedingungen mit `OR`, `in`, `gt`, `gte`, `lt` (null erfüllt keinen Vergleich),
// Sortierung über mehrere Spalten (aufsteigend null zuletzt, absteigend null zuerst) und `take`. Ein unbekanntes Feld oder
// ein unbekannter Operator wirft, damit eine neue Form der Abfrage nicht unbemerkt durchgeht (Review, 10. Oktober 2026).

import type { LoginRateLimitBucketDelegate, LoginRateLimitBucketRow } from "../stores"

type Row = LoginRateLimitBucketRow
type Value = Row[keyof Row]
type Where = Record<string, unknown> | undefined

const FIELDS = ["key", "attempts", "windowStartedAt", "blockedUntil", "lastAttemptAt"] as const

function field(row: Row, name: string): Value {
  if (!(FIELDS as readonly string[]).includes(name)) throw new Error(`unbekanntes Feld ${name}`)
  return row[name as keyof Row]
}

const order = (a: Value, b: Value) => {
  const x = a instanceof Date ? a.getTime() : a
  const y = b instanceof Date ? b.getTime() : b
  return (x as number | string) < (y as number | string)
    ? -1
    : (x as number | string) > (y as number | string)
      ? 1
      : 0
}

function satisfies(value: Value, op: string, arg: unknown): boolean {
  if (op === "in") return (arg as Value[]).includes(value)
  if (value === null) return false
  const c = order(value, arg as Value)
  if (op === "gt") return c > 0
  if (op === "gte") return c >= 0
  if (op === "lt") return c < 0
  throw new Error(`unbekannter Operator ${op}`)
}

export function matches(row: Row, where: Where): boolean {
  if (!where) return true
  return Object.entries(where).every(([name, condition]) => {
    if (name === "OR") return (condition as Where[]).some((one) => matches(row, one))
    const value = field(row, name)
    if (condition === null) return value === null
    if (typeof condition !== "object" || condition instanceof Date)
      return order(value, condition as Value) === 0
    return Object.entries(condition).every(([op, arg]) => satisfies(value, op, arg))
  })
}

function sorted(rows: Row[], orderBy: Record<string, "asc" | "desc">[] | undefined): Row[] {
  if (!orderBy) return rows
  return [...rows].sort((a, b) => {
    for (const step of orderBy) {
      const [name, direction] = Object.entries(step)[0]
      const x = field(a, name)
      const y = field(b, name)
      if (x === y) continue
      // Postgres: aufsteigend null zuletzt, absteigend null zuerst
      if (x === null) return direction === "asc" ? 1 : -1
      if (y === null) return direction === "asc" ? -1 : 1
      const c = order(x, y)
      if (c !== 0) return direction === "asc" ? c : -c
    }
    return 0
  })
}

/** die Tabelle und ihre Zeilen (für Prüfungen am Speicherstand) */
export function bucketTable(initial: readonly Row[] = []) {
  const rows = new Map<string, Row>(initial.map((row) => [row.key, row]))
  const table: LoginRateLimitBucketDelegate = {
    async findUnique({ where }) {
      return rows.get(where.key) ?? null
    },
    async findMany({ where, orderBy, take }) {
      const found = sorted(
        [...rows.values()].filter((row) => matches(row, where)),
        orderBy as Record<string, "asc" | "desc">[] | undefined
      )
      return take === undefined ? found : found.slice(0, take)
    },
    async upsert({ where, create, update }) {
      const existing = rows.get(where.key)
      rows.set(where.key, existing ? { ...existing, ...update } : create)
      return null
    },
    async deleteMany({ where }) {
      for (const row of [...rows.values()]) if (matches(row, where)) rows.delete(row.key)
      return null
    },
    async count(args) {
      return [...rows.values()].filter((row) => matches(row, args?.where)).length
    },
  }
  return { table, rows }
}
