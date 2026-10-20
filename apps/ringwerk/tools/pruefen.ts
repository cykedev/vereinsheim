// Skriptprüfung von Ringwerk in Design 2: Bedienung, die kein Test im Node sieht (Rahmen und Leisten je Rolle, kein
// seitliches Scrollen bei mehreren Fensterbreiten, Reiter eines Wettbewerbs, Bracket, Darstellung ohne Aufblitzen,
// Fokus im Dialog, keine versteckte Kopie im Hintergrund, Hilfe als Blatt und „–“ mit Grund), gegen den gebauten
// Stand auf dem Prüfbestand. Liest nur.
// Nicht im Gate: braucht Chrome, den Dev-Postgres mit der Prüfdatenbank und einen Build.
//
//   pnpm --filter ringwerk pruefdaten        Prüfdatenbank (einmal vorher)
//   pnpm --filter ringwerk pruefen           startet den gebauten Stand dieses Checkouts auf :3013 und prüft ihn
//   … --alle                                 zeigt jede Prüfung, nicht nur FAIL
//   … --nur <abschnitt>                      nur Abschnitte, deren Name das Wort enthält
//   … --bilder <ordner>                      dazu Bilder je Phase für die Sichtprüfung (390 und 1280 px, hell und
//                                            dunkel) mit einer Übersicht index.html

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

import { HELP_TOPICS, type HelpTopicId } from "../src/lib/help/topics"
import { MISSING_KINDS, missingReason, type MissingKind } from "../src/lib/help/missing"

import { PRUEF_ACCOUNTS } from "./pruefdaten/accounts"
import { pruefDatabaseUrl } from "./pruefdaten/db"
import { pictures } from "./pruefen-bilder"
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
/** eine fertige Gruppenphase: „Playoffs starten“ öffnet einen Dialog */
const START = "L-BO5-4 · L4 Gruppenphase fertig (Best-of-5)"
/** Löschen in der Liste: mit Teilnehmern ein Hinweis, ohne eine Rückfrage */
const WITH_PARTICIPANTS = "E · Entwurf mit Starterliste (Ringteiler)"
const EMPTY = "R · leerer Wettbewerb (Event)"

/** der erste sichtbare Knopf mit dieser Beschriftung, als Ausdruck im Fenster */
const button = (label: string) => `button(${JSON.stringify(label)})`

/** der Knopf auf der Karte des Wettbewerbs mit diesem Namen (kleinster Eintrag mit Name und Knopf) */
const onCard = (name: string, label: string) =>
  `button(${JSON.stringify(label)}, $$("main li, main article, main div").filter((el) => visible(el) && el.textContent.includes(${JSON.stringify(name)}) && button(${JSON.stringify(label)}, el)).sort((a, b) => a.textContent.length - b.textContent.length)[0])`

/** mit `--bilder`: je Thema das Blatt, geöffnet auf einer Seite aus `HELP_PAGES` (Index), am Telefon sichtbar */
const HELP_SHEETS: readonly (readonly [HelpTopicId, number])[] = [
  ["ringteiler", 0],
  ["season-order", 0],
  ["season-alternating", 1],
  ["teiler", 1],
  ["league-table", 5],
  ["best-of-table", 6],
  ["playoffs", 7],
  ["finale", 7],
]

/** Seiten mit „?“ und „–“ mit Grund (Name im Prüfbestand, Seite); zusammen tragen sie jedes Thema der Hilfe */
const HELP_PAGES: readonly (readonly [string, string])[] = [
  ["S · klassisch nach Ringteiler, gemischt", "standings"],
  ["S · Ringe/Teiler alternierend", "standings"],
  ["S · Faktor-Korrektur, gemischte Disziplinen", "standings"],
  ["E · teilweise gewertet (Ringteiler)", "ranking"],
  [REGENERATE, "schedule"],
  ["L-DRR-6 · L3 Rückrunde läuft (Hin/Rück)", "schedule"],
  [START, "schedule"],
  ["L-BO5-4 · L6 Finale in der Verlängerung (Best-of-5)", "playoffs"],
]

