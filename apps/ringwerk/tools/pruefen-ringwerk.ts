// Abgleich von Ringwerk vor und nach einer Änderung der Oberfläche (ADR-032): Seiten, Brackets und PDFs des
// Prüfbestands aufnehmen und mit dem Ausgangsstand vergleichen, Abläufe über die Oberfläche mit Prüfung der Datenbank.
// Läuft gegen den gebauten Stand dieses Checkouts (`pnpm --filter ringwerk build`) auf eigenem Port, nur auf diesem
// Rechner erreichbar (127.0.0.1); nicht im Gate.
//
//   pnpm --filter ringwerk pruefdaten                frische Prüfdatenbank (vor Aufnahme und Vergleich)
//   pnpm --filter ringwerk pruefen:aufnehmen         Ausgangsstand nach tools/pruefdaten/referenz/, Bilder nach reports/
//   pnpm --filter ringwerk pruefen:vergleichen       neu aufnehmen und vergleichen; Bericht unter reports/
//   pnpm --filter ringwerk pruefen:ablaeufe          Abläufe am Telefon und am Desktop (baut die Prüfdatenbank neu)
//   … --echt                                         gegen die Dev-Datenbank (Kopie der echten Daten), nur lesend,
//                                                    alles nur unter reports/ringwerk-echt/
//   … --gegenprobe                                   (mit --vergleichen) zwei Tabellenzeilen vertauschen: muss rot sein
//   … --referenz <ordner>                            Ausgangsstand in einem eigenen Ordner statt referenz/ (etwa den alten
//                                                    Stand auf demselben Aufbau aufnehmen, dann den neuen vergleichen)
//   … --nur <wort>                                   nur Wettbewerbe, deren Schlüssel das Wort enthält (nicht mit
//                                                    --aufnehmen: der Ausgangsstand ist immer vollständig)

import { execSync } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

import { config } from "dotenv"

import { startServer } from "@vereinsheim/pruefen/server"

import { PRUEF_ACCOUNTS, PRUEF_PUBLIC_PASSWORD_ENV } from "./pruefdaten/accounts"
import { pruefDatabaseUrl } from "./pruefdaten/db"
import { runFlows } from "./pruefen-ringwerk/ablaeufe"
import { bestandChecksum, buildId } from "./pruefen-ringwerk/bestand"
import { captureAll, type Credentials, type SignIn } from "./pruefen-ringwerk/capture"
import { compareAll, swapTableRows } from "./pruefen-ringwerk/compare"
import {
  changedTables,
  echtAccounts,
  echtDatabaseUrl,
  sessionToken,
  tableFingerprint,
} from "./pruefen-ringwerk/echt"
import { phaseCounts, phaseReport } from "./pruefen-ringwerk/phases"
import { findingsMarkdown, writeSideBySide } from "./pruefen-ringwerk/report"
import { readStore, writeStore } from "./pruefen-ringwerk/store"
import { readInventory, type Role } from "./pruefen-ringwerk/targets"

const out = (text = "") => process.stdout.write(`${text}\n`)
const args = process.argv.slice(2)
const has = (flag: string) => args.includes(flag)
const option = (flag: string) => {
  const at = args.indexOf(flag)
  return at >= 0 ? args[at + 1] : undefined
}

const APP_DIR = path.resolve(__dirname, "..")
const REPORTS = path.resolve(APP_DIR, "../../reports")
const ECHT = has("--echt")
/**
 * `--referenz <ordner>` (relativ zur Wurzel des Repos, etwa `reports/ringwerk-alt`): Aufnahme und Vergleich gegen einen
 * eigenen Ordner, etwa den alten Stand auf demselben Aufbau
 */
const OWN_REFERENCE = option("--referenz")
const REFERENCE = OWN_REFERENCE
  ? // relativ zur Wurzel des Repos: `pnpm --filter` startet im Ordner der App
    path.resolve(APP_DIR, "../..", OWN_REFERENCE)
  : ECHT
    ? path.join(REPORTS, "ringwerk-echt", "referenz")
    : path.join(APP_DIR, "tools", "pruefdaten", "referenz")
const REFERENCE_IMAGES = OWN_REFERENCE
  ? path.join(REFERENCE, "bilder")
  : path.join(REPORTS, ECHT ? "ringwerk-echt" : "ringwerk-referenz", "bilder")
const PORT = 3010
const BASE = `http://localhost:${PORT}`
/** Secret des eigenen Servers: Mit ihm stellt `--echt` die Sitzungen aus */
const SECRET = randomBytes(32).toString("hex")

function readAppEnv(): Record<string, string | undefined> {
  const env: Record<string, string> = {}
  config({ path: path.join(APP_DIR, ".env"), processEnv: env, quiet: true })
  return env
}

