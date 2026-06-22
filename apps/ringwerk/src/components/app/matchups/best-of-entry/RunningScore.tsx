interface Props {
  homeId: string
  awayId: string
  homeName: string
  awayName: string
  homeWins: number
  awayWins: number
  winnerId: string | null
}

// Laufender Spielstand (Sieger farblich hervorgehoben).
export function RunningScore({
  homeId,
  awayId,
  homeName,
  awayName,
  homeWins,
  awayWins,
  winnerId,
}: Props) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
      <span
        className={`min-w-0 flex-1 truncate text-sm font-medium ${winnerId === homeId ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      >
        {homeName}
      </span>
      <span className="shrink-0 text-lg font-bold tabular-nums">
        {homeWins} : {awayWins}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-right text-sm font-medium ${winnerId === awayId ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      >
        {awayName}
      </span>
    </div>
  )
}
