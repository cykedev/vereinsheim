# @vereinsheim/ingest-contract — Claude Scope-Notiz

Vertrag zwischen Brücke und Spiegel (SP-1.0a, Oktober 2026): Snapshot-Format v1, kanonische Form,
Prüfsumme, Testvektoren, eingefrorene Beispiele und der Parser, mit dem Spiegel Lieferungen annimmt.
Die Spezifikation für andere Sprachen (die Brücke, vermutlich Go) steht in
`vault/spiegel/spiegel-ingest-contract.md`. Noch nutzt keine App das Paket. Sonderfälle: SF-25, SF-26,
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

## Regeln

- **Nur additiv.** Bestehende Testvektoren (`test-vectors/`) und Beispiele (`examples/v<n>/`) werden
  nie geändert, nur ergänzt. Bricht ein Beispiel, ist die Änderung nicht additiv: dann neue
  Vertragsversion (`src/v2/`, Zweig in `parseSnapshot`), und Spiegel nimmt v1 weiter an (SF-69).
- **Testvektoren nicht mit dem eigenen Code erzeugen.** Sie stammen aus einer unabhängigen
  Implementierung; der TS-Code muss sie reproduzieren. Neue Vektoren ebenso (Python reicht, mit
  UTF-16-Sortierung über `s.encode("utf-16-be")`).
- **Zellwerte bleiben Text oder `null`** (MySQL-Textprotokoll). Keine Zahlen in `data`, sonst hängt die
  Prüfsumme an der Zahlenformatierung der jeweiligen Sprache.
- **Der Vertrag kennt keine Meyton-Spalten.** Spaltenprüfungen gehören in den Adapter (SP-1.6b), der in
  Quarantäne legt statt abzulehnen (SF-25).
- **Annehmen nur über `parseSnapshot`/`parseSnapshotBatch`**, nie direkt über `snapshotV1`: Davor
  liegen Versionsprüfung und das Verbot von `__proto__` (Zod verwirft den Schlüssel still), danach die
  Prüfsumme. Längen zählen in UTF-16-Codeeinheiten (Zod), nicht in Codepoints (JSON-Schema).
- **Fehler ohne Inhalt** (SF-59): `ContractIssue` ist nur `{ path, code }`, Pfade enden an `columns` und
  `rows[i]`. Zod-Meldungen nie nach außen geben.
- **JSON-Schema wird erzeugt**, nie von Hand editiert: `pnpm --filter @vereinsheim/ingest-contract
schema`; ein Test hält es gleich. Das Tool liegt bewusst unter `tools/` (nicht `scripts/`, das ist im
  Autopilot geschützt).
- Sonderzeichen in Tests aus Codeeinheiten bauen (`String.fromCharCode`), nicht als `\u`-Escape im
  Quelltext: Beim Schreiben über Werkzeuge wurden solche Escapes schon zu Rohzeichen dekodiert.
- `zod` und `tsx` kamen über einen Handeintrag in `pnpm-lock.yaml` dazu; `pnpm add` hätte Peer-Varianten
  der Apps neu aufgelöst (`vault/conventions.md` §9). Danach `pnpm install --frozen-lockfile`.
- Läuft nur auf dem Server (`node:crypto`). Nach Änderungen: `pnpm check`.
