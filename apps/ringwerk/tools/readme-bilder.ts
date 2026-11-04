// Bilder für die README aus dem Prüfbestand (erfundene Namen, ADR-029): der gebaute Stand dieses Checkouts auf :3013
// gegen `ringwerk_pruef`, angemeldet als Mitglied des Prüfbestands (ohne Knöpfe der Sportleitung), als WebP nach `docs/screenshots/`. Der Prüfbestand
// nennt Wettbewerbe nach ihrem Fall; für das Bild bekommt die Überschrift `main h1` einen Vereinsnamen. Das öffentliche
// PDF trägt den Namen des Falls im Kopf und kommt deshalb nicht ins Bild. Nicht im Gate.
//
//   pnpm --filter ringwerk pruefdaten          Prüfdatenbank (einmal vorher)
//   pnpm --filter ringwerk build               der Stand, der fotografiert wird
//   pnpm --filter ringwerk readme-bilder       schreibt docs/screenshots/ringwerk-*.webp

import type { ChildProcess } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { config } from "dotenv"
import { Client } from "pg"

import { Browser, type Page } from "@vereinsheim/pruefen/browser"
import { startServer } from "@vereinsheim/pruefen/server"

import { PRUEF_ACCOUNTS } from "./pruefdaten/accounts"
import { pruefDatabaseUrl } from "./pruefdaten/db"
import { BRACKET_LOCATOR } from "./pruefen-bilder"
import { login } from "./pruefen-ringwerk/capture"

const PORT = 3013
const BASE = `http://localhost:${PORT}`
const APP_DIR = path.resolve(__dirname, "..")
const OUT = path.resolve(APP_DIR, "../../docs/screenshots")
const THEME_KEY = "ringwerk-theme"
const QUALITY = 88
/** die Überschrift im Bild statt des Namens des Falls im Prüfbestand (beide Ligen schießen Luftgewehr) */
const TITLE = "Vereinsliga Luftgewehr 2026/27"
/** eine Liga in der Rückrunde: Tabelle und Spielplan unter „Spielplan & Tabelle“ */
const STANDINGS = "L-DRR-6 · L3 Rückrunde läuft (Hin/Rück)"
/** eine Liga mit 16 Teilnehmern im Achtelfinale: der Turnierbaum */
const PLAYOFFS = "L-DRR-16 · L5 Achtelfinale mitten in der Runde (Hin/Rück)"

const PHONE = [390, 844] as const
const DESKTOP = [1280, 900] as const

interface Shot {
  /** Dateiname ohne Endung, `ringwerk-…` */
  name: string
  path: string
  width: 1280 | 390
  theme: "light" | "dark"
  /** die Überschrift der Seite im Bild ersetzen */
  title?: string
  /** dazu dieses Element allein, unter diesem Namen */
  part?: { name: string; locator: string }
}

interface Competition {
  id: string
  name: string
}

const out = (text = "") => process.stdout.write(`${text}\n`)

/** Wettbewerbe des Prüfbestands nach Namen; nur lesend */
async function competitions(url: string, names: string[]): Promise<Map<string, Competition>> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const { rows } = await client.query<Competition>(
      `SELECT id, name FROM "Competition" WHERE name = ANY($1)`,
      [names]
    )
    const byName = new Map(rows.map((r) => [r.name, r]))
    const missing = names.filter((n) => !byName.has(n))
    if (missing.length > 0)
      throw new Error(`nicht im Prüfbestand: ${missing.join(", ")} (erst pruefdaten)`)
    return byName
  } finally {
    await client.end()
  }
}

const shots = (standings: string, playoffs: string): Shot[] => [
  {
    name: "ringwerk-standings",
    path: `/competitions/${standings}/schedule`,
    width: 1280,
    theme: "light",
    title: TITLE,
  },
  {
    name: "ringwerk-schedule-phone",
    path: `/competitions/${standings}/schedule`,
    width: 390,
    theme: "light",
    title: TITLE,
  },
  {
    name: "ringwerk-playoffs",
    path: `/competitions/${playoffs}/playoffs`,
    width: 1280,
    theme: "dark",
    title: TITLE,
    part: { name: "ringwerk-bracket", locator: BRACKET_LOCATOR },
  },
]

/** Darstellung über den Schlüssel der App auf einer geladenen Seite, dann die Adresse fotografieren */
async function take(page: Page, shot: Shot) {
  const [width, height] = shot.width === 390 ? PHONE : DESKTOP
  await page.viewport(width, height)
  await page.goto(`${BASE}/profile`)
  await page.ev(`localStorage.setItem(${JSON.stringify(THEME_KEY)}, ${JSON.stringify(shot.theme)})`)
  await page.goto(`${BASE}${shot.path}`, '$("main")')
  await page.wait(800)
  if (shot.title) {
    const found = await page.ev<boolean>(
      `(() => { const h = $("main h1"); if (h) h.textContent = ${JSON.stringify(shot.title)}; return !!h })()`
    )
    if (!found) throw new Error(`${shot.name}: keine Überschrift main h1 auf ${shot.path}`)
  }
  const image = await page.screenshot(false, "webp", QUALITY)
  await writeFile(path.join(OUT, `${shot.name}.webp`), image)
  out(`  ${shot.name}.webp  ${shot.width} px ${shot.theme}  ${Math.round(image.length / 1024)} KB`)
  if (shot.part) {
    const part = await page.screenshotOf(shot.part.locator, "webp", QUALITY)
    if (!part) throw new Error(`${shot.part.name}: Element nicht gefunden auf ${shot.path}`)
    await writeFile(path.join(OUT, `${shot.part.name}.webp`), part)
    out(`  ${shot.part.name}.webp  ${Math.round(part.length / 1024)} KB`)
  }
}

async function main() {
  let server: ChildProcess | null = null
  let browser: Browser | null = null
  // höchstens fünf Minuten; hängt etwas, endet der Lauf hart mit 1
  const guard = setTimeout(() => {
    out("Zeit überschritten (5 min)")
    server?.kill()
    void browser?.close()
    setTimeout(() => process.exit(1), 3_000).unref()
  }, 300_000)
  try {
    const env: Record<string, string | undefined> = {}
    config({
      path: path.join(APP_DIR, ".env"),
      processEnv: env as Record<string, string>,
      quiet: true,
    })
    const url = pruefDatabaseUrl(env)
    const byName = await competitions(url, [STANDINGS, PLAYOFFS])
    const member = PRUEF_ACCOUNTS.find((a) => a.role === "USER")!
    const password = env[member.env]
    if (!password) throw new Error(`${member.env} fehlt in apps/ringwerk/.env: erst pruefdaten`)
    process.env.DATABASE_URL = url
    server = await startServer({ app: "ringwerk", port: PORT, hostname: "127.0.0.1", out })
    browser = await Browser.launch()
    const page = await browser.newPage()
    await login(page, BASE, { email: member.email, password })
    await mkdir(OUT, { recursive: true })
    for (const shot of shots(byName.get(STANDINGS)!.id, byName.get(PLAYOFFS)!.id))
      await take(page, shot)
    await page.ev(`localStorage.removeItem(${JSON.stringify(THEME_KEY)})`)
  } finally {
    await browser?.close()
    server?.kill()
    clearTimeout(guard)
  }
}

main().catch((error: unknown) => {
  out(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
