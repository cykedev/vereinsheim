import type { CardMark } from "@vereinsheim/shot-core/projection"
import { cardListModel, type CardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { periodStateFromRoute } from "@vereinsheim/shot-ui/nav/navigate"
import type { ListQuery, ProgressQuery } from "@vereinsheim/shot-ui/nav/routes"
import { lightPeriodModel, periodModel, type PeriodModel } from "@vereinsheim/shot-ui/period/model"
import type { PeriodState } from "@vereinsheim/shot-ui/period/state"
import { startModel, type StartModel } from "@vereinsheim/shot-ui/start/model"

import type { Db } from "@/lib/db"
import { marksOfCards, ownerCards } from "@/lib/db/reads"
import type { PageContext } from "@/lib/page-context"
import { familiesOf, listable, withFamily, type FamilyOption } from "@/lib/pages"

// Was Start, Liste und Fortschritt auf dem Server rechnen (SP-1.8, ADR-031): die eigenen Scheiben mit Projektion lesen, das Modell
// aus `shot-ui` rechnen, die Lagen der gezeigten Scheiben lesen. Die Seiten und die Messung (`tools/measure.ts`) rufen
// dieselben Funktionen; an den Browser geht nur, was sie zurückgeben.

type Context = Pick<PageContext, "timeZone" | "nowMs" | "named" | "scoring">

/** Start: der letzte Abend je Familie und die Form; die Lagen der Scheiben des Abends */
export async function startPageData(
  db: Db,
  ownerId: string,
  context: Context
): Promise<{ model: StartModel; marks: Record<string, CardMark[]>; families: FamilyOption[] }> {
  const shown = listable(await ownerCards(db, { ownerId }))
  const families = familiesOf(shown)
  const model = startModel({
    cards: withFamily(shown),
    timeZone: context.timeZone,
    nowMs: context.nowMs,
    named: context.named,
    scoring: context.scoring,
    family: families[0]?.value ?? "",
  })
  const ids = model.blocks.flatMap((block) => block.rows.map((row) => row.id))
  return { model, marks: await marksOfCards(db, { ownerId, ids }), families }
}

/**
 * Liste: die Scheiben einer Familie nach Abend mit den Filtern der Adresse; ohne Familie in der Adresse, oder einer ohne
 * eigene Scheiben, die der neuesten Scheibe. `list` ist null ohne Scheiben.
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
  const shown = listable(await ownerCards(db, { ownerId }))
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
      scoring: context.scoring,
    }
  )
  const ids = model.evenings.flatMap((evening) => evening.rows.map((row) => row.id))
  return { list: { model, marks: await marksOfCards(db, { ownerId, ids }), option }, families }
}

/**
 * Fortschritt: die Seite eines Zeitraums über die eigenen Scheiben einer Familie, mit der Wertung des Geräts; ohne
 * Familie in der Adresse, oder einer ohne eigene Scheiben, die der neuesten Scheibe. Das Modell leicht für den Browser
 * (`lightPeriodModel`), dazu die Lagen der Scheibe, die die Ablesung zeigt. `progress` ist null ohne Scheiben.
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
  const shown = listable(await ownerCards(db, { ownerId }))
  const families = familiesOf(shown)
  const option = families.find((f) => f.value === query.family) ?? families[0]
  if (!option) return { progress: null, families }
  const state: PeriodState = {
    ...periodStateFromRoute({ page: "progress", query, section: null }, option.value),
    family: option.value,
    scoring: context.scoring,
  }
  const model = lightPeriodModel(
    periodModel({
      cards: shown.filter((card) => card.family?.slug === option.value),
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