/** ein Wert für alle Fingerabdrücke der Tabellen: Gleich heißt, die Daten sind dieselben wie bei der Aufnahme */
const digest = (prints: Map<string, string>) =>
  createHash("sha256")
    .update([...prints].map(([t, p]) => `${t}=${p}`).join("\n"))
    .digest("hex")

const commit = () => execSync("git rev-parse --short HEAD", { cwd: APP_DIR }).toString().trim()

async function withServer<T>(url: string, run: () => Promise<T>): Promise<T> {
  process.env.DATABASE_URL = url
  const server = await startServer({
    app: "ringwerk",
    port: PORT,
    hostname: "127.0.0.1",
    secret: SECRET,
    out,
  })
  try {
    return await run()
  } finally {
    server.kill()
  }
}

/** Sitzungen an der Kopie der echten Daten: ausgestellt für das älteste aktive Konto je Rolle (`echt.ts`) */
async function echtSessions(url: string): Promise<Partial<Record<Role, SignIn>>> {
  const sessions: Partial<Record<Role, SignIn>> = {}
  for (const account of await echtAccounts(url))
    sessions[account.role] = { token: await sessionToken(account, SECRET) }
  if (!sessions.ADMIN) throw new Error("kein aktives Admin-Konto in der Dev-Datenbank")
  if (!sessions.USER) out("Hinweis: kein aktives Mitgliedskonto, aufgenommen nur als Admin")
  return sessions
}

/** Anmeldedaten im Prüfbestand: die Prüfkonten aus `.env` */
function pruefCredentials(env: Record<string, string | undefined>): Record<Role, Credentials> {
  const pick = (role: Role) => {
    const account = PRUEF_ACCOUNTS.find((a) => a.role === role)!
    const password = env[account.env]
    if (!password) throw new Error(`${account.env} fehlt in apps/ringwerk/.env: erst pruefdaten`)
    return { email: account.email, password }
  }
  return { ADMIN: pick("ADMIN"), USER: pick("USER") }
}

async function capture(url: string, env: Record<string, string | undefined>, imageDir: string) {
  const inventory = await readInventory(url)
  out(`Datenbank ${inventory.database}: ${inventory.competitions.length} Wettbewerbe`)
  const prints = ECHT ? await tableFingerprint(url) : null
  // Prüfbestand: Prüfsumme über alle Tabellen; echte Daten: ein Wert aus den Fingerabdrücken (ohne Inhalt)
  const checksum = prints ? digest(prints) : await bestandChecksum(url)
  rmSync(imageDir, { recursive: true, force: true })
  const recordings = await withServer(url, async () =>
    captureAll({
      base: BASE,
      inventory,
      sessions: ECHT ? await echtSessions(url) : pruefCredentials(env),
      publicPassword: ECHT ? null : (env[PRUEF_PUBLIC_PASSWORD_ENV] ?? null),
      imageDir,
      only: option("--nur"),
      out,
    })
  )
  // Die Aufnahme liest nur; ändert sich der Bestand dabei, stimmt der Ausgangsstand nicht
  if (prints) {
    const changed = changedTables(prints, await tableFingerprint(url))
    if (changed.length > 0)
      throw new Error(`Die Dev-Datenbank hat sich geändert: ${changed.join(", ")}`)
    out("Dev-Datenbank unverändert (jede Tabelle, Disziplinen ohne updatedAt)")
  }
  if (!prints) {
    const after = await bestandChecksum(url)
    if (after !== checksum)
      throw new Error("Die Prüfdatenbank hat sich während der Aufnahme geändert")
  }
  return { inventory, checksum, recordings }
}

async function aufnehmen(url: string, env: Record<string, string | undefined>) {
  const { inventory, checksum, recordings } = await capture(url, env, REFERENCE_IMAGES)
  writeStore(
    REFERENCE,
    {
      checksum,
      build: ECHT ? undefined : await buildId(url),
      database: inventory.database,
      commit: commit(),
      competitions: recordings.size - 1,
    },
    recordings
  )
  out(`Ausgangsstand: ${recordings.size} Dateien unter ${path.relative(process.cwd(), REFERENCE)}`)
  out(`Bilder unter ${path.relative(process.cwd(), REFERENCE_IMAGES)}`)
  if (ECHT) {
    const file = path.join(REPORTS, "ringwerk-echt", "phasen.md")
    writeFileSync(
      file,
      phaseReport(await phaseCounts(url), await phaseCounts(pruefDatabaseUrl(env)))
    )
    out(`Phasen: ${path.relative(process.cwd(), file)}`)
  }
}

