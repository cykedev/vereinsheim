import { describe, expect, it } from "vitest"

import {
  classifyCompleteness,
  parseDisciplineId,
  resolveTarget,
  suggestFamily,
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

  it("fällt auf den Namen zurück, wenn der Katalog die ID nicht kennt", () => {
    expect(resolve(7, "LP 40 alt")).toEqual({ targetId: "lp-10m", source: "name" })
    expect(resolve(18311030, "BdHDS LG Auflage")).toEqual({ targetId: "lg-10m", source: "name" })
    expect(resolve(7, "Luftpistole Vereinsmeister")).toEqual({
      targetId: "lp-10m",
      source: "name",
    })
  })

  it("bleibt unbekannt bei widersprüchlichem Namen, anderer Entfernung oder fremder Scheibe", () => {
    expect(resolve(7, "LG/LP Mix")).toEqual({ targetId: null, source: "unknown" })
    expect(resolve(40180060, "KK 60 liegend")).toEqual({ targetId: null, source: "unknown" })
    expect(resolve(7, "Schach 10")).toEqual({ targetId: null, source: "unknown" })
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
