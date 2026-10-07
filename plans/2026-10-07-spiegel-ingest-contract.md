# Plan: SP-1.0a Ingest-Vertrag mit Testvektoren

- **Roadmap:** `vault/spiegel/spiegel-roadmap.md`, SP-1.0 Schnitt a („Vertrag mit Testvektoren“)
- **Entscheidungen:** ADR-027 (Rohdaten unverändert, Snapshot je Scheibe mit Prüfsumme), ADR-029 (nur synthetische Daten)
- **Branch:** `feat/spiegel-ingest-contract`
- **Handoff-Datei:** dieser Plan wird als erster Schritt nach `plans/2026-10-07-spiegel-ingest-contract.md` übernommen und committet
- **Datum:** 2026-10-07

## 1. Context (warum)

Brücke und Spiegel brauchen einen festen Vertrag, bevor eine Seite Code dafür bekommt. Der Meilenstein „Durchstich“
(SP-1.0a → SP-1.4a/b → SP-1.6a/b) beginnt hier. Zwei Sonderfälle hängen direkt am Vertrag:

- **SF-27:** Rechnen Brücke und Spiegel die Prüfsumme verschieden, wirkt jede Lieferung neu, und Revisionen entstehen ohne
  Änderung. Die Brücke wird vermutlich in Go geschrieben (SP-0.4 noch offen), Spiegel in TypeScript. Deshalb braucht es eine
  kanonische Serialisierung, die in jeder Sprache gleich ausfällt, und Testvektoren als Daten, nicht nur als TS-Tests.
- **SF-69:** Brücken im Feld werden nicht gleichzeitig aktualisiert. Spiegel nimmt mindestens die Vorversion an, Änderungen am
  Vertrag sind nur additiv.

Ergebnis: das Paket `packages/ingest-contract` (`@vereinsheim/ingest-contract`) mit dem Snapshot-Format v1 (Zod + daraus
erzeugtes JSON-Schema), kanonischer Serialisierung, Prüfsumme, Testvektoren, Beispiel-Snapshots und einem Parser, der
Fehler ohne Inhalt meldet. Noch nutzt es keine App.

## 2. Entscheidungen

- **D1 Paket** `packages/ingest-contract`, Just-in-time wie `meyton-pdf`, Lizenz Apache-2.0. Einzige Laufzeit-Dependency
  ist `zod` aus dem Katalog (4.4.3). Hashing mit `node:crypto`: Das Paket läuft nur auf dem Server, nicht im Browser.
- **D2 Zellwerte sind Text oder `null`.** Jeder Wert steht so im Snapshot, wie MySQL ihn im Textprotokoll liefert (`"-7257056"`,
  `"0000-00-00 00:00:00"`, `"103.4"`). Gründe: verlustfrei (kein Float, kein ungültiges Datum, das ein Treiber umdeutet), Go mit
  `sql.RawBytes` liefert genau das, und im gehashten Teil gibt es keine Zahlen, deren Formatierung zwischen Sprachen abweichen
  könnte. Skalen und Typen deutet erst der Adapter (ADR-027).
- **D3 Format v1** (alle Objekte strikt, unbekannte Felder werden abgelehnt):
  ```
  Snapshot {
    contractVersion: 1
    source: "meyton-ssmdb2"
    sourceVersion: string | null      // Inhalt der Tabelle `Version`, falls lesbar
    epoch: int ≥ 1
    scheibenId: int32                 // Schlüssel für Routing und Idempotenz
    sequence: int ≥ 1 (safe integer)  // Folgenummer der Brücke, streng steigend (SF-26)
    observedAt: "YYYY-MM-DDTHH:mm:ss.sssZ"   // Beobachtungszeit, UTC
    sessionTimeZone: string           // @@session.time_zone der Brücke (SF-31)
    data: {
      scheiben: { columns: {Spalte: Typ}, rows: [Zeile] }   // genau eine Zeile
      serien:   { columns: {…}, rows: [Zeile, …] }
      treffer:  { columns: {…}, rows: [Zeile, …] }
    }
    checksum: "sha256:" + 64 Hex klein
  }
  Zeile = { Spalte: string | null }   // Schlüssel = genau die Spalten aus `columns`
  SnapshotBatch { snapshots: Snapshot[1..50] }
  ```
  `columns` ist die Spaltenliste von `SELECT *` mit dem Typ aus `information_schema.COLUMNS.COLUMN_TYPE` (`"int(11)"`,
  `"timestamp"`). So reisen unbekannte Spalten mit und ein Typwechsel wird sichtbar (SF-25, SF-31).