/** vergleicht mit dem Ausgangsstand; mit `--gegenprobe` ist das Ergebnis, ob genau die vertauschte Seite rot ist */
async function vergleichen(url: string, env: Record<string, string | undefined>): Promise<boolean> {
  const { meta, recordings: before } = readStore(REFERENCE)
  if (meta.checksum) {
    const now = ECHT ? digest(await tableFingerprint(url)) : await bestandChecksum(url)
    if (now !== meta.checksum)
      throw new Error(
        ECHT
          ? "Die Dev-Datenbank ist nicht die der Aufnahme (dev-restore dazwischen?): erst --aufnehmen --echt auf dem alten Stand"
          : `Der Prüfbestand ist nicht der des Ausgangsstands (Prüfsumme ${now.slice(0, 12)} statt ${meta.checksum.slice(0, 12)}): erst pnpm --filter ringwerk pruefdaten`
      )
  }
  const otherBuild = !ECHT && meta.build !== undefined && meta.build !== (await buildId(url))
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const dir = path.join(REPORTS, ECHT ? "ringwerk-echt" : "ringwerk-vergleich", stamp)
  const { inventory, recordings: after } = await capture(url, env, path.join(dir, "bilder"))
  if (option("--nur")) for (const key of [...before.keys()]) if (!after.has(key)) before.delete(key)
  const swapped = has("--gegenprobe") ? swapTableRows(after) : null
  if (has("--gegenprobe"))
    out(
      swapped
        ? `Gegenprobe: zwei Zeilen vertauscht in ${swapped.key}, ${swapped.page}`
        : "Gegenprobe: keine Tabelle gefunden"
    )
  const findings = compareAll(before, after, inventory.names)
  mkdirSync(dir, { recursive: true })
  // die neue Aufnahme neben dem Bericht, um eine Abweichung Zeile für Zeile anzusehen
  writeStore(
    path.join(dir, "aufnahme"),
    {
      checksum: null,
      database: inventory.database,
      commit: commit(),
      competitions: after.size - 1,
    },
    after
  )
  writeFileSync(path.join(dir, "befund.md"), findingsMarkdown(findings))
  const images = writeSideBySide(
    path.join(dir, "vorher-nachher.html"),
    REFERENCE_IMAGES,
    path.join(dir, "bilder"),
    findings,
    option("--nur") !== undefined
  )
  const errors = findings.filter((f) => f.severity === "fehler")
  out()
  out(
    `Vergleich mit Stand ${meta.commit}: ${errors.length} Fehler, ${findings.length - errors.length} Hinweise`
  )
  if (otherBuild && errors.length > 0)
    out(
      "Hinweis: anderer Aufbau des Prüfbestands als bei der Aufnahme. Ringwerk ordnet gleiche Nachnamen und die Plätze im Bracket nicht eindeutig; solche Fehler können Vertauschungen bei Gleichstand sein. Eindeutig ist der Vergleich auf demselben Aufbau."
    )
  for (const f of errors.slice(0, 20)) out(`  FEHLER  ${f.where}: ${f.what}`)
  if (errors.length > 20) out(`  … ${errors.length - 20} weitere in befund.md`)
  out(
    `Bilder: ${images.changed} Seiten geändert, ${images.changedPdf} PDF-Seiten anders, ${images.same} gleich`
  )
  out(`Bericht: ${path.relative(process.cwd(), dir)}/befund.md und vorher-nachher.html`)
  if (has("--gegenprobe")) {
    const name = swapped ? after.get(swapped.key)?.name : undefined
    const caught = errors.some((f) => f.where === name && f.what.startsWith(`${swapped?.page}:`))
    out(
      caught
        ? "Gegenprobe: die vertauschte Seite ist rot"
        : "Gegenprobe: die vertauschte Seite ist NICHT rot"
    )
    return caught
  }
  return errors.length === 0
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("nur in der Entwicklung")
  const env = readAppEnv()
  const url = ECHT ? echtDatabaseUrl(env) : pruefDatabaseUrl(env)
  if (!existsSync(path.join(APP_DIR, ".next", "BUILD_ID")))
    throw new Error("kein Build: erst pnpm --filter ringwerk build")
  if (has("--aufnehmen")) {
    if (option("--nur")) throw new Error("--aufnehmen nimmt immer alles auf, ohne --nur")
    await aufnehmen(url, env)
  } else if (has("--vergleichen")) {
    if (!(await vergleichen(url, env))) process.exitCode = 1
  } else if (has("--ablaeufe")) {
    if (ECHT) throw new Error("--ablaeufe schreibt und läuft nur auf der Prüfdatenbank")
    const ok = await runFlows({
      url,
      env,
      base: BASE,
      withServer,
      reports: REPORTS,
      only: option("--nur"),
      out,
    })
    if (!ok) process.exitCode = 1
  } else {
    out(
      "Aufruf: --aufnehmen | --vergleichen [--gegenprobe] | --ablaeufe, dazu --echt, --nur <wort>"
    )
    process.exitCode = 2
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  )
  process.exit(1)
})
