import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { cardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { EveningList } from "@vereinsheim/shot-ui/list/EveningList"
import { ListControls } from "@vereinsheim/shot-ui/list/ListControls"
import { ListHeader } from "@vereinsheim/shot-ui/list/ListHeader"
import { urlFromRoute, type ListQuery } from "@vereinsheim/shot-ui/nav/routes"
import { useEffect, useMemo } from "react"

import { LaborHeader, type LaborHeaderProps } from "./LaborHeader"
import {
  FAMILIES,
  NAMED_PERIODS,
  season,
  SEASON_NOW_MS,
  SEASON_TIME_ZONE,
  targetOfFamily,
  type SeasonCard,
} from "./season"
import { exposeListForTest } from "./testHook"

export interface ListViewProps {
  header: Omit<LaborHeaderProps, "children" | "hint">
  query: ListQuery
  onQuery: (query: ListQuery) => void
  /** Wertung des Geräts (die Liste hat keine eigene) */
  scoring: Scoring
  /** die ganze Zeile öffnet die Scheibe in der Ansicht „Scheibe“ */
  onOpen: (card: SeasonCard) => void
  /** „Verlauf dieser Filter“ */
  onProgress: () => void
  /** eine andere Familie desselben Abends: Familie wechseln, zum Abend springen */
  onFamily: (family: string, day: string) => void
}

/**
 * Die Scheiben-Liste im Labor (Plan N2, Task 8): die Saison nach Abend, alles Gerechnete aus `cardListModel`, die
 * Bausteine aus `shot-ui/list`. Der Zustand (Filter) kommt aus `App`, damit „Zurück zu „Scheiben““ ihn wiederfindet;
 * die Adresse zeigt, wie die App ihn schriebe.
 */
export function ListView({
  header,
  query,
  onQuery,
  scoring,
  onOpen,
  onProgress,
  onFamily,
}: ListViewProps) {
  const all = season()
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all])
  const cards = useMemo(() => new Map<string, PeriodCard>(all.map((c) => [c.id, c.card])), [all])
  const model = useMemo(
    () =>
      cardListModel(
        all.map((c) => ({ card: c.card, family: c.family })),
        query,
        { timeZone: SEASON_TIME_ZONE, nowMs: SEASON_NOW_MS, named: NAMED_PERIODS, scoring }
      ),
    [all, query, scoring]
  )
  // die Scheiben und ihre Familien, damit die Prüfung Ergebnis, Ø und Abstand selbst nachrechnet
  useEffect(() =>
    exposeListForTest({
      model,
      query,
      cards: all.map((c) => c.card),
      families: Object.fromEntries(all.map((c) => [c.id, c.family])),
    })
  )
  const family = model.family ?? FAMILIES[0].value
  const familyLabel = FAMILIES.find((f) => f.value === family)?.label ?? family

  return (
    <div className="mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24">
      <LaborHeader
        {...header}
        address={urlFromRoute({ page: "cards", query, evening: null })}
        hint="Die erfundene Saison nach Abend: an zwei Abenden zwei Scheiben Luftpistole, an drei Samstagen Luftgewehr und Luftpistole am selben Abend."
      />
      <section data-card-list-page className="grid max-w-4xl gap-4">
        <ListHeader
          familyLabel={familyLabel}
          cards={model.cards}
          controls={
            <ListControls
              query={query}
              family={family}
              families={FAMILIES}
              flags={model.flags}
              rangeLabel={model.range?.label ?? null}
              onQuery={onQuery}
              onProgress={onProgress}
            />
          }
        />
        <div className="rounded-2xl border border-border bg-card p-2">
          <EveningList
            model={model}
            cards={cards}
            target={TARGETS[targetOfFamily(family)]}
            families={FAMILIES}
            timeZone={SEASON_TIME_ZONE}
            onOpen={(id) => {
              const card = byId.get(id)
              if (card) onOpen(card)
            }}
            onFamily={onFamily}
          />
        </div>
      </section>
    </div>
  )
}
