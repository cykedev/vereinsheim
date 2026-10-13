// Die eingefrorenen Fälle lesen (`cases/v1/<SF-ID>/snapshots.json`), ohne MariaDB und ohne sie neu zu rechnen: für
// Verbraucher wie die Zugriffe von Spiegel, die echte Snapshot-Folgen brauchen.

import { readdirSync, readFileSync } from "node:fs"

import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"

import type { ExpectedCard } from "./expected"

export interface FrozenReading {
  reading: number
  observedAt: string
  snapshots: SnapshotV1[]
}

/** die Lesungen eines Falls mit ihren Snapshots, in ihrer Folge */
export function frozenReadings(caseId: string): FrozenReading[] {
  if (!/^SF-\d{2}$/.test(caseId)) throw new RangeError(`kein Fall: ${caseId}`)
  const file = new URL(`../cases/v1/${caseId}/snapshots.json`, import.meta.url)
  return JSON.parse(readFileSync(file, "utf8")) as FrozenReading[]
}

/** das erwartete Ergebnis eines Falls, wie eingefroren (`cases/v1/<SF-ID>/expected.json`) */
export interface FrozenExpected {
  id: string
  title: string
  readings: { reading: number; observedAt: string; note?: string; transient?: boolean }[]
  cards: ExpectedCard[]
}

export function frozenExpected(caseId: string): FrozenExpected {
  if (!/^SF-\d{2}$/.test(caseId)) throw new RangeError(`kein Fall: ${caseId}`)
  const file = new URL(`../cases/v1/${caseId}/expected.json`, import.meta.url)
  return JSON.parse(readFileSync(file, "utf8")) as FrozenExpected
}

/** die Kennungen aller eingefrorenen Fälle */
export function frozenCaseIds(): string[] {
  return readdirSync(new URL("../cases/v1/", import.meta.url)).filter((name) =>
    /^SF-\d{2}$/.test(name)
  )
}
