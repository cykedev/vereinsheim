"use client"

import { useRouter } from "next/navigation"
import { useCallback, useState, useTransition } from "react"

import { TARGETS } from "@vereinsheim/shot-core/targets"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { ChartSlot } from "@vereinsheim/shot-ui/analysis/charts/frame"
import { CardChoiceSheet, PeriodChoiceSheet } from "@vereinsheim/shot-ui/compare/ChoiceSheets"
import { CompareControls, type CompareSideKey } from "@vereinsheim/shot-ui/compare/CompareControls"
import {
  ComparePicture,
  SIDE_COLORS,
  SideLegend,
} from "@vereinsheim/shot-ui/compare/ComparePicture"
import { CompareTable } from "@vereinsheim/shot-ui/compare/CompareTable"
import { basisText, compareSentence, pictureLegend } from "@vereinsheim/shot-ui/compare/words"
import { ScoringChip } from "@vereinsheim/shot-ui/controls/ScoringChip"
import { HelpButton } from "@vereinsheim/shot-ui/help/HelpButton"
import { CardContextBar } from "@vereinsheim/shot-ui/nav/CardContextBar"
import { PAGE_COLUMNS } from "@vereinsheim/shot-ui/layout/columns"
import { SectionBlock } from "@vereinsheim/shot-ui/layout/SectionBlock"
import { SectionNav } from "@vereinsheim/shot-ui/layout/SectionNav"
import { COMPARE_SECTIONS, type CompareSection } from "@vereinsheim/shot-ui/layout/sections"
import { useActiveSection } from "@vereinsheim/shot-ui/layout/useActiveSection"
import { ProgressSwitch } from "@vereinsheim/shot-ui/nav/ProgressSwitch"
import {
  DEFAULT_PROGRESS,
  urlFromRoute,
  type CompareQuery,
  type Route,
} from "@vereinsheim/shot-ui/nav/routes"
import { PeriodChart } from "@vereinsheim/shot-ui/period/PeriodChart"
import { PeriodTiles } from "@vereinsheim/shot-ui/period/PeriodTiles"
import { useHelp } from "@vereinsheim/ui/design2/help-sheet"
import { Page } from "@vereinsheim/ui/design2/page"
import { cn } from "@vereinsheim/lib/utils"

import { useSavedChoice } from "@/components/shell/useSavedChoice"
import type { ComparePageData } from "@/lib/compare"
import type { PageContext } from "@/lib/page-context"
import { setFamilyScoring } from "@/lib/scoring-actions"

const SECTION_IDS: readonly CompareSection[] = COMPARE_SECTIONS.map((s) => s.id)

/** der Rückweg zur Scheibe A, wenn sie geladen ist (eigene, sichtbare); sonst führt der Umschalter oben zurück */
function backToCard(data: ComparePageData): Route | null {
  return data.backCard
    ? {
        page: "card",
        id: data.backCard,
        origin: null,
        selection: null,
        shot: null,
        scoring: null,
        anchor: null,
      }
    : null
}

