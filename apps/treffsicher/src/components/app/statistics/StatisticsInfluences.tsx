"use client"

import { formatSigned, formatValue } from "@vereinsheim/shot-ui/format"
import { countOf } from "@vereinsheim/shot-ui/period/words"
import { verdictText } from "@vereinsheim/shot-ui/period/sentence"

import {
  INFLUENCE_LABELS,
  influenceVerdict,
  type Influence,
  type InfluenceGroup,
} from "@/lib/statistics/influences"
import { SESSION_WORDS } from "@/lib/statistics/words"

function GroupLine({ label, group }: { label: string; group: InfluenceGroup }) {
  return (
    <p className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 text-[13px]">
      <span className="text-foreground-2">{label}</span>
      <span className="tabular-nums">
        <span className="font-semibold">
          {group.mean === null ? "–" : formatValue(group.mean, 2)}
        </span>
        <span className="text-muted-foreground">{` · ${countOf(group.n, SESSION_WORDS)}`}</span>
      </span>
    </p>
  )
}

/**
 * Reiter „Einflüsse“: je Merkmal eine Karte mit dem Ø je Schuss der hohen und der niedrigen Gruppe und dem Urteil,
 * gerechnet auf dem Server (`influences`).
 */
export function StatisticsInfluences({ rows }: { rows: readonly Influence[] }) {
  return (
    <section aria-label="Einflüsse" className="@container grid gap-4">
      <div className="grid min-w-0 gap-1">
        <h2 className="font-display text-xl font-bold tracking-tight">Einflüsse</h2>
        <p className="text-[13px] text-muted-foreground">
          Ø je Schuss an Tagen mit hohem gegen niedrigen Wert, im gewählten Zeitraum.
        </p>
      </div>
      <div className="grid gap-3 @min-[40rem]:grid-cols-2">
        {rows.map((row) => {
          const labels = INFLUENCE_LABELS[row.key]
          const verdict = influenceVerdict(row, (c) => verdictText(c, "higher", SESSION_WORDS))
          return (
            <article
              key={row.key}
              data-influence={row.key}
              className="grid content-start gap-2 rounded-2xl border border-border bg-card p-4"
            >
              <h3 className="font-display text-base font-bold">{labels.name}</h3>
              {row.high.n + row.low.n > 0 && (
                <>
                  <GroupLine label={labels.high} group={row.high} />
                  <GroupLine label={labels.low} group={row.low} />
                </>
              )}
              <p data-influence-verdict className="text-[13px] font-semibold">
                {verdict}
                {row.comparison?.test && (
                  <span className="font-normal text-muted-foreground tabular-nums">
                    {` · Δ ${formatSigned(row.comparison.delta, 2)}`}
                  </span>
                )}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
