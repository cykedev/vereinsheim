// Adapter `meyton-ssmdb2@9` (SP-1.6 b, [[spiegel-ingest-pipeline]]): ein Snapshot v1 mit den rohen Zeilen der SSMDB2 →
// Scheibe und Schüsse für `writeRevision`. Eine reine Funktion ohne Datenbank; was sie über den vorigen Stand wissen
// muss (Lebenszeichen, gemessener Versatz der Uhr), kommt im Kontext. Abgenommen an den Fällen aus
// `@vereinsheim/ssmdb2-cases` (Merkmale, Vollständigkeit, zählende Schüsse, Merkmale je Schuss).
//
// Skalen je Feld ([[meyton-ssmdb2]], „Stolperfallen“): x, y in 1/100 mm; `Treffer.Ring` ist der ganze Ring mal zehn,
// `Ring01` Zehntel; `Teiler001` in 0,1 µm, 2147483647 ist der Platzhalter „kein Abstand“ (SF-08); `Wertung` ist die
// Anzeigeart am Monitor (SF-74). Zeiten sind Ortszeit des Stands ohne Zone, Sekunde und Millisekunden als Paar (SF-32).

import type { SnapshotV1, TableV1 } from "@vereinsheim/ingest-contract/snapshot"
import { zonedWallTimeMs } from "@vereinsheim/lib/format"
import {
  classifyCompleteness,
  parseDisciplineId,
  resolveTarget,
  suggestFamily,
  type Completeness,
  type FamilyId,
} from "@vereinsheim/shot-core/discipline"
import { FLAG_MISS, FLAG_OVER_TARGET, FLAG_SUSPICIOUS } from "@vereinsheim/shot-core/metrics"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import { checkShot } from "@vereinsheim/shot-core/verify"

import type { ShotInput } from "../db/cards"

export const ADAPTER_VERSION = "meyton-ssmdb2@9"

/** Platzhalter für „kein Abstand“ in `Teiler01` und `Teiler001` (Schüsse über der Soll-Zahl, SF-08) */
export const PLACEHOLDER_TEILER = 2147483647

/** am Monitor verdeckt (5, 10) oder unbekannt (0): verlässt die Anlage nicht ohne Freigabe (SF-19, SF-20) */
export const HELD_DISPLAY_MODES: ReadonlySet<number> = new Set([0, 5, 10])

/** Uhr des Stands geht falsch oder springt (SF-29, SF-30, SF-73) */
export const FLAG_CLOCK = "uhr-abweichung"
/** ohne Scheibenbild (SF-70) */
export const FLAG_UNKNOWN_DISCIPLINE = "disziplin-unbekannt"
/** fast alle Schüsse passen nicht zum Scheibenbild (Gegenprobe, SF-16) */
export const FLAG_TARGET_MISMATCH = "scheibe-passt-nicht"

/** ab hier Merkmal `uhr-abweichung` (Versatz zwischen Beobachtung und Lebenszeichen, SF-73) */
export const CLOCK_FLAG_MS = 60_000
/** ab hier werden Beginn und Ende der Scheibe um den Versatz verschoben (SF-29) */
export const CLOCK_CORRECT_MS = 5 * 60_000
/** eine Schusszeit so weit neben der des letzten Schusses ist ein Uhrsprung (SF-30) */
const CLOCK_JUMP_MS = 86_400_000
/**
 * Das Lebenszeichen „läuft“ nur, wenn der vorige Stand vor höchstens so langer Zeit beobachtet wurde: Nach einem Ausfall
 * der Brücke oder in einem neuen Zyklus der ScheibenID (SF-77) mäße die Beobachtung sonst die Dauer des Ausfalls statt
 * der Uhr des Stands (Review). Die Brücke schickt ein reines Lebenszeichen höchstens alle 30 s.
 */
export const LIFESIGN_WINDOW_MS = 60_000
/** ruhend nach so langer Zeit ohne Lebenszeichen (SF-10) */
export const RESTING_AFTER_MS = 5 * 60_000
/** endgültig nach so langer Zeit ohne Änderung ([[spiegel-bridge]], „Zustand statt Abschluss“) */
export const FINAL_AFTER_MS = 12 * 3_600_000

/** Merkmale, mit denen eine Scheibe nie vollständig ist; dieselbe Regel steht in SQL in `advanceCardStates` */
export const INCOMPLETE_FLAGS = ["unvollstaendig", "leer"] as const

