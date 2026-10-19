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
    `$$('[role="radiogroup"][aria-label="Reiter der Analyse"] button').map((b) => txt(b))`
  )
  check(
    "Analyse: Reiter Rekorde, Einflüsse, Selbstbild",
    tabs.join() === "Rekorde,Einflüsse,Selbstbild",
    tabs
  )
  const tab = (label: string) =>
    page.click(
      `$$('[role="radiogroup"][aria-label="Reiter der Analyse"] button').find((b) => txt(b) === ${JSON.stringify(label)})`,
      { settle: 300 }
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
  await tab("Selbstbild")
  const self = await page.ev<{ rows: number; text: string }>(`({
    rows: $$("[data-self-image]").filter(visible).length,
    text: txt($('section[aria-label="Selbstbild"]')) })`)
  check(
    "Selbstbild: sieben Zeilen mit Prognose, Feedback und Abstand, oder der Hinweis ohne Einheit",
    self.rows === 7 ? self.text.includes("Abstand") : self.text.includes("keine Einheit"),
    self
  )
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
      for (const [label, name] of [
        ["Einflüsse", "einfluesse"],
        ["Selbstbild", "selbstbild"],
      ] as const) {
        await page.click(
          `$$('[role="radiogroup"][aria-label="Reiter der Analyse"] button').find((b) => txt(b) === ${JSON.stringify(label)})`,
          { settle: 300 }
        )
        const shot = await page.screenshotOf(`$('section[aria-label=${JSON.stringify(label)}]')`)
        if (shot) writeFileSync(join(dir, `statistik-${name}-${width}-${theme}.png`), shot)
      }
    }
  }
  await page.ev(`localStorage.removeItem("treffsicher-theme")`)
}
