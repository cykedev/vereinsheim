import Link from "next/link"

import type { InfluenceRow } from "../analysis/influences"
import { ASPECT_WORDS, influencePill, influenceSentence, type Tone } from "../analysis/texts"

import { InfluenceStrip } from "./InfluenceStrip"

/** die Farbe einer Pille nach dem Urteil */
export const PILL: Readonly<Record<Tone, string>> = {
  better: "bg-success-wash text-success",
  worse: "bg-warning-wash text-warning",
  none: "bg-surface-2 text-muted-foreground",
}

export const PILL_BASE =
  "inline-flex items-center justify-self-start rounded-full px-2.5 py-0.5 text-[12px] font-semibold"

/**
 * Eine Zeile der Einflüsse, ganz ein Link auf die Seite des Merkmals: Name und Urteil, der Strich, der Satz. Am Desktop
 * stehen die drei nebeneinander.
 */
export function InfluenceLine({ row, href }: { row: InfluenceRow; href: string }) {
  const pill = influencePill(row.aspect, row.comparison)
  return (
    <Link
      href={href}
      data-influence={row.aspect}
      className="grid gap-2 rounded-xl px-2 py-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring md:grid-cols-[9rem_minmax(0,1fr)_15rem] md:items-center md:gap-4"
    >
      <span className="grid gap-1">
        <span className="text-[15px] font-semibold">{ASPECT_WORDS[row.aspect].name}</span>
        <span data-pill={pill.tone} className={`${PILL_BASE} ${PILL[pill.tone]}`}>
          {pill.text}
        </span>
      </span>
      <InfluenceStrip high={row.high.mean} low={row.low.mean} />
      <span className="text-sm text-foreground-2 tabular-nums">
        {influenceSentence(row.aspect, row)}
      </span>
    </Link>
  )
}