/** endgültig und ohne fehlende Wertungsschüsse: erst dann zählt die Scheibe für Rekorde (SF-66) */
export const isComplete = (state: "open" | "resting" | "final", flags: readonly string[]) =>
  state === "final" && !INCOMPLETE_FLAGS.some((flag) => flags.includes(flag))

type ColumnFamily = "int" | "datetime" | "text"

/**
 * Die Spalten, die der Adapter liest, mit der Art ihres Typs. Fehlt eine oder hat sie eine andere Art, kommen die
 * Rohdaten in Quarantäne (SF-25); innerhalb einer Art ist die Breite egal (`SportpassID` war bis Handbuch V5 `int(11)`).
 */
const EXPECTED: Readonly<Record<"scheiben" | "treffer", Readonly<Record<string, ColumnFamily>>>> = {
  scheiben: {
    ScheibenID: "int",
    SportpassID: "int",
    StandNr: "int",
    StandNrText: "text",
    Disziplin: "text",
    DisziplinID: "int",
    Status: "text",
    Zeitstempel: "datetime",
  },
  treffer: {
    ScheibenID: "int",
    Stellung: "int",
    Treffer: "int",
    Serie: "int",
    x: "int",
    y: "int",
    Innenzehner: "int",
    Wertung: "int",
    Ring: "int",
    Ring01: "int",
    Teiler01: "int",
    Teiler001: "int",
    Zeitstempel: "datetime",
    Millisekunden: "int",
  },
}

function familyOf(type: string): ColumnFamily | null {
  const t = type.trim().toLowerCase()
  if (/^(tiny|small|medium|big)?int(\(\d+\))?( unsigned)?( zerofill)?$/.test(t)) return "int"
  if (t === "datetime" || /^datetime\(\d\)$/.test(t)) return "datetime"
  if (/^(var)?char\(\d+\)$/.test(t) || /^(tiny|medium|long)?text$/.test(t) || t.startsWith("enum("))
    return "text"
  return null
}

/** was am Schema fehlt oder anders ist; leer, wenn der Adapter die Zeilen deuten kann */
export function schemaProblems(snapshot: SnapshotV1): string[] {
  const problems: string[] = []
  for (const table of ["scheiben", "treffer"] as const) {
    const columns = snapshot.data[table].columns
    for (const [name, family] of Object.entries(EXPECTED[table])) {
      const type = columns[name]
      if (type === undefined) problems.push(`${table}.${name} fehlt`)
      else if (familyOf(type) !== family) problems.push(`${table}.${name} hat einen anderen Typ`)
    }
  }
  return problems
}

/** Ganzzahl aus einer Zelle; null, wenn die Zelle leer oder keine Ganzzahl ist */
function int(row: Record<string, string | null>, column: string): number | null {
  const value = row[column]
  if (value === null || value === undefined || !/^-?\d+$/.test(value)) return null
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : null
}

function text(row: Record<string, string | null>, column: string): string {
  return row[column] ?? ""
}

/** `datetime` „YYYY-MM-DD HH:MM:SS“ in der Ortszeit als Felder (als wären sie UTC); null bei 0000-00-00 oder Unsinn */
function wallOf(value: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(value ?? "")
  if (!m) return null
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number)
  if (year < 1971 || month < 1 || day < 1) return null
  return Date.UTC(year, month - 1, day, hour, minute, second)
}

/** die SportpassID der Scheibe, wenn sie eine hat (0 heißt keine) */
export function sportpassIdOf(snapshot: SnapshotV1): bigint | null {
  const value = snapshot.data.scheiben.rows[0]?.SportpassID
  if (value === null || value === undefined || !/^\d+$/.test(value)) return null
  const id = BigInt(value)
  return id > BigInt(0) ? id : null
}

/** die Disziplin, wie die Anlage sie nennt */
export function disciplineOf(snapshot: SnapshotV1): { meytonId: number; name: string } | null {
  const row = snapshot.data.scheiben.rows[0]
  const meytonId = row ? int(row, "DisziplinID") : null
  return meytonId === null ? null : { meytonId, name: text(row, "Disziplin").trim() }
}

/** das Lebenszeichen (`Scheiben.Zeitstempel`) als Text, wie es in der Zeile steht */
export function lifesignOf(snapshot: SnapshotV1): string | null {
  return snapshot.data.scheiben.rows[0]?.Zeitstempel ?? null
}

