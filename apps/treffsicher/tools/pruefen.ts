// Skriptprüfung der App: Bedienung, die kein Test im Node sieht (Rahmen und Leisten, kein seitliches Scrollen bei
// mehreren Fensterbreiten, Darstellung ohne Aufblitzen, Fokus im Dialog), gegen die laufende App mit dem Prüfkonto.
// Nicht im Gate: braucht Chrome, einen laufenden Server und Daten.
//
//   pnpm --filter treffsicher pruefen:konto     einmal: das Prüfkonto mit erfundenen Einheiten
//   pnpm --filter treffsicher pruefen           gegen http://localhost:3001 (BASE_URL), `--alle` zeigt jede Prüfung
//   pnpm --filter treffsicher pruefen --start   startet den gebauten Stand dieses Checkouts auf :3011 und prüft ihn
//   … --nur <abschnitt>                         nur Abschnitte, deren Name das Wort enthält

import type { ChildProcess } from "node:child_process"
import { join } from "node:path"

import { config } from "dotenv"

import { Browser, type Page } from "@vereinsheim/pruefen/browser"
import {
  barDoesNotCover,
  type Check,
  dialogFocus,
  noSideScroll,
  themeNoFlash,
} from "@vereinsheim/pruefen/common"
import { startServer } from "@vereinsheim/pruefen/server"

config({ path: join(import.meta.dirname, "..", ".env"), quiet: true })

/** mit `--start`: der eigene Produktions-Server aus `.next` dieses Checkouts (nach `build` bzw. `pnpm check`) */
const START = process.argv.includes("--start")
const START_PORT = 3011
/** `BASE_URL` darf nur mit diesem Schalter auf einen nicht lokalen Server zeigen */
const ANY_HOST = process.argv.includes("--fremder-host")
const BASE = (
  START ? `http://localhost:${START_PORT}` : (process.env.BASE_URL ?? "http://localhost:3001")
).replace(/\/$/, "")

/** die Hauptseiten; eine Einheit kommt aus dem Tagebuch dazu */
const MAIN = [
  "/dashboard",
  "/sessions",
  "/sessions/new",
  "/statistics",
  "/goals",
  "/shot-routines",
  "/disciplines",
  "/profile",
]

const out = (text = "") => process.stdout.write(`${text}\n`)

const results: Check[] = []
const started = Date.now()
function check(name: string, ok: boolean, detail: unknown = "") {
  results.push({ ok, name, detail: typeof detail === "string" ? detail : JSON.stringify(detail) })
}
const record = (checks: Check[]) => results.push(...checks)

/** ein Abschnitt der Prüfung; bricht er ab, steht das als FAIL im Bericht, die übrigen laufen weiter */
async function section(name: string, run: () => Promise<void>) {
  const only = process.argv.indexOf("--nur")
  if (only >= 0 && !name.toLowerCase().includes((process.argv[only + 1] ?? "").toLowerCase()))
    return
  try {
    await run()
  } catch (error) {
    check(`${name}: Abbruch`, false, error instanceof Error ? error.message : String(error))
  }
}

async function login(page: Page) {
  const email = process.env.PRUEFEN_EMAIL
  const password = process.env.PRUEFEN_PASSWORD
  if (!email || !password)
    throw new Error(
      "PRUEFEN_EMAIL/PRUEFEN_PASSWORD fehlen; erst pnpm --filter treffsicher pruefen:konto"
    )
  await page.viewport(1280, 900)
  await page.goto(`${BASE}/login`, '$("form")')
  const status = await page.ev<number>(`(async () => {
    const { csrfToken } = await (await fetch("/api/auth/csrf")).json()
    const body = new URLSearchParams({ csrfToken, email: ${JSON.stringify(email)},
      password: ${JSON.stringify(password)}, json: "true", callbackUrl: "/dashboard" })
    const r = await fetch("/api/auth/callback/credentials", { method: "POST", body,
      headers: { "content-type": "application/x-www-form-urlencoded" } })
    return r.status
  })()`)
  await page.goto(`${BASE}/dashboard`)
  const signedIn = await page.ev<boolean>(`location.pathname === "/dashboard"`)
  if (status !== 200 || !signedIn)
    throw new Error(
      `Anmeldung mit dem Prüfkonto gescheitert (${status}); vorher pnpm --filter treffsicher pruefen:konto`
    )
}

/** die Adresse der neuesten Einheit im Tagebuch */
async function pickSession(page: Page): Promise<string> {
  await page.goto(`${BASE}/sessions`)
  const href = await page.ev<string | null>(
    `$$('a[href^="/sessions/"]').map((a) => a.getAttribute("href"))
      .find((h) => /^\\/sessions\\/(?!new)[^/]+$/.test(h)) ?? null`
  )
  if (!href) throw new Error("keine Einheit im Tagebuch des Prüfkontos")
  return href
}

