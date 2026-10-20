// Durchsicht nach drei Ebenen (spiegel-durchsicht) am Prüfbestand: jede Seite jedes Wettbewerbs am Telefon (390 × 844)
// als Mitglied und als Sportleitung messen. Liest nur; die Prüfdatenbank baut vorher `pnpm --filter ringwerk pruefdaten`.
// Nicht im Gate (braucht Chrome, den Dev-Postgres und einen Build).
//
//   pnpm --filter ringwerk build && pnpm --filter ringwerk durchsicht
//
// Ergebnis unter reports/durchsicht/ringwerk/ (lokal): je Seite die Messung und ein Bild des ersten Bildschirms.

import { randomBytes } from "node:crypto"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

import { config } from "dotenv"

import { Browser, type Page } from "@vereinsheim/pruefen/browser"
import { measurePage, measureTable, type PageMeasure } from "@vereinsheim/pruefen/measure"
import { startServer } from "@vereinsheim/pruefen/server"

import { PRUEF_ACCOUNTS } from "./pruefdaten/accounts"
import { pruefDatabaseUrl } from "./pruefdaten/db"
import { login } from "./pruefen-ringwerk/capture"
import { readInventory } from "./pruefen-ringwerk/targets"

const APP_DIR = path.resolve(__dirname, "..")
const OUT_DIR = path.resolve(APP_DIR, "../../reports/durchsicht/ringwerk")
const PORT = 3010
const BASE = `http://localhost:${PORT}`
/** Fachbegriffe, die Leser ohne Erklärung nicht verstehen (Ringwerk kennt Ringteiler und Teiler als Wertung) */
const JARGON =
  "RT\\b|Best\\. RT|korr\\.|Faktor|Satzdifferenz|Direktvergleich|Stechschuss|Verl\\.|Kampfl\\.|Zur\\.|Abg\\.|Sp\\.\\b|Pkt\\."
const PAGES = [
  "",
  "schedule",
  "standings",
  "ranking",
  "playoffs",
  "participants",
  "series",
] as const
const ROLES = [
  { key: "mitglied", role: "USER" },
  { key: "sportleitung", role: "MANAGER" },
] as const

type Row = { page: string } & PageMeasure

const out = (text = "") => process.stdout.write(`${text}\n`)

async function measureAt(
  page: Page,
  url: string,
  expectPath: string | null
): Promise<PageMeasure | null> {
  await page.goto(url, '$("[data-app-frame]") ?? $("form")', { settle: 300 })
  const at = await page.ev<string>("location.pathname")
  if (expectPath && at !== expectPath) return null
  return measurePage(page, JARGON)
}

async function main() {
  const env: Record<string, string> = {}
  config({ path: path.join(APP_DIR, ".env"), processEnv: env, quiet: true })
  const url = pruefDatabaseUrl(env)
  const inventory = await readInventory(url)
  out(`Datenbank ${inventory.database}: ${inventory.competitions.length} Wettbewerbe`)
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })

  process.env.DATABASE_URL = url
  const server = await startServer({
    app: "ringwerk",
    port: PORT,
    hostname: "127.0.0.1",
    secret: randomBytes(32).toString("hex"),
    out,
  })
  const browser = await Browser.launch()
  const sections: string[] = []
  try {
    for (const { key, role } of ROLES) {
      const account = PRUEF_ACCOUNTS.find((a) => a.role === role)!
      const password = env[account.env]
      if (!password) throw new Error(`${account.env} fehlt in apps/ringwerk/.env: erst pruefdaten`)
      const page = await browser.newPage()
      await login(page, BASE, { email: account.email, password })
      await page.viewport(390, 844)
      const rows: Row[] = []
      for (const global of ["/", "/competitions"]) {
        const m = await measureAt(page, `${BASE}${global}`, global)
        if (m) rows.push({ page: global, ...m })
        writeFileSync(
          path.join(OUT_DIR, `${key}${global.replace(/\//g, "_") || "_start"}.png`),
          await page.screenshot()
        )
      }
      for (const c of inventory.competitions) {
        for (const sub of PAGES) {
          const target = `/competitions/${c.id}${sub ? `/${sub}` : ""}`
          // die Seite ohne Unterseite leitet auf die Hauptansicht der Art um: gemessen wird, wohin sie führt
          const m = await measureAt(page, `${BASE}${target}`, sub ? target : null)
          if (!m) continue
          const landed = sub || (await page.ev<string>("location.pathname")).split("/").pop()!
          rows.push({ page: `${c.name} · ${landed}${sub ? "" : " (Einstieg)"}`, ...m })
          if (!sub)
            writeFileSync(path.join(OUT_DIR, `${key}_${c.key}.png`), await page.screenshot())
        }
      }
      await page.close()
      sections.push(
        `## ${key === "mitglied" ? "Mitglied" : "Sportleitung"}\n\n${measureTable(rows)}`
      )
      writeFileSync(path.join(OUT_DIR, `${key}.json`), JSON.stringify(rows, null, 2))
      out(`${key}: ${rows.length} Seiten gemessen`)
    }
  } finally {
    await browser.close()
    server.kill()
  }
  writeFileSync(
    path.join(OUT_DIR, "durchsicht.md"),
    `# Durchsicht Ringwerk am Prüfbestand (390 × 844)\n\n${sections.join("\n\n")}\n`
  )
  out(`Bericht: ${path.relative(process.cwd(), path.join(OUT_DIR, "durchsicht.md"))}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
