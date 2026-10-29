import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { ResultCard } from "@/lib/results-read"

import type { EntryView } from "../queries"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}))

const { StageRow } = await import("./StageRow")
const { EntryScreen } = await import("./EntryScreen")
const { DiaryHeader, DiaryList } = await import("./DiaryList")
const { ThreadView } = await import("./ThreadView")
const { NewEntryScreen } = await import("./NewEntryScreen")

const ZONE = "Europe/Berlin"
const card = (id: string, over: Partial<ResultCard> = {}): ResultCard => ({
  id,
  day: "2026-03-13",
  startedAtMs: Date.UTC(2026, 2, 13, 18, 55),
  timeUnknown: false,
  family: { id: 1, slug: "lp", name: "Luftpistole" },
  targetId: "lp-10m",
  kind: "training",
  probeOnly: false,
  warmup: false,
  provenance: "printout",
  result: { value: 374.3, scoring: "decimal", digits: 1 },
  shots: 40,
  ...over,
})
const entry = (over: Partial<EntryView> = {}): EntryView => ({
  id: "e1",
  day: "2026-03-13",
  kind: "shooting",
  family: { id: 1, slug: "lp", name: "Luftpistole" },
  intention: null,
  note: null,
  outcome: null,
  learned: null,
  question: null,
  disturbed: null,
  expectedScore: null,
  scales: [],
  executions: [],
  cards: { linked: [], added: [], offered: [], elsewhere: [] },
  series: {},
  thread: null,
  competition: false,
  basicsEditable: true,
  ...over,
})
const screen = (e: EntryView) =>
  renderToStaticMarkup(
    createElement(EntryScreen, {
      entry: e,
      marks: {},
      families: [{ id: 1, slug: "lp", name: "Luftpistole" }],
      dayLabel: "Fr 13.03.",
      threadDayLabel: e.thread ? "Fr 06.03." : null,
      timeZone: ZONE,
    })
  )

