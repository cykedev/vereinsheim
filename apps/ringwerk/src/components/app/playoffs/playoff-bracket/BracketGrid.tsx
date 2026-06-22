import type { PlayoffMatchItem } from "@/lib/playoffs/types"
import { CONN_W, SLOT_W, type ConnectorPair, type SlotPreview } from "./constants"
import { BracketSlot } from "./BracketSlot"

export function Connector({ height, pairs }: { height: number; pairs: ConnectorPair[] }) {
  const mid = CONN_W / 2
  return (
    <svg
      width={CONN_W}
      height={height}
      style={{ display: "block", flexShrink: 0 }}
      className="text-border"
    >
      {pairs.map(({ in1, in2, out }, i) => (
        <g key={i} stroke="currentColor" strokeWidth={1} fill="none">
          <line x1={0} y1={in1} x2={mid} y2={in1} />
          <line x1={0} y1={in2} x2={mid} y2={in2} />
          <line x1={mid} y1={in1} x2={mid} y2={in2} />
          <line x1={mid} y1={out} x2={CONN_W} y2={out} />
        </g>
      ))}
    </svg>
  )
}

export function RoundCol({
  matches,
  tops,
  totalH,
  previews,
}: {
  matches: (PlayoffMatchItem | undefined)[]
  tops: number[]
  totalH: number
  previews?: (SlotPreview | undefined)[]
}) {
  return (
    <div className="relative shrink-0" style={{ width: SLOT_W, height: totalH }}>
      {matches.map((match, i) => (
        <div
          key={match?.id ?? `placeholder-${i}`}
          className="absolute left-0"
          style={{ top: tops[i] }}
        >
          <BracketSlot match={match} preview={previews?.[i]} />
        </div>
      ))}
    </div>
  )
}
