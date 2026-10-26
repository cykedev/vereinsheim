// Protokoll zwischen der App und dem Kindprozess, der einen Ausdruck liest (`reader-child.ts`): Der Kindprozess meldet
// sich mit `READY_LINE`, bekommt die Bytes über stdin und antwortet mit genau einer Zeile JSON nach
// `childResultSchema`. Die App traut der Zeile nicht und prüft sie.

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

export const childResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    pages: z.number().int(),
    id: idSchema,
    createdAt: createdAtSchema,
    maxRssKb: z.number(),
  }),
  z.object({ ok: z.literal(false), code: z.enum(MEYTON_PDF_ERROR_CODES), maxRssKb: z.number() }),
])

export type ChildResult = z.infer<typeof childResultSchema>
