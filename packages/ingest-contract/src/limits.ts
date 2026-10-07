/**
 * Grenzen des Vertrags. Sie stehen auch im erzeugten JSON-Schema. Die Bytegrenze je Anfrage setzt die
 * Ingest-API (SP-1.6b); diese Werte begrenzen, was ein einzelner Snapshot enthalten darf.
 */
export const LIMITS = {
  /** Spalten je Tabelle (`SELECT *` der SSMDB2 liefert rund 40 für `Scheiben`). */
  maxColumns: 200,
  /** Zeichen je Spaltenname. */
  maxColumnNameLength: 64,
  /** Zeichen je Spaltentyp (`information_schema.COLUMNS.COLUMN_TYPE`). */
  maxColumnTypeLength: 64,
  /** Zeichen je Zellwert. */
  maxCellLength: 4096,
  /** Zeilen in `serien`. */
  maxSerienRows: 200,
  /** Zeilen in `treffer`: LP 60 mit großzügiger Probe. */
  maxTrefferRows: 2000,
  /** Snapshots je Stapel. */
  maxBatchSnapshots: 50,
  /** Zeichen für kurze Hüllenfelder (`sessionTimeZone`, `sourceVersion`). */
  maxShortTextLength: 64,
} as const
