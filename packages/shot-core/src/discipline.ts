// Meyton-Disziplinen: DisziplinID zerlegen, Scheibenbild auflösen, Familie vorschlagen.
//
// Die DisziplinID ist achtstellig: Entfernung (1 = 10 m), Regelnummer (Ziffern 2–5), Schusscode
// (Ziffern 6–8). Der Schusscode ist nur ein Hinweis (SF-09): 000 heißt offen. Über 100 stehen bei 10 m
// Varianten-Codes (220 Finale, 240 Liga Bayern, 130 „LP5 (S)“), anderswo auch echte Zahlen (120 bei
// ISSF 3x40 Gewehr); über 100 gibt es deshalb keinen verlässlichen Hinweis.
//
// Die Regelnummer allein ist NICHT eindeutig (SF-70): 0610 ist „LP Liga“ (10610040) und
// „ISSF AR Men Final“ (10610220); 0100 ist die französische „Pistolet air“, obwohl DSB-Regeln 01.xx
// Gewehre sind. Deshalb gibt es keinen Rückfall über Regelbereiche, sondern einen Katalog über
// Regelnummer und Schusscode, danach den Namen.
//
// Quelle: Meyton, „ShootMaster II – Disziplin erstellen“ (Stand 06.12.2017), Abschnitte 19.3,
// 19.4.5 und 19.5.1. Aufgenommen sind nur belegte 10-m-Disziplinen für Luftgewehr und Luftpistole,
// als Regeln, nicht als Abschrift der Liste. Bekannte 10-m-Disziplinen mit eigener Scheibe stehen mit
// `target: null` im Katalog, damit der Name sie nicht auf die Standardscheibe zieht: Kyffhäuser (1062),
// 12-kreisig (1064), Löwenbräu-Finale (7401, 7402) und LP5 (0216, DSB 2.16 mit Fallscheibe).
//
// Belegt an der Vereinsanlage (Kopie vom 9. Oktober 2026), ebenfalls ohne Scheibe: Vereinsspiele wie
// Schach, Balken, Dart, Lotto, Dreieck, Blanko und Spiegel (Regeln 8000 bis 8154, hier 8000 bis 8199,
// lieber unbekannt als falsch gewertet), Meytons LP- und LG-Trainingsscheibe (9001, 9002) und „LG
// Training Spiegel“ des Vereins (0119 mit 000). Die Trainingsscheiben werten 0,0 bis 1,9 statt Ringe,
// die Vereinsspiele auch mit negativen Zehnteln. Offen bleibt
// Meytons „LG/LP Training Spiegel“ unter 19110000 und 19210000; bis dahin gilt dort die Standardscheibe.

import { TARGETS, type TargetId, type Weapon } from "./targets"

export interface ParsedDisciplineId {
  raw: number
  /** 1 = 10 m … 7 = sonstige; null bei vereinseigenen IDs */
  distanceCode: number | null
  /** Ziffern 2–5, etwa "0210" */
  rule: string | null
  /** Ziffern 6–8 roh, etwa 40, 0 oder 220 */
  shotCode: number | null
  /** geplante Wertungsschüsse; null bei 000, über 100 oder vereinseigen */
  plannedShots: number | null
  openEnded: boolean
}

export interface AdminMapping {
  disciplineId: number
  name: string
  targetId: TargetId
}

export type ResolutionSource = "admin" | "catalog" | "name" | "unknown"
export type Anschlag = "freihand" | "auflage"
export type FamilyId = "lg-freihand" | "lg-auflage" | "lp-freihand" | "lp-auflage"
export type Completeness =
  | "leer"
  | "nur-probe"
  | "offen"
  | "unvollstaendig"
  | "vollstaendig"
  | "ueber-soll"

interface CatalogEntry {
  rules: readonly string[]
  /** Nur dieser Schusscode; ohne Angabe jeder. */
  shotCode?: number
  /** null: bekannte Disziplin mit eigener Scheibe, die die Bibliothek noch nicht kennt */
  target: TargetId | null
  anschlag?: "auflage"
}

function ruleRange(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i).padStart(4, "0"))
}

// Reihenfolge zählt: Die ISSF-Finale (0610 mit 220) stehen vor der allgemeinen Zeile mit 0610.
const CATALOG: readonly CatalogEntry[] = [
  {
    rules: ["1062", "1064", "7401", "7402", "0216", ...ruleRange(8000, 8199), "9001", "9002"],
    target: null,
  },
  { rules: ["0119"], shotCode: 0, target: null },
  { rules: ["0610", "0612", "0614", "0616"], shotCode: 220, target: "lg-10m" },
  { rules: ["0611", "0613", "0615", "0617"], shotCode: 220, target: "lp-10m" },
  {
    rules: [
      "0110",
      "0120",
      "0193",
      "0194",
      "0195",
      "0510",
      "0520",
      "0530",
      "0531",
      "0540",
      "0550",
      ...ruleRange(710, 713),
      ...ruleRange(1009, 1018),
      "9110",
    ],
    target: "lg-10m",
  },
  { rules: ["0111"], target: "lg-10m", anschlag: "auflage" },
  {
    rules: [
      "0210",
      "0610",
      "0620",
      "0630",
      "0631",
      "0640",
      "0650",
      ...ruleRange(810, 813),
      ...ruleRange(1109, 1117),
      "9210",
    ],
    target: "lp-10m",
  },
  { rules: ["0211"], target: "lp-10m", anschlag: "auflage" },
]

