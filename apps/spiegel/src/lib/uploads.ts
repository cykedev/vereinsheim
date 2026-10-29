// Aufräumen der hochgeladenen Dateien im Hintergrund: Ausdrucke und Belege ohne Zeile (`removeOrphanFiles`). Läuft beim
// Start, stündlich nach dem Papierkorb, nach „Nicht meine“, nach dem endgültigen Löschen und nach dem Entfernen eines
// Belegs.

import type { Db } from "@/lib/db"

import { removeOrphanEvidenceFiles } from "./evidence/files"
import { removeOrphanPrintoutFiles } from "./printouts/files"

const SWEEPS = [
  { run: removeOrphanPrintoutFiles, label: "Ausdrucke" },
  { run: removeOrphanEvidenceFiles, label: "Belege" },
] as const

/** räumt im Hintergrund auf; ins Log nur Zahlen und den Namen eines Fehlers */
export function sweepUploadsSoon(db: Db): void {
  void (async () => {
    for (const { run, label } of SWEEPS)
      try {
        const { removed, skipped } = await run(db)
        if (removed) console.warn(`${label}: ${removed} Dateien ohne Scheibe gelöscht`)
        if (skipped) console.warn(`${label}: keine Scheibe, Dateien bleiben`)
      } catch (error) {
        console.error(
          `${label} nicht aufgeräumt:`,
          error instanceof Error ? error.name : "unbekannter Fehler"
        )
      }
  })()
}