/**
 * Hat die Scheibe einen Schuss, der die Anlage nicht verlassen darf? Verdeckt (5, 10) oder unbekannt (0), auch in der
 * Probe: Ab dem ersten solchen Schuss geht von der Scheibe nichts hinaus (SF-19, SF-20); Spiegel prüft das doppelt.
 */
export function hasHeldShot(snapshot: SnapshotV1): boolean {
  return snapshot.data.treffer.rows.some((row) => {
    const mode = int(row, "Wertung")
    return mode === null || HELD_DISPLAY_MODES.has(mode)
  })
}

/** Wertung der Disziplin ist nicht Sache des Adapters (SF-74); er liefert, was er über sie weiß */
export interface DisciplineGuess {
  meytonId: number
  name: string
  targetId: TargetId | null
  family: FamilyId | null
}

export interface AdapterContext {
  /** IANA-Zone der Anlage: Meyton speichert Ortszeit ohne Zone */
  timeZone: string
  /** Scheibenbild der Disziplin, wie Spiegel es kennt (Admin-Zuordnung); undefined: aus dem Katalog */
  targetId?: TargetId | null
  /** Lebenszeichen des vorigen Stands dieser Scheibe als Text; null beim ersten */
  previousLifesign: string | null
  /** wann dieses Lebenszeichen zuletzt beobachtet wurde (Uhr der Brücke) */
  previousLifesignAtMs: number | null
  /** an der Scheibe gemerkter Versatz der Uhr des Stands (Beobachtung minus Lebenszeichen) */
  previousClockOffsetMs: number | null
  /** nächstgelegene Uhrabweichung der Anlage aus dem Heartbeat (Anlage minus Brücke), Rückfall ohne Messung */
  siteClockOffsetMs: number | null
}

export interface AdaptedCard {
  scheibenId: number
  sportpassId: bigint | null
  discipline: DisciplineGuess
  stand: string | null
  startedAtMs: number
  endedAtMs: number | null
  /** Art aus `Status`; die Zuordnung der Rangliste durch den Admin geht vor (beim Lesen, `kindOfRow`) */
  kind: "training" | "competition"
  /** `Rangliste` der SSMDB2, ein freier Text des Vereins; null, wenn leer */
  ranking: string | null
  state: "open" | "resting" | "final"
  completeness: Completeness
  /** Merkmale aus diesem Stand; dauerhafte (`korrigiert`, `uhr-abweichung`) hält `writeRevision` fest */
  flags: string[]
  /**
   * Lebenszeichen als Text, und wann es sich zuletzt bewegt hat: läuft es, die Beobachtungszeit (Uhr der Brücke, nach
   * NTP); sonst geschätzt aus dem Lebenszeichen selbst, um den Versatz verschoben. Grundlage des Zustands.
   */
  lifesign: string | null
  lifesignAtMs: number | null
  /** Versatz der Uhr des Stands, wenn gemessen oder gemerkt */
  clockOffsetMs: number | null
  shots: ShotInput[]
}

export type AdaptResult =
  | { kind: "card"; card: AdaptedCard }
  /** unbekanntes Schema (SF-25): Rohdaten ablegen, keine Scheibe */
  | { kind: "quarantine"; problems: string[] }

interface RawShot {
  stellung: number
  treffer: number
  serie: number | null
  x: number | null
  y: number | null
  innen: boolean
  wertung: number | null
  ring: number | null
  ring01: number | null
  teiler01: number | null
  teiler001: number | null
  wallMs: number | null
  ms: number
}

function rawShots(table: TableV1): RawShot[] {
  return table.rows.map((row) => ({
    stellung: int(row, "Stellung") ?? 1,
    treffer: int(row, "Treffer") ?? 0,
    serie: int(row, "Serie"),
    x: int(row, "x"),
    y: int(row, "y"),
    innen: int(row, "Innenzehner") === 1,
    wertung: int(row, "Wertung"),
    ring: int(row, "Ring"),
    ring01: int(row, "Ring01"),
    teiler01: int(row, "Teiler01"),
    teiler001: int(row, "Teiler001"),
    wallMs: wallOf(row.Zeitstempel),
    ms: Math.min(999, Math.max(0, int(row, "Millisekunden") ?? 0)),
  }))
}

/** Merkmale eines Schusses aus seinen Werten (SF-08, SF-14, SF-15) */
function shotFlags(shot: RawShot): string[] {
  if (shot.teiler01 === PLACEHOLDER_TEILER || shot.teiler001 === PLACEHOLDER_TEILER)
    return [FLAG_OVER_TARGET]
  if (shot.x === 0 && shot.y === 0 && shot.teiler01 === 0 && shot.ring01 !== 109)
    return [FLAG_SUSPICIOUS]
  if (shot.ring01 === 0) return [FLAG_MISS]
  return []
}

