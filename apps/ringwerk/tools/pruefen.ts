// Skriptprüfung von Ringwerk in Design 2: Bedienung, die kein Test im Node sieht (Rahmen und Leisten je Rolle, kein
// seitliches Scrollen bei mehreren Fensterbreiten, Reiter eines Wettbewerbs, Bracket, Darstellung ohne Aufblitzen,
// Fokus im Dialog, keine versteckte Kopie im Hintergrund), gegen den gebauten Stand auf dem Prüfbestand. Liest nur.
// Nicht im Gate: braucht Chrome, den Dev-Postgres mit der Prüfdatenbank und einen Build.
//
//   pnpm --filter ringwerk pruefdaten        Prüfdatenbank (einmal vorher)
//   pnpm --filter ringwerk pruefen           startet den gebauten Stand dieses Checkouts auf :3013 und prüft ihn
//   … --alle                                 zeigt jede Prüfung, nicht nur FAIL
//   … --nur <abschnitt>                      nur Abschnitte, deren Name das Wort enthält

import type { ChildProcess } from "node:child_process"
import path from "node:path"

import { config } from "dotenv"
import { Client } from "pg"

import { Browser, type Page } from "@vereinsheim/pruefen/browser"
import {
  barDoesNotCover,
  type Check,
  dialogFocus,
  noHiddenCopy,
  noSideScroll,
  themeNoFlash,
} from "@vereinsheim/pruefen/common"
import { startServer } from "@vereinsheim/pruefen/server"

import { PRUEF_ACCOUNTS } from "./pruefdaten/accounts"
import { pruefDatabaseUrl } from "./pruefdaten/db"
import { login } from "./pruefen-ringwerk/capture"

const APP_DIR = path.resolve(__dirname, "..")
const PORT = 3013
const BASE = `http://localhost:${PORT}`

/** die Seiten über alle Wettbewerbe; Admin dazu, Teilnehmer und Disziplinen nur für die Sportleitung */
const MAIN = ["/", "/competitions", "/participants", "/disciplines", "/profile"]
const ADMIN_PAGES = ["/admin/users", "/admin/audit-log"]

/** Wettbewerbe des Prüfbestands, an denen die Seiten eines Wettbewerbs geprüft werden, und ihre Seiten */
const SAMPLES = [
  {
    name: "L-DRR-16 · L5 Achtelfinale mitten in der Runde (Hin/Rück)",
    pages: ["schedule", "playoffs", "participants", "audit-log"],
  },
  { name: "R · 16 Teilnehmer mit langen Namen", pages: ["schedule", "participants"] },
  {
    name: "L-BO5-4 · L6 Finale in der Verlängerung (Best-of-5)",
    pages: ["schedule", "playoffs"],
  },
  { name: "E · Teams Summe, Teamgröße 3, fertig", pages: ["ranking", "series", "participants"] },
  {
    name: "S · Faktor-Korrektur, gemischte Disziplinen",
    pages: ["standings", "series", "participants"],
  },
] as const
/** ein Spielplan ohne Ergebnis: „Spielplan neu generieren“ öffnet einen Dialog */
const REGENERATE = "L-DRR-6 · L1 Spielplan, kein Ergebnis (Hin/Rück)"

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

type Role = (typeof PRUEF_ACCOUNTS)[number]["role"]

async function signIn(page: Page, env: Record<string, string | undefined>, role: Role) {
  const account = PRUEF_ACCOUNTS.find((a) => a.role === role)!
  const password = env[account.env]
  if (!password) throw new Error(`${account.env} fehlt in apps/ringwerk/.env: erst pruefdaten`)
  await login(page, BASE, { email: account.email, password })
}

