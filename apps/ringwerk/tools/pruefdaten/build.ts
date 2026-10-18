// Prüfbestand für Ringwerk: frische Prüfdatenbank anlegen und migrieren, dann jede Zeile der Phasen-Matrix
// (`scenarios.ts`) als eigenen Wettbewerb mit erfundenen Daten aufbauen. Geschrieben wird über Ringwerks Server-Actions
// mit einer festen Sitzung (Stellvertreter für `next-auth` und `next/cache` unter `stubs/`), mit Zufall aus festem
// Startwert und einer Uhr, die nur der Aufbau weiterstellt. Zwei Läufe ergeben deshalb dieselben Daten; die
// Prüfsumme am Ende belegt das.
//
//   pnpm --filter ringwerk pruefdaten                    alles: Datenbank, Bestand, Prüfung, Prüfsumme
//   pnpm --filter ringwerk pruefdaten --nur-datenbank    nur die leere, migrierte Prüfdatenbank
//   pnpm --filter ringwerk pruefdaten --pruefsumme       nur Prüfung und Prüfsumme des vorhandenen Bestands
//   … --zeilen <ordner>                                 dazu die kanonischen Zeilen je Tabelle (zwei Läufe vergleichen)
//
// Die Passwörter der Prüfkonten stehen in `apps/ringwerk/.env` (`PRUEF_*`), fehlende erzeugt der erste Lauf.

import path from "node:path"

import { config } from "dotenv"

import { ensurePasswords, PRUEF_ACCOUNTS, PRUEF_PUBLIC_PASSWORD_ENV } from "./accounts"
import { tableChecksum } from "./checksum"
import { clockNow, installClock, setClock } from "./clock"
import {
  act,
  actAs,
  addDays,
  formData,
  type Actor,
  type Context,
  type PoolParticipant,
} from "./context"
import { migratePruefDatabase, pruefDatabaseUrl, recreatePruefDatabase } from "./db"
import { buildEvent } from "./event"
import { buildLeague } from "./league"
import { inventNames, LONG_NAMES, type PersonName } from "./names"
import { createRandom } from "./random"
import { loadRingwerk, type Ringwerk } from "./ringwerk"
import { SCENARIOS, type DisciplineKey } from "./scenarios"
import { buildSeason } from "./season"
import { verifyScenarios } from "./verify"

const out = (text = "") => process.stdout.write(`${text}\n`)

const ENV_FILE = path.resolve(__dirname, "../../.env")
const CLOCK_START = new Date("2026-01-05T08:00:00.000Z")
const POOL_SIZE = 40
const FORMER_COUNT = 3

/** Liest `apps/ringwerk/.env` in ein eigenes Objekt; `process.env` bleibt unberührt (dort steht die Dev-Datenbank). */
function readAppEnv(): Record<string, string | undefined> {
  const env: Record<string, string> = {}
  config({ path: ENV_FILE, processEnv: env, quiet: true })
  return { ...env, PRUEF_DATABASE_URL: process.env.PRUEF_DATABASE_URL ?? env.PRUEF_DATABASE_URL }
}

const ascii = (text: string) =>
  text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")

async function createPeople(
  ctx: Context,
  names: readonly PersonName[],
  withContact: boolean
): Promise<PoolParticipant[]> {
  const created: PoolParticipant[] = []
  for (const [i, name] of names.entries()) {
    await act(ctx, "Teilnehmer anlegen", () =>
      ctx.rw.createParticipant(
        null,
        formData({
          firstName: name.firstName,
          lastName: name.lastName,
          contact:
            withContact && i % 3 === 0
              ? `${ascii(name.firstName)}.${ascii(name.lastName)}@example.test`
              : undefined,
        })
      )
    )
    const row = await ctx.rw.db.participant.findFirstOrThrow({
      where: { firstName: name.firstName, lastName: name.lastName, isGuestRecord: false },
      select: { id: true },
    })
    created.push({ ...name, id: row.id })
  }
  return created
}

