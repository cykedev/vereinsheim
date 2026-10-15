"use client"

import type { ReactNode, SVGProps } from "react"

import { useElementWidth } from "../../target/useAnimatedViewBox"

// Rahmen der Diagramme: SVG in Bildschirm-Pixeln, die Breite gemessen,
// ohne Messung (Server, Test) 600 px. Schrift der Achsen in Mono, Werte (`data-value`) kräftiger.

export const FALLBACK_WIDTH = 600

/** auf die Pixelmitte, damit eine 1-px-Linie scharf bleibt */
export const crisp = (v: number) => Math.round(v) + 0.5

/** runde Teilung der Achse: 1, 2, 2,5, 5 oder 10 mal einer Zehnerpotenz, für etwa `count` Schritte */
export function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count)
  const power = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * power >= raw) return m * power
  return 10 * power
}

/** Platz für ein Diagramm: misst die Breite und zeichnet mit ihr */
export function ChartSlot({
  height,
  children,
}: {
  height: number
  children: (width: number) => ReactNode
}) {
  const [measured, ref] = useElementWidth()
  const width = Math.round(measured) || FALLBACK_WIDTH
  return (
    // Tippen und Ziehen im Diagramm markiert keinen Text, auch kein langes Drücken auf dem Telefon
    <div
      ref={ref}
      className="w-full min-w-0 select-none [-webkit-touch-callout:none]"
      style={{ minHeight: height }}
    >
      {children(width)}
    </div>
  )
}

/** SVG eines Diagramms: Einheit = Pixel, Achsenschrift aus den Tokens; `svgProps` etwa für das Lineal */
export function ChartSvg({
  width,
  height,
  label,
  svgProps,
  children,
}: {
  width: number
  height: number
  label: string
  svgProps?: SVGProps<SVGSVGElement>
  children: ReactNode
}) {
  return (
    <svg
      {...svgProps}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role={svgProps?.role ?? "img"}
      aria-label={label}
      className="block h-auto w-full overflow-visible select-none font-mono text-xs font-medium [&_text]:fill-muted-foreground [&_text[data-value]]:fill-foreground-2 [&_text[data-value]]:font-semibold"
    >
      {children}
    </svg>
  )
}
