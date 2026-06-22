import { cn } from "@/lib/utils"
import type { PlayoffMatchItem } from "@/lib/playoffs/types"
import { PlayoffMatchCard } from "../PlayoffMatchCard"
import type { PlayoffCardConfig } from "../playoff-match-card"

interface Props {
  title: string
  matches: PlayoffMatchItem[]
  canManage: boolean
  config: PlayoffCardConfig
}

export function RoundDetail({ title, matches, canManage, config }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div
        className={cn(
          "grid gap-4",
          matches.length > 2 && "sm:grid-cols-2",
          matches.length === 1 && "max-w-xs mx-auto sm:max-w-sm"
        )}
      >
        {matches.map((m) => (
          <PlayoffMatchCard key={m.id} match={m} canManage={canManage} config={config} />
        ))}
      </div>
    </div>
  )
}
