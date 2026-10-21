// Anordnung der Karten einer Analyse: für die Scheibe (`AnalysisPanel`) und den Zeitraum (`PeriodAnalysis`).

import type { ReactNode } from "react"

import type { CardSpec } from "./tabs"

/**
 * Breite Karten allein, Folgen schmaler Karten im Raster: zwei Spalten in Zeilen, sobald der Bereich der
 * Karten 820 px breit ist (Container, nicht Fenster: am Desktop steht die Analyse rechts neben der Scheibe),
 * beide Karten einer Zeile gleich hoch, eine einzelne Karte in der letzten Zeile über die volle Breite. Jeder
 * Abstand ist 16 px; getrennte Spalten ließen unter der kürzeren bis zu 360 px frei.
 */
export function layoutCards(
  cards: readonly Pick<CardSpec, "key" | "wide" | "element">[]
): ReactNode[] {
  const blocks: ReactNode[] = []
  let run: CardSpec[] = []
  const flush = () => {
    if (!run.length) return
    blocks.push(
      <div
        key={`run:${run[0].key}`}
        className="grid grid-cols-[minmax(0,1fr)] gap-4 @min-[820px]:grid-cols-2 @min-[820px]:[&>:last-child:nth-child(odd)]:col-span-2"
      >
        {run.map((card) => (
          <div key={card.key} className="grid min-w-0">
            {card.element}
          </div>
        ))}
      </div>
    )
    run = []
  }
  for (const card of cards) {
    if (card.wide) {
      flush()
      blocks.push(<div key={card.key}>{card.element}</div>)
    } else run.push(card)
  }
  flush()
  return blocks
}
