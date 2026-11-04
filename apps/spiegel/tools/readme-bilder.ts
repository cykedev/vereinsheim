// Bilder für die README aus erfundenen Daten (ADR-029): der gebaute Stand dieses Checkouts auf :3012, angemeldet mit
// dem Demo-Konto (`seed:own --demo`), hell und dunkel, 1280 und 390 px, als WebP nach `docs/screenshots/`. Danach die
// Verbundbilder aus den Vorlagen in `readme-bilder/`: `hero.webp` (Desktop neben Telefon) und `docs/social-preview.png`
// (1280×640, in den Einstellungen des Repositories hochzuladen). Nicht im Gate: braucht Chrome, einen Build und die
// Demo-Scheiben.
//
//   pnpm --filter spiegel seed:own --demo      einmal: die Scheiben dem Demo-Konto
//   pnpm --filter spiegel build                der Stand, der fotografiert wird
//   pnpm --filter spiegel readme-bilder        schreibt docs/screenshots/spiegel-*.webp, hero.webp, docs/social-preview.png
//   … --nur <wort>                             nur Bilder, deren Name das Wort enthält (auch „hero“, „social“)

import type { ChildProcess } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { Browser, type Page, type ShotFormat } from "@vereinsheim/pruefen/browser"
import { startServer } from "@vereinsheim/pruefen/server"
import { DEMO_EMAIL, DEMO_PASSWORD } from "./demo-account"

const PORT = 3012
const BASE = `http://localhost:${PORT}`
const ROOT = resolve(__dirname, "../../..")
const OUT = join(ROOT, "docs", "screenshots")
const THEME_KEY = "spiegel-theme"
const QUALITY = 88

const PHONE = [390, 844] as const
const DESKTOP = [1280, 900] as const

/** die Scheibe der Bilder: ihre Adresse aus der Liste, ihre Kennung und die der Scheibe davor (Vergleich) */
interface Card {
  href: string
  id: string
  previousId: string
}

interface Shot {
  /** Dateiname ohne Endung, `spiegel-…` */
  name: string
  path: string
  width: 1280 | 390
  theme: "light" | "dark"
}

const out = (text = "") => process.stdout.write(`${text}\n`)

/** die Seiten, die im README stehen; `card` und `previous` sind die Scheibe aus `pickCard` und die davor */
const shots = (card: Card): Shot[] => [
  { name: "spiegel-start", path: "/", width: 1280, theme: "light" },
  { name: "spiegel-start-phone", path: "/", width: 390, theme: "dark" },
  { name: "spiegel-card", path: card.href, width: 1280, theme: "light" },
  { name: "spiegel-card-phone", path: card.href, width: 390, theme: "dark" },
  { name: "spiegel-card-analysis", path: `${card.href}#position`, width: 1280, theme: "dark" },
  { name: "spiegel-cards-phone", path: "/cards", width: 390, theme: "light" },
  { name: "spiegel-progress", path: "/progress?range=all", width: 1280, theme: "light" },
  {
    name: "spiegel-progress-target",
    path: "/progress?range=all&show=target",
    width: 1280,
    theme: "dark",
  },
  {
    name: "spiegel-compare",
    path: `/compare?type=cards&a=${card.id}&b=${card.previousId}`,
    width: 1280,
    theme: "light",
  },
  { name: "spiegel-scan-phone", path: "/scan", width: 390, theme: "light" },
]

/** Anmelden wie das Formular (CSRF-Token, Credentials-Callback); danach steht die Sitzung im Cookie */
async function login(page: Page) {
  await page.viewport(...DESKTOP)
  await page.goto(`${BASE}/login`, '$("form")')
  const status = await page.ev<number>(`(async () => {
    const { csrfToken } = await (await fetch("/api/auth/csrf")).json()
    const body = new URLSearchParams({ csrfToken, email: ${JSON.stringify(DEMO_EMAIL)},
      password: ${JSON.stringify(DEMO_PASSWORD)}, json: "true", callbackUrl: "/" })
    const r = await fetch("/api/auth/callback/credentials", { method: "POST", body,
      headers: { "content-type": "application/x-www-form-urlencoded" } })
    return r.status
  })()`)
  await page.goto(`${BASE}/`)
  const signedIn = await page.ev<boolean>(`location.pathname === "/"`)
  if (status !== 200 || !signedIn)
    throw new Error(
      `Anmeldung mit dem Demo-Konto gescheitert (${status}); vorher pnpm --filter spiegel seed:own --demo`
    )
}

/**
 * eine volle Scheibe aus der Liste: mindestens 30 Wertungsschüsse, Vorige und Nächste, der Reiter „Lage“, keine Probe
 * im Kopf; nur gemessene, damit das Bild Schüsse zeigt
 */
