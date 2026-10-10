// Schema der Meyton-Ablage SSMDB2 an der Vereinsanlage (Kopie vom 9. Oktober 2026, Datenbankversion 9), als Daten: die
// Spalten je Tabelle in ihrer Reihenfolge mit dem Typ, den `information_schema.COLUMNS.COLUMN_TYPE` zeigt. Das DDL steht
// in `schema/ssmdb2.sql`; ein Test hält beide gleich. Alle Spalten sind NOT NULL: Keine Zelle ist je null.

export const TABLES = ["Scheiben", "Serien", "Treffer"] as const
export type Table = (typeof TABLES)[number]

/** `Version.Versionsnummer` an der Vereinsanlage */
export const SCHEMA_VERSION = 9

const SCHEIBEN = {
  ScheibenID: "int(11)",
  Starterliste: "varchar(36)",
  StarterlistenID: "int(11)",
  Startzeit: "datetime",
  StartNr: "int(11)",
  Nachname: "varchar(36)",
  Vorname: "varchar(36)",
  Geschlecht: "enum('male','female','unknown')",
  Land: "varchar(3)",
  SportpassID: "bigint(20)",
  StandNr: "smallint(6)",
  StandNrText: "varchar(36)",
  Disziplin: "varchar(36)",
  DisziplinID: "int(11)",
  Klasse: "varchar(36)",
  KlassenID: "int(11)",
  Verein: "varchar(36)",
  VereinsID: "int(11)",
  Mannschaft: "varchar(36)",
  MannschaftsID: "int(11)",
  Rangliste: "varchar(36)",
  RanglistenID: "int(11)",
  Gruppe: "varchar(36)",
  GruppenID: "int(11)",
  Status: "varchar(72)",
  Trefferzahl: "smallint(6)",
  TotalRing: "int(11)",
  TotalRing01: "int(11)",
  BesterTeiler01: "int(11)",
  BesterTeiler001: "int(11)",
  Zeitstempel: "datetime",
} as const

const SERIEN = {
  ScheibenID: "int(11)",
  Stellung: "smallint(6)",
  Serie: "smallint(6)",
  Ring: "int(11)",
  Ring01: "int(11)",
} as const

const TREFFER = {
  ScheibenID: "int(11)",
  Stellung: "smallint(6)",
  Treffer: "smallint(6)",
  Serie: "smallint(6)",
  x: "int(11)",
  y: "int(11)",
  Innenzehner: "tinyint(1)",
  Wertung: "int(11)",
  Text: "varchar(36)",
  Ring: "int(11)",
  Ring01: "int(11)",
  Teiler01: "int(11)",
  Teiler001: "int(11)",
  Zeitstempel: "datetime",
  Millisekunden: "smallint(6)",
} as const

/** Spalten je Tabelle: Name → `COLUMN_TYPE`, in der Reihenfolge der Tabelle */
export const COLUMNS = { Scheiben: SCHEIBEN, Serien: SERIEN, Treffer: TREFFER } as const

/** Primärschlüssel je Tabelle; die Brücke liest nach ihm sortiert */
export const PRIMARY_KEYS = {
  Scheiben: ["ScheibenID"],
  Serien: ["ScheibenID", "Stellung", "Serie"],
  Treffer: ["ScheibenID", "Stellung", "Treffer"],
} as const satisfies Record<Table, readonly string[]>

export type ScheibenRow = Record<keyof typeof SCHEIBEN, string | number>
export type SerienRow = Record<keyof typeof SERIEN, number>
export type TrefferRow = Record<keyof typeof TREFFER, string | number>
