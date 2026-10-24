// Skriptprüfung der App: Bedienung, die kein Test im Node sieht (echte Klicks und Tasten, Fokus, Blätter, Kleben und
// Springen, Geometrie bei mehreren Fenstergrößen, Anker, Rückwege), gegen die laufende App mit dem Demo-Konto. Nicht im
// Gate: braucht Chrome, einen laufenden Server und Daten. Ohne feste Zahlen, denn die App zeigt echte Scheiben; geprüft
// werden Struktur, Lage und Gleichheiten.
//
//   pnpm --filter spiegel seed:own --demo      einmal: die Scheiben dem Demo-Konto
//   pnpm --filter spiegel pruefen              gegen http://localhost:3002 (BASE_URL), `--alle` zeigt jede Prüfung
//   pnpm --filter spiegel pruefen --start      startet den gebauten Stand dieses Checkouts auf :3012 und prüft ihn
//   … --nur <abschnitt>                        nur Abschnitte, deren Name das Wort enthält

import type { ChildProcess } from "node:child_process"

import { HELP_TOPICS } from "@vereinsheim/shot-help/topics"

import { Browser, type Page } from "@vereinsheim/pruefen/browser"
import {
  barDoesNotCover,
  type Check,
  dialogFocus,
  noSideScroll,
  pageText,
  themeNoFlash,
} from "@vereinsheim/pruefen/common"
import { startServer } from "@vereinsheim/pruefen/server"
import { DEMO_EMAIL, DEMO_PASSWORD } from "./demo-account"

/** mit `--start`: der eigene Produktions-Server aus `.next` dieses Checkouts (nach `build` bzw. `pnpm check`) */
const START = process.argv.includes("--start")
const START_PORT = 3012
/** `BASE_URL` darf nur mit diesem Schalter auf einen nicht lokalen Server zeigen */
const ANY_HOST = process.argv.includes("--fremder-host")
const BASE = (
  START ? `http://localhost:${START_PORT}` : (process.env.BASE_URL ?? "http://localhost:3002")
).replace(/\/$/, "")

const out = (text = "") => process.stdout.write(`${text}\n`)

type Result = { ok: boolean; name: string; detail: string }
const results: Result[] = []
const started = Date.now()
function check(name: string, ok: boolean, detail: unknown = "") {
  results.push({ ok, name, detail: typeof detail === "string" ? detail : JSON.stringify(detail) })
}

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
  await page.viewport(1280, 900)
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
 * eine Scheibe aus der Liste mit mindestens 30 Wertungsschüssen, die vorige und nächste hat (Blättern), und die
 * Adresse ihrer Herkunft
 */
