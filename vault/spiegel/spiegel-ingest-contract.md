---
id: spiegel-ingest-contract
type: concept
title: "Spiegel — Ingest-Vertrag (Snapshot v1)"
aliases: [ingest-contract, vertrag, snapshot-format, snapshot-v1, prüfsumme, kanonische-serialisierung]
keywords: [vertrag, contract, ingest-contract, snapshot, snapshot v1, json schema, zod, prüfsumme, checksum, sha-256, kanonische serialisierung, jcs, rfc 8785, utf-16, sortierung, testvektoren, beispiel-snapshots, vertragsversion, additiv, vorversion, folgenummer, beobachtungszeit, sitzungs-zeitzone, zellwert, textprotokoll, sql.rawbytes, go, brücke, fehler ohne inhalt, grenzen, stapel]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-ingest-pipeline]]", "[[spiegel-bridge]]", "[[spiegel-data-model]]", "[[spiegel-edge-cases]]", "[[meyton-ssmdb2]]"]
governed_by: ["[[adr-027]]", "[[adr-029]]"]
---

**TL;DR** Die Brücke schickt je Scheibe einen Snapshot: eine Hülle (Version, Quelle, Epoche, ScheibenID, Folgenummer, Beobachtungszeit, Sitzungs-Zeitzone) und `data` mit den rohen Zeilen aus `Scheiben`, `Serien` und `Treffer`, jeder Zellwert als Text oder `null`. Die Prüfsumme ist SHA-256 über die kanonische Form (RFC 8785) von `data` mit sortierten Zeilen; Hülle und Reihenfolge gehen nicht ein. Code, JSON-Schema, Testvektoren und Beispiele liegen in `packages/ingest-contract` (SP-1.0a, Oktober 2026).

# Spiegel — Ingest-Vertrag (Snapshot v1)

Diese Note ist die Spezifikation für jede Implementierung, auch die Brücke in einer anderen Sprache
(Go: `apps/spiegel-bridge/internal/contract`, gegen dieselben Vektoren getestet). Verbindlich sind im Zweifel die Testvektoren im Paket.

## Wo was liegt

| Was | Datei in `packages/ingest-contract` |
|---|---|
| Schema (Quelle) | `src/v1/snapshot.ts` (Zod) |
| JSON-Schema, erzeugt | `schema/snapshot-v1.schema.json`, `schema/snapshot-batch-v1.schema.json`; mit ajv gegen Beispiele und ungültige Snapshots geprüft (`src/jsonSchema.test.ts`) |
| Kanonische Form | `src/canonical.ts` |
| Prüfsumme | `src/checksum.ts` |
| Annehmen und prüfen | `src/parse.ts` |
| Testvektoren Prüfsumme | `test-vectors/checksum-v1.json` |
| Ungültige Snapshots | `test-vectors/invalid-v1.json` |
| Eingefrorene Beispiele | `examples/v1/*.json` |

## Format v1

```
Snapshot {
  contractVersion: 1
  source: "meyton-ssmdb2"
  sourceVersion: string | null          Inhalt der Tabelle `Version`, falls lesbar
  epoch: Ganzzahl ≥ 1                    Epoche der Quelle (SF-23)
  scheibenId: Ganzzahl, 32 Bit mit Vorzeichen
  sequence: Ganzzahl ≥ 1                 Folgenummer, streng steigend (SF-26); ohne Zustand: ms seit 1970
  observedAt: "YYYY-MM-DDTHH:mm:ss.sssZ" Beobachtungszeit in UTC
  sessionTimeZone: string                @@session.time_zone beim Lesen (SF-31)
  data: {
    scheiben: { columns, rows }          genau eine Zeile
    serien:   { columns, rows }          0 bis 200 Zeilen
    treffer:  { columns, rows }          0 bis 2000 Zeilen, Probe eingeschlossen
  }
  checksum: "sha256:" + 64 Hex-Zeichen, klein
}
columns = { Spaltenname: Spaltentyp }   aus information_schema.COLUMNS.COLUMN_TYPE, z. B. "int(11)"
Zeile   = { Spaltenname: string | null } genau die Schlüssel aus columns
Stapel  = { snapshots: [Snapshot, …] }   1 bis 50
```

- **Zellwerte sind Text oder `null`**, so wie MySQL sie im Textprotokoll liefert: `"-7257056"`,
  `"0000-00-00 00:00:00"`, `"103.4"`. In Go liefert `sql.RawBytes` genau das. So geht nichts verloren
  (kein Float, kein Datum, das ein Treiber umdeutet), und im gehashten Teil gibt es keine Zahlen,
  deren Formatierung zwischen Sprachen abweicht. Skalen und Typen deutet erst der Adapter
  ([[spiegel-ingest-pipeline]]).
