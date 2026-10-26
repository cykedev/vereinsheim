// Bericht zum Abgleich der Konten (ADR-033, Stufe 3) und Vorschlag der Zuordnung für die Übernahme Konto für Konto.
// Liest treffsicher.csv und spiegel.csv aus dem Verzeichnis (geschrieben von accounts.sh) und schreibt daneben
// konten-<Tag>.md und zuordnung-<Tag>.csv. Beide enthalten Namen und E-Mails und bleiben in reports/ (ADR-029); auf
// die Konsole gehen nur Zahlen.
//
//   tsx scripts/transfer/accounts-report.ts <Verzeichnis> <dev|prod>
import { readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { formatIsoDate } from "@vereinsheim/lib/format"

import {
  REASON_LABELS,
  formatMappingCsv,
  matchAccounts,
  parseMappingCsv,
  proposeMapping,
  spiegelAccountsFromCsv,
  treffsicherAccountsFromCsv,
  type AccountMatch,
  type SpiegelAccount,
  type TreffsicherAccount,
} from "../../src/lib/transfer/accountMatch"

const TIME_ZONE = "Europe/Berlin"

const [dir, source] = process.argv.slice(2)
if (!dir || (source !== "dev" && source !== "prod")) {
  process.stderr.write("Aufruf: accounts-report.ts <Verzeichnis> <dev|prod>\n")
  process.exit(1)
}

const treffsicherCsv = join(dir, "treffsicher.csv")
const treffsicher = treffsicherAccountsFromCsv(readFileSync(treffsicherCsv, "utf8"))
const spiegel = spiegelAccountsFromCsv(readFileSync(join(dir, "spiegel.csv"), "utf8"))
const day = formatIsoDate(statSync(treffsicherCsv).mtime, TIME_ZONE)
const match = matchAccounts(treffsicher, spiegel)

function cell(value: string | number | null): string {
  if (value === null || value === "") return "–"
  return String(value).replace(/\|/g, "\\|").replace(/\s+/g, " ")
}

function table(head: string[], rows: (string | number | null)[][]): string {
  const lines = [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`]
  for (const row of rows) lines.push(`| ${row.map(cell).join(" | ")} |`)
  return lines.join("\n")
}

const yesNo = (value: boolean) => (value ? "ja" : "nein")
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

function counts(): string {
  const activeT = treffsicher.filter((a) => a.isActive).length
  const activeS = spiegel.filter((a) => a.isActive).length
  return table(
    ["", "Anzahl"],
    [
      ["Konten Treffsicher, aktiv", activeT],
      ["Konten Treffsicher, inaktiv", treffsicher.length - activeT],
      ["Konten Spiegel, aktiv", activeS],
      ["Konten Spiegel, inaktiv", spiegel.length - activeS],
      ["Einheiten gesamt", sum(treffsicher.map((a) => a.sessions))],
      ["Einheiten mit Ergebnis", sum(treffsicher.map((a) => a.sessionsWithResult))],
      ["Favoriten: Konten", treffsicher.filter((a) => a.favourites > 0).length],
      ["Favoriten: Einheiten", sum(treffsicher.map((a) => a.favourites))],
      ["Eigene Disziplinen", sum(treffsicher.map((a) => a.ownDisciplines))],
      ["Ziele", sum(treffsicher.map((a) => a.goals))],
      ["Abläufe", sum(treffsicher.map((a) => a.routines))],
    ]
  )
}

// aktive mit Einheiten zuerst, dann nach Zahl der Einheiten
function missingOrder(a: TreffsicherAccount, b: TreffsicherAccount): number {
  const rank = (x: TreffsicherAccount) => (x.isActive && x.sessions > 0 ? 0 : 1)
  return rank(a) - rank(b) || b.sessions - a.sessions || a.email.localeCompare(b.email)
}

function missing(m: AccountMatch): string {
  if (m.onlyTreffsicher.length === 0) return "Keine."
  return table(
    ["Name", "E-Mail", "aktiv", "Einheiten", "letzte Einheit"],
    [...m.onlyTreffsicher]
      .sort(missingOrder)
      .map((a) => [a.name, a.email, yesNo(a.isActive), a.sessions, a.lastSession])
  )
}

function suspected(m: AccountMatch): string {
  if (m.suspected.length === 0) return "Keine."
  return table(
    [
      "Treffsicher: Name",
      "Treffsicher: E-Mail",
      "Einheiten",
      "Spiegel: Name",
      "Spiegel: E-Mail",
      "Scheiben",
      "Merkmal",
    ],
    m.suspected.flatMap((s) =>
      s.candidates.map((c) => [
        s.treffsicher.name,
        s.treffsicher.email,
        s.treffsicher.sessions,
        c.spiegel.name,
        c.spiegel.email,
        c.spiegel.cards,
        c.reasons.map((r) => REASON_LABELS[r]).join(", "),
      ])
    )
  )
}

function both(m: AccountMatch): string {
  const differing = m.both.filter((p) => p.differences.length > 0)
  const intro = `${m.both.length} Konten haben in beiden Apps dieselbe E-Mail.`
  if (differing.length === 0) return `${intro} Rolle und Aktiv-Status stimmen bei allen überein.`
  return [
    `${intro} Abweichend in Rolle oder Aktiv-Status:`,
    "",
    table(
      [
        "Name",
        "E-Mail",
        "Rolle Treffsicher",
        "Rolle Spiegel",
        "aktiv Treffsicher",
        "aktiv Spiegel",
      ],
      differing.map((p) => [
        p.treffsicher.name ?? p.spiegel.name,
        p.spiegel.email,
        p.treffsicher.role,
        p.spiegel.role,
        yesNo(p.treffsicher.isActive),
        yesNo(p.spiegel.isActive),
      ])
    ),
  ].join("\n")
}

function onlySpiegel(accounts: SpiegelAccount[]): string {
  return `${accounts.length} Konten gibt es nur in Spiegel, ohne Partner und ohne Verdacht.`
}

const sourceText = source === "dev" ? "Dev-Datenbank" : "Produktion"
const report = `# Abgleich der Konten Treffsicher ↔ Spiegel

Datenstand ${day}, Quelle: ${sourceText}. Der Bericht enthält Namen und E-Mails. Er bleibt in \`reports/\` und wird
nicht weitergegeben. Konten ordnen sich bei der Übernahme über die E-Mail zu (ADR-033, Stufe 3); der Vorschlag der
Zuordnung steht daneben in \`zuordnung-${day}.csv\`.

## 1. Zählungen

${counts()}

## 2. Für diese Konten fehlt ein Konto in Spiegel

${missing(match)}

## 3. Hier passt die E-Mail vermutlich nicht

${suspected(match)}

## 4. In beiden Apps

${both(match)}

## 5. Nur in Spiegel

${onlySpiegel(match.onlySpiegel)}
`

const reportPath = join(dir, `konten-${day}.md`)
const mappingPath = join(dir, `zuordnung-${day}.csv`)
writeFileSync(reportPath, report, { mode: 0o600 })
const mapping = proposeMapping(match)
writeFileSync(mappingPath, formatMappingCsv(mapping), { mode: 0o600 })

// Gegenprobe: jede Gruppe zusammen ergibt die Konten aus Treffsicher, und die Zuordnung liest sich zurück.
const grouped = match.both.length + match.suspected.length + match.onlyTreffsicher.length
if (grouped !== treffsicher.length) {
  throw new Error(`Gruppen ergeben ${grouped} statt ${treffsicher.length} Konten aus Treffsicher`)
}
const reread = parseMappingCsv(readFileSync(mappingPath, "utf8"))
if (reread.length !== mapping.length)
  throw new Error("Zuordnung liest sich nicht vollständig zurück")

process.stdout.write(
  [
    `Bericht: ${reportPath}`,
    `Zuordnung: ${mappingPath} (${mapping.length} Zeilen)`,
    `Treffsicher: ${treffsicher.length} Konten · in beiden: ${match.both.length} · Verdacht: ${match.suspected.length} · nur Treffsicher: ${match.onlyTreffsicher.length}`,
    `Spiegel: ${spiegel.length} Konten · nur Spiegel: ${match.onlySpiegel.length}`,
    `Einheiten: ${sum(treffsicher.map((a) => a.sessions))}`,
    "",
  ].join("\n")
)