async function pickCard(page: Page): Promise<string> {
  await page.goto(`${BASE}/cards`)
  const hrefs = await page.ev<string[]>(
    `[...new Set($$('a[href^="/cards/c"]').map((a) => a.getAttribute("href")))].slice(0, 12)`
  )
  for (const href of hrefs.slice(1)) {
    await page.goto(`${BASE}${href}`)
    const fit = await page.ev<boolean>(`$$("#shot-table tr[data-row]").length >= 30 &&
      !!link("Vorige Scheibe") && !!link("Nächste Scheibe") && !!tab("Lage") &&
      !$$("[data-card-header] *").some((el) => txt(el) === "Probe")`)
    if (fit) return href
  }
  throw new Error("keine passende Scheibe mit 30 Schuss in der Liste des Demo-Kontos")
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol
/** Themen der Hilfe über viele Scheiben (Seite eines Zeitraums) */
const PERIOD_TOPICS = HELP_TOPICS.filter((t) => t.theme === "period").map((t) => t.id)
/** Themen der Hilfe der Seite Vergleichen, dazu die Erklärung der Seite selbst */
const COMPARE_TOPICS = [
  ...HELP_TOPICS.filter((t) => t.theme === "compare").map((t) => t.id),
  "vergleichen",
]
/**
 * Fachbegriffe, die auf den ersten beiden Ebenen nicht stehen dürfen: σ, R50, T², „95 %“ als Sicherheit, Median,
 * P10/P90, „mittlere Hälfte“, bedeutsam, Hotelling, echt, unklar, Kalenderwochen. Erst im Blatt „?“ und in den Karten
 * der Reiter.
 */
const JARGON =
  "/σ|R50|T²|mit 95 ?%|95 ?%:|Median|P10|P90|mittlere Hälfte|bedeutsam|Hotelling|\\b[Ee]cht(e[nmrs]?)?\\b|\\b[Uu]nklar\\b|KW \\d|[Rr]angliste/"
/** der erste Fachbegriff im Text der Elemente (ohne Blätter), oder null */
const jargonIn = (selectors: string) =>
  `(() => { const text = $$(${JSON.stringify(selectors)}).map((el) => { const copy = el.cloneNode(true)
    copy.querySelectorAll("dialog").forEach((d) => d.remove()); return txt(copy) }).join(" ")
    return text.match(${JARGON})?.[0] ?? null })()`

/** Anker der Reiter; beim Blättern fällt der Reiter weg, der Abschnitt („#analysis“) bleibt (`siblingRoute`) */
const TAB_ANCHORS = ["#overview", "#result", "#precision", "#position", "#time"]

/**
 * Reiterwechsel an den Anfang des Reiters, nicht ans Ende: am Ende des langen Reiters „Zeit und Verlauf“ zum
 * „Überblick“ wechseln; seine Karten beginnen unter den Leisten (`below`), oder die Seite ist zu Ende
 */
async function tabStart(page: Page, below: number, label: string) {
  const region = `$('section[aria-label="Analyse"] [role="region"]')`
  await page.click(`tab("Zeit und Verlauf")`, { settle: 250 })
  await page.ev(`scrollTo(0, scrollY + ${region}.getBoundingClientRect().bottom - innerHeight)`)
  await page.wait(200)
  const deep = await page.ev<number>(`${region}.getBoundingClientRect().top`)
  // die Reiterleiste scrollt am Telefon in sich: „Überblick“ zurück ins Bild, ohne die Seite zu bewegen
  await page.ev(`$('[role="radiogroup"][aria-label="Thema"]').scrollLeft = 0`)
  await page.click(`tab("Überblick")`, { scroll: false, settle: 300 })
  const start = await page.ev<{ top: number; end: boolean; tab: string }>(`({
    top: ${region}.getBoundingClientRect().top, tab: activeTab(),
    end: scrollY + innerHeight >= document.documentElement.scrollHeight - 2 })`)
  check(
    `${label}: ein anderer Reiter beginnt an seinem Anfang unter den Leisten, nicht am Ende`,
    deep < below - 200 &&
      start.tab === "Überblick" &&
      (near(start.top, below, 3) || (start.top > below && start.top < below + 200 && start.end)),
    { deep: Math.round(deep), ...start, top: Math.round(start.top) }
  )
}

/**
 * Umschalten bleibt an der Stelle: Wertung und Art auf der Seite einer Scheibe mit Anker `#analysis` und die Wertung
 * der Familie unter Scheiben; je danach zurückgestellt
 */
async function togglesStay(page: Page, href: string, label: string) {
  const visible = (prefix: string) =>
    `$$("button").find((b) => (b.getAttribute("aria-label") ?? "").startsWith(${JSON.stringify(prefix)}) && b.getBoundingClientRect().width > 0)`
  const moved: string[] = []
  for (const [where, prefix] of [
    [`${href}#analysis`, "Wertung:"],
    [`${href}#analysis`, "Art:"],
    ["/cards", "Wertung für Ø und Abstand:"],
  ] as const) {
    await page.goto(`${BASE}${where}`)
    await page.ev(`scrollTo(0, 60)`)
    await page.wait(300)
    const before = await page.ev<{ y: number; name: string }>(
      `({ y: scrollY, name: ${visible(prefix)}.getAttribute("aria-label") })`
    )
    await page.click(visible(prefix), { scroll: false, settle: 1500 })
    const after = await page.ev<{ y: number; name: string }>(
      `({ y: scrollY, name: ${visible(prefix)}.getAttribute("aria-label") })`
    )
    if (!near(after.y, before.y, 2) || after.name === before.name)
      moved.push(
        `${prefix} ${before.y} → ${after.y}${after.name === before.name ? ", nicht umgestellt" : ""}`
      )
    await page.click(visible(prefix), { scroll: false, settle: 1500 })
  }
  check(
    `${label}: Wertung und Art umschalten bleibt an der Stelle, auch mit Anker #analysis`,
    moved.length === 0,
    moved.join(" · ")
  )
  // zurück auf die Seite der Scheibe, oben: die folgenden Prüfungen beginnen dort
  await page.goto(`${BASE}${href}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Seite einer Scheibe am Desktop (1280 × 900)
// ─────────────────────────────────────────────────────────────────────────────

async function desktopCard(page: Page, href: string) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}${href}`)
  const path = await page.ev<string>("location.pathname")

  check(
    "Sprungleiste: drei Anker in der Reihenfolge der Seite",
    (await page.ev<string>(
      `$$('nav[aria-label="Abschnitte"] a').map((a) => a.getAttribute("href")).join()`
    )) === "#target,#shots,#analysis"
  )
  await page.click(`$('nav[aria-label="Abschnitte"] a[href="#analysis"]')`, { settle: 400 })
  const jump = await page.ev<{ top: number; active: string; path: string }>(`({
    top: $("#analysis").getBoundingClientRect().top,
    active: $$('nav[aria-label="Abschnitte"] [aria-current]').map(txt).join(),
    path: location.pathname,
  })`)
  check(
    "Desktop: „Analyse“ in der Sprungleiste bringt die Analyse unter die Leiste, aktiv ist genau „Analyse“",
    near(jump.top, 56, 3) && jump.active === "Analyse" && jump.path === path,
    jump
  )
  await page.ev(`scrollBy(0, 600)`)
  await page.wait(150)
  const sticky = await page.ev<{ strip: number; nav: number }>(`({
    strip: $('[role="radiogroup"][aria-label="Thema"]', analysis()).parentElement.getBoundingClientRect().top,
    nav: sectionNav().getBoundingClientRect().top,
  })`)
  check(
    "Desktop: die Reiterleiste klebt unter der Sprungleiste",
    near(sticky.strip, 56, 1) && near(sticky.nav, 0, 1),
    sticky
  )

  await page.ev(`scrollTo(0, $("#target").getBoundingClientRect().top + scrollY - 56)`)
  await page.wait(150)
  const grid = await page.ev<Record<string, ReturnType<typeof Object>>>(`({
    box: rect($("#target-box")), series: rect($("#series")), table: rect($("#shot-table")),
    readout: rect($("#readout")), scroller: (() => { const s = $("#shot-table > div"); return s.scrollHeight > s.clientHeight })(),
  })`)
  const { box, series, table, readout } = grid as Record<
    string,
    { top: number; bottom: number; left: number; right: number; width: number }
  >
  check(
    "Desktop: Scheibe und Serien passen zusammen ins Fenster, die Schüsse enden mit den Serien",
    series.top > box.bottom &&
      series.bottom <= 900 - 15 &&
      box.width >= 500 &&
      near(table.bottom, series.bottom, 1) &&
      grid.scroller === true,
    `Scheibe ${Math.round(box.width)} px, Serien bis ${Math.round(series.bottom)}, Schüsse bis ${Math.round(table.bottom)}`
  )
  check(
    "Desktop: Schuss und Schüsse rechts neben der Scheibe, die Serien unter ihr",
    readout.left > box.right && table.left > box.right && series.right < readout.left
  )
  await page.ev(`$("#analysis").scrollIntoView({ behavior: "instant" })`)
  await page.wait(100)
  const gone = await page.ev<number>(`$('[data-section="target"]').getBoundingClientRect().bottom`)
  check("Desktop: unter dem Raster scrollt die Scheibe mit weg", gone < 56, Math.round(gone))
  await page.ev(`scrollTo(0, 3000)`)
  await page.wait(100)
  await page.click(`$('nav[aria-label="Abschnitte"] a[href="#target"]')`, { settle: 300 })
  const back = await page.ev<number>(`$("#target").getBoundingClientRect().top`)
  check(
    "Desktop: „Scheibe“ in der Sprungleiste führt nach oben, auch wenn die Scheibe klebt",
    near(back, 56, 3),
    Math.round(back)
  )

  // „Alle Beobachtungen“: der Überblick, die Karte unter den Leisten, der Fokus auf dem Reiter
  await page.ev(`scrollTo(0, 0)`)
  await page.click(`tab("Lage")`)
  await page.ev(`scrollTo(0, 0)`)
  await page.wait(100)
  await page.click(`$("[data-more-observations]")`, { settle: 500 })
  const more = await page.ev<{
    tab: string
    top: number
    bottom: boolean
    focus: string
    checked: string | null
  }>(`({
    tab: activeTab(),
    top: card("beobachtungen")?.getBoundingClientRect().top ?? -1,
    bottom: scrollY + innerHeight >= document.documentElement.scrollHeight - 2,
    focus: txt(document.activeElement), checked: document.activeElement?.getAttribute("aria-checked"),
  })`)
  check(
    "„Alle Beobachtungen“ öffnet den Überblick, die Karte „Beobachtungen“ unter den Leisten, Fokus am Reiter",
    more.tab === "Überblick" &&
      (near(more.top, 112, 3) || (more.top > 112 && more.bottom)) &&
      more.focus === "Überblick" &&
      more.checked === "true",
    more
  )
  await tabStart(page, 112, "Desktop")
  await togglesStay(page, href, "Desktop")

  const cardJargon = await page.ev<string | null>(
    jargonIn(
      '[data-card-header], section[aria-label="Analyse"] [data-tile], section[aria-label="Analyse"] [data-observation]'
    )
  )
  check("Kopf und Überblick der Scheibe: keine Fachbegriffe", cardJargon === null, cardJargon ?? "")

  // Blatt der Hilfe: Karte rechts, Fokus zurück, Escape, Tipp hinein und daneben
  await page.ev(`scrollTo(0, 0)`)
  await page.click(`button("Erklärung: Trefferbild")`, { settle: 300 })
  const opened = await page.ev<{
    open: boolean
    title: string
    right: number
    width: number
    client: number
  }>(`(() => {
    const s = sheet(); const r = s?.getBoundingClientRect()
    return { open: !!s, title: txt(s && $("h2", s)), right: r?.right ?? 0, width: r?.width ?? 0, client: document.documentElement.clientWidth }
  })()`)
  check(
    "„?“ an der Scheibe öffnet die Erklärung „Trefferbild“ als Karte am rechten Rand",
    opened.open &&
      opened.title.startsWith("Trefferbild") &&
      near(opened.right, opened.client - 16, 2) &&
      near(opened.width, 416, 2),
    opened
  )
  await page.click(`button("Schließen", sheet())`, { settle: 300 })
  check(
    "Schließen: Blatt zu, Fokus zurück auf dem „?“",
    await page.ev<boolean>(
      `!sheet() && document.activeElement?.getAttribute("aria-label") === "Erklärung: Trefferbild"`
    )
  )
  await page.click(`button("Erklärung: Trefferbild")`, { settle: 300 })
  await page.key("Escape")
  await page.wait(200)
  check("Escape schließt das Blatt", await page.ev<boolean>(`!sheet()`))
  await page.click(`button("Erklärung: Trefferbild")`, { settle: 300 })
  await page.click(`$("h2", sheet())`, { settle: 200 })
  check("ein Tipp in das Blatt hinein lässt es offen", await page.ev<boolean>(`!!sheet()`))
  await page.clickAt(200, 450)
  await page.wait(300)
  check("ein Tipp neben das Blatt schließt es", await page.ev<boolean>(`!sheet()`))

  // Lineal: Tippen, Ziehen, zweites Tippen, Tastatur, Überfahren, „Auf der Scheibe“
  await page.click(`tab("Zeit und Verlauf")`, { settle: 300 })
  const course = `$('svg[aria-label="Wert je Schuss mit gleitendem Schnitt"]', card("verlauf-und-trend"))`
  const line = () => page.ev<string>(`txt($("[data-readout]", card("verlauf-und-trend")))`)
  await page.ev(`${course}.scrollIntoView({ block: "center", behavior: "instant" })`)
  await page.wait(100)
  const pointAt = (n: number) =>
    page.ev<{ x: number; y: number }>(`(() => {
      const svg = ${course}; const r = svg.getBoundingClientRect()
      const cx = Number($('[data-course-point="${n}"]', svg).getAttribute("cx"))
      return { x: r.left + (cx / svg.viewBox.baseVal.width) * r.width, y: r.top + r.height / 2 }
    })()`)
  const last = await page.ev<number>(`$$("[data-course-point]", ${course}).length`)
  check("Lineal: ohne Wahl der Hinweis", (await line()).includes("Tippe oder ziehe"), await line())
  const p23 = await pointAt(23)
  await page.clickAt(p23.x, p23.y)
  await page.wait(100)
  check(
    "Lineal: Antippen von Punkt 23 nennt ihn und zeigt die Linie",
    (await line()).includes("Schuss 23 · ") &&
      (await page.ev<boolean>(`!!$("[data-ruler]", ${course})`)),
    (await line()).slice(0, 40)
  )
  check(
    "Lineal: das Diagramm hat den Fokus und ist nicht markierbar",
    await page.ev<boolean>(`document.activeElement === ${course} && getComputedStyle(${course}).userSelect === "none" &&
      getComputedStyle(${course}).touchAction === "pan-y"`)
  )
  await page.drag([await pointAt(10), await pointAt(20), await pointAt(30)])
  await page.wait(100)
  check(
    "Lineal: Ziehen von 10 bis 30 wandert mit",
    (await line()).includes("Schuss 30 · "),
    (await line()).slice(0, 30)
  )
  const p30 = await pointAt(30)
  await page.clickAt(p30.x, p30.y)
  await page.wait(100)
  check(
    "Lineal: zweites Tippen auf denselben Punkt hebt die Wahl auf",
    (await line()).includes("Tippe oder ziehe") &&
      !(await page.ev<boolean>(`!!$("[data-ruler]", ${course})`))
  )
  const p14 = await pointAt(14)
  await page.clickAt(p14.x, p14.y)
  await page.wait(100)
  const keys: string[] = []
  const lastKey = () => page.ev<{ key: string; taken: boolean }>(`window.__keys.at(-1)`)
  await page.key("ArrowRight")
  keys.push(await line())
  await page.key("End")
  keys.push(await line())
  await page.key("ArrowLeft", ["alt"])
  const alt = await lastKey()
  keys.push(await line())
  const y0 = await page.ev<number>("scrollY")
  await page.key("ArrowDown")
  const down = await lastKey()
  await page.ev(`scrollTo(0, ${y0})`)
  await page.key("Escape")
  keys.push(await line())
  await page.key("Escape")
  const escape = await lastKey()
  check(
    "Lineal: Tastatur wandert, Escape hebt auf; Alt+Pfeil, Pfeil runter und Escape ohne Wahl bleiben dem Browser",
    keys[0].includes("Schuss 15 · ") &&
      keys[1].includes(`Schuss ${last} · `) &&
      !alt.taken &&
      keys[2].includes(`Schuss ${last} · `) &&
      !down.taken &&
      keys[3].includes("Tippe oder ziehe") &&
      !escape.taken,
    keys.map((k) => k.slice(0, 10)).join(" | ")
  )
  const p20 = await pointAt(20)
  await page.hover(p20.x, p20.y)
  await page.wait(80)
  check("Lineal: Überfahren ohne Druck wählt nichts", (await line()).includes("Tippe oder ziehe"))
  await page.clickAt(p14.x, p14.y)
  await page.wait(100)
  await page.click(`button("Auf der Scheibe", card("verlauf-und-trend"))`, { settle: 600 })
  check(
    "Lineal: „Auf der Scheibe“ wählt Schuss 14 dort",
    (await page.ev<string>(`txt($("#readout"))`)).includes("Schuss 14 · angetippt"),
    (await page.ev<string>(`txt($("#readout"))`)).slice(0, 40)
  )
  check(
    "Desktop 1280: kein seitliches Scrollen",
    await page.ev<boolean>(`document.documentElement.scrollWidth <= 1280`)
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Anker beim Laden, Platz für die Scheibe
// ─────────────────────────────────────────────────────────────────────────────

async function anchorsAndFit(page: Page, href: string) {
  await page.viewport(800, 900)
  await page.goto(`${BASE}${href}#position`)
  await page.wait(300)
  const anchored = await page.ev<{ tab: string; top: number }>(
    `({ tab: activeTab(), top: $("#analysis").getBoundingClientRect().top })`
  )
  check(
    "Anker #position öffnet den Reiter Lage und zeigt die Analyse",
    anchored.tab === "Lage" && anchored.top < 300,
    anchored
  )
  await page.click(`tab("Zeit und Verlauf")`, { settle: 300 })
  const hash = await page.ev<string>("location.hash")
  check("Ein Reiterwechsel schreibt den Anker", hash === "#time", hash)

  await page.viewport(375, 812)
  await page.goto(`${BASE}${href}#shots`)
  await page.wait(300)
  const shotsTop = await page.ev<number>(`$("#shots").getBoundingClientRect().top`)
  check(
    "Anker #shots beim Laden: die Schüsse unter der Leiste",
    near(shotsTop, 56, 3),
    Math.round(shotsTop)
  )

  for (const [width, height, withSeries] of [
    [812, 375, false],
    [1024, 600, true],
    [1024, 768, true],
  ] as const) {
    await page.viewport(width, height)
    await page.goto(`${BASE}${href}`)
    await page.ev(`scrollTo(0, $("#target").getBoundingClientRect().top + scrollY - 56)`)
    await page.wait(150)
    const fit = await page.ev<{ sw: number; top: number; bottom: number; series: number }>(`({
      sw: document.documentElement.scrollWidth, top: $("#target-box").getBoundingClientRect().top,
      bottom: $("#target-box").getBoundingClientRect().bottom, series: $("#series").getBoundingClientRect().bottom })`)
    check(
      `${width} × ${height}: kein seitliches Scrollen, die Scheibe passt unter die Leiste${withSeries ? ", die Serien darunter auch" : ""}`,
      fit.sw <= width &&
        near(fit.top - 15, 56, 1) &&
        fit.bottom <= height &&
        fit.series <= height === withSeries,
      fit
    )
  }
  await page.viewport(768, 700)
  await page.goto(`${BASE}${href}`)
  await page.ev(`scrollTo(0, $("#target").getBoundingClientRect().top + scrollY - 56)`)
  await page.wait(150)
  const tablet = await page.ev<{ box: number; series: number }>(`({
    box: $("#target-box").getBoundingClientRect().bottom, series: $("#series").getBoundingClientRect().bottom })`)
  check(
    "768 × 700: Scheibe und Serien enden über der unteren Leiste",
    tablet.box <= 700 - 72 && tablet.series <= 700 - 72,
    tablet
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Telefon
// ─────────────────────────────────────────────────────────────────────────────

async function phoneCard(page: Page, href: string) {
  await page.viewport(375, 812)
  await page.goto(`${BASE}${href}`)
  const first = await page.ev<{ head: number; target: number; gap: number }>(`(() => {
    const head = $("[data-card-header]").getBoundingClientRect().top
    const target = $("#target-box").getBoundingClientRect().bottom
    const gap = $("#series").getBoundingClientRect().top - $('[data-section="target"] > *').getBoundingClientRect().bottom
    return { head, target, gap }
  })()`)
  check(
    "Telefon 375 px: Kopf mit Ergebnis und Scheibe über der unteren Leiste, die Serien direkt danach",
    first.target - first.head <= 812 - 72 && first.gap >= 0 && first.gap <= 30,
    first
  )
  const tabs = await page.ev<string[]>(
    `$$('[role="radiogroup"][aria-label="Thema"] [role="radio"]').map(txt)`
  )
  const wide: string[] = []
  for (const label of tabs) {
    await page.click(`tab(${JSON.stringify(label)})`, { settle: 250 })
    const sw = await page.ev<{ sw: number; tabIn: boolean; widest: string[] }>(`(() => {
      const strip = $('[role="radiogroup"][aria-label="Thema"]').getBoundingClientRect()
      const t = tab(${JSON.stringify(label)}).getBoundingClientRect()
      return { sw: document.documentElement.scrollWidth, tabIn: t.left >= strip.left - 1 && t.right <= strip.right + 1, widest: widest(375) }
    })()`)
    if (sw.sw > 375 || !sw.tabIn)
      wide.push(`${label}: ${sw.sw} ${sw.tabIn ? "" : "Reiter außerhalb"} ${sw.widest.join(" | ")}`)
  }
  check(
    "Telefon 375 px: kein seitliches Scrollen in keinem Reiter, der gewählte Reiter im Bild",
    wide.length === 0,
    wide.join(" · ")
  )
  await tabStart(page, 56, "Telefon 375 px")
  await togglesStay(page, href, "Telefon 375 px")

  // Rücksprung: der Knopf der Ellipse aus „Lage“ holt die Scheibe, die Pille bringt zurück
  await page.click(`tab("Lage")`, { settle: 250 })
  await page.ev(
    `($("#analysis").scrollIntoView({ block: "start", behavior: "instant" }), scrollBy(0, 200))`
  )
  await page.wait(250)
  const origin = await page.ev<number>("scrollY")
  const ellipse = `$$("button", card("lage-echt")).find((b) => txt(b).includes("Vertrauensellipse"))`
  await page.click(ellipse, { scroll: false, settle: 1200 })
  const jumped = await page.ev<{ top: number; pill: string; pillBottom: number }>(`({
    top: $('[data-section="target"]').getBoundingClientRect().top, pill: txt(pill()),
    pillBottom: pill()?.parentElement.getBoundingClientRect().bottom ?? 9999 })`)
  check(
    "Telefon: die Ellipse aus „Lage“ bringt die Scheibe ins Bild und die Pille „Zurück zu „Lage““ über der unteren Leiste",
    near(jumped.top, 56, 3) && jumped.pill === "Zurück zu „Lage“" && jumped.pillBottom <= 812 - 72,
    jumped
  )
  await page.click(`pill()`, { scroll: false, settle: 1200 })
  const returned = await page.ev<{ y: number; pill: boolean; focus: boolean; live: boolean }>(`({
    y: scrollY, pill: !!pill(), focus: document.activeElement === ${ellipse},
    live: !!$('[role="status"][aria-live="polite"].sr-only') })`)
  check(
    "Telefon: die Pille bringt zurück und verschwindet, der Fokus liegt wieder auf dem Knopf, der Sprung war angesagt",
    near(returned.y, origin, 60) && !returned.pill && returned.focus && returned.live,
    { ...returned, origin }
  )

  // „Auf der Scheibe“ im Lineal: Sprung zur Scheibe, die Pille nennt den Reiter
  await page.click(`tab("Zeit und Verlauf")`, { settle: 300 })
  const course = `$('svg[aria-label="Wert je Schuss mit gleitendem Schnitt"]', card("verlauf-und-trend"))`
  await page.ev(`${course}.scrollIntoView({ block: "center", behavior: "instant" })`)
  await page.wait(150)
  const p = await page.ev<{ x: number; y: number }>(`(() => {
    const svg = ${course}; const r = svg.getBoundingClientRect()
    const cx = Number($('[data-course-point="14"]', svg).getAttribute("cx"))
    return { x: r.left + (cx / svg.viewBox.baseVal.width) * r.width, y: r.top + r.height / 2 }
  })()`)
  await page.clickAt(p.x, p.y)
  await page.wait(150)
  await page.click(`button("Auf der Scheibe", card("verlauf-und-trend"))`, { settle: 1000 })
  const ruled = await page.ev<{ pill: string; top: number }>(
    `({ pill: txt(pill()), top: $('[data-section="target"]').getBoundingClientRect().top })`
  )
  check(
    "Telefon: „Auf der Scheibe“ springt zur Scheibe, die Pille führt zurück zu „Zeit und Verlauf“",
    ruled.pill.includes("Zeit und Verlauf") && ruled.top < 400,
    ruled
  )
  await page.click(`pill()`, { scroll: false, settle: 1000 })

  // „Alle Beobachtungen“ auf dem Telefon und das Blatt von unten
  await page.viewport(390, 844)
  await page.goto(`${BASE}${href}`)
  await page.click(`$("[data-more-observations]")`, { settle: 500 })
  const more = await page.ev<{ top: number; bottom: boolean }>(`({
    top: card("beobachtungen")?.getBoundingClientRect().top ?? -1,
    bottom: scrollY + innerHeight >= document.documentElement.scrollHeight - 2 })`)
  check(
    "Telefon 390 px: „Alle Beobachtungen“ bringt die Karte „Beobachtungen“ sichtbar unter die Reiterleiste",
    near(more.top, 56, 3) || (more.top > 56 && more.bottom),
    more
  )
  await page.click(`$$('button[aria-label^="Erklärung"]', analysis()).find(visible)`, {
    settle: 400,
  })
  const sheet = await page.ev<{
    bottom: number
    width: number
    ch: number
    cw: number
  } | null>(`(() => {
    const s = sheet(); if (!s) return null; const r = s.getBoundingClientRect()
    return { bottom: r.bottom, width: r.width, ch: document.documentElement.clientHeight, cw: document.documentElement.clientWidth }
  })()`)
  check(
    "Telefon: das Blatt der Hilfe kommt von unten über die volle Breite",
    !!sheet && near(sheet.bottom, sheet.ch, 1) && near(sheet.width, sheet.cw, 1),
    sheet ?? "kein Blatt"
  )
}

const record = (checks: Check[]) => {
  for (const c of checks) check(c.name, c.ok, c.detail)
}

async function phoneNoSideScroll(page: Page) {
  record(
    await noSideScroll(page, {
      base: BASE,
      paths: ["/", "/cards", "/progress", "/compare", "/compare?type=cards", "/compare?type=kind"],
      widths: [390, 375],
    })
  )
}

/**
 * Die Prüfungen aus `@vereinsheim/pruefen/common`, die jede App mit Design 2 laufen lässt: Darstellung ohne Aufblitzen,
 * die untere Leiste verdeckt nichts, Fokus im Dialog „Scheibe löschen“, die Liste der Scheiben als Zeilen.
 */
async function commonChecks(page: Page, href: string) {
  await page.viewport(1280, 900)
  record(await themeNoFlash(page, { url: `${BASE}/`, storageKey: "spiegel-theme" }))
  await page.viewport(390, 844)
  for (const path of ["/", "/cards", href]) {
    await page.goto(`${BASE}${path}`)
    record([await barDoesNotCover(page, `Telefon ${path}`)])
  }
  await page.viewport(1280, 900)
  await page.goto(`${BASE}${href}`)
  record(await dialogFocus(page, `button("Scheibe löschen")`, "Dialog „Scheibe löschen“"))
  await page.goto(`${BASE}/cards`)
  const rows = await pageText(page, "main ul, main table")
  check("Liste der Scheiben als Zeilen lesbar", rows.length >= 3, rows.slice(0, 3).join(" · "))
}

/**
 * Blatt „Filter“ unter Scheiben: Das Blatt scrollt nicht seitlich, jeder Knopf von Art, Liste und Merkmal liegt in
 * ihm, am Telefon und am Desktop. Die Dev-Daten haben meist keine Listen, das steht dann als „nicht belegt“ in der
 * Zeile.
 */
async function listFilterSheet(page: Page) {
  const outside: string[] = []
  const shown: string[] = []
  for (const [width, height] of [
    [375, 812],
    [1280, 900],
  ] as const) {
    await page.viewport(width, height)
    await page.goto(`${BASE}/cards`)
    await page.click(`$("[data-list-chip]")`, { settle: 400 })
    const sheet = await page.ev<{
      scroll: number
      client: number
      out: string[]
      groups: string[]
    }>(`(() => {
      const dialog = $("[data-list-filter]").closest("dialog")
      const box = dialog.getBoundingClientRect()
      const groups = $$('[role="radiogroup"]', dialog)
      const out = groups.flatMap((g) => $$("button", g).filter((b) => {
        const r = b.getBoundingClientRect()
        return r.left < box.left - 0.5 || r.right > box.right + 0.5
      }).map((b) => g.getAttribute("aria-label") + " " + txt(b)))
      return { scroll: dialog.scrollWidth, client: dialog.clientWidth, out,
        groups: groups.map((g) => g.getAttribute("aria-label") + " " + $$("button", g).length) }
    })()`)
    if (sheet.scroll > sheet.client + 1)
      outside.push(`${width} px: Blatt ${sheet.scroll} > ${sheet.client}`)
    outside.push(...sheet.out.map((o) => `${width} px: ${o}`))
    shown.push(`${width} px: ${sheet.groups.join(", ")}`)
    await page.key("Escape")
  }
  check(
    `Blatt „Filter“ unter Scheiben: kein seitliches Scrollen, jeder Knopf im Blatt${[
      "Liste",
      "Merkmal",
    ]
      .filter((group) => !shown.some((s) => s.includes(group)))
      .map((group) => ` (${group} nicht belegt: keine in den Daten)`)
      .join("")}`,
    outside.length === 0,
    outside.length ? outside.join(" · ") : shown.join(" · ")
  )
}

/**
 * „Offen“ und die Leiste: Das Demo-Konto hat nichts Wartendes, also sagt „Offen“ das; Scannen steht ohne den QR-Weg
 * nicht in der Navigation, die untere Leiste hat vier Felder.
 */
async function openAndBar(page: Page) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}/open`)
  const open = await page.ev<{ empty: boolean; cards: number }>(
    `({ empty: !!$("[data-open-empty]"), cards: document.querySelectorAll("[data-pending-card]").length })`
  )
  check(
    "Offen: ohne Wartendes „Nichts zu prüfen.“",
    open.empty && open.cards === 0,
    JSON.stringify(open)
  )
  await page.viewport(375, 812)
  await page.goto(`${BASE}/`)
  const bar = await page.ev<{ areas: string[]; scan: number }>(
    `({ areas: [...document.querySelectorAll("[data-app-bar] [data-area]")].map((a) => a.dataset.area),
        scan: document.querySelectorAll('[data-area="scan"]').length })`
  )
  check(
    "Telefon: untere Leiste ohne Scannen",
    bar.scan === 0 && bar.areas.join(",") === "start,cards,progress,profile",
    JSON.stringify(bar)
  )
}

/** das Demo-Konto ist kein Admin: `/admin` führt zum Start, nicht zur Anmeldung */
async function adminWithoutRole(page: Page) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}/admin`)
  const path = await page.ev<string>("location.pathname")
  check("Admin ohne Rolle: Start statt Anmeldung", path === "/", path)
}

// ─────────────────────────────────────────────────────────────────────────────
// Löschen, Rückgängig und Papierkorb: ohne endgültiges Löschen, die Demo-Daten bleiben vollständig
// ─────────────────────────────────────────────────────────────────────────────

async function trash(page: Page) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}/cards`)
  const href = await page.ev<string | null>(
    `$('a[href^="/cards/c"]')?.getAttribute("href") ?? null`
  )
  if (!href) throw new Error("keine Scheibe in der Liste des Demo-Kontos")
  const id = href.split("?")[0].split("/")[2]
  const listed = `!!$('a[href^="/cards/${id}"]')`
  const deleteFromPage = async () => {
    await page.goto(`${BASE}${href}`)
    await page.click(`button("Scheibe löschen")`)
    await page.waitFor(`!!$('[role="alertdialog"]')`)
    const dialog = await page.ev<string>(`txt($('[role="alertdialog"]'))`)
    await page.click(`button("Löschen", $('[role="alertdialog"]'))`)
    await page.waitFor(
      `!!$("[data-undo-bar]") && location.pathname !== ${JSON.stringify(`/cards/${id}`)}`
    )
    return dialog
  }

  const dialog = await deleteFromPage()
  check(
    "Löschen: Dialog nennt Papierkorb, 30 Tage und das Ende",
    dialog.includes("30 Tage im Papierkorb") && dialog.includes("löscht Spiegel sie endgültig"),
    dialog.slice(0, 160)
  )
  // ein später Redirect der mitgerenderten Seite (in den Papierkorb) gewönne sonst unbemerkt
  await page.wait(1_500)
  const after = await page.ev<{ path: string; bar: string; listed: boolean }>(
    `({ path: location.pathname, bar: txt($("[data-undo-bar]")), listed: ${listed} })`
  )
  check(
    "Löschen: zurück in der Liste, „Scheibe gelöscht · Rückgängig“, die Scheibe fehlt",
    after.path === "/cards" && after.bar.includes("Scheibe gelöscht") && !after.listed,
    JSON.stringify(after)
  )
  await page.click(`button("Rückgängig", $("[data-undo-bar]"))`)
  check(
    "Rückgängig: der Hinweis geht, die Scheibe steht wieder in der Liste",
    await page.waitFor(`!$("[data-undo-bar]") && ${listed}`),
    ""
  )

  await deleteFromPage()
  await page.goto(`${BASE}${href}`, '$("[data-app-frame]")')
  check(
    "Alte Adresse einer gelöschten Scheibe führt in den Papierkorb",
    await page.waitFor(`location.pathname === "/profile/trash"`),
    await page.ev<string>(`location.pathname`)
  )
  await page.goto(`${BASE}/profile/trash`)
  const row = await page.ev<string>(`txt($("[data-trash-card]"))`)
  check("Papierkorb: die Scheibe mit „noch 30 Tage“", row.includes("noch 30 Tage"), row)
  const rows = await page.ev<number>(`$$("[data-trash-card]").length`)
  await page.click(`button("Wiederherstellen", $("[data-trash-card]"))`)
  await page.waitFor(`$$("[data-trash-card]").length < ${rows}`)
  await page.goto(`${BASE}/cards`)
  check(
    "Wiederherstellen: die Scheibe steht wieder in der Liste",
    await page.ev<boolean>(listed),
    id
  )
}

/**
 * Disziplin einer Scheibe: Der Abschnitt nennt sie; gibt es eine andere mit derselben Scheibe, öffnet „Disziplin ändern“
 * das Blatt, Esc schließt es ohne Änderung, eine Wahl fragt mit Folgen, „Ändern“ stellt um und „Zurückstellen“ zurück.
 */
async function cardDiscipline(page: Page, href: string) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}${href}`)
  const name = () => page.ev<string>(`txt($("[data-discipline-name]"))`)
  const before = await name()
  check("Disziplin: der Abschnitt nennt sie", before.length > 0, before)
  if (!(await page.ev<boolean>(`!!button("Disziplin ändern")`))) {
    check("Disziplin ändern (nicht belegt: keine andere Disziplin mit derselben Scheibe)", true)
    return
  }
  await page.click(`button("Disziplin ändern")`, { settle: 300 })
  const options = await page.ev<string[]>(`$$("[data-discipline-option]").map((b) => txt(b))`)
  await page.key("Escape")
  check(
    "Disziplin ändern: das Blatt zeigt die Wahl, Esc schließt ohne Änderung",
    options.length > 1 &&
      (await page.waitFor(`!$("[data-discipline-options]")?.closest("dialog")?.open`)) &&
      (await name()) === before,
    options.join(" · ")
  )
  await page.click(`button("Disziplin ändern")`, { settle: 300 })
  await page.click(
    `$$("[data-discipline-option]").find((b) => b.getAttribute("aria-current") !== "true")`,
    {
      settle: 300,
    }
  )
  await page.waitFor(`!!$('[role="alertdialog"]')`)
  const dialog = await page.ev<string>(`txt($('[role="alertdialog"]'))`)
  await page.click(`button("Ändern", $('[role="alertdialog"]'))`)
  const changed = await page.waitFor(
    `!$('[role="alertdialog"]') && !!$("[data-stand-discipline]") && txt($("[data-discipline-name]")) !== ${JSON.stringify(before)}`
  )
  check(
    "Disziplin ändern: Rückfrage mit Folgen, danach die neue und „Am Stand gewählt“",
    dialog.includes("Die Werte der Schüsse bleiben") && changed,
    `${dialog.slice(0, 120)} → ${await name()}`
  )
  await page.click(`button("Disziplin ändern")`, { settle: 300 })
  await page.click(
    `$$("[data-discipline-option]").find((b) => txt(b).includes("am Stand gewählt"))`,
    {
      settle: 300,
    }
  )
  await page.waitFor(`!!$('[role="alertdialog"]')`)
  await page.click(`button("Zurückstellen", $('[role="alertdialog"]'))`)
  check(
    "Disziplin zurückstellen: wieder die vom Stand, ohne Zeile zum Stand",
    await page.waitFor(
      `!$('[role="alertdialog"]') && !$("[data-stand-discipline]") && txt($("[data-discipline-name]")) === ${JSON.stringify(before)}`
    ),
    await name()
  )
}

