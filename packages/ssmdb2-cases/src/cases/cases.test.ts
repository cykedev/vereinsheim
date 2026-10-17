import { parseSnapshot } from "@vereinsheim/ingest-contract/parse"
import {
  classifyCompleteness,
  parseDisciplineId,
  resolveTarget,
} from "@vereinsheim/shot-core/discipline"
import { describe, expect, it } from "vitest"

import { trefferOf, type Ablage } from "../ablage"
import type { TrefferRow } from "../schema"
import { MUSTER, SUMMER_OFFSET_MS } from "../stand"
import { PLACEHOLDER_TEILER } from "../values"
import { CASES, runCase } from "./index"

/** Sommerzeit 2026: 29. März 01:00 UTC bis 25. Oktober 01:00 UTC */
const SUMMER = [Date.UTC(2026, 2, 29, 1), Date.UTC(2026, 9, 25, 1)]
/** Merkmale, die direkt aus der Vollständigkeit folgen */
const COMPLETENESS_FLAGS = ["nur-probe", "unvollstaendig", "ueber-soll"]
const HELD_DISPLAYS = [0, 5, 10]
const DAY = 86_400_000

/** `datetime` in Ortszeit (MESZ) als UTC-Millisekunden */
const stampMs = (datetime: string) =>
  Date.parse(`${datetime.replace(" ", "T")}Z`) - SUMMER_OFFSET_MS

/** ein Wertungsschuss hält die Scheibe in der Brücke: verdeckt (5, 10) oder Modus 0 */
const held = (state: Ablage, id: number) =>
  trefferOf(state, id, 1).some((t) => HELD_DISPLAYS.includes(t.Wertung))

/** was ein Schuss an Merkmalen trägt, aus seinen Werten (Vorschlag für das Einlesen) */
function shotFlagsOf(t: TrefferRow): string[] {
  if (t.Teiler01 === PLACEHOLDER_TEILER) return ["ueber-soll"]
  if (t.x === 0 && t.y === 0 && t.Teiler01 === 0 && t.Ring01 !== 109) return ["verdaechtig"]
  if (t.Ring01 === 0 && !HELD_DISPLAYS.includes(t.Wertung)) return ["fehlschuss"]
  return []
}