/** Kennungen der Wettbewerbe nach Namen, nur lesend */
async function competitionIds(url: string, names: string[]): Promise<Map<string, string>> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const { rows } = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM "Competition" WHERE name = ANY($1)`,
      [names]
    )
    const ids = new Map(rows.map((r) => [r.name, r.id]))
    const missing = names.filter((n) => !ids.has(n))
    if (missing.length > 0)
      throw new Error(`nicht im Prüfbestand: ${missing.join(", ")} (erst pruefdaten)`)
    return ids
  } finally {
    await client.end()
  }
}

/** Rahmen je Rolle: Seitenleiste ab 1024 px, untere Leiste darunter, aktiver Eintrag, schmale Leiste quer */
async function frame(page: Page, role: Role, bar: string, more: string[]) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}/competitions`)
  const desktop = await page.ev<{ sidebar: boolean; bar: boolean; current: string | null }>(`({
    sidebar: visible($("[data-app-sidebar]")), bar: visible($("[data-app-bar]")),
    current: $('[data-app-sidebar] [aria-current="page"]')?.dataset.area ?? null })`)
  check(
    `${role} Desktop: Seitenleiste ohne untere Leiste, Wettbewerbe aktiv`,
    desktop.sidebar && !desktop.bar && desktop.current === "competitions",
    desktop
  )
  await page.viewport(390, 844)
  await page.goto(`${BASE}/profile`)
  const phone = await page.ev<{ sidebar: boolean; areas: string[]; current: string | null }>(`({
    sidebar: visible($("[data-app-sidebar]")),
    areas: $$("[data-app-bar] [data-area]").map((a) => a.dataset.area),
    current: $('[data-app-bar] [aria-current="page"]')?.dataset.area ?? null })`)
  check(
    `${role} Telefon: untere Leiste ${bar}, Profil aktiv`,
    !phone.sidebar && phone.areas.join() === bar && phone.current === "profile",
    phone
  )
  const links = await page.ev<string[]>(
    `$$('[aria-label="Weitere Bereiche"] a').filter(visible).map((a) => a.getAttribute("href"))`
  )
  check(
    `${role} Telefon: Profil führt zu ${more.length ? more.join(", ") : "nichts weiter"}`,
    links.join() === more.join(),
    links
  )
  await page.viewport(844, 390)
  await page.goto(`${BASE}/`)
  check(
    `${role} Telefon quer: schmale Leiste links statt unterer Leiste`,
    await page.ev<boolean>(`visible($("[data-app-rail]")) && !visible($("[data-app-bar]"))`)
  )
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

async function layout(page: Page, paths: string[]) {
  record(await noSideScroll(page, { base: BASE, paths, widths: [375, 390, 768] }))
  record(await noSideScroll(page, { base: BASE, paths, widths: [1024, 1280], height: 900 }))
  await page.viewport(390, 844)
  for (const p of paths) {
    await page.goto(`${BASE}${p}`)
    record([await barCheck(page, `Telefon ${p}`)])
  }
}

/** Reiter eines Wettbewerbs: eine Zeile, die gezeigte Seite markiert und sichtbar, jeder Reiter führt zu seiner Seite */
async function tabs(page: Page, competitionPaths: string[]) {
  for (const width of [390, 1280]) {
    await page.viewport(width, width === 390 ? 844 : 900)
    for (const p of competitionPaths) {
      await page.goto(`${BASE}${p}`)
      const s = await page.ev<{
        rows: number
        current: string | null
        inView: boolean
        hrefs: string[]
      }>(`(() => {
        const bar = $("[data-competition-tabs]")
        const links = $$("a", bar)
        const active = $('[data-competition-tabs] [aria-current="page"]')
        const a = active?.getBoundingClientRect(), c = bar.getBoundingClientRect()
        return { rows: new Set(links.map((l) => Math.round(l.getBoundingClientRect().top))).size,
          current: active?.getAttribute("href") ?? null,
          inView: !!a && a.left >= c.left - 1 && a.right <= c.right + 1,
          hrefs: links.map((l) => l.getAttribute("href")) }
      })()`)
      check(
        `${width} px: ${p} Reiter in einer Zeile, die Seite markiert und im Bild`,
        s.rows === 1 && s.current === p && s.inView,
        s
      )
    }
  }
}

/** das Bracket scrollt in sich, die Seite nie seitlich */
async function bracket(page: Page, playoffs: string) {
  await page.viewport(390, 844)
  await page.goto(`${BASE}${playoffs}`)
  const s = await page.ev<{ scrolls: boolean; page: number }>(`(() => {
    const box = $$("main div").find((el) => getComputedStyle(el).overflowX === "auto" && el.scrollWidth > el.clientWidth + 1 && el.textContent.includes("Achtelfinale"))
    return { scrolls: !!box, page: document.documentElement.scrollWidth }
  })()`)
  check("390 px: Bracket scrollt in sich, die Seite nicht", s.scrolls && s.page <= 390, s)
}

