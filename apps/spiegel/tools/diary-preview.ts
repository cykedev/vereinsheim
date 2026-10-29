// Vorschau des Tagebuchs mit den Daten eines Kontos aus Treffsicher ([[spiegel-diary]], Auswertung), nur gegen die
// lokale Dev-Datenbank. Liest das Konto über `psql` im Dev-Container (ADR-002: keine Verbindung der App zur fremden
// Datenbank), ohne die Daten zu speichern, und schreibt Scheiben „aus Treffsicher“ und Einträge mit den Schlüsseln der
// Vorschau (`src/parts/transfer/diary-preview.ts`). Ausgabe und Bericht nur mit Zahlen; E-Mails nur auf der Kommandozeile.
//
//   pnpm --filter spiegel diary-preview --from <E-Mail in Treffsicher> --to <E-Mail in Spiegel> [--dry-run]
//   pnpm --filter spiegel diary-preview --delete --to <E-Mail in Spiegel>

import "dotenv/config"

import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { requestSiteId } from "../src/lib/card-requests/queries"
import { createPrismaClient } from "../src/lib/db"
import {
  deletePreview,
  runPreview,
  treffsicherExport,
  type PreviewReport,
} from "../src/parts/transfer/diary-preview"
import { DEV_DATABASE_URL } from "../test/dev-database"
import { assertDevDatabase } from "./dev-guard"

const ROOT = join(__dirname, "../../..")
const CALL = [
  "Aufruf:",
  "  pnpm --filter spiegel diary-preview --from <E-Mail in Treffsicher> --to <E-Mail in Spiegel> [--dry-run]",
  "  pnpm --filter spiegel diary-preview --delete --to <E-Mail in Spiegel>",
].join("\n")

/** die Argumente; null, wenn der Aufruf nicht passt */
function argsOf(argv: readonly string[]) {
  const value = (flag: string) => {
    const at = argv.indexOf(flag)
    const next = at === -1 ? undefined : argv[at + 1]
    return next && !next.startsWith("--") ? next : null
  }
  const to = value("--to")
  const from = value("--from")
  const remove = argv.includes("--delete")
  if (!to || (remove && from) || (!remove && !from)) return null
  return { from, to, remove, dryRun: argv.includes("--dry-run") }
}

/** das Konto aus Treffsicher als JSON, über `psql` im Dev-Container; null ohne Treffer */
function readTreffsicher(email: string): unknown {
  const out = execFileSync(
    "docker",
    [
      "compose",
      "-f",
      join(ROOT, "docker-compose.dev.yml"),
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "postgres",
      "-d",
      "treffsicher",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      `from=${email}`,
    ],
    {
      input: readFileSync(join(__dirname, "transfer/treffsicher-sessions.sql")),
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    }
  ).trim()
  return out ? JSON.parse(out) : null
}

const lines = (record: Record<string, number>) =>
  Object.entries(record).map(([key, n]) => `  ${key}: ${n}`)

/** der Bericht in Zeilen, nur Zahlen und Namen von Disziplinen */
function reportLines(report: PreviewReport, mode: string): string[] {
  return [
    `# Vorschau des Tagebuchs (${mode})`,
    "",
    `Einheiten: ${report.sessions}`,
    `Einträge angelegt: ${report.entries.created}, geändert: ${report.entries.updated}, gelöscht: ${report.entries.deleted}`,
    "Scheiben angelegt je Detailtiefe:",
    ...lines(report.cards.created),
    "Scheiben ersetzt je Detailtiefe:",
    ...lines(report.cards.replaced),
    "Scheiben unverändert je Detailtiefe:",
    ...lines(report.cards.unchanged),
    `Scheiben entfernt: ${report.cards.removed}`,
    "Einheiten ohne neue Scheibe:",
    ...lines(report.withoutCard),
    `Ausführung gelegt: ${report.executions.placed} Einträge, ${report.executions.series} Serien`,
    "Ausführung ausgelassen:",
    ...lines(report.executions.skipped),
    `Probeserien mit Bewertung ausgelassen: ${report.executions.practiceSkipped}`,
    "Disziplinen ohne Familie:",
    ...lines(report.unmatchedDisciplines),
    `Ziele gelöscht: ${report.goals}, Abläufe gelöscht: ${report.routines}`,
    `Tagebuch des Kontos: ${report.diaryEnabled ? "an" : "aus"}`,
  ]
}

async function main() {
  const args = argsOf(process.argv.slice(2))
  if (!args) {
    process.stderr.write(`${CALL}\n`)
    process.exitCode = 2
    return
  }
  const url = process.env.DATABASE_URL ?? DEV_DATABASE_URL
  assertDevDatabase(url, false)
  const db = createPrismaClient(url)
  try {
    const raw = args.remove ? null : readTreffsicher(args.from!)
    if (!args.remove && raw === null) throw new Error("Konto in Treffsicher nicht gefunden")
    const user = await db.user.findUnique({ where: { email: args.to }, select: { id: true } })
    if (!user) throw new Error("Konto in Spiegel nicht gefunden")
    let report: PreviewReport
    let mode: string
    if (args.remove) {
      report = await deletePreview(db, user.id)
      mode = "gelöscht"
    } else {
      const siteId = await requestSiteId(db)
      const site =
        siteId === null
          ? null
          : await db.site.findUnique({ where: { id: siteId }, select: { timeZone: true } })
      report = await runPreview(db, {
        export: treffsicherExport.parse(raw),
        toUserId: user.id,
        timeZone: site?.timeZone ?? "Europe/Berlin",
        dryRun: args.dryRun,
      })
      mode = args.dryRun ? "Probelauf, nichts geschrieben" : "geschrieben"
    }
    const text = `${reportLines(report, mode).join("\n")}\n`
    process.stdout.write(text)
    const dir = join(ROOT, "reports/tis-2c")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "diary-preview.md"), text)
  } finally {
    await db.$disconnect()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
