/**
 * Kanonische JSON-Serialisierung nach RFC 8785 (JSON Canonicalization Scheme, JCS).
 *
 * Brücke und Spiegel rechnen die Prüfsumme über diese Form, auch in verschiedenen Sprachen (SF-27).
 * Regeln: keine Leerzeichen; Objektschlüssel nach UTF-16-Codeeinheiten sortiert; Strings wie
 * `JSON.stringify` (escapet werden nur `"`, `\` und Steuerzeichen unter U+0020, alles andere bleibt
 * roh); Zahlen in der ES-Formatierung. Im gehashten Teil eines Snapshots kommen nur Strings, `null`,
 * Objekte und Arrays vor; die Zahlen sind da, damit sich die Funktion gegen RFC 8785 prüfen lässt.
 */

/** Vergleicht zwei Strings nach UTF-16-Codeeinheiten, wie RFC 8785 die Schlüssel sortiert. */
export function compareUtf16(a: string, b: string): number {
  // `<` vergleicht in JavaScript genau nach Codeeinheiten.
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function serializeString(value: string): string {
  if (!value.isWellFormed()) {
    throw new TypeError("String mit einzelnem Surrogat ist nicht kanonisierbar")
  }
  return JSON.stringify(value)
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Serialisiert einen JSON-Wert kanonisch. Wirft `TypeError` für alles, was kein JSON ist. */
export function canonicalize(value: unknown): string {
  if (value === null) return "null"
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false"
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError("Nur endliche Zahlen sind kanonisierbar")
      }
      return JSON.stringify(value)
    case "string":
      return serializeString(value)
    case "object":
      if (Array.isArray(value)) {
        // Array.from macht Lücken zu undefined, das wirft; map würde sie überspringen.
        return `[${Array.from(value, canonicalize).join(",")}]`
      }
      if (!isPlainObject(value)) {
        throw new TypeError("Nur einfache Objekte sind kanonisierbar")
      }
      return `{${Object.keys(value)
        .sort(compareUtf16)
        .map((key) => `${serializeString(key)}:${canonicalize(value[key])}`)
        .join(",")}}`
    default:
      throw new TypeError(`Typ ${typeof value} ist kein JSON-Wert`)
  }
}
