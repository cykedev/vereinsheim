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

/** eine Zeile von `Scheiben`; Zahlen für Ganzzahlspalten, Text für Text, Datum und Aufzählung */
export interface ScheibenRow {
  ScheibenID: number
  Starterliste: string
  StarterlistenID: number
  /** im Training immer „0000-00-00 00:00:00“ */
  Startzeit: string
  StartNr: number
  Nachname: string
  Vorname: string
  Geschlecht: "male" | "female" | "unknown"
  Land: string
  SportpassID: number
  StandNr: number
  StandNrText: string
  Disziplin: string
  DisziplinID: number
  Klasse: string
  KlassenID: number
  Verein: string
  VereinsID: number
  Mannschaft: string
  MannschaftsID: number
  Rangliste: string
  RanglistenID: number
  Gruppe: string
  GruppenID: number
  Status: string
  Trefferzahl: number
  TotalRing: number
  TotalRing01: number
  BesterTeiler01: number
  BesterTeiler001: number
  /** Lebenszeichen in der Ortszeit des Stands, „YYYY-MM-DD HH:MM:SS“ */
  Zeitstempel: string
}

export interface SerienRow {
  ScheibenID: number
  Stellung: number
  Serie: number
  /** ganze Ringe */
  Ring: number
  /** Zehntel */
  Ring01: number
}

export interface TrefferRow {
  ScheibenID: number
  /** 0 Probe, 1 Wertung */
  Stellung: number
  Treffer: number
  Serie: number
  /** 1/100 mm */
  x: number
  y: number
  Innenzehner: number
  Wertung: number
  Text: string
  /** ganzer Ring mal zehn */
  Ring: number
  Ring01: number
  Teiler01: number
  Teiler001: number
  Zeitstempel: string
  Millisekunden: number
}

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T
/** die Zeilentypen haben genau die Spalten des Schemas (zur Übersetzungszeit geprüft) */
export type RowsMatchColumns = Assert<
  Same<keyof ScheibenRow, keyof typeof SCHEIBEN> &
    Same<keyof SerienRow, keyof typeof SERIEN> &
    Same<keyof TrefferRow, keyof typeof TREFFER>
>
