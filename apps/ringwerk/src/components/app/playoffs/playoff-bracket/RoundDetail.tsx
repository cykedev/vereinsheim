import { cn } from "@vereinsheim/lib/utils"
import type { PlayoffMatchItem } from "@/lib/playoffs/types"
import { PlayoffMatchCard } from "../PlayoffMatchCard"
import { HelpMark } from "@/components/app/help/HelpMark"
import type { HelpTopicId } from "@/lib/help/topics"
import type { PlayoffCardConfig } from "../playoff-match-card"

interface Props {
  title: string
  matches: PlayoffMatchItem[]
  canManage: boolean
  config: PlayoffCardConfig
  /** Erklärung hinter dem „?“ an der Überschrift der Runde */
  help?: HelpTopicId
}

export function RoundDetail({ title, matches, canManage, config, help }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
        {help && <HelpMark id={help} className="ml-auto" />}
      </div>
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
