// Die Grenze zwischen Ergebnisteil und Tagebuch ([[adr-033]]) als reine Prüfung über die Quellen der App. Drei Zonen:
// das Tagebuch, die Nahtstellen (die beide Teile kennen dürfen) und der Ergebnisteil mit dem Admin. Der Test in
// `boundary.test.ts` legt sie über alle Dateien unter `src/`.

import { posix } from "node:path"

export type Zone = "diary" | "parts" | "admin" | "results"

/** die Zone einer Datei, Pfad relativ zur App mit „/“ (`src/diary/actions.ts`) */
export function zoneOf(file: string): Zone {
  if (file.startsWith("src/diary/") || file.startsWith("src/app/(app)/diary/")) return "diary"
  if (file.startsWith("src/parts/") || file === "src/instrumentation-node.ts") return "parts"
  if (
    file.startsWith("src/lib/admin/") ||
    file.startsWith("src/components/admin/") ||
    file.startsWith("src/app/(app)/admin/")
  )
    return "admin"
  return "results"
}

/**
 * Was das Tagebuch aus dem Ergebnisteil nehmen darf: die schmale Schnittstelle, Sitzung, Datenbank-Client, Typen,
 * Kontext der Seite, der Rahmen der App und die allgemeine Zeile eines Kastens. Pfade ohne Endung; ein Eintrag mit „/“
 * am Ende gilt für alles darunter.
 */
export const DIARY_MAY_IMPORT: readonly string[] = [
  "src/lib/results-read",
  "src/lib/auth-helpers",
  "src/lib/action-guards",
  "src/lib/db",
  "src/lib/types",
  "src/lib/page-context",
  "src/generated/prisma/",
  "src/components/shell/",
  "src/components/card/ActionRow",
]

/** Modelle des Ergebnisteils: Das Tagebuch greift auf keines über Prisma zu, es liest über die Schnittstelle */
const RESULT_MODELS =
  /\b(?:db|tx)\.(?:card|cardRevision|seriesSum|shot|cardProjection|cardEvidence|printout|rawRow|rawSnapshot|rawColumnSet|tombstone|deleteLock|cardRequest|sportpassConsent|discipline|family|familyScoring|ranking|source|site|bridge|bridgePairing|clockReading)\b/

/** dieselben Tabellen in rohem SQL (`$queryRaw`, `$executeRaw`): Postgres nennt sie in Anführungszeichen */
const RESULT_TABLES =
  /"(?:Card|CardRevision|SeriesSum|Shot|CardProjection|CardEvidence|Printout|RawRow|RawSnapshot|RawColumnSet|Tombstone|DeleteLock|CardRequest|SportpassConsent|Discipline|Family|FamilyScoring|Ranking|Source|Site|Bridge|BridgePairing|ClockReading)"/

const IMPORT =
  /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|^\s*import\s*["']([^"']+)["']/gm

/** die Module, die eine Quelle importiert, aufgelöst auf Pfade der App ohne Endung; Pakete bleiben außen vor */
export function importsOf(file: string, source: string): string[] {
  const found: string[] = []
  for (const match of source.matchAll(IMPORT)) {
    const spec = match[1] ?? match[2] ?? match[3]
    if (!spec) continue
    let path: string
    if (spec.startsWith("@/")) path = `src/${spec.slice(2)}`
    else if (spec.startsWith(".")) path = posix.normalize(posix.join(posix.dirname(file), spec))
    else continue
    found.push(path.replace(/\.(?:tsx?|mjs|js)$/, ""))
  }
  return found
}

const allowedForDiary = (path: string) =>
  DIARY_MAY_IMPORT.some((allowed) =>
    allowed.endsWith("/") ? path.startsWith(allowed) : path === allowed
  )

const isTest = (file: string) => /\.test\.tsx?$/.test(file)

/**
 * Alle Verstöße gegen die Grenze, je als lesbare Zeile:
 * - Ergebnisteil und Admin importieren nichts aus dem Tagebuch (nur die Nahtstellen dürfen),
 * - der Admin importiert keine Nahtstelle (er sieht vom Tagebuch nichts),
 * - das Tagebuch importiert aus dem Ergebnisteil nur `DIARY_MAY_IMPORT` und greift auf kein Modell des Ergebnisteils
 *   zu, weder über Prisma noch in rohem SQL. Tests des Tagebuchs dürfen Scheiben anlegen, um etwas zu prüfen.
 */
export function boundaryViolations(files: readonly { file: string; source: string }[]): string[] {
  const violations: string[] = []
  for (const { file, source } of files) {
    const zone = zoneOf(file)
    for (const path of importsOf(file, source)) {
      const target = zoneOf(`${path}.ts`)
      if ((zone === "results" || zone === "admin") && target === "diary")
        violations.push(`${file}: importiert das Tagebuch (${path})`)
      if (zone === "admin" && target === "parts")
        violations.push(`${file}: Admin importiert eine Nahtstelle (${path})`)
      if (zone === "diary" && !isTest(file) && target !== "diary" && !allowedForDiary(path))
        violations.push(`${file}: Tagebuch importiert aus dem Ergebnisteil (${path})`)
    }
    if (
      zone === "diary" &&
      !isTest(file) &&
      (RESULT_MODELS.test(source) || RESULT_TABLES.test(source))
    )
      violations.push(`${file}: Tagebuch greift auf ein Modell des Ergebnisteils zu`)
  }
  return violations
}
