"use client"

import { useMemo } from "react"

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import type { CardMark } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { StartPage } from "@vereinsheim/shot-ui/layout/StartPage"
import { openCard } from "@vereinsheim/shot-ui/nav/navigate"
import { DEFAULT_LIST } from "@vereinsheim/shot-ui/nav/routes"
import { EveningBlock } from "@vereinsheim/shot-ui/start/EveningBlock"
import { FormLine } from "@vereinsheim/shot-ui/start/FormLine"
import type { StartModel } from "@vereinsheim/shot-ui/start/model"

import { NoCards } from "@/components/shell/NoCards"
import { Page } from "@/components/shell/Page"
import { marksById } from "@/lib/marks"
import type { PageContext } from "@/lib/page-context"
import type { FamilyOption } from "@/lib/pages"

/**
 * Start (N5, N7): je Familie des letzten Abends der Abend im Formband, die Form; „Offen“ kommt mit der Zuordnung
 * (SP-1.7). Das Modell hat die Seite auf dem Server gerechnet (`startModel` aus den Projektionen).
 */
export function StartScreen({
  model,
  marks: compact,
  families,
  context,
}: {
  model: StartModel
  /** die Lagen der Scheiben des Abends, kompakt nach Id */
  marks: Record<string, CardMark[]>
  families: FamilyOption[]
  context: PageContext
}) {
  const { timeZone, scoring } = context
  const marks = useMemo(() => marksById(compact), [compact])
  const familyOf = useMemo(() => new Map(families.map((f) => [f.value, f])), [families])
  // eine Kachel öffnet die Scheibe in der Wertung, die sie vorn zeigt (die amtliche, sonst die des Geräts)
  const resultScoring = useMemo(
    () =>
      new Map<string, Scoring>(
        model.blocks.flatMap((block) => block.rows.map((row) => [row.id, row.resultScoring]))
      ),
    [model]
  )
  const cardRoute = (id: string) =>
    openCard({ page: "start" }, id, resultScoring.get(id) ?? scoring)
  const recordRoute = (id: string) => openCard({ page: "start" }, id, scoring)

  return (
    <Page>
      <section data-start-page className="grid gap-4">
        <h1 className="sr-only">Start</h1>
        {model.blocks.length === 0 ? (
          <NoCards />
        ) : (
          <StartPage
            evenings={model.blocks.map((block) => {
              const family = familyOf.get(block.family)
              return (
                <EveningBlock
                  key={block.family}
                  block={block}
                  familyLabel={family?.label ?? block.family}
                  marks={marks}
                  target={TARGETS[family?.targetId ?? "lp-10m"]}
                  timeZone={timeZone}
                  cardRoute={cardRoute}
                  recordRoute={recordRoute}
                  listRoute={{
                    page: "cards",
                    query: { ...DEFAULT_LIST, family: block.family },
                    evening: block.day,
                  }}
                />
              )
            })}
            form={
              model.form && (
                <FormLine
                  form={model.form}
                  familyLabel={familyOf.get(model.form.family)?.label ?? model.form.family}
                />
              )
            }
          />
        )}
      </section>
    </Page>
  )
}
