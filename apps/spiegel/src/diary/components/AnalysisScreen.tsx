import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { Page } from "@vereinsheim/ui/design2/page"

import type { AnalysisView } from "../analysis/queries"
import { ANALYSIS_TEXTS, influenceBasis } from "../analysis/texts"
import { factorHref, seasonKey } from "../paths"

import { AnalysisFilters } from "./AnalysisFilters"
import { DiaryHeader } from "./DiaryList"
import { DiaryHelp } from "./DiaryHelp"
import { InfluenceLine } from "./InfluenceLine"
import { InfluenceLegend, sharedStripSpan } from "./InfluenceStrip"
import { BeforeAfter, ExecutionCard, ExpectedCard } from "./SelfImage"
import { BOX } from "./styles"

const HEADING = "flex items-center gap-2 text-[17px] font-semibold"

/**
 * Die Auswertung im Tagebuch: Disziplin und Zeitraum, Einflüsse (je Merkmal eine Zeile) und Selbstbild (Ausführung,
 * erwartet und geschossen, vorher und nachher). Die Abschnitte stehen immer da, ohne Daten mit ihrem Leersatz.
 */
export function AnalysisScreen({ view, timeZone }: { view: AnalysisView; timeZone: string }) {
  const family = view.family?.slug ?? null
  const season = view.season ? seasonKey(view.season) : null
  const basis = influenceBasis(view.influences.left)
  const span = sharedStripSpan(view.influences.rows)
  return (
    <Page>
      <section data-analysis-page className={`grid gap-5 ${PAGE_SINGLE}`}>
        <DiaryHeader current="analysis" />
        <AnalysisFilters
          families={view.families}
          family={view.family}
          seasons={view.seasons.map((s) => ({ key: seasonKey(s), label: s.label }))}
          season={season}
        />

        <section data-influences aria-labelledby="influences-title" className="grid gap-3">
          <h2 id="influences-title" className={HEADING}>
            {ANALYSIS_TEXTS.influences}
            <DiaryHelp id="influences" />
          </h2>
          <div className={`${BOX} grid gap-2`}>
            {view.influences.withWellbeing === 0 ? (
              <p className="text-sm text-muted-foreground">{ANALYSIS_TEXTS.influencesEmpty}</p>
            ) : (
              <>
                <p className="text-sm text-foreground-2">
                  {ANALYSIS_TEXTS.influencesLead(view.influences.withWellbeing)}
                </p>
                <div className="grid divide-y divide-border">
                  {view.influences.rows.map((row) => (
                    <InfluenceLine
                      key={row.aspect}
                      row={row}
                      href={factorHref(row.aspect, family, season)}
                      span={span}
                    />
                  ))}
                </div>
                <InfluenceLegend
                  high={ANALYSIS_TEXTS.legendHigh}
                  low={ANALYSIS_TEXTS.legendLow}
                  form={ANALYSIS_TEXTS.legendForm}
                />
                {basis && (
                  <p data-influence-basis className="text-[13px] text-muted-foreground">
                    {basis}
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        <section data-self-image aria-labelledby="self-image-title" className="grid gap-3">
          <h2 id="self-image-title" className={HEADING}>
            {ANALYSIS_TEXTS.selfImage}
            <DiaryHelp id="selfImage" />
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <ExecutionCard execution={view.execution} />
            <ExpectedCard expected={view.expected} timeZone={timeZone} />
            <BeforeAfter data={view.beforeAfter} />
          </div>
        </section>
      </section>
    </Page>
  )
}
