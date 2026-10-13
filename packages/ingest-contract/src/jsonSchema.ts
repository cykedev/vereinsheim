import { z } from "zod"

import {
  errorResponseV1,
  heartbeatResponseV1,
  heartbeatV1,
  pairRequestV1,
  pairResponseV1,
  snapshotsResponseV1,
  stateResponseV1,
} from "./v1/api"
import { snapshotBatchV1, snapshotV1 } from "./v1/snapshot"

/**
 * Das JSON-Schema des Vertrags wird aus den Zod-Schemas erzeugt, damit es nur eine Quelle gibt. Es
 * liegt unter `schema/` für Implementierungen in anderen Sprachen (die Brücke). Was JSON-Schema nicht
 * ausdrückt (Zeilenschlüssel = columns, wohlgeformte Strings, Prüfsumme), steht in der description.
 * Neu schreiben: `pnpm --filter @vereinsheim/ingest-contract schema`.
 */
export const SCHEMA_FILES = {
  "snapshot-v1.schema.json": snapshotV1,
  "snapshot-batch-v1.schema.json": snapshotBatchV1,
  "snapshots-response-v1.schema.json": snapshotsResponseV1,
  "pair-request-v1.schema.json": pairRequestV1,
  "pair-response-v1.schema.json": pairResponseV1,
  "heartbeat-v1.schema.json": heartbeatV1,
  "heartbeat-response-v1.schema.json": heartbeatResponseV1,
  "state-response-v1.schema.json": stateResponseV1,
  "error-response-v1.schema.json": errorResponseV1,
} as const

export function renderJsonSchemas(): Record<keyof typeof SCHEMA_FILES, unknown> {
  return Object.fromEntries(
    Object.entries(SCHEMA_FILES).map(([file, schema]) => [file, z.toJSONSchema(schema)])
  ) as Record<keyof typeof SCHEMA_FILES, unknown>
}
