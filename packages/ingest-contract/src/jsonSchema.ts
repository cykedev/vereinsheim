import { z } from "zod"

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
} as const

export function renderJsonSchemas(): Record<keyof typeof SCHEMA_FILES, unknown> {
  return {
    "snapshot-v1.schema.json": z.toJSONSchema(SCHEMA_FILES["snapshot-v1.schema.json"]),
    "snapshot-batch-v1.schema.json": z.toJSONSchema(SCHEMA_FILES["snapshot-batch-v1.schema.json"]),
  }
}
