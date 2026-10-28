"use client"

import Link from "next/link"
import { useMemo } from "react"

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import type { CardMark } from "@vereinsheim/shot-core/projection"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { StartPage } from "@vereinsheim/shot-ui/layout/StartPage"
import { OpenBox, type OpenItem } from "@vereinsheim/shot-ui/start/OpenBox"
import { openCard } from "@vereinsheim/shot-ui/nav/navigate"
import { DEFAULT_LIST } from "@vereinsheim/shot-ui/nav/routes"
import { ScoringToggle } from "@vereinsheim/shot-ui/controls/ScoringToggle"
import { EveningBlock, type EveningBlockProps } from "@vereinsheim/shot-ui/start/EveningBlock"
import { FormLine } from "@vereinsheim/shot-ui/start/FormLine"
import type { StartModel } from "@vereinsheim/shot-ui/start/model"

import { NoCards } from "@/components/shell/NoCards"
import { useHelp } from "@vereinsheim/ui/design2/help-sheet"
import { Page } from "@vereinsheim/ui/design2/page"
import { useSavedChoice } from "@/components/shell/useSavedChoice"
import { marksById } from "@/lib/marks"
import type { PageContext } from "@/lib/page-context"
import type { PartLine } from "@/lib/part-line"
import type { FamilyOption } from "@/lib/pages"
import { setFamilyScoring } from "@/lib/scoring-actions"

/**
 * Ein Block mit der Wertung seiner Familie als Kreis neben der Zahl: gespeichert wie in Liste und Fortschritt, danach
 * rechnet Start neu
 */
function ScoredEveningBlock(props: Omit<EveningBlockProps, "actions" | "notice">) {
  const { block } = props
  const familyScoring = useSavedChoice({
    value: block.scoring,
    scope: block.family,
    save: (scoring) => setFamilyScoring(block.family, scoring),
    notSaved: "Die Wertung ließ sich nicht speichern.",
  })
  return (
    <EveningBlock
      {...props}
      actions={
        // je Block ein eigener Name; der Kreis stellt Ø, Band und Rekorde um, die Kacheln zeigen die Wertung der Scheibe
        <ScoringToggle
          label={`Wertung für Ø (${props.familyLabel})`}
          scoring={familyScoring.shown}
          onChange={familyScoring.change}
        />
      }
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

/** eigene Scheiben, deren Disziplin noch niemand eingeordnet hat; null ohne */
export function waitingText(waiting: number): string | null {
  if (waiting <= 0) return null
  return waiting === 1
    ? "Eine Scheibe wartet darauf, dass ein Admin ihre Disziplin einordnet. Danach erscheint sie hier von selbst."
    : `${waiting} Scheiben warten darauf, dass ein Admin ihre Disziplin einordnet. Danach erscheinen sie hier von selbst.`
}

/**
 * Start: „Offen“ (wartende erste Scheiben), je Familie des letzten Abends der Abend im Formband,
 * die Form. Das Modell hat die Seite auf dem Server gerechnet (`startModel` aus den Projektionen).
 */
export function StartScreen({
  model,
  marks: compact,
  families,
  context,
  open,
  waiting = 0,
  lines = {},
}: {
  model: StartModel
  /** die Lagen der Scheiben des Abends, kompakt nach Id */
  marks: Record<string, CardMark[]>
  families: FamilyOption[]
  context: PageContext
  /** was auf den Schützen wartet, je Eintrag ein Link nach „Offen“ */
  open: OpenItem[]
  /** eigene Scheiben, deren Disziplin ein Admin noch einordnen muss (`waitingForDiscipline`) */
  waiting?: number
  /** Zeilen anderer Teile je Block (das Tagebuch), Schlüssel `Tag|Familie` */
  lines?: Readonly<Record<string, PartLine>>
}) {
  const { timeZone } = context
  const onHelp = useHelp()
  const marks = useMemo(() => marksById(compact), [compact])
  const familyOf = useMemo(() => new Map(families.map((f) => [f.value, f])), [families])
  // eine Kachel öffnet die Scheibe in ihrer Wertung, ein Rekord in der, in der er steht (der seines Blocks)
  const cardRoute = (id: string) => openCard({ page: "start" }, id)
  const recordRoute = (id: string, scoring: Scoring) => openCard({ page: "start" }, id, scoring)

  return (
    <Page>
      <section data-start-page className="grid gap-4">
        <h1 className="sr-only">Start</h1>
        {waitingText(waiting) && (
          <p data-waiting-discipline className="text-sm text-foreground-2">
            {waitingText(waiting)}
          </p>
        )}
        {model.blocks.length === 0 ? (
          <>
            <OpenBox items={open} />
            <NoCards />
          </>
        ) : (
          <StartPage
            open={open.length ? <OpenBox items={open} /> : undefined}
            evenings={model.blocks.map((block) => {
              const family = familyOf.get(block.family)
              const line = lines[`${block.day}|${block.family}`]
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
                  onHelp={onHelp}
                  extra={
                    line && (
                      <Link
                        href={line.href}
                        data-part-line={line.key}
                        className="text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {`${line.title} · ${line.action} ›`}
                      </Link>
                    )
                  }
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
