import { LG_10M, LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import { trefferOf, serienOf } from "./ablage"
import { scheibenIdAt, Sim } from "./stand"

/** 9. Oktober 2026, 19:00 Uhr MESZ = 17:00 UTC */
const START = Date.UTC(2026, 9, 9, 17, 0)
const lp = (sim: Sim, extra: Partial<Parameters<Sim["card"]>[0]> = {}) =>
  sim.card({
    scheibenId: 1001,
    disziplinId: 19210040,
    disziplin: "LP 40 alt",
    target: LP_10M,
    standNr: 8,
    display: 2,
    ...extra,
  })

describe("Baukasten: ein Stand schreibt wie Meyton", () => {
  it("eine neue Scheibe: Kopfzeile wie im Training, ohne Wertung Platzhalter als bester Teiler", () => {
    const sim = new Sim(START)
    lp(sim)
    const row = sim.ablage.scheiben.get(1001)!
    expect(row).toMatchObject({
      ScheibenID: 1001,
      Startzeit: "0000-00-00 00:00:00",
      Starterliste: "Direktbelegung",
      Status: "",
      StandNr: 8,
      StandNrText: "8",
      DisziplinID: 19210040,
      Trefferzahl: 0,
      TotalRing: 0,
      TotalRing01: 0,
      BesterTeiler01: 2147483647,
      BesterTeiler001: 2147483647,
      Zeitstempel: "2026-10-09 19:00:00",
      Nachname: "Muster",
      SportpassID: 12345678,
    })
  })

  it("Probe: Nummern ab 1, Serien zu zehn auch in `Serien`; die Kopfzeile zählt sie nicht", () => {
    const sim = new Sim(START)
    const card = lp(sim)
    for (let i = 0; i < 12; i++) {
      card.shot(0, 0, 0)
      sim.advance(40_000)
    }
    const probe = trefferOf(sim.ablage, 1001, 0)
    expect(probe.map((t) => [t.Treffer, t.Serie])).toEqual(
      Array.from({ length: 12 }, (_, i) => [i + 1, i < 10 ? 1 : 2])
    )
    expect(serienOf(sim.ablage, 1001, 0).map((s) => [s.Serie, s.Ring, s.Ring01])).toEqual([
      [1, 100, 1090],
      [2, 20, 218],
    ])
    expect(sim.ablage.scheiben.get(1001)).toMatchObject({ Trefferzahl: 0, TotalRing: 0 })
    // Zeit des Schusses nach der Uhr des Stands, Lebenszeichen mit ihm
    expect(probe[1]).toMatchObject({ Zeitstempel: "2026-10-09 19:00:40", Millisekunden: 0 })
    expect(sim.ablage.scheiben.get(1001)!.Zeitstempel).toBe("2026-10-09 19:07:20")
  })

  it("der erste Wertungsschuss löscht die Probe in derselben Lesung (SF-03), Summen nur aus Wertung", () => {
    const sim = new Sim(START)
    const card = lp(sim)
    card.shot(0, 0, 0)
    card.shot(0, 100, 0)
    card.shot(1, 0, 0)
    card.shot(1, 0, 0)
    expect(trefferOf(sim.ablage, 1001, 0)).toEqual([])
    expect(serienOf(sim.ablage, 1001, 0)).toEqual([])
    expect(trefferOf(sim.ablage, 1001, 1).map((t) => t.Treffer)).toEqual([1, 2])
    expect(sim.ablage.scheiben.get(1001)).toMatchObject({
      Trefferzahl: 2,
      TotalRing: 200,
      TotalRing01: 218,
      BesterTeiler01: 0,
    })
    // zurück auf Probe (SF-04): neue Probe ab 1, mit dem nächsten Wertungsschuss wieder weg
    card.shot(0, 0, 0)
    expect(trefferOf(sim.ablage, 1001, 0).map((t) => t.Treffer)).toEqual([1])
    card.shot(1, 0, 0)
    expect(trefferOf(sim.ablage, 1001, 0)).toEqual([])
    expect(trefferOf(sim.ablage, 1001, 1).map((t) => t.Treffer)).toEqual([1, 2, 3])
  })

  it("Neustart der Probe (SF-72): die alte Probe geht mit dem ersten neuen Schuss, Nummern wieder ab 1", () => {
    const sim = new Sim(START)
    const card = lp(sim)
    for (let i = 0; i < 3; i++) card.shot(0, 100 * i, 0)
    card.restartProbe()
    expect(trefferOf(sim.ablage, 1001, 0)).toHaveLength(3)
    card.shot(0, 500, 500)
    expect(trefferOf(sim.ablage, 1001, 0).map((t) => [t.Treffer, t.x])).toEqual([[1, 500]])
  })

  it("über der Soll-Zahl (SF-08): Wert 0, „0F“, Platzhalter-Teiler; `Trefferzahl` zählt mit", () => {
    const sim = new Sim(START)
    const card = lp(sim, { disziplinId: 19210002, disziplin: "LP 2" })
    card.shot(1, 0, 0)
    card.shot(1, 0, 0)
    card.shot(1, 0, 0)
    const third = trefferOf(sim.ablage, 1001, 1)[2]
    expect(third).toMatchObject({
      x: 0,
      y: 0,
      Ring: 0,
      Ring01: 0,
      Text: "0F",
      Teiler01: 2147483647,
    })
    expect(sim.ablage.scheiben.get(1001)).toMatchObject({ Trefferzahl: 3, TotalRing01: 218 })
  })

  it("Anzeigeart umschalten (SF-74): `Wertung` und `Text` ändern sich, die Werte nicht", () => {
    const sim = new Sim(START)
    const card = lp(sim)
    card.shot(1, 0, 0)
    const before = trefferOf(sim.ablage, 1001, 1)[0]
    card.setDisplay(7)
    const after = trefferOf(sim.ablage, 1001, 1)[0]
    expect(after).toEqual({ ...before, Wertung: 7, Text: "10.9 0T" })
  })

  it("Uhr je Stand (SF-73): ein Stand, der 663 s nachgeht, schreibt die frühere Zeit", () => {
    const sim = new Sim(START)
    const card = lp(sim, { clockOffsetMs: -663_000 })
    card.shot(1, 0, 0)
    expect(trefferOf(sim.ablage, 1001, 1)[0].Zeitstempel).toBe("2026-10-09 18:48:57")
  })

  it("ScheibenID als Millisekundenzähler: vorzeichenbehaftet, Überlauf nach 2³² ms", () => {
    expect(scheibenIdAt(0, 1000)).toBe(1000)
    expect(scheibenIdAt(0, 2 ** 31)).toBe(-(2 ** 31))
    expect(scheibenIdAt(0, 2 ** 32 + 5)).toBe(5)
  })

  it("zerrissene Lesung (SF-71): die Scheibe ohne Treffer und Serien, danach wieder gleich", () => {
    const sim = new Sim(START)
    const card = lp(sim)
    card.shot(1, 0, 0)
    card.shot(1, 300, 0)
    const whole = structuredClone(sim.ablage)
    card.tear()
    expect(trefferOf(sim.ablage, 1001, 1)).toEqual([])
    expect(serienOf(sim.ablage, 1001, 1)).toEqual([])
    expect(sim.ablage.scheiben.has(1001)).toBe(true)
    card.mend()
    expect(sim.ablage).toEqual(whole)
  })

  it("Handeintrag (SF-15): Wert gesetzt, Lage 0/0, Teiler 0, „Hand“; zählt wie ein Wertungsschuss", () => {
    const sim = new Sim(START)
    const card = lp(sim)
    card.shot(1, 300, 400)
    card.handEntry(1, 95)
    expect(trefferOf(sim.ablage, 1001, 1)[1]).toMatchObject({
      Treffer: 2,
      x: 0,
      y: 0,
      Ring: 90,
      Ring01: 95,
      Teiler01: 0,
      Teiler001: 0,
      Text: "Hand",
    })
    expect(sim.ablage.scheiben.get(1001)).toMatchObject({ Trefferzahl: 2, BesterTeiler01: 0 })
  })

  it("Korrektur und Löschung mit Nachrücken (SF-21, SF-22; Annahme)", () => {
    const sim = new Sim(START)
    const card = sim.card({
      scheibenId: 7,
      disziplinId: 19110040,
      disziplin: "LG 40 alt",
      target: LG_10M,
      standNr: 3,
      display: 1,
    })
    for (let i = 0; i < 4; i++) card.shot(1, 10 * i, 0)
    card.correct(1, 2, 0, 0)
    expect(trefferOf(sim.ablage, 7, 1)[1]).toMatchObject({ x: 0, Ring01: 109, Text: "10.9" })
    card.remove(1, 2)
    expect(trefferOf(sim.ablage, 7, 1).map((t) => [t.Treffer, t.x])).toEqual([
      [1, 0],
      [2, 20],
      [3, 30],
    ])
    expect(sim.ablage.scheiben.get(7)!.Trefferzahl).toBe(3)
  })
})
