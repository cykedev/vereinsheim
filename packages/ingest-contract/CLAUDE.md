# @vereinsheim/ingest-contract — Claude Scope-Notiz

Vertrag zwischen Brücke und Spiegel: Snapshot-Format v1, kanonische Form, Prüfsumme, Testvektoren,
eingefrorene Beispiele, der Parser, mit dem Spiegel Lieferungen annimmt, und die übrige API v1 (Kopplung,
Heartbeat, Zustand, Antworten, Fehler). Die Spezifikation für andere Sprachen (die
Brücke in Go, `apps/spiegel-bridge`) steht in `vault/spiegel/spiegel-ingest-contract.md`. Sonderfälle: SF-25, SF-26,
SF-27, SF-59, SF-69 in `vault/spiegel/spiegel-edge-cases.md`.

## Exporte

| Export                                   | Datei                | Inhalt                                                          |
| ---------------------------------------- | -------------------- | --------------------------------------------------------------- |
| `@vereinsheim/ingest-contract/snapshot`  | `src/v1/snapshot.ts` | Zod-Schemas `snapshotV1`, `snapshotBatchV1`, Typen, Fehlercodes |
| `@vereinsheim/ingest-contract/parse`     | `src/parse.ts`       | `parseSnapshot`, `parseSnapshotBatch` (Fehler ohne Inhalt)      |
| `@vereinsheim/ingest-contract/checksum`  | `src/checksum.ts`    | `computeChecksum`, `canonicalData`                              |
| `@vereinsheim/ingest-contract/canonical` | `src/canonical.ts`   | `canonicalize` (RFC 8785), `compareUtf16`                       |
| `@vereinsheim/ingest-contract/limits`    | `src/limits.ts`      | `LIMITS`                                                        |
| `@vereinsheim/ingest-contract/versions`  | `src/versions.ts`    | `CURRENT_CONTRACT_VERSION`, `SUPPORTED_CONTRACT_VERSIONS`       |
| `@vereinsheim/ingest-contract/api`       | `src/v1/api.ts`      | Kopplung, Heartbeat, Zustand, Antworten, Fehlercodes (API v1)   |
| `@vereinsheim/ingest-contract/sportpass` | `src/sportpass.ts`   | `sportpassHash(salt, id)` für die Liste der Zustimmungen        |

## Regeln

- **Nur additiv.** Bestehende Testvektoren (`test-vectors/`) und Beispiele (`examples/v<n>/`) werden
  nie geändert, nur ergänzt. Bricht ein Beispiel, ist die Änderung nicht additiv: dann neue
  Vertragsversion (`src/v2/`, Zweig in `parseSnapshot`), und Spiegel nimmt v1 weiter an (SF-69).
- **Testvektoren nicht mit dem eigenen Code erzeugen.** Sie stammen aus einer unabhängigen
  Implementierung; der TS-Code muss sie reproduzieren. Neue Vektoren ebenso (Python reicht, mit
  UTF-16-Sortierung über `s.encode("utf-16-be")`).
- **Zellwerte bleiben Text oder `null`** (MySQL-Textprotokoll). Keine Zahlen in `data`, sonst hängt die
  Prüfsumme an der Zahlenformatierung der jeweiligen Sprache.
- **Der Vertrag kennt keine Meyton-Spalten.** Spaltenprüfungen gehören in den Adapter
  (`apps/spiegel/src/lib/ingest/meyton-ssmdb2.ts`), der in Quarantäne legt statt abzulehnen (SF-25).
- **API v1 neben dem Snapshot** (`src/v1/api.ts`): Beispiele unter `examples/api-v1/` (Dateiname = Schema, nur
  ergänzen), JSON-Schemas mit, Anfragen über `parseApi(schema, input)` (Version, `__proto__`, Fehler ohne Inhalt).
  Vektoren des Sportpass-Hashes aus Python (`test-vectors/sportpass-v1.json`). Additiv ergänzt:
  `blocked[].epoch` im Zustand (optional, Spiegel schickt es immer): Eine Sperre gilt nur in ihrer Epoche (SF-23);
  `history` im Zustand (offene Aufträge zum Nachladen, Id und Hash) und `historyDone` im Heartbeat (nur Ids), beide
  optional; Status `clock`, Ergebnis `past`, `RETRY_OUTCOMES` und `BRIDGE_CLOCK_TOLERANCE_MS` (SF-79). Der Vektor
  `test-vectors/api-v1.json` (von Hand aus der Spezifikation) hält Endgültigkeit, Status und Schwelle für TypeScript und
  Go fest. Spielarten eines Beispiels heißen `<schema>.<art>.json` (`heartbeat.clock.json`). Additiv heißt hier nicht
  „in jeder Mischung verlustfrei“: `clock` braucht zuerst den neuen Spiegel (ein alter lehnt den Heartbeat ab, die
  Brücke misst dann ungeprüft weiter), ein verlustfreies `past` zuerst die neue Brücke (eine alte hält es für endgültig
  und holt den Stand erst beim nächsten Start nach).
- **Annehmen nur über `parseSnapshot`/`parseSnapshotBatch`**, nie direkt über `snapshotV1`: Davor
  liegen Versionsprüfung und das Verbot von `__proto__` (Zod verwirft den Schlüssel still), danach die
  Prüfsumme. Längen zählen in UTF-16-Codeeinheiten (Zod), nicht in Codepoints (JSON-Schema).
- **Fehler ohne Inhalt** (SF-59): `ContractIssue` ist nur `{ path, code }`, Pfade enden an `columns` und
  `rows[i]`. Zod-Meldungen nie nach außen geben.
- **JSON-Schema wird erzeugt**, nie von Hand editiert: `pnpm --filter @vereinsheim/ingest-contract
schema`; ein Test hält es gleich. Das Tool liegt bewusst unter `tools/` (nicht `scripts/`, das ist im
  Autopilot geschützt).
- **ajv prüft das geschriebene Schema unabhängig** (Draft 2020-12, strict, `src/jsonSchema.test.ts`):
  Beispiele gelten, ungültige Snapshots fallen. Was JSON-Schema nicht ausdrücken kann, steht als Liste
  `onlyParser` im Test; ein neuer ungültiger Fall gehört in eine der beiden Gruppen.
- Sonderzeichen in Tests aus Codeeinheiten bauen (`String.fromCharCode`), nicht als `\u`-Escape im
  Quelltext: Beim Schreiben über Werkzeuge werden solche Escapes zu Rohzeichen dekodiert.
- `zod` und `tsx` stehen per Handeintrag in `pnpm-lock.yaml`: `pnpm add` löst Peer-Varianten der Apps neu auf
  (`vault/conventions.md` §9). Nach einer Änderung dort `pnpm install --frozen-lockfile`.
- Läuft nur auf dem Server (`node:crypto`). Nach Änderungen: `pnpm check`.
