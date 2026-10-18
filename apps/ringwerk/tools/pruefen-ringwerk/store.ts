// Ablage einer Aufnahme: je Wettbewerb eine JSON-Datei (ein Eintrag je Zeile, damit `git diff` lesbar bleibt), dazu
// `_stand.json` mit Prüfsumme des Bestands und Stand des Codes. Der Ausgangsstand des Prüfbestands liegt committet unter
// `tools/pruefdaten/referenz/`; Aufnahmen der echten Daten und jede Aufnahme zum Vergleich nur unter `reports/`.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { Recording } from "./compare"

export interface StoreMeta {
  /**
   * Prüfbestand: Prüfsumme über die Tabellen (`bestand.ts`); echte Daten: ein Wert aus den Fingerabdrücken der Tabellen
   * (`echt.ts`), ohne Inhalt
   */
  checksum: string | null
  /** Datenbank, gegen die aufgenommen wurde */
  database: string
  /** Commit des aufgenommenen Codes */
  commit: string
  /** Kennung des Aufbaus des Prüfbestands (`buildId`); fehlt bei echten Daten */
  build?: string
  /** Rollen, Breiten und Zahl der Wettbewerbe, zur Kontrolle */
  competitions: number
}

const META = "_stand.json"

export function writeStore(
  dir: string,
  meta: StoreMeta,
  recordings: ReadonlyMap<string, Recording>
) {
  // ganz neu, damit kein Wettbewerb eines früheren Stands liegen bleibt
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, META), `${JSON.stringify(meta, null, 2)}\n`)
  for (const [key, rec] of recordings)
    writeFileSync(path.join(dir, `${key}.json`), `${JSON.stringify(sorted(rec), null, 1)}\n`)
}

const byKey = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

/** Schlüssel sortiert: Die Tabs der Aufnahme füllen sie in der Reihenfolge, in der sie fertig werden */
export function sorted(rec: Recording): Recording {
  return { ...rec, reach: byKey(rec.reach), pages: byKey(rec.pages), pdfs: byKey(rec.pdfs) }
}

export function readStore(dir: string): { meta: StoreMeta; recordings: Map<string, Recording> } {
  if (!existsSync(path.join(dir, META)))
    throw new Error(`kein Ausgangsstand unter ${dir}: erst --aufnehmen`)
  const meta = JSON.parse(readFileSync(path.join(dir, META), "utf8")) as StoreMeta
  const recordings = new Map<string, Recording>()
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".json") || file === META) continue
    recordings.set(
      file.slice(0, -".json".length),
      JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Recording
    )
  }
  return { meta, recordings }
}
