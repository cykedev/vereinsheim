// Abschnitt „Statistik“ der Skriptprüfung: die Seite eines Zeitraums wie Spiegels Fortschritt mit den Einheiten des
// Prüfkontos. Geprüft ohne feste Zahlen: Wörter („Einheit“), Lineal und „Werte als Tabelle“, Vergleich, Blatt „Filter“
// ohne Schalter für Probe, Reiter der Analyse, „?“ mit Blatt, kein seitliches Scrollen mit Vergleich. Mit `--bilder
// <ordner>` legt er Bildschirmfotos der Seite bei 390 und 1280 px in Hell und Dunkel ab.

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { Page } from "@vereinsheim/pruefen/browser"
import { noSideScroll, type Check } from "@vereinsheim/pruefen/common"

type CheckFn = (name: string, ok: boolean, detail?: unknown) => void

/** Wörter, die in Treffsicher nicht auf der Seite stehen: Spiegel sagt „Scheibe“, Treffsicher „Einheit“ */
const SPIEGEL_WORDS = /Scheibe|Trainings nur aus Probe/

export async function statisticsFlow(
  page: Page,
  base: string,
  check: CheckFn,
  record: (checks: Check[]) => void
) {
  await page.viewport(1280, 900)
  await page.goto(`${base}/statistics?range=all`, '$("[data-period-header]")')
  const shown = await page.ev<{ sections: string[]; text: string; points: number }>(`({
    sections: $$('nav[aria-label="Abschnitte"] a').map((a) => txt(a)),
    text: document.querySelector("[data-app-content]")?.textContent ?? "",
    points: $$("[data-card-point]").length })`)
  check(
    "Statistik: Abschnitte Verlauf, Einheiten, Zahlen, Analyse; ein Punkt je Einheit",
    shown.sections.join() === "Verlauf,Einheiten,Zahlen,Analyse" && shown.points >= 2,
    { sections: shown.sections, points: shown.points }
  )
  check(
    "Statistik: sagt „Einheit“, nirgends „Scheibe“",
    !SPIEGEL_WORDS.test(shown.text) && shown.text.includes("Einheit"),
    shown.text.match(SPIEGEL_WORDS)?.[0] ?? ""
  )

  // die Tabelle der Serien und die Ringverteilung stehen unter „Zahlen“
  const numbers = await page.ev<{ table: boolean; rows: number; rings: number }>(`(() => {
    const section = $('[data-section="numbers"]')
    return { table: txt(section).includes("Serien je Einheit"), rows: $$("table tbody tr", section).length,
      rings: $$("[data-period-rings] [data-ring-row]").length } })()`)
  check(
    "Zahlen: Tabelle der Serien je Einheit mit Ø-Zeile und Ringverteilung des Zeitraums",
    numbers.table && numbers.rows >= 1 && numbers.rings >= 3,
    numbers
  )

  // Lineal: ein Tipp auf einen Punkt wählt die Einheit für Ablesung und Liste
  const point = await page.ev<{ id: string; x: number; y: number } | null>(`(() => {
    const g = $$("[data-card-point]").at(-2)
    if (!g) return null
    g.scrollIntoView({ block: "center", behavior: "instant" })
    const r = g.querySelector("circle:last-child").getBoundingClientRect()
    return { id: g.dataset.cardPoint, x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
  if (point) {
    await page.clickAt(point.x, point.y)
    await page.wait(400)
    const chosen = await page.ev<{ readout: string; row: boolean; line: string }>(`({
      readout: $("[data-card-readout]")?.dataset.cardReadout ?? "",
      row: $('[data-card-row="${point.id}"]')?.dataset.chosen === "true",
      line: txt($("[data-readout]")) })`)
    check(
      "Statistik: das Lineal wählt die Einheit für Ablesung und Liste und nennt sie",
      chosen.readout === point.id && chosen.row && /\d/.test(chosen.line),
      chosen
    )
  } else check("Statistik: Verlauf mit Punkten", false, "keine Punkte")
  await page.click(`$("[data-values] summary")`, { settle: 200 })
  const rows = await page.ev<number>(`$$("[data-values][open] tbody tr").length`)
  check("Statistik: „Werte als Tabelle“ klappt eine Zeile je Einheit auf", rows >= 2, rows)

  // „?“ am Verlauf öffnet das Blatt der Hilfe
  await page.click(`$('[data-help="verlauf-und-form"]')`, { settle: 400 })
  const sheet = await page.ev<string>(
    `txt($$("dialog").find((d) => d.open)?.querySelector("h2") ?? null)`
  )
  check("Statistik: „?“ am Verlauf öffnet die Erklärung", sheet === "Verlauf und Form", sheet)
  await page.key("Escape")
  await page.wait(300)

  // Blatt „Filter“: ohne Schalter für Probe; Vergleich mit dem Zeitraum davor
  await page.click(`$("[data-period-chip]")`, { settle: 300 })
  const picker = `$("[data-period-picker]").closest("dialog")`
  const sheetText = await page.ev<string>(`txt(${picker})`)
  check(
    "Blatt „Filter“: Zeitraum, Vergleich und Art, ohne „Trainings nur aus Probe mitzählen“",
    sheetText.includes("Vergleichen mit") && !SPIEGEL_WORDS.test(sheetText),
    sheetText.match(SPIEGEL_WORDS)?.[0] ?? ""
  )
  await page.click(`$$("[data-period-picker] label").find((l) => txt(l).startsWith("Letzte 90"))`)
  await page.click(
    `$$("[data-period-picker] label").find((l) => txt(l).startsWith("Zeitraum davor"))`
  )
  await page.click(`button("Übernehmen", ${picker})`, { settle: 300 })
  await page.waitFor(`location.search.includes("compare=previous")`, 10_000)
  await page.wait(600)
  const compare = await page.ev<{ chip: string; box: string; tiles: number }>(`({
    chip: txt($("[data-period-chip]")),
    box: txt($$("[data-comparison]").find(visible) ?? null),
    tiles: $$("[data-tile-compare]").length })`)
  check(
    "Vergleich: der Chip nennt ihn, Ergebnis und Kacheln vergleichen mit dem Zeitraum davor",
    compare.chip.includes("mit Zeitraum davor") &&
      compare.box.includes("Zeitraum davor") &&
      compare.tiles === 3,
    compare
  )
  record(
    await noSideScroll(page, {
      base,
      paths: ["/statistics?compare=previous", "/statistics?range=all&view=months"],
      widths: [375, 390, 768, 1280],
    })
  )

  // Reiter der Analyse
  await page.goto(`${base}/statistics?range=all`)
  const tabs = await page.ev<string[]>(
    `$$('[role="radiogroup"][aria-label="Reiter der Analyse"] button').filter(visible).map((b) => txt(b))`
  )
  check(
    "Analyse: Reiter Rekorde, Trefferlage, Einflüsse, Selbstbild",
    tabs.join() === "Rekorde,Trefferlage,Einflüsse,Selbstbild",
    tabs
  )
  const tab = (label: string) =>
    page.click(
      `$$('[role="radiogroup"][aria-label="Reiter der Analyse"] button').filter(visible).find((b) => txt(b) === ${JSON.stringify(label)})`,
      { settle: 300 }
    )
  await tab("Trefferlage")
  const cloud = await page.ev<number>(`$$("[data-location-point]").length`)
  const course = `$('section[aria-label="Trefferlage"] svg[role="slider"]')`
  await page.ev(`${course}.scrollIntoView({ block: "center", behavior: "instant" })`)
  await page.wait(200)
  const box = await page.ev<{ x: number; y: number; w: number }>(`(() => {
    const r = ${course}.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width } })()`)
  await page.clickAt(box.x + box.w - 20, box.y)
  await page.wait(300)
  const picked = await page.ev<{ chosen: number; line: string }>(`({
    chosen: $$("[data-location-point][data-chosen]").length,
    line: txt($('section[aria-label="Trefferlage"] [data-readout]')) })`)
  check(
    "Trefferlage: Wolke mit einem Punkt je Einheit, das Lineal im Verlauf wählt die Einheit in der Wolke",
    cloud === 7 && picked.chosen === 1 && /mm (rechts|links)/.test(picked.line),
    { cloud, ...picked }
  )
  await page.click(`$('section[aria-label="Trefferlage"] [data-values] summary')`, { settle: 200 })
  check(
    "Trefferlage: „Werte als Tabelle“ mit einer Zeile je Einheit",
    (await page.ev<number>(
      `$$('section[aria-label="Trefferlage"] [data-values][open] tbody tr').length`
    )) === 7
  )
  await tab("Einflüsse")
  const influence = await page.ev<string[]>(
    `$$("[data-influence-verdict]").filter(visible).map((p) => txt(p))`
  )
  check(
    "Einflüsse: je Merkmal eine Karte mit Urteil (Schlaf, Energie, Stress, Motivation, Ausführung)",
    influence.length === 5 && influence.every((t) => t.length > 0),
    influence
  )
  // „?“ öffnet Treffsichers eigene Erklärung, nicht die von Spiegel
  const sheetTitle = async (locator: string) => {
    await page.click(locator, { settle: 400 })
    const title = await page.ev<string>(
      `txt($$("dialog").find((d) => d.open)?.querySelector("h2") ?? null)`
    )
    await page.key("Escape")
    await page.wait(300)
    return title
  }
  const influenceHelp = await sheetTitle(`$$('[data-help="einfluesse"]').filter(visible)[0]`)
  const tileHelp = await sheetTitle(
    `$$('[data-period-tile="group.mpiDistance"] [data-help]').filter(visible)[0]`
  )
  check(
    "Hilfe: „?“ an Einflüssen und an der Kachel Lage öffnen Treffsichers Erklärungen",
    influenceHelp === "Einflüsse" && tileHelp === "Schwerpunkt-Abstand",
    { influenceHelp, tileHelp }
  )
  await tab("Selbstbild")
  const self = await page.ev<{ rows: number; text: string }>(`({
    rows: $$("[data-self-image]").filter(visible).length,
    text: txt($('section[aria-label="Selbstbild"]')) })`)
  check(
    "Selbstbild: sieben Zeilen mit Prognose, Feedback und Abstand, oder der Hinweis ohne Einheit",
    self.rows === 7 ? self.text.includes("Abstand") : self.text.includes("keine Einheit"),
    self
  )

  await rememberFlow(page, base, check)
}

/**
 * Gemerkt wie in Spiegel: Der im Blatt „Filter“ übernommene Zeitraum gilt beim nächsten Öffnen ohne Abfrage, ein Link
 * mit Zeitraum wie verlangt; die Wertung gilt je Disziplin; „Statistik“ in der Navigation führt zur letzten Adresse.
 * Am Ende vergessen, damit die übrigen Prüfungen die Vorgaben sehen.
 */
async function rememberFlow(page: Page, base: string, check: CheckFn) {
  await page.viewport(1280, 900)
  await page.goto(`${base}/statistics`, '$("[data-period-header]")')
  const picker = `$("[data-period-picker]").closest("dialog")`
  await page.click(`$("[data-period-chip]")`, { settle: 300 })
  await page.click(`$$("[data-period-picker] label").find((l) => txt(l).startsWith("Letzte 6"))`)
  await page.click(`button("Übernehmen", ${picker})`, { settle: 300 })
  await page.waitFor(`location.search.includes("range=6m")`, 10_000)
  const chip = `txt($$("[data-period-chip]").filter(visible)[0])`
  await page.goto(`${base}/statistics`, '$("[data-period-header]")')
  const remembered = await page.ev<string>(chip)
  await page.goto(`${base}/statistics?range=all`, '$("[data-period-header]")')
  const explicit = await page.ev<string>(chip)
  check(
    "Gemerkt: der übernommene Zeitraum gilt beim nächsten Öffnen, ein Link mit Zeitraum wie verlangt",
    remembered.startsWith("Letzte 6 Monate") && explicit.startsWith("Alles"),
    { remembered, explicit }
  )

  const scoring = `$$("[data-scoring-chip]").filter(visible)[0]?.dataset.scoring ?? ""`
  const before = await page.ev<string>(scoring)
  await page.click(`$$("[data-scoring-chip]").filter(visible)[0]`, { settle: 300 })
  await page.waitFor(`(${scoring}) !== ${JSON.stringify(before)}`, 10_000)
  await page.wait(800)
  await page.goto(`${base}/statistics`, '$("[data-period-header]")')
  const after = await page.ev<string>(scoring)
  check(
    "Gemerkt: die Wertung der Disziplin gilt beim nächsten Öffnen",
    before === "decimal" && after === "rings",
    { before, after }
  )

  await page.goto(`${base}/statistics?range=30d`, '$("[data-period-header]")')
  await page.click(`$('[data-app-sidebar] [data-area="sessions"]')`, { settle: 300 })
  await page.waitFor(`location.pathname === "/sessions"`, 10_000)
  await page.click(`$('[data-app-sidebar] [data-area="statistics"]')`, { settle: 300 })
  await page.waitFor(`location.pathname === "/statistics"`, 10_000)
  const back = await page.ev<string>(`location.search`)
  check(
    "Navigation: „Statistik“ führt zur zuletzt gesehenen Adresse zurück",
    back.includes("range=30d"),
    back
  )
  await page.ev(`document.cookie = "treffsicher-period=; path=/; max-age=0"`)
  await page.ev(`document.cookie = "treffsicher-scoring=; path=/; max-age=0"`)
}

/** Bildschirmfotos der Statistik bei 390 und 1280 px in Hell und Dunkel, als PNG in `dir` */
export async function statisticsPictures(page: Page, base: string, dir: string) {
  mkdirSync(dir, { recursive: true })
  for (const theme of ["light", "dark"] as const) {
    for (const [width, height] of [
      [390, 844],
      [1280, 900],
    ] as const) {
      await page.viewport(width, height)
      await page.goto(`${base}/statistics`)
      await page.ev(`localStorage.setItem("treffsicher-theme", ${JSON.stringify(theme)})`)
      await page.goto(`${base}/statistics?range=6m`, '$("[data-period-header]")')
      await page.wait(600)
      // die ganze Seite in einem Fenster ihrer Höhe: so steht die untere Leiste am Ende, nicht mitten im Bild
      const full = await page.ev<number>(`document.documentElement.scrollHeight`)
      await page.viewport(width, full)
      await page.wait(400)
      writeFileSync(join(dir, `statistik-${width}-${theme}.png`), await page.screenshot())
      // die Reiter Einflüsse und Selbstbild je für sich
      const numbers = await page.screenshotOf(`$('[data-section="numbers"]')`)
      if (numbers) writeFileSync(join(dir, `statistik-zahlen-${width}-${theme}.png`), numbers)
      for (const [label, name] of [
        ["Trefferlage", "trefferlage"],
        ["Einflüsse", "einfluesse"],
        ["Selbstbild", "selbstbild"],
      ] as const) {
        await page.click(
          `$$('[role="radiogroup"][aria-label="Reiter der Analyse"] button').filter(visible).find((b) => txt(b) === ${JSON.stringify(label)})`,
          { settle: 300 }
        )
        const shot = await page.screenshotOf(`$('section[aria-label=${JSON.stringify(label)}]')`)
        if (shot) writeFileSync(join(dir, `statistik-${name}-${width}-${theme}.png`), shot)
      }
    }
  }
  await page.ev(`localStorage.removeItem("treffsicher-theme")`)
}
