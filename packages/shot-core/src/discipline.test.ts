import { describe, expect, it } from "vitest"

import {
  classifyCompleteness,
  parseDisciplineId,
  plannedShotsOf,
  resolveTarget,
  suggestFamily,
  suggestIgnore,
  type AdminMapping,
} from "./discipline"

describe("parseDisciplineId", () => {
  it("zerlegt Entfernung, Regelnummer und Schusszahl", () => {
    expect(parseDisciplineId(10210040)).toEqual({
      raw: 10210040,
      distanceCode: 1,
      rule: "0210",
      shotCode: 40,
      plannedShots: 40,
      openEnded: false,
    })
    expect(parseDisciplineId(40180060)).toMatchObject({
      distanceCode: 4,
      rule: "0180",
      plannedShots: 60,
    })
  })

  it("000 heißt offen, wie bei Meytons „LG Training Spiegel“ (SF-09)", () => {
    expect(parseDisciplineId(19110000)).toMatchObject({ plannedShots: null, openEnded: true })
  })

  it("über 100 ist ein Varianten-Code, keine Schusszahl", () => {
    expect(parseDisciplineId(10530240)).toMatchObject({ shotCode: 240, plannedShots: null })
    expect(parseDisciplineId(11010100)).toMatchObject({ plannedShots: 100 })
  })

  it("zerlegt vereinseigene und ungültige IDs nicht", () => {
    for (const raw of [7, -5, 1.5, 123456789]) {
      expect(parseDisciplineId(raw)).toEqual({
        raw,
        distanceCode: null,
        rule: null,
        shotCode: null,
        plannedShots: null,
        openEnded: false,
      })
    }
  })
})

describe("plannedShotsOf", () => {
  it("ohne Zahl des Admins die aus der DisziplinID", () => {
    expect(plannedShotsOf(19200020, null)).toBe(20)
    expect(plannedShotsOf(10119000, null)).toBeNull()
    expect(plannedShotsOf(123, null)).toBeNull()
  })

  it("die Zahl des Admins geht vor, 0 heißt keine feste", () => {
    expect(plannedShotsOf(19200020, 3)).toBe(3)
    expect(plannedShotsOf(10110040, 0)).toBeNull()
  })
})

describe("suggestIgnore", () => {
  it("Meytons Spiele und Trainingsscheiben", () => {
    expect(suggestIgnore(18051010)).toBe(true) // LG Schach 6x6
    expect(suggestIgnore(18154010)).toBe(true) // LP Dart
    expect(suggestIgnore(19001000)).toBe(true) // LP-Trainingsscheibe
    expect(suggestIgnore(19002000)).toBe(true) // LG-Trainingsscheibe
  })

  it("nicht Sport mit eigener Scheibe, Standard oder vereinseigene Nummern", () => {
    expect(suggestIgnore(11062040)).toBe(false) // Kyffhäuser
    expect(suggestIgnore(19110040)).toBe(false) // LG 40 alt
    expect(suggestIgnore(10119000)).toBe(false) // LG Training Spiegel (Verein)
    expect(suggestIgnore(10199005)).toBe(false) // Zimmerstutzen
  })
})

