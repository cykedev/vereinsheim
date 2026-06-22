import { cn } from "@/lib/utils"
import type { PlayoffMatchItem } from "@/lib/playoffs/types"
import { SLOT_H, SLOT_W, WINNER_STYLE, type SlotPreview } from "./constants"

export function BracketSlot({
  match,
  preview,
}: {
  match?: PlayoffMatchItem
  preview?: SlotPreview
}) {
  if (!match) {
    const hasPreview = preview?.nameA || preview?.nameB
    return (
      <div
        style={{ height: SLOT_H, width: SLOT_W }}
        className={cn("rounded-lg border border-dashed", hasPreview && "bg-card/50")}
      >
        {hasPreview ? (
          <div className="flex h-full flex-col divide-y divide-border/50">
            {([preview.nameA, preview.nameB] as const).map((name, i) => (
              <div key={i} className="flex flex-1 items-center px-2.5">
                <span className="min-w-0 truncate text-xs text-muted-foreground/40 italic">
                  {name ?? "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50">
            Ausstehend
          </div>
        )}
      </div>
    )
  }

  const nameA = `${match.participantA.firstName} ${match.participantA.lastName}`
  const nameB = `${match.participantB.firstName} ${match.participantB.lastName}`
  const winnerId =
    match.winsA > match.winsB
      ? match.participantA.id
      : match.winsB > match.winsA
        ? match.participantB.id
        : null

  return (
    <div
      style={{ height: SLOT_H, width: SLOT_W }}
      className={cn(
        "overflow-hidden rounded-lg border bg-card shadow-sm",
        match.status === "COMPLETED" && "border-muted"
      )}
    >
      <div className="flex h-full flex-col divide-y divide-border">
        {(
          [
            { name: nameA, wins: match.winsA, id: match.participantA.id },
            { name: nameB, wins: match.winsB, id: match.participantB.id },
          ] as const
        ).map(({ name, wins, id }) => {
          const isWinner = winnerId === id
          const style = WINNER_STYLE[match.round]
          return (
            <div
              key={id}
              className={cn(
                "flex flex-1 items-center justify-between gap-1 px-2.5",
                isWinner && style?.row
              )}
            >
              <span
                className={cn(
                  "min-w-0 truncate text-xs font-medium",
                  isWinner ? style?.text : "text-muted-foreground"
                )}
              >
                {name}
              </span>
              <span
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                  isWinner ? style?.badge : "text-muted-foreground"
                )}
              >
                {wins}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
