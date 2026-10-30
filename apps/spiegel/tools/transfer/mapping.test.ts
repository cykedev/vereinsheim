import { describe, expect, it } from "vitest"

import { parseMappingCsvLines } from "../../src/lib/transfer/accountMatch"
import { accountHash } from "./account-hash"
import { planMapping } from "./mapping"

// Erfundene Adressen (ADR-029).
const csv = (...lines: string[]) =>
  parseMappingCsvLines(["from,to,status,reason", ...lines].join("\n"))

describe("planMapping", () => {
  it("nur ok und new laufen, mit Zeile und Hash", () => {
    expect(planMapping(csv("a@x.invalid,a@x.invalid,ok,", "b@x.invalid,b@x.invalid,new,"))).toEqual(
      {
        kind: "ok",
        runs: [
          { line: 2, from: "a@x.invalid", to: "a@x.invalid", hash: accountHash("a@x.invalid") },
          { line: 3, from: "b@x.invalid", to: "b@x.invalid", hash: accountHash("b@x.invalid") },
        ],
        rejected: [],
      }
    )
  })

  it("check wird abgelehnt, ok desselben from daneben wartet (checkPending)", () => {
    const plan = planMapping(
      csv(
        "a@x.invalid,c@x.invalid,check,gleicher Name",
        "a@x.invalid,a@x.invalid,new,",
        "b@x.invalid,b@x.invalid,ok,"
      )
    )
    expect(plan).toEqual({
      kind: "ok",
      runs: [{ line: 4, from: "b@x.invalid", to: "b@x.invalid", hash: accountHash("b@x.invalid") }],
      rejected: [
        { line: 2, hash: accountHash("a@x.invalid"), reason: "check" },
        { line: 3, hash: accountHash("a@x.invalid"), reason: "checkPending" },
      ],
    })
  })

  it("ein from mit zwei to bricht die ganze Datei ab und nennt beide Zeilen", () => {
    expect(
      planMapping(
        csv(
          "a@x.invalid,a@x.invalid,ok,",
          "b@x.invalid,b@x.invalid,ok,",
          "A@x.invalid,c@x.invalid,new,"
        )
      )
    ).toEqual({ kind: "conflict", fromConflicts: [[2, 4]], toConflicts: [] })
  })

  it("zwei from auf ein to brechen die ganze Datei ab", () => {
    expect(planMapping(csv("a@x.invalid,c@x.invalid,ok,", "b@x.invalid,C@x.invalid,ok,"))).toEqual({
      kind: "conflict",
      fromConflicts: [],
      toConflicts: [[2, 3]],
    })
  })

  it("eine check-Zeile auf dasselbe to ist kein Konflikt", () => {
    expect(
      planMapping(csv("a@x.invalid,c@x.invalid,check,", "c@x.invalid,c@x.invalid,ok,")).kind
    ).toBe("ok")
  })

  it("eine doppelte gleiche Zeile läuft einmal, unter der ersten Nummer; Groß- und Kleinschreibung zählen als gleich", () => {
    const plan = planMapping(csv("a@x.invalid,a@x.invalid,ok,", " A@X.invalid,a@x.INVALID,ok,"))
    expect(plan).toEqual({
      kind: "ok",
      runs: [{ line: 2, from: "a@x.invalid", to: "a@x.invalid", hash: accountHash("a@x.invalid") }],
      rejected: [],
    })
  })
})