/** Rahmen: Seitenleiste ab 1024 px, untere Leiste darunter, aktiver Eintrag, Neue Einheit in der Mitte */
async function frame(page: Page) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}/sessions`)
  const desktop = await page.ev<{ sidebar: boolean; bar: boolean; current: string | null }>(`({
    sidebar: visible($("[data-app-sidebar]")), bar: visible($("[data-app-bar]")),
    current: $('[data-app-sidebar] [aria-current="page"]')?.dataset.area ?? null })`)
  check(
    "Desktop: Seitenleiste ohne untere Leiste, Tagebuch aktiv",
    desktop.sidebar && !desktop.bar && desktop.current === "sessions",
    desktop
  )
  await page.viewport(390, 844)
  await page.goto(`${BASE}/goals`)
  const phone = await page.ev<{ sidebar: boolean; areas: string[]; current: string | null }>(`({
    sidebar: visible($("[data-app-sidebar]")),
    areas: $$("[data-app-bar] [data-area]").map((a) => a.dataset.area),
    current: $('[data-app-bar] [aria-current="page"]')?.dataset.area ?? null })`)
  check(
    "Telefon: untere Leiste mit Neue Einheit in der Mitte; Ziele steht unter Profil",
    !phone.sidebar &&
      phone.areas.join() === "start,sessions,new,statistics,profile" &&
      phone.current === "profile",
    phone
  )
  await page.goto(`${BASE}/profile`)
  const more = await page.ev<string[]>(
    `$$('[aria-label="Weitere Bereiche"] a').filter(visible).map((a) => a.getAttribute("href"))`
  )
  check(
    "Telefon: Profil führt zu Ziele, Ablauf und Disziplinen",
    ["/goals", "/shot-routines", "/disciplines"].every((href) => more.includes(href)),
    more
  )
  await page.viewport(844, 390)
  await page.goto(`${BASE}/dashboard`)
  check(
    "Telefon quer: schmale Leiste links statt unterer Leiste",
    await page.ev<boolean>(`visible($("[data-app-rail]")) && !visible($("[data-app-bar]"))`)
  )
}

async function layout(page: Page, session: string) {
  record(
    await noSideScroll(page, { base: BASE, paths: [...MAIN, session], widths: [375, 390, 768] })
  )
  record(
    await noSideScroll(page, { base: BASE, paths: [...MAIN, session], widths: [1280], height: 900 })
  )
  await page.viewport(390, 844)
  for (const path of [...MAIN, session]) {
    await page.goto(`${BASE}${path}`)
    record([await barCheck(page, `Telefon ${path}`)])
  }
}

/**
 * Die untere Leiste verdeckt nichts. Eine Seite, die nicht scrollt, reicht nicht bis zur Leiste (`barDoesNotCover`
 * erwartet eine lange Seite): dort genügt, dass ihr Inhalt über der Leiste endet.
 */
async function barCheck(page: Page, label: string): Promise<Check> {
  const short = await page.ev<{ end: number; bar: number } | null>(`(() => {
    if (document.documentElement.scrollHeight > innerHeight) return null
    const content = $("[data-app-content]")
    const box = content.getBoundingClientRect()
    return { end: box.bottom - parseFloat(getComputedStyle(content).paddingBottom),
      bar: $("[data-app-bar]").getBoundingClientRect().top }
  })()`)
  if (!short) return barDoesNotCover(page, label)
  return {
    name: `${label}: die untere Leiste verdeckt nichts (kurze Seite)`,
    ok: short.end <= short.bar + 0.5,
    detail: `Inhalt endet ${Math.round(short.end)}, Leiste ab ${Math.round(short.bar)}`,
  }
}

async function themeAndDialog(page: Page, session: string) {
  await page.viewport(1280, 900)
  record(await themeNoFlash(page, { url: `${BASE}/dashboard`, storageKey: "treffsicher-theme" }))
  await page.goto(`${BASE}${session}`)
  record(await dialogFocus(page, `button("Löschen")`, "Dialog „Einheit löschen“"))
}

/** ein Konto ohne Admin-Rolle landet auf /admin am Start, nicht auf der Anmeldung */
async function adminWithoutRole(page: Page) {
  await page.goto(`${BASE}/admin`)
  const path = await page.ev<string>(`location.pathname`)
  check("Admin ohne Rolle: /admin führt zum Start", path === "/dashboard", path)
  check(
    "Admin ohne Rolle: kein Eintrag Admin in der Seitenleiste",
    await page.ev<boolean>(`!$('[data-app-sidebar] [data-area="admin"]')`)
  )
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  let server: ChildProcess | null = null
  let browser: Browser | null = null
  // die ganze Prüfung höchstens fünf Minuten; hängt etwas, steht es im Bericht und der Lauf endet hart mit 1
  const guard = setTimeout(() => {
    check("Prüfung: Zeit überschritten", false, "5 min")
    report()
    server?.kill()
    void browser?.close()
    setTimeout(() => process.exit(1), 3_000).unref()
  }, 300_000)
  try {
    if (!ANY_HOST && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE))
      throw new Error(`${BASE} ist kein lokaler Server; --fremder-host, wenn das gewollt ist`)
    server = START ? await startServer({ app: "treffsicher", port: START_PORT, out }) : null
    browser = await Browser.launch()
    const page = await browser.newPage()
    await login(page)
    const session = await pickSession(page)
    await section("Rahmen", () => frame(page))
    await section("Breiten und Leiste", () => layout(page, session))
    await section("Darstellung und Dialog", () => themeAndDialog(page, session))
    await section("Admin ohne Rolle", () => adminWithoutRole(page))
    // React meldet in der Entwicklung manches über console.error; jede Meldung zählt, damit keine untergeht
    check("Keine Skriptfehler", page.errors.length === 0, page.errors.slice(0, 5).join(" · "))
    check("Keine Browser-Dialoge", page.dialogs.length === 0, page.dialogs.slice(0, 5).join(" · "))
  } catch (error) {
    check("Prüfung: Abbruch", false, error instanceof Error ? error.message : String(error))
  } finally {
    await browser?.close()
    server?.kill()
  }
  clearTimeout(guard)
  process.exit(report() ? 1 : 0)
}

/** schreibt den Bericht; true bei mindestens einem FAIL */
function report(): boolean {
  const all = process.argv.includes("--alle")
  for (const r of results)
    if (all || !r.ok) out(`${r.ok ? "OK  " : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`)
  const fails = results.filter((r) => !r.ok).length
  out(
    `${fails} FAIL von ${results.length} (${((Date.now() - started) / 1000).toFixed(0)} s, ${BASE})`
  )
  return fails > 0
}

void main()
