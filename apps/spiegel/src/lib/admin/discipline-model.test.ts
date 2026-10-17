import { describe, expect, it } from "vitest"

import {
  disciplineRow,
  disciplineStatus,
  familySlug,
  fromIdLabel,
  ignoreHintText,
  shotsText,
  standText,
  statusChip,
  statusText,
  targetSuggestionText,
  type DisciplineStats,
} from "./discipline-model"

const stats = (over: Partial<DisciplineStats> = {}): DisciplineStats => ({
  cards: 12,
  owners: 4,
  lastCardMonth: "Oktober 2026",
  stand: { decimal: 1, rings: 11 },
  scoredCards: 12,
  shots: { count: 40, cards: 10, of: 12 },
  ...over,
})
const row = (
  discipline: Partial<Parameters<typeof disciplineRow>[0]["discipline"]> = {},
  over: Partial<DisciplineStats> = {},
  sibling: string | null = null
) =>
  disciplineRow({
    discipline: {
      id: 1,
      meytonId: 19_110_040,
      name: "LG 40 alt",
      targetId: "lg-10m",
      officialScoring: null,
      plannedShots: null,
      confirmedAt: null,
      ignoredAt: null,
      family: { id: 7, name: "Luftgewehr" },
      ...discipline,
    },
    stats: stats(over),
    sibling,
  })

describe("disciplineStatus", () => {
  it("vier Zustände", () => {
    const base = { confirmed: false, ignored: false, targetId: "lg-10m" as const, familyId: 1 }
    expect(disciplineStatus(base)).toBe("suggested")
    expect(disciplineStatus({ ...base, targetId: null })).toBe("waiting")
    expect(disciplineStatus({ ...base, familyId: null })).toBe("waiting")
    expect(disciplineStatus({ ...base, targetId: null, ignored: true })).toBe("suggested")
    expect(disciplineStatus({ ...base, confirmed: true })).toBe("confirmed")
    expect(disciplineStatus({ ...base, confirmed: true, ignored: true })).toBe("ignored")
  })
})

describe("disciplineRow", () => {
  it("Vorschläge aus Katalog, Name, unbekannt; Schusszahl aus der Nummer; Ignorieren", () => {
    expect(row().suggestion).toEqual({
      targetId: "lg-10m",
      source: "catalog",
      plannedShotsFromId: 40,
      ignore: false,
      sibling: null,
    })
    expect(row({ meytonId: 19_000_001, name: "König LG" }).suggestion.source).toBe("name")
    const zs = row({ meytonId: 10_199_005, name: "Zimmerstutzen", targetId: null, family: null })
    expect(zs.suggestion.source).toBe("unknown")
    expect(zs.status).toBe("waiting")
    expect(zs.visible).toBe(false)
    expect(row({ meytonId: 19_200_020, name: "Kranzl LG" }).suggestion.plannedShotsFromId).toBe(20)
    const chess = row({
      meytonId: 18_051_010,
      name: "LG Schach 6x6",
      targetId: null,
      family: null,
      ignoredAt: new Date(),
    })
    expect(chess.suggestion.ignore).toBe(true)
    expect(chess.status).toBe("suggested")
    expect(chess.visible).toBe(false)
  })

  it("ein unbekanntes Scheibenbild gilt als keins", () => {
    expect(row({ targetId: "kk-50m" }).targetId).toBeNull()
  })
})

