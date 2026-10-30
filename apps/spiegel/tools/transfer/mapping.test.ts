import { describe, expect, it } from "vitest"

import { parseMappingCsvLines } from "../../src/lib/transfer/accountMatch"
import { accountHash, emailHash } from "./account-hash"
import {
  outsideMapping,
  parseSpiegelStatus,
  parseTreffsicherStatus,
  planMapping,
  statusRows,
} from "./mapping"

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

describe("Status je Zeile", () => {
  const rows = csv(
    "a@x.invalid,a@x.invalid,ok,",
    "b@x.invalid,b@x.invalid,ok,",
    "c@x.invalid,c@x.invalid,new,",
    "d@x.invalid,d@x.invalid,ok,",
    "e@x.invalid,f@x.invalid,check,gleicher Name",
    "e@x.invalid,e@x.invalid,new,",
    "g@x.invalid,g@x.invalid,ok,"
  )
  const ts = parseTreffsicherStatus(
    [
      `${emailHash("a@x.invalid")}|1`,
      `${emailHash("b@x.invalid")}|0`,
      `${emailHash("c@x.invalid")}|1`,
      `${emailHash("d@x.invalid")}|0`,
      `${emailHash("e@x.invalid")}|0`,
      `${emailHash("h@x.invalid")}|0`,
      `${emailHash("i@x.invalid")}|1`,
      "",
    ].join("\n")
  )
  const sp = parseSpiegelStatus(
    [`${emailHash("a@x.invalid")}|2|2026-10-30`, `${emailHash("b@x.invalid")}|1|2026-10-29`].join(
      "\n"
    )
  )

  it("je Zustand, nur Zeile, Hash und Zustand", () => {
    expect(statusRows(rows, ts, sp)).toEqual([
      { line: 2, hash: accountHash("a@x.invalid"), state: "übernommen" },
      { line: 3, hash: accountHash("b@x.invalid"), state: "Merkmal fehlt" },
      { line: 4, hash: accountHash("c@x.invalid"), state: "Merkmal ohne Lauf" },
      { line: 5, hash: accountHash("d@x.invalid"), state: "offen" },
      { line: 6, hash: accountHash("e@x.invalid"), state: "zu prüfen" },
      { line: 7, hash: accountHash("e@x.invalid"), state: "zu prüfen" },
      { line: 8, hash: accountHash("g@x.invalid"), state: "fehlt in Treffsicher" },
    ])
  })

  it("die Läufe zählen am Konto in Spiegel (to), das Merkmal am Konto in Treffsicher (from)", () => {
    const moved = csv("a@x.invalid,z@x.invalid,ok,")
    const spTo = parseSpiegelStatus(`${emailHash("z@x.invalid")}|1|2026-10-30`)
    expect(statusRows(moved, ts, spTo)[0].state).toBe("übernommen")
    expect(statusRows(moved, ts, sp)[0].state).toBe("Merkmal ohne Lauf")
  })

  it("zählt die Konten in Treffsicher, die nicht in der Datei stehen", () => {
    expect(outsideMapping(ts, rows)).toBe(2)
  })

  it("eine unerwartete Zeile wirft", () => {
    expect(() => parseTreffsicherStatus("abc|1")).toThrow("Zeile 1")
    expect(() => parseTreffsicherStatus(`${emailHash("a@x.invalid")}|2`)).toThrow("Zeile 1")
    expect(() => parseSpiegelStatus(`${emailHash("a@x.invalid")}|x|2026-10-30`)).toThrow("Zeile 1")
    expect(
      parseSpiegelStatus(`${emailHash("a@x.invalid")}|3|`).get(emailHash("a@x.invalid"))
    ).toEqual({
      runs: 3,
      last: null,
    })
  })
})