/**
 * Teilen per Link: auf der Seite einer Scheibe teilen, den Link in einem Fenster ohne Anmeldung öffnen (nur Ansicht,
 * keine Wege aus der Seite, keine Knöpfe mit Folgen, Analyse und Hilfe gehen), dann das Teilen beenden. Am Ende ist die
 * Scheibe wieder ungeteilt.
 */
async function sharing(browser: Browser, page: Page, href: string) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}${href}`)
  // ein abgebrochener Lauf ließ die Scheibe geteilt: erst beenden
  if (await page.ev<boolean>(`!!button("Teilen beenden")`)) {
    await page.click(`button("Teilen beenden")`)
    await page.waitFor(`!!$('[role="alertdialog"]')`)
    await page.click(`button("Teilen beenden", $('[role="alertdialog"]'))`)
    await page.waitFor(`!!button("Scheibe teilen")`)
  }
  await page.click(`button("Scheibe teilen")`)
  await page.waitFor(`!!$('[role="alertdialog"]')`)
  const dialog = await page.ev<string>(`txt($('[role="alertdialog"]'))`)
  check(
    "Teilen: Dialog sagt, wer was sieht und was nicht",
    dialog.includes("Eine Anmeldung braucht es dafür nicht") &&
      dialog.includes("Dein Name und deine Sportpassnummer stehen nicht dabei") &&
      dialog.includes("Teilen beenden"),
    dialog.slice(0, 200)
  )
  await page.click(`button("Link erstellen", $('[role="alertdialog"]'))`)
  await page.waitFor(`!!$("[data-share-link]") && !$('[role="alertdialog"]')`)
  const link = await page.ev<string>(`txt($("[data-share-link]"))`)
  const path = link.slice(BASE.length)
  check(
    "Teilen: der Link mit UUID, „Geteilt seit“, Kopieren und Beenden",
    /^\/share\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(path) &&
      link.startsWith(BASE) &&
      (await page.ev<boolean>(
        `txt($("[data-share-card]")).includes("Geteilt seit") && !!button("Link kopieren") && !!button("Teilen beenden")`
      )),
    link
  )

  // Zurück bringt die Seite aus dem Cache von Next: Sie muss den Link zeigen, nicht den Stand des ersten Besuchs
  await page.goto(`${BASE}/cards`)
  await page.ev(`history.back()`)
  check(
    "Teilen: nach Weg und Zurück steht der Link weiter da",
    await page.waitFor(
      `location.pathname === ${JSON.stringify(href.split("?")[0])} && txt($("[data-share-link]")) === ${JSON.stringify(link)}`
    ),
    await page.ev<string>(`location.pathname + " " + txt($("[data-share-card]"))`)
  )

  const guest = await browser.newPage({ isolated: true })
  try {
    await guest.viewport(1280, 900)
    const ready = '$("[data-shared-header]")'
    await guest.goto(link, ready)
    const view = await guest.ev<{
      path: string
      shots: number
      leaving: string[]
      frame: boolean
      buttons: string[]
      toggles: number
      status: number
      email: boolean
    }>(`(async () => {
      const r = await fetch(location.href)
      const html = await r.text()
      return {
        path: location.pathname,
        shots: $$("#shot-table tr[data-row]").length,
        leaving: $$("a[href]").map((a) => a.getAttribute("href")).filter((h) => !h.startsWith("#")),
        frame: !!$("[data-app-frame]"),
        buttons: ["Scheibe löschen", "Scheibe teilen", "Teilen beenden", "Link kopieren"].filter((b) => !!button(b)),
        toggles: $$("[data-result-actions], [data-share-card], [data-delete-card]").length,
        status: r.status,
        email: html.includes(${JSON.stringify(DEMO_EMAIL)}),
      }
    })()`)
    check(
      "Geteilte Scheibe ohne Anmeldung: die Scheibe mit Schüssen, Status 200, ohne Konto im HTML",
      view.path === path && view.shots > 0 && view.status === 200 && !view.email,
      view
    )
    check(
      "Geteilte Scheibe: kein Rahmen, kein Link aus der Seite, keine Knöpfe für Art, Wertung, Teilen, Löschen",
      !view.frame && view.leaving.length === 0 && view.buttons.length === 0 && view.toggles === 0,
      view
    )
    await guest.click(`tab("Zeit und Verlauf")`, { settle: 300 })
    const tabbed = await guest.ev<{ tab: string; hash: string; path: string }>(
      `({ tab: activeTab(), hash: location.hash, path: location.pathname })`
    )
    check(
      "Geteilte Scheibe: Reiter der Analyse wechseln, die Adresse bleibt die des Links",
      tabbed.tab === "Zeit und Verlauf" && tabbed.hash === "#time" && tabbed.path === path,
      tabbed
    )
    // in jedem Reiter kein Weg aus der Seite (der Link von σ in den Fortschritt steht nur auf der eigenen Seite)
    const tabLinks: Record<string, string[]> = {}
    for (const label of await guest.ev<string[]>(
      `$$('[role="radiogroup"][aria-label="Thema"] [role="radio"]', analysis()).map(txt)`
    )) {
      await guest.click(`tab(${JSON.stringify(label)})`, { settle: 200 })
      tabLinks[label] = await guest.ev<string[]>(
        `$$("a[href]").map((a) => a.getAttribute("href")).filter((h) => !h.startsWith("#"))`
      )
    }
    check(
      "Geteilte Scheibe: in keinem Reiter ein Link aus der Seite",
      Object.keys(tabLinks).length >= 5 && Object.values(tabLinks).every((l) => l.length === 0),
      tabLinks
    )
    await guest.click(`button("Erklärung: Trefferbild")`, { settle: 300 })
    const help = await guest.ev<string>(`txt(sheet() && $("h2", sheet()))`)
    check("Geteilte Scheibe: das „?“ öffnet die Erklärung", help.startsWith("Trefferbild"), help)
    await guest.key("Escape")
    for (const width of [390, 375]) {
      await guest.viewport(width, 844)
      await guest.goto(link, ready)
      const sw = await guest.ev<{ sw: number; widest: string[] }>(
        `({ sw: document.documentElement.scrollWidth, widest: widest(${width}) })`
      )
      check(
        `Geteilte Scheibe am Telefon ${width} px ohne seitliches Scrollen`,
        sw.sw <= width,
        `${sw.sw} ${sw.widest.join(" | ")}`
      )
    }
    check(
      "Geteilte Scheibe: keine Skriptfehler",
      guest.errors.length === 0,
      guest.errors.slice(0, 5).join(" · ")
    )

    await page.click(`button("Teilen beenden")`)
    await page.waitFor(`!!$('[role="alertdialog"]')`)
    await page.click(`button("Teilen beenden", $('[role="alertdialog"]'))`)
    check(
      "Teilen beenden: zurück zum Knopf „Scheibe teilen“",
      await page.waitFor(`!!button("Scheibe teilen") && !$("[data-share-link]")`),
      ""
    )
    await guest.viewport(1280, 900)
    await guest.goto(link, '$("[data-share-gone]")')
    const gone = await guest.ev<{ status: number; text: string; links: number }>(`(async () => ({
      status: (await fetch(location.href)).status,
      text: txt($("[data-share-gone]")),
      links: $$("a[href]").length,
    }))()`)
    check(
      "Nach dem Beenden: Hinweis statt Scheibe, Status 404, kein Weg in die App",
      gone.status === 404 && gone.text.includes("nicht mehr geteilt") && gone.links === 0,
      gone
    )
  } finally {
    await guest.close()
  }
}

async function language(page: Page) {
  await page.viewport(1280, 900)
  for (const [path, selectors] of [
    ["/", "[data-start-page]"],
    ["/cards", "main"],
    [
      "/progress",
      '[data-period-header], [data-result-box], [data-period-tile], [data-card-readout], #card-list, [data-section="history"]',
    ],
  ] as const) {
    await page.goto(`${BASE}${path}`)
    const found = await page.ev<string | null>(jargonIn(selectors))
    check(`${path}: keine Fachbegriffe auf den ersten Ebenen`, found === null, found ?? "")
  }
  await page.goto(`${BASE}/progress`)
  if (await page.ev<boolean>(`!!button("je Monat")`)) {
    await page.click(`button("je Monat")`, { settle: 600 })
    const month = await page.ev<string | null>(jargonIn('[data-section="history"]'))
    check("/progress je Monat: keine Fachbegriffe", month === null, month ?? "")
  }

  // jedes Thema der Hilfe über viele Scheiben hat einen Platz im Fortschritt (sonst prüft das kein Test)
  // manche erscheinen nur in einem Zustand: der Vergleich nur mit Vergleich, der Abstand zum Schnitt an einer Scheibe
  // mit Scheiben davor; gesammelt wird über die Zustände
  const shown = new Set<string>()
  const collect = async () => {
    for (const id of await page.ev<string[]>(`$$("[data-help]").map((el) => el.dataset.help)`))
      shown.add(id)
  }
  await page.goto(`${BASE}/progress`)
  await collect()
  const middle = await page.ev<string | null>(`(() => { const rows = $$("[data-card-row]")
    return rows[Math.floor(rows.length / 2)]?.dataset.cardRow ?? null })()`)
  if (middle) {
    await page.click(`$('[data-card-row="${middle}"] button')`, { settle: 500 })
    await collect()
  }
  // „Vergleichen mit“ gibt es im Fortschritt nicht mehr: Vergleiche laufen über die Seite Vergleichen (`compare`)
  const picker = await page.ev<boolean>(`(() => { $("[data-period-chip]")?.click()
    return $$("[data-period-picker] legend").some((l) => txt(l) === "Vergleichen mit") })()`)
  check("Fortschritt: kein „Vergleichen mit“ im Blatt Filter", !picker)
  await page.goto(`${BASE}/progress`)
  // die Reiter Präzision und Lage der Analyse, mit dem Trefferbild geladen
  for (const label of ["Präzision", "Lage"]) {
    await page.click(`tab(${JSON.stringify(label)})`, { settle: 300 })
    await page.waitFor(
      `$$("[data-card]", analysis()).every((c) => !c.textContent.includes("gerechnet"))`,
      15_000
    )
    await collect()
  }
  const missing = PERIOD_TOPICS.filter((id) => !shown.has(id))
  check(
    "Fortschritt: jedes Thema der Hilfe über viele Scheiben hat ein „?“",
    missing.length === 0,
    missing.join(", ")
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Blättern, Rückwege
// ─────────────────────────────────────────────────────────────────────────────

async function paging(page: Page, href: string) {
  await page.viewport(1280, 900)
  // der Reiter einmal gewählt, einmal aus dem Anker beim Laden: beides gilt nur für diese Scheibe
  await page.goto(`${BASE}${href}`)
  await page.click(`tab("Lage")`, { settle: 300 })
  const before0 = await page.ev<string>("location.pathname")
  await page.click(`link("Nächste Scheibe")`, { settle: 300 })
  await page.waitFor(
    `location.pathname !== ${JSON.stringify(before0)} && !!tab("Überblick")`,
    10_000
  )
  await page.wait(400)
  const chosenNext = await page.ev<{ tab: string; hash: string }>(
    `({ tab: activeTab(), hash: location.hash })`
  )
  check(
    "Blättern nach einem gewählten Reiter: die nächste Scheibe beginnt mit „Überblick“",
    chosenNext.tab === "Überblick" && !TAB_ANCHORS.includes(chosenNext.hash),
    chosenNext
  )
  await page.goto(`${BASE}${href}#position`)
  await page.wait(300)
  const zoomed = () =>
    page.ev<boolean>(`button("Auf Gruppe zoomen")?.getAttribute("aria-pressed") === "true"`)
  if (!(await zoomed())) await page.click(`button("Auf Gruppe zoomen")`, { settle: 600 })
  const before = await page.ev<string>("location.pathname")
  await page.click(`link("Nächste Scheibe")`, { settle: 300 })
  await page.waitFor(
    `location.pathname !== ${JSON.stringify(before)} && hydrated($("[data-app-frame]"))`,
    10_000
  )
  await page.waitFor(`!!tab("Überblick")`, 10_000)
  await page.wait(400)
  const next = await page.ev<{ path: string; tab: string; hash: string; viewBox: string }>(`({
    path: location.pathname, tab: activeTab(), hash: location.hash,
    viewBox: $("#target-box svg").getAttribute("viewBox") })`)
  check(
    "Blättern: die nächste Scheibe beginnt mit „Überblick“, ohne Reiter in der Adresse",
    next.path !== before && next.tab === "Überblick" && !TAB_ANCHORS.includes(next.hash),
    next
  )
  check("Blättern: der Ausschnitt „Gruppe“ bleibt", await zoomed())
  await page.click(`tab("Zeit und Verlauf")`, { settle: 300 })
  check(
    "Blättern: das Lineal der neuen Scheibe beginnt ohne Wahl",
    (await page.ev<string>(`txt($("[data-readout]", card("verlauf-und-trend")))`)).includes(
      "Tippe oder ziehe"
    )
  )
  // Ausschnitt zurück auf die ganze Scheibe (der Cookie gilt nur in diesem Profil, trotzdem sauber hinterlassen)
  if (await zoomed()) await page.click(`button("Auf Gruppe zoomen")`, { settle: 300 })
}

