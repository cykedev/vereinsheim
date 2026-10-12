"use client"

import { KindSwitch } from "@vereinsheim/shot-ui/controls/KindSwitch"

import type { CardKind } from "@/generated/prisma/client"
import type { ActionResult } from "@/lib/types"

import { useSavedChoice } from "./useSavedChoice"

/**
 * Art der Scheibe umschalten und automatisch speichern (Seite einer Scheibe, Plan `plans/2026-10-12-spiegel-art.md`),
 * über `useSavedChoice`. Die Metazeile und die Vorgabe der Wertung folgen mit der Seite vom Server.
 */
export function KindControl({
  kind,
  save,
}: {
  kind: CardKind
  save: (kind: CardKind) => Promise<ActionResult>
}) {
  const { shown, change, error } = useSavedChoice(kind, save, "Die Art ließ sich nicht speichern.")
  return (
    <div className="grid gap-1.5">
      <KindSwitch kind={shown} onChange={change} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
