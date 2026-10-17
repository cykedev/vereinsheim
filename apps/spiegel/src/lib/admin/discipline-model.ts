// Modell der Admin-Seite „Disziplinen“: eine reine Funktion je Zeile und die Sätze dazu (Textbuch Spiegel), ohne
// Datenbank, damit die Hülle im Browser sie nutzen kann. Gelesen wird in `disciplines.ts`.

import {
  parseDisciplineId,
  resolveTarget,
  suggestIgnore,
  type FamilyId,
} from "@vereinsheim/shot-core/discipline"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"

import type { Scoring } from "@/generated/prisma/client"

/** neu ohne Scheibenbild oder Familie, neu mit Vorschlag, eingeordnet, ignoriert */
export type DisciplineStatus = "waiting" | "suggested" | "confirmed" | "ignored"

/** Anzeige am Stand und häufigste Schusszahl erst ab so vielen verschiedenen Schützen (Datenschutz) */
export const MIN_OWNERS_FOR_STATS = 3

export interface DisciplineStats {
  cards: number
  /** verschiedene Besitzer; Anzeige am Stand und Schusszahl erst ab `MIN_OWNERS_FOR_STATS` */
  owners: number
  /** nur Monat und Jahr („Oktober 2026“), nie der Tag (Datenschutz) */
  lastCardMonth: string | null
  /** Scheiben je Anzeige am Stand (`Card.standScoring`); null unter `MIN_OWNERS_FOR_STATS` (der Server lässt sie weg) */
  stand: { decimal: number; rings: number } | null
  /** Scheiben mit Wertungsschüssen (Projektion nicht `probeOnly`); 0 bei Scheiben: Hinweis aufs Ignorieren */
  scoredCards: number
  /** häufigste Zahl der Wertungsschüsse (`printedShots`, ohne nur Probe) und wie oft; null ohne oder unter `MIN_OWNERS_FOR_STATS` */
  shots: { count: number; cards: number; of: number } | null
}

export interface DisciplineRow {
  id: number
  meytonId: number
  name: string
  targetId: TargetId | null
  familyId: number | null
  familyName: string | null
  officialScoring: Scoring | null
  /** gespeichert: null aus der DisziplinID, 0 keine feste Zahl, sonst die Zahl */
  plannedShots: number | null
  confirmed: boolean
  ignored: boolean
  status: DisciplineStatus
  /** sichtbar in den Übersichten: Scheibenbild und Familie, nicht ignoriert */
  visible: boolean
  suggestion: {
    targetId: TargetId | null
    source: "catalog" | "name" | "unknown"
    plannedShotsFromId: number | null
    ignore: boolean
    /** Name der eingeordneten Disziplin mit derselben Nummer, von der das Einlesen übernommen hat; null ohne */
    sibling: string | null
  }
  stats: DisciplineStats
}

export interface FamilyRow {
  id: number
  slug: string
  name: string
  disciplines: number
  cards: number
}

const asTargetId = (value: string | null): TargetId | null =>
  value !== null && Object.hasOwn(TARGETS, value) ? (value as TargetId) : null

export function disciplineStatus(d: {
  confirmed: boolean
  ignored: boolean
  targetId: TargetId | null
  familyId: number | null
}): DisciplineStatus {
  if (d.confirmed) return d.ignored ? "ignored" : "confirmed"
  return d.ignored || (d.targetId && d.familyId !== null) ? "suggested" : "waiting"
}

export function disciplineRow(input: {
  discipline: {
    id: number
    meytonId: number
    name: string
    targetId: string | null
    officialScoring: Scoring | null
    plannedShots: number | null
    confirmedAt: Date | null
    ignoredAt: Date | null
    family: { id: number; name: string } | null
  }
  stats: DisciplineStats
  /** Name der eingeordneten Disziplin derselben Nummer, deren Zuordnung diese übernommen hat */
  sibling?: string | null
}): DisciplineRow {
  const d = input.discipline
  const targetId = asTargetId(d.targetId)
  const confirmed = d.confirmedAt !== null
  const ignored = d.ignoredAt !== null
  const familyId = d.family?.id ?? null
  const resolved = resolveTarget({ disciplineId: d.meytonId, name: d.name })
  return {
    id: d.id,
    meytonId: d.meytonId,
    name: d.name,
    targetId,
    familyId,
    familyName: d.family?.name ?? null,
    officialScoring: d.officialScoring,
    plannedShots: d.plannedShots,
    confirmed,
    ignored,
    status: disciplineStatus({ confirmed, ignored, targetId, familyId }),
    visible: !ignored && targetId !== null && familyId !== null,
    suggestion: {
      targetId: resolved.targetId,
      source: resolved.source === "admin" ? "catalog" : resolved.source,
      plannedShotsFromId: parseDisciplineId(d.meytonId).plannedShots,
      ignore: suggestIgnore(d.meytonId),
      sibling: input.sibling ?? null,
    },
    stats: input.stats,
  }
}