describe("StageRow", () => {
  it("fünf Stufen, die gezeigte gedrückt, ihr Wort unter dem Namen", () => {
    const html = renderToStaticMarkup(
      createElement(StageRow, {
        label: "Schlaf",
        words: ["schlecht", "mäßig", "mittel", "gut", "sehr gut"],
        value: 43,
        onSelect: () => {},
      })
    )
    expect(html.match(/data-stage="/g)).toHaveLength(5)
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Schlaf: 3, mittel"/)
    expect(html).toContain(">mittel<")
  })

  it("ohne Wert kein Wort, mit Prognose deren Wort und die Stufe gestrichelt", () => {
    const words = ["schlecht", "mäßig", "mittel", "gut", "sehr gut"]
    const open = renderToStaticMarkup(
      createElement(StageRow, { label: "Technik", words, value: null, onSelect: () => {} })
    )
    expect(open).not.toContain("noch offen")
    expect(open).not.toContain("text-[13px] text-muted-foreground")
    expect(open).not.toContain('aria-pressed="true"')
    const marked = renderToStaticMarkup(
      createElement(StageRow, {
        label: "Technik",
        words,
        value: null,
        mark: 70,
        onSelect: () => {},
      })
    )
    expect(marked).toContain(">Prognose: gut<")
    expect(marked).toMatch(/data-stage="4"[^>]*class="[^"]*outline-dashed/)
  })
})

describe("Seite eines Eintrags", () => {
  it("leer: jeder Abschnitt ist eine Zeile mit „+“, ohne Vorhaben keine Frage „Hat es geklappt?“", () => {
    const html = screen(entry())
    for (const section of ["wellbeing", "prognosis", "disturbed", "feedback"])
      expect(html).toMatch(new RegExp(`data-section="${section}" data-empty="true"`))
    expect(html).toContain('aria-label="Befinden eintragen"')
    expect(html).not.toContain("Hat es geklappt?")
    expect(html).toContain("Noch keine Scheibe. Die Scheiben dieses Tages kommen von selbst dazu")
    expect(html).toContain("Was ist passiert? Gern in Stichpunkten.")
    expect(html).not.toContain("Notiz: ")
    // Vorhaben und Notiz in einem Kasten, gleich gebaut
    const box = html.match(/<div data-intention[\s\S]*?data-entry-text="note"/)?.[0] ?? ""
    expect(box).toContain(">Vorhaben<")
    expect(box).toContain(">Notiz<")
  })

  it("Vorhaben vor der Notiz, Notiz vor Vorher, Satzanfänge in Nachher", () => {
    const html = screen(entry({ intention: "Ruhe im Kopf", note: "Griff hat gepasst." }))
    const at = (text: string) => html.indexOf(text)
    expect(at("Ruhe im Kopf")).toBeLessThan(at("Griff hat gepasst."))
    expect(at("Griff hat gepasst.")).toBeLessThan(at(">Vorher<"))
    expect(at(">Nachher<")).toBeLessThan(at("Ich habe gelernt, dass …"))
    expect(html).toContain("Hat es geklappt?")
  })

  it("gefüllte Abschnitte stehen offen, das Feedback mit der Prognose gestrichelt", () => {
    const html = screen(
      entry({
        scales: [
          { part: "wellbeing", aspect: "sleep", value: 50 },
          { part: "prognosis", aspect: "technique", value: 70 },
          { part: "feedback", aspect: "technique", value: 90 },
        ],
      })
    )
    expect(html).not.toMatch(/data-section="wellbeing" data-empty/)
    expect(html).not.toMatch(/data-section="feedback" data-empty/)
    expect(html).toContain(">Befinden leeren<")
    expect(html).toContain(">Feedback leeren<")
    expect(html).toMatch(
      /aria-label="Technik: 4, gut"[^>]*class="[^"]*outline-dashed|class="[^"]*outline-dashed[^"]*"[^>]*aria-label="Technik: 4, gut"/
    )
  })

  it("Scheiben wie in der Liste, ohne Lösen und Herkunft; „Scheiben ändern“; Ausführung je Scheibe", () => {
    const html = screen(
      entry({
        cards: {
          linked: [
            { id: "c1", card: card("c1") },
            { id: "gone", card: null },
          ],
          added: [
            card("c2", { startedAtMs: Date.UTC(2026, 2, 13, 19, 30), provenance: "measured" }),
          ],
          offered: [card("c3")],
          elsewhere: [{ card: card("c4"), entryId: "e9", title: "Ruhe im Kopf" }],
        },
        series: {
          c1: [{ series: 1, shots: 10, result: { value: 89, scoring: "rings", digits: 0 } }],
          c2: [],
        },
        basicsEditable: false,
      })
    )
    expect(html).toContain("19:55")
    expect(html.match(/<a [^>]*data-entry-card="c1"[^>]*>/)?.[0]).toContain('href="/cards/c1"')
    expect(html).toContain("374,3 Ringe")
    expect(html).not.toContain("vom Ausdruck")
    expect(html).not.toContain("dazugekommen")
    expect(html).not.toContain(">Lösen<")
    expect(html).toContain("Scheibe gelöscht")
    expect(html).toMatch(/data-change-cards[^>]*>Scheiben ändern</)
    expect(html).toContain('data-section="execution"')
    expect(html).toContain("Kommen von den Scheiben dieses Eintrags.")
  })

  it("Ausführung: jede Scheibe ein Block mit Kopf, ihre Serien eingerückt darunter", () => {
    const html = screen(
      entry({
        cards: {
          linked: [
            { id: "c1", card: card("c1") },
            { id: "c2", card: card("c2", { startedAtMs: Date.UTC(2026, 2, 13, 19, 30) }) },
          ],
          added: [],
          offered: [],
          elsewhere: [],
        },
        series: {
          c1: [
            { series: 1, shots: 10, result: { value: 89, scoring: "rings", digits: 0 } },
            { series: 2, shots: 10, result: { value: 91, scoring: "rings", digits: 0 } },
          ],
          c2: [{ series: 1, shots: 10, result: { value: 93, scoring: "rings", digits: 0 } }],
        },
        executions: [{ cardId: "c1", series: 1, value: 70 }],
      })
    )
    const blocks = [
      ...html.matchAll(/data-execution-card="(c\d)"([\s\S]*?)(?=data-execution-card=|$)/g),
    ]
    expect(blocks.map((m) => m[1])).toEqual(["c1", "c2"])
    // je Serie oben „Serie N“ ohne Umbruch, darunter die Summe (mit dem Wort der Stufe, wenn bewertet)
    const rows = (block: string) =>
      [...block.matchAll(/whitespace-nowrap">(Serie \d)<\/span><span[^>]*>([^<]*)</g)].map(
        (m) => `${m[1]}|${m[2]}`
      )
    expect(rows(blocks[0][2])).toEqual(["Serie 1|89 · gut", "Serie 2|91"])
    expect(rows(blocks[1][2])).toEqual(["Serie 1|93"])
  })

  it("zeigt die Frage des Fadens nur, solange das Vorhaben leer ist", () => {
    const thread = { entryId: "e0", day: "2026-03-06", question: "das öfter zu schaffen?" }
    const empty = screen(entry({ thread }))
    expect(empty).toContain("data-thread-hint")
    expect(empty).toContain("Deine Frage vom Fr 06.03.")
    expect(empty).toContain("Wie schaffe ich es, das öfter zu schaffen?")
    expect(empty).toContain("Als Vorhaben nehmen")
    const taken = screen(entry({ thread, intention: "Ruhe" }))
    expect(taken).not.toContain("data-thread-hint")
    expect(taken).not.toContain("Deine Frage vom")
    expect(taken).not.toContain("Als Vorhaben nehmen")
  })

  it("Trocken- und Mentaltraining ohne Kasten der Scheiben", () => {
    const html = screen(entry({ kind: "mental", family: null }))
    expect(html).not.toContain("data-entry-cards")
    expect(html).toContain(">Mentaltraining<")
  })
})

describe("Liste und Faden", () => {
  it("fünf Reiter als TabBar, gewählt „Auswertung“ mit „Neuer Eintrag“ oben", () => {
    const html = renderToStaticMarkup(createElement(DiaryHeader, { current: "analysis" }))
    const switchHtml = html.slice(html.indexOf("data-diary-switch"))
    expect(
      [...switchHtml.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)</g)].map((m) => m[2])
    ).toEqual(["Einträge", "Fragen", "Ziele", "Abläufe", "Auswertung"])
    expect(html).toMatch(/<a(?=[^>]*href="\/diary\/analysis")(?=[^>]*aria-current="page")/)
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(html).toMatch(/<a[^>]*href="\/diary\/new"[^>]*>.*Neuer Eintrag/)
    // die gemeinsame Reiterleiste: eine Zeile, die wischt
    expect(switchHtml).toContain("data-tab-bar")
    expect(switchHtml.match(/<a /g)).toHaveLength(5)
  })

  it("leer: der Leerzustand mit „Neuer Eintrag“", () => {
    const html = renderToStaticMarkup(
      createElement(DiaryList, { entries: [], marks: {}, timeZone: ZONE })
    )
    expect(html).toContain("Noch kein Eintrag")
    expect(html).toContain('href="/diary/new"')
  })

  it("Vorhaben als Titel, Disziplin in der Zeile, Notiz darunter, nach Monat", () => {
    const html = renderToStaticMarkup(
      createElement(DiaryList, {
        entries: [
          {
            id: "e1",
            day: "2026-03-13",
            kind: "shooting",
            family: { id: 1, slug: "lp", name: "Luftpistole" },
            intention: "Ruhe im Kopf",
            note: "Griff hat gepasst.",
            cards: [card("c1")],
          },
          {
            id: "e2",
            day: "2026-02-25",
            kind: "mental",
            family: null,
            intention: null,
            note: null,
            cards: [],
          },
        ],
        marks: {},
        timeZone: ZONE,
      })
    )
    expect(html).toContain(">Ruhe im Kopf<")
    expect(html).toContain("Fr 13.03. · Luftpistole · 1 Scheibe · 374,3 Ringe")
    expect(html).toContain("Griff hat gepasst.")
    expect(html.indexOf("März 2026")).toBeLessThan(html.indexOf("Februar 2026"))
    expect(html).toContain('href="/diary/e1"')
  })

  it("der Faden: neueste oben, jeder Punkt führt in seinen Eintrag", () => {
    const html = renderToStaticMarkup(
      createElement(ThreadView, {
        families: [{ id: 1, slug: "lp", name: "Luftpistole" }],
        family: { id: 1, slug: "lp", name: "Luftpistole" },
        items: [
          { entryId: "b", day: "2026-06-09", question: "öfters zu akzeptieren?", learned: null },
          {
            entryId: "a",
            day: "2026-03-13",
            question: "diese Sicherheit anders zu finden?",
            learned: "der Griff hilft.",
          },
        ],
        timeZone: ZONE,
      })
    )
    expect(html.indexOf("öfters zu akzeptieren?")).toBeLessThan(html.indexOf("diese Sicherheit"))
    expect(html).toContain("Ich habe gelernt, dass der Griff hilft.")
    expect(html).toContain('href="/diary/b"')
  })
})

