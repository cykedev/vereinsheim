import { Trophy } from "lucide-react"

import type { CardKind } from "../period/model"

/** voller Name der Art, für Screenreader, Titel und Namen von Links */
export const KIND_TEXT: Readonly<Record<CardKind, string>> = {
  training: "Training",
  competition: "Wettkampf",
  probe: "Training nur Probe",
}

/**
 * Art einer Scheibe in einer Zeile der Listen (U3, D7) statt der Kürzel W, T, P: Wettkampf als Pokal, Training ohne
 * Zeichen (das Übliche), Training nur aus Probe als Wort „Probe“. Den vollen Namen hört der Screenreader.
 */
export function KindMark({ kind }: { kind: CardKind }) {
  return (
    <>
      {kind === "competition" && (
        <Trophy aria-hidden="true" className="inline size-3.5 align-[-2px] text-foreground-2" />
      )}
      {kind === "probe" && <span aria-hidden="true">Probe</span>}
      <span className="sr-only">{KIND_TEXT[kind]}</span>
    </>
  )
}