describe("Sätze", () => {
  it("Zustand in der Liste", () => {
    expect(statusChip(row({ targetId: null }))).toBe("Scheiben warten")
    expect(statusChip(row())).toBe("Vorschlag")
    expect(statusChip(row({ ignoredAt: new Date() }))).toBe("Vorschlag: ignorieren")
    expect(statusChip(row({ confirmedAt: new Date() }))).toBeNull()
    expect(statusChip(row({ confirmedAt: new Date(), targetId: null }))).toBe("wird nicht gezeigt")
  })

  it("Zustand oben im Blatt", () => {
    expect(statusText(row({ targetId: null }))).toBe(
      "Spiegel kennt diese Disziplin nicht. Ihre Scheiben erscheinen erst, wenn du sie einordnest."
    )
    expect(statusText(row())).toBe(
      "Spiegel hat diese Disziplin an der Nummer erkannt. Bitte prüf den Vorschlag."
    )
    expect(statusText(row({ meytonId: 19_000_001, name: "König LG" }))).toBe(
      "Spiegel hat diese Disziplin am Namen erkannt. Bitte prüf den Vorschlag genau."
    )
    expect(statusText(row({}, {}, "LG 40 Verein"))).toBe(
      "Eine Disziplin mit derselben Nummer hieß früher „LG 40 Verein“. Spiegel hat ihre Einstellungen übernommen. Bitte prüf sie."
    )
    expect(statusText(row({ ignoredAt: new Date() }))).toBe(
      "Das ist ein Spiel oder eine Trainingsscheibe von Meyton. Spiegel ignoriert die Disziplin deshalb. Bitte prüf das."
    )
    expect(statusText(row({ confirmedAt: new Date(), ignoredAt: new Date() }))).toBe(
      "Spiegel ignoriert diese Disziplin. Ihre Scheiben zeigt Spiegel nirgends."
    )
    expect(statusText(row({ confirmedAt: new Date() }))).toBeNull()
  })

  it("Vorschlag für die Scheibe", () => {
    expect(targetSuggestionText(row())).toBe("Vorschlag nach der Nummer: Luftgewehr 10 m")
    expect(targetSuggestionText(row({ meytonId: 19_100_001, name: "König LP" }))).toBe(
      "Vorschlag nach dem Namen: Luftpistole 10 m"
    )
    expect(targetSuggestionText(row({ meytonId: 10_199_005, name: "Zimmerstutzen" }))).toBe(
      "Kein Vorschlag. Spiegel erkennt die Scheibe weder an der Nummer noch am Namen."
    )
  })

  it("Anzeige am Stand und Schusszahl erst ab drei Schützen", () => {
    expect(standText(stats())).toBe("Am Stand meist ganze Ringe angezeigt: 11 von 12 Scheiben.")
    expect(standText(stats({ stand: { decimal: 6, rings: 6 } }))).toBe(
      "Am Stand meist Zehntel angezeigt: 6 von 12 Scheiben."
    )
    expect(standText(stats({ stand: { decimal: 0, rings: 0 } }))).toBe(
      "Am Stand wurde noch nichts angezeigt."
    )
    expect(shotsText(stats())).toBe("Meist geschossen: 40 Schüsse, bei 10 von 12 Scheiben.")
    expect(shotsText(stats({ shots: null }))).toBe("Noch keine Scheibe mit Wertungsschüssen.")
    const few = "Dazu haben noch zu wenige Schützen diese Disziplin geschossen."
    expect(standText(stats({ owners: 2 }))).toBe(few)
    expect(shotsText(stats({ owners: 2 }))).toBe(few)
  })

  it("Hinweis aufs Ignorieren: Scheiben, aber keine mit Wertungsschüssen", () => {
    const hint =
      "Bisher hat keine Scheibe dieser Disziplin Wertungsschüsse. Hat sie keine sinnvolle Wertung, etwa als Trainingsspiegel, kannst du sie ignorieren."
    expect(ignoreHintText(row({}, { scoredCards: 0, owners: 1 }))).toBe(hint)
    expect(ignoreHintText(row({}, { scoredCards: 1 }))).toBeNull()
    expect(ignoreHintText(row({}, { cards: 0, scoredCards: 0 }))).toBeNull()
    expect(ignoreHintText(row({ ignoredAt: new Date() }, { scoredCards: 0 }))).toBeNull()
  })

  it("Schusszahl aus der Nummer", () => {
    expect(fromIdLabel(40)).toBe("Wie in der Nummer: 40")
    expect(fromIdLabel(null)).toBe("Wie in der Nummer: keine feste")
  })
})

describe("familySlug", () => {
  it("aus dem Namen, Umlaute ausgeschrieben, die Kennungen des Fachkerns sind vergeben", () => {
    expect(familySlug("Zimmerstutzen 15 m", [])).toBe("zimmerstutzen-15-m")
    expect(familySlug("Ölpreis", [])).toBe("oelpreis")
    expect(familySlug("Größe", [])).toBe("groesse")
    expect(familySlug("Zimmerstutzen 15 m", ["zimmerstutzen-15-m"])).toBe("zimmerstutzen-15-m-2")
    expect(familySlug("Zimmerstutzen 15 m", ["zimmerstutzen-15-m", "zimmerstutzen-15-m-2"])).toBe(
      "zimmerstutzen-15-m-3"
    )
    expect(familySlug("LG Freihand", [])).toBe("lg-freihand-2")
    expect(familySlug("!!!", [])).toBe("familie")
    expect(familySlug("x".repeat(60), []).length).toBe(40)
  })
})