/** ein Konto ohne Admin-Rolle landet auf /admin am Start, nicht auf der Anmeldung */
async function adminWithoutRole(page: Page, role: Role) {
  for (const p of ["/admin", "/admin/users"]) {
    await page.goto(`${BASE}${p}`)
    const now = await page.ev<string>(`location.pathname`)
    check(`${role} ohne Admin-Rolle: ${p} führt zum Start`, now === "/", now)
  }
  check(
    `${role}: kein Eintrag Admin in der Seitenleiste`,
    await page.ev<boolean>(`!$('[data-app-sidebar] [data-area="admin"]')`)
  )
}

/** `/account` leitet auf Profil */
async function accountRedirect(page: Page) {
  await page.goto(`${BASE}/account`)
  const now = await page.ev<string>(`location.pathname`)
  check("/account leitet auf /profile", now === "/profile", now)
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  let server: ChildProcess | null = null
  let browser: Browser | null = null
  // die ganze Prüfung höchstens acht Minuten; hängt etwas, steht es im Bericht und der Lauf endet hart mit 1
  const guard = setTimeout(() => {
    check("Prüfung: Zeit überschritten", false, "8 min")
    report()
    server?.kill()
    void browser?.close()
    setTimeout(() => process.exit(1), 3_000).unref()
  }, 480_000)
  try {
    const env: Record<string, string | undefined> = {}
    config({
      path: path.join(APP_DIR, ".env"),
      processEnv: env as Record<string, string>,
      quiet: true,
    })
    const url = pruefDatabaseUrl(env)
    const ids = await competitionIds(url, [...SAMPLES.map((s) => s.name), REGENERATE])
    const competitionPaths = SAMPLES.flatMap((s) =>
      s.pages.map((p) => `/competitions/${ids.get(s.name)}/${p}`)
    )
    process.env.DATABASE_URL = url
    server = await startServer({ app: "ringwerk", port: PORT, hostname: "127.0.0.1", out })
    const chrome = await Browser.launch()
    browser = chrome
    const page = await chrome.newPage()

    await signIn(page, env, "ADMIN")
    await section("Rahmen", () =>
      frame(page, "ADMIN", "start,competitions,participants,profile", [
        "/disciplines",
        "/admin/users",
      ])
    )
    await section("Profil", () => accountRedirect(page))
    await section("Breiten und Leiste", () =>
      layout(page, [...MAIN, ...ADMIN_PAGES, ...competitionPaths])
    )
    await section("Reiter", () => tabs(page, competitionPaths))
    await section("Bracket", () => bracket(page, competitionPaths[1]))
    await section("Versteckte Kopie", async () => {
      record(
        await noHiddenCopy(chrome, page, {
          base: BASE,
          paths: [...MAIN, ...ADMIN_PAGES, ...competitionPaths],
        })
      )
    })
    await section("Darstellung und Dialog", async () => {
      await page.viewport(1280, 900)
      record(
        await themeNoFlash(page, { url: `${BASE}/competitions`, storageKey: "ringwerk-theme" })
      )
      // nur öffnen und mit Escape schließen: der Prüfbestand bleibt unverändert
      await page.goto(`${BASE}/competitions/${ids.get(REGENERATE)}/schedule`)
      record(
        await dialogFocus(
          page,
          `button("Spielplan neu generieren")`,
          "Dialog „Spielplan neu generieren“"
        )
      )
    })

    await signIn(page, env, "MANAGER")
    await section("Rahmen Sportleitung", () =>
      frame(page, "MANAGER", "start,competitions,participants,profile", ["/disciplines"])
    )
    await section("Admin ohne Rolle Sportleitung", () => adminWithoutRole(page, "MANAGER"))

    await signIn(page, env, "USER")
    await section("Rahmen Mitglied", () => frame(page, "USER", "start,competitions,profile", []))
    await section("Admin ohne Rolle Mitglied", () => adminWithoutRole(page, "USER"))
    await section("Breiten Mitglied", () =>
      layout(page, ["/", "/competitions", "/profile", competitionPaths[0], competitionPaths[1]])
    )

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
