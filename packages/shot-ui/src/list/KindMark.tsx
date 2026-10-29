import { Trophy } from "lucide-react"

import type { CardKind } from "../period/model"

/** voller Name der Art, für Screenreader, Titel und Namen von Links */
export const KIND_TEXT: Readonly<Record<CardKind, string>> = {
  training: "Training",
  competition: "Wettkampf",
  probe: "Training nur Probe",
  "competition-probe": "Wettkampf nur Probe",
}

/** „Einschießen“ mit weichen Trennstellen: Die Spalte „Art“ bleibt am Telefon so schmal wie mit „Probe“ */
const WARMUP_WORD = "Ein\u00adschie\u00adßen"

/**
 * Art einer Scheibe in einer Zeile der Listen: Wettkampf als goldener Pokal (wie der Kreis der Art), Training ohne
 * Zeichen (das Übliche), nur aus Probe dahinter das Wort „Probe“, auch beim Wettkampf; Einschießen (immer nur Probe)
 * statt „Probe“ das Wort „Einschießen“, mit Trennstellen, damit die Spalte nicht breiter wird als mit „Probe“. Den
 * vollen Namen hört der Screenreader.
 */
export function KindMark({ kind, warmup = false }: { kind: CardKind; warmup?: boolean }) {
  const competition = kind === "competition" || kind === "competition-probe"
  const probe = kind === "probe" || kind === "competition-probe"
  // der Name als Tooltip am sichtbaren Zeichen, das Screenreader übergehen: sie hören ihn einmal
  return (
    <span data-kind={kind}>
      {kind !== "training" && (
        <span
          aria-hidden="true"
          title={warmup ? `${KIND_TEXT[kind]}, Einschießen` : KIND_TEXT[kind]}
        >
          {competition && <Trophy className="inline size-4 align-[-3px] text-gold" />}
          {competition && probe && " "}
          {probe && warmup ? <span data-warmup-word>{WARMUP_WORD}</span> : probe && "Probe"}
        </span>
      )}
      <span className="sr-only">
        {warmup ? `${KIND_TEXT[kind]}, Einschießen` : KIND_TEXT[kind]}
      </span>
    </span>
  )
}