describe("resolveTarget", () => {
  const resolve = (disciplineId: number, name: string, adminMappings?: AdminMapping[]) =>
    resolveTarget({ disciplineId, name, adminMappings })

  it("findet Standard-Disziplinen im Meyton-Katalog", () => {
    expect(resolve(10110040, "LG 40")).toEqual({ targetId: "lg-10m", source: "catalog" })
    expect(resolve(10210040, "LP 40")).toEqual({ targetId: "lp-10m", source: "catalog" })
    expect(resolve(19210040, "LP 40 alt")).toEqual({ targetId: "lp-10m", source: "catalog" })
    expect(resolve(10111030, "LG Auflage 30")).toEqual({ targetId: "lg-10m", source: "catalog" })
    expect(resolve(10211015, "LP Auflage 15")).toEqual({ targetId: "lp-10m", source: "catalog" })
    expect(resolve(11110010, "LP P+10W")).toEqual({ targetId: "lp-10m", source: "catalog" })
    expect(resolve(19110000, "LG Training Spiegel")).toEqual({
      targetId: "lg-10m",
      source: "catalog",
    })
  })

  it("unterscheidet gleiche Regelnummern über die ganze ID (SF-70)", () => {
    expect(resolve(10610040, "LP Liga")).toEqual({ targetId: "lp-10m", source: "catalog" })
    expect(resolve(10610220, "ISSF AR Men Final")).toEqual({
      targetId: "lg-10m",
      source: "catalog",
    })
    expect(resolve(10611220, "ISSF AP Men Final")).toEqual({
      targetId: "lp-10m",
      source: "catalog",
    })
    expect(resolve(10612040, "Training")).toEqual({ targetId: null, source: "unknown" })
  })

  it("kein Rückfall über Regelbereiche: die französische Luftpistole hat Regel 0100 (SF-70)", () => {
    expect(resolve(10100040, "Pistolet air 40")).toEqual({ targetId: null, source: "unknown" })
  })

  it("Meyton-Disziplinen mit eigener Scheibe fallen nicht über den Namen auf die Standardscheibe", () => {
    for (const [id, name] of [
      [11062040, "LG Kyffhäuser 40"],
      [11064040, "LG 12er 40"],
      [17401115, "LG Löwenbräu Finale"],
      [17402115, "LP Löwenbräu Finale"],
      [10216040, "LP5 40"],
    ] as const) {
      expect(resolve(id, name)).toEqual({ targetId: null, source: "unknown" })
    }
  })

  it("Vereinsspiele und Meytons Trainingsscheiben bleiben unbekannt, trotz LG/LP im Namen (SF-70)", () => {
    // Kopie der Vereinsanlage vom 9. Oktober 2026: Auf der Standardscheibe passten diese Disziplinen
    // fast nie (0 bis 17 von bis zu 390 Schüssen); die Trainingsscheiben werten 0,0 bis 1,9.
    for (const [id, name] of [
      [18051010, "LG Schach 6x6"],
      [18000200, "LG Balken 5,5x90 mm"],
      [18054010, "LG Dart"],
      [18104200, "LP Dreieck 60x60 mm"],
      [18106200, "LP Spiegel"],
      [18151010, "LP Schach 6x6"],
      [18154010, "LP Dart"],
      [19001000, "LP-Trainingsscheibe"],
      [19002000, "LG-Trainingsscheibe"],
    ] as const) {
      expect(resolve(id, name), `${id} ${name}`).toEqual({ targetId: null, source: "unknown" })
    }
    // Nur der belegte Bereich bis 8154; dahinter gilt wieder der Name.
    expect(resolve(18155010, "LG Neues Spiel")).toEqual({ targetId: "lg-10m", source: "name" })
  })

  it("eine Vereinsdisziplin ohne Scheibe legt der Admin fest, nicht der Katalog (ADR-029)", () => {
    // „LG Training Spiegel“ des Vereins (10119000) wertet 0,0 bis 1,9; über den Namen landete sie auf
    // der Standardscheibe. Vereinseigene Nummern gehören nicht in den Code.
    expect(resolve(10119000, "LG Training Spiegel")).toEqual({ targetId: "lg-10m", source: "name" })
    const mappings: AdminMapping[] = [
      { disciplineId: 10119000, name: "LG Training Spiegel", targetId: null },
    ]
    expect(resolve(10119000, "LG Training Spiegel", mappings)).toEqual({
      targetId: null,
      source: "admin",
    })
  })

  it("Varianten des Vereins auf der Standardscheibe bleiben dort (Kopie vom 9. Oktober 2026)", () => {
    expect(resolve(19110040, "LG 40 alt")).toEqual({ targetId: "lg-10m", source: "catalog" })
    expect(resolve(19200020, "Kranzl LG")).toEqual({ targetId: "lg-10m", source: "name" })
    expect(resolve(19000010, "LG 40 nachhalten")).toEqual({ targetId: "lg-10m", source: "name" })
  })

  it("auch eine französische Luftpistole mit Liga-ähnlicher Nummer bleibt unbekannt", () => {
    expect(resolve(10516140, "Pistolet air 5 40")).toEqual({ targetId: null, source: "unknown" })
  })

  it("fällt auf den Namen zurück, wenn der Katalog die ID nicht kennt", () => {
    expect(resolve(7, "LP 40 alt")).toEqual({ targetId: "lp-10m", source: "name" })
    expect(resolve(18311030, "BdHDS LG Auflage")).toEqual({ targetId: "lg-10m", source: "name" })
    expect(resolve(7, "Luftgewehrauflage")).toEqual({ targetId: "lg-10m", source: "name" })
    expect(resolve(7, "Luftpistolen-Pokal")).toEqual({ targetId: "lp-10m", source: "name" })
    expect(resolve(7, "Luftpistole Vereinsmeister")).toEqual({
      targetId: "lp-10m",
      source: "name",
    })
  })

  it("bleibt unbekannt bei widersprüchlichem Namen, anderer Entfernung oder fremder Scheibe", () => {
    expect(resolve(7, "LG/LP Mix")).toEqual({ targetId: null, source: "unknown" })
    expect(resolve(40180060, "KK 60 liegend")).toEqual({ targetId: null, source: "unknown" })
    expect(resolve(7, "Schach 10")).toEqual({ targetId: null, source: "unknown" })
    // Andere Entfernung: kein Namens-Rückfall, auch wenn „LG“ im Namen steht.
    expect(resolve(40110040, "LG 40")).toEqual({ targetId: null, source: "unknown" })
  })

  it("die Admin-Zuordnung gewinnt, Name ohne Rücksicht auf Groß- und Leerschreibung", () => {
    const mappings: AdminMapping[] = [
      { disciplineId: 10210040, name: "  lp   40 ", targetId: "lg-10m" },
    ]
    expect(resolve(10210040, "LP 40", mappings)).toEqual({ targetId: "lg-10m", source: "admin" })
    expect(resolve(10210040, "LP 40 alt", mappings)).toEqual({
      targetId: "lp-10m",
      source: "catalog",
    })
  })
})

