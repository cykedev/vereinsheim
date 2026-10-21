"use client"

import { periodTrend, type CardValue } from "@vereinsheim/shot-core/analysis"
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
import { formatSigned, formatValue, unitText } from "../format"
import type { PeriodModel } from "./model"
import { usePeriodWords } from "./PeriodWords"
import { countOf } from "./words"

const HEIGHT = 240
const PAD = { left: 44, right: 14, top: 14, bottom: 26 }
/** „je Monat“: Platz für den Monat und die Zahl der Scheiben unter der Achse */
const PAD_MONTHS_BOTTOM = 40

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
>

export interface PeriodChartProps {
  width: number
  model: PeriodChartModel
  timeZone: string
  /** gewählte Scheibe der Seite (Liste, Ablesung) */
  chosen: string | null
  /** das Lineal wählt eine Scheibe (null: keine), ohne Umschalten (Aktion „pick“) */
  onChoose: (id: string | null) => void
}

const path = (points: readonly (readonly [number, number])[]) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("")

/** Monatsanfänge von `fromMs` bis `toMs` in der Zeitzone */
function monthStarts(fromMs: number, toMs: number, timeZone: string): number[] {
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
 * als Fläche; „je Monat“ Median und P10–P90 je Monat (T5); mit Vergleich beide Zeiträume auf „Scheibe 1, 2, 3 …“,
 * der Vergleich hohl und grau, ohne Band. Das Lineal wählt in „je Scheibe“ die Scheibe der Seite, sonst liest es
 * nur ab; darunter „Werte als Tabelle“. Ohne zwei Werte ein Satz statt des Diagramms.
 */
export function PeriodChart({ width, model, timeZone, chosen, onChoose }: PeriodChartProps) {
  const words = usePeriodWords()
  const { values, trend, months, metric, range, compareRange } = model
  const compare = model.compareValues
  const mode: "cards" | "months" | "compare" = compare ? "compare" : model.view
  const digits = metric.decimals
  const unit = unitText(metric.unit)
  const show = (v: number) => `${formatValue(v, digits)}${unit ? ` ${unit}` : ""}`
  const kinds = useMemo(() => new Map(model.cards.map((c) => [c.id, c])), [model.cards])
  const compareTrend = useMemo(() => (compare ? periodTrend(compare).points : []), [compare])

  const padBottom = mode === "months" ? PAD_MONTHS_BOTTOM : PAD.bottom
  const plotW = Math.max(1, width - PAD.left - PAD.right)
  const n = mode === "compare" ? Math.max(values.length, compare?.length ?? 0) : 0
  const xTime = (ms: number) =>
    PAD.left + ((ms - range.fromMs) / Math.max(1, range.toMs - range.fromMs)) * plotW
  const xIndex = (i: number) => PAD.left + (n > 1 ? i / (n - 1) : 0.5) * plotW
  const xMonth = (i: number) => PAD.left + ((i + 0.5) / Math.max(1, months.length)) * plotW
  const xs =
    mode === "months"
      ? months.map((_, i) => xMonth(i))
      : mode === "compare"
        ? values.map((_, i) => xIndex(i))
        : values.map((v) => xTime(v.atMs))
  const preset =
    mode === "months" || chosen === null ? -1 : values.findIndex((v) => v.id === chosen)
  const enough = mode === "months" ? months.length >= 1 : values.length >= 2

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

  // das Lineal wählt die Scheibe der Seite (nur „je Scheibe“ und Vergleich), „je Monat“ liest es nur ab; die Höhen
  // entscheiden, wenn Scheiben eines Abends übereinander stehen
  const ruler = useRuler(
    xs,
    width,
    preset < 0 ? null : preset,
    (i) => {
      if (mode !== "months") onChoose(i === null ? null : (values[i]?.id ?? null))
    },
    mode === "months" || !enough ? undefined : values.map((v) => y(v.value))
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

  const pointsOf = (list: readonly CardValue[], at: (v: CardValue, i: number) => number) =>
    list.map((v, i) => [at(v, i), y(v.value)] as const)
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
  const atValue = (v: CardValue, i: number) => (mode === "compare" ? xIndex(i) : xTime(v.atMs))
  const line = meanLine(trend.points, (i) => atValue(values[i], i))
  const banded = trend.points.flatMap((p, i) => (p.band ? [{ p, x: atValue(values[i], i) }] : []))
  const bandPath =
    mode === "cards" && banded.length > 1
      ? `${path(banded.map(({ p, x }) => [x, y(p.band!.high)] as const))}${banded
          .slice()
          .reverse()
          .map(({ p, x }) => `L${x.toFixed(1)} ${y(p.band!.low).toFixed(1)}`)
          .join("")}Z`
      : null

  const date = (ms: number) => formatDateOnly(new Date(ms), timeZone)
  const cardText = (i: number) => {
    const v = values[i]
    const card = kinds.get(v.id)
    const kind = card?.kind === "competition" ? "Wettkampf · " : ""
    const lead = mode === "compare" ? `${words.one} ${i + 1} · ` : ""
    const other =
      mode === "compare" && compare?.[i] ? ` · im Vergleich ${show(compare[i].value)}` : ""
    // derselbe Abstand wie in Liste und Ablesung: zu den Scheiben davor, ohne sie selbst
    const delta = model.deltas.get(v.id)
    const before = delta
      ? `${formatSigned(delta.delta, digits)} zum Schnitt ${delta.n === 1 ? `der ${words.one}` : `der ${delta.n} ${words.many}`} davor`
      : `erste ${words.one}`
    return `${lead}${date(v.atMs)} · ${kind}${show(v.value)} · ${before}${other}`
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
        ? `${metric.label} je ${words.one}, ${range.label} gegen ${compareRange?.label ?? ""}`
        : `${metric.label} je ${words.one} mit Schnitt der letzten fünf`

  const monthTicks = mode === "cards" ? monthStarts(range.fromMs, range.toMs, timeZone) : []
  const tickEvery = Math.max(1, Math.ceil((monthTicks.length * 34) / plotW))
  const indexTicks: number[] = []
  if (mode === "compare") {
    const every = n > 30 ? 10 : 5
    for (let k = 1; k <= n; k++) if (k === 1 || k % every === 0) indexTicks.push(k)
  }

  return (
    <div className="grid gap-2">
      {mode === "compare" && (
        <div data-legend className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-foreground-2">
          <span className="inline-flex items-center gap-[7px]">
            <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5 shrink-0">
              <circle cx={7} cy={7} r={4} fill="var(--primary)" stroke="var(--shot-edge)" />
            </svg>
            {range.label}
          </span>
          <span className="inline-flex items-center gap-[7px]">
            <svg viewBox="0 0 14 14" aria-hidden="true" className="size-3.5 shrink-0">
              <circle
                cx={7}
                cy={7}
                r={4}
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
              />
            </svg>
            {compareRange?.label}
          </span>
        </div>
      )}
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
          <path data-band d={bandPath} fill="var(--primary)" fillOpacity={0.12} stroke="none" />
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
                  fill="var(--primary)"
                  fillOpacity={0.45}
                />
              )}
              <circle
                cx={xMonth(i)}
                cy={y(m.median)}
                r={4.5}
                fill="var(--primary)"
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
        {mode !== "months" && compare && (
          <g data-compare>
            <path
              d={path(compareTrend.map((p, i) => [xIndex(i), y(p.mean)] as const))}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinejoin="round"
            />
            {pointsOf(compare, (_, i) => xIndex(i)).map(([cx, cy], i) => (
              <circle
                key={compare[i].id}
                data-compare-point
                cx={cx}
                cy={cy}
                r={4}
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
              />
            ))}
          </g>
        )}
        {mode !== "months" && (
          <>
            {line.partial.length > 1 && (
              <path
                data-mean="partial"
                d={path(line.partial)}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeDasharray="4 4"
                strokeLinejoin="round"
              />
            )}
            {line.full.length > 1 && (
              <path
                data-mean="full"
                d={path(line.full)}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {pointsOf(values, atValue).map(([cx, cy], i) => {
              const card = kinds.get(values[i].id)
              const probeOnly = card?.probeOnly ?? false
              const competition = card?.kind === "competition"
              const picked = i === index
              return (
                <g
                  key={values[i].id}
                  data-card-point={values[i].id}
                  data-chosen={picked || undefined}
                >
                  {competition && (
                    <circle
                      data-competition
                      cx={cx}
                      cy={cy}
                      r={7}
                      fill="none"
                      stroke="var(--foreground-2)"
                      strokeWidth={1}
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={picked ? 5 : 4}
                    fill={probeOnly ? "var(--card)" : "var(--primary)"}
                    stroke={probeOnly ? "var(--primary)" : "var(--shot-edge)"}
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
        {monthTicks.map((at, i) =>
          i % tickEvery ? null : (
            <g key={at}>
              <line
                x1={crisp(xTime(at))}
                x2={crisp(xTime(at))}
                y1={base}
                y2={base + 4}
                stroke="var(--line-strong)"
                strokeWidth={1}
              />
              <text x={xTime(at) + 3} y={HEIGHT - 6}>
                {formatMonthShort(new Date(at), timeZone)}
              </text>
            </g>
          )
        )}
        {indexTicks.map((k) => (
          <text key={k} x={xIndex(k - 1)} y={HEIGHT - 6} textAnchor="middle">
            {k}
          </text>
        ))}
        {index !== null && <RulerMark x={xs[index]} top={PAD.top} bottom={base} />}
      </ChartSvg>
      <ValuesTable
        caption={label}
        columns={
          mode === "months"
            ? ["Monat", words.many, "Mitte", "Spanne von", "bis"]
            : mode === "compare"
              ? [words.one, range.label, compareRange?.label ?? ""]
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
              ? Array.from({ length: n }, (_, i) => [
                  String(i + 1),
                  values[i] ? show(values[i].value) : "–",
                  compare?.[i] ? show(compare[i].value) : "–",
                ])
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
