"use client"

import { helpTopic } from "@vereinsheim/shot-help/lookup"
import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { formatValue } from "../format"
import { HelpButton, HelpIcon } from "../help/HelpButton"
import { helpEntry } from "../help/HelpDetails"

// Gemeinsame Teile der Analyse-Karten (Spielwiese `card`, `kv`, `pill`, `note`, `intervalBar`, `scaleBar`).

export interface AnalysisCardProps {
  /** Erklärung aus `shot-help`: Thema (`helpTopic`) oder Oberfläche (`VIEW_HELP`); ohne keine Hilfe */
  help?: string
  /** Titel, wenn er nicht aus der Erklärung kommt */
  title?: string
  /** kleiner Zusatz im Kopf, etwa „aus den Zahlen“; keine Katalog-IDs, die interessieren nicht (User, 9. Oktober 2026) */
  tag?: string
  /** breite Karte: steht allein, nicht im Raster */
  wide?: boolean
  /** Schalter „Erklärungen“: der Kurzsatz steht sichtbar unter dem Titel */
  explain: boolean
  /** „?“ im Kopf öffnet die Erklärung als Blatt (Plan Schritt 4, D3); ohne kein „?“ */
  onHelp?: (id: string) => void
  children: ReactNode
}

/** Eine Karte der Analyse: Kopf mit Titel, Zusatz und „?“, mit „Erklärungen“ der Kurzsatz, dann Inhalt */
export function AnalysisCard({
  help,
  title,
  tag,
  wide,
  explain,
  onHelp,
  children,
}: AnalysisCardProps) {
  const topic = help ? helpTopic(help) : undefined
  const heading = title ?? (help ? helpEntry(help).title : "")
  return (
    <article
      data-card={help}
      data-wide={wide || undefined}
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          title={topic?.short}
          className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-display text-base leading-tight font-bold"
        >
          <span>{heading}</span>
          {tag && <span className="text-xs font-semibold text-muted-foreground">{tag}</span>}
        </h3>
        {help && onHelp && (
          <HelpButton label={heading} helpId={help} onClick={() => onHelp(help)} />
        )}
      </div>
      {explain && topic && (
        <p data-short="true" className="text-[12.5px] leading-snug text-foreground-2">
          {topic.short}
        </p>
      )}
      {children}
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

/**
 * Aufklappbarer Kasten der Analyse (Einstieg, Glossar, Fehlschlüsse): anfangs zu, die Zeile mit „?“-Symbol
 * öffnet ihn. `data-*` kommt an den Kasten, für Prüfungen.
 */
export function Disclosure({
  summary,
  children,
  ...data
}: { summary: string; children: ReactNode } & { [key: `data-${string}`]: string }) {
  return (
    <details {...data} className="rounded-2xl border border-border bg-card p-4">
      <summary className="inline-flex cursor-pointer list-none items-center gap-[7px] text-[13px] font-semibold text-primary [&::-webkit-details-marker]:hidden">
        <HelpIcon />
        {summary}
      </summary>
      {children}
    </details>
  )
}

/** Zusatz neben einem Wert in einer Zeile von `KeyValues`, zurückgenommen */
export function Muted({ children }: { children: ReactNode }) {
  return <span className="font-normal text-muted-foreground">{children}</span>
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

// ohne Spanne (alle Treffer in einem Punkt) liegt alles am Anfang
const percent = (v: number, min: number, max: number) =>
  max > min ? `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%` : "0%"

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
        fill="var(--muted-foreground)"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {`${formatValue(step, step < 1 ? 1 : 0)} mm`}
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
