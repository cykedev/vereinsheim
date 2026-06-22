interface Props {
  rank: number
}

export function RankBadge({ rank }: Props) {
  const base =
    "inline-flex w-[1.25rem] items-center justify-center rounded px-1 py-0.5 text-xs tabular-nums shrink-0"

  if (rank === 1)
    return (
      <span className={`${base} bg-amber-500/20 text-amber-700 dark:text-amber-400`}>{rank}</span>
    )
  if (rank === 2)
    return <span className={`${base} bg-gray-400/15 text-gray-500 dark:text-gray-400`}>{rank}</span>
  if (rank === 3)
    return (
      <span className={`${base} bg-orange-500/15 text-orange-700 dark:text-orange-400`}>
        {rank}
      </span>
    )
  return <span className={`${base} bg-muted text-muted-foreground`}>{rank}</span>
}
