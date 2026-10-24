import { z } from "zod"

/**
 * Text mit Längengrenzen in UTF-16-Codeeinheiten, so wie `String.length` und die Brücke (Go) zählen. Zod zählt bei
 * `min` und `max` Codepoints wie JSON-Schema; `max` bleibt für das erzeugte Schema stehen, die eigene Prüfung hält die
 * engere Grenze des Vertrags und meldet wie Zod `too_big`.
 */
export function utf16Text(min: number, max: number) {
  const base = min > 0 ? z.string().min(min) : z.string()
  return base.max(max).superRefine((value, ctx) => {
    if (value.length > max) {
      ctx.addIssue({
        code: "too_big",
        origin: "string",
        maximum: max,
        inclusive: true,
        input: value,
      })
    }
  })
}
