import { parseSnapshot } from "@vereinsheim/ingest-contract/parse"
import { classifyCompleteness, parseDisciplineId } from "@vereinsheim/shot-core/discipline"
import { describe, expect, it } from "vitest"

import { trefferOf } from "../ablage"
import { CASES, runCase } from "./index"

/** Sommerzeit 2026: 29. März 01:00 UTC bis 25. Oktober 01:00 UTC */
const SUMMER = [Date.UTC(2026, 2, 29, 1), Date.UTC(2026, 9, 25, 1)]
/** Merkmale, die direkt aus der Vollständigkeit folgen */
const COMPLETENESS_FLAGS = ["nur-probe", "unvollstaendig", "ueber-soll"]

describe.each(CASES.map((c) => [c.id, c] as const))("%s", (_id, definition) => {
  const output = runCase(definition)

  it("jeder Snapshot ist gültig nach dem Vertrag, jede Lesung in der Sommerzeit", () => {
    for (const reading of output.readings) {
      const at = Date.parse(reading.observedAt)
      expect(at).toBeGreaterThanOrEqual(SUMMER[0])
      expect(at).toBeLessThan(SUMMER[1])
      for (const snapshot of reading.snapshots) {
        const parsed = parseSnapshot(snapshot)
        expect(parsed.ok, `${reading.reading}: ${JSON.stringify(parsed)}`).toBe(true)
      }
    }
  })

  it.each(definition.expected.map((e) => [e.scheibenId, e] as const))(
    "Vorgabe für Scheibe %i passt zu den Daten der letzten Lesung",
    (scheibenId, expected) => {
      // Probe und Wertung je Lesung, wie die Brücke sie sähe
      expect(
        output.readings.map((reading) => {
          const snapshot = reading.snapshots.find((x) => x.scheibenId === scheibenId)
          if (!snapshot) return null
          const rows = snapshot.data.treffer.rows
          return [
            rows.filter((r) => r.Stellung === "0").length,
            rows.filter((r) => r.Stellung === "1").length,
          ]
        })
      ).toEqual(expected.shots)
      // gesendet wird die erste von zwei gleichen Lesungen hintereinander, wenn sie neu ist (SF-71)
      if (expected.sentReadings) {
        const sums = output.readings.map(
          (r) => r.snapshots.find((x) => x.scheibenId === scheibenId)?.checksum ?? null
        )
        const sent: number[] = []
        let last: string | null = null
        for (let i = 0; i + 1 < sums.length; i++)
          if (sums[i] && sums[i] === sums[i + 1] && sums[i] !== last) {
            sent.push(i + 1)
            last = sums[i]
          }
        expect(sent).toEqual([...expected.sentReadings])
      }
      // der Stand der letzten Lesung, in der die Scheibe steht
      const state = output.states.findLast((s) => s.scheiben.has(scheibenId))
      expect(state, "Scheibe in einer Lesung").toBeDefined()
      const scheibe = state!.scheiben.get(scheibenId)
      const probe = trefferOf(state!, scheibenId, 0)
      const match = trefferOf(state!, scheibenId, 1)
      // wie am Ausdruck: mit Wertung die Wertung, sonst die Probe
      const counted = match.length ? match : probe
      expect(expected.counted.stellung).toBe(match.length ? 1 : 0)
      expect([...expected.counted.numbers]).toEqual(counted.map((t) => t.Treffer))
      const completeness = classifyCompleteness({
        sighterShots: probe.length,
        matchShots: match.length,
        plannedShots: parseDisciplineId(scheibe!.DisziplinID).plannedShots,
      })
      expect(expected.completeness).toBe(completeness)
      for (const flag of COMPLETENESS_FLAGS)
        expect(expected.flags.includes(flag), flag).toBe(completeness === flag)
    }
  )
})

describe("Fälle", () => {
  it("jede ID einmal, jede ScheibenID nur in einem Fall", () => {
    const ids = CASES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const scheiben = CASES.flatMap((c) => [...runCase(c).last.scheiben.keys()])
    expect(new Set(scheiben).size).toBe(scheiben.length)
  })
})
