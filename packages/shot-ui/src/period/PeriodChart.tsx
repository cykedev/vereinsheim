"use client"

import type { CardValue } from "@vereinsheim/shot-core/analysis"
import {
  formatDateOnly,
  formatIsoDate,
  formatMonthShort,
  zonedDayStartMs,
} from "@vereinsheim/lib/format"
import { useMemo } from "react"

import {
  RULER_HINT,
  RulerMark,
  RulerReadout,
  useRuler,
  ValuesTable,
} from "../analysis/charts/ChartRuler"
import { ChartSvg, crisp, niceStep } from "../analysis/charts/frame"
import { SideLegend } from "../compare/ComparePicture"
import { formatSigned, formatValue, unitText } from "../format"
import type { PeriodModel } from "./model"
import { usePeriodWords } from "./PeriodWords"
import { countOf } from "./words"

const HEIGHT = 240
const PAD = { left: 44, right: 14, top: 14, bottom: 26 }
/** „je Monat“: Platz für den Monat und die Zahl der Scheiben unter der Achse */
const PAD_MONTHS_BOTTOM = 40
/** mit Vergleich: zwei Zeilen Monate unter der Achse, oben die des Zeitraums, darunter die des Vergleichs */
const PAD_COMPARE_BOTTOM = 42

export type PeriodChartModel = Pick<
  PeriodModel,
  | "values"
  | "trend"
  | "months"
  | "view"
  | "compareValues"
  | "range"
  | "compareRange"
  | "metric"
  | "cards"
  | "deltas"
  | "compareCards"
  | "compareTrend"
>

export interface PeriodChartProps {
  width: number
  model: PeriodChartModel
  timeZone: string
  /** gewählte Scheibe der Seite (Liste, Ablesung) */
  chosen: string | null
  /** das Lineal wählt eine Scheibe (null: keine), ohne Umschalten (Aktion „pick“) */
  onChoose: (id: string | null) => void
  /**
   * Farben der Seiten: `a` der Zeitraum (Punkte, Linie, Band, Monate), `b` der Vergleich (Punkte, Linie, Monate). Vorgabe:
   * die Farbe der App und ein leises Grau. Vergleichen gibt die Farben seines Bilds mit (`SIDE_COLORS`)
   */
  colors?: { a: string; b: string }
}

const COLORS = { a: "var(--primary)", b: "var(--muted-foreground)" }

const path = (points: readonly (readonly [number, number])[]) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("")