describe("suggestFamily", () => {
  it("Auflage aus der Regelnummer oder dem Namen", () => {
    expect(
      suggestFamily({ targetId: "lg-10m", disciplineId: 10111030, name: "LG Auflage 30" })
    ).toBe("lg-auflage")
    expect(suggestFamily({ targetId: "lg-10m", disciplineId: 7, name: "LG aufgelegt" })).toBe(
      "lg-auflage"
    )
    expect(
      suggestFamily({ targetId: "lp-10m", disciplineId: 10211030, name: "LP Auflage 30" })
    ).toBe("lp-auflage")
  })

  it("Auflage kommt auch allein aus der Regel, und Abkürzungen im Namen zählen", () => {
    expect(
      suggestFamily({ targetId: "lg-10m", disciplineId: 10111030, name: "Vereinsmeister" })
    ).toBe("lg-auflage")
    expect(suggestFamily({ targetId: "lg-10m", disciplineId: 7, name: "LG Aufl. 30" })).toBe(
      "lg-auflage"
    )
    expect(suggestFamily({ targetId: "lg-10m", disciplineId: 7, name: "Luftgewehrauflage" })).toBe(
      "lg-auflage"
    )
  })

  it("Varianten wie „LP 40 alt“ zählen zur selben Familie wie „LP 40“", () => {
    expect(suggestFamily({ targetId: "lp-10m", disciplineId: 10210040, name: "LP 40" })).toBe(
      "lp-freihand"
    )
    expect(suggestFamily({ targetId: "lp-10m", disciplineId: 19210040, name: "LP 40 alt" })).toBe(
      "lp-freihand"
    )
  })
})

describe("classifyCompleteness", () => {
  it.each([
    [0, 0, 40, "leer"],
    [60, 0, 40, "nur-probe"],
    [60, 40, 40, "vollstaendig"],
    [5, 23, 40, "unvollstaendig"],
    [5, 45, 40, "ueber-soll"],
    [0, 12, null, "offen"],
  ] as const)(
    "Probe %i, Wertung %i, geplant %s → %s",
    (sighterShots, matchShots, planned, expected) => {
      expect(classifyCompleteness({ sighterShots, matchShots, plannedShots: planned })).toBe(
        expected
      )
    }
  )
})
