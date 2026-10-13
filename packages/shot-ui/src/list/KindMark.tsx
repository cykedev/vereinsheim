import { Trophy } from "lucide-react"

import type { CardKind } from "../period/model"

/** voller Name der Art, für Screenreader, Titel und Namen von Links */
export const KIND_TEXT: Readonly<Record<CardKind, string>> = {
  training: "Training",
  competition: "Wettkampf",
  probe: "Training nur Probe",
}

/**
 * Art einer Scheibe in einer Zeile der Listen (U3, D7) statt der Kürzel W, T, P: Wettkampf als goldener Pokal (wie der
 * Kreis der Art, Plan `plans/2026-10-13-spiegel-symbole.md`), Training ohne
 * Zeichen (das Übliche), Training nur aus Probe als Wort „Probe“. Den vollen Namen hört der Screenreader.
 */
export function KindMark({ kind }: { kind: CardKind }) {
  // der Name als Tooltip am sichtbaren Zeichen, das Screenreader übergehen: sie hören ihn einmal (Review U3)
  return (
    <span data-kind={kind}>
      {kind !== "training" && (
        <span aria-hidden="true" title={KIND_TEXT[kind]}>
          {kind === "competition" ? (
            <Trophy className="inline size-4 align-[-3px] text-gold" />
          ) : (
            "Probe"
          )}
        </span>
      )}
      <span className="sr-only">{KIND_TEXT[kind]}</span>
    </span>
  )
}