describe.each(CASES.map((c) => [c.id, c] as const))("%s", (_id, definition) => {
  const output = runCase(definition)

  it("jeder Snapshot ist gültig nach dem Vertrag; Lesungen in der Sommerzeit, streng steigend", () => {
    let previous = 0
    for (const reading of output.readings) {
      const at = Date.parse(reading.observedAt)
      expect(at).toBeGreaterThanOrEqual(SUMMER[0])
      expect(at).toBeLessThan(SUMMER[1])
      expect(at).toBeGreaterThan(previous)
      previous = at
      for (const snapshot of reading.snapshots) {
        const parsed = parseSnapshot(snapshot)
        expect(parsed.ok, `${reading.reading}: ${JSON.stringify(parsed)}`).toBe(true)
        expect(snapshot.sequence).toBe(at)
      }
    }
  })

  it.each(definition.expected.map((e) => [e.scheibenId, e] as const))(
    "Vorgabe für Scheibe %i passt zu den Daten",
    (scheibenId, expected) => {
      const present = output.states.map((s) => s.scheiben.has(scheibenId))
      // Probe und Wertung je Lesung, wie die Brücke sie sähe
      expect(
        output.states.map((state, i) =>
          present[i]
            ? [trefferOf(state, scheibenId, 0).length, trefferOf(state, scheibenId, 1).length]
            : null
        )
      ).toEqual(expected.shots)

      // was die Brücke tut und welche Lesungen sie schickt
      const state = output.states.findLast((s) => s.scheiben.has(scheibenId))!
      const scheibe = state.scheiben.get(scheibenId)!
      const anyShot = output.states.some((s) => trefferOf(s, scheibenId).length)
      if (expected.bridge === "auslassen") expect(anyShot).toBe(false)
      if (expected.bridge === "nur-qr") expect(scheibe.SportpassID).not.toBe(MUSTER.SportpassID)
      if (expected.bridge === "senden") {
        expect(anyShot).toBe(true)
        expect(scheibe.SportpassID).toBe(MUSTER.SportpassID)
      }
      const everHeld = output.states.some((s, i) => present[i] && held(s, scheibenId))
      expect(everHeld, "verdeckt oder Modus 0").toBe(expected.bridge === "zurueckhalten")
      const sent: number[] = []
      if (expected.bridge === "senden" || expected.bridge === "zurueckhalten") {
        let last: string | null = null
        for (const [i, reading] of output.readings.entries()) {
          const snapshot = reading.snapshots.find((s) => s.scheibenId === scheibenId)
          if (!snapshot || reading.transient) continue
          if (held(output.states[i], scheibenId)) break
          if (snapshot.checksum !== last) sent.push(reading.reading)
          last = snapshot.checksum
        }
      }
      expect(sent, "gesendete Lesungen").toEqual([...expected.sentReadings])
      if (expected.bridge === "senden") expect(sent.length).toBeGreaterThan(0)

      // wie am Ausdruck: mit Wertung die Wertung, sonst die Probe
      const probe = trefferOf(state, scheibenId, 0)
      const match = trefferOf(state, scheibenId, 1)
      const counted = match.length ? match : probe
      expect(expected.counted.stellung).toBe(match.length ? 1 : 0)
      expect([...expected.counted.numbers]).toEqual(counted.map((t) => t.Treffer))
      // die Blöcke in Spiegel enden mit dem Stand wie am Ausdruck
      if (expected.blocks) expect(expected.blocks.at(-1)).toEqual(expected.counted)
      const completeness = classifyCompleteness({
        sighterShots: probe.length,
        matchShots: match.length,
        plannedShots: parseDisciplineId(scheibe.DisziplinID).plannedShots,
      })
      expect(expected.completeness).toBe(completeness)

      // Merkmale der Scheibe aus den Daten
      const flags = COMPLETENESS_FLAGS.filter((flag) => flag === completeness)
      if (!resolveTarget({ disciplineId: scheibe.DisziplinID, name: scheibe.Disziplin }).targetId)
        flags.push("disziplin-unbekannt")
      const clockOff = output.readings.some((reading, i) => {
        const now = output.states[i].scheiben.get(scheibenId)
        if (!now) return false
        const before = i ? output.states[i - 1].scheiben.get(scheibenId) : undefined
        const at = Date.parse(reading.observedAt)
        // Versatz nur, wo sich das Lebenszeichen seit der vorigen Lesung bewegt hat (es läuft); eine Schusszeit mehr
        // als einen Tag daneben immer
        const beating = !!before && before.Zeitstempel !== now.Zeitstempel
        return (
          (beating && Math.abs(at - stampMs(now.Zeitstempel)) >= 60_000) ||
          trefferOf(output.states[i], scheibenId).some(
            (t) => Math.abs(at - stampMs(t.Zeitstempel)) > DAY
          )
        )
      })
      if (clockOff) flags.push("uhr-abweichung")
      const corrected = output.states.some((now, i) => {
        if (!i || output.readings[i].transient || !now.scheiben.has(scheibenId)) return false
        const j = output.states.findLastIndex(
          (s, k) => k < i && !output.readings[k].transient && s.scheiben.has(scheibenId)
        )
        if (j < 0) return false
        const after = new Map(trefferOf(now, scheibenId, 1).map((t) => [t.Treffer, t]))
        // ein Wertungsschuss geändert (ohne `Wertung`, `Text`) oder weg
        return trefferOf(output.states[j], scheibenId, 1).some((t) => {
          const u = after.get(t.Treffer)
          return !u || u.x !== t.x || u.y !== t.y || u.Ring01 !== t.Ring01
        })
      })
      if (corrected) flags.push("korrigiert")
      expect([...expected.flags].sort()).toEqual(flags.sort())

      // Merkmale je Schuss aus den Werten
      const shotFlags = Object.fromEntries(
        trefferOf(state, scheibenId).flatMap((t) => {
          const f = shotFlagsOf(t)
          return f.length ? [[`${t.Stellung}/${t.Treffer}`, f]] : []
        })
      )
      expect(expected.shotFlags ?? {}).toEqual(shotFlags)
    }
  )
})

describe("Fälle", () => {
  it("die Millisekunden der Schüsse sind verteilt wie in der Ablage, nicht immer 0", () => {
    const ms = CASES.flatMap((c) =>
      runCase(c).states.flatMap((s) => [...s.treffer.values()].map((t) => t.Millisekunden))
    )
    expect(new Set(ms).size).toBeGreaterThan(300)
    expect(Math.max(...ms)).toBeLessThan(1000)
  })

  it("jede ID einmal, jede ScheibenID nur in einem Fall", () => {
    const ids = CASES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const scheiben = CASES.flatMap((c) => [
      ...new Set(runCase(c).states.flatMap((s) => [...s.scheiben.keys()])),
    ])
    expect(new Set(scheiben).size).toBe(scheiben.length)
  })
})
