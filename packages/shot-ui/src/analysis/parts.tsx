"use client"

import { helpTopic } from "@vereinsheim/shot-help/lookup"
import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { HelpDetails, helpEntry } from "../help/HelpDetails"

// Gemeinsame Teile der Analyse-Karten (Spielwiese `card`, `kv`, `pill`, `note`, `intervalBar`, `scaleBar`).

export interface AnalysisCardProps {
  /** Erklärung aus `shot-help`: Thema (`helpTopic`) oder Oberfläche (`VIEW_HELP`); ohne keine Hilfe */
  help?: string
  /** Titel, wenn er nicht aus der Erklärung kommt */
  title?: string
  /** Katalog-IDs im Kopf; ohne Angabe die des Themas, mit „ · “ verbunden */
  ids?: string
  /** breite Karte: steht allein, nicht im Raster */
  wide?: boolean
  /** Schalter „Erklärungen“: „Was heißt das?“ offen */
  explain: boolean
  children: ReactNode
}

/** Eine Karte der Analyse: Kopf mit Titel und Katalog-IDs, Inhalt, darunter „Was heißt das?“ */
export function AnalysisCard({ help, title, ids, wide, explain, children }: AnalysisCardProps) {
  const topic = help ? helpTopic(help) : undefined
  const heading = title ?? (help ? helpEntry(help).title : "")
  const catalog = ids ?? (topic ? topic.catalog.join(" · ") : "")
  return (
    <article
      data-card={help}
      data-wide={wide || undefined}
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <h3
        title={topic?.short}
        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-display text-base leading-tight font-bold"
      >
        <span>{heading}</span>
        {catalog && (
          <span className="font-mono text-xs font-semibold tracking-wide text-muted-foreground">
            {catalog}
          </span>
        )}
      </h3>
      {children}
      {/* unten bündig, wenn die Karte im Raster höher ist als ihr Inhalt */}
      {help && <HelpDetails id={help} open={explain} className="mt-auto" />}
    </article>
  )
}

/** Werteliste: Bezeichnung und Wert je Zeile; leere Zeilen fallen weg */
export function KeyValues({
  rows,
}: {
  rows: readonly (readonly [string, ReactNode] | null | false)[]
}) {
  const shown = rows.filter((row): row is readonly [string, ReactNode] => !!row)
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
      {shown.flatMap(([label, value]) => [
        <dt key={`${label}:t`} className="text-muted-foreground">
          {label}
        </dt>,
        <dd key={`${label}:d`} className="min-w-0 font-semibold tabular-nums">
          {value}
        </dd>,
      ])}
    </dl>
  )
}

const TONES = {
  ok: "bg-success-wash text-success",
  warn: "bg-warning-wash text-warning",
  none: "bg-surface-2 text-muted-foreground",
} as const

/** Urteil des Fachkerns als Etikett: „belastbar“ (ok), „echt versetzt“ (warn), „unklar“ (none) */
export function Verdict({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <span
      data-verdict={tone}
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        TONES[tone]
      )}
    >
      {children}
    </span>
  )
}

/** Hinweis unter einem Wert oder Diagramm, zurückgenommen in voller `muted-foreground`-Farbe */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] leading-snug text-muted-foreground">{children}</p>
}

export interface IntervalBarProps {
  value: number
  low: number
  high: number
  min: number
  max: number
  /** Satz für Screenreader */
  label: string
}

const percent = (v: number, min: number, max: number) =>
  `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`

/** 95-%-Bereich als Balken mit dem gemessenen Wert als Punkt (Spielwiese `intervalBar`) */
export function IntervalBar({ value, low, high, min, max, label }: IntervalBarProps) {
  const left = percent(low, min, max)
  const right = percent(high, min, max)
  const width = `${parseFloat(right) - parseFloat(left)}%`
  return (
    <div role="img" aria-label={label} className="relative h-2.5 rounded-full bg-surface-2">
      <span
        data-range="true"
        className="absolute inset-y-0 rounded-full border border-primary bg-accent-wash"
        style={{ left, width }}
      />
      <span
        data-point="true"
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
        style={{ left: percent(value, min, max) }}
      />
    </div>
  )
}

const SCALE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]

/** Länge des Maßstabs in mm: der erste runde Wert ab einem Viertel der Spanne, höchstens 50 mm */
export const scaleStep = (spanMm: number) =>
  SCALE_STEPS.find((step) => step >= spanMm / 4) ?? SCALE_STEPS[SCALE_STEPS.length - 1]

/** Maßstab unten links in einem Diagramm (SVG-Gruppe, Pixel) */
export function ScaleBar({
  x,
  y,
  spanMm,
  pxPerMm,
}: {
  x: number
  y: number
  spanMm: number
  pxPerMm: number
}) {
  const step = scaleStep(spanMm)
  const length = step * pxPerMm
  return (
    <g data-scale={step}>
      <line x1={x} y1={y} x2={x + length} y2={y} stroke="var(--foreground-2)" strokeWidth={1.5} />
      <text
        x={x + length / 2}
        y={y - 5}
        textAnchor="middle"
        fontSize={11}
        fill="var(--muted-foreground)"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {`${step < 1 ? step.toFixed(1).replace(".", ",") : step} mm`}
      </text>
    </g>
  )
}

/** σ bleibt σ: In der Großschrift einer Beschriftung würde es sonst zu Σ */
export function CaseSafe({ text }: { text: string }) {
  const parts = text.split("σ")
  return (
    <>
      {parts.flatMap((part, i) =>
        i === 0
          ? [part]
          : [
              <span key={i} className="normal-case">
                σ
              </span>,
              part,
            ]
      )}
    </>
  )
}
