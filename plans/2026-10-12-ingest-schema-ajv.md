# JSON-Schema des Vertrags mit ajv prüfen

## Kontext

Offener Einzelpunkt der Spiegel-Roadmap: Für `packages/ingest-contract/schema/*.json` ist nur belegt, dass die Datei
dem Zod-Export entspricht. Ob ein fremder Validator (wie ihn die Brücke nutzt) das Schema liest und die Beispiele
annimmt, prüft niemand.

## Entscheidungen

- **ajv 8 mit Draft 2020-12, `strict`, `ajv-formats`**: Versionen aus der Lockfile (8.20.0, 3.0.1), über den
  Catalog als devDependency des Pakets.
- **Feste Aufteilung der ungültigen Fälle:** Was JSON-Schema ausdrücken kann, muss ajv ablehnen; die übrigen neun
  (Zeilenschlüssel, Surrogate, UTF-16-Länge, `__proto__`, Prüfsumme) stehen als Liste im Test und entsprechen der
  `description` des Schemas.

## Aufgaben

1. `ajv`, `ajv-formats` in Catalog und `package.json`, `pnpm install`.
2. `src/jsonSchema.test.ts`: Beispiele einzeln und als Lieferung gültig, ungültige Fälle nach Aufteilung.
3. Doku: `packages/ingest-contract/CLAUDE.md`, [[spiegel-ingest-contract]], Punkt in der Roadmap streichen.

## Prüfung

`pnpm check` (46/46). Gegenprobe: Schema mit `additionalProperties: true` auf der Hülle lässt den Test fallen.
