import { describe, expect, it } from "vitest"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenCaseIds, frozenExpected, frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { shotChange, type ShotInput } from "../db/cards"
import {
  adaptSnapshot,
  hasHeldShot,
  lifesignOf,
  sportpassIdOf,
  type AdaptedCard,
} from "./meyton-ssmdb2"

/** die Fälle laufen in Sommerzeit; die Anlage steht in Berlin */
const TIME_ZONE = "Europe/Berlin"
/** der erfundene Sportpass mit Zustimmung in den Fällen */
const MUSTER = BigInt(12345678)

/** die Stände einer Scheibe nacheinander durch den Adapter, wie Spiegel sie bekäme */
function adaptAll(snapshots: readonly SnapshotV1[]) {
  let previousLifesign: string | null = null
  let previousClockOffsetMs: number | null = null
  const cards: AdaptedCard[] = []
  for (const snapshot of snapshots) {
    const result = adaptSnapshot(snapshot, {
      timeZone: TIME_ZONE,
      previousLifesign,
      previousClockOffsetMs,
      siteClockOffsetMs: null,
    })
    if (result.kind !== "card") throw new Error(`Quarantäne: ${result.problems.join(", ")}`)
    cards.push(result.card)
    previousLifesign = result.card.lifesign
    previousClockOffsetMs = result.card.clockOffsetMs
  }
  return cards
}

/** dauerhaft wie in `writeRevision`: einmal gesetzt, bleibt es */
const STICKY = ["uhr-abweichung", "korrigiert"]

function flagsAfter(cards: readonly AdaptedCard[]): string[] {
  const flags = new Set(cards.at(-1)!.flags)
  for (const card of cards)
    for (const flag of card.flags) if (STICKY.includes(flag)) flags.add(flag)
  // korrigiert: eine Wertungszeile geändert oder weg (SF-67), über `shotChange` wie in `writeRevision`
  const corrected = cards.some(
    (card, i) => i > 0 && shotChange(cards[i - 1].shots, card.shots).kind === "correction"
  )
  if (corrected) flags.add("korrigiert")
  return [...flags].sort()
}

const shotKey = (s: ShotInput) => `${s.stellung}/${s.treffer}`

describe.each(frozenCaseIds().map((id) => [id] as const))("Fall %s", (caseId) => {
  const readings = frozenReadings(caseId)
  const expected = frozenExpected(caseId)

  it.each(expected.cards.map((c) => [c.scheibenId, c] as const))(
    "Scheibe %i",
    (scheibenId, card) => {
      const snapshotIn = (n: number) =>
        readings.find((r) => r.reading === n)?.snapshots.find((s) => s.scheibenId === scheibenId)
      if (card.bridge === "auslassen") return
      // was die Brücke schickt; „nur-qr“ käme erst über einen Auftrag, gedeutet wird es gleich
      const sent =
        card.bridge === "nur-qr"
          ? readings
              .filter((r) => !expected.readings.find((e) => e.reading === r.reading)?.transient)
              .map((r) => snapshotIn(r.reading))
              .filter((s): s is SnapshotV1 => s !== undefined)
          : card.sentReadings.map((n) => snapshotIn(n)!)
      if (card.bridge === "zurueckhalten") {
        // gesendet wurde nur, was vor dem ersten verdeckten Schuss lag; danach hält Spiegel die Scheibe selbst zurück
        expect(sent.some(hasHeldShot)).toBe(false)
        const later = readings
          .flatMap((r) => r.snapshots)
          .filter((s) => s.scheibenId === scheibenId)
        expect(later.some(hasHeldShot)).toBe(true)
        return
      }
      expect(sent.length, "gesendete Stände").toBeGreaterThan(0)
      const cards = adaptAll(sent)
      const last = cards.at(-1)!

      // Zustimmung prüft der Ablauf; hier nur, dass der Adapter die SportpassID liest
      expect(sportpassIdOf(sent[0]) === MUSTER).toBe(card.bridge !== "nur-qr")

      expect(last.completeness).toBe(card.completeness)
      expect(flagsAfter(cards)).toEqual([...card.flags].sort())

      // wie am Ausdruck: mit Wertung die Wertung, sonst die Probe
      const match = last.shots.filter((s) => s.stellung !== 0)
      const counted = match.length ? match : last.shots.filter((s) => s.stellung === 0)
      expect(counted.map((s) => s.treffer)).toEqual([...card.counted.numbers])
      expect(match.length ? 1 : 0).toBe(card.counted.stellung)

      const shotFlags = Object.fromEntries(
        last.shots.filter((s) => s.flags.length).map((s) => [shotKey(s), [...s.flags]])
      )
      expect(shotFlags).toEqual(card.shotFlags ?? {})

      // Abgabefolge eindeutig und lückenlos
      expect(last.shots.map((s) => s.seq)).toEqual(last.shots.map((_, i) => i + 1))
    }
  )
})

