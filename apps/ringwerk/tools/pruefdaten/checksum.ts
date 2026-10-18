// Prüfsumme über alle Tabellen der Prüfdatenbank. Die IDs (cuid) sind in jedem Lauf andere; die Prüfsumme ersetzt sie
// deshalb durch Ordnungsnummern: Zeilen einer Tabelle nach `createdAt` und Inhalt sortiert, Fremdschlüssel durch die
// Nummer der Zeile, auf die sie zeigen. Die Tabellen laufen in der Reihenfolge ihrer Abhängigkeiten, damit der Inhalt
// einer Zeile beim Sortieren schon die Nummern ihrer Eltern trägt. Bcrypt-Hashes und das QR-Zugangs-Token sind
// absichtlich zufällig; von ihnen zählt nur, ob sie gesetzt sind.

import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { Client, types } from "pg"

import { assertPruefDatabaseUrl } from "./db"

interface TableSpec {
  name: string
  /** Spalte → Tabelle, auf die sie zeigt. */
  refs?: Record<string, string>
  /** Spalten, deren Wert zufällig ist; nur „gesetzt“ zählt. */
  secret?: string[]
}

const TABLES: TableSpec[] = [
  { name: "User", secret: ["passwordHash"] },
  { name: "LoginRateLimitBucket" },
  { name: "Discipline" },
  { name: "Participant", refs: { createdByUserId: "User" } },
  {
    name: "Competition",
    refs: { disciplineId: "Discipline", createdByUserId: "User" },
    secret: ["publicPasswordHash", "publicAccessToken"],
  },
  { name: "EventTeam", refs: { competitionId: "Competition" } },
  {
    name: "CompetitionParticipant",
    refs: {
      competitionId: "Competition",
      participantId: "Participant",
      disciplineId: "Discipline",
      eventTeamId: "EventTeam",
    },
  },
  {
    name: "Matchup",
    refs: {
      competitionId: "Competition",
      homeParticipantId: "Participant",
      awayParticipantId: "Participant",
    },
  },
  {
    name: "Series",
    refs: {
      matchupId: "Matchup",
      competitionId: "Competition",
      participantId: "Participant",
      disciplineId: "Discipline",
      competitionParticipantId: "CompetitionParticipant",
      recordedByUserId: "User",
    },
  },
  {
    name: "PlayoffMatch",
    refs: {
      competitionId: "Competition",
      participantAId: "Participant",
      participantBId: "Participant",
    },
  },
  { name: "PlayoffDuel", refs: { playoffMatchId: "PlayoffMatch" } },
  {
    name: "PlayoffDuelResult",
    refs: { duelId: "PlayoffDuel", participantId: "Participant", recordedByUserId: "User" },
  },
  // entityId und details können auf jede Tabelle zeigen: Jede bekannte ID darin wird ersetzt.
  { name: "AuditLog", refs: { userId: "User", competitionId: "Competition" } },
]

export interface Checksum {
  total: string
  tables: { name: string; rows: number; hash: string }[]
}

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    )
  }
  return value
}

/** Ersetzt bekannte IDs überall im Wert, auch in JSON-Details. */
function relabel(value: unknown, labels: Map<string, string>): unknown {
  if (typeof value === "string") return labels.get(value) ?? value
  if (Array.isArray(value)) return value.map((v) => relabel(v, labels))
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, relabel(v, labels)]))
  }
  return value
}

/** `linesDir`: schreibt je Tabelle die kanonischen Zeilen dorthin, um zwei Läufe zu vergleichen. */
export async function tableChecksum(url: string, linesDir?: string): Promise<Checksum> {
  assertPruefDatabaseUrl(url)
  // Zeitstempel als Text, wie sie gespeichert sind: Prisma schreibt `timestamp` ohne Zeitzone, und `pg` läse ihn sonst
  // in der Zeitzone des Rechners (andere Prüfsumme je Rechner, an der Zeitumstellung zwei Zeiten auf einer).
  const client = new Client({
    connectionString: url,
    types: {
      getTypeParser: ((oid: number, format?: "text" | "binary") =>
        oid === 1114 || oid === 1184
          ? (value: string) => value
          : types.getTypeParser(oid, format)) as typeof types.getTypeParser,
    },
  })
  await client.connect()
  const labels = new Map<string, string>()
  const tables: Checksum["tables"] = []
  try {
    for (const spec of TABLES) {
      const { rows } = await client.query<Record<string, unknown>>(`SELECT * FROM "${spec.name}"`)
      const prepared = rows.map((row) => {
        const content: Record<string, unknown> = {}
        for (const [column, value] of Object.entries(row)) {
          if (column === "id") continue
          if (spec.secret?.includes(column)) {
            content[column] = value === null ? null : "<gesetzt>"
          } else if (spec.refs?.[column] || spec.name === "AuditLog") {
            content[column] = relabel(value, labels)
          } else {
            content[column] = value
          }
        }
        const line = JSON.stringify(canonical(content))
        const created = typeof row.createdAt === "string" ? row.createdAt : ""
        return { id: row.id as string | undefined, line, key: `${created}|${line}` }
      })
      prepared.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      for (let i = 1; i < prepared.length; i++) {
        if (prepared[i].key === prepared[i - 1].key && prepared[i].id !== undefined) {
          throw new Error(`${spec.name}: zwei Zeilen ohne Unterschied, Reihenfolge nicht eindeutig`)
        }
      }
      prepared.forEach((row, i) => {
        if (row.id !== undefined) labels.set(row.id, `${spec.name}#${i + 1}`)
      })
      const hash = createHash("sha256")
      for (const row of prepared) hash.update(`${row.line}\n`)
      if (linesDir) {
        mkdirSync(linesDir, { recursive: true })
        writeFileSync(
          path.join(linesDir, `${spec.name}.jsonl`),
          prepared.map((row) => `${row.line}\n`).join("")
        )
      }
      tables.push({ name: spec.name, rows: prepared.length, hash: hash.digest("hex") })
    }
  } finally {
    await client.end()
  }
  const total = createHash("sha256")
  for (const t of tables) total.update(`${t.name}:${t.rows}:${t.hash}\n`)
  return { total: total.digest("hex"), tables }
}