async function backPaths(page: Page) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}/cards`)
  const links = await page.ev<number>(`$$('a[href^="/cards/c"]').length`)
  const index = Math.min(links - 1, Math.max(8, Math.floor(links * 0.6)))
  const target = await page.ev<string>(`$$('a[href^="/cards/c"]')[${index}].getAttribute("href")`)
  const id = target.split("?")[0].split("/").at(-1)!
  await page.click(`$$('a[href^="/cards/c"]')[${index}]`, { settle: 300 })
  await page.waitFor(
    `location.pathname === "/cards/${id}" && !!link("Zurück zu „Scheiben“")`,
    10_000
  )
  await page.wait(300)
  await page.click(`link("Zurück zu „Scheiben“")`, { settle: 300 })
  await page.waitFor(`location.pathname === "/cards"`, 10_000)
  await page.wait(600)
  const row = await page.ev<{
    marked: boolean
    top: number
    bottom: number
    h: number
  } | null>(`(() => {
    const el = $('[aria-current][data-marked], tr[aria-current]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { marked: el.closest("tr")?.querySelector('a[href*="${id}"]') !== null, top: r.top, bottom: r.bottom, h: innerHeight }
  })()`)
  check(
    "Zurück zu „Scheiben“: die geöffnete Scheibe ist markiert und im Bild",
    !!row && row.marked && row.top >= 0 && row.bottom <= row.h,
    row ?? "keine Markierung"
  )

  // Fortschritt → „Scheibe öffnen“ → „Zurück zu …“: wieder gewählt
  await page.goto(`${BASE}/progress`)
  const chosenBefore = await page.ev<string | null>(
    `$("[data-card-readout]")?.dataset.cardReadout ?? null`
  )
  await page.click(`link("Scheibe öffnen", $("[data-card-readout]"))`, { settle: 300 })
  await page.waitFor(
    `location.pathname.startsWith("/cards/") && hydrated($("[data-app-frame]"))`,
    10_000
  )
  await page.wait(300)
  const backLink = await page.ev<string | null>(
    `$$("a[href]").map((a) => a.getAttribute("aria-label") ?? "").find((l) => l.startsWith("Zurück zu")) ?? null`
  )
  if (!backLink) throw new Error("kein Rückweg auf der Scheibe")
  await page.click(`link(${JSON.stringify(backLink)})`, { settle: 300 })
  await page.waitFor(`location.pathname === "/progress" && !!$("[data-card-readout]")`, 10_000)
  await page.wait(500)
  const chosenAfter = await page.ev<string | null>(
    `$("[data-card-readout]")?.dataset.cardReadout ?? null`
  )
  check(
    "Fortschritt → Scheibe → zurück: die Ablesung zeigt wieder dieselbe Scheibe",
    !!chosenBefore && chosenAfter === chosenBefore,
    `${chosenBefore} → ${chosenAfter}`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Fortschritt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Eine Scheibe sagt, was sie zeigt: die Ermüdung mit Urteil, σ mit dem Weg in den Fortschritt (Familie der Scheibe,
 * Kennzahl „Streuung“)
 */
async function singleCardHints(page: Page, href: string) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}${href}#time`)
  await page.wait(300)
  const verdict = await page.ev<string>(`txt(card("ermuedung")?.querySelector("[data-verdict]"))`)
  check(
    "Ermüdung: Urteil als Etikett",
    ["klar schwächer", "klar stärker", "kann Zufall sein"].includes(verdict),
    verdict
  )
  // jede Pause mit einem Ø danach (nicht 0,00, das steht ohne Vorzeichen) trägt ihr Urteil
  const pauses = await page.ev<{ rows: number; labelled: number; labels: string[] }>(`(() => {
    const rows = $$("dd", card("pausen") ?? document.createElement("div"))
      .filter((dd) => /Pause · danach Ø [+−]/.test(txt(dd)))
    const labels = rows.map((dd) => txt(dd.querySelector("[data-verdict]")))
    return { rows: rows.length, labelled: labels.filter(Boolean).length, labels }
  })()`)
  check(
    "Pausen: jede Pause mit ihrem Urteil",
    pauses.rows > 0 &&
      pauses.labelled === pauses.rows &&
      pauses.labels.every((l) =>
        ["klar schwächer", "klar stärker", "kann Zufall sein"].includes(l)
      ),
    pauses.rows > 0 ? pauses : "keine Pause mit Ø auf dieser Scheibe (nicht belegt)"
  )
  await page.click(`tab("Präzision")`, { settle: 300 })
  const target = await page.ev<string | null>(
    `link("Streuung im Fortschritt ›", card("praezision-sigma"))?.getAttribute("href") ?? null`
  )
  check("σ: Link „Streuung im Fortschritt ›“", target !== null, target ?? "kein Link")
  if (!target) return
  await page.click(`link("Streuung im Fortschritt ›", card("praezision-sigma"))`, { settle: 300 })
  const arrived = await page.waitFor(`location.pathname === "/progress"`, 8_000)
  await page.waitFor(`!!$('[role="radiogroup"][aria-label="Kennzahl"] [aria-checked="true"]')`)
  const where = await page.ev<{ path: string; search: string; metric: string }>(`({
    path: location.pathname,
    search: location.search,
    metric: txt($('[role="radiogroup"][aria-label="Kennzahl"] [aria-checked="true"]')),
  })`)
  check(
    "σ: der Link öffnet Fortschritt mit Familie und „Streuung“",
    arrived &&
      where.path === "/progress" &&
      /[?&]metric=sigma\b/.test(where.search) &&
      /[?&]family=/.test(where.search) &&
      where.metric === "Streuung",
    where
  )
}

