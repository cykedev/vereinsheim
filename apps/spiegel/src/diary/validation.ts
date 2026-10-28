// Eingaben des Tagebuchs aus dem Browser, geprüft mit zod. Leere Texte sind „kein Wert“ (null), Zeilenumbrüche bleiben.

import { z } from "zod"

export const TEXT_MAX = 2000

/** ein Textfeld: am Rand ohne Leerraum, leer → null, höchstens 2.000 Zeichen */
export const textInput = z
  .string()
  .max(TEXT_MAX + 200)
  .transform((text) => text.replace(/\r\n/g, "\n").trim())
  .refine((text) => text.length <= TEXT_MAX, { message: "tooLong" })
  .transform((text) => (text === "" ? null : text))

/** die Felder mit Text an einem Eintrag */
export const TEXT_FIELDS = ["intention", "note", "learned", "question", "disturbed"] as const
export type TextField = (typeof TEXT_FIELDS)[number]

/**
 * das erwartete Ergebnis: „340“, „340,5“ oder „340.5“, höchstens eine Nachkommastelle, 0 bis 999,9 (bewusst
 * enger als `Decimal(5,1)`); leer → null. Ungültig → undefined
 */
export function parseExpectedScore(raw: string): number | null | undefined {
  const text = raw.trim()
  if (text === "") return null
  if (!/^\d{1,3}(?:[.,]\d)?$/.test(text)) return undefined
  return Number(text.replace(",", "."))
}

export const outcomeInput = z.enum(["yes", "partly", "no"]).nullable()
export const kindInput = z.enum(["shooting", "dry", "mental"])

/** ein Tag als ISO-Datum, das es gibt */
export const dayInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((day) => {
    const date = new Date(`${day}T12:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day
  })

/** der Tag als Datum der Spalte `@db.Date` (Mitternacht UTC) und zurück */
export const dateOfDay = (day: string) => new Date(`${day}T00:00:00.000Z`)
export const dayOfDate = (date: Date) => date.toISOString().slice(0, 10)