async function pickCard(page: Page): Promise<Card> {
  await page.goto(`${BASE}/cards?provenance=measured`)
  const hrefs = await page.ev<string[]>(
    `[...new Set($$('a[href^="/cards/c"]').map((a) => a.getAttribute("href")))].slice(0, 12)`
  )
  for (const href of hrefs.slice(1)) {
    await page.goto(`${BASE}${href}`)
    const fit = await page.ev<boolean>(`$$("#shot-table tr[data-row]").length >= 30 &&
      !!link("Vorige Scheibe") && !!link("Nächste Scheibe") && !!tab("Lage") &&
      !$$("[data-card-header] *").some((el) => txt(el) === "Probe")`)
    if (!fit) continue
    const idOf = (path: string) => /^\/cards\/([^/?#]+)/.exec(path)?.[1] ?? null
    const previous = await page.ev<string | null>(
      `link("Vorige Scheibe")?.getAttribute("href") ?? null`
    )
    const id = idOf(href)
    const previousId = previous ? idOf(previous) : null
    if (id && previousId) return { href, id, previousId }
  }
  throw new Error("keine passende Scheibe mit 30 Schuss in der Liste des Demo-Kontos")
}

/** Darstellung über den Schlüssel der App auf einer geladenen Seite, dann die Adresse fotografieren */
async function take(page: Page, shot: Shot) {
  const [width, height] = shot.width === 390 ? PHONE : DESKTOP
  await page.viewport(width, height)
  await page.goto(`${BASE}/profile`)
  await page.ev(`localStorage.setItem(${JSON.stringify(THEME_KEY)}, ${JSON.stringify(shot.theme)})`)
  await page.goto(`${BASE}${shot.path}`, '$("[data-app-content]")')
  await page.wait(800)
  const file = join(OUT, `${shot.name}.webp`)
  const image = await page.screenshot(false, "webp", QUALITY)
  await writeFile(file, image)
  out(`  ${shot.name}.webp  ${shot.width} px ${shot.theme}  ${Math.round(image.length / 1024)} KB`)
}

/**
 * eine Vorlage aus `readme-bilder/` mit den Bildern füllen (`{{name}}` wird die Adresse der Datei), über file:// laden
 * und als Bild der Größe der Vorlage schreiben
 */
async function compose(
  page: Page,
  template: string,
  fill: Record<string, string>,
  size: readonly [number, number],
  file: string,
  format: ShotFormat,
  dir: string
) {
  let html = await readFile(join(__dirname, "readme-bilder", template), "utf8")
  for (const [key, value] of Object.entries(fill))
    html = html.replaceAll(`{{${key}}}`, pathToFileURL(value).href)
  const tmp = join(dir, template)
  await writeFile(tmp, html)
  await page.viewport(size[0], size[1])
  await page.goto(pathToFileURL(tmp).href, "document.body", { plain: true })
  // die Bilder der Vorlage sind erst nach dem Laden der Seite fertig gezeichnet
  await page.waitFor(`[...document.images].every((img) => img.complete && img.naturalWidth > 0)`)
  await page.wait(300)
  const image = await page.screenshot(false, format, format === "webp" ? 90 : 85)
  await writeFile(file, image)
  out(
    `  ${file.slice(ROOT.length + 1)}  ${size[0]}×${size[1]}  ${Math.round(image.length / 1024)} KB`
  )
}

async function main() {
  let server: ChildProcess | null = null
  let browser: Browser | null = null
  let uploads: string | null = null
  // höchstens fünf Minuten; hängt etwas, endet der Lauf hart mit 1
  const guard = setTimeout(() => {
    out("Zeit überschritten (5 min)")
    server?.kill()
    void browser?.close()
    setTimeout(() => process.exit(1), 3_000).unref()
  }, 300_000)
  try {
    // der eigene Produktions-Server braucht ein Verzeichnis für Ausdrucke (`UPLOAD_DIR`); eines nur für den Lauf
    uploads = await mkdtemp(join(tmpdir(), "spiegel-readme-bilder-"))
    process.env.UPLOAD_DIR = uploads
    server = await startServer({ app: "spiegel", port: PORT, out })
    browser = await Browser.launch()
    const page = await browser.newPage()
    await login(page)
    await mkdir(OUT, { recursive: true })
    const card = await pickCard(page)
    out(`Scheibe ${card.href}, davor ${card.previousId}`)
    const only = process.argv.indexOf("--nur")
    const word = only >= 0 ? (process.argv[only + 1] ?? "") : ""
    for (const shot of shots(card)) if (shot.name.includes(word)) await take(page, shot)
    await page.ev(`localStorage.removeItem(${JSON.stringify(THEME_KEY)})`)
    const desktop = join(OUT, "spiegel-card.webp")
    const phone = join(OUT, "spiegel-card-phone.webp")
    if ("hero".includes(word))
      await compose(
        page,
        "hero.html",
        { desktop, phone },
        [1600, 900],
        join(OUT, "hero.webp"),
        "webp",
        uploads
      )
    if ("social".includes(word))
      await compose(
        page,
        "social.html",
        { phone },
        [1280, 640],
        join(ROOT, "docs", "social-preview.png"),
        "png",
        uploads
      )
  } finally {
    await browser?.close()
    server?.kill()
    if (uploads) await rm(uploads, { recursive: true, force: true })
    clearTimeout(guard)
  }
}

main().catch((error: unknown) => {
  out(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
