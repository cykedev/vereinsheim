import type { CardMark } from "@vereinsheim/shot-core/projection"
import { cardListModel, type CardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { periodStateFromRoute } from "@vereinsheim/shot-ui/nav/navigate"
import type { ListQuery, ProgressQuery } from "@vereinsheim/shot-ui/nav/routes"
import { fromProjection } from "@vereinsheim/shot-ui/period/fromProjection"
import { lightPeriodModel, periodModel, type PeriodModel } from "@vereinsheim/shot-ui/period/model"
import type { PeriodState } from "@vereinsheim/shot-ui/period/state"
import { startModel, type StartModel } from "@vereinsheim/shot-ui/start/model"

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import type { Db } from "@/lib/db"
import { familyScorings, marksOfCards, ownerCards, type OverviewCard } from "@/lib/db/reads"
import type { PageContext } from "@/lib/page-context"
import { familiesOf, listable, withFamily, type FamilyOption } from "@/lib/pages"
import { familyScoringOf } from "@/lib/scoring"

// Was Start, Liste und Fortschritt auf dem Server rechnen (ADR-031): die eigenen Scheiben mit Projektion lesen, das
// Modell aus `shot-ui` rechnen, die Lagen der gezeigten Scheiben lesen. Die Seiten und die Messung (`tools/measure.ts`)
// rufen dieselben Funktionen; an den Browser geht nur, was sie zurückgeben. Jede Familie rechnet in ihrer Wertung:
// gespeichert, sonst die häufigste ihrer Scheiben.

type Context = Pick<PageContext, "timeZone" | "nowMs" | "named">

/** die eigenen Scheiben, die die Übersichten zeigen können, und die Wertung je Familie */
async function overviewCards(
  db: Db,
  ownerId: string
): Promise<{ shown: OverviewCard[]; scoringOf: (family: string) => Scoring }> {
  const [cards, saved] = await Promise.all([
    ownerCards(db, { ownerId }),
    familyScorings(db, ownerId),
  ])
  const shown = listable(cards)
  const scoringOf = (family: string) =>
    familyScoringOf(
      shown.filter((card) => card.family?.slug === family).map((card) => card.scoring),
      saved[family] ?? null
    )
  return { shown, scoringOf }
}

/** Start: der letzte Abend je Familie und die Form, jeder Block in der Wertung seiner Familie; die Lagen des Abends */
export async function startPageData(
  db: Db,
  ownerId: string,
  context: Context
): Promise<{ model: StartModel; marks: Record<string, CardMark[]>; families: FamilyOption[] }> {
  const { shown, scoringOf } = await overviewCards(db, ownerId)
  const families = familiesOf(shown)
  const model = startModel({
    cards: withFamily(shown),
    timeZone: context.timeZone,
    nowMs: context.nowMs,
    named: context.named,
    scoringOf,
    family: families[0]?.value ?? "",
  })
  const ids = model.blocks.flatMap((block) => block.rows.map((row) => row.id))
  return { model, marks: await marksOfCards(db, { ownerId, ids }), families }
}

/**
 * Liste: die Scheiben einer Familie nach Abend mit den Filtern der Adresse, Ø und Abstand in der Wertung der Familie
 * (`model.scoring`); ohne Familie in der Adresse, oder einer ohne eigene Scheiben, die der neuesten Scheibe. `list` ist
 * null ohne Scheiben.
 */
export async function listPageData(
  db: Db,
  ownerId: string,
  query: ListQuery,
  context: Context
): Promise<{
  list: { model: CardListModel; marks: Record<string, CardMark[]>; option: FamilyOption } | null
  families: FamilyOption[]
}> {
  const { shown, scoringOf } = await overviewCards(db, ownerId)
  const families = familiesOf(shown)
  const option = families.find((f) => f.value === query.family) ?? families[0]
  if (!option) return { list: null, families }
  const model = cardListModel(
    withFamily(shown),
    { ...query, family: option.value },
    {
      timeZone: context.timeZone,
      nowMs: context.nowMs,
      named: context.named,
      scoring: scoringOf(option.value),
    }
  )
  const ids = model.evenings.flatMap((evening) => evening.rows.map((row) => row.id))
  return { list: { model, marks: await marksOfCards(db, { ownerId, ids }), option }, families }
}

/**
 * Fortschritt: die Seite eines Zeitraums über die eigenen Scheiben einer Familie, in der Wertung der Familie (ein
 * `scoring` in der Adresse gilt nicht); ohne Familie in der Adresse, oder einer ohne eigene Scheiben, die der neuesten
 * Scheibe. Das Modell leicht für den Browser (`lightPeriodModel`), dazu die Lagen der Scheibe, die die Ablesung zeigt.
 * `progress` ist null ohne Scheiben.
 */
export async function progressPageData(
  db: Db,
  ownerId: string,
  query: ProgressQuery,
  context: Context
): Promise<{
  progress: { model: PeriodModel; state: PeriodState; marks: Record<string, CardMark[]> } | null
  families: FamilyOption[]
}> {
  const { shown, scoringOf } = await overviewCards(db, ownerId)
  const families = familiesOf(shown)
  const option = families.find((f) => f.value === query.family) ?? families[0]
  if (!option) return { progress: null, families }
  const state: PeriodState = {
    ...periodStateFromRoute({ page: "progress", query, section: null }, option.value),
    family: option.value,
    scoring: scoringOf(option.value),
  }
  const model = lightPeriodModel(
    periodModel({
      items: shown.filter((card) => card.family?.slug === option.value).map(fromProjection),
      state,
      nowMs: context.nowMs,
      timeZone: context.timeZone,
      named: context.named,
    })
  )
  const readingId = model.reading?.card.id
  const marks = readingId ? await marksOfCards(db, { ownerId, ids: [readingId] }) : {}
  return { progress: { model, state, marks }, families }
}
