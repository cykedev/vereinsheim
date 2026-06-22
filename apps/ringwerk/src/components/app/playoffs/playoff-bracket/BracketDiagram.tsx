import type { PlayoffBracketData } from "@/lib/playoffs/types"
import { CONN_W, SLOT_W, type SlotPreview } from "./constants"
import type { BracketLayout } from "./geometry"
import { Connector, RoundCol } from "./BracketGrid"

const labelClass =
  "text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"

interface Props {
  bracket: PlayoffBracketData
  layout: BracketLayout
  isAF: boolean
  isVF: boolean
  qfPreviews: SlotPreview[]
  hfPreviews: SlotPreview[]
  finalPreview: SlotPreview
}

// Visuelles Bracket: Spaltenüberschriften + Slot-Zeilen mit Connectoren.
export function BracketDiagram({
  bracket,
  layout,
  isAF,
  isVF,
  qfPreviews,
  hfPreviews,
  finalPreview,
}: Props) {
  const { eighthFinals: af, quarterFinals: qf, semiFinals: hf, final: fin } = bracket
  const { totalH, afTops, qfTops, hfTops, finalTop, afQfPairs, qfHfPairs, hfFinalPairs } = layout

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Spaltenüberschriften */}
          <div className="mb-2 flex items-center">
            {isAF && (
              <>
                <div style={{ width: SLOT_W }} className={labelClass}>
                  Achtelfinale
                </div>
                <div style={{ width: CONN_W }} />
              </>
            )}
            {(isAF || isVF) && (
              <>
                <div style={{ width: SLOT_W }} className={labelClass}>
                  Viertelfinale
                </div>
                <div style={{ width: CONN_W }} />
              </>
            )}
            <div style={{ width: SLOT_W }} className={labelClass}>
              Halbfinale
            </div>
            <div style={{ width: CONN_W }} />
            <div style={{ width: SLOT_W }} className={labelClass}>
              Finale
            </div>
          </div>

          {/* Bracket-Zeilen */}
          <div className="flex items-start">
            {isAF && (
              <>
                <RoundCol
                  matches={Array.from({ length: 8 }, (_, i) => af[i])}
                  tops={afTops}
                  totalH={totalH}
                />
                <Connector height={totalH} pairs={afQfPairs} />
              </>
            )}
            {(isAF || isVF) && (
              <>
                <RoundCol
                  matches={Array.from({ length: 4 }, (_, i) => qf[i])}
                  tops={qfTops}
                  totalH={totalH}
                  previews={qfPreviews}
                />
                <Connector height={totalH} pairs={qfHfPairs} />
              </>
            )}
            <RoundCol
              matches={[hf.at(0), hf.at(1)]}
              tops={hfTops}
              totalH={totalH}
              previews={hfPreviews}
            />
            <Connector height={totalH} pairs={hfFinalPairs} />
            <RoundCol
              matches={[fin ?? undefined]}
              tops={[finalTop]}
              totalH={totalH}
              previews={[finalPreview]}
            />
          </div>
        </div>
      </div>
      {/* Scroll-Hinweis: rechter Fade-Schatten (nur auf Mobile sichtbar) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent md:hidden" />
    </div>
  )
}
