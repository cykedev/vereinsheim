import { z } from "zod"

import { LIMITS } from "../limits"

/**
 * Snapshot-Format v1: der vollständige Stand **einer** Scheibe, wie die Brücke ihn aus der SSMDB2
 * liest (ADR-027). Die Zeilen bleiben roh; der Vertrag kennt keine Meyton-Spalten und prüft nur die
 * Form. Ob die Spalten passen, deutet der Adapter in Spiegel (SF-25).
 */

/** Eigene Fehlercodes neben denen von Zod; sie tragen nie Inhalte. */
export const CONTRACT_ISSUE = {
  malformedString: "malformed-string",
  rowColumnsMismatch: "row-columns-mismatch",
  columnCount: "column-count",
  checksumMismatch: "checksum-mismatch",
  forbiddenKey: "forbidden-key",
  unsupportedVersion: "unsupported-contract-version",
} as const

const wellFormed = (schema: z.ZodString) =>
  schema.refine((value) => value.isWellFormed(), {
    params: { contractCode: CONTRACT_ISSUE.malformedString },
  })

const shortText = wellFormed(z.string().min(1).max(LIMITS.maxShortTextLength))

/** Zellwert: Text, wie MySQL ihn im Textprotokoll liefert, oder `null`. */
const cell = wellFormed(z.string().max(LIMITS.maxCellLength)).nullable()

const columnName = wellFormed(z.string().min(1).max(LIMITS.maxColumnNameLength))

/** Spaltenliste von `SELECT *` mit dem Typ aus `information_schema.COLUMNS.COLUMN_TYPE`. */
const columns = z
  .record(columnName, wellFormed(z.string().min(1).max(LIMITS.maxColumnTypeLength)))
  .refine(
    (value) => {
      const count = Object.keys(value).length
      return count >= 1 && count <= LIMITS.maxColumns
    },
    { abort: true, params: { contractCode: CONTRACT_ISSUE.columnCount } }
  )
  .meta({ minProperties: 1, maxProperties: LIMITS.maxColumns })

/** Eine Zeile: genau die Spalten aus `columns`, je Wert Text oder `null`. */
const row = z.record(columnName, cell)

function table(rows: { min: number; max: number }) {
  return z
    .strictObject({
      columns,
      rows: z.array(row).min(rows.min).max(rows.max),
    })
    .superRefine((value, ctx) => {
      const expected = Object.keys(value.columns)
      value.rows.forEach((r, index) => {
        const keys = Object.keys(r)
        const matches =
          keys.length === expected.length && keys.every((key) => Object.hasOwn(value.columns, key))
        if (!matches) {
          ctx.addIssue({
            code: "custom",
            path: ["rows", index],
            message: "Zeile passt nicht zu columns",
            params: { contractCode: CONTRACT_ISSUE.rowColumnsMismatch },
          })
        }
      })
    })
}

export const snapshotDataV1 = z.strictObject({
  /** Tabelle `Scheiben`: genau eine Zeile. */
  scheiben: table({ min: 1, max: 1 }),
  /** Tabelle `Serien`: alle Zeilen der Scheibe, auch keine. */
  serien: table({ min: 0, max: LIMITS.maxSerienRows }),
  /** Tabelle `Treffer`: alle Zeilen der Scheibe, Probe eingeschlossen. */
  treffer: table({ min: 0, max: LIMITS.maxTrefferRows }),
})

export const CHECKSUM_PATTERN = /^sha256:[0-9a-f]{64}$/

export const snapshotV1 = z
  .strictObject({
    contractVersion: z.literal(1),
    /** Art der Quelle; bestimmt den Adapter in Spiegel. */
    source: z.literal("meyton-ssmdb2"),
    /** Inhalt der Tabelle `Version`, falls lesbar. */
    sourceVersion: shortText.nullable(),
    /** Epoche der Quelle (Ablage geleert, neuer Server; SF-23). */
    epoch: z.int().min(1),
    /** ScheibenID, vorzeichenbehaftet 32 Bit. Schlüssel ist Quelle + Epoche + ScheibenID. */
    scheibenId: z.int32(),
    /** Folgenummer der Brücke, streng steigend; ein älterer Stand überholt nie einen neueren (SF-26). */
    sequence: z.int().min(1),
    /** Beobachtungszeit in UTC mit Millisekunden. */
    observedAt: z.iso.datetime({ precision: 3 }),
    /** `@@session.time_zone` der Brücke beim Lesen (SF-31). */
    sessionTimeZone: shortText,
    data: snapshotDataV1,
    /** `sha256:` und 64 Hex-Zeichen über die kanonische Form von `data` (SF-27). */
    checksum: z.string().regex(CHECKSUM_PATTERN),
  })
  .meta({
    title: "Spiegel-Snapshot v1",
    description:
      "Vollständiger Stand einer Scheibe aus der SSMDB2. Nicht im Schema ausdrückbar und trotzdem Pflicht: " +
      "jede Zeile hat genau die Schlüssel aus columns; alle Strings sind wohlgeformtes Unicode " +
      "(keine einzelnen Surrogate); kein Schlüssel heißt __proto__; Längen zählen in UTF-16-Codeeinheiten, " +
      "nicht in Codepoints; checksum = sha256 über die kanonische Form (RFC 8785) von data mit " +
      "nach ihrer kanonischen Form sortierten Zeilen. Siehe vault/spiegel/spiegel-ingest-contract.md.",
  })

export const snapshotBatchV1 = z
  .strictObject({
    snapshots: z.array(snapshotV1).min(1).max(LIMITS.maxBatchSnapshots),
  })
  .meta({ title: "Spiegel-Snapshot-Stapel v1" })

export type RowV1 = z.infer<typeof row>
export type TableV1 = SnapshotDataV1["scheiben"]
export type SnapshotDataV1 = z.infer<typeof snapshotDataV1>
export type SnapshotV1 = z.infer<typeof snapshotV1>
export type SnapshotBatchV1 = z.infer<typeof snapshotBatchV1>
