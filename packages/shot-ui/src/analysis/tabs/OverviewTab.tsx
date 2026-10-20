"use client"

import { READING_GUIDE } from "@vereinsheim/shot-help/guide"
import { helpTopic } from "@vereinsheim/shot-help/lookup"
import { cn } from "@vereinsheim/lib/utils"

import { observations } from "../observations"
import { ObservationSymbol } from "../ObservationSymbol"
import { HelpButton } from "../../help/HelpButton"
import { JUMP_BAR } from "@vereinsheim/ui/design2/bar"
import { overviewTiles } from "../overview"
import { AnalysisCard, CaseSafe, Disclosure, Note } from "../parts"
import type { CardContext, CardSpec } from "./index"

/** Überblick: acht Kacheln, Beobachtungen in Worten und der Einstieg „So liest du die Analyse“ (anfangs zu) */
export function overviewCards({ input, explain, onHelp }: CardContext): CardSpec[] {
  const tiles = overviewTiles(input)
  const sentences = observations(input)
  return [
    {
      key: "tiles",
      wide: true,
      element: (
        // vier Spalten nach der Breite des Kartenbereichs, nicht des Fensters
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border @min-[36rem]:grid-cols-4">
          {tiles.map((tile) => {
            const short = helpTopic(tile.help)?.short
            return (
              <div
                key={tile.label}
                data-tile={tile.label}
                title={short}
                className="grid min-w-0 content-start gap-1 bg-card px-4 py-3.5"
              >
                {/* „?“ an jeder Kachel: der Überblick ist die Zahlen-Ansicht der Seite */}
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    <CaseSafe text={tile.label} />
                  </span>
                  {onHelp && (
                    <HelpButton
                      label={tile.label}
                      helpId={tile.help}
                      onClick={() => onHelp(tile.help)}
                    />
                  )}
                </div>
                <span
                  className={cn(
                    "font-display text-[1.6rem] leading-tight font-bold tabular-nums",
                    tile.value === null && "text-muted-foreground"
                  )}
                >
                  {tile.value ?? "–"}
                  {tile.unit && (
                    <small className="ml-1.5 font-sans text-[13px] font-medium text-muted-foreground">
                      {tile.unit}
                    </small>
                  )}
                </span>
                <span className="text-[12.5px] leading-snug text-muted-foreground">
                  {tile.hint}
                </span>
                {explain && short && (
                  <span data-short className="text-[12.5px] leading-snug text-foreground-2">
                    {short}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ),
    },
    {
      key: "beobachtungen",
      wide: true,
      element: (
        // Ziel von „Alle Beobachtungen“ im Kopf: unter der klebenden Reiterleiste (Telefon) bzw. Sprung- und
        // Reiterleiste (ab 768 px)
        <AnalysisCard
          help="beobachtungen"
          tag="aus den Zahlen"
          explain={explain}
          onHelp={onHelp}
          className={cn(JUMP_BAR.scrollMargin, JUMP_BAR.mdScrollMarginTwo)}
        >
          {sentences.length ? (
            <ul className="grid gap-2.5 text-[14px] leading-relaxed">
              {sentences.map((sentence) => (
                <li key={sentence.icon} data-observation={sentence.icon} className="flex gap-2.5">
                  <ObservationSymbol icon={sentence.icon} />
                  <span>{sentence.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Note>Ab drei Wertungsschüssen gibt es hier Sätze statt Zahlen.</Note>
          )}
        </AnalysisCard>
      ),
    },
    {
      key: "einstieg",
      wide: true,
      element: (
        // anfangs zu wie Glossar und Fehlschlüsse
        <Disclosure data-guide-card="true" summary="So liest du die Analyse">
          <ul className="mt-3 grid gap-2 text-[13.5px] leading-relaxed text-foreground-2 [&_b]:font-semibold [&_b]:text-foreground">
            {READING_GUIDE.map((item) => (
              <li key={item.title} data-guide="true">
                <b>{`${item.title}.`}</b>
                {` ${item.text}`}
              </li>
            ))}
            <li data-guide="true">
              <b>Jede Karte erklärt sich</b>
              {
                " über ihr „?“. Den Kurzsatz an jeder Karte und Kachel zeigt der Schalter „Erklärungen“."
              }
            </li>
          </ul>
        </Disclosure>
      ),
    },
  ]
}