describe("Adapter im Einzelnen", () => {
  const sf03 = frozenReadings("SF-03")
  const snapshot = sf03.at(-1)!.snapshots[0]
  const context = {
    timeZone: TIME_ZONE,
    previousLifesign: null,
    previousClockOffsetMs: null,
    siteClockOffsetMs: null,
  }

  it("Skalen: Lage in µm, ganzer Ring aus Ring/10, Zehntel aus Ring01, Abstand aus Teiler001", () => {
    const result = adaptSnapshot(snapshot, context)
    if (result.kind !== "card") throw new Error("keine Scheibe")
    const row = snapshot.data.treffer.rows.find((r) => r.Stellung === "1" && r.Treffer === "1")!
    const shot = result.card.shots.find((s) => s.stellung === 1 && s.treffer === 1)!
    expect(shot.xUm).toBe(Number(row.x) * 10)
    expect(shot.yUm).toBe(Number(row.y) * 10)
    expect(shot.ring).toBe(Math.floor(Number(row.Ring) / 10))
    expect(shot.decimalTenths).toBe(Number(row.Ring01))
    expect(shot.distanceTenthsUm).toBe(Number(row.Teiler001))
    expect(shot.displayMode).toBe(Number(row.Wertung))
  })

  it("Zeit: Ortszeit der Anlage nach UTC, Sekunde und Millisekunden als Paar (SF-32)", () => {
    const result = adaptSnapshot(snapshot, context)
    if (result.kind !== "card") throw new Error("keine Scheibe")
    const row = snapshot.data.treffer.rows.find((r) => r.Stellung === "1" && r.Treffer === "1")!
    const shot = result.card.shots.find((s) => s.stellung === 1 && s.treffer === 1)!
    // Sommerzeit: Ortszeit = UTC + 2 h
    const wall = Date.parse(`${row.Zeitstempel!.replace(" ", "T")}Z`)
    expect(shot.firedAtMs).toBe(wall - 2 * 3_600_000 + Number(row.Millisekunden))
    expect(lifesignOf(snapshot)).toBe(snapshot.data.scheiben.rows[0].Zeitstempel)
  })

  it("Quarantäne, wenn eine erwartete Spalte fehlt oder die Art des Typs wechselt (SF-25); Zusatzspalten stören nicht", () => {
    const withData = (data: SnapshotV1["data"]): SnapshotV1 => ({
      ...snapshot,
      data,
      checksum: computeChecksum(data),
    })
    const without = <T extends Record<string, unknown>>(record: T) =>
      Object.fromEntries(Object.entries(record).filter(([key]) => key !== "Teiler001"))
    const missing = withData({
      ...snapshot.data,
      treffer: {
        columns: without(snapshot.data.treffer.columns) as Record<string, string>,
        rows: snapshot.data.treffer.rows.map((row) => without(row) as typeof row),
      },
    })
    expect(adaptSnapshot(missing, context)).toEqual({
      kind: "quarantine",
      problems: ["treffer.Teiler001 fehlt"],
    })
    const retyped = withData({
      ...snapshot.data,
      treffer: {
        ...snapshot.data.treffer,
        columns: { ...snapshot.data.treffer.columns, x: "double" },
      },
    })
    expect(adaptSnapshot(retyped, context)).toEqual({
      kind: "quarantine",
      problems: ["treffer.x hat einen anderen Typ"],
    })
    const extra = withData({
      ...snapshot.data,
      treffer: {
        columns: { ...snapshot.data.treffer.columns, Neu: "int(11)" },
        rows: snapshot.data.treffer.rows.map((r) => ({ ...r, Neu: "1" })),
      },
    })
    expect(adaptSnapshot(extra, context).kind).toBe("card")
  })

  it("Zustand: offen, solange das Lebenszeichen läuft; ruhend nach fünf Minuten, endgültig nach zwölf Stunden", () => {
    const at = (offsetMs: number): SnapshotV1 => ({
      ...snapshot,
      observedAt: new Date(Date.parse(snapshot.observedAt) + offsetMs).toISOString(),
    })
    const lifesign = lifesignOf(snapshot)
    const state = (s: SnapshotV1, previousLifesign: string | null) => {
      const result = adaptSnapshot(s, { ...context, previousLifesign })
      return result.kind === "card" ? result.card.state : null
    }
    expect(state(at(0), "2026-01-01 00:00:00")).toBe("open")
    // gleiches Lebenszeichen: nach der Zeit seit ihm
    expect(state(at(6 * 60_000), lifesign)).toBe("resting")
    expect(state(at(13 * 3_600_000), lifesign)).toBe("final")
  })

  it("Uhr des Stands: Versatz ab einer Minute ist ein Merkmal, ab fünf Minuten verschiebt er Beginn und Ende (SF-73, SF-29)", () => {
    // beobachtet fünf Sekunden nach dem Lebenszeichen (Ortszeit MESZ = UTC + 2 h), dann später
    const lifesignMs = Date.parse(`${lifesignOf(snapshot)!.replace(" ", "T")}Z`) - 2 * 3_600_000
    const later = (minutes: number): SnapshotV1 => ({
      ...snapshot,
      observedAt: new Date(lifesignMs + 5_000 + minutes * 60_000).toISOString(),
    })
    const adapt = (s: SnapshotV1) => {
      const result = adaptSnapshot(s, { ...context, previousLifesign: "2026-01-01 00:00:00" })
      if (result.kind !== "card") throw new Error("keine Scheibe")
      return result.card
    }
    const base = adapt(later(0))
    expect(base.clockOffsetMs).toBe(5_000)
    expect(base.flags).not.toContain("uhr-abweichung")
    const eleven = adapt(later(11))
    expect(eleven.flags).toContain("uhr-abweichung")
    expect(eleven.clockOffsetMs! - base.clockOffsetMs!).toBe(11 * 60_000)
    expect(eleven.startedAtMs - base.startedAtMs).toBe(eleven.clockOffsetMs)
    // die Schusszeiten bleiben die des Stands: ein neu gemessener Versatz ist keine Korrektur der Schüsse
    expect(eleven.shots.map((s) => s.firedAtMs)).toEqual(base.shots.map((s) => s.firedAtMs))
    expect(adapt(later(0.5)).flags).not.toContain("uhr-abweichung")
  })
})
