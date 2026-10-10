import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import { parseSnapshot } from "@vereinsheim/ingest-contract/parse"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import { readingSnapshots, sqlLiteral, stepSql, textCell } from "./output"
import { Sim } from "./stand"

const START = Date.UTC(2026, 9, 9, 17, 0)
const lp = (sim: Sim, scheibenId = -7257056) =>
  sim.card({
    scheibenId,
    disziplinId: 19210040,
    disziplin: "LP 40 alt",
    target: LP_10M,
    standNr: 8,
    display: 2,
  })

/** zwei Probeschüsse, gelesen; dann der erste Wertungsschuss, gelesen; dann nichts, gelesen */
function scenario() {
  const sim = new Sim(START)
  const card = lp(sim)
  card.shot(0, 0, 0)
  sim.advance(40_000)
  card.shot(0, 300, 400)
  sim.read("zwei Probeschüsse")
  sim.advance(60_000)
  card.shot(1, 0, 0)
  sim.read("erster Wertungsschuss, die Probe ist weg")
  sim.advance(5_000)
  sim.read("unverändert")
  return sim
}

describe("Zellen wie das MySQL-Textprotokoll", () => {
  it("Ganzzahlen als Dezimaltext, Datum und Text unverändert, nie null", () => {
    expect(textCell(-7257056)).toBe("-7257056")
    expect(textCell(0)).toBe("0")
    expect(textCell("0000-00-00 00:00:00")).toBe("0000-00-00 00:00:00")
    expect(textCell("10*")).toBe("10*")
  })
})

describe("Snapshots je Lesung", () => {
  const readings = readingSnapshots(scenario().readings)

  it("jeder ist gültig nach dem Vertrag, die Prüfsumme die des Vertrags", () => {
    const all = readings.flatMap((r) => r.snapshots)
    expect(all).toHaveLength(3)
    for (const snapshot of all) {
      const parsed = parseSnapshot(snapshot)
      expect(parsed.ok, JSON.stringify(parsed)).toBe(true)
      expect(snapshot.checksum).toBe(computeChecksum(snapshot.data))
    }
  })

  it("Hülle: Quelle, Version aus `Version`, Epoche 1, Folgenummer steigend, Beobachtungszeit in UTC", () => {
    const [first, second, third] = readings.map((r) => r.snapshots[0])
    expect(first).toMatchObject({
      contractVersion: 1,
      source: "meyton-ssmdb2",
      sourceVersion: "9",
      epoch: 1,
      scheibenId: -7257056,
      sequence: 1,
      observedAt: "2026-10-09T17:00:40.000Z",
      sessionTimeZone: "+00:00",
    })
    expect([second.sequence, third.sequence]).toEqual([2, 3])
    // ohne Änderung dieselbe Prüfsumme, mit der Wertung eine andere
    expect(third.checksum).toBe(second.checksum)
    expect(second.checksum).not.toBe(first.checksum)
  })

  it("Zeilen nach Primärschlüssel, Spalten mit dem Typ des Schemas; die Probe ist nach dem Wertungsschuss weg", () => {
    const [first, second] = readings.map((r) => r.snapshots[0])
    expect(first.data.treffer.rows.map((r) => [r.Stellung, r.Treffer])).toEqual([
      ["0", "1"],
      ["0", "2"],
    ])
    expect(first.data.treffer.columns.Innenzehner).toBe("tinyint(1)")
    expect(first.data.scheiben.rows[0]).toMatchObject({
      Trefferzahl: "0",
      Startzeit: "0000-00-00 00:00:00",
    })
    expect(second.data.treffer.rows.map((r) => [r.Stellung, r.Treffer, r.Text])).toEqual([
      ["1", "1", "10*"],
    ])
    expect(second.data.serien.rows).toEqual([
      { ScheibenID: "-7257056", Stellung: "1", Serie: "1", Ring: "10", Ring01: "109" },
    ])
  })
})

describe("SQL je Schritt", () => {
  const sim = scenario()
  const sql = sim.readings.map((r, i) => stepSql(i ? sim.readings[i - 1].ablage : null, r.ablage))

  it("der erste Schritt legt Version, Scheibe, Serien und Treffer an", () => {
    expect(sql[0]).toMatch(/^INSERT INTO `Version` \(`Versionsnummer`\) VALUES \(9\);/m)
    expect(sql[0]).toMatch(
      /^INSERT INTO `Scheiben` \(`ScheibenID`, .*\) VALUES \(-7257056, 'Direktbelegung'/m
    )
    expect(sql[0].match(/^INSERT INTO `Treffer`/gm)).toHaveLength(2)
  })

  it("danach nur der Unterschied: Probe gelöscht, Wertung eingefügt, Kopfzeile geändert; ohne Änderung leer", () => {
    expect(sql[1]).toMatch(
      /^DELETE FROM `Treffer` WHERE `ScheibenID` = -7257056 AND `Stellung` = 0 AND `Treffer` = 1;/m
    )
    expect(sql[1]).toMatch(
      /^INSERT INTO `Treffer` .* VALUES \(-7257056, 1, 1, 1, 0, 0, 1, 2, '10\*'/m
    )
    expect(sql[1]).toMatch(
      /^UPDATE `Scheiben` SET .*`Trefferzahl` = 1.* WHERE `ScheibenID` = -7257056;/m
    )
    expect(sql[1].indexOf("DELETE FROM `Treffer`")).toBeLessThan(
      sql[1].indexOf("INSERT INTO `Treffer`")
    )
    expect(sql[2]).toBe("")
  })

  it("Text als SQL-Literal mit verdoppeltem Hochkomma; Backslash gibt es nicht", () => {
    expect(sqlLiteral("O'Brien")).toBe("'O''Brien'")
    expect(sqlLiteral(-5)).toBe("-5")
    expect(() => sqlLiteral("a\\b")).toThrow()
  })
})