describe("Neuer Eintrag", () => {
  it("oben „Heute“ mit genau einem Knopf, darunter die Abende als ganze Karten, der markierte hervorgehoben", () => {
    const html = renderToStaticMarkup(
      createElement(NewEntryScreen, {
        proposals: [
          {
            day: "2026-10-20",
            family: { id: 1, slug: "lp", name: "Luftpistole" },
            cards: [card("x")],
            marked: false,
          },
          {
            day: "2026-10-16",
            family: { id: 1, slug: "lp", name: "Luftpistole" },
            cards: [card("y")],
            marked: true,
          },
        ],
        marks: {},
        families: [{ id: 1, slug: "lp", name: "Luftpistole" }],
        today: "2026-10-28",
        timeZone: ZONE,
      })
    )
    // „Heute“ steht oben, mit Tag von heute und dem Satz zu den Scheiben
    expect(html.indexOf(">Heute<")).toBeLessThan(html.indexOf(">Abende ohne Eintrag<"))
    expect(html).toContain('value="2026-10-28"')
    expect(html).toContain(
      "Die Scheiben dieses Tages kommen von selbst dazu, sobald Spiegel sie hat."
    )
    expect(html).not.toContain("Ohne Scheibe")
    // genau ein „Anlegen“; die Karten sind selbst der Knopf
    expect(html.match(/>Anlegen</g)).toHaveLength(1)
    const marked = html.match(/<button [^>]*data-proposal="2026-10-16\|1"[^>]*>/)?.[0] ?? ""
    expect(marked).toContain('data-marked="true"')
    expect(marked).toContain('aria-label="Eintrag für Fr 16.10. · Luftpistole anlegen"')
    expect(marked).toContain("bg-accent-wash")
  })

  it("Abende ohne Eintrag: die ersten fünf, dann „Ältere Abende zeigen“; der Abend aus der Adresse ist immer sichtbar", () => {
    const evenings = (markedIndex: number | null) =>
      Array.from({ length: 8 }, (_, i) => ({
        day: `2026-0${9 - Math.floor(i / 4)}-${String(20 - i).padStart(2, "0")}`,
        family: { id: 1, slug: "lp", name: "Luftpistole" },
        cards: [card(`k${i}`)],
        marked: i === markedIndex,
      }))
    const render = (markedIndex: number | null) =>
      renderToStaticMarkup(
        createElement(NewEntryScreen, {
          proposals: evenings(markedIndex),
          marks: {},
          families: [{ id: 1, slug: "lp", name: "Luftpistole" }],
          today: "2026-10-28",
          timeZone: ZONE,
        })
      )
    const closed = render(null)
    expect(closed.match(/data-proposal=/g)).toHaveLength(5)
    expect(closed).toMatch(/data-older-evenings[^>]*>Ältere Abende zeigen \(3\)</)
    const open = render(6)
    expect(open.match(/data-proposal=/g)).toHaveLength(8)
    expect(open).not.toContain("data-older-evenings")
    expect(open).toMatch(/<h3[^>]*>[^<]*2026<\/h3>/)
  })
})