/** mit `--bilder`: je Phase eine Seite eines Wettbewerbs (Name im Prüfbestand, Seite) */
const PHASES: readonly (readonly [string, string, string])[] = [
  ["L1 Spielplan, kein Ergebnis", REGENERATE, "schedule"],
  ["L2 Hinrunde läuft (Best-of-3)", "L-BO3-7 · L2 Hinrunde läuft (Best-of-3)", "schedule"],
  ["L3 Rückrunde läuft", "L-DRR-6 · L3 Rückrunde läuft (Hin/Rück)", "schedule"],
  [
    "L4 Gruppenphase fertig (Best-of-5)",
    "L-BO5-4 · L4 Gruppenphase fertig (Best-of-5)",
    "schedule",
  ],
  ["L4 Playoffs noch nicht gestartet", "L-BO5-4 · L4 Gruppenphase fertig (Best-of-5)", "playoffs"],
  [
    "L5 Achtelfinale mitten in der Runde",
    "L-DRR-16 · L5 Achtelfinale mitten in der Runde (Hin/Rück)",
    "playoffs",
  ],
  [
    "L5 Viertelfinale fertig",
    "L-BO3-8 · L5 Viertelfinale fertig, nicht weitergeschaltet (Best-of-3)",
    "playoffs",
  ],
  ["L5 nur Halbfinale", "L-DRR-4 · L5 nur Halbfinale mitten in der Runde (Hin/Rück)", "playoffs"],
  [
    "L6 Finale in der Verlängerung",
    "L-BO5-4 · L6 Finale in der Verlängerung (Best-of-5)",
    "playoffs",
  ],
  [
    "L7 abgeschlossen mit Playoffs",
    "L-DRR-4 · L7 abgeschlossen mit Playoffs (Hin/Rück)",
    "playoffs",
  ],
  ["Gleichstand auf Platz 1 und 3", "R · Gleichstand auf Platz 1 und 3 (Hin/Rück)", "schedule"],
  ["16 Teilnehmer mit langen Namen", "R · 16 Teilnehmer mit langen Namen", "participants"],
  ["Event teilweise gewertet", "E · teilweise gewertet (Ringteiler)", "ranking"],
  ["Event Teams", "E · Teams Summe, Teamgröße 3, fertig", "ranking"],
  ["Event Serien erfassen", "E · teilweise gewertet (Ringteiler)", "series"],
  ["Saison klassisch nach Ringteiler", "S · klassisch nach Ringteiler, gemischt", "standings"],
  ["Saison wenige Serien", "S · wenige Serien", "standings"],
  ["Saison abwechselnd", "S · Ringe/Teiler alternierend", "standings"],
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

/**
 * Jedes sichtbare „?“ öffnet das Blatt mit seinem Thema, am Telefon und am Desktop; zusammen tragen die Seiten jedes
 * Thema. Ein „?“ im Spaltenkopf ordnet die Tabelle nicht um. Jedes sichtbare „–“ mit Grund nennt ihn, als Text oder
 * als Tooltip.
 */
async function help(page: Page, paths: string[]) {
  for (const [width, height] of [
    [390, 844],
    [1280, 900],
  ] as const) {
    await page.viewport(width, height)
    const seen = new Set<string>()
    const missing = new Set<string>()
    for (const p of paths) {
      await page.goto(`${BASE}${p}`)
      const ids = await page.ev<string[]>(
        `$$("[data-help]").filter(visible).map((b) => b.dataset.help)`
      )
      for (const id of ids) {
        const order = `$$("main p").map(txt).find((t) => t.startsWith("Sortierung:")) ?? ""`
        const before = await page.ev<string>(order)
        await page.click(`$$('[data-help="${id}"]').filter(visible)[0]`, { settle: 400 })
        const title = await page.ev<string>(
          `txt($$("dialog").find((d) => d.open)?.querySelector("h2") ?? null)`
        )
        const expected = HELP_TOPICS[id as HelpTopicId]?.title
        check(`${width} px: ${p} „?“ ${id} öffnet „${expected}“`, title === expected, title)
        await page.key("Escape")
        await page.wait(300)
        const after = await page.ev<string>(order)
        if (before !== after) check(`${width} px: ${p} „?“ ${id} ordnet nicht um`, false, after)
        seen.add(id)
      }
      const reasons = await page.ev<{ kind: string; text: string; title: string }[]>(
        `$$("[data-missing]").filter(visible).map((el) => ({ kind: el.dataset.missing, text: el.textContent, title: el.title }))`
      )
      for (const r of reasons) {
        const reason = MISSING_KINDS.includes(r.kind as MissingKind)
          ? missingReason(r.kind as MissingKind)
          : null
        if (!reason || !r.text.includes(reason))
          check(`${width} px: ${p} „–“ ${r.kind} nennt den Grund`, false, r)
        missing.add(r.kind)
      }
    }
    // am Telefon klappt der Teiler der klassischen Rangliste weg, also auch der korrigierte des gemischten Wettbewerbs
    const all = Object.keys(HELP_TOPICS)
    const expected = width === 390 ? all.filter((id) => id !== "corrected-teiler") : all
    check(
      `${width} px: jedes Thema der Hilfe hat ein sichtbares „?“`,
      expected.every((id) => seen.has(id)),
      [...seen]
    )
    const kinds = width === 390 ? ["noSeries", "noResult"] : ["noSeries", "noResult", "noDuel"]
    check(
      `${width} px: „–“ mit Grund in Saison und Spielplan`,
      kinds.every((kind) => missing.has(kind)),
      [...missing]
    )
  }
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
    const ids = await competitionIds(url, [
      ...new Set([
        ...SAMPLES.map((s) => s.name),
        REGENERATE,
        START,
        ...PHASES.map(([, name]) => name),
        ...HELP_PAGES.map(([name]) => name),
      ]),
    ])
    /** Dialoge mit Folgen: Seite, Knopf, der den Dialog öffnet (Ausdruck im Fenster), und was er fragt */
    const dialogs: readonly (readonly [string, string, string])[] = [
      [
        `/competitions/${ids.get(REGENERATE)}/schedule`,
        button("Spielplan neu generieren"),
        "Spielplan neu",
      ],
      [`/competitions/${ids.get(START)}/playoffs`, button("Playoffs starten"), "Playoffs starten"],
      [
        `/competitions/${ids.get(REGENERATE)}/edit`,
        button("Wettbewerb mit allen Daten löschen"),
        "Wettbewerb mit allen Daten löschen",
      ],
      [
        "/competitions",
        onCard(REGENERATE, "Als abgeschlossen markieren"),
        "Wettbewerb abschließen",
      ],
      [
        "/competitions",
        onCard(WITH_PARTICIPANTS, "Löschen"),
        "Wettbewerb mit Teilnehmern löschen (Hinweis)",
      ],
      ["/competitions", onCard(EMPTY, "Löschen"), "Wettbewerb ohne Teilnehmer löschen"],
      ["/participants", button("Deaktivieren"), "Teilnehmer deaktivieren"],
      ["/disciplines", button("Löschen"), "Disziplin löschen"],
    ]
    const helpPaths = HELP_PAGES.map(([name, p]) => `/competitions/${ids.get(name)}/${p}`)
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
    await section("Hilfe", () => help(page, helpPaths))
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
      // die Dialoge mit Folgen nur öffnen und mit Escape schließen: der Prüfbestand bleibt unverändert
      for (const [where, opener, title] of dialogs) {
        await page.goto(`${BASE}${where}`)
        record(await dialogFocus(page, opener, `Dialog „${title}“`))
      }
    })

    const pictureDir = process.argv.indexOf("--bilder")
    if (pictureDir >= 0)
      await section("Bilder", () =>
        pictures(page, BASE, path.resolve(process.argv[pictureDir + 1] ?? "bilder"), [
          { title: "Start", path: "/" },
          { title: "Wettbewerbe", path: "/competitions" },
          { title: "Teilnehmer", path: "/participants" },
          { title: "Disziplinen", path: "/disciplines" },
          { title: "Profil", path: "/profile" },
          { title: "Admin", path: "/admin/users" },
          ...PHASES.map(([title, name, page]) => ({
            title,
            path: `/competitions/${ids.get(name)}/${page}`,
          })),
          ...dialogs.map(([where, opener, title]) => ({
            title: `Dialog: ${title}`,
            path: where,
            opener,
          })),
          ...HELP_SHEETS.map(([id, at]) => ({
            title: `Hilfe: ${HELP_TOPICS[id].title}`,
            path: helpPaths[at],
            opener: `$$('[data-help="${id}"]').filter(visible)[0]`,
          })),
        ])
      )

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
