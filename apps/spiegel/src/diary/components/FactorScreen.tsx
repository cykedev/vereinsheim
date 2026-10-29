"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { Page } from "@vereinsheim/ui/design2/page"

import type { FactorView } from "../analysis/queries"
import {
  ANALYSIS_TEXTS,
  ASPECT_WORDS,
  factorDelta,
  factorRow,
  factorSubline,
  influenceBasis,
  influencePill,
  signedDistance,
} from "../analysis/texts"
import { analysisHref } from "../paths"
import { stageOf } from "../scales"
import { dayLabel } from "../summaries"

import { PILL, PILL_BASE } from "./InfluenceLine"
import { InfluenceScatter } from "./InfluenceScatter"
import { InfluenceLegend } from "./InfluenceStrip"
import { BOX } from "./styles"

/** so viele Einträge stehen zuerst, die übrigen hinter „Alle … zeigen“ */
const FIRST_ROWS = 5

/**
 * Die Seite eines Merkmals: Rückweg in die Auswertung mit Disziplin und Zeitraum, Urteil und Abstand, die Punktwolke
 * und die Einträge, neueste oben; jede Zeile und jeder Punkt öffnet den Eintrag
 */
export function FactorScreen({ view, timeZone }: { view: FactorView; timeZone: string }) {
  const [all, setAll] = useState(false)
  const { row, aspect } = view
  const season = view.season ? view.season.from.slice(0, 4) : null
  const pill = influencePill(aspect, row.comparison)
  const points = [...row.points].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
  const shown = all ? points : points.slice(0, FIRST_ROWS)
  const basis = influenceBasis(view.left)
  return (
    <Page>
      <section data-factor-page={aspect} className={`grid gap-5 ${PAGE_SINGLE}`}>
        <Link
          href={analysisHref(view.family.slug, season)}
          className="inline-flex items-center gap-1.5 justify-self-start text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {ANALYSIS_TEXTS.back}
        </Link>
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            {ASPECT_WORDS[aspect].name}
          </h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {factorSubline(view.family.name, view.season?.label ?? ANALYSIS_TEXTS.all, row.entered)}
          </p>
        </div>
        <div className={`${BOX} grid gap-3`}>
          <span className="flex flex-wrap items-center gap-2">
            <span data-pill={pill.tone} className={`${PILL_BASE} ${PILL[pill.tone]}`}>
              {pill.text}
            </span>
            {row.comparison && (
              <span className="text-[13px] text-muted-foreground tabular-nums">
                {factorDelta(row.comparison.delta)}
              </span>
            )}
          </span>
          <InfluenceScatter row={row} timeZone={timeZone} />
          <InfluenceLegend
            high={ANALYSIS_TEXTS.legendAbove}
            low={ANALYSIS_TEXTS.legendBelow}
            form={ANALYSIS_TEXTS.legendForm}
          />
          <p className="text-[13px] text-muted-foreground">{ANALYSIS_TEXTS.scatterHint}</p>
        </div>
        {points.length > 0 && (
          <ul data-factor-entries className={`${BOX} grid divide-y divide-border py-1`}>
            {shown.map((point) => (
              <li key={point.entryId}>
                <Link
                  href={`/diary/${point.entryId}`}
                  data-factor-entry={point.entryId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-2.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="grid gap-0.5">
                    <span className="text-[15px] font-semibold tabular-nums">
                      {dayLabel(point.day, timeZone)}
                    </span>
                    <span className="text-[13px] text-foreground-2">
                      {factorRow(point.competition, aspect, stageOf(point.value))}
                    </span>
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${point.distance > 0 ? "text-success" : point.distance < 0 ? "text-warning" : "text-foreground-2"}`}
                  >
                    {signedDistance(point.distance)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!all && points.length > FIRST_ROWS && (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="cursor-pointer justify-self-start text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {ANALYSIS_TEXTS.showAll(points.length)}
          </button>
        )}
        {basis && <p className="text-[13px] text-muted-foreground">{basis}</p>}
      </section>
    </Page>
  )
}
