"use client"

import { useMemo } from "react"

import { TARGETS } from "@vereinsheim/shot-core/targets"
import { StartPage } from "@vereinsheim/shot-ui/layout/StartPage"
import { openCard } from "@vereinsheim/shot-ui/nav/navigate"
import { DEFAULT_LIST } from "@vereinsheim/shot-ui/nav/routes"
import { EveningBlock } from "@vereinsheim/shot-ui/start/EveningBlock"
import { FormLine } from "@vereinsheim/shot-ui/start/FormLine"
import { startModel } from "@vereinsheim/shot-ui/start/model"

import { NoCards } from "@/components/shell/NoCards"
import { Page } from "@/components/shell/Page"
import type { PageCard } from "@/lib/db/reads"
import type { PageContext } from "@/lib/page-context"
import type { FamilyOption } from "@/lib/pages"

/**
 * Start (N5, N7): je Familie des letzten Abends der Abend im Formband, die Form; „Offen“ kommt mit der Zuordnung
 * (SP-1.7). Wie im Labor gerechnet (`startModel`), mit den Scheiben aus der Datenbank.
 */
export function StartScreen({
  cards,
  families,
  context,
}: {
  cards: PageCard[]
  families: FamilyOption[]
  context: PageContext
}) {
  const { timeZone, nowMs, named, scoring } = context
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const familyOf = useMemo(() => new Map(families.map((f) => [f.value, f])), [families])
  const model = useMemo(
    () =>
      startModel({
        cards: cards.map((card) => ({ card, family: card.family!.slug })),
        timeZone,
        nowMs,
        named,
        scoring,
        family: families[0]?.value ?? "",
      }),
    [cards, families, timeZone, nowMs, named, scoring]
  )
  // eine Kachel öffnet die Scheibe in der Wertung, die sie vorn zeigt (die amtliche, sonst die des Geräts)
  const cardRoute = (id: string) =>
    openCard({ page: "start" }, id, byId.get(id)?.official ?? scoring)
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
                  cards={byId}
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