/** Monatsanfänge von `fromMs` bis `toMs` in der Zeitzone */
export function monthStarts(fromMs: number, toMs: number, timeZone: string): number[] {
  const [y, m] = formatIsoDate(new Date(fromMs), timeZone).split("-").map(Number)
  const starts: number[] = []
  for (let k = 1; k < 400; k++) {
    const month = new Date(Date.UTC(y, m - 1 + k, 1))
    const iso = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}-01`
    const at = zonedDayStartMs(iso, timeZone)
    if (at >= toMs) break
    starts.push(at)
  }
  return starts
}

/**
 * Verlauf über viele Scheiben: „je Scheibe“ ein Punkt je Scheibe über dem Datum (Wettkampf mit
 * Ring, nur Probe hohl), der Schnitt der letzten fünf als Linie (gestrichelt, solange „bisher“) und das Formband
 * als Fläche; „je Monat“ Median und P10–P90 je Monat (T5); mit Vergleich beide Zeiträume übereinander auf der Zeit
 * seit ihrem Beginn, jeder in seiner Farbe wie im Bild der Seite Vergleichen, unter der Achse die Monate beider
 * Zeiträume, ohne Band. Das Lineal wählt in „je Scheibe“ und im Vergleich eine Scheibe, „je Monat“ liest es nur ab;
 * darunter „Werte als Tabelle“. Ohne zwei Werte ein Satz statt des Diagramms.
 */
export function PeriodChart({
  width,
  model,
  timeZone,
  chosen,
  onChoose,
  colors = COLORS,
}: PeriodChartProps) {
  const words = usePeriodWords()
  const { values, trend, months, metric, range, compareRange } = model
  const compare = compareRange ? model.compareValues : null
  const mode: "cards" | "months" | "compare" = compare ? "compare" : model.view
  const digits = metric.decimals
  const unit = unitText(metric.unit)
  const show = (v: number) => `${formatValue(v, digits)}${unit ? ` ${unit}` : ""}`
  const kinds = useMemo(
    () => new Map([...model.cards, ...(model.compareCards ?? [])].map((c) => [c.id, c])),
    [model.cards, model.compareCards]
  )
  const compareTrend = compare ? (model.compareTrend?.points ?? []) : []

  const padBottom =
    mode === "months" ? PAD_MONTHS_BOTTOM : mode === "compare" ? PAD_COMPARE_BOTTOM : PAD.bottom
  const plotW = Math.max(1, width - PAD.left - PAD.right)
  // die Zeit seit dem Beginn des eigenen Zeitraums; mit Vergleich so lang wie der längere der beiden
  const span =
    mode === "compare" && compareRange
      ? Math.max(range.toMs - range.fromMs, compareRange.toMs - compareRange.fromMs)
      : range.toMs - range.fromMs
  const xSince = (ms: number, fromMs: number) =>
    PAD.left + ((ms - fromMs) / Math.max(1, span)) * plotW
  const xTime = (ms: number) => xSince(ms, range.fromMs)
  const xMonth = (i: number) => PAD.left + ((i + 0.5) / Math.max(1, months.length)) * plotW
  // die Punkte beider Seiten in der Folge auf der Achse: Lineal, Tastatur und Ablesung gehen über diese Liste
  const points: { value: CardValue; side: "a" | "b"; x: number }[] =
    mode === "months"
      ? []
      : [
          ...values.map((value) => ({ value, side: "a" as const, x: xTime(value.atMs) })),
          ...(compare && compareRange
            ? compare.map((value) => ({
                value,
                side: "b" as const,
                x: xSince(value.atMs, compareRange.fromMs),
              }))
            : []),
        ].sort((p, q) => p.x - q.x)
  const xs = mode === "months" ? months.map((_, i) => xMonth(i)) : points.map((p) => p.x)
  const preset =
    mode === "months" || chosen === null ? -1 : points.findIndex((p) => p.value.id === chosen)
  const enough =
    mode === "months" ? months.length >= 1 : (mode === "compare" ? points : values).length >= 2

  // y über alles, was gezeichnet wird: Werte, Band, Vergleich, Monatsspannen; vor dem Lineal, das die Höhen der
  // Punkte braucht
  const domain: number[] =
    mode === "months"
      ? months.flatMap((m) => [m.median, m.p10, m.p90].filter((v): v is number => v !== null))
      : [
          ...values.map((v) => v.value),
          // das Band nur, wo es gezeichnet wird
          ...(mode === "cards"
            ? trend.points.flatMap((p) => (p.band ? [p.band.low, p.band.high] : []))
            : []),
          ...(compare ?? []).map((v) => v.value),
        ]
  const lo = Math.min(...domain)
  const hi = Math.max(...domain)
  const step = niceStep(Math.max(hi - lo, 10 ** -digits), 4)
  const yMin = Math.floor((lo - (hi - lo) * 0.08) / step) * step
  const yMax = Math.ceil((hi + (hi - lo) * 0.08) / step) * step || yMin + step
  const y = (v: number) =>
    PAD.top + ((yMax - v) / Math.max(1e-9, yMax - yMin)) * (HEIGHT - PAD.top - padBottom)

  // das Lineal wählt eine Scheibe („je Scheibe“ und Vergleich), „je Monat“ liest es nur ab; stehen Scheiben
  // übereinander (eines Abends, im Vergleich auch beider Zeiträume), entscheiden die Höhen
  const ruler = useRuler(
    xs,
    width,
    preset < 0 ? null : preset,
    (i) => {
      if (mode !== "months") onChoose(i === null ? null : (points[i]?.value.id ?? null))
    },
    mode !== "months" && enough ? points.map((p) => y(p.value.value)) : undefined
  )

  if (!enough) {
    return (
      <p data-chart-empty className="text-[13px] text-muted-foreground">
        {`Für einen Verlauf braucht es zwei ${words.many} mit Wert.`}
      </p>
    )
  }
  const grid: number[] = []
  for (let v = yMin; v <= yMax + step / 2; v += step) grid.push(Number(v.toFixed(6)))
  const base = HEIGHT - padBottom

  const meanLine = (
    points: readonly { mean: number; partial: boolean }[],
    at: (i: number) => number
  ) => {
    const coords = points.map((p, i) => [at(i), y(p.mean)] as const)
    const firstFull = points.findIndex((p) => !p.partial)
    const partial = firstFull < 0 ? coords : coords.slice(0, firstFull + 1)
    const full = firstFull < 0 ? [] : coords.slice(firstFull)
    return { partial, full }
  }
  const lines = [
    { side: "a" as const, ...meanLine(trend.points, (i) => xTime(values[i].atMs)) },
    ...(compare && compareRange
      ? [
          {
            side: "b" as const,
            ...meanLine(compareTrend, (i) => xSince(compare[i].atMs, compareRange.fromMs)),
          },
        ]
      : []),
  ]
  const banded = trend.points.flatMap((p, i) => (p.band ? [{ p, x: xTime(values[i].atMs) }] : []))
  const bandPath =
    mode === "cards" && banded.length > 1
      ? `${path(banded.map(({ p, x }) => [x, y(p.band!.high)] as const))}${banded
          .slice()
          .reverse()
          .map(({ p, x }) => `L${x.toFixed(1)} ${y(p.band!.low).toFixed(1)}`)
          .join("")}Z`
      : null

  const sideName = (side: "a" | "b") => (side === "a" ? range.label : (compareRange?.label ?? ""))
  const date = (ms: number) => formatDateOnly(new Date(ms), timeZone)
  const cardText = (i: number) => {
    const { value: v, side } = points[i]
    const card = kinds.get(v.id)
    const kind = card?.kind === "competition" ? "Wettkampf · " : ""
    const lead = mode === "compare" ? `${sideName(side)} · ` : ""
    // derselbe Abstand wie in Liste und Ablesung: zu den Scheiben davor, ohne sie selbst
    const delta = model.deltas.get(v.id)
    const before = delta
      ? `${formatSigned(delta.delta, digits)} zum Schnitt ${delta.n === 1 ? `der ${words.one}` : `der ${delta.n} ${words.many}`} davor`
      : `erste ${words.one}`
    return `${lead}${date(v.atMs)} · ${kind}${show(v.value)} · ${before}`
  }
  const monthText = (i: number) => {
    const m = months[i]
    const spread =
      m.p10 === null
        ? m.floor === null && m.ceiling === null && metric.better === "none"
          ? `Spanne ab 5 ${words.many}`
          : `Boden und Decke ab 5 ${words.many}`
        : m.floor !== null && m.ceiling !== null
          ? `Boden ${formatValue(m.floor, digits)} · Decke ${formatValue(m.ceiling, digits)}`
          : `Spanne ${formatValue(m.p10, digits)} – ${formatValue(m.p90 as number, digits)}`
    // Alltagsworte wie auf der ersten Ebene: „Mitte“ ist der Median, das Blatt „?“ nennt ihn so
    return `${m.label} · ${countOf(m.n, words)} · Mitte ${formatValue(m.median, digits)} · ${spread}`
  }
  const index = ruler.index
  const text = index === null ? null : mode === "months" ? monthText(index) : cardText(index)
  const label =
    mode === "months"
      ? `${metric.label} je Monat`
      : mode === "compare"
        ? `${metric.label} je ${words.one}, ${range.label} und ${compareRange?.label ?? ""} übereinander, jeder ab seinem Beginn`
        : `${metric.label} je ${words.one} mit Schnitt der letzten fünf`

  // die Monate unter der Achse: ohne Vergleich eine Zeile, mit Vergleich je Zeitraum eine, jede an ihrer Stelle
  const monthRows =
    mode === "months"
      ? []
      : [
          {
            side: "a" as const,
            fromMs: range.fromMs,
            starts: monthStarts(range.fromMs, range.toMs, timeZone),
          },
          ...(mode === "compare" && compareRange
            ? [
                {
                  side: "b" as const,
                  fromMs: compareRange.fromMs,
                  starts: monthStarts(compareRange.fromMs, compareRange.toMs, timeZone),
                },
              ]
            : []),
        ]
  const tickEvery = Math.max(
    1,
    Math.ceil((Math.max(0, ...monthRows.map((row) => row.starts.length)) * 34) / plotW)
  )

  return (
    <div className="grid gap-2">
      {mode === "compare" && <SideLegend a={sideName("a")} b={sideName("b")} colors={colors} />}
      <RulerReadout text={text} />
      <ChartSvg
        width={width}
        height={HEIGHT}
        label={label}
        svgProps={{ ...ruler.svgProps, "aria-valuetext": text ?? RULER_HINT }}
      >
        {grid.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={crisp(y(v))}
              y2={crisp(y(v))}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="central">
              {formatValue(v, step < 1 ? Math.min(2, Math.max(digits, 1)) : 0)}
            </text>
          </g>
        ))}
        {bandPath && (
          <path data-band d={bandPath} fill={colors.a} fillOpacity={0.12} stroke="none" />
        )}
        {mode === "months" &&
          months.map((m, i) => (
            <g key={m.key} data-month={m.key}>
              {m.p10 !== null && m.p90 !== null && (
                <rect
                  data-month-span
                  x={xMonth(i) - 1.5}
                  y={y(m.p90)}
                  width={3}
                  height={Math.max(1, y(m.p10) - y(m.p90))}
                  rx={1.5}
                  fill={colors.a}
                  fillOpacity={0.45}
                />
              )}
              <circle
                cx={xMonth(i)}
                cy={y(m.median)}
                r={4.5}
                fill={colors.a}
                stroke="var(--shot-edge)"
              />
              <text x={xMonth(i)} y={HEIGHT - 22} textAnchor="middle">
                {formatMonthShort(new Date(m.atMs), timeZone)}
              </text>
              <text x={xMonth(i)} y={HEIGHT - 6} textAnchor="middle">
                {`${m.n}`}
              </text>
            </g>
          ))}
        {mode !== "months" && (
          <>
            {lines.map(({ side, partial, full }) => (
              <g key={side} data-mean-side={side}>
                {partial.length > 1 && (
                  <path
                    data-mean="partial"
                    d={path(partial)}
                    fill="none"
                    stroke={colors[side]}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    strokeLinejoin="round"
                  />
                )}
                {full.length > 1 && (
                  <path
                    data-mean="full"
                    d={path(full)}
                    fill="none"
                    stroke={colors[side]}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
              </g>
            ))}
            {points.map(({ value, side, x }, i) => {
              const card = kinds.get(value.id)
              const probeOnly = card?.probeOnly ?? false
              const competition = card?.kind === "competition"
              const picked = i === index
              const cy = y(value.value)
              const color = colors[side]
              return (
                <g
                  key={value.id}
                  data-card-point={side === "a" ? value.id : undefined}
                  data-compare-point={side === "b" ? value.id : undefined}
                  data-chosen={picked || undefined}
                >
                  {competition && (
                    <circle
                      data-competition
                      cx={x}
                      cy={cy}
                      r={7}
                      fill="none"
                      stroke="var(--foreground-2)"
                      strokeWidth={1}
                    />
                  )}
                  <circle
                    cx={x}
                    cy={cy}
                    r={picked ? 5 : 4}
                    fill={probeOnly ? "var(--card)" : color}
                    stroke={probeOnly ? color : "var(--shot-edge)"}
                    strokeWidth={probeOnly ? 1.5 : 1}
                  />
                </g>
              )
            })}
          </>
        )}
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={crisp(base)}
          y2={crisp(base)}
          stroke="var(--line-strong)"
          strokeWidth={1}
        />
        {monthRows.map((row, r) => {
          const rowY = mode === "compare" ? base + 12 + r * 17 : HEIGHT - 6
          return (
            <g key={row.side} data-month-row={mode === "compare" ? row.side : undefined}>
              {row.starts.map((at, i) =>
                i % tickEvery ? null : (
                  <g key={at}>
                    <line
                      x1={crisp(xSince(at, row.fromMs))}
                      x2={crisp(xSince(at, row.fromMs))}
                      y1={mode === "compare" ? rowY - 6 : base}
                      y2={mode === "compare" ? rowY + 6 : base + 4}
                      stroke={mode === "compare" ? colors[row.side] : "var(--line-strong)"}
                      strokeWidth={mode === "compare" ? 2 : 1}
                    />
                    <text
                      x={xSince(at, row.fromMs) + 3}
                      y={rowY}
                      dominantBaseline={mode === "compare" ? "central" : undefined}
                    >
                      {formatMonthShort(new Date(at), timeZone)}
                    </text>
                  </g>
                )
              )}
            </g>
          )
        })}
        {index !== null && <RulerMark x={xs[index]} top={PAD.top} bottom={base} />}
      </ChartSvg>
      <ValuesTable
        caption={label}
        columns={
          mode === "months"
            ? ["Monat", words.many, "Mitte", "Spanne von", "bis"]
            : mode === "compare"
              ? ["Datum", "Zeitraum", metric.label]
              : ["Datum", metric.label, "Linie: Schnitt der letzten fünf mit ihr"]
        }
        rows={
          mode === "months"
            ? months.map((m) => [
                m.label,
                String(m.n),
                formatValue(m.median, digits),
                m.p10 === null ? "–" : formatValue(m.p10, digits),
                m.p90 === null ? "–" : formatValue(m.p90, digits),
              ])
            : mode === "compare"
              ? [
                  ...values.map((v) => [date(v.atMs), sideName("a"), show(v.value)]),
                  ...(compare ?? []).map((v) => [date(v.atMs), sideName("b"), show(v.value)]),
                ]
              : values.map((v, i) => [
                  date(v.atMs),
                  show(v.value),
                  `${trend.points[i].partial ? "bisher " : ""}${formatValue(trend.points[i].mean, digits)}`,
                ])
        }
      />
    </div>
  )
}
