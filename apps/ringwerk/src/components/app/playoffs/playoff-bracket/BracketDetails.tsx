import type { PlayoffBracketData } from "@/lib/playoffs/types"
import type { PlayoffCardConfig } from "../playoff-match-card"
import { RoundDetail } from "./RoundDetail"

interface Props {
  bracket: PlayoffBracketData
  isAF: boolean
  isVF: boolean
  canManage: boolean
  config: PlayoffCardConfig
}

// Detailkarten je Runde (unter dem visuellen Bracket).
export function BracketDetails({ bracket, isAF, isVF, canManage, config }: Props) {
  const { eighthFinals: af, quarterFinals: qf, semiFinals: hf, final: fin } = bracket

  return (
    <div className="space-y-6">
      {isAF && af.length > 0 && (
        <RoundDetail title="Achtelfinale" matches={af} canManage={canManage} config={config} />
      )}
      {(isAF || isVF) && qf.length > 0 && (
        <RoundDetail title="Viertelfinale" matches={qf} canManage={canManage} config={config} />
      )}
      {hf.length > 0 && (
        <RoundDetail title="Halbfinale" matches={hf} canManage={canManage} config={config} />
      )}
      {fin && <RoundDetail title="Finale" matches={[fin]} canManage={canManage} config={config} />}
    </div>
  )
}
