// Ist der Prüfbestand noch der des Ausgangsstands? Die Prüfsumme aus `pruefdaten` über alle Tabellen, nur ohne
// `updatedAt` der Disziplinen: Ringwerk gleicht bei jedem Start des Servers die Standarddisziplinen ab
// (`ensureSystemDisciplines`) und setzt dabei diesen Zeitstempel neu. Alles andere zählt, auch jede Zeile, die eine
// Anmeldung oder ein Aufruf schreiben würde.

import { createHash } from "node:crypto"
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { Client } from "pg"

import { tableChecksum } from "../pruefdaten/checksum"

/** Disziplin-Zeile ohne `updatedAt` (kanonisches JSON, Schlüssel sortiert) */
export function withoutDisciplineStamp(line: string): string {
  const row = JSON.parse(line) as Record<string, unknown>
  delete row.updatedAt
  return JSON.stringify(row)
}

export async function bestandChecksum(url: string): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), "ringwerk-bestand-"))
  try {
    await tableChecksum(url, dir)
    const hash = createHash("sha256")
    for (const file of readdirSync(dir).sort()) {
      const lines = readFileSync(path.join(dir, file), "utf8").split("\n").filter(Boolean)
      hash.update(`${file}\n`)
      for (const line of lines)
        hash.update(`${file === "Discipline.jsonl" ? withoutDisciplineStamp(line) : line}\n`)
    }
    return hash.digest("hex")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Kennung des Aufbaus: die IDs sind in jedem Lauf von `pruefdaten` andere. Ringwerk ordnet Zeilen mit gleichem
 * Sortierschlüssel (etwa gleicher Nachname) in einer Folge, die von ihnen abhängt; nach einem Neuaufbau kann sich diese
 * Reihenfolge ändern, ohne dass sich Daten ändern.
 */
export async function buildId(url: string): Promise<string> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const { rows } = await client.query<{ id: string }>(
      `SELECT md5(string_agg(id, ',' ORDER BY id)) AS id FROM "Competition"`
    )
    return rows[0].id ?? "-"
  } finally {
    await client.end()
  }
}