- **D4 Der Vertrag kennt keine Meyton-Spalten.** Er prüft nur die Form (Zeilenschlüssel = `columns`, genau eine Scheiben-Zeile,
  Grenzen). Ob `ScheibenID` in den Zeilen zur Hülle passt, ob Primärschlüssel eindeutig sind oder Spalten fehlen, prüft der
  Adapter in SP-1.6b und schickt die Rohdaten dann in Quarantäne statt sie abzulehnen (SF-25).
- **D5 Kanonische Serialisierung nach RFC 8785 (JCS):** keine Leerzeichen, Objektschlüssel nach UTF-16-Codeeinheiten sortiert,
  Strings nach JCS escapet (nur `"`, `\`, Steuerzeichen < U+0020; `/` und Nicht-ASCII bleiben roh, UTF-8). Die Funktion
  `canonicalize` beherrscht den ganzen JCS-Umfang (auch Zahlen über die ES-Formatierung), damit sie gegen die Beispiele aus
  RFC 8785 testbar ist; im gehashten Teil kommen aber nur Strings, `null`, Objekte und Arrays vor.
  Strings müssen wohlgeformt sein (keine einzelnen Surrogate), sonst ist der Snapshot ungültig.
- **D6 Prüfsumme** = `"sha256:" + hex(SHA-256(UTF-8(canonicalize(data'))))`, wobei `data'` = `data` mit Zeilen jeder Tabelle
  **sortiert nach ihrer kanonischen Form** (UTF-16-Codeeinheiten, wie die Schlüssel). Damit gilt:
  - Reihenfolge der Zeilen und der Spalten ändert die Prüfsumme nicht (`SELECT` ohne `ORDER BY` ist erlaubt).
  - Hülle (`sequence`, `observedAt`, `sessionTimeZone`, `epoch` …) geht **nicht** ein: Ein unveränderter Stand mit neuer
    Folgenummer hat dieselbe Prüfsumme, es entsteht keine Revision (SF-27). Additive Felder in der Hülle ändern alte
    Prüfsummen nie (SF-69).
  - Neue Spalte, anderer Typ oder anderer Wert ändern die Prüfsumme.
- **D7 Testvektoren als Daten:** `test-vectors/checksum-v1.json` mit je `name`, `description`, `data`, `canonical` (erwartete
  kanonische Form als String) und `checksum`. Die `canonical`-Strings sind von Hand nach den Regeln geschrieben, die Prüfsummen
  einmal extern berechnet (`printf '%s' … | shasum -a 256`), nicht mit dem eigenen Code. Fälle mindestens:
  Grundfall (eine Scheibe, zwei Serien, Probe + Wertung), Zeilen vertauscht, Spalten vertauscht (beide gleiche Prüfsumme wie
  Grundfall), `null`-Wert, Umlaute und `ß`, Emoji/Nicht-BMP-Zeichen in Wert **und** Spaltenname (UTF-16- gegen
  Codepoint-Sortierung, fängt die naive Python-/Go-Sortierung), Escapes (`"`, `\`, `\n`, `\u001f`, `/`, U+2028), leere Serien und
  Treffer, Zusatzspalte (andere Prüfsumme), geänderter Wert (andere Prüfsumme), geänderter Spaltentyp (andere Prüfsumme),
  negative ScheibenID und `0000-00-00 00:00:00` als Text.
  Dazu `test-vectors/invalid-v1.json`: Snapshots, die abgelehnt werden müssen (Zahl statt Text in einer Zelle, Zeile mit
  fehlender oder zusätzlicher Spalte, zwei Scheiben-Zeilen, falsche Prüfsumme, einzelnes Surrogat, unbekanntes Hüllenfeld,
  `contractVersion: 2`).
- **D8 Versionen (SF-69):** `SUPPORTED_CONTRACT_VERSIONS = [1]`, `CURRENT_CONTRACT_VERSION = 1`. `parseSnapshot` verzweigt nach
  `contractVersion`; Regel im Code und in der Note: Spiegel nimmt immer die aktuelle und die vorige Version an. Erzwungen wird
  „nur additiv“ über **eingefrorene Beispiele**: Jede Datei unter `examples/v<n>/` muss für jede unterstützte Version weiter
  gültig sein und ihre Prüfsumme behalten. Wer das Format nicht-additiv ändert, bricht diesen Test.
- **D9 Fehler ohne Inhalt (SF-59, vorgezogen, weil der Parser hier liegt):** `parseSnapshot`/`parseSnapshotBatch` liefern
  `{ ok: true, value } | { ok: false, issues: { path, code }[] }`. `path` nennt Feldnamen und Indizes, aber **nie Werte** und keine
  Zeilenschlüssel aus den Daten (Spaltennamen können frei sein; Pfade enden an `rows[i]`). Ein Test schiebt `Nachname:
  "Mustermann"` in ungültige Snapshots aller Fehlerarten und prüft, dass `Mustermann` nirgends in `issues` vorkommt.
- **D10 Grenzen** (`limits.ts`, Werte als Konstanten, im JSON-Schema enthalten): 200 Spalten je Tabelle, 64 Zeichen Spaltenname,
  64 Zeichen Typ, 4096 Zeichen je Zelle, 200 Serien-Zeilen, 2000 Treffer-Zeilen (LP 60 + großzügige Probe), 50 Snapshots je
  Stapel, 64 Zeichen `sessionTimeZone`/`sourceVersion`. Die Bytegrenze je Anfrage setzt die Ingest-API in SP-1.6b.
- **D11 JSON-Schema aus Zod erzeugt:** `z.toJSONSchema` schreibt `schema/snapshot-v1.schema.json` und
  `schema/snapshot-batch-v1.schema.json` (Skript `pnpm --filter @vereinsheim/ingest-contract schema`, Datei `tools/write-schema.ts`;
  bewusst nicht `scripts/`, das ist im Autopilot geschützt). Ein Test hält Datei und Zod gleich (Muster `shot-help/sync.test.ts`).
  Was JSON-Schema nicht ausdrückt (Zeilenschlüssel = `columns`, wohlgeformte Strings, Prüfsumme), steht in der `description`
  des Schemas und in der Vault-Note.
- **D12 Beispiel-Snapshots** (`examples/v1/`, synthetisch, Namen wie `Muster`/`Probe`, SportpassID `"0"` oder erfunden):
  `lg40-training.json` (Probe + vier Serien gekürzt auf wenige Schüsse, realistische Spalten der SSMDB2 6.0.2 laut
  `meyton-ssmdb2`), `nur-probe.json` (nur Stellung 0, leere Serien), `korrektur-seq1.json` + `korrektur-seq2.json` (gleiche
  Scheibe, ein Ring-Wert korrigiert, höhere Folgenummer, andere Prüfsumme) und `unveraendert-seq3.json` (wie seq2, neue
  Folgenummer und Beobachtungszeit, **gleiche** Prüfsumme). Alle Ring-/Teilerwerte plausibel, aber nicht gegen `shot-core`
  gerechnet; konsistente Fälle je SF-ID bringt der Generator in SP-1.0b.
- **D13 Nicht in SP-1.0a:** Kopplung, Aufträge, Heartbeat (kommen mit SP-1.4b/SP-1.6b), MySQL im Docker und Generator (SP-1.0b),
  Zeilen-Hashes für die Zeilenversionen (SP-1.6b, nutzt dann `canonicalize`), Go-Code der Brücke (SP-0.4/SP-1.4).

## 3. Dateien

Neu (`packages/ingest-contract/`):

- `package.json` (Exporte `./snapshot`, `./canonical`, `./checksum`, `./parse`, `./limits`, `./versions`; Skripte `check-types`,
  `test`, `format:check`, `format`, `schema`), `tsconfig.json` (`types: ["node"]`), `vitest.config.ts`, `CLAUDE.md`
- `src/canonical.ts` + `canonical.test.ts`: `canonicalize(value)`, `compareUtf16`; Tests gegen RFC 8785 §3.2.2/§3.2.3
  (Beispiel mit Zahlen, Sortierbeispiel mit `€`, `\r`, `דּ`, `1`, `😀`, `\u0080`, `ö`), Fehler bei einzelnen Surrogaten,
  `NaN`/`Infinity`, Nicht-JSON-Werten
- `src/limits.ts`: Grenzen aus D10
- `src/versions.ts`: `CURRENT_CONTRACT_VERSION`, `SUPPORTED_CONTRACT_VERSIONS`
- `src/v1/snapshot.ts`: Zod-Schemas `snapshotV1`, `snapshotBatchV1`, Typen `SnapshotV1`, `SnapshotDataV1`, `RowV1`
- `src/checksum.ts` + `checksum.test.ts`: `computeChecksum(data)`, `canonicalData(data)`; läuft alle Testvektoren
- `src/parse.ts` + `parse.test.ts`: `parseSnapshot`, `parseSnapshotBatch`, `ContractIssue`; läuft `invalid-v1.json`, den
  Mustermann-Test (D9) und die eingefrorenen Beispiele aller Versionen (D8)
- `src/schema.test.ts`: erzeugtes JSON-Schema = Datei unter `schema/`
- `src/jsonSchema.ts`: Erzeugung (von Test und Tool geteilt); `tools/write-schema.ts`
- `test-vectors/checksum-v1.json`, `test-vectors/invalid-v1.json`
- `examples/v1/*.json` (D12)
- `schema/snapshot-v1.schema.json`, `schema/snapshot-batch-v1.schema.json` (erzeugt)

Geändert:

- `pnpm-lock.yaml` (neuer Importer; danach `pnpm install --frozen-lockfile`, conventions §9)
- `vault/spiegel/spiegel-ingest-contract.md` **neu** (`type: concept`, `part_of: [[spiegel]]`, `relates_to:
  [[spiegel-ingest-pipeline]]`, `[[spiegel-bridge]]`, `governed_by: [[adr-027]]`): Format, kanonische Form, Prüfsumme,
  Versionsregel, Testvektoren, was der Vertrag bewusst nicht prüft. Normativ genug, dass jemand die Brücke in Go danach baut.
- `vault/spiegel/spiegel-ingest-pipeline.md`: Absatz „Prüfsumme“ verweist auf die neue Note
- `vault/spiegel/spiegel.md` (MOC-Link), `vault/index.md` falls nötig, `vault/spiegel/spiegel-roadmap.md` (Status SP-1.0:
  „in Arbeit, a erledigt“), `vault/spiegel/spiegel-edge-cases.md` (SF-27, SF-69 Status/Test), `vault/architecture/architecture.md`
  (Repo-Karte um `packages/ingest-contract`)

Keine geschützten Pfade (kein `scripts/`, `.claude/`, `vault/decisions/`, Deploy-Vertrag, Schema) → `/implement` kann
autonom laufen.

## 4. Tasks (je ein Commit)

1. Plan nach `plans/` übernehmen, Branch `feat/spiegel-ingest-contract`.
2. Paketgerüst + `canonical.ts` mit RFC-8785-Tests.
3. `limits.ts`, `versions.ts`, `v1/snapshot.ts`, `checksum.ts`; Testvektoren von Hand schreiben, Prüfsummen extern berechnen,
   `checksum.test.ts`. Mutationsprobe: Zeilensortierung weglassen → der Vertauscht-Vektor wird rot; Sortierung auf
   Codepoints umstellen → der Emoji-Vektor wird rot (conventions §9).
4. `parse.ts` mit Versions-Verzweigung, inhaltsfreien Issues, `invalid-v1.json`, Mustermann-Test.
5. Beispiel-Snapshots + Test der eingefrorenen Beispiele (inkl. gleiche Prüfsumme seq2/seq3, andere seq1/seq2).
6. JSON-Schema-Erzeugung, Tool, Gleichheitstest.
7. Vault: neue Note + Verweise, Roadmap, Sonderfälle, Architekturkarte; `/sync-graph`.

## 5. Verifikation

- `pnpm check` grün (alle fünf Gates; das Paket bringt `check-types`, `test`, `format:check`).
- **Gegenprobe in zwei weiteren Sprachen** in `/validate` (nicht committet, Ergebnis im Bericht): ein kleines Go-Programm und
  ein Python-Skript lesen `test-vectors/checksum-v1.json`, kanonisieren `data` selbst (mit Zeilensortierung) und vergleichen
  `canonical` und `checksum`. Erwartung: Go und Python stimmen überall, sobald nach UTF-16-Codeeinheiten sortiert wird; mit
  naiver Sortierung fällt der Emoji-Vektor durch (zeigt, dass der Vektor die Falle wirklich abdeckt). Das ist die Abnahme
  „Brücke und Spiegel rechnen dieselben Prüfsummen“, soweit sie ohne Brücke möglich ist.
- Mutationsproben aus Task 3 dokumentiert.
- `jq`/Sichtprüfung: Beispiele enthalten keine echten Namen oder Nummern (ADR-029).
- Sonderfälle: SF-27 (Testvektoren, gleiche Prüfsumme bei unverändertem Stand), SF-69 (Versionsliste, eingefrorene Beispiele).
