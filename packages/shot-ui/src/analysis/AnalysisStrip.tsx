"use client"

import { cn } from "@vereinsheim/lib/utils"
import { JUMP_BAR } from "@vereinsheim/ui/design2/bar"
import { Segmented } from "@vereinsheim/ui/design2/segmented"

/**
 * Streifen der Reiter einer Analyse, der klebt: auf dem Telefon über der Sprungleiste (nie zwei Leisten), ab 768 px
 * unter ihr; die Leiste ist eine Zeile, die in sich seitlich scrollt, statt die Seite zu verbreitern. Für die Scheibe
 * und den Zeitraum.
 */
export function AnalysisStrip<T extends string>({
  value,
  options,
  onChange,
  controls,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  /** Id des Bereichs, den die Reiter steuern */
  controls: string
}) {
  return (
    <div
      data-analysis-strip
      className={cn(
        "sticky top-0 z-30 flex",
        JUMP_BAR.height,
        "items-center bg-background max-md:-mx-4 max-md:px-4",
        JUMP_BAR.mdTop,
        "md:z-10"
      )}
    >
      <Segmented
        label="Thema"
        value={value}
        options={options}
        onChange={onChange}
        controls={controls}
        scroll
      />
    </div>
  )
}
