interface Props {
  rank: number
  /** false = neutral, auch auf Platz 1–3 — für Zeilen ohne Ergebnis (geteilter Platz vor dem ersten Schuss). */
  podium?: boolean
}

export function RankBadge({ rank, podium = true }: Props) {
  const base =
    "inline-flex w-[1.25rem] items-center justify-center rounded px-1 py-0.5 text-xs tabular-nums shrink-0"

  if (podium && rank === 1)
    return <span className={`${base} bg-rank-1/20 text-rank-1`}>{rank}</span>
  if (podium && rank === 2)
    return <span className={`${base} bg-rank-2/20 text-rank-2`}>{rank}</span>
  if (podium && rank === 3)
    return <span className={`${base} bg-rank-3/20 text-rank-3`}>{rank}</span>
  return <span className={`${base} bg-muted text-muted-foreground`}>{rank}</span>
}
