"use client"

import Link from "next/link"
import { useState } from "react"

import { formatSigned, formatValue } from "@vereinsheim/shot-ui/format"

import type { ExecutionResult } from "../analysis/execution"
import type { beforeAfter, expectedRows } from "../analysis/self-image"
import { stagePosition } from "../analysis/self-image"
import {
  ANALYSIS_TEXTS,
  executionBasis,
  executionCount,
  executionPill,
  executionSentence,
  expectedBasis,
  expectedMean,
} from "../analysis/texts"
import { ASPECT_LABELS } from "../scales"
import { dayLabel, resultText } from "../summaries"

import { PILL, PILL_BASE } from "./InfluenceLine"
import { BOX } from "./styles"

const TITLE = "text-[15px] font-semibold"
const QUIET = "text-[13px] text-muted-foreground"
const LINK =
  "cursor-pointer justify-self-start text-[13px] font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
/** so viele Einträge stehen zuerst, die übrigen hinter „Alle … zeigen“ */
export const FIRST_ROWS = 5

/** „Merkst du, wann eine Serie gut ist?“: Urteil, Zahl der Serien, Satz, Grundlage; ohne Bewertung der Leersatz */
export function ExecutionCard({ execution }: { execution: ExecutionResult & { rated: number } }) {
  const pill = executionPill(execution.comparison)
  const basis = executionBasis(execution.sameRated)
  return (
    <section
      data-execution
      aria-labelledby="execution-title"
      className={`${BOX} grid content-start gap-2`}
    >
      <h3 id="execution-title" className={TITLE}>
        {ANALYSIS_TEXTS.execution}
      </h3>
      {execution.rated === 0 ? (
        <p className="text-sm text-muted-foreground">{ANALYSIS_TEXTS.executionEmpty}</p>
      ) : (
        <>
          <span className="flex flex-wrap items-center gap-2">
            <span data-pill={pill.tone} className={`${PILL_BASE} ${PILL[pill.tone]}`}>
              {pill.text}
            </span>
            <span className={`${QUIET} tabular-nums`}>
              {executionCount(execution.series, execution.evenings)}
            </span>
          </span>
          <p className="text-sm text-foreground-2 tabular-nums">{executionSentence(execution)}</p>
          {basis && <p className={QUIET}>{basis}</p>}
        </>
      )}
    </section>
  )
}

/** Stellen einer Zeile: die der Wertung, mit Zehnteln in der Erwartung eine */
const digitsOf = (row: { expected: number; shot: { digits: number } }) =>
  Number.isInteger(row.expected) ? row.shot.digits : Math.max(1, row.shot.digits)

/** „Erwartet und geschossen“: die ersten fünf Einträge, dann alle; das Mittel; die Grundlage; leer der Leersatz */
export function ExpectedCard({
  expected,
  timeZone,
}: {
  expected: ReturnType<typeof expectedRows>
  timeZone: string
}) {
  const [all, setAll] = useState(false)
  const rows = all ? expected.rows : expected.rows.slice(0, FIRST_ROWS)
  const basis = expectedBasis(expected.left)
  const columns = ANALYSIS_TEXTS.expectedColumns
  return (
    <section
      data-expected
      aria-labelledby="expected-title"
      className={`${BOX} grid content-start gap-2`}
    >
      <h3 id="expected-title" className={TITLE}>
        {ANALYSIS_TEXTS.expected}
      </h3>
      {expected.rows.length === 0 && expected.left === 0 && (
        <p className="text-sm text-muted-foreground">{ANALYSIS_TEXTS.expectedEmpty}</p>
      )}
      {expected.rows.length > 0 && (
        <>
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-left text-[12px] text-muted-foreground">
                <th className="py-1 font-semibold">{columns.entry}</th>
                <th className="py-1 text-right font-semibold">{columns.expected}</th>
                <th className="py-1 text-right font-semibold">{columns.shot}</th>
                <th className="py-1 text-right font-semibold">{columns.delta}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.entryId}
                  data-expected-row={row.entryId}
                  className="border-t border-border"
                >
                  <td className="py-1.5">
                    <Link
                      href={`/diary/${row.entryId}`}
                      className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {dayLabel(row.day, timeZone)}
                    </Link>
                  </td>
                  <td className="py-1.5 text-right">{formatValue(row.expected, digitsOf(row))}</td>
                  <td className="py-1.5 text-right">
                    {resultText(row.shot).replace(/ Ringe$/, "")}
                  </td>
                  <td
                    data-delta={row.delta > 0 ? "up" : row.delta < 0 ? "down" : "even"}
                    className={`py-1.5 text-right font-semibold ${row.delta > 0 ? "text-success" : row.delta < 0 ? "text-warning" : ""}`}
                  >
                    {formatSigned(row.delta, digitsOf(row))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!all && expected.rows.length > FIRST_ROWS && (
            <button type="button" onClick={() => setAll(true)} className={LINK}>
              {ANALYSIS_TEXTS.showAll(expected.rows.length)}
            </button>
          )}
          {expected.mean !== null && (
            <p className="text-sm text-foreground-2 tabular-nums">
              {expectedMean(expected.mean, expected.rows.length)}
            </p>
          )}
        </>
      )}
      {basis && <p className={QUIET}>{basis}</p>}
    </section>
  )
}