/**
 * Seite Vergleichen: oben der Umschalter „Zeitraum · Vergleichen“, der Kopf mit Art, Familie, den Seiten A und B und der
 * Wertung, dann die Antwort als Satz und im Raster der Seite das Bild beider Seiten neben der Tabelle aller Zahlen und
 * der Grundlage. Bei zwei Zeiträumen darunter Verlauf und Werte wie im Fortschritt (A gegen B), mit Sprungleiste. Jede
 * Wahl ist eine neue Adresse, der Server rechnet neu; bis dahin wird die Seite leiser.
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
  // die Scheibe, die das Lineal im Verlauf zeigt; nur auf dieser Seite, nicht in der Adresse. Eine andere Menge der
  // Scheiben (Zeiträume, Art, Einschießen, Wertung) hängt den Verlauf neu ein und beginnt ohne Wahl
  const [chosen, setChosen] = useState<string | null>(null)
  const asked = data.query
  const chartKey =
    data.period && asked.type === "periods"
      ? [
          data.family,
          asked.kind,
          asked.includeWarmup,
          data.scoring,
          data.period.range.fromMs,
          data.period.range.toMs,
          data.period.compareRange?.fromMs ?? "",
          data.period.compareRange?.toMs ?? "",
        ].join(":")
      : ""
  const [seenChart, setSeenChart] = useState(chartKey)
  if (chartKey !== seenChart) {
    setSeenChart(chartKey)
    setChosen(null)
  }
  const active = useActiveSection(SECTION_IDS)
  // die Wertung der Familie wie im Fortschritt: sichtbar und umschaltbar, gespeichert für alle Übersichten
  const familyScoring = useSavedChoice({
    value: data.scoring,
    scope: data.family,
    save: (scoring) => setFamilyScoring(data.family, scoring),
    notSaved: "Die Wertung ließ sich nicht speichern.",
  })
  const { query, model, period } = data
  const go = (next: CompareQuery) =>
    startTransition(() =>
      router.push(urlFromRoute({ page: "compare", query: next }), { scroll: false })
    )
  const back = backToCard(data)
  const target = TARGETS[data.targetId]
  const sentence = model ? compareSentence(model) : null
  const close = () => setPicking(null)
  // Verlauf und Werte nur bei zwei Zeiträumen: Sie lesen das Modell des Fortschritts für A gegen B
  const withTrend = query.type === "periods" && period !== null

  return (
    <Page>
      {back && (
        <CardContextBar back={back} backText="Zur Scheibe" prev={null} next={null} paging={false} />
      )}
      <div className="grid gap-5">
        <ProgressSwitch
          current="compare"
          progress={{
            page: "progress",
            query: { ...DEFAULT_PROGRESS, family: data.family },
            section: null,
          }}
          compare={{ page: "compare", query }}
        />
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
          actions={
            <ScoringChip
              scoring={familyScoring.shown}
              texts={{ rings: "In ganzen Ringen", decimal: "In Zehnteln" }}
              label="Wertung"
              onChange={familyScoring.change}
            />
          }
        />
        {familyScoring.error && (
          <p role="alert" className="text-sm text-destructive">
            {familyScoring.error}
          </p>
        )}
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
                <p data-compare-sentence className="max-w-[46rem] text-[15px] leading-relaxed">
                  <b className="font-semibold">{sentence.lead}</b>
                  {sentence.more && (
                    <span className="text-foreground-2">{` ${sentence.more}`}</span>
                  )}
                </p>
              )}
              {model.a.cards > 0 && model.b.cards > 0 && (
                <>
                  {withTrend && <SectionNav active={active} sections={COMPARE_SECTIONS} />}
                  {/* wie Scheibe und Fortschritt: ab 768 px links das Bild, rechts die Zahlen */}
                  <div className={cn("grid gap-5", PAGE_COLUMNS)}>
                    <SectionBlock
                      section={{
                        id: "picture",
                        node: (
                          <div className="grid min-w-0 content-start gap-2">
                            <ComparePicture
                              picture={model.picture}
                              target={target}
                              label={sentence?.lead ?? ""}
                            />
                            <SideLegend a={model.a.name} b={model.b.name} />
                            <p className="text-[13px] text-muted-foreground">
                              {pictureLegend(model.picture)}
                            </p>
                          </div>
                        ),
                      }}
                    />
                    <SectionBlock
                      section={{
                        id: "numbers",
                        node: (
                          <div className="grid min-w-0 content-start gap-2">
                            <CompareTable model={model} onHelp={onHelp} />
                            <p data-compare-basis className="text-[13px] text-muted-foreground">
                              {basisText(model)}
                            </p>
                          </div>
                        ),
                      }}
                    />
                  </div>
                  {withTrend && period && (
                    <>
                      <SectionBlock
                        section={{
                          id: "history",
                          node: (
                            <div
                              data-compare-history
                              className="grid min-w-0 gap-3 rounded-2xl border border-border bg-card p-3.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <h2 className="font-display text-base font-bold">Verlauf</h2>
                                <HelpButton
                                  label="Verlauf und Form"
                                  helpId="verlauf-und-form"
                                  onClick={() => onHelp("verlauf-und-form")}
                                />
                              </div>
                              <ChartSlot height={300}>
                                {(width) => (
                                  <PeriodChart
                                    key={chartKey}
                                    width={width}
                                    model={period}
                                    timeZone={context.timeZone}
                                    chosen={chosen}
                                    onChoose={setChosen}
                                    // A und B in den Farben von Bild und Legende darüber
                                    colors={SIDE_COLORS}
                                  />
                                )}
                              </ChartSlot>
                            </div>
                          ),
                        }}
                      />
                      <SectionBlock
                        last
                        section={{
                          id: "values",
                          node: (
                            <PeriodTiles
                              tiles={period.tiles}
                              compareLabel={period.compareRange?.label ?? null}
                              onHelp={(key) => {
                                const id = helpForMetric(key)?.id
                                if (id) onHelp(id)
                              }}
                            />
                          ),
                        }}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {query.type === "cards" ? (
        <CardChoiceSheet
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
