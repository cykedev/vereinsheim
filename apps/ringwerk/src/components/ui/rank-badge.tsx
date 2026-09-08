interface Props {
  rank: number
}

export function RankBadge({ rank }: Props) {
  const base =
    "inline-flex w-[1.25rem] items-center justify-center rounded px-1 py-0.5 text-xs tabular-nums shrink-0"

  if (rank === 1) return <span className={`${base} bg-rank-1/20 text-rank-1`}>{rank}</span>
  if (rank === 2) return <span className={`${base} bg-rank-2/20 text-rank-2`}>{rank}</span>
  if (rank === 3) return <span className={`${base} bg-rank-3/20 text-rank-3`}>{rank}</span>
  return <span className={`${base} bg-muted text-muted-foreground`}>{rank}</span>
}