/** Lage auf der Spur in Prozent: Stufe 1 links, 5 rechts */
const left = (value: number) => `${((stagePosition(value) - 1) / 4) * 100}%`

/** „Vorher und nachher“: je Bereich die Spur mit fünf Marken, vorher als Ring, nachher als Punkt */
export function BeforeAfter({ data }: { data: ReturnType<typeof beforeAfter> }) {
  return (
    <section
      data-before-after
      aria-labelledby="before-after-title"
      className={`${BOX} grid gap-3 md:col-span-2`}
    >
      <h3 id="before-after-title" className={TITLE}>
        {ANALYSIS_TEXTS.beforeAfter}
      </h3>
      {data.n === 0 ? (
        <p className="text-sm text-muted-foreground">{ANALYSIS_TEXTS.beforeAfterEmpty}</p>
      ) : (
        <>
          <p className={`${QUIET} flex flex-wrap items-center gap-x-4 gap-y-1`}>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-3 rounded-full border-2 border-dashed border-quiet"
              />
              {ANALYSIS_TEXTS.before}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-3 rounded-full bg-primary" />
              {ANALYSIS_TEXTS.after}
            </span>
            <span>{ANALYSIS_TEXTS.meanOf(data.n)}</span>
          </p>
          <ul className="grid gap-2">
            <li
              aria-hidden
              className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-[12px] text-muted-foreground tabular-nums"
            >
              <span />
              <span className="flex justify-between px-1.5">
                {[1, 2, 3, 4, 5].map((stage) => (
                  <span key={stage}>{stage}</span>
                ))}
              </span>
            </li>
            {data.rows.map((row) => (
              <li
                key={row.aspect}
                data-before-after-row={row.aspect}
                className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3"
              >
                <span className="text-sm">{ASPECT_LABELS[row.aspect]}</span>
                <span className="relative mx-1.5 h-6">
                  <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
                  {[0, 25, 50, 75, 100].map((p) => (
                    <span
                      key={p}
                      aria-hidden
                      className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-line-strong"
                      style={{ left: `${p}%` }}
                    />
                  ))}
                  {row.prognosis === null || row.feedback === null ? (
                    <span
                      data-no-pair
                      title={ANALYSIS_TEXTS.noPair}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-1.5 text-[12px] text-muted-foreground"
                    >
                      –<span className="ml-1">{ANALYSIS_TEXTS.noPair}</span>
                    </span>
                  ) : (
                    <>
                      <span
                        data-before={stagePosition(row.prognosis)}
                        aria-hidden
                        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-quiet bg-card"
                        style={{ left: left(row.prognosis) }}
                      />
                      <span
                        data-after={stagePosition(row.feedback)}
                        aria-hidden
                        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
                        style={{ left: left(row.feedback) }}
                      />
                      <span className="sr-only">
                        {`${ANALYSIS_TEXTS.before} ${formatValue(stagePosition(row.prognosis), 1)}, ${ANALYSIS_TEXTS.after} ${formatValue(stagePosition(row.feedback), 1)}`}
                      </span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