/** Zustand in der Liste als kurzes Wort; null ohne */
export function statusChip(row: DisciplineRow): string | null {
  if (row.status === "waiting") return "Scheiben warten"
  if (row.status === "suggested") return row.ignored ? "Vorschlag: ignorieren" : "Vorschlag"
  if (row.status === "confirmed" && !row.visible) return "wird nicht gezeigt"
  return null
}

/** Zustand oben im Blatt einer Disziplin; null bei einer eingeordneten */
export function statusText(row: DisciplineRow): string | null {
  if (row.status === "ignored")
    return "Spiegel ignoriert diese Disziplin. Ihre Scheiben zeigt Spiegel nirgends."
  if (row.status === "confirmed") return null
  if (row.status === "waiting")
    return "Spiegel kennt diese Disziplin nicht. Ihre Scheiben erscheinen erst, wenn du sie einordnest."
  if (row.suggestion.sibling)
    return `Eine Disziplin mit derselben Nummer hieß früher „${row.suggestion.sibling}“. Spiegel hat ihre Einstellungen übernommen. Bitte prüf sie.`
  if (row.ignored)
    return "Das ist ein Spiel oder eine Trainingsscheibe von Meyton. Spiegel ignoriert die Disziplin deshalb. Bitte prüf das."
  return row.suggestion.source === "name"
    ? "Spiegel hat diese Disziplin am Namen erkannt. Bitte prüf den Vorschlag genau."
    : "Spiegel hat diese Disziplin an der Nummer erkannt. Bitte prüf den Vorschlag."
}

/** der Vorschlag des Fachkerns für die Scheibe */
export function targetSuggestionText(row: DisciplineRow): string {
  const { targetId, source } = row.suggestion
  if (!targetId || source === "unknown")
    return "Kein Vorschlag. Spiegel erkennt die Scheibe weder an der Nummer noch am Namen."
  return `Vorschlag nach ${source === "name" ? "dem Namen" : "der Nummer"}: ${TARGETS[targetId].label}`
}

const FEW_SHOOTERS = "Dazu haben noch zu wenige Schützen diese Disziplin geschossen."

/** was am Stand meist angezeigt wurde (Vorschlag für die Wertung der Disziplin, nie automatisch, SF-74) */
export function standText(stats: DisciplineStats): string {
  if (stats.owners < MIN_OWNERS_FOR_STATS || !stats.stand) return FEW_SHOOTERS
  const { decimal, rings } = stats.stand
  if (decimal + rings === 0) return "Am Stand wurde noch nichts angezeigt."
  const [word, k] = rings > decimal ? ["ganze Ringe", rings] : ["Zehntel", decimal]
  return `Am Stand meist ${word} angezeigt: ${k} von ${decimal + rings} Scheiben.`
}

/** wie viele Wertungsschüsse meist geschossen wurden */
export function shotsText(stats: DisciplineStats): string {
  if (stats.owners < MIN_OWNERS_FOR_STATS) return FEW_SHOOTERS
  if (!stats.shots) return "Noch keine Scheibe mit Wertungsschüssen."
  const { count, cards, of } = stats.shots
  return `Meist geschossen: ${count} Schüsse, bei ${cards} von ${of} Scheiben.`
}

/**
 * Hinweis aufs Ignorieren, wenn bisher keine Scheibe Wertungsschüsse hat (etwa ein Trainingsspiegel ohne Wertung);
 * unabhängig von der Zahl der Schützen, weil er nichts über Ergebnisse sagt. null ohne.
 */
export function ignoreHintText(row: DisciplineRow): string | null {
  if (row.ignored || row.stats.cards === 0 || row.stats.scoredCards > 0) return null
  return "Bisher hat keine Scheibe dieser Disziplin Wertungsschüsse. Hat sie keine sinnvolle Wertung, etwa als Trainingsspiegel, kannst du sie ignorieren."
}

/** die Möglichkeit „aus der Nummer“ für die Schusszahl */
export function fromIdLabel(plannedShotsFromId: number | null): string {
  return `Wie in der Nummer: ${plannedShotsFromId ?? "keine feste"}`
}

/** die Kennungen der Familien des Fachkerns: immer vergeben, auch wenn es die Zeile noch nicht gibt */
const CORE_FAMILY_SLUGS: readonly FamilyId[] = [
  "lg-freihand",
  "lg-auflage",
  "lp-freihand",
  "lp-auflage",
]

/**
 * Kennung einer neuen Familie aus ihrem Namen (steht in der Adresse, fest nach dem Anlegen): klein, Umlaute
 * ausgeschrieben, sonst nur Buchstaben, Ziffern und Bindestriche, höchstens 40 Zeichen; vergeben → `-2`, `-3`, …
 */
export function familySlug(name: string, taken: readonly string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "familie"
  const used = new Set([...taken, ...CORE_FAMILY_SLUGS])
  if (!used.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, 40 - String(n).length - 1)}-${n}`
    if (!used.has(candidate)) return candidate
  }
}