const EMPTY_PARSE = {
  distanceCode: null,
  rule: null,
  shotCode: null,
  plannedShots: null,
  openEnded: false,
} as const

export function parseDisciplineId(raw: number): ParsedDisciplineId {
  if (!Number.isInteger(raw) || raw < 10_000_000 || raw > 99_999_999) {
    return { raw, ...EMPTY_PARSE }
  }
  const digits = String(raw)
  const shotCode = Number(digits.slice(5))
  return {
    raw,
    distanceCode: Number(digits[0]),
    rule: digits.slice(1, 5),
    shotCode,
    plannedShots: shotCode >= 1 && shotCode <= 100 ? shotCode : null,
    openEnded: shotCode === 0,
  }
}

function catalogEntry(parsed: ParsedDisciplineId): CatalogEntry | null {
  if (parsed.distanceCode !== 1 || parsed.rule === null) return null
  const { rule, shotCode } = parsed
  return (
    CATALOG.find(
      (entry) =>
        entry.rules.includes(rule) && (entry.shotCode === undefined || entry.shotCode === shotCode)
    ) ?? null
  )
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase()
}

// Wortgrenzen ohne \b, damit Umlaute nicht als Wortgrenze gelten.
// Kurzformen als ganzes Wort, Langformen auch als Wortanfang („Luftgewehrauflage“, „Luftpistolen-Pokal“).
const LG_WORD = /(^|[^a-z0-9äöüß])(lg(?=$|[^a-z0-9äöüß])|luftgewehr)/
const LP_WORD = /(^|[^a-z0-9äöüß])(lp5?(?=$|[^a-z0-9äöüß])|luftpistole)/
// „Auflage“ auch in Zusammensetzungen, die Abkürzung „Aufl.“ als eigenes Wort.
const AUFLAGE_WORD = /auflage|aufgelegt|(^|[^a-zäöüß])aufl(?=$|[^a-zäöüß])/

function weaponFromName(name: string): Weapon | null {
  const lower = name.toLowerCase()
  const lg = LG_WORD.test(lower)
  const lp = LP_WORD.test(lower)
  if (lg === lp) return null
  return lg ? "lg" : "lp"
}

const TARGET_BY_WEAPON: Readonly<Record<Weapon, TargetId>> = { lg: "lg-10m", lp: "lp-10m" }
const UNKNOWN = { targetId: null, source: "unknown" } as const

export function resolveTarget(input: {
  disciplineId: number
  name: string
  adminMappings?: readonly AdminMapping[]
}): { targetId: TargetId | null; source: ResolutionSource } {
  const name = normalizeName(input.name)
  const mapping = input.adminMappings?.find(
    (m) => m.disciplineId === input.disciplineId && normalizeName(m.name) === name
  )
  if (mapping) return { targetId: mapping.targetId, source: "admin" }

  const parsed = parseDisciplineId(input.disciplineId)
  const entry = catalogEntry(parsed)
  if (entry) {
    // Eine bekannte Disziplin mit eigener Scheibe fällt nicht auf den Namen zurück.
    return entry.target ? { targetId: entry.target, source: "catalog" } : UNKNOWN
  }

  if (parsed.distanceCode === null || parsed.distanceCode === 1) {
    const weapon = weaponFromName(input.name)
    if (weapon) return { targetId: TARGET_BY_WEAPON[weapon], source: "name" }
  }
  return UNKNOWN
}

/** Vorschlag; der Admin bestätigt die Familie (SF-64, SF-65). */
export function suggestFamily(input: {
  targetId: TargetId
  disciplineId: number
  name: string
}): FamilyId {
  const weapon = TARGETS[input.targetId].weapon
  const auflage =
    catalogEntry(parseDisciplineId(input.disciplineId))?.anschlag === "auflage" ||
    AUFLAGE_WORD.test(input.name.toLowerCase())
  return `${weapon}-${auflage ? "auflage" : "freihand"}`
}

/** Gegen die Schusszahl zählen nur Wertungsschüsse (SF-02); die Probe nie. */
export function classifyCompleteness(input: {
  sighterShots: number
  matchShots: number
  plannedShots: number | null
}): Completeness {
  if (input.matchShots === 0) return input.sighterShots === 0 ? "leer" : "nur-probe"
  if (input.plannedShots === null) return "offen"
  if (input.matchShots < input.plannedShots) return "unvollstaendig"
  if (input.matchShots === input.plannedShots) return "vollstaendig"
  return "ueber-soll"
}
