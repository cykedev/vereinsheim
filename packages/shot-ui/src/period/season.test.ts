// Charakterisierung des ganzen Modells eines Zeitraums über eine Saison: Werte, Verlauf, Monate, Wochen, Kalender,
// Abstände, Vergleich, Rekorde (bis R10/R11) und die neuen Rekorde oben (`NEW_RECORDS`), in mehreren Zuständen. Die
// Schnappschüsse halten fest, was das Modell heute liefert; ein Umbau der Eingabe darf sie nicht ändern.

import { describe, expect, it } from "vitest"

import type { NamedPeriod } from "./calendar"
import { lightPeriodModel, periodModel, type PeriodModel } from "./model"
import { NEW_RECORDS, recordRows } from "./records"
import { initialPeriodState, type PeriodState } from "./state"
import { item, NOW, seasonCards, TZ } from "./testSeason"

const NAMED: NamedPeriod[] = [
  { id: "vorbereitung", name: "Vorbereitung", from: "2026-05-01", to: "2026-06-30" },
  { id: "winter", name: "Winter", from: "2025-11-01", to: "2026-02-28" },
]

const STATES: Record<string, Partial<PeriodState>> = {
  vorgabe: {},
  "zeitraum davor": { compare: { type: "previous" } },
  "alles in ganzen Ringen": { choice: { type: "all" }, scoring: "rings" },
  "Wettkampf, 12 Monate": { choice: { type: "rolling", days: 365 }, kind: "competition" },
  "Training ohne Probe, je Monat": {
    choice: { type: "rolling", days: 365 },
    kind: "training",
    includeProbeOnly: false,
    view: "months",
  },
  "benannt gegen benannt": {
    choice: { type: "named", id: "vorbereitung" },
    compare: { type: "named", id: "winter" },
  },
  "frei, Zehner, gewählt": {
    choice: { type: "free", from: "2026-01-01", to: "2026-03-31" },
    metric: "result.tensRate",
    chosen: "t40",
  },
  "Streuung über alles": { choice: { type: "all" }, metric: "group.sigma" },
}

/**
 * das Modell als reiner Wert, wie die Bausteine es lesen: von einer Scheibe Id, Beginn, Art, „nur Probe“ und Schusszahl
 * (die Form der Eingabe ist nicht Teil der Charakterisierung), Maps als sortierte Einträge; je Feld eine Zeile JSON
 */
const plain = (model: PeriodModel) => {
  const card = (c: PeriodModel["cards"][number]) => ({
    id: c.id,
    startedAtMs: c.startedAtMs,
    kind: c.kind,
    probeOnly: c.probeOnly,
    shots: c.shots,
  })
  const shown = {
    ...model,
    cards: model.cards.map(card),
    reading: model.reading && { ...model.reading, card: card(model.reading.card) },
  }
  return Object.fromEntries(
    Object.entries(shown).map(([key, value]) => [
      key,
      JSON.stringify(value, (_key, inner: unknown) =>
        inner instanceof Map ? [...inner].sort((a, b) => (a[0] < b[0] ? -1 : 1)) : inner
      ),
    ])
  )
}

const modelFor = (state: Partial<PeriodState>) =>
  periodModel({
    items: seasonCards().map(item),
    state: { ...initialPeriodState({ family: "lg-10m" }), ...state },
    nowMs: NOW,
    timeZone: TZ,
    named: NAMED,
  })

describe("das ganze Modell über eine Saison", () => {
  for (const [name, state] of Object.entries(STATES)) {
    it(name, () => {
      const model = modelFor(state)
      const scoring = state.scoring ?? "decimal"
      const rows = recordRows(model.records, scoring)
      const inPeriod = new Set(model.cards.map((c) => c.id))
      // das leichte Modell für den Browser zeigt dasselbe
      expect(plain(lightPeriodModel(model))).toEqual(plain(model))
      expect({
        model: plain(model),
        records: rows.map((r) => `${r.key} ${r.label}: ${r.value} (${r.record.cardId})`),
        recent: rows
          .filter((r) => inPeriod.has(r.record.cardId))
          .slice(0, NEW_RECORDS)
          .map((r) => r.key),
      }).toMatchSnapshot()
    })
  }

  it("die Saison trägt, was die Schnappschüsse prüfen sollen", () => {
    const all = modelFor({ choice: { type: "all" } })
    const keys = recordRows(all.records, "decimal").map((r) => r.key.split(":")[0])
    for (const id of ["R1", "R2", "R5", "R6", "R7", "R8", "R10", "R11"])
      expect(keys.some((k) => k.startsWith(id))).toBe(true)
    // nicht zählende Scheiben stehen in keinem Rekord, obwohl sie die höchsten Werte tragen
    const holders = new Set(recordRows(all.records, "decimal").map((r) => r.record.cardId))
    for (const id of ["unvollstaendig", "nurpdf", "verdaechtig"])
      expect(holders.has(id)).toBe(false)
    // als Wertung gezählte Probe nur mit dem Schalter
    expect(holders.has("gezaehlt")).toBe(true)
    const strict = modelFor({ choice: { type: "all" }, includeProbeOnly: false })
    const strictHolders = new Set(recordRows(strict.records, "decimal").map((r) => r.record.cardId))
    expect(strictHolders.has("gezaehlt")).toBe(false)
    // Zehntel und ganze Ringe gehen auseinander
    const rings = modelFor({ choice: { type: "all" }, scoring: "rings" })
    expect(rings.summary.mean).not.toBeCloseTo(all.summary.mean as number, 2)
    // nur Probe zählt mit dem Schalter, sonst nicht
    expect(modelFor({ includeProbeOnly: false }).excludedProbeOnly).toBeGreaterThan(0)
  })
})