/**
 * Abgabefolge (SF-30, SF-04): je Stellung nach der Nummer (sie folgt sonst ohne Ausnahme der Zeit), zwischen Probe und
 * Wertung nach der Zeit. Ohne Zeit geht die Probe vor.
 */
function inFiringOrder(shots: readonly RawShot[], timeOf: (s: RawShot) => number | null) {
  const byNumber = (a: RawShot, b: RawShot) => a.treffer - b.treffer
  const probe = shots.filter((s) => s.stellung === 0).sort(byNumber)
  const match = shots
    .filter((s) => s.stellung !== 0)
    .sort((a, b) => a.stellung - b.stellung || byNumber(a, b))
  const out: RawShot[] = []
  let i = 0
  let j = 0
  while (i < probe.length || j < match.length) {
    if (j >= match.length) out.push(probe[i++])
    else if (i >= probe.length) out.push(match[j++])
    else {
      const p = timeOf(probe[i])
      const m = timeOf(match[j])
      out.push(m !== null && p !== null && m < p ? match[j++] : probe[i++])
    }
  }
  return out
}

/** Deutet einen Snapshot, den der Vertrag schon geprüft hat (`parseSnapshot`). */
export function adaptSnapshot(snapshot: SnapshotV1, context: AdapterContext): AdaptResult {
  const problems = schemaProblems(snapshot)
  if (problems.length) return { kind: "quarantine", problems }

  const head = snapshot.data.scheiben.rows[0]
  const observedMs = Date.parse(snapshot.observedAt)
  const toUtc = (wallMs: number | null, ms = 0) =>
    wallMs === null ? null : zonedWallTimeMs(wallMs, context.timeZone) + ms

  const discipline = disciplineOf(snapshot) ?? { meytonId: 0, name: "" }
  const targetId =
    context.targetId !== undefined
      ? context.targetId
      : resolveTarget({ disciplineId: discipline.meytonId, name: discipline.name }).targetId
  const family = targetId
    ? suggestFamily({ targetId, disciplineId: discipline.meytonId, name: discipline.name })
    : null

  const lifesign = lifesignOf(snapshot)
  const lifesignWallMs = toUtc(wallOf(lifesign))
  // läuft das Lebenszeichen? Nur dann misst die Beobachtung die Uhr des Stands (SF-73)
  const beating =
    lifesignWallMs !== null &&
    context.previousLifesign !== null &&
    context.previousLifesign !== lifesign &&
    context.previousLifesignAtMs !== null &&
    observedMs - context.previousLifesignAtMs >= 0 &&
    observedMs - context.previousLifesignAtMs <= LIFESIGN_WINDOW_MS
  const measuredOffset = beating ? observedMs - (lifesignWallMs as number) : null
  const clockOffsetMs = measuredOffset ?? context.previousClockOffsetMs
  const correction =
    clockOffsetMs !== null
      ? Math.abs(clockOffsetMs) >= CLOCK_CORRECT_MS
        ? clockOffsetMs
        : 0
      : context.siteClockOffsetMs !== null &&
          Math.abs(context.siteClockOffsetMs) >= CLOCK_CORRECT_MS
        ? // Anlage minus Brücke: eine Anlage, die vorgeht, braucht einen negativen Ausgleich
          -context.siteClockOffsetMs
        : 0

  const raw = rawShots(snapshot.data.treffer)
  const firedOf = new Map(raw.map((s) => [s, toUtc(s.wallMs, s.ms)]))
  const ordered = inFiringOrder(raw, (s) => firedOf.get(s) ?? null)

  // Uhrsprung (SF-30): Schusszeiten mehr als einen Tag neben der des letzten Schusses; die gelten als falsch
  const lastTime = [...ordered]
    .reverse()
    .map((s) => firedOf.get(s) ?? null)
    .find((t) => t !== null)
  const plausible = (t: number | null) =>
    t !== null &&
    lastTime !== undefined &&
    lastTime !== null &&
    Math.abs(t - lastTime) <= CLOCK_JUMP_MS
  const jumped = ordered.some((s) => {
    const t = firedOf.get(s) ?? null
    return t !== null && !plausible(t)
  })

  const target = targetId ? TARGETS[targetId] : null
  const checks = ordered.map((s) =>
    target && shotFlags(s).length === 0 && s.ring01 !== null
      ? checkShot(target, {
          distance: s.teiler001 !== null ? { um: s.teiler001 / 10, resolutionUm: 0.1 } : null,
          position:
            s.x !== null && s.y !== null
              ? { xUm: s.x * 10, yUm: s.y * 10, resolutionUm: 10 }
              : null,
          officialDecimalTenths: s.ring01,
          officialRing: s.ring === null ? null : Math.floor(s.ring / 10),
          officialInnerTen: s.innen,
        })
      : "unchecked"
  )
  const checked = checks.filter((c) => c !== "unchecked").length
  const mismatches = checks.filter((c) => c === "mismatch").length
  // fast alle daneben: das Scheibenbild passt nicht, nicht die Schüsse (SF-16); sonst sind einzelne verdächtig (SF-15)
  const targetMismatch = checked >= 3 && mismatches * 2 > checked

  const shots: ShotInput[] = ordered.map((s, i) => {
    const flags = shotFlags(s)
    if (!targetMismatch && checks[i] === "mismatch") flags.push(FLAG_SUSPICIOUS)
    const over = flags.includes(FLAG_OVER_TARGET)
    return {
      seq: i + 1,
      stellung: s.stellung,
      treffer: s.treffer,
      series: s.stellung === 0 ? null : s.serie,
      xUm: s.x === null ? null : s.x * 10,
      yUm: s.y === null ? null : s.y * 10,
      ring: s.ring === null ? null : Math.floor(s.ring / 10),
      decimalTenths: s.ring01,
      distanceTenthsUm: over ? null : s.teiler001,
      innerTen: s.innen,
      displayMode: s.wertung,
      firedAtMs: firedOf.get(s) ?? null,
      flags,
    }
  })

  const match = shots.filter((s) => s.stellung !== 0).length
  const completeness = classifyCompleteness({
    sighterShots: shots.length - match,
    matchShots: match,
    plannedShots: parseDisciplineId(discipline.meytonId).plannedShots,
  })

  const flags: string[] = []
  if (
    completeness === "nur-probe" ||
    completeness === "unvollstaendig" ||
    completeness === "ueber-soll" ||
    completeness === "leer"
  )
    flags.push(completeness)
  if (!targetId) flags.push(FLAG_UNKNOWN_DISCIPLINE)
  if (targetMismatch) flags.push(FLAG_TARGET_MISMATCH)
  if ((measuredOffset !== null && Math.abs(measuredOffset) >= CLOCK_FLAG_MS) || jumped)
    flags.push(FLAG_CLOCK)

  const times = shots.map((s) => s.firedAtMs).filter((t): t is number => plausible(t))
  const lifesignAtMs = beating
    ? observedMs
    : lifesignWallMs === null
      ? null
      : lifesignWallMs + correction
  const startedAtMs =
    (times.length ? Math.min(...times) : (lifesignWallMs ?? observedMs)) + correction
  const endedAtMs = times.length ? Math.max(...times) + correction : null

  // Zustand ([[spiegel-bridge]]): offen, solange das Lebenszeichen läuft; ein Stand ohne laufendes Lebenszeichen ist
  // ruhend nach fünf Minuten, endgültig nach zwölf Stunden (etwa beim Nachholen am nächsten Abend)
  const quietMs = lifesignAtMs === null ? 0 : observedMs - lifesignAtMs
  const state = beating
    ? "open"
    : quietMs >= FINAL_AFTER_MS
      ? "final"
      : quietMs >= RESTING_AFTER_MS
        ? "resting"
        : "open"

  const standText = text(head, "StandNrText").trim()
  const standNr = int(head, "StandNr")
  return {
    kind: "card",
    card: {
      scheibenId: snapshot.scheibenId,
      sportpassId: sportpassIdOf(snapshot),
      discipline: { ...discipline, targetId, family },
      stand: standText || (standNr === null || standNr === 0 ? null : String(standNr)),
      startedAtMs,
      endedAtMs,
      // `Status` ist an der Vereinsanlage immer leer; sonst steht dort RWK, Liga, … ([[meyton-ssmdb2]])
      kind: text(head, "Status").trim() ? "competition" : "training",
      ranking: text(head, "Rangliste").trim() || null,
      state,
      completeness,
      flags,
      lifesign,
      lifesignAtMs,
      clockOffsetMs,
      shots,
    },
  }
}
