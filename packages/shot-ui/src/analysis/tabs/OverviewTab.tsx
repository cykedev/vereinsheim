"use client"

import { READING_GUIDE } from "@vereinsheim/shot-help/guide"
import { helpTopic } from "@vereinsheim/shot-help/lookup"
import { cn } from "@vereinsheim/lib/utils"

import { observations, type ObservationIcon } from "../observations"
import { overviewTiles } from "../overview"
import { AnalysisCard, CaseSafe, Note } from "../parts"
import type { CardContext, CardSpec } from "./index"

/** Symbole der Beobachtungen wie in der Spielwiese (24er-Raster, Linien) */
const ICONS: Readonly<Record<ObservationIcon, string[]>> = {
  position: [
    "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17",
    "M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4",
  ],
  spread: [
    "M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17",
    "M12 10.4a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2",
  ],
  outlier: [
    "M9.5 8a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11",
    "M19 3.2a1.8 1.8 0 1 0 0 3.6a1.8 1.8 0 1 0 0-3.6",
  ],
  trend: ["M3 16.5l5.5-5.5 4 4L20 7.5", "M14.5 7.5H20V13"],
  pause: ["M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17", "M10 9v6M14 9v6"],
  clock: ["M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17", "M12 7.5V12l3 2"],
  flag: ["M5.5 21V4h11l-2.2 4 2.2 4h-11"],
}

function ObservationSymbol({ icon }: { icon: ObservationIcon }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-0.5 size-[18px] shrink-0 text-primary"
    >
      {ICONS[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

/** Überblick: acht Kacheln, Beobachtungen in Worten und der Einstieg „So liest du die Analyse“ */
export function overviewCards({ input, explain }: CardContext): CardSpec[] {
  const tiles = overviewTiles(input)
  const sentences = observations(input)
  return [
    {
      key: "tiles",
      wide: true,
      element: (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {tiles.map((tile) => {
            const short = helpTopic(tile.help)?.short
            return (
              <div
                key={tile.label}
                data-tile={tile.label}
                title={short}
                className="grid min-w-0 content-start gap-1 bg-card px-4 py-3.5"
              >
                <span className="font-mono text-xs leading-snug font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  <CaseSafe text={tile.label} />
                </span>
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
        <AnalysisCard help="beobachtungen" ids="aus den Zahlen" explain={explain}>
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
        <AnalysisCard title="So liest du die Analyse" ids="Hilfe" explain={explain}>
          <ul className="grid gap-2 text-[13.5px] leading-relaxed text-foreground-2 [&_b]:font-semibold [&_b]:text-foreground">
            {READING_GUIDE.map((item) => (
              <li key={item.title} data-guide="true">
                <b>{`${item.title}.`}</b>
                {` ${item.text}`}
              </li>
            ))}
            <li data-guide="true">
              <b>Jede Karte erklärt sich</b>
              {" unter „Was heißt das?“; alle auf einmal öffnet der Schalter „Erklärungen“."}
            </li>
          </ul>
        </AnalysisCard>
      ),
    },
  ]
}