- **Alle Spalten** (`SELECT *`) mit ihrem Typ. Unbekannte Spalten reisen mit, ein Typwechsel ist
  sichtbar (SF-25, SF-31).
- **Strikt:** unbekannte Felder in Hülle, `data` und Tabellen werden abgelehnt. Spiegel ist nie älter
  als die Brücke, deshalb ist das sicher.
- **Grenzen:** 200 Spalten je Tabelle, Spaltenname und Typ je 64, Zellwert 4096, `sessionTimeZone` und
  `sourceVersion` je 64. Längen zählen in **UTF-16-Codeeinheiten** (wie JavaScript `length`), nicht in
  Codepoints wie `maxLength` im JSON-Schema: Ein Zeichen über U+FFFF zählt doppelt. In Go:
  `len(utf16.Encode([]rune(s)))`. Wer nur gegen das JSON-Schema prüft, kann knapp zu lange Werte
  schicken (Fall `zelle-zu-lang-utf16`).
- **Speicher begrenzt erst die Bytegrenze der Ingest-API** (SP-1.6b): Zod parst ein Array ganz, bevor es
  die Zeilenzahl prüft, und innerhalb der Grenzen oben wäre ein Snapshot rechnerisch über 1 GB groß.
- Alle Strings sind **wohlgeformtes Unicode** (keine einzelnen Surrogate). Die Brücke liest mit
  `charset=utf8mb4`; ungültige Bytes aus der Ablage ersetzt sie nicht still (Go `encoding/json` machte
  U+FFFD daraus), sondern meldet die Scheibe im Heartbeat und schickt sie nicht.
- **Der Schlüssel `__proto__` ist überall verboten** (Hülle, `data`, Tabellen, Spalten, Zeilen; Code
  `forbidden-key`). `JSON.parse` legt ihn als normalen Schlüssel an, Zod verwirft ihn still; sonst
  passierte eine Zeile mit ihm die Spaltenprüfung, und Brücke und Spiegel rechneten verschiedene
  Prüfsummen.

**Der Vertrag kennt keine Meyton-Spalten.** Er prüft nur die Form. Ob `ScheibenID` in den Zeilen zur
Hülle passt, ob Primärschlüssel eindeutig sind oder eine erwartete Spalte fehlt, prüft der Adapter und
legt die Rohdaten dann in Quarantäne, statt sie abzulehnen (SF-25).

## Kanonische Form und Prüfsumme

