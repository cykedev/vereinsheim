import { z } from "zod"

/**
 * Text mit Längengrenzen in UTF-16-Codeeinheiten, so wie `String.length` und die Brücke (Go) zählen. Zod zählt bei
 * `max` Codepoints wie JSON-Schema; die Grenze prüft deshalb nur die eigene Prüfung (ein Fehler `too_big` je Wert), ins
 * erzeugte Schema geht sie als `maxLength`. `min` darf Zod zählen: Leer ist in beiden Zählungen leer.
 */
export function utf16Text(min: number, max: number) {
  const base = min > 0 ? z.string().min(min) : z.string()
  return base
    .superRefine((value, ctx) => {
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
    .meta({ maxLength: max })
}
