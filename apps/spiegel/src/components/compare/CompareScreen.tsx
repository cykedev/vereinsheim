"use client"

import { useRouter } from "next/navigation"
import { useCallback, useState, useTransition } from "react"

import { TARGETS } from "@vereinsheim/shot-core/targets"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { CardChoiceSheet, PeriodChoiceSheet } from "@vereinsheim/shot-ui/compare/ChoiceSheets"
import { CompareControls, type CompareSideKey } from "@vereinsheim/shot-ui/compare/CompareControls"
import { ComparePicture } from "@vereinsheim/shot-ui/compare/ComparePicture"
import { CompareMetrics, CompareRows } from "@vereinsheim/shot-ui/compare/CompareRows"
import { basisText, compareSentence, pictureLegend } from "@vereinsheim/shot-ui/compare/words"
import { HelpButton } from "@vereinsheim/shot-ui/help/HelpButton"
import { CardContextBar } from "@vereinsheim/shot-ui/nav/CardContextBar"
import {
  DEFAULT_PROGRESS,
  urlFromRoute,
  type CompareQuery,
  type Route,
} from "@vereinsheim/shot-ui/nav/routes"
import { useHelp } from "@vereinsheim/ui/design2/help-sheet"
import { Page } from "@vereinsheim/ui/design2/page"
import { cn } from "@vereinsheim/lib/utils"

import type { ComparePageData } from "@/lib/compare"
import type { PageContext } from "@/lib/page-context"

/** der Rückweg: bei zwei Scheiben zur Scheibe A, sonst zum Fortschritt der Familie */
function backOf(data: ComparePageData): { route: Route; text: string } {
  const query = data.query
  if (query.type === "cards" && query.a)
    return {
      route: {
        page: "card",
        id: query.a,
        origin: null,
        selection: null,
        shot: null,
        scoring: null,
        anchor: null,
      },
      text: "Zur Scheibe",
    }
  return {
    route: { page: "progress", query: { ...DEFAULT_PROGRESS, family: data.family }, section: null },
    text: "Zum Fortschritt",
  }
}

/**
 * Seite Vergleichen: Kopf mit Art, Familie und den Seiten A und B, dann die Antwort als Satz, das Bild beider Seiten,
 * die drei Zeilen mit Urteil, die Grundlage und eingeklappt alle Kennzahlen. Jede Wahl ist eine neue Adresse, der
 * Server rechnet neu; bis dahin wird die Seite leiser.
 */
export function CompareScreen({
  data,
  context,
}: {
  data: ComparePageData
  context: Pick<PageContext, "timeZone" | "named">
}) {
  const router = useRouter()
  const help = useHelp()
  const onHelp = useCallback((id: string) => help(id), [help])
  const [pending, startTransition] = useTransition()
  const [picking, setPicking] = useState<CompareSideKey | null>(null)
  const { query, model } = data
  const go = (next: CompareQuery) =>
    startTransition(() =>
      router.push(urlFromRoute({ page: "compare", query: next }), { scroll: false })
    )
  const back = backOf(data)
  const target = TARGETS[data.targetId]
  const sentence = model ? compareSentence(model) : null
  const close = () => setPicking(null)

  return (
    <Page>
      <CardContextBar
        back={back.route}
        backText={back.text}
        prev={null}
        next={null}
        paging={false}
      />
      <div className="mx-auto grid w-full max-w-[40rem] gap-5">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            Vergleichen
          </h1>
          <HelpButton
            label="Vergleichen"
            helpId="vergleichen"
            onClick={() => onHelp("vergleichen")}
          />
        </div>
        <CompareControls
          query={query}
          family={data.family}
          families={data.families}
          names={data.names}
          newest={data.choices.slice(0, 2).map((choice) => choice.id)}
          onQuery={go}
          onPick={setPicking}
        />
        <div
          data-compare-body
          aria-busy={pending || undefined}
          className={cn("grid gap-4 transition-opacity", pending && "opacity-60")}
        >
          {!model ? (
            <p
              data-compare-problem
              className="rounded-2xl border border-border bg-card p-4 text-[14px]"
            >
              {data.problem}
            </p>
          ) : (
            <>
              {sentence && (
                <p data-compare-sentence className="text-[15px] leading-relaxed">
                  <b className="font-semibold">{sentence.lead}</b>
                  {sentence.more && (
                    <span className="text-foreground-2">{` ${sentence.more}`}</span>
                  )}
                </p>
              )}
              {model.a.cards > 0 && model.b.cards > 0 && (
                <>
                  <div className="grid gap-2">
                    <ComparePicture
                      picture={model.picture}
                      target={target}
                      label={sentence?.lead ?? ""}
                    />
                    <p className="text-[13px] text-muted-foreground">
                      {pictureLegend(model.picture)}
                    </p>
                  </div>
                  <CompareRows model={model} onHelp={onHelp} />
                  <p data-compare-basis className="text-[13px] text-muted-foreground">
                    {basisText(model)}
                  </p>
                  <CompareMetrics
                    model={model}
                    onHelp={(key) => {
                      const id = helpForMetric(key)?.id
                      if (id) onHelp(id)
                    }}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {query.type === "cards" ? (
        <CardChoiceSheet
          // je Öffnen neu: „Mehr zeigen“ beginnt wieder bei 30
          key={picking ?? "zu"}
          open={picking !== null}
          onClose={close}
          title={picking === "b" ? "Scheibe B" : "Scheibe A"}
          choices={data.choices}
          current={picking === "b" ? query.b : query.a}
          other={picking === "b" ? query.a : query.b}
          timeZone={context.timeZone}
          onChoose={(id) => go({ ...query, [picking === "b" ? "b" : "a"]: id })}
        />
      ) : (
        data.ranges && (
          <PeriodChoiceSheet
            open={picking !== null}
            onClose={close}
            title={
              query.type === "kind" ? "Zeitraum" : picking === "b" ? "Zeitraum B" : "Zeitraum A"
            }
            value={query.type === "kind" ? query.range : picking === "b" ? query.b : query.a}
            range={picking === "b" ? data.ranges.b : data.ranges.a}
            named={context.named}
            timeZone={context.timeZone}
            withPrevious={query.type === "periods" && picking === "b"}
            onApply={(value) => {
              if (query.type === "kind") {
                if (value !== "previous") go({ ...query, range: value })
              } else if (picking === "b") go({ ...query, b: value })
              else if (value !== "previous") go({ ...query, a: value })
            }}
          />
        )
      )}
    </Page>
  )
}
