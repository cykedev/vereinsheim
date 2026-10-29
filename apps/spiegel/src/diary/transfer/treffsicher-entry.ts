// Eine Einheit aus Treffsicher als Eintrag im Tagebuch ([[spiegel-account-transfer]]): welche Felder wohin. Rein; das
// Vorschau-Werkzeug schreibt mit dem Schlüssel `preview:`, die Übernahme (Stufe 3) mit ihrem eigenen.

import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import {
  SCALE_ASPECTS,
  valueOfStage,
  type ScaleAspect,
  type ScalePart,
  type Stage,
} from "../scales"

type PrognosisAspect = (typeof SCALE_ASPECTS.prognosis)[number]
type WellbeingAspect = (typeof SCALE_ASPECTS.wellbeing)[number]

export interface TreffsicherSessionForEntry {
  id: string
  dateMs: number
  type: "TRAINING" | "WETTKAMPF" | "TROCKENTRAINING" | "MENTAL"
  trainingGoal: string | null
  isFavourite: boolean
  location: string | null
  wellbeing: Record<WellbeingAspect, number> | null
  prognosis:
    | (Record<PrognosisAspect, number> & {
        expectedScore: number | null
        expectedCleanShots: number | null
        performanceGoal: string | null
      })
    | null
  feedback:
    | (Record<PrognosisAspect, number> & {
        explanation: string | null
        goalAchieved: boolean | null
        goalAchievedNote: string | null
        progress: string | null
        fiveBestShots: string | null
        wentWell: string | null
        insights: string | null
      })
    | null
  reflection: {
    observations: string | null
    insight: string | null
    learningQuestion: string | null
    routineDeviation: string | null
  } | null
  series: { position: number; isPractice: boolean; executionQuality: number | null }[]
}

export interface ImportedEntry {
  importKey: string
  day: string
  kind: "shooting" | "dry" | "mental"
  familyId: number | null
  intention: string | null
  outcome: "yes" | "no" | null
  learned: string | null
  question: string | null
  note: string | null
  expectedScore: number | null
  scales: { part: ScalePart; aspect: ScaleAspect; value: number }[]
}

const KIND: Readonly<Record<TreffsicherSessionForEntry["type"], ImportedEntry["kind"]>> = {
  TRAINING: "shooting",
  WETTKAMPF: "shooting",
  TROCKENTRAINING: "dry",
  MENTAL: "mental",
}

const text = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Die Notiz: die Beobachtungen, darunter je Feld ohne eigenes Feld im Tagebuch eine Überschrift in fester Folge. Der
 * Ort nur ohne Scheibe (sonst steht er an der Scheibe), „Favorit“ als eigene Zeile
 */
function noteOf(session: TreffsicherSessionForEntry, withCard: boolean): string | null {
  const sections: [string, string | null][] = [
    ["Abweichung vom Ablauf", text(session.reflection?.routineDeviation)],
    ["Abweichung von der Prognose", text(session.feedback?.explanation)],
    ["Zum Ziel", text(session.feedback?.goalAchievedNote)],
    ["Fortschritt", text(session.feedback?.progress)],
    ["Fünf beste Schüsse", text(session.feedback?.fiveBestShots)],
    ["Was gut lief", text(session.feedback?.wentWell)],
    ["Erkenntnisse", text(session.feedback?.insights)],
    [
      "Erwartete saubere Schüsse",
      session.prognosis?.expectedCleanShots == null
        ? null
        : String(session.prognosis.expectedCleanShots),
    ],
    ["Ort", withCard ? null : text(session.location)],
  ]
  const parts = [
    text(session.reflection?.observations),
    ...sections.flatMap(([title, value]) => (value ? [`${title}:\n${value}`] : [])),
    session.isFavourite ? "Favorit" : null,
  ].filter((part): part is string => part !== null)
  return parts.length ? parts.join("\n\n") : null
}

/** die Werte wie gespeichert (0 bis 100), je Teil in der Folge der Seite */
function scalesOf(session: TreffsicherSessionForEntry): ImportedEntry["scales"] {
  const scales: ImportedEntry["scales"] = []
  const add = (part: ScalePart, values: Partial<Record<ScaleAspect, unknown>> | null) => {
    if (!values) return
    for (const aspect of SCALE_ASPECTS[part])
      scales.push({ part, aspect, value: values[aspect] as number })
  }
  add("wellbeing", session.wellbeing)
  add("prognosis", session.prognosis)
  add("feedback", session.feedback)
  return scales
}

/**
 * Ein Eintrag aus einer Einheit: Abend der Einheit, Art, Disziplin, Vorhaben (Trainingsziel, sonst Leistungsziel der
 * Prognose), „Hat es geklappt?“ nur mit Vorhaben, Erkenntnis, Lernfrage, Notiz mit Überschriften, erwartetes Ergebnis,
 * Befinden, Prognose und Feedback genau wie gespeichert. „Ablauf eingehalten“ fällt weg ([[adr-033]]). `withCard`: die
 * Einheit hat eine Scheibe in Spiegel (vorhanden oder angelegt); sonst steht der Ort in der Notiz.
 */
export function entryFromSession(
  session: TreffsicherSessionForEntry,
  context: { familyId: number | null; withCard: boolean; timeZone: string }
): ImportedEntry {
  const intention = text(session.trainingGoal) ?? text(session.prognosis?.performanceGoal)
  const achieved = session.feedback?.goalAchieved ?? null
  return {
    importKey: `preview:${session.id}`,
    day: eveningDay(session.dateMs, context.timeZone),
    kind: KIND[session.type],
    familyId: context.familyId,
    intention,
    outcome: intention && achieved !== null ? (achieved ? "yes" : "no") : null,
    learned: text(session.reflection?.insight),
    question: text(session.reflection?.learningQuestion),
    note: noteOf(session, context.withCard),
    expectedScore: session.prognosis?.expectedScore ?? null,
    scales: scalesOf(session),
  }
}

/**
 * Die Ausführung je Wertungsserie auf die Serien einer Scheibe: Position k der Wertungsserien → Serie k, Wert die Mitte
 * der Stufe (Treffsicher 1 bis 5). Probeserien und Serien ohne Bewertung fallen weg; stimmt die Zahl der Wertungsserien
 * nicht mit den Serien der Scheibe überein, null.
 */
export function executionsOnCard(
  session: Pick<TreffsicherSessionForEntry, "series">,
  cardSeries: readonly { series: number }[]
): { series: number; value: number }[] | null {
  const scored = [...session.series]
    .filter((s) => !s.isPractice)
    .sort((a, b) => a.position - b.position)
  if (scored.length !== cardSeries.length) return null
  const numbers = cardSeries.map((s) => s.series).sort((a, b) => a - b)
  return scored.flatMap((s, i) =>
    s.executionQuality === null
      ? []
      : [
          {
            series: numbers[i],
            value: valueOfStage(Math.min(5, Math.max(1, Math.round(s.executionQuality))) as Stage),
          },
        ]
  )
}
