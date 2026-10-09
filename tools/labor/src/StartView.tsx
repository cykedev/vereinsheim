import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { StartPage } from "@vereinsheim/shot-ui/layout/StartPage"
import { openCard } from "@vereinsheim/shot-ui/nav/navigate"
import { DEFAULT_LIST } from "@vereinsheim/shot-ui/nav/routes"
import { EveningBlock } from "@vereinsheim/shot-ui/start/EveningBlock"
import { FormLine } from "@vereinsheim/shot-ui/start/FormLine"
import { startModel } from "@vereinsheim/shot-ui/start/model"
import { OpenBox, type OpenItem } from "@vereinsheim/shot-ui/start/OpenBox"
import { useEffect, useMemo } from "react"

import { LaborPanel, type LaborPanelProps } from "./LaborPanel"
import {
  FAMILIES,
  NAMED_PERIODS,
  season,
  SEASON_NOW_MS,
  SEASON_TIME_ZONE,
  targetOfFamily,
} from "./season"
import { exposeStartForTest } from "./testHook"

/** zwei Beispiele für „Offen“; echte Fälle kommen mit N6 (Plan N5, D1) */
export const OPEN_EXAMPLES: readonly OpenItem[] = [
  {
    id: "confirm",
    title: "Erste Scheibe bestätigen",
    detail: "Beispiel: Ist die Scheibe vom 26.09. deine?",
    route: { page: "open" },
  },
  {
    id: "scan",
    title: "QR-Scan wartet auf die Zuordnung",
    detail: "Beispiel: Ausdruck vom 25.09.",
    route: { page: "scan" },
  },
]

const labelOf = (family: string) => FAMILIES.find((f) => f.value === family)?.label ?? family

export interface StartViewProps {
  header: Omit<LaborPanelProps, "children" | "hint" | "address">
  /** Wertung des Geräts (Start hat keine eigene) */
  scoring: Scoring
  /** die zuletzt gewählte Familie, für die Form */
  family: string
}

/**
 * Start im Labor (Plan N5): Offen, je Familie des letzten Abends der Abend im Formband, die Form der letzten 90 Tage.
 * Alles Gerechnete aus `startModel`, die Bausteine aus `shot-ui/start`.
 */
export function StartView({ header, scoring, family }: StartViewProps) {
  const all = season()
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all])
  const cards = useMemo(() => new Map<string, PeriodCard>(all.map((c) => [c.id, c.card])), [all])
  const model = useMemo(
    () =>
      startModel({
        cards: all.map((c) => ({ card: c.card, family: c.family })),
        timeZone: SEASON_TIME_ZONE,
        nowMs: SEASON_NOW_MS,
        named: NAMED_PERIODS,
        scoring,
        family,
      }),
    [all, scoring, family]
  )
  useEffect(() => exposeStartForTest({ model, cards: all.map((c) => c.card) }))
  // eine Kachel öffnet die Scheibe in der Wertung, die sie vorn zeigt (die amtliche, sonst die des Geräts)
  const cardRoute = (id: string) =>
    openCard({ page: "start" }, id, byId.get(id)?.card.official ?? scoring)
  // ein Rekord öffnet in der Wertung, in der er steht (der des Geräts)
  const recordRoute = (id: string) => openCard({ page: "start" }, id, scoring)

  return (
    <div className="mx-auto grid max-w-7xl gap-7 px-4 pt-7 pb-24">
      <LaborPanel
        {...header}
        hint="Der letzte Abend der erfundenen Saison ist Samstag, der 26. September: ein Wettkampf Luftgewehr und zwei Scheiben Luftpistole. „Offen“ zeigt zwei Beispiele."
      />
      <section data-start-page className="grid gap-4">
        <h1 className="sr-only">Start</h1>
        <StartPage
          open={<OpenBox items={OPEN_EXAMPLES} />}
          evenings={model.blocks.map((block) => (
            <EveningBlock
              key={block.family}
              block={block}
              familyLabel={labelOf(block.family)}
              cards={cards}
              target={TARGETS[targetOfFamily(block.family)]}
              timeZone={SEASON_TIME_ZONE}
              cardRoute={cardRoute}
              recordRoute={recordRoute}
              listRoute={{
                page: "cards",
                query: { ...DEFAULT_LIST, family: block.family },
                evening: block.day,
              }}
            />
          ))}
          form={
            model.form && <FormLine form={model.form} familyLabel={labelOf(model.form.family)} />
          }
        />
      </section>
    </div>
  )
}