1. **Kanonische Form** nach RFC 8785 (JCS): keine Leerzeichen; Objektschlüssel sortiert nach
   **UTF-16-Codeeinheiten** (nicht nach Codepoints, nicht nach UTF-8-Bytes); Strings wie
   ECMAScript `JSON.stringify`: escapet werden nur `"`, `\` und Steuerzeichen unter U+0020 (als `\b`,
   `\t`, `\n`, `\f`, `\r`, sonst `\u00xx` klein); `/`, U+007F, U+2028 und alles Nicht-ASCII bleiben roh.
   Ausgabe als UTF-8.
2. **Zeilen sortieren:** In jeder Tabelle werden die Zeilen nach ihrer eigenen kanonischen Form sortiert,
   ebenfalls nach UTF-16-Codeeinheiten.
3. **Prüfsumme** = `"sha256:"` + Hex (klein) von SHA-256 über die UTF-8-Bytes der kanonischen Form von
   `data` mit sortierten Zeilen.

Folgen:

- Reihenfolge von Zeilen, Spalten und Tabellen ändert nichts; die Brücke darf ohne `ORDER BY` lesen.
- Die **Hülle geht nicht ein.** Ein unveränderter Stand mit neuer Folgenummer und Beobachtungszeit hat
  dieselbe Prüfsumme; Spiegel legt keine Revision an (SF-27). Additive Felder in der Hülle ändern alte
  Prüfsummen nie.
- Ein anderer Wert, `null` statt `""`, eine neue Spalte oder ein anderer Spaltentyp ändern sie.

**Falle UTF-16:** Python (`sort_keys`) und Go (`sort.Strings`) sortieren nach Codepoints bzw. Bytes. Das
weicht ab, sobald ein Zeichen über U+FFFF auf eines zwischen U+E000 und U+FFFF trifft (Vektor
`utf16-sortierung`: U+1F3AF vor U+FB01). In Python sortiert `key=lambda s: s.encode("utf-16-be")`
richtig, in Go ein Vergleich über `utf16.Encode([]rune(s))`.

**Falle Escapes:** Go `encoding/json` escapet U+2028 und U+2029 immer und `<`, `>`, `&` ohne
`SetEscapeHTML(false)`; Python escapet ohne `ensure_ascii=False` alles Nicht-ASCII. Die Strings brauchen
deshalb eine eigene kleine Serialisierung nach Schritt 1 (Vektoren `escapes` und
`escapes-html-und-steuerzeichen`; mit `json.Marshal` fallen beide durch, gemessen).

## Testvektoren

`test-vectors/checksum-v1.json` enthält je Vektor `data`, die erwartete kanonische Form `canonical` und
`checksum`, dazu `sameChecksumAs` bzw. `differentChecksumFrom`. Abgedeckt: Grundfall (negative
ScheibenID, `0000-00-00` als Text), Zeilen und Spalten vertauscht, `null` gegen leeren Text, Umlaute,
UTF-16-Sortierung in Spaltennamen und Zeilen, Escapes (auch `<>&`, U+2029, `\b`, `\f`, `\r`, U+0000),
leere Serien und Treffer, Zusatzspalte, geänderter Wert, geänderter Typ. Erzeugt wurden sie von einer **unabhängigen** Python-Implementierung,
nicht vom TypeScript-Code; die TS-Implementierung reproduziert sie (Test `checksum.test.ts`).
**Bestehende Vektoren werden nie geändert, nur neue angehängt.** Eine neue Implementierung (die Brücke)
liest dieselbe Datei in ihren Tests.

`test-vectors/invalid-v1.json` listet Snapshots, die abgelehnt werden müssen, je mit dem erwarteten
ersten Fehler: Zahl statt Text, fehlende oder fremde Spalte in einer Zeile, keine oder zwei
Scheiben-Zeilen, leere Spaltenliste, fehlende Tabelle, zu langer Wert (auch in UTF-16 gezählt),
einzelnes Surrogat, falsche oder veraltete Prüfsumme, unbekanntes Hüllenfeld, Version 2 oder keine,
ScheibenID-Überlauf, Folgenummer 0, Zeit mit Versatz oder ohne Millisekunden, unbekannte Quelle, kein
Objekt, Zeile mit umbenanntem Schlüssel, zu langer Spaltentyp, leerer Spaltenname, `__proto__` in Zeile,
Hülle, Tabelle und als Spalte. Der Fall `einzelnes-surrogat` steht als `\ud83d` in der Datei; strenge
Parser (`jq`) lehnen schon das JSON ab, `JSON.parse` nimmt es an, dann der Vertrag nicht.

## Annehmen in Spiegel

`parseSnapshot` und `parseSnapshotBatch` liefern `{ ok: true, value }` oder `{ ok: false, issues }`.
Ablauf: Objekt? → Vertragsversion unterstützt? → `__proto__` irgendwo? → Schema der Version →
Prüfsumme nachrechnen. Spiegel nimmt Snapshots nur über `parseSnapshot` an, nie direkt über das
Zod-Schema (dem fehlen die Prüfungen davor und danach). Ein Stapel
ist nur als Ganzes gültig; Fehler nennen den Index (`snapshots[1].checksum`).

**Fehler ohne Inhalt (SF-59):** Ein Fehler ist nur `{ path, code }`. Pfade enden an `columns` und an
`rows[i]`, Spaltennamen und Werte stehen nie darin; höchstens 20 Fehler je Prüfung. Codes sind die von
Zod (`invalid_type`, `too_big`, `unrecognized_keys`, …) oder eigene: `row-columns-mismatch`,
`column-count`, `malformed-string`, `forbidden-key`, `checksum-mismatch`, `unsupported-contract-version`. Ein Test schickt
den Namen `Mustermann` durch jede Fehlerart und prüft, dass er nirgends auftaucht. Dass die Logs der
Ingest-API selbst keinen Inhalt schreiben, prüft SP-1.6b.

## Versionen (SF-69)

- `CURRENT_CONTRACT_VERSION = 1`, `SUPPORTED_CONTRACT_VERSIONS = [1]`. Spiegel nimmt immer die aktuelle
  **und** die vorige Version an; ein Test erzwingt das, sobald es eine v2 gibt.
- Änderungen sind **nur additiv**. Erzwungen über die **eingefrorenen Beispiele** unter
  `examples/v<n>/`: Jede Datei bleibt gültig und behält ihre Prüfsumme, solange Version n unterstützt
  wird. Beispiele werden nie geändert, nur ergänzt.
- Eine neue Version bekommt eigene Schemas (`src/v2/…`), einen Zweig in `parseSnapshot` und eigene
  Vektoren und Beispiele.

## Beispiele v1

Synthetisch ([[adr-029]]): Name `Muster`, SportpassID `12345678`, Spalten nach [[meyton-ssmdb2]] für
6.0.2, Typen nach Handbuch geschätzt. Werte plausibel, aber nicht
nach `shot-core` gerechnet. Fälle je Sonderfall im echten Schema, mit Werten aus `shot-core`, liegen in
`packages/ssmdb2-cases` (`cases/v1/<SF-ID>`). Das echte Schema weicht von den Beispielen ab: Namen
`StarterlistenID`, `KlassenID`, `VereinsID` statt `StarterlisteID`, `KlasseID`, `VereinID`, `Status varchar(72)`
statt `int(11)`, alle Spalten NOT NULL; die Probe hat eigene Zeilen in `Serien` (in `nur-probe.json` fehlen sie). Die
Beispiele bleiben eingefroren (nur ergänzen); für Tests gegen das echte Schema gelten die Fälle.

| Datei | Inhalt |
|---|---|
| `lg-training.json` | Probe und zwei gekürzte Serien |
| `nur-probe.json` | nur Stellung 0, keine Serien |
| `korrektur-seq1.json`, `korrektur-seq2.json` | dieselbe Scheibe, ein Treffer korrigiert: andere Prüfsumme |
| `unveraendert-seq3.json` | wie seq2, später erneut gelesen: neue Folgenummer, gleiche Prüfsumme |

## API v1 neben dem Snapshot

`src/v1/api.ts` (Export `@vereinsheim/ingest-contract/api`), JSON-Schemas unter `schema/*-v1.schema.json`, eingefrorene
Beispiele unter `examples/api-v1/` (Dateiname = Schema, nur ergänzen). Anfragen nimmt Spiegel über
`parseApi(schema, input)` an (Version, `__proto__`, Fehler ohne Inhalt wie beim Snapshot).

| Schema | Inhalt |
|---|---|
| `pairRequestV1` / `pairResponseV1` | Kopplungscode (zehn Zeichen aus Crockfords Base32, „ABCDE-FGHJK“, Trenner und Schreibweise egal, `normalizePairingCode`), Name, Version → Brücken-Id, Token `spgl_` + 43 Zeichen Base64url, Anlage |
| `heartbeatV1` / `heartbeatResponseV1` | Version, Beginn des Laufs, Sendezeit, Status, Rückstau, letzter DB-Kontakt, Dauer der Abfragen, Uhrabweichung der Anlage (Anlage minus Brücke), Zurückgehaltenes je Anzeigeart, Fingerabdruck der Quelle ohne Personen, additiv `historyDone` (erledigte Aufträge zum Nachladen als `{ id, since }`) und der Status `clock` (die Uhr der Brücke lag mehr als `BRIDGE_CLOCK_TOLERANCE_MS` = 30 s neben `serverTime`, SF-79) → `serverTime`, an der die Brücke ihre Uhr misst |
| `stateResponseV1` | Anlage, bestätigte Epoche, gehashte SportpassIDs mit Zustimmung und ihr Salz, Grabsteine und Löschsperren (ScheibenID und Beginn), Wasserstand; additiv `history` (offene Aufträge zum Nachladen: Id, `since` und Hash; ein neues `since` derselben Id ist ein neuer Auftrag; solange einer offen ist, alle Sperren statt der jüngsten 60 Tage). Eine Brücke ohne Nachladen meldet nie „erledigt“: Der Auftrag bleibt offen, alle Sperren gehen weiter hinaus, die Übersicht sagt „lädt nach“ |
| `snapshotsResponseV1` | Ergebnis je Snapshot in der Folge des Stapels (`SNAPSHOT_OUTCOMES`, bei `discarded` ein Grund); additiv `past` (Beobachtung weit vor der Empfangszeit, SF-79). Nicht endgültig sind `RETRY_OUTCOMES` (`future`, `epoch-unconfirmed`, `past`): Die Brücke schickt den Stand später noch einmal |
| `errorResponseV1` | fester Code (`API_ERROR_CODES`), fester Satz, `retryAfterSeconds`, bei `invalid` die Fehler des Vertrags |

**Gehashte SportpassID** (`sportpassHash`, Export `./sportpass`): SHA-256 (Hex, klein) über
`spiegel-sportpass-v1:<salt>:<SportpassID dezimal ohne führende Nullen>`, das Salz je Anlage aus `state`. Testvektoren aus
einer unabhängigen Python-Rechnung (`test-vectors/sportpass-v1.json`). Der Hash hält die Nummern aus Logs und
Mitschnitten; wer Liste und Salz hat, kann zwölf Stellen durchprobieren.

**Vektor der API** (`test-vectors/api-v1.json`): von Hand aus der Spezifikation, keine Rechnung. Welche Ergebnisse
endgültig sind, welche Status ein Heartbeat tragen darf und die Schwelle für die Uhr der Brücke. TypeScript prüft ihn
gegen die Exporte, Go gegen `Result.Final`, die Status des Runners und `ClockTolerance`.

**Noch nicht im Vertrag:** Aufträge (`commands`, SP-1.5, SP-1.7 b).
