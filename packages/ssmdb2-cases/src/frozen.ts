// Die eingefrorenen Fälle lesen (`cases/v1/<SF-ID>/snapshots.json`), ohne MariaDB und ohne sie neu zu rechnen: für
// Verbraucher wie die Zugriffe von Spiegel, die echte Snapshot-Folgen brauchen.

import { readFileSync } from "node:fs"

import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"

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
