// Protokoll zwischen der App und dem Kindprozess, der einen Ausdruck liest (`reader-child.ts`): Der Kindprozess meldet
// sich mit `READY_LINE`, bekommt die Bytes über stdin und antwortet mit einer Zeile JSON nach `childResultSchema` (ID und
// Druckzeit), danach, wenn sie gelesen sind, mit einer Zeile nach `valuesLineSchema` (die Werte). Die App traut keiner
// Zeile und prüft sie. ID und Druckzeit gelten auch, wenn die Werte scheitern oder der Kindprozess dabei beendet wird:
// pdf.js baut die Zeichnung eines präparierten PDFs sekundenlang am Stück, ohne die Zeit zu prüfen.

import { MEYTON_PDF_ERROR_CODES } from "@vereinsheim/meyton-pdf/errors"
import { z } from "zod"

export const READY_LINE = '{"ready":true}'

// die ID landet in Dateinamen und `footerId`, die Ortszeit in der Rechnung der Druckzeit: nur in der Form, die das Paket
// liefert
const HEX = z.string().regex(/^[0-9a-f]{8}$/)
const LOCAL = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)

const idSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("found"),
    hex: HEX,
    value: z.number().int(),
    pages: z.array(z.number().int()),
  }),
  z.object({ kind: z.literal("missing") }),
  z.object({ kind: z.literal("conflict"), hexes: z.array(HEX) }),
])

const createdAtSchema = z
  .object({
    local: LOCAL,
    offsetMinutes: z.number().int().nullable(),
    epochMs: z.number().int().nullable(),
    source: z.enum(["info", "xmp"]),
  })
  .nullable()

// ── Werte ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Grenzen der Lesung; ein echter Ausdruck bleibt weit darunter */
export const READING_LIMITS = {
  shots: 200,
  series: 20,
  pictures: 21,
  holesPerPicture: 200,
  rings: 20,
  discipline: 80,
  stand: 8,
} as const

const finite = z.number().finite()
const tenths = z.number().int().min(0).max(109)
const point = z.object({ x: finite, y: finite })
const centerMm = z.object({ x: finite, y: finite }).nullable()
const spread = z
  .object({ overall: finite, horizontal: finite.nullable(), vertical: finite.nullable() })
  .nullable()
const teiler = z
  .array(z.object({ value: finite, shot: z.number().int() }))
  .max(10)
  .nullable()
const layout = z.enum(["ghostscript", "qt", "unknown"])
const discipline = z.string().max(READING_LIMITS.discipline).nullable()

export const readingSchema = z.object({
  layout,
  discipline,
  stand: z.string().max(READING_LIMITS.stand).nullable(),
  probe: z.boolean(),
  shots: z
    .array(
      z.object({
        series: z.number().int().min(1).max(READING_LIMITS.series).nullable(),
        decimalTenths: tenths,
        innerTen: z.boolean(),
      })
    )
    .min(1)
    .max(READING_LIMITS.shots),
  series: z
    .array(
      z.object({
        number: z.number().int().min(1).max(READING_LIMITS.series),
        shots: z.number().int().min(1).max(READING_LIMITS.shots),
        rings: z.number().int().min(0),
        decimalTenths: z.number().int().min(0),
        centerMm,
        hitCircleMm: finite.nullable(),
        spread,
        bestTeiler: teiler,
      })
    )
    .max(READING_LIMITS.series),
  total: z
    .object({ rings: z.number().int().min(0), decimalTenths: z.number().int().min(0) })
    .nullable(),
  centerMm,
  hitCircleMm: finite.nullable(),
  spread,
  bestTeiler: teiler,
  widestTeiler: teiler,
  pictures: z
    .array(
      z.object({
        centerPt: point,
        ringDiametersPt: z.array(finite).max(READING_LIMITS.rings),
        holesPt: z.array(point).max(READING_LIMITS.holesPerPicture),
      })
    )
    .max(READING_LIMITS.pictures),
})

export const valuesSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ok"), reading: readingSchema }),
  z.object({
    kind: z.literal("rejected"),
    layout,
    problem: z.enum([
      "empty",
      "mode",
      "shotValue",
      "series",
      "sums",
      "innerTens",
      "counts",
      "marks",
      "teilerRefs",
    ]),
    discipline,
  }),
  z.object({ kind: z.literal("failed"), code: z.enum(MEYTON_PDF_ERROR_CODES) }),
])

export type ValuesRead = z.infer<typeof valuesSchema>

/** der Erzeuger im Info-Dict, gekürzt; nur für das Layout */
export const PRODUCER_MAX = 80

// ── Antwort ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export const childResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    pages: z.number().int(),
    id: idSchema,
    createdAt: createdAtSchema,
    producer: z.string().max(PRODUCER_MAX).nullable(),
    maxRssKb: z.number(),
  }),
  z.object({ ok: z.literal(false), code: z.enum(MEYTON_PDF_ERROR_CODES), maxRssKb: z.number() }),
])

export type ChildResult = z.infer<typeof childResultSchema>

/** zweite Zeile: die Werte, für sich geprüft (`valuesSchema`) */
export const valuesLineSchema = z.object({ values: z.unknown(), maxRssKb: z.number() })

export type ValuesLine = { values: ValuesRead; maxRssKb: number }