async function progress(page: Page) {
  for (const [width, height, shown] of [
    [390, 844, "[data-card-line]"],
    [1440, 1400, "[data-card-readout]"],
  ] as const) {
    await page.viewport(width, height)
    await page.goto(`${BASE}/progress`)
    const record = await page.ev<string | null>(`(() => {
      const chosen = $("[data-card-readout]")?.dataset.cardReadout
      const row = $$("[data-records-new] [data-record]").find((r) => r.dataset.recordCard !== chosen)
      return row?.dataset.recordCard ?? null
    })()`)
    if (!record) {
      check(
        `${width} px: „zeigen“ an einem Rekord`,
        false,
        "kein neuer Rekord in den Daten (nicht belegt)"
      )
      continue
    }
    await page.click(
      `$$("[data-records-new] [data-record]").find((r) => r.dataset.recordCard === ${JSON.stringify(record)}).querySelector("button")`,
      { settle: 600 }
    )
    const attr = shown.slice(1, -1)
    const where = await page.ev<{
      id: string | null
      top: number
      bottom: number
      edge: number
    } | null>(`(() => {
      const el = $(${JSON.stringify(shown)}); if (!el) return null
      const r = el.getBoundingClientRect()
      return { id: el.getAttribute(${JSON.stringify(attr)}), top: r.top, bottom: r.bottom, edge: innerHeight - (innerWidth < 1024 ? 72 : 0) }
    })()`)
    check(
      `${width} px: „zeigen“ an einem Rekord wählt die Scheibe, ihre Ablesung steht ganz im Bild unter der Sprungleiste`,
      !!where && where.id === record && where.top >= 54 && where.bottom <= where.edge + 2,
      where ?? "keine Ablesung"
    )
  }

  // Verlauf und Liste teilen die Wahl
  await page.viewport(1440, 1400)
  await page.goto(`${BASE}/progress`)
  const point = await page.ev<{ id: string; x: number; y: number } | null>(`(() => {
    const points = $$("[data-card-point]")
    const g = points[Math.floor(points.length / 2)]
    if (!g) return null
    const r = g.querySelector("circle:last-child").getBoundingClientRect()
    return { id: g.dataset.cardPoint, x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
  if (point) {
    await page.ev(
      `$('[data-card-point="${point.id}"]').scrollIntoView({ block: "center", behavior: "instant" })`
    )
    await page.wait(100)
    const again = await page.ev<{ x: number; y: number }>(`(() => {
      const r = $('[data-card-point="${point.id}"] circle:last-child').getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
    await page.clickAt(again.x, again.y)
    await page.wait(400)
    check(
      "Fortschritt: ein Tipp in den Verlauf wählt die Scheibe für Ablesung und Liste",
      await page.ev<boolean>(`$("[data-card-readout]")?.dataset.cardReadout === ${JSON.stringify(point.id)} &&
        $('[data-card-row="${point.id}"]')?.dataset.chosen === "true"`),
      point.id
    )
  } else check("Fortschritt: Verlauf mit Punkten", false, "keine Punkte")
  // Scheiben eines Abends stehen fast übereinander: ein Tipp wählt die getroffene, nicht die nach x nächste, in
  // Ablesung und Liste. Die gerade gewählte kommt zuletzt dran, ein Tipp auf sie höbe ihre Wahl auf
  const stack = await page.ev<string[]>(`(() => {
    const at = $$("[data-card-point]").map((g) => {
      const r = g.querySelector("circle:last-child").getBoundingClientRect()
      return { id: g.dataset.cardPoint, x: r.left + r.width / 2 }
    })
    const group = at.filter((p) => at.some((q) => q !== p && Math.abs(q.x - p.x) < 4))
    return group.length ? group.filter((p) => Math.abs(p.x - group[0].x) < 4).map((p) => p.id) : []
  })()`)
  if (stack.length) {
    const missed: string[] = []
    const chosenFirst = await page.ev<string | null>(
      `$$("[data-card-point]").find((g) => g.dataset.chosen === "true")?.dataset.cardPoint ?? null`
    )
    const order = [
      ...stack.filter((id) => id !== chosenFirst),
      ...stack.filter((id) => id === chosenFirst),
    ]
    for (const id of order) {
      const at = await page.ev<{ x: number; y: number }>(`(() => {
        const r = $('[data-card-point="${id}"] circle:last-child').getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
      await page.clickAt(at.x, at.y)
      await page.wait(400)
      const hit = await page.ev<boolean>(
        `$("[data-card-readout]")?.dataset.cardReadout === ${JSON.stringify(id)} &&
          $('[data-card-row="${id}"]')?.dataset.chosen === "true"`
      )
      if (!hit) missed.push(id)
    }
    check(
      "Fortschritt: ein Tipp auf eine von mehreren Scheiben eines Abends wählt genau sie",
      missed.length === 0,
      { stack: stack.length, missed }
    )
  } else
    check(
      "Fortschritt: ein Tipp auf eine von mehreren Scheiben eines Abends wählt genau sie",
      true,
      "kein Stapel in den Daten (nicht belegt)"
    )
  const rowId = await page.ev<string | null>(`$$("[data-card-row]")[2]?.dataset.cardRow ?? null`)
  if (rowId) {
    await page.click(`$('[data-card-row="${rowId}"] button')`, { settle: 400 })
    check(
      "Fortschritt: eine Zeile der Liste wählt die Scheibe und setzt das Lineal",
      await page.ev<boolean>(`$('[data-card-point="${rowId}"]')?.dataset.chosen === "true"`)
    )
  }

  // Kalender der Trainingstage (T7): umschalten, ein Tag führt an seinen Abend in der Liste. Auch bei „Alles“ nur so
  // breit, wie Platz ist; ältere Wochen über „früher“, am Telefon wie am Desktop
  const calendarFits = `(() => { const s = $("[data-day], [data-week]")?.closest(".overflow-x-auto")
    return s ? { scroll: s.scrollWidth, client: s.clientWidth, weeks: $$("[data-week]").length,
      earlier: $("[data-calendar-earlier]")?.disabled === false } : null })()`
  type Fits = { scroll: number; client: number; weeks: number; earlier: boolean } | null
  await page.viewport(390, 844)
  await page.goto(`${BASE}/progress?range=all`)
  await page.click(
    `$$('[aria-label="Umfang zeigen als"] button').find((b) => txt(b) === "Kalender")`,
    { settle: 400 }
  )
  const phoneFits = await page.ev<Fits>(calendarFits)
  await page.viewport(1440, 1400)
  await page.goto(`${BASE}/progress?range=all`)
  await page.click(
    `$$('[aria-label="Umfang zeigen als"] button').find((b) => txt(b) === "Kalender")`,
    {
      settle: 400,
    }
  )
  const desktopFits = await page.ev<Fits>(calendarFits)
  check(
    "Kalender bei „Alles“: so breit, wie Platz ist, ohne seitliches Scrollen, ältere Wochen über „früher“",
    [phoneFits, desktopFits].every(
      (f) => !!f && f.scroll <= f.client + 1 && f.weeks >= 13 && f.earlier
    ) && desktopFits!.weeks > phoneFits!.weeks,
    { phone: phoneFits, desktop: desktopFits }
  )
  const day = await page.ev<{
    key: string
    label: string
    right: number
    box: number
  } | null>(`(() => {
    const days = $$("[data-day]"); const last = days.at(-1); if (!last) return null
    const r = last.getBoundingClientRect(), box = last.closest(".overflow-x-auto").getBoundingClientRect()
    return { key: last.dataset.day, label: last.getAttribute("aria-label"), right: r.right, box: box.right }
  })()`)
  check(
    "Kalender: Trainingstage mit Namen, die jüngsten anfangs im Bild",
    !!day && /\d+ Schuss/.test(day.label) && day.right <= day.box + 1,
    day ?? "keine Trainingstage"
  )
  if (day) {
    await page.click(`$('[data-day="${day.key}"]')`, { settle: 600 })
    await page.waitFor(`location.pathname === "/cards"`, 10_000)
    await page.wait(500)
    check(
      "Kalender: ein Tag öffnet die Liste an diesem Abend, markiert",
      // markiert ist nur der Abend, keine Wahl aus dem Verlauf
      await page.ev<boolean>(`location.hash === "#${day.key}" && !location.search.includes("pick=") &&
        $$('[data-marked]').length > 0 &&
        $$('[data-marked]').every((el) => el.closest("tbody")?.id === ${JSON.stringify(day.key)})`),
      await page.ev<string>(`location.pathname + location.search + location.hash`)
    )
    await page.goto(`${BASE}/progress`)
  }

  // Kalender blätterbar: in den letzten 90 Tagen zeigt „früher“ ältere Trainingstage; ein solcher Tag führt in die
  // Liste ohne Zeitraum an seinen Abend
  await page.click(
    `$$('[aria-label="Umfang zeigen als"] button').find((b) => txt(b) === "Kalender")`,
    { settle: 300 }
  )
  const shownWindow = `({ window: $("[data-calendar-window]")?.dataset.calendarWindow ?? "",
    days: $$("[data-day]").map((d) => d.dataset.day),
    earlier: $("[data-calendar-earlier]")?.disabled === false,
    later: $("[data-calendar-later]")?.disabled === false })`
  type Shown = { window: string; days: string[]; earlier: boolean; later: boolean }
  const initial = await page.ev<Shown>(shownWindow)
  let older = initial
  for (let i = 0; i < 8 && older.earlier; i++) {
    await page.click(`$("[data-calendar-earlier]")`, { settle: 200 })
    older = await page.ev<Shown>(shownWindow)
    if (older.days.length) break
  }
  const [from] = initial.window.split("..")
  const [olderFrom, olderTo] = older.window.split("..")
  check(
    "Kalender: anfangs bis heute, „früher“ zeigt ältere Trainingstage im Fenster davor, „später“ geht wieder",
    !initial.later &&
      initial.earlier &&
      olderTo < from &&
      older.later &&
      older.days.length > 0 &&
      older.days.every((d) => d >= olderFrom && d <= olderTo),
    { initial: initial.window, older: older.window, days: older.days.length }
  )
  const oldDay = older.days.at(-1)
  if (oldDay) {
    await page.click(`$('[data-day="${oldDay}"]')`, { settle: 600 })
    await page.waitFor(`location.pathname === "/cards"`, 10_000)
    await page.wait(500)
    check(
      "Kalender: ein älterer Tag öffnet die Liste ohne Zeitraum an diesem Abend",
      await page.ev<boolean>(`location.hash === "#${oldDay}" && !location.search.includes("range=") &&
        $$('[data-marked]').length > 0`),
      await page.ev<string>(`location.pathname + location.search + location.hash`)
    )
    await page.goto(`${BASE}/progress`)
  }

  // Blatt „Filter“: nicht übernommene freie Tage gelten beim nächsten Öffnen nicht
  const dates = `$$('[data-period-picker] input[type="date"]')`
  const setDate = (i: number, value: string) =>
    page.ev(`(() => { const input = ${dates}[${i}]
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, ${JSON.stringify(value)})
      input.dispatchEvent(new Event("input", { bubbles: true })) })()`)
  const picker = `$("[data-period-picker]").closest("dialog")`
  await page.click(`$("[data-period-chip]")`, { settle: 300 })
  await page.click(`$$("[data-period-picker] label").find((l) => txt(l).startsWith("Frei"))`, {
    settle: 150,
  })
  await setDate(0, "2026-07-01")
  await setDate(1, "2026-07-31")
  await page.wait(100)
  await page.click(`button("Übernehmen", ${picker})`, { settle: 300 })
  await page.waitFor(`location.search.includes("2026-07-31")`, 10_000)
  await page.wait(500)
  await page.click(`$("[data-period-chip]")`, { settle: 300 })
  await setDate(1, "2026-07-15")
  await page.wait(100)
  await page.click(`button("Schließen", ${picker})`, { settle: 300 })
  await page.click(`$("[data-period-chip]")`, { settle: 300 })
  const kept = await page.ev<string>(`${dates}[1]?.value ?? ""`)
  check(
    "Blatt „Filter“: nicht übernommene freie Tage gelten beim nächsten Öffnen nicht",
    kept === "2026-07-31",
    kept
  )
  await page.click(`button("Schließen", ${picker})`, { settle: 200 })

  // gemerkter Zeitraum: übernommen war eben 01.07. bis 31.07.2026. Ohne eigene Abfrage öffnet der
  // Fortschritt darin, mit eigener wie verlangt. Danach vergessen, damit die übrigen Prüfungen die Vorgabe sehen
  const chip = `txt($("[data-period-chip]"))`
  await page.goto(`${BASE}/progress`)
  const remembered = await page.ev<string>(chip)
  await page.goto(`${BASE}/progress?range=all`)
  const explicit = await page.ev<string>(chip)
  await page.ev(`document.cookie = "spiegel-period=; path=/; max-age=0"`)
  await page.goto(`${BASE}/progress`)
  const fresh = await page.ev<string>(chip)
  check(
    "Fortschritt: der übernommene Zeitraum gilt beim nächsten Öffnen ohne Abfrage, ein Link mit Zeitraum wie verlangt",
    remembered.startsWith("01.07.2026") &&
      explicit.startsWith("Alles") &&
      fresh.startsWith("Letzte 90 Tage"),
    { remembered, explicit, fresh }
  )
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Das Trefferbild über den Zeitraum (L9) und die Reiter Präzision und Lage: Umschalten schreibt `show=target`, Zurück
 * stellt den Verlauf her; Satz, Legende und Grundlage ohne Fachbegriffe; die Form als Ellipse; ein Punkt der Lage über
 * Zeit wählt die Scheibe der Ablesung; am Telefon kein seitliches Scrollen und über dem Bild höchstens zwei Zeilen
 * Bedienung. Ob die Daten Treffer in Ringfarbe, Treffer in Dichtefarbe oder nur Umrisse ergeben, steht im Detail.
 */
async function periodPattern(page: Page) {
  const show = (label: string) =>
    `$$('[role="radiogroup"][aria-label="Hauptbild"] [role="radio"]').find((b) => txt(b) === ${JSON.stringify(label)})`
  await page.viewport(1440, 1400)
  await page.goto(`${BASE}/progress`)
  await page.click(show("Trefferbild"), { settle: 300 })
  const drawn = await page.waitFor(`$("[data-pattern-target]")`, 15_000)
  const state = await page.ev<{ search: string; kind: string | null; nav: string }>(`({
    search: location.search,
    kind: $("[data-pattern-target]")?.dataset.patternTarget ?? null,
    nav: txt($('nav[aria-label="Abschnitte"] a, nav[aria-label="Abschnitte"] button')),
  })`)
  check(
    "Trefferbild: Umschalten schreibt show=target und zeigt das Bild",
    drawn && state.search.includes("show=target") && state.nav === "Trefferbild",
    state
  )
  const words = await page.ev<{ sentence: string; basis: string; jargon: string | null }>(`({
    sentence: txt($("[data-pattern-sentence]")),
    basis: txt($("[data-pattern-basis]")),
    jargon: ${jargonIn("[data-pattern-panel]")},
  })`)
  check(
    `Trefferbild: Satz, Legende und Grundlage stehen da, keine Fachbegriffe (${state.kind === "outlines" ? "nur Umrisse" : state.kind === "shots" ? "Treffer in Dichtefarbe" : "Treffer in Ringfarbe"})`,
    words.sentence.length > 0 && words.basis.startsWith("Über ") && words.jargon === null,
    words
  )
  await page.ev(`history.back()`)
  const back = await page.waitFor(
    `!location.search.includes("show=target") && !$("[data-pattern-panel]") && $$("[data-card-point]").length > 0`,
    10_000
  )
  check("Trefferbild: Zurück stellt den Verlauf her", back, await page.ev(`location.search`))

  // Umrisse statt Dichte, auf einer frisch geladenen Seite (nach der Prüfung von Zurück): von 50 bis 3.000 Schuss ein
  // Knopf, die Wahl bleibt im Gerät, auch nach dem Neuladen
  const outlinesButton = `$('button[aria-label="Umrisse statt Treffer zeigen"]')`
  if (state.kind === "outlines") {
    await page.goto(`${BASE}/progress${state.search}`)
    await page.waitFor(`$("[data-pattern-target]")`, 15_000)
    const only = await page.ev<boolean>(
      `$("[data-pattern-target]")?.dataset.patternView === "outlines" && !${outlinesButton}`
    )
    check("Trefferbild: über 3.000 Schuss nur die Umrisse, ohne Knopf", only, "")
  } else if (state.kind === "rings") {
    check("Trefferbild: Umrisse statt Dichte", false, "unter 50 Schuss, kein Knopf (nicht belegt)")
  } else {
    await page.ev(`localStorage.removeItem("spiegel-pattern-view")`)
    await page.goto(`${BASE}/progress${state.search}`)
    await page.waitFor(`!!${outlinesButton}`, 15_000)
    await page.click(outlinesButton, { settle: 200 })
    const outlined = await page.ev<{
      view: string
      lines: number
      legend: string
      pressed: string
    }>(`({
      view: $("[data-pattern-target]")?.dataset.patternView ?? "",
      lines: $$('[data-outline="pattern"]').length,
      legend: txt($('[data-pattern-legend="outlines"]')),
      pressed: ${outlinesButton}?.getAttribute("aria-pressed") ?? "",
    })`)
    check(
      "Trefferbild: der Knopf zeigt Umrisse statt Dichte, mit eigener Legende",
      outlined.view === "outlines" &&
        outlined.lines === 2 &&
        outlined.legend.startsWith("Durchgezogen") &&
        outlined.pressed === "true" &&
        !(await page.ev<boolean>(`!!$("[data-heat-legend]")`)),
      outlined
    )
    await page.goto(`${BASE}/progress${state.search}`)
    const kept = await page.waitFor(
      `$("[data-pattern-target]")?.dataset.patternView === "outlines"`,
      15_000
    )
    check(
      "Trefferbild: die Umrisse bleiben nach dem Neuladen",
      kept,
      await page.ev(`localStorage.getItem("spiegel-pattern-view")`)
    )
    await page.click(outlinesButton, { settle: 200 })
    const density = await page.ev<boolean>(
      `$("[data-pattern-target]")?.dataset.patternView === "density" && !!$("[data-heat-legend]")`
    )
    check("Trefferbild: ein zweites Tippen zeigt wieder die Dichte", density, "")
    await page.ev(`localStorage.removeItem("spiegel-pattern-view")`)
  }

  // Reiter Präzision: die Form als Ellipse, sobald es ein Urteil gibt
  await page.goto(`${BASE}/progress#precision`)
  await page.waitFor(
    `$("[data-shape-ellipse]") || txt(analysis()).includes("fehlen noch Schüsse")`,
    15_000
  )
  const ellipse = await page.ev<boolean>(`!!$("[data-shape-ellipse]") && !!$("[data-shape-round]")`)
  check(
    "Reiter Präzision: die Form als Ellipse mit dem Kreis einer runden Gruppe",
    ellipse,
    ellipse ? "" : "unter 100 Schuss aus 5 Scheiben (nicht belegt)"
  )

  // Reiter Lage: ein Punkt der Zeitreihe wählt die Scheibe der Ablesung, ohne zu springen
  await page.goto(`${BASE}/progress#position`)
  const timeline = await page.waitFor(
    `$$("[data-timeline-row='x'] [data-timeline-card]").length > 1`,
    15_000
  )
  if (!timeline) {
    check(
      "Reiter Lage: ein Punkt wählt die Scheibe",
      false,
      "unter zwei Scheiben mit Lage (nicht belegt)"
    )
  } else {
    const target = await page.ev<{ id: string; x: number; y: number } | null>(`(() => {
      const readout = $("[data-card-readout]")?.dataset.cardReadout
      const row = $("[data-timeline-row='x']")
      row.scrollIntoView({ block: "center", behavior: "instant" })
      const dots = $$("[data-timeline-card]", row)
      const dot = dots.find((c) => c.dataset.timelineCard !== readout && dots.filter((d) =>
        Math.abs(d.getBoundingClientRect().left - c.getBoundingClientRect().left) < 6).length === 1)
      if (!dot) return null
      const r = dot.getBoundingClientRect()
      return { id: dot.dataset.timelineCard, x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })()`)
    if (!target) {
      check(
        "Reiter Lage: ein Punkt wählt die Scheibe",
        false,
        "kein freistehender Punkt (nicht belegt)"
      )
    } else {
      const scrolled = await page.ev<number>(`scrollY`)
      await page.clickAt(target.x, target.y)
      const chosen = await page.waitFor(
        `$("[data-card-readout]")?.dataset.cardReadout === ${JSON.stringify(target.id)}`,
        5_000
      )
      const after = await page.ev<{ readout: string | null; scrollY: number }>(`({
        readout: $("[data-card-readout]")?.dataset.cardReadout ?? null,
        scrollY,
      })`)
      check(
        "Reiter Lage: ein Punkt der Zeitreihe wählt die Scheibe für die Ablesung, die Seite bleibt stehen",
        chosen && Math.abs(after.scrollY - scrolled) < 4,
        { target: target.id, ...after, before: scrolled }
      )
    }
  }

  // Telefon: kein seitliches Scrollen, höchstens zwei Zeilen Bedienung über dem Bild
  await page.viewport(390, 844)
  await page.goto(`${BASE}/progress?show=target`)
  await page.waitFor(`$("[data-pattern-target]")`, 15_000)
  const phone = await page.ev<{ overflow: number; rows: number }>(`(() => {
    const image = $("[data-pattern-target]") ?? $("[data-pattern-placeholder]")
    const top = image.getBoundingClientRect().top
    const groups = $$('[role="radiogroup"]').filter((g) => visible(g) && g.getBoundingClientRect().bottom <= top)
      .filter((g) => g.closest("[data-section='history']"))
    const rows = new Set(groups.map((g) => Math.round(g.getBoundingClientRect().top / 8)))
    return { overflow: document.documentElement.scrollWidth - innerWidth, rows: rows.size }
  })()`)
  check(
    "Trefferbild am Telefon (390 px): kein seitliches Scrollen, über dem Bild höchstens zwei Zeilen Bedienung",
    phone.overflow <= 0 && phone.rows <= 2,
    phone
  )
  await page.viewport(1440, 1400)
}

// ─────────────────────────────────────────────────────────────────────────────
// Vergleichen
// ─────────────────────────────────────────────────────────────────────────────

/** der Zustand der Seite Vergleichen: Adresse, Satz, Art des Bilds, Zeilen, Fachbegriffe, Hinweis */
const compareState = () =>
  `({
    url: location.pathname + location.search,
    sentence: txt($("[data-compare-sentence]")),
    picture: $("[data-compare-picture]")?.dataset.comparePicture ?? null,
    rows: $$("[data-compare-row]").length,
    problem: txt($("[data-compare-problem]")),
    jargon: ${jargonIn("[data-compare-body], [data-compare-controls]")},
  })`
type CompareState = {
  url: string
  sentence: string
  picture: string | null
  rows: number
  problem: string
  jargon: string | null
}
/** bis die Seite nach einer Wahl neu gerechnet ist: die Adresse passt und nichts ist mehr leise */
const compareReady = (part: string) =>
  `location.search.includes(${JSON.stringify(part)}) && !$("[data-compare-body][aria-busy]") &&
    (!!$("[data-compare-sentence]") || !!$("[data-compare-problem]"))`
/** eine Wahl im offenen Blatt, nach dem Anfang ihres Namens */
const sheetChoice = (label: string) =>
  `$$("dialog[open] label").find((l) => txt(l).startsWith(${JSON.stringify(label)}))`

/**
 * Seite Vergleichen: der Umschalter und der Weg aus dem Fortschritt, zwei Zeiträume mit Bild, Lupe und Tabelle, das
 * Blatt für B, eine alte Adresse mit `compare=`, Wettkampf und Training, zwei Scheiben von der Seite einer Scheibe mit dem Blatt
 * der Scheiben, und jedes Thema der Hilfe der Seite hat ein „?“.
 */
async function compare(page: Page, href: string) {
  const shown = new Set<string>()
  const collect = async () => {
    for (const id of await page.ev<string[]>(`$$("[data-help]").map((el) => el.dataset.help)`))
      shown.add(id)
  }
  await page.viewport(1280, 900)
  await page.goto(`${BASE}/progress`)
  const toCompare = await page.ev<string | null>(
    `$$("[data-progress-switch] a").find((a) => txt(a) === "Vergleichen")?.getAttribute("href") ?? null`
  )
  check(
    "Fortschritt: Umschalter „Zeitraum · Vergleichen“ führt auf die Seite",
    !!toCompare?.startsWith("/compare"),
    toCompare ?? "kein Umschalter"
  )
  const link = await page.ev<string | null>(
    `$("[data-compare-link]")?.getAttribute("href") ?? null`
  )
  check(
    "Fortschritt: „Genauer vergleichen“ führt auf die Seite Vergleichen",
    !!link?.startsWith("/compare"),
    link ?? "kein Link"
  )
  if (link) {
    await page.click(`$("[data-compare-link]")`, { settle: 800 })
    await page.waitFor(`!!$("[data-compare-sentence]") || !!$("[data-compare-problem]")`, 15_000)
  } else await page.goto(`${BASE}/compare`)
  const periods = await page.ev<CompareState>(compareState())
  check(
    "Zwei Zeiträume: Satz, Bild, alle Zahlen in einer Tabelle, keine Fachbegriffe",
    periods.url.startsWith("/compare") &&
      periods.sentence.length > 0 &&
      (periods.picture === "outlines" || periods.picture === "dots") &&
      periods.rows >= 7 &&
      periods.jargon === null,
    periods
  )
  await collect()
  const before = await page.ev<string | null>(
    `$("[data-compare-picture]")?.getAttribute("viewBox") ?? null`
  )
  const pressed = await page.ev<string | null>(
    `$('[aria-label="Auf Gruppe zoomen"]')?.getAttribute("aria-pressed") ?? null`
  )
  await page.click(`$('[aria-label="Auf Gruppe zoomen"]')`, { settle: 200 })
  const zoomed = await page.waitFor(
    `$("[data-compare-picture]")?.getAttribute("viewBox") !== ${JSON.stringify(before)}`,
    5_000
  )
  check(
    "Bild: öffnet auf der Gruppe, die Lupe zeigt die ganze Scheibe",
    pressed === "true" && zoomed,
    {
      before,
      pressed,
    }
  )
  const switcher = await page.ev<string>(`txt($("[data-progress-switch] [aria-current=page]"))`)
  check(
    "Umschalter oben: „Vergleichen“ ist die gezeigte Seite",
    switcher === "Vergleichen",
    switcher
  )

  await page.click(`$('[data-compare-chip="b"]')`, { settle: 300 })
  const sheet = await page.ev<string>(`txt($("dialog[open] h2, dialog[open] [id]"))`)
  await page.click(sheetChoice("Letzte 30 Tage"), { settle: 100 })
  await page.click(`button("Übernehmen", $("dialog[open]"))`, { settle: 300 })
  const thirty = await page.waitFor(compareReady("b=30d"), 15_000)
  check("Blatt Zeitraum B: „Letzte 30 Tage“ übernehmen schreibt b=30d", thirty, sheet)

  await page.goto(`${BASE}/progress?compare=previous`)
  const legacy = await page.ev<string>(`location.pathname`)
  check(
    "Eine alte Adresse mit compare= führt auf die Seite Vergleichen",
    legacy === "/compare",
    legacy
  )

  await page.goto(`${BASE}/compare?type=kind`)
  const kind = await page.ev<CompareState>(compareState())
  const withData = kind.rows >= 7 && kind.sentence.length > 0
  check(
    `Wettkampf und Training: Satz und Zeilen oder der Hinweis ohne Wettkampf${withData ? "" : " (ohne Wettkampf in den Daten: nicht belegt)"}`,
    (withData || /keinen Wettkampf|kein Training/.test(kind.sentence)) && kind.jargon === null,
    kind
  )
  await collect()

  await page.goto(`${BASE}${href}`)
  const previous = await page.ev<string | null>(
    `$("[data-compare-previous] a")?.getAttribute("href") ?? null`
  )
  check(
    "Seite einer Scheibe: „Mit der Scheibe davor vergleichen“",
    !!previous?.startsWith("/compare?type=cards"),
    previous ?? "kein Link"
  )
  if (previous) {
    await page.click(`$("[data-compare-previous] a")`, { settle: 800 })
    await page.waitFor(`!!$("[data-compare-sentence]") || !!$("[data-compare-problem]")`, 15_000)
    const cards = await page.ev<CompareState>(compareState())
    check(
      "Zwei Scheiben: Punkte, alle Zahlen in einer Tabelle, keine Fachbegriffe",
      cards.picture === "dots" && cards.rows >= 7 && cards.jargon === null,
      cards
    )
    await collect()
    const head = await page.ev<{ scoring: string; family: boolean; families: number }>(`({
      scoring: txt($("[data-compare-actions]")),
      family: !!$('[data-compare-controls] [role="radiogroup"][aria-label="Familie"]'),
      families: $$('[data-compare-controls] [role="radiogroup"][aria-label="Familie"] [role="radio"]').length,
    })`)
    check(
      "Zwei Scheiben: die Wertung steht da, die Familie ist wählbar (bei mehr als einer)",
      /In (Zehnteln|ganzen Ringen)/.test(head.scoring) && (head.family || head.families === 0),
      head
    )
    await page.click(`$('[data-compare-chip="a"]')`, { settle: 300 })
    const first = await page.ev<{ radios: number; more: boolean }>(`({
      radios: $$("dialog[open] input[type=radio]").length,
      more: !!button("Mehr zeigen", $("dialog[open]")),
    })`)
    if (first.more) await page.click(`button("Mehr zeigen", $("dialog[open]"))`, { settle: 150 })
    const after = await page.ev<number>(`$$("dialog[open] input[type=radio]").length`)
    check(
      "Blatt Scheibe A: höchstens 30 auf einmal, „Mehr zeigen“ lädt nach",
      first.radios <= 30 && (!first.more || after > first.radios),
      { ...first, after }
    )
    const before = cards.url
    await page.click(`$$("dialog[open] input[type=radio]:not(:checked):not(:disabled)")[1]`, {
      settle: 300,
    })
    const chosen = await page.waitFor(
      `location.search !== ${JSON.stringify(before.slice(before.indexOf("?")))} && !$("[data-compare-body][aria-busy]")`,
      15_000
    )
    check("Blatt Scheibe A: eine Wahl ändert die Adresse", chosen)
  }

  const missing = COMPARE_TOPICS.filter((id) => !shown.has(id))
  check("Vergleichen: jedes Thema der Hilfe hat ein „?“", missing.length === 0, missing.join(", "))
}

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
    // das Demo-Konto meldet sich an; gegen einen fremden Server nur mit ausdrücklichem Schalter
    if (!ANY_HOST && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(BASE))
      throw new Error(`${BASE} ist kein lokaler Server; --fremder-host, wenn das gewollt ist`)
    server = START ? await startServer({ app: "spiegel", port: START_PORT, out }) : null
    browser = await Browser.launch()
    const chrome = browser
    const page = await browser.newPage()
    await login(page)
    const href = await pickCard(page)
    await section("Seite einer Scheibe am Desktop", () => desktopCard(page, href))
    await section("Anker und Platz der Scheibe", () => anchorsAndFit(page, href))
    await section("Seite einer Scheibe am Telefon", () => phoneCard(page, href))
    await section("Telefon ohne seitliches Scrollen", () => phoneNoSideScroll(page))
    await section("Blatt Filter unter Scheiben", () => listFilterSheet(page))
    await section("Blättern", () => paging(page, href))
    await section("Rückwege", () => backPaths(page))
    await section("Fortschritt", () => progress(page))
    await section("Trefferbild über den Zeitraum", () => periodPattern(page))
    await section("Vergleichen", () => compare(page, href))
    await section("Eine Scheibe sagt, was sie zeigt", () => singleCardHints(page, href))
    await section("Sprache und Hilfe", () => language(page))
    await section("Offen und Leiste", () => openAndBar(page))
    await section("Papierkorb", () => trash(page))
    await section("Admin ohne Rolle", () => adminWithoutRole(page))
    await section("Disziplin einer Scheibe", () => cardDiscipline(page, href))
    await section("Geteilte Scheibe", () => sharing(chrome, page, href))
    await section("Gemeinsame Prüfungen", () => commonChecks(page, href))
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
