import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { cardListModel } from "@vereinsheim/shot-ui/list/evenings"
import { EveningList } from "@vereinsheim/shot-ui/list/EveningList"
import { ListControls } from "@vereinsheim/shot-ui/list/ListControls"
import { ListHeader } from "@vereinsheim/shot-ui/list/ListHeader"
import { listOnEvening, openCard, progressFromList } from "@vereinsheim/shot-ui/nav/navigate"
import { urlFromRoute, type ListQuery, type ListRoute } from "@vereinsheim/shot-ui/nav/routes"
import { useEffect, useMemo } from "react"

import { LaborPanel, type LaborPanelProps } from "./LaborPanel"
import {
  FAMILIES,
  NAMED_PERIODS,
  projectedSeason,
  season,
  SEASON_NOW_MS,
  SEASON_TIME_ZONE,
  seasonMarks,
  targetOfFamily,
} from "./season"
import { exposeListForTest } from "./testHook"

export interface ListViewProps {
  header: Omit<LaborPanelProps, "children" | "hint" | "address">
  query: ListQuery
  onQuery: (query: ListQuery) => void
  /** Wertung des Geräts (die Liste hat keine eigene) */
  scoring: Scoring
}

/**
 * Die Scheiben-Liste im Labor (Plan N2, Task 8): die Saison nach Abend, alles Gerechnete aus `cardListModel`, die
 * Bausteine aus `shot-ui/list`. Der Zustand (Filter) kommt aus `App`, damit „Zurück zu „Scheiben““ ihn wiederfindet;
 * die Adresse zeigt, wie die App ihn schriebe.
 */
export function ListView({ header, query, onQuery, scoring }: ListViewProps) {
  const all = season()
  const projected = projectedSeason()
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all])
  // die Wege als Adressen (Plan N3, D3): öffnen in der Wertung, die die Zeile vorn zeigt (die amtliche, sonst die
  // des Geräts), „Im Fortschritt zeigen“ (im Blatt „Filter“), eine andere Familie am selben Abend
  const route: ListRoute = { page: "cards", query, evening: null }
  const cardRoute = (id: string) => openCard(route, id, byId.get(id)?.card.official ?? scoring)
  const model = useMemo(
    () =>
      cardListModel(
        projected.map((c) => ({ card: c.card, family: c.family })),
        query,
        { timeZone: SEASON_TIME_ZONE, nowMs: SEASON_NOW_MS, named: NAMED_PERIODS, scoring }
      ),
    [projected, query, scoring]
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
              progress={progressFromList(route, scoring)}
            />
          }
        />
        <EveningList
          model={model}
          marks={seasonMarks()}
          target={TARGETS[targetOfFamily(family)]}
          families={FAMILIES}
          timeZone={SEASON_TIME_ZONE}
          cardRoute={cardRoute}
          otherFamilyRoute={(family, day) => listOnEvening(query, family, day)}
        />
      </section>
      {/* zuletzt: der Knopf steht unten rechts, also auch zuletzt in der Tab-Folge (Review) */}
      <LaborPanel
        {...header}
        address={urlFromRoute({ page: "cards", query, evening: null })}
        hint="Die Scheiben nach Abend: Luftpistole sind deine echten aus der Vereinsanlage (mit mehreren Scheiben am 12. November 2024 und am 25. September 2026), das Luftgewehr ist erfunden, bis auf zwei deiner Scheiben (24. Oktober 2025, 9. Januar 2026)."
      />
    </div>
  )
}
