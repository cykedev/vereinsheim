"use client"

import { useMemo } from "react"

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import type { CardMark } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { StartPage } from "@vereinsheim/shot-ui/layout/StartPage"
import { openCard } from "@vereinsheim/shot-ui/nav/navigate"
import { DEFAULT_LIST } from "@vereinsheim/shot-ui/nav/routes"
import { ScoringToggle } from "@vereinsheim/shot-ui/controls/ScoringToggle"
import { EveningBlock, type EveningBlockProps } from "@vereinsheim/shot-ui/start/EveningBlock"
import { FormLine } from "@vereinsheim/shot-ui/start/FormLine"
import type { StartModel } from "@vereinsheim/shot-ui/start/model"

import { NoCards } from "@/components/shell/NoCards"
import { Page } from "@/components/shell/Page"
import { useSavedChoice } from "@/components/shell/useSavedChoice"
import { marksById } from "@/lib/marks"
import type { PageContext } from "@/lib/page-context"
import type { FamilyOption } from "@/lib/pages"
import { setFamilyScoring } from "@/lib/scoring-actions"

/**
 * Ein Block mit der Wertung seiner Familie als Kreis neben der Zahl (Plan `plans/2026-10-13-spiegel-symbole.md`):
 * gespeichert wie in Liste und Fortschritt, danach rechnet Start neu
 */
function ScoredEveningBlock(props: Omit<EveningBlockProps, "actions" | "notice">) {
  const { block } = props
  const familyScoring = useSavedChoice(
    block.scoring,
    (scoring) => setFamilyScoring(block.family, scoring),
    "Die Wertung ließ sich nicht speichern."
  )
  return (
    <EveningBlock
      {...props}
      actions={<ScoringToggle scoring={familyScoring.shown} onChange={familyScoring.change} />}
      notice={
        familyScoring.error && (
          <p role="alert" className="text-sm text-destructive">
            {familyScoring.error}
          </p>
        )
      }
    />
  )
}

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
  const { timeZone } = context
  const marks = useMemo(() => marksById(compact), [compact])
  const familyOf = useMemo(() => new Map(families.map((f) => [f.value, f])), [families])
  // eine Kachel öffnet die Scheibe in ihrer Wertung, ein Rekord in der, in der er steht (der seines Blocks)
  const cardRoute = (id: string) => openCard({ page: "start" }, id)
  const recordRoute = (id: string, scoring: Scoring) => openCard({ page: "start" }, id, scoring)

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
                <ScoredEveningBlock
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