async function buildAll(rw: Ringwerk, appEnv: Record<string, string | undefined>): Promise<void> {
  const passwords = ensurePasswords(ENV_FILE, appEnv)
  installClock(CLOCK_START)

  // Erstes Konto wie beim ersten Start der App: runStartup legt Admin und Standarddisziplinen an.
  const [adminAccount, ...others] = PRUEF_ACCOUNTS
  process.env.SEED_ADMIN_EMAIL = adminAccount.email
  process.env.SEED_ADMIN_PASSWORD = passwords[adminAccount.env]
  await rw.runStartup()
  const admin = await rw.db.user.findUniqueOrThrow({
    where: { email: adminAccount.email },
    select: { id: true },
  })
  const ctx: Context = {
    rw,
    pool: [],
    formerPool: [],
    longNamePool: [],
    disciplines: {} as Record<DisciplineKey, string>,
    publicPassword: passwords[PRUEF_PUBLIC_PASSWORD_ENV],
    scenario: "Grundlage",
  }
  actAs({ id: admin.id, role: "ADMIN" })
  await act(ctx, "Admin benennen", () =>
    rw.updateUser(
      admin.id,
      null,
      formData({
        name: adminAccount.name,
        email: adminAccount.email,
        role: "ADMIN",
        isActive: "true",
      })
    )
  )
  for (const account of others) {
    await act(ctx, "Konto anlegen", () =>
      rw.createUser(
        null,
        formData({
          name: account.name,
          email: account.email,
          tempPassword: passwords[account.env],
          role: account.role,
        })
      )
    )
  }
  const manager = await rw.db.user.findUniqueOrThrow({
    where: { email: PRUEF_ACCOUNTS[1].email },
    select: { id: true },
  })
  const managerActor: Actor = { id: manager.id, role: "MANAGER" }
  actAs(managerActor)

  for (const discipline of [
    { name: "Zimmerstutzen", scoringType: "WHOLE", teilerFaktor: "1" },
    { name: "Luftgewehr Zehntel", scoringType: "DECIMAL", teilerFaktor: "1" },
  ]) {
    await act(ctx, "Disziplin anlegen", () => rw.createDiscipline(null, formData(discipline)))
  }
  for (const d of await rw.db.discipline.findMany({ select: { id: true, name: true } })) {
    ctx.disciplines[d.name as DisciplineKey] = d.id
  }

  const invented = inventNames(createRandom("pool"), POOL_SIZE + FORMER_COUNT)
  ctx.pool = await createPeople(ctx, invented.slice(0, POOL_SIZE), true)
  ctx.formerPool = await createPeople(ctx, invented.slice(POOL_SIZE), true)
  ctx.longNamePool = await createPeople(ctx, LONG_NAMES, false)

  for (const [i, scenario] of SCENARIOS.entries()) {
    ctx.scenario = scenario.name
    const start = addDays(CLOCK_START, 2 + i * 2)
    setClock(start)
    if (scenario.kind === "LEAGUE") await buildLeague(ctx, scenario, start)
    else if (scenario.kind === "EVENT") await buildEvent(ctx, scenario, start)
    else await buildSeason(ctx, scenario)
    out(`  ${scenario.name}`)
  }

  // Teilnehmer-Verwaltung mit inaktiven Einträgen: die ehemaligen Mitglieder, die nur im archivierten Event geschossen
  // haben. Wer in einem aktiven Wettbewerb eingeschrieben ist, darf laut Action nicht deaktiviert werden.
  ctx.scenario = "inaktive Teilnehmer"
  for (const person of ctx.formerPool) {
    await act(ctx, "Teilnehmer deaktivieren", () => rw.setParticipantActive(person.id, false))
  }
  out(`  Uhr am Ende: ${clockNow().toISOString()}`)
}

async function report(rw: Ringwerk, url: string, linesDir?: string): Promise<boolean> {
  const checks = await verifyScenarios(rw, SCENARIOS)
  const failed = checks.filter((c) => c.missing.length > 0)
  const inactive = await rw.db.participant.count({
    where: { isActive: false, isGuestRecord: false },
  })

  out()
  out(`Matrix: ${checks.length} Wettbewerbe, ${checks.length - failed.length} vollständig`)
  for (const check of failed) {
    out(`  FEHLT  ${check.scenario.name}: ${check.missing.join(", ")}`)
  }
  out(`Teilnehmer inaktiv: ${inactive} (erwartet ≥ ${FORMER_COUNT})`)

  const counts = await Promise.all([
    rw.db.competition.count(),
    rw.db.participant.count(),
    rw.db.matchup.count(),
    rw.db.series.count(),
    rw.db.playoffMatch.count(),
    rw.db.playoffDuel.count(),
    rw.db.auditLog.count(),
  ])
  out(
    `Zeilen: ${counts[0]} Wettbewerbe, ${counts[1]} Teilnehmer, ${counts[2]} Paarungen, ${counts[3]} Serien, ` +
      `${counts[4]} Playoff-Matches, ${counts[5]} Playoff-Duelle, ${counts[6]} Protokolleinträge`
  )

  const checksum = await tableChecksum(url, linesDir)
  out()
  out("Prüfsumme je Tabelle:")
  for (const t of checksum.tables)
    out(`  ${t.name.padEnd(24)} ${String(t.rows).padStart(6)}  ${t.hash.slice(0, 16)}`)
  out(`Prüfsumme gesamt: ${checksum.total}`)
  return failed.length === 0 && inactive >= FORMER_COUNT
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("pruefdaten nur in der Entwicklung")
  const args = process.argv.slice(2)
  const appEnv = readAppEnv()
  const url = pruefDatabaseUrl(appEnv)
  const name = new URL(url).pathname.slice(1)

  if (!args.includes("--pruefsumme")) {
    await recreatePruefDatabase(url)
    const migrations = await migratePruefDatabase(url)
    out(`Prüfdatenbank ${name} neu angelegt, ${migrations} Migrationen`)
    if (args.includes("--nur-datenbank")) return
  }

  const rw = await loadRingwerk(url)
  try {
    if (!args.includes("--pruefsumme")) {
      out(`Prüfbestand aufbauen (${SCENARIOS.length} Wettbewerbe):`)
      await buildAll(rw, appEnv)
    }
    const at = args.indexOf("--zeilen")
    const complete = await report(rw, url, at >= 0 ? args[at + 1] : undefined)
    if (!complete) process.exitCode = 1
  } finally {
    await rw.db.$disconnect()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  )
  process.exit(1)
})
